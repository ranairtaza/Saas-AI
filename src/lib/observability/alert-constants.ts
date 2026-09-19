/**
 * Phase 47.1: Named System Alert & Performance Configuration Constants
 * Centralized, deterministic thresholds for system alerting and monitoring.
 */

export const SYSTEM_SLOW_REQUEST_MS = Number(process.env.SYSTEM_SLOW_REQUEST_MS || '750');
export const SYSTEM_5XX_ALERT_THRESHOLD = Number(process.env.SYSTEM_5XX_ALERT_THRESHOLD || '10');
export const SYSTEM_STALE_JOB_MINUTES = Number(process.env.SYSTEM_STALE_JOB_MINUTES || '30');
export const SYSTEM_ERROR_RATE_THRESHOLD = Number(process.env.SYSTEM_ERROR_RATE_THRESHOLD || '0.05');
export const SYSTEM_HEALTH_CACHE_TTL_MS = Number(process.env.SYSTEM_HEALTH_CACHE_TTL_MS || '10000');
export const SYSTEM_TELEMETRY_SAMPLE_RATE = Number(process.env.SYSTEM_TELEMETRY_SAMPLE_RATE || '0.1');
