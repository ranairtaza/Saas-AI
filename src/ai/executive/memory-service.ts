import { prisma } from '../../lib/db';
import { assertDatabaseWritesAllowed } from '../../lib/db-guard';
import {
  ExecutiveMemoryCategory,
  ExecutiveMemoryEntryData,
  ExecutiveMemoryEntrySchema,
} from './types';
import { logAudit } from '../../audit/logger';

export class ExecutiveMemoryService {
  /**
   * Records a new executive memory entry
   */
  static async createMemory(
    organizationId: string,
    data: {
      category: ExecutiveMemoryCategory;
      title: string;
      summary: string;
      facts?: string[];
      observations?: string[];
      outcome?: string;
      sourceActionId?: string;
      userId?: string;
    }
  ): Promise<ExecutiveMemoryEntryData> {
    assertDatabaseWritesAllowed('create executive memory');

    const created = await prisma.executiveMemoryEntry.create({
      data: {
        organizationId,
        category: data.category,
        title: data.title,
        summary: data.summary,
        facts: JSON.stringify(data.facts || []),
        observations: JSON.stringify(data.observations || []),
        outcome: data.outcome,
        sourceActionId: data.sourceActionId,
      },
    });

    if (data.userId) {
      await logAudit({
        organizationId,
        userId: data.userId,
        action: 'EXECUTIVE_MEMORY_CREATED' as any,
        resource: `executiveMemory:${created.id}`,
        status: 'SUCCESS',
        details: { category: data.category, title: data.title },
      });
    }

    return {
      id: created.id,
      organizationId: created.organizationId,
      category: created.category as ExecutiveMemoryCategory,
      title: created.title,
      summary: created.summary,
      facts: JSON.parse(created.facts),
      observations: JSON.parse(created.observations),
      outcome: created.outcome || undefined,
      sourceActionId: created.sourceActionId || undefined,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Retrieves bounded executive memories for an organization, optionally filtered by category
   */
  static async getMemories(
    organizationId: string,
    options?: {
      category?: ExecutiveMemoryCategory;
      limit?: number;
    }
  ): Promise<ExecutiveMemoryEntryData[]> {
    const limit = Math.min(options?.limit || 10, 50);

    const records = await prisma.executiveMemoryEntry.findMany({
      where: {
        organizationId,
        ...(options?.category ? { category: options.category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      category: r.category as ExecutiveMemoryCategory,
      title: r.title,
      summary: r.summary,
      facts: typeof r.facts === 'string' ? JSON.parse(r.facts) : [],
      observations: typeof r.observations === 'string' ? JSON.parse(r.observations) : [],
      outcome: r.outcome || undefined,
      sourceActionId: r.sourceActionId || undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Updates an existing memory with its real-world outcome
   */
  static async recordMemoryOutcome(
    organizationId: string,
    memoryId: string,
    outcome: string,
    userId?: string
  ): Promise<ExecutiveMemoryEntryData> {
    assertDatabaseWritesAllowed('update executive memory outcome');

    const updated = await prisma.executiveMemoryEntry.update({
      where: { id: memoryId, organizationId },
      data: { outcome },
    });

    if (userId) {
      await logAudit({
        organizationId,
        userId,
        action: 'EXECUTIVE_MEMORY_UPDATED' as any,
        resource: `executiveMemory:${memoryId}`,
        status: 'SUCCESS',
        details: { outcome },
      });
    }

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      category: updated.category as ExecutiveMemoryCategory,
      title: updated.title,
      summary: updated.summary,
      facts: JSON.parse(updated.facts),
      observations: JSON.parse(updated.observations),
      outcome: updated.outcome || undefined,
      sourceActionId: updated.sourceActionId || undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
