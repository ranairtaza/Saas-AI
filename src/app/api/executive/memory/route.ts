import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ExecutiveMemoryService } from '@/ai/executive/memory-service';
import { ExecutiveMemoryCategorySchema } from '@/ai/executive/types';
import { z } from 'zod';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';

const CreateMemoryRequestSchema = z.object({
  category: ExecutiveMemoryCategorySchema,
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  facts: z.array(z.string()).optional(),
  observations: z.array(z.string()).optional(),
  outcome: z.string().optional(),
  sourceActionId: z.string().optional(),
});

/**
 * GET /api/executive/memory
 * Retrieves bounded recent executive memories, optionally filtered by category.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const limitParam = searchParams.get('limit');

    const category = categoryParam
      ? (ExecutiveMemoryCategorySchema.safeParse(categoryParam).success
          ? (categoryParam as any)
          : undefined)
      : undefined;

    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    const memories = await ExecutiveMemoryService.getMemories(user.organizationId, {
      category,
      limit,
    });

    return NextResponse.json({
      success: true,
      memories,
    });
  } catch (error: any) {
    console.error('[API /api/executive/memory GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch executive memories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/executive/memory
 * Records a new executive memory entry.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(user.role, PERMISSIONS.ORG_SETTINGS)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const json = await request.json();
    const parsed = CreateMemoryRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const memory = await ExecutiveMemoryService.createMemory(user.organizationId, {
      category: parsed.data.category,
      title: parsed.data.title,
      summary: parsed.data.summary,
      facts: parsed.data.facts,
      observations: parsed.data.observations,
      outcome: parsed.data.outcome,
      sourceActionId: parsed.data.sourceActionId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      memory,
    });
  } catch (error: any) {
    console.error('[API /api/executive/memory POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create executive memory' },
      { status: 500 }
    );
  }
}
