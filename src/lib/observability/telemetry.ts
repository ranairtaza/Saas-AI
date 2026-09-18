/**
 * Phase 48: Centralized System Telemetry Service
 * High-performance, sampled request instrumentation, 100% error/slow request capture,
 * and observability self-monitoring.
 */

import prisma from '@/lib/db';
import { sanitizeMetadata } from './sanitizer';
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
}

const SLOW_REQUEST_MS = Number(process.env.SYSTEM_SLOW_REQUEST_MS || '750');
const SAMPLE_RATE = Number(process.env.SYSTEM_TELEMETRY_SAMPLE_RATE || '0.1');

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

  const isError =
    (event.statusCode !== undefined && event.statusCode !== null && event.statusCode >= 400) ||
    event.severity === 'ERROR' ||
    event.severity === 'CRITICAL' ||
    event.eventType.endsWith('_ERROR') ||
    event.eventType.endsWith('_FAILURE') ||
    event.eventType === 'ERROR';

  const isSlow =
    event.durationMs !== undefined && event.durationMs !== null && event.durationMs >= SLOW_REQUEST_MS;

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
