/**
 * Phase 47: Centralized System Telemetry Service
 * Non-blocking, sampled request instrumentation and 100% error/slow request capture.
 */

import prisma from '@/lib/db';
import { sanitizeMetadata } from './sanitizer';

export interface RecordTelemetryInput {
  organizationId?: string | null;
  userId?: string | null;
  eventType: 'REQUEST' | 'ERROR' | 'SYSTEM' | 'SECURITY' | 'AI' | 'BILLING' | 'JOB';
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

// In-memory buffer for high-throughput metrics and batched persistence
const pendingBatch: RecordTelemetryInput[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

async function flushBatch() {
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
  } catch (err) {
    // Non-blocking fallback to avoid breaking request cycle
    console.error('[Telemetry] Failed to persist batch:', err);
  }
}

export function recordTelemetry(event: RecordTelemetryInput): void {
  const isError = (event.statusCode !== undefined && event.statusCode !== null && event.statusCode >= 400) ||
    event.severity === 'ERROR' ||
    event.severity === 'CRITICAL' ||
    event.eventType === 'ERROR';

  const isSlow = (event.durationMs !== undefined && event.durationMs !== null && event.durationMs >= SLOW_REQUEST_MS);

  // 100% of errors and slow requests, sampled for standard healthy requests
  const shouldRecord = isError || isSlow || Math.random() < SAMPLE_RATE;
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

export async function flushTelemetrySync(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  await flushBatch();
}
