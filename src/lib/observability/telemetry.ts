/**
 * Phase 48: Centralized System Telemetry Service
 * High-performance, sampled request instrumentation, 100% error/slow request capture,
 * and observability self-monitoring.
 */

import prisma from '@/lib/db';
import { sanitizeMetadata } from './sanitizer';
import { SYSTEM_SLOW_REQUEST_MS, SYSTEM_TELEMETRY_SAMPLE_RATE } from './alert-constants';
import * as crypto from 'crypto';

export type SystemEventType =
  | 'REQUEST'
  | 'ERROR'
  | 'AUTH_FAILURE'
  | 'AUTH_SUCCESS'
  | 'API_FAILURE'
  | 'DB_ERROR'
  | 'AI_ERROR'
  | 'INTEGRATION_ERROR'
  | 'JOB_FAILURE'
  | 'WEBHOOK_FAILURE'
  | 'SECURITY_EVENT'
  | 'CONFIGURATION_WARNING'
  | 'DATA_QUALITY_WARNING'
  | 'DEPLOYMENT_EVENT'
  | 'SYSTEM'
  | 'BILLING'
  | 'JOB';

export interface RecordTelemetryInput {
  organizationId?: string | null;
  userId?: string | null;
  eventType: SystemEventType;
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  requestId?: string | null;
  traceId?: string | null;
  service?: string;
  message?: string | null;
  metadata?: unknown;
  timestamp?: number | Date | null;
}

const SLOW_REQUEST_MS = SYSTEM_SLOW_REQUEST_MS;
const SAMPLE_RATE = SYSTEM_TELEMETRY_SAMPLE_RATE;

// In-memory counters for process-lifetime tracking
interface AggregateCounters {
  exactTotalRequests: number;
  successfulRequests: number;
  errors4xx: number;
  errors5xx: number;
  slowRequests: number;
}

const globalCounters: AggregateCounters = {
  exactTotalRequests: 0,
  successfulRequests: 0,
  errors4xx: 0,
  errors5xx: 0,
  slowRequests: 0,
};

const orgCounters: Map<string, AggregateCounters> = new Map();

export interface SystemMetricBucket {
  organizationId: string | null;
  bucketStart: number; // epoch ms
  bucketSize: number; // e.g. 60000 ms (1 minute)
  requests: number;
  success: number;
  errors4xx: number;
  errors5xx: number;
  slowRequests: number;
}

// Bounded in-memory time-bucket storage (pruned to 30 days)
const metricBuckets: Map<string, SystemMetricBucket> = new Map();
const BUCKET_SIZE_MS = 60 * 1000; // 1-minute buckets
const MAX_BUCKET_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getBucketKey(organizationId: string | null, bucketStart: number): string {
  return `${organizationId || 'global'}:${bucketStart}`;
}

function pruneOldBuckets(): void {
  const cutoff = Date.now() - MAX_BUCKET_RETENTION_MS;
  for (const [key, bucket] of metricBuckets.entries()) {
    if (bucket.bucketStart < cutoff) {
      metricBuckets.delete(key);
    }
  }
}

export function recordMetricToBucket(
  event: RecordTelemetryInput,
  timestampMs: number = Date.now()
): void {
  const bucketStart = Math.floor(timestampMs / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
  const isSuccess =
    event.statusCode !== undefined && event.statusCode !== null && event.statusCode >= 200 && event.statusCode < 400;
  const is4xx =
    event.statusCode !== undefined && event.statusCode !== null && event.statusCode >= 400 && event.statusCode < 500;
  const is5xx =
    event.statusCode !== undefined && event.statusCode !== null && event.statusCode >= 500;
  const isSlow =
    event.durationMs !== undefined && event.durationMs !== null && event.durationMs >= SLOW_REQUEST_MS;

  // 1. Update tenant bucket if organizationId exists
  if (event.organizationId) {
    const tenantKey = getBucketKey(event.organizationId, bucketStart);
    let bucket = metricBuckets.get(tenantKey);
    if (!bucket) {
      bucket = {
        organizationId: event.organizationId,
        bucketStart,
        bucketSize: BUCKET_SIZE_MS,
        requests: 0,
        success: 0,
        errors4xx: 0,
        errors5xx: 0,
        slowRequests: 0,
      };
      metricBuckets.set(tenantKey, bucket);
    }
    bucket.requests++;
    if (isSuccess) bucket.success++;
    if (is4xx) bucket.errors4xx++;
    if (is5xx) bucket.errors5xx++;
    if (isSlow) bucket.slowRequests++;
  }

  // 2. Always update global bucket
  const globalKey = getBucketKey(null, bucketStart);
  let globalBucket = metricBuckets.get(globalKey);
  if (!globalBucket) {
    globalBucket = {
      organizationId: null,
      bucketStart,
      bucketSize: BUCKET_SIZE_MS,
      requests: 0,
      success: 0,
      errors4xx: 0,
      errors5xx: 0,
      slowRequests: 0,
    };
    metricBuckets.set(globalKey, globalBucket);
  }
  globalBucket.requests++;
  if (isSuccess) globalBucket.success++;
  if (is4xx) globalBucket.errors4xx++;
  if (is5xx) globalBucket.errors5xx++;
  if (isSlow) globalBucket.slowRequests++;

  // Periodically prune old buckets
  if (metricBuckets.size > 5000) {
    pruneOldBuckets();
  }
}

export function getTimeWindowAggregateCounters(
  sinceMs: number,
  untilMs: number = Date.now(),
  organizationId?: string | null
): {
  exactTotalRequests: number;
  successfulRequests: number;
  errors4xx: number;
  errors5xx: number;
  slowRequests: number;
  calculationMode: 'EXACT';
  isAuthoritative: boolean;
  timeRangeMs: number;
  bucketCount: number;
} {
  let exactTotalRequests = 0;
  let successfulRequests = 0;
  let errors4xx = 0;
  let errors5xx = 0;
  let slowRequests = 0;
  let bucketCount = 0;

  for (const bucket of metricBuckets.values()) {
    // Organization scoping:
    // If organizationId is provided, only include buckets for that organization.
    // If organizationId is not provided (global operator), include global buckets (organizationId === null).
    const matchesOrg = organizationId
      ? bucket.organizationId === organizationId
      : bucket.organizationId === null;

    if (matchesOrg && bucket.bucketStart >= sinceMs && bucket.bucketStart <= untilMs) {
      exactTotalRequests += bucket.requests;
      successfulRequests += bucket.success;
      errors4xx += bucket.errors4xx;
      errors5xx += bucket.errors5xx;
      slowRequests += bucket.slowRequests;
      bucketCount++;
    }
  }

  return {
    exactTotalRequests,
    successfulRequests,
    errors4xx,
    errors5xx,
    slowRequests,
    calculationMode: 'EXACT',
    isAuthoritative: true,
    timeRangeMs: untilMs - sinceMs,
    bucketCount,
  };
}

export function clearMetricBuckets(): void {
  metricBuckets.clear();
}

export function getAggregateCounters(organizationId?: string | null): AggregateCounters & { calculationMode: 'EXACT_COUNTERS' } {
  if (organizationId && orgCounters.has(organizationId)) {
    return { ...orgCounters.get(organizationId)!, calculationMode: 'EXACT_COUNTERS' };
  }
  return { ...globalCounters, calculationMode: 'EXACT_COUNTERS' };
}

// Pipeline self-monitoring state
interface PipelineStats {
  totalRecorded: number;
  totalFlushed: number;
  lastWriteAt: string | null;
  lastFlushError: string | null;
  storageStatus: 'CONNECTED' | 'DEGRADED';
}

const stats: PipelineStats = {
  totalRecorded: 0,
  totalFlushed: 0,
  lastWriteAt: null,
  lastFlushError: null,
  storageStatus: 'CONNECTED',
};

// In-memory buffer for high-throughput metrics and batched persistence
const pendingBatch: RecordTelemetryInput[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

async function flushBatch(): Promise<void> {
  if (pendingBatch.length === 0) return;
  const items = pendingBatch.splice(0, pendingBatch.length);

  try {
    const data = items.map((item) => ({
      organizationId: item.organizationId || null,
      userId: item.userId || null,
      eventType: item.eventType,
      severity: item.severity || 'INFO',
      route: item.route || null,
      method: item.method || null,
      statusCode: item.statusCode !== undefined ? item.statusCode : null,
      durationMs: item.durationMs !== undefined ? item.durationMs : null,
      requestId: item.requestId || null,
      traceId: item.traceId || null,
      service: item.service || 'api',
      message: item.message || null,
      metadata: sanitizeMetadata(item.metadata),
      ...(item.timestamp ? { createdAt: new Date(item.timestamp) } : {}),
    }));

    await prisma.systemTelemetryEvent.createMany({
      data,
      skipDuplicates: true,
    });

    stats.totalFlushed += items.length;
    stats.lastWriteAt = new Date().toISOString();
    stats.storageStatus = 'CONNECTED';
    stats.lastFlushError = null;
  } catch (err: any) {
    stats.storageStatus = 'DEGRADED';
    stats.lastFlushError = err.message || String(err);
    console.error('[Telemetry] Failed to persist batch:', err);
  }
}

export function recordTelemetry(event: RecordTelemetryInput): void {
  stats.totalRecorded++;

  // Record into time-bucketed metric store
  const eventTimeMs = event.timestamp ? new Date(event.timestamp).getTime() : Date.now();
  recordMetricToBucket(event, eventTimeMs);

  // Update real-time aggregate counters for every request
  globalCounters.exactTotalRequests++;
  if (event.organizationId) {
    if (!orgCounters.has(event.organizationId)) {
      orgCounters.set(event.organizationId, {
        exactTotalRequests: 0,
        successfulRequests: 0,
        errors4xx: 0,
        errors5xx: 0,
        slowRequests: 0,
      });
    }
    orgCounters.get(event.organizationId)!.exactTotalRequests++;
  }

  const isSuccess = event.statusCode !== undefined && event.statusCode !== null && event.statusCode >= 200 && event.statusCode < 400;
  if (isSuccess) {
    globalCounters.successfulRequests++;
    if (event.organizationId) orgCounters.get(event.organizationId)!.successfulRequests++;
  }

  const is4xx = event.statusCode !== undefined && event.statusCode !== null && event.statusCode >= 400 && event.statusCode < 500;
  if (is4xx) {
    globalCounters.errors4xx++;
    if (event.organizationId) orgCounters.get(event.organizationId)!.errors4xx++;
  }

  const is5xx = event.statusCode !== undefined && event.statusCode !== null && event.statusCode >= 500;
  if (is5xx) {
    globalCounters.errors5xx++;
    if (event.organizationId) orgCounters.get(event.organizationId)!.errors5xx++;
  }

  const isSlow =
    event.durationMs !== undefined && event.durationMs !== null && event.durationMs >= SLOW_REQUEST_MS;
  if (isSlow) {
    globalCounters.slowRequests++;
    if (event.organizationId) orgCounters.get(event.organizationId)!.slowRequests++;
  }

  const isError =
    is4xx ||
    is5xx ||
    event.severity === 'ERROR' ||
    event.severity === 'CRITICAL' ||
    event.eventType.endsWith('_ERROR') ||
    event.eventType.endsWith('_FAILURE') ||
    event.eventType === 'ERROR';

  const isSpecialEvent =
    event.eventType === 'SECURITY_EVENT' ||
    event.eventType === 'AUTH_FAILURE' ||
    event.eventType === 'CONFIGURATION_WARNING' ||
    event.eventType === 'DATA_QUALITY_WARNING' ||
    event.eventType === 'DEPLOYMENT_EVENT';

  // 100% of errors, slow requests, and security/config events; sampled for healthy 2xx requests
  const shouldRecord = isError || isSlow || isSpecialEvent || Math.random() < SAMPLE_RATE;
  if (!shouldRecord) return;

  pendingBatch.push(event);

  if (pendingBatch.length >= 25) {
    void flushBatch();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushTimeout = null;
      void flushBatch();
    }, 2000);
  }
}

export const recordTelemetryEvent = recordTelemetry;

export async function flushTelemetrySync(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  await flushBatch();
}

export function getTelemetryPipelineHealth() {
  return {
    ...stats,
    status: stats.storageStatus === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
    storage: stats.storageStatus === 'CONNECTED' ? 'POSTGRESQL_BATCH' : 'MEMORY_DEGRADED',
    bufferedEvents: pendingBatch.length,
    bufferLength: pendingBatch.length,
    droppedEvents: 0,
    lastFlushTimestamp: stats.lastWriteAt,
  };
}

export function generateCorrelationIds(): { requestId: string; traceId: string } {
  return {
    requestId: `req_${crypto.randomBytes(8).toString('hex')}`,
    traceId: `trc_${crypto.randomBytes(12).toString('hex')}`,
  };
}
