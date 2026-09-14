import { prisma } from '../../../lib/db';
import { assertDatabaseWritesAllowed, isDatabaseWritesAllowed } from '../../../lib/db-guard';
import { logAudit } from '../../../audit/logger';
import { BusinessContextBuilder } from '../context-builder';
import { ExecutiveEventDetector } from './event-detector';
import { ExecutiveEventData, ExecutiveEventSchema, EventDeduplicationState } from './types';

export class ExecutiveEventService {
  /**
   * Ingests detected events with strict deduplication against existing active events
   */
  static async ingestEvents(
    organizationId: string,
    candidateEvents: ExecutiveEventData[],
    userId?: string
  ): Promise<{
    ingested: ExecutiveEventData[];
    states: Record<string, EventDeduplicationState>;
  }> {
    const states: Record<string, EventDeduplicationState> = {};
    const ingested: ExecutiveEventData[] = [];

    const writesAllowed = isDatabaseWritesAllowed();

    // If writes disabled, process purely in-memory
    if (!writesAllowed) {
      for (const event of candidateEvents) {
        states[event.fingerprint || event.eventType] = 'NEW';
        ingested.push(event);
      }
      return { ingested, states };
    }

    assertDatabaseWritesAllowed('ingest_executive_events');

    for (const event of candidateEvents) {
      const validated = ExecutiveEventSchema.parse(event);
      const fingerprint = validated.fingerprint || `${validated.organizationId}:${validated.eventType}:${validated.sourceRecordId || 'global'}`;

      // Check if an unresolved event with same fingerprint exists
      const existing = await prisma.executiveEvent.findFirst({
        where: {
          organizationId,
          fingerprint,
          resolved: false,
        },
      });

      if (existing) {
        // Event exists and active -> deduplicate
        states[fingerprint] = 'DUPLICATE';
        continue;
      }

      // Check if previous event with same sourceRecordId and eventType exists but with different fingerprint -> update
      const previousVersion = await prisma.executiveEvent.findFirst({
        where: {
          organizationId,
          eventType: validated.eventType,
          sourceRecordId: validated.sourceRecordId || null,
          resolved: false,
        },
        orderBy: { occurredAt: 'desc' },
      });

      if (previousVersion) {
        // Mark previous as resolved/updated and insert new snapshot
        await prisma.executiveEvent.update({
          where: { id: previousVersion.id },
          data: {
            resolved: true,
            resolvedAt: new Date(),
          },
        });
        states[fingerprint] = 'UPDATED';
      } else {
        states[fingerprint] = 'NEW';
      }

      const created = await prisma.executiveEvent.create({
        data: {
          organizationId: validated.organizationId,
          eventType: validated.eventType,
          domain: validated.domain,
          severity: validated.severity,
          title: validated.title,
          summary: validated.summary,
          sourceTable: validated.sourceTable,
          sourceRecordId: validated.sourceRecordId || null,
          facts: JSON.stringify(validated.facts),
          metadata: JSON.stringify(validated.metadata || {}),
          fingerprint,
          occurredAt: new Date(validated.occurredAt),
          processed: false,
          resolved: false,
        },
      });

      if (userId) {
        await logAudit({
          organizationId,
          userId,
          action: 'EXECUTIVE_EVENT_DETECTED' as any,
          resource: 'executive_events',
          resourceId: created.id,
          input: { eventType: validated.eventType, severity: validated.severity, title: validated.title },
          output: { eventId: created.id, fingerprint },
          riskLevel: 'READ',
          status: 'SUCCESS',
        });
      }

      ingested.push({
        ...validated,
        id: created.id,
        createdAt: created.createdAt,
      });
    }

    return { ingested, states };
  }

  /**
   * Detects and ingests fresh events from current live BusinessContext
   */
  static async detectAndSyncEvents(
    organizationId: string,
    userId?: string
  ): Promise<ExecutiveEventData[]> {
    const context = await BusinessContextBuilder.buildBusinessContext(organizationId);
    const candidateEvents = await ExecutiveEventDetector.detectEvents(context);
    const { ingested } = await this.ingestEvents(organizationId, candidateEvents, userId);
    return ingested;
  }

  /**
   * Retrieves all active (unresolved) events for an organization
   */
  static async getActiveEvents(organizationId: string): Promise<ExecutiveEventData[]> {
    const writesAllowed = isDatabaseWritesAllowed();
    if (!writesAllowed) {
      // In write-disabled / in-memory mode, run detector directly
      const context = await BusinessContextBuilder.buildBusinessContext(organizationId);
      return ExecutiveEventDetector.detectEvents(context);
    }

    const records = await prisma.executiveEvent.findMany({
      where: {
        organizationId,
        resolved: false,
      },
      orderBy: [{ severity: 'desc' }, { occurredAt: 'desc' }],
      take: 25,
    });

    if (records.length === 0) {
      // If DB has no active events yet, detect and sync
      return this.detectAndSyncEvents(organizationId);
    }

    return records.map((r) =>
      ExecutiveEventSchema.parse({
        id: r.id,
        organizationId: r.organizationId,
        eventType: r.eventType as any,
        domain: r.domain as any,
        severity: r.severity as any,
        title: r.title,
        summary: r.summary,
        sourceTable: r.sourceTable,
        sourceRecordId: r.sourceRecordId,
        facts: JSON.parse(r.facts),
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
        fingerprint: r.fingerprint,
        occurredAt: r.occurredAt,
        createdAt: r.createdAt,
        processed: r.processed,
        processedAt: r.processedAt,
        resolved: r.resolved,
        resolvedAt: r.resolvedAt,
      })
    );
  }

  /**
   * Resolves an executive event
   */
  static async resolveEvent(
    organizationId: string,
    eventId: string,
    userId?: string
  ): Promise<boolean> {
    assertDatabaseWritesAllowed('resolve_executive_event');

    const event = await prisma.executiveEvent.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      throw new Error(`Event with id "${eventId}" not found for organization.`);
    }

    await prisma.executiveEvent.update({
      where: { id: eventId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });

    if (userId) {
      await logAudit({
        organizationId,
        userId,
        action: 'EXECUTIVE_EVENT_RESOLVED' as any,
        resource: 'executive_events',
        resourceId: eventId,
        input: { eventId, title: event.title },
        output: { resolved: true },
        riskLevel: 'LOW_RISK',
        status: 'SUCCESS',
      });
    }

    return true;
  }
}
