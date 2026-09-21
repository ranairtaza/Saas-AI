import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { GoalTracker } from '@/ai/executive/goal-tracker';
import { z } from 'zod';
import { hasPermission } from '@/permissions/rbac';
import { PERMISSIONS } from '@/permissions/definitions';

const CreateGoalRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  kpiKey: z.string().min(1, 'kpiKey is required'),
  targetValue: z.number().positive('targetValue must be positive'),
  currentValue: z.number().default(0),
  unit: z.enum(['CURRENCY', 'COUNT', 'PERCENTAGE', 'RATIO']).or(z.string()),
  startDate: z.string().datetime().or(z.string()).optional(),
  endDate: z.string().datetime().or(z.string()),
});

/**
 * GET /api/executive/goals
 * List all active business goals for the organization.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const goals = await GoalTracker.getActiveGoals(user.organizationId);

    return NextResponse.json({
      success: true,
      goals,
    });
  } catch (error: any) {
    console.error('[API /api/executive/goals GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch business goals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/executive/goals
 * Create a new business goal for the organization.
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
    const parsed = CreateGoalRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const goal = await GoalTracker.createGoal(user.organizationId, {
      title: parsed.data.title,
      kpiKey: parsed.data.kpiKey,
      targetValue: parsed.data.targetValue,
      currentValue: parsed.data.currentValue,
      unit: parsed.data.unit,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: new Date(parsed.data.endDate),
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      goal,
    });
  } catch (error: any) {
    console.error('[API /api/executive/goals POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create business goal' },
      { status: 500 }
    );
  }
}
