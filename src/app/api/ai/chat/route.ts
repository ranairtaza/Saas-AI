import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { GeminiProvider } from '@/ai/providers/gemini';
import { ToolRegistry } from '@/ai/tools/registry';
import { getLeadsSummaryTool } from '@/ai/tools/business';
import { AIOrchestrator } from '@/ai/orchestrator';

// Initialize Redis and Rate limiting defensively for next build
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const redis = (redisUrl && redisToken && redisUrl.startsWith('https://') && !redisUrl.includes('...'))
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
  analytics: true,
}) : null;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate Limiting Check
    if (ratelimit) {
      const { success, limit, reset, remaining } = await ratelimit.limit(`ai_chat_${user.id}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Try again later.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        );
      }
    }
    const body = await req.json();
    const { messages, conversationId } = body; 

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Persist or retrieve conversation
    let currentConversation;
    if (conversationId) {
      currentConversation = await prisma.conversation.findFirst({
        where: { id: conversationId, organizationId: user.organizationId }
      });
      if (!currentConversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    } else {
      currentConversation = await prisma.conversation.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          title: 'New Conversation',
        }
      });
    }

    // Save incoming user message
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      await prisma.message.create({
        data: {
          conversationId: currentConversation.id,
          role: 'USER',
          content: lastUserMsg.content,
        }
      });
    }

    // Initialize AI Core
    const provider = new GeminiProvider();
    const registry = new ToolRegistry();
    
    // Register allowed tools
    registry.register(getLeadsSummaryTool);
    const { getBusinessSummaryTool } = await import('@/ai/tools/business/get_business_summary');
    const { getDiscoverySummaryTool } = await import('@/ai/tools/business/get_discovery_summary');
    const { getCreditBalanceTool } = await import('@/ai/tools/business/get_credit_balance');
    const { getBillingStatusTool } = await import('@/ai/tools/business/get_billing_status');
    const { updateLeadStatusTool } = await import('@/ai/tools/actions/update_lead_status');
    const { addLeadNoteTool } = await import('@/ai/tools/actions/add_lead_note');
    const { assignLeadTool } = await import('@/ai/tools/actions/assign_lead');
    const { deleteLeadTool } = await import('@/ai/tools/actions/delete_lead');

    registry.register(getBusinessSummaryTool);
    registry.register(getDiscoverySummaryTool);
    registry.register(getCreditBalanceTool);
    registry.register(getBillingStatusTool);
    registry.register(updateLeadStatusTool);
    registry.register(addLeadNoteTool);
    registry.register(assignLeadTool);
    registry.register(deleteLeadTool);

    const orchestrator = new AIOrchestrator(provider, registry);

    const aiContext = {
      organizationId: user.organizationId,
      userId: user.id,
      role: user.role,
    };

    const finalMessage = await orchestrator.processChat(aiContext, messages, currentConversation.id);

    // Save assistant message
    if (finalMessage) {
      await prisma.message.create({
        data: {
          conversationId: currentConversation.id,
          role: 'ASSISTANT',
          content: finalMessage.content || '',
        }
      });
    }

    // Usage log
    await prisma.aIUsageRecord.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        provider: 'Gemini',
        model: 'gemini-1.5-flash',
        requestType: 'chat',
        inputTokens: 0, 
      }
    });

    return NextResponse.json({
      message: finalMessage,
      conversationId: currentConversation.id
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
