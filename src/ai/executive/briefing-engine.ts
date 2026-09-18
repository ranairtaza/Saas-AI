import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { prisma } from '../../lib/db';
import { assertDatabaseWritesAllowed, isDatabaseWritesAllowed } from '../../lib/db-guard';
import { logAudit } from '../../audit/logger';
import { recordAiUsage } from '../../lib/ai/usage-tracker';
import { BusinessContext } from './types';
import { ExecutiveEventData, ExecutiveBriefing, ExecutiveBriefingSchema } from './events/types';
import { BusinessHealthEvaluator } from './health-evaluator';
import { ExecutiveObservationEngine } from './observation-engine';
import { ExecutiveEventService } from './events/event-service';
import { ExecutiveService } from './service';

export class ExecutiveBriefingEngine {
  /**
   * Generates or retrieves the latest comprehensive Executive Briefing
   */
  static async generateBriefing(
    organizationId: string,
    userId?: string
  ): Promise<ExecutiveBriefing> {
    // 1. Gather Context, Events, and Active Recommendations
    const context = await ExecutiveService.getBusinessContext(organizationId);
    const activeEvents = await ExecutiveEventService.getActiveEvents(organizationId);
    const activeRecs = await ExecutiveService.getActiveRecommendations(organizationId);

    // 2. Evaluate Deterministic Health & Epistemic Observations
    const criticalCount = activeEvents.filter((e) => e.severity === 'CRITICAL').length;
    const health = BusinessHealthEvaluator.evaluateHealth(context, {
      activeEventCount: activeEvents.length,
      criticalEventCount: criticalCount,
    });
    const observations = ExecutiveObservationEngine.synthesizeObservations(context, activeEvents);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    let briefing: ExecutiveBriefing;

    if (apiKey && apiKey !== 'mock_key' && process.env.NODE_ENV !== 'test') {
      try {
        briefing = await this.generateWithLiveAI({
          context,
          events: activeEvents,
          recommendations: activeRecs,
          health,
          observations,
          userId,
        });
      } catch (err) {
        console.warn('[ExecutiveBriefingEngine] Live AI generation failed, falling back to grounded heuristics:', err);
        briefing = this.generateGroundedFallback({
          context,
          events: activeEvents,
          recommendations: activeRecs,
          health,
          observations,
        });
      }
    } else {
      briefing = this.generateGroundedFallback({
        context,
        events: activeEvents,
        recommendations: activeRecs,
        health,
        observations,
      });
    }

    // 3. Persist Briefing Record if DB writes allowed
    if (isDatabaseWritesAllowed()) {
      try {
        assertDatabaseWritesAllowed('save_executive_briefing');
        const record = await prisma.executiveBriefingRecord.create({
          data: {
            organizationId,
            healthScore: briefing.health.overallScore,
            healthSummary: JSON.stringify(briefing.health.domains),
            executiveSummary: briefing.executiveSummary,
            topPriorities: JSON.stringify(briefing.topPriorities),
            keyChanges: JSON.stringify(briefing.keyChanges),
            risks: JSON.stringify(briefing.risks),
            opportunities: JSON.stringify(briefing.opportunities),
            recommendedActions: JSON.stringify(briefing.recommendedActions),
            supportingFacts: JSON.stringify(briefing.supportingFacts),
            observations: JSON.stringify(briefing.observations || []),
            hypotheses: JSON.stringify(briefing.hypotheses || []),
            generatedBy: briefing.generatedBy,
          },
        });

        briefing.id = record.id;

        if (userId) {
          await logAudit({
            organizationId,
            userId,
            action: 'EXECUTIVE_BRIEFING_GENERATED' as any,
            resource: 'executive_briefings',
            resourceId: record.id,
            input: { healthScore: briefing.health.overallScore, eventCount: activeEvents.length },
            output: { briefingId: record.id, generatedBy: briefing.generatedBy },
            riskLevel: 'READ',
            status: 'SUCCESS',
          });
        }
      } catch (err) {
        console.warn('[ExecutiveBriefingEngine] Could not persist briefing to DB (fail-safe):', err);
      }
    }

    return briefing;
  }

  /**
   * Retrieves the latest cached Executive Briefing or generates a fresh one
   */
  static async getLatestBriefing(
    organizationId: string,
    userId?: string
  ): Promise<ExecutiveBriefing> {
    if (isDatabaseWritesAllowed()) {
      const latest = await prisma.executiveBriefingRecord.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      if (latest) {
        const context = await ExecutiveService.getBusinessContext(organizationId);
        const health = BusinessHealthEvaluator.evaluateHealth(context);

        return ExecutiveBriefingSchema.parse({
          id: latest.id,
          organizationId: latest.organizationId,
          generatedAt: latest.createdAt,
          health,
          executiveSummary: latest.executiveSummary,
          topPriorities: JSON.parse(latest.topPriorities),
          keyChanges: JSON.parse(latest.keyChanges),
          risks: JSON.parse(latest.risks),
          opportunities: JSON.parse(latest.opportunities),
          recommendedActions: JSON.parse(latest.recommendedActions),
          supportingFacts: JSON.parse(latest.supportingFacts),
          observations: latest.observations ? JSON.parse(latest.observations) : [],
          hypotheses: latest.hypotheses ? JSON.parse(latest.hypotheses) : [],
          generatedBy: latest.generatedBy as any,
        });
      }
    }

    return this.generateBriefing(organizationId, userId);
  }

  /**
   * Generates a grounded Executive Briefing using Live Gemini LLM via Vercel AI SDK
   */
  private static async generateWithLiveAI(params: {
    context: BusinessContext;
    events: ExecutiveEventData[];
    recommendations: any[];
    health: any;
    observations: any;
    userId?: string;
  }): Promise<ExecutiveBriefing> {
    const verifiedFactsBlock = `
<VERIFIED_BUSINESS_FACTS>
Organization: ${params.context.identity.name} (${params.context.identity.industry})
Business Health Score: ${params.health.overallScore}/100 (${params.health.status})
Domain Breakdown: ${JSON.stringify(params.health.domains)}
Revenue MTD: $${params.context.telemetry.metrics.revenueMTD?.value?.toLocaleString() ?? 'UNKNOWN'}
Pipeline Value: $${params.context.telemetry.metrics.pipelineValue?.value?.toLocaleString() ?? 'UNKNOWN'}
Active Leads: ${params.context.telemetry.metrics.activeLeadsCount?.value ?? 'UNKNOWN'}
Qualified Leads (>= 75): ${params.context.telemetry.metrics.qualifiedLeads?.value ?? 'UNKNOWN'}
Unassigned High-Priority Leads: ${params.context.telemetry.metrics.unassignedHighPriorityLeads?.value ?? 'UNKNOWN'}
Active Goals: ${JSON.stringify(params.context.goals.map((g) => ({ title: g.title, status: g.status, progressPct: g.progressPct, gap: g.gapValue })))}
Active Events: ${JSON.stringify(params.events.map((e) => ({ title: e.title, severity: e.severity, summary: e.summary })))}
Active Recommendations: ${JSON.stringify(params.recommendations.map((r) => ({ title: r.title, priorityLevel: r.priorityLevel, impact: r.expectedImpact })))}
Epistemic Observations: ${JSON.stringify(params.observations.observations)}
Epistemic Hypotheses: ${JSON.stringify(params.observations.hypotheses)}
</VERIFIED_BUSINESS_FACTS>
`;

    const untrustedDataBlock = `
<UNTRUSTED_BUSINESS_DATA>
${params.context.untrustedExternalData.join('\n') || 'None'}
</UNTRUSTED_BUSINESS_DATA>
`;

    const prompt = `
You are the AI Business Executive. Create a concise, high-impact Executive Briefing for executive leadership.

CRITICAL INSTRUCTIONS:
1. Ground all claims STRICTLY in <VERIFIED_BUSINESS_FACTS>.
2. Do NOT invent metrics, customers, events, causes, or outcomes.
3. Address: "What happened → Why it matters → What may be causing it → What should happen next".
4. Output valid JSON matching the following schema:
{
  "executiveSummary": "Concise 2-3 sentence strategic executive brief",
  "topPriorities": [
    {
      "priorityLevel": "CRITICAL",
      "title": "Priority Title",
      "summary": "Brief explanation of the critical issue",
      "impact": "$32,000 potential pipeline exposure",
      "actionAvailable": true
    }
  ],
  "keyChanges": [
    "Pipeline velocity changed",
    "4 enterprise leads entered unassigned state"
  ],
  "risks": [
    "Revenue milestone pacing shortfall"
  ],
  "opportunities": [
    "High fit score enterprise accounts ready for territory allocation"
  ],
  "recommendedActions": [
    {
      "actionName": "assign_lead",
      "description": "Assign 4 high-value leads to senior account executives",
      "riskLevel": "MEDIUM",
      "requiresApproval": true
    }
  ]
}
`;

    const result = await generateText({
      model: google('gemini-1.5-flash-latest'),
      prompt: `${prompt}\n\n${verifiedFactsBlock}\n\n${untrustedDataBlock}`,
    });

    if (params.userId) {
      await recordAiUsage({
        organizationId: params.context.organizationId,
        userId: params.userId,
        provider: 'Gemini',
        model: 'gemini-1.5-flash',
        requestType: 'executive_briefing',
        inputTokens: (result.usage as any)?.promptTokens || (result.usage as any)?.inputTokens || 0,
        outputTokens: (result.usage as any)?.completionTokens || (result.usage as any)?.outputTokens || 0,
      });
    }

    const cleanedJson = result.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    return ExecutiveBriefingSchema.parse({
      organizationId: params.context.organizationId,
      generatedAt: new Date(),
      health: params.health,
      executiveSummary: parsed.executiveSummary,
      topPriorities: parsed.topPriorities || [],
      keyChanges: parsed.keyChanges || [],
      risks: parsed.risks || [],
      opportunities: parsed.opportunities || [],
      recommendedActions: parsed.recommendedActions || [],
      supportingFacts: params.observations.verifiedFacts,
      observations: params.observations.observations,
      hypotheses: params.observations.hypotheses,
      generatedBy: 'AI',
    });
  }

  /**
   * Deterministic grounded fallback briefing generator
   */
  static generateGroundedFallback(params: {
    context: BusinessContext;
    events: ExecutiveEventData[];
    recommendations: any[];
    health: any;
    observations: any;
    // Phase 33: optional cross-phase data for enriched briefings
    decisions?: any[];
    learningSignals?: any[];
    forecasts?: any[];
    actionPlans?: any[];
    previousBriefing?: any;
  }): ExecutiveBriefing {
    const unassigned = params.context.telemetry.metrics.unassignedHighPriorityLeads?.value;
    const atRiskGoal = params.context.goals.find((g) => g.status === 'AT_RISK' || g.status === 'BEHIND');

    const topPriorities: any[] = [];
    const keyChanges: string[] = [];
    const risks: string[] = [];
    const opportunities: string[] = [];
    const recommendedActions: any[] = [];

    // Derive key changes from active events
    for (const event of params.events) {
      keyChanges.push(`${event.title} (${event.severity})`);
    }

    // Phase 33: Incorporate forecast deviations into key changes
    if (params.forecasts && params.forecasts.length > 0) {
      for (const f of params.forecasts) {
        if (f.direction === 'DECREASING') {
          const delta = f.currentValue - f.forecastValue;
          keyChanges.push(`${f.metric} forecast: declining by ${delta.toLocaleString()} (${f.confidence} confidence)`);
          risks.push(`${f.metric} is projected to decline to ${f.forecastValue} over ${f.forecastHorizon}.`);
        } else if (f.direction === 'INCREASING') {
          opportunities.push(`${f.metric} is trending upward — projected to reach ${f.forecastValue} (${f.confidence} confidence).`);
        }
      }
    }

    // Phase 33: Incorporate pending/blocked decisions
    if (params.decisions && params.decisions.length > 0) {
      const pendingDecisions = params.decisions.filter((d: any) => d.status === 'PENDING');
      const blockedDecisions = params.decisions.filter((d: any) => d.governanceVerdict === 'BLOCKED');
      if (pendingDecisions.length > 0) {
        keyChanges.push(`${pendingDecisions.length} executive decision(s) pending review.`);
      }
      if (blockedDecisions.length > 0) {
        risks.push(`${blockedDecisions.length} decision(s) blocked by governance policy.`);
        for (const bd of blockedDecisions.slice(0, 2)) {
          topPriorities.push({
            priorityLevel: 'HIGH',
            title: `Governance-blocked: ${bd.title}`,
            summary: `Decision "${bd.title}" (${bd.domain}) requires governance review or escalation.`,
            impact: 'Cannot proceed until governance constraint is resolved.',
            actionAvailable: true,
          });
        }
      }
    }

    // Phase 33: Incorporate action plans requiring attention
    if (params.actionPlans && params.actionPlans.length > 0) {
      const pendingApproval = params.actionPlans.filter(
        (a: any) => a.status === 'PROPOSED' || a.status === 'PENDING_APPROVAL'
      );
      if (pendingApproval.length > 0) {
        keyChanges.push(`${pendingApproval.length} action plan(s) awaiting executive approval.`);
        for (const ap of pendingApproval.slice(0, 2)) {
          recommendedActions.push({
            actionName: ap.actionType || 'review_action_plan',
            description: `Review and approve/reject: "${ap.title}" (${ap.confidence} confidence).`,
            riskLevel: ap.riskLevel || 'MEDIUM',
            requiresApproval: true,
          });
        }
      }
    }

    // Phase 33: Incorporate learning signals with material variance
    if (params.learningSignals && params.learningSignals.length > 0) {
      const negativeSignals = params.learningSignals.filter(
        (s: any) => s.varianceStatus === 'NEGATIVE_VARIANCE' || s.varianceStatus === 'SIGNIFICANT_NEGATIVE'
      );
      if (negativeSignals.length > 0) {
        risks.push(`${negativeSignals.length} metric(s) showing negative performance variance: ${negativeSignals.map((s: any) => s.metric).join(', ')}.`);
      }
    }

    if (keyChanges.length === 0) {
      keyChanges.push('All core telemetry metrics operating within nominal baseline.');
    }

    // Top Priorities & Recommended Actions (existing logic preserved)
    if (unassigned !== null && unassigned > 0) {
      const avgDeal = (params.context.telemetry.metrics as any).averageDealSize?.value;
      const exposure = avgDeal ? unassigned * avgDeal : null;
      topPriorities.push({
        priorityLevel: unassigned >= 3 ? 'CRITICAL' : 'HIGH',
        title: `${unassigned} High-Value Lead${unassigned > 1 ? 's' : ''} Remain Unassigned`,
        summary: `Qualified enterprise accounts (score >= 75) are unallocated, creating potential velocity loss.`,
        impact: exposure
          ? `$${exposure.toLocaleString()} estimated pipeline exposure (assumed avg deal $${avgDeal?.toLocaleString()})`
          : `${unassigned} high-priority leads exposed to velocity decay`,
        actionAvailable: true,
      });

      risks.push(
        exposure
          ? `Unassigned lead conversion degradation risk on $${exposure.toLocaleString()} pipeline.`
          : `Unassigned lead conversion degradation risk across ${unassigned} qualified leads.`
      );
      recommendedActions.push({
        actionName: 'assign_lead',
        description: `Assign ${unassigned} unassigned high-priority lead${unassigned > 1 ? 's' : ''} to account executives.`,
        riskLevel: 'MEDIUM',
        requiresApproval: true,
      });
    }

    if (atRiskGoal) {
      topPriorities.push({
        priorityLevel: atRiskGoal.status === 'BEHIND' ? 'CRITICAL' : 'HIGH',
        title: `Strategic Milestone "${atRiskGoal.title}" is ${atRiskGoal.status}`,
        summary: `Progress is currently ${atRiskGoal.progressPct}% against ${atRiskGoal.timeElapsedPct}% elapsed timeframe.`,
        impact: `Gap of $${atRiskGoal.gapValue?.toLocaleString() || 0} before deadline`,
        actionAvailable: true,
      });

      risks.push(`Milestone shortfall risk on goal "${atRiskGoal.title}".`);
      recommendedActions.push({
        actionName: 'add_lead_note',
        description: `Stage recovery outreach campaign for "${atRiskGoal.title}".`,
        riskLevel: 'LOW',
        requiresApproval: true,
      });
    }

    if (topPriorities.length === 0) {
      topPriorities.push({
        priorityLevel: 'LOW',
        title: 'Maintain Pipeline Discovery & Account Velocity',
        summary: 'All telemetry indicators and business targets are on track.',
        impact: 'Sustain quarterly target pacing',
        actionAvailable: false,
      });
      opportunities.push('Initiate expansion discovery across adjacent market sectors.');
    } else if (opportunities.length === 0) {
      opportunities.push('Allocating unassigned leads can rapidly accelerate pipeline conversion.');
    }

    let executiveSummary = '';
    if (params.health.status === 'HEALTHY') {
      executiveSummary = `Business health is strong at ${params.health.overallScore}/100. All revenue and lead pipelines are pacing on target with nominal operational friction.`;
    } else if (params.health.status === 'STABLE') {
      executiveSummary = `Business health is stable (${params.health.overallScore}/100). Key operational indicators are steady with proactive optimization opportunities available.`;
    } else if (params.health.status === 'ATTENTION_NEEDED') {
      executiveSummary = `Revenue and milestone pacing require executive attention (${params.health.overallScore}/100). ${unassigned !== null && unassigned > 0 ? `${unassigned} enterprise leads require assignment.` : ''} Active recovery actions are staged for review.`;
    } else {
      executiveSummary = `Critical business risks detected (${params.health.overallScore}/100). Revenue is lagging target while ${unassigned !== null ? unassigned : 'UNKNOWN'} high-value leads remain unassigned. Immediate human review of staged actions is recommended.`;
    }

    // Phase 33: Append comparison note if previous briefing is unavailable
    if (!params.previousBriefing) {
      executiveSummary += ' Historical comparison data is insufficient for period-over-period analysis.';
    }

    return ExecutiveBriefingSchema.parse({
      organizationId: params.context.organizationId,
      generatedAt: new Date(),
      health: params.health,
      executiveSummary,
      topPriorities,
      keyChanges,
      risks,
      opportunities,
      recommendedActions,
      supportingFacts: params.observations.verifiedFacts,
      observations: params.observations.observations,
      hypotheses: params.observations.hypotheses,
      generatedBy: 'DETERMINISTIC_FALLBACK',
    });
  }
}
