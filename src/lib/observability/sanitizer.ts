/**
 * Telemetry Sanitization Utility
 * Ensures sensitive credentials, tokens, cookies, and keys are strictly redacted
 * before any telemetry data is logged or persisted.
 */

const REDACTED_MASK = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(password|token|secret|authorization|cookie|key|credential|bearer|session|cookie|api[-_]?key|auth[-_]?header)/i;

export function sanitizeTelemetryValue(val: unknown, depth = 0): unknown {
  if (depth > 5) return '[MAX_DEPTH_EXCEEDED]';
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    // Check if string looks like a JWT or Bearer token
    if (/bearer\s+[a-zA-Z0-9._-]+/i.test(val)) {
      return 'Bearer ' + REDACTED_MASK;
    }
    if (val.length > 500) {
      return val.slice(0, 500) + '...[TRUNCATED]';
    }
    return val;
  }

  if (typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }

  if (Array.isArray(val)) {
    return val.slice(0, 20).map(item => sanitizeTelemetryValue(item, depth + 1));
  }

  if (typeof val === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        sanitizedObj[k] = REDACTED_MASK;
      } else {
        sanitizedObj[k] = sanitizeTelemetryValue(v, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return String(val);
}

export function sanitizeMetadata(metadata: unknown): string | null {
  if (!metadata) return null;
  try {
    const cleaned = sanitizeTelemetryValue(metadata);
    return JSON.stringify(cleaned);
  } catch {
    return JSON.stringify({ error: 'Sanitization failure' });
  }
}
