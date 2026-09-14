import * as crypto from 'crypto';
import { DeterministicScoringEngine, QualificationCategory } from '../scoring/engine';
import { 
  WorkflowRecommendation, 
  WorkflowRoutingContext, 
  AssignLeadParams, 
  AddLeadNoteParams, 
  UpdateLeadStatusParams 
} from './types';

/**
 * Deterministically generates a consistent hash fingerprint for a recommendation.
 * Concept: hash(leadId + currentLeadStatus + currentOwnerId + actionName + targetValue)
 */
export function generateRecommendationFingerprint(
  leadId: string,
  currentStatus: string,
  currentOwnerId: string | null | undefined,
  actionName: string,
  targetValue: string
): string {
  const payload = `${leadId}:${currentStatus}:${currentOwnerId || 'none'}:${actionName}:${targetValue}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 16);
}

export class WorkflowRoutingEngine {
  /**
   * Generates deterministic workflow recommendations based on lead state,
   * score calculation, scoring factors, and organization context.
   */
  static generateRecommendations(context: WorkflowRoutingContext): WorkflowRecommendation[] {
    const { lead, scoreResult, aiQualification, organizationUsers } = context;
    const recommendations: WorkflowRecommendation[] = [];

    // 1. Determine effective score and category
    let score = typeof lead.score === 'number' ? lead.score : (scoreResult?.score ?? null);
    let category: QualificationCategory | null = scoreResult?.category ?? (score !== null ? DeterministicScoringEngine.categorize(score) : null);

    if (score === null || !category) {
      // Unscored lead: recommend qualification first
      const fp = generateRecommendationFingerprint(lead.id, lead.status, lead.ownerId, 'add_lead_note', 'unscored_review');
      recommendations.push({
        id: fp,
        leadId: lead.id,
        actionName: 'add_lead_note',
        title: 'Review Unscored Lead',
        description: 'Lead has not yet been enriched or scored. Run enrichment to determine qualification tier.',
        riskLevel: 'LOW',
        parameters: {
          leadId: lead.id,
          noteContent: `Lead "${lead.companyName}" requires enrichment and qualification scoring before workflow routing.`
        } as AddLeadNoteParams,
        rationale: 'Unscored lead requires baseline qualification evaluation.',
        source: 'DETERMINISTIC_RULE'
      });
      return recommendations;
    }

    // 2. Resolve eligible assignee from organization members if available
    const eligibleUsers = organizationUsers?.filter(u => u.id) || [];
    // Priority assignment candidate: Prefer ADMIN or MANAGER or first available member
    const priorityAssignee = eligibleUsers.find(u => u.role === 'ADMIN' || u.role === 'MANAGER' || u.role === 'OWNER') || eligibleUsers[0];
    // Standard assignment candidate: Prefer MEMBER or first available member
    const standardAssignee = eligibleUsers.find(u => u.role === 'MEMBER') || eligibleUsers[0];

    // ----------------------------------------------------
    // RULE TIER 1: HIGH (Score 75–100)
    // ----------------------------------------------------
    if (category === 'HIGH') {
      // 1A. Priority Assignment (if currently unassigned)
      if (!lead.ownerId && priorityAssignee) {
        const fp = generateRecommendationFingerprint(lead.id, lead.status, lead.ownerId, 'assign_lead', priorityAssignee.id);
        recommendations.push({
          id: fp,
          leadId: lead.id,
          actionName: 'assign_lead',
          title: `Assign Priority Lead to ${priorityAssignee.name || priorityAssignee.email}`,
          description: `High-value lead (${score}/100) requires immediate ownership for account executive review.`,
          riskLevel: 'MEDIUM',
          suggestedAssigneeName: priorityAssignee.name || priorityAssignee.email,
          parameters: {
            leadId: lead.id,
            userId: priorityAssignee.id,
            oldOwnerId: lead.ownerId || null
          } as AssignLeadParams,
          rationale: `Lead scored ${score}/100 in HIGH category with verified qualification factors.`,
          source: 'DETERMINISTIC_RULE'
        });
      }

      // 1B. Strategic Follow-up Note
      const fpNote = generateRecommendationFingerprint(lead.id, lead.status, lead.ownerId, 'add_lead_note', 'high_strategy');
      const topFactors = scoreResult?.factors?.filter(f => f.points > 0).map(f => f.name).join(', ') || 'verified fit';
      recommendations.push({
        id: fpNote,
        leadId: lead.id,
        actionName: 'add_lead_note',
        title: 'Stage High-Priority Outreach Strategy',
        description: 'Document key qualification factors and recommended talking points.',
        riskLevel: 'LOW',
        parameters: {
          leadId: lead.id,
          noteContent: `[High-Priority Qualification] Score: ${score}/100. Strong factors: ${topFactors}. ${aiQualification?.summary ? 'AI Context: ' + aiQualification.summary : 'Recommended for direct executive engagement.'}`
        } as AddLeadNoteParams,
        rationale: `Captures key strengths (${topFactors}) into CRM activity feed.`,
        source: 'DETERMINISTIC_RULE'
      });
      // NOTE: We explicitly DO NOT automatically recommend DISCOVERED -> QUALIFIED solely from score.
    }

    // ----------------------------------------------------
    // RULE TIER 2: MEDIUM (Score 50–74)
    // ----------------------------------------------------
    else if (category === 'MEDIUM') {
      // 2A. Standard Assignment (if currently unassigned)
      if (!lead.ownerId && standardAssignee) {
        const fp = generateRecommendationFingerprint(lead.id, lead.status, lead.ownerId, 'assign_lead', standardAssignee.id);
        recommendations.push({
          id: fp,
          leadId: lead.id,
          actionName: 'assign_lead',
          title: `Assign Lead to ${standardAssignee.name || standardAssignee.email}`,
          description: `Medium-tier lead (${score}/100) ready for standard discovery outreach.`,
          riskLevel: 'MEDIUM',
          suggestedAssigneeName: standardAssignee.name || standardAssignee.email,
          parameters: {
            leadId: lead.id,
            userId: standardAssignee.id,
            oldOwnerId: lead.ownerId || null
          } as AssignLeadParams,
          rationale: `Lead scored ${score}/100 in MEDIUM category. Standard sales routing.`,
          source: 'DETERMINISTIC_RULE'
        });
      }

      // 2B. Standard Follow-up Note
      const fpNote = generateRecommendationFingerprint(lead.id, lead.status, lead.ownerId, 'add_lead_note', 'med_followup');
      recommendations.push({
        id: fpNote,
        leadId: lead.id,
        actionName: 'add_lead_note',
        title: 'Stage Discovery Outreach Note',
        description: 'Document standard qualification profile before outreach.',
        riskLevel: 'LOW',
        parameters: {
          leadId: lead.id,
          noteContent: `[Medium Qualification] Score: ${score}/100. Lead meets basic criteria. Recommended initial contact via standard sales cadence.`
        } as AddLeadNoteParams,
        rationale: 'Standard cadence record for sales team visibility.',
        source: 'DETERMINISTIC_RULE'
      });
      // NOTE: We explicitly DO NOT automatically recommend DISCOVERED -> CONTACTED solely from score.
    }

    // ----------------------------------------------------
    // RULE TIER 3: LOW (Score 25–49)
    // ----------------------------------------------------
    else if (category === 'LOW') {
      // 3A. Missing Information & Nurture Note
      const fpNote = generateRecommendationFingerprint(lead.id, lead.status, lead.ownerId, 'add_lead_note', 'low_nurture');
      const missing = aiQualification?.missingInformation?.join(', ') || 'contact/firmographic details';
      recommendations.push({
        id: fpNote,
        leadId: lead.id,
        actionName: 'add_lead_note',
        title: 'Flag for Data Enrichment / Nurture',
        description: `Score is ${score}/100. Key data points missing before direct sales contact.`,
        riskLevel: 'LOW',
        parameters: {
          leadId: lead.id,
          noteContent: `[Low Qualification] Score: ${score}/100. Missing information: ${missing}. Keep in nurture pipeline until additional data is gathered.`
        } as AddLeadNoteParams,
        rationale: 'Prevents premature sales outreach on incomplete lead profiles.',
        source: 'DETERMINISTIC_RULE'
      });
      // NOTE: Keep pipeline status as DISCOVERED by default.
    }

    // ----------------------------------------------------
    // RULE TIER 4: UNQUALIFIED (Score 0–24)
    // ----------------------------------------------------
    else if (category === 'UNQUALIFIED') {
      // 4A. Low Score Review Note
      const fpNote = generateRecommendationFingerprint(lead.id, lead.status, lead.ownerId, 'add_lead_note', 'unqualified_review');
      recommendations.push({
        id: fpNote,
        leadId: lead.id,
        actionName: 'add_lead_note',
        title: 'Log Low-Fit Qualification Review',
        description: `Lead scored ${score}/100 (Unqualified). Review profile before considering archive.`,
        riskLevel: 'LOW',
        parameters: {
          leadId: lead.id,
          noteContent: `[Unqualified Review] Score: ${score}/100. Lead did not meet target industry, firmographic, or contact completeness thresholds.`
        } as AddLeadNoteParams,
        rationale: 'Documents objective qualification deficit without automatically closing lead.',
        source: 'DETERMINISTIC_RULE'
      });
      // NOTE: We explicitly DO NOT automatically recommend UNQUALIFIED -> LOST.
    }

    return recommendations;
  }
}
