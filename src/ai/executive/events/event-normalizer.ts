import crypto from 'crypto';
import { ExecutiveEventData, ExecutiveEventSchema, EventType, EventSeverity, EventDomain } from './types';

export class EventNormalizer {
  /**
   * Generates a stable deduplication fingerprint:
   * sha256(organizationId + eventType + sourceRecordId + contentHash)
   */
  static generateFingerprint(params: {
    organizationId: string;
    eventType: EventType;
    sourceRecordId?: string | null;
    dedupKey?: string;
  }): string {
    const rawKey = [
      params.organizationId,
      params.eventType,
      params.sourceRecordId || 'global',
      params.dedupKey || '',
    ].join(':');

    return crypto.createHash('sha256').update(rawKey).digest('hex').substring(0, 32);
  }

  /**
   * Normalizes raw event input into a validated ExecutiveEventData structure
   */
  static normalizeEvent(params: {
    organizationId: string;
    eventType: EventType;
    domain: EventDomain;
    severity: EventSeverity;
    title: string;
    summary: string;
    sourceTable: string;
    sourceRecordId?: string | null;
    facts: string[];
    metadata?: Record<string, any>;
    dedupKey?: string;
    occurredAt?: Date;
  }): ExecutiveEventData {
    const occurredAt = params.occurredAt || new Date();
    const fingerprint = this.generateFingerprint({
      organizationId: params.organizationId,
      eventType: params.eventType,
      sourceRecordId: params.sourceRecordId,
      dedupKey: params.dedupKey,
    });

    return ExecutiveEventSchema.parse({
      organizationId: params.organizationId,
      eventType: params.eventType,
      domain: params.domain,
      severity: params.severity,
      title: params.title.trim(),
      summary: params.summary.trim(),
      sourceTable: params.sourceTable,
      sourceRecordId: params.sourceRecordId || null,
      facts: params.facts.map((f) => f.trim()).filter(Boolean),
      metadata: params.metadata || {},
      fingerprint,
      occurredAt,
      processed: false,
      resolved: false,
    });
  }
}
