import { prisma } from '../db';
import { assertDatabaseWritesAllowed } from '../db-guard';

export interface RecordAiUsageParams {
  organizationId: string;
  userId: string;
  provider: string;
  model: string;
  requestType: string;
  inputTokens: number;
  outputTokens?: number;
}

export async function recordAiUsage(params: RecordAiUsageParams) {
  try {
    assertDatabaseWritesAllowed('record AI usage');

    await prisma.aIUsageRecord.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        requestType: params.requestType,
        inputTokens: params.inputTokens,
      },
    });
  } catch (error) {
    // Fail safe on usage logging without breaking core flow
    console.warn('[AIUsageTracker] Failed to record usage (write guard may be active):', error);
  }
}
