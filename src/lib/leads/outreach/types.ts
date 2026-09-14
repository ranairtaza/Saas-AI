import { z } from 'zod';

export type DraftStatus =
  | 'GENERATING'
  | 'DRAFT'
  | 'EDITED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'STALE'
  | 'EXPIRED';

export type GenerationMode = 'LIVE_AI' | 'MOCK';

export type OutreachTone = 'DIRECT_EXECUTIVE' | 'CONSULTATIVE_VALUE' | 'BRIEF_TECHNICAL';

// --- Tripartite Intelligence Schema ---
export const OutreachIntelligenceSchema = z.object({
  leadId: z.string().optional(),
  verifiedEvidence: z.array(z.string()).describe('Facts directly sourced and verified from input data (e.g. employee count, tech stack, verified title).'),
  observations: z.array(z.string()).describe('Objective deductions from the verified facts (e.g. distributed engineering structure).'),
  opportunityHypotheses: z.array(z.string()).describe('Hypothetical business needs or friction points framed as possibilities, never absolute facts.'),
  valueProposition: z.string().describe('Clear, customized value narrative for the contact and company scale.'),
  recommendedAngle: z.string().describe('Strategic positioning angle (e.g. "Developer Productivity & Tool Consolidation").'),
  recommendedCTA: z.string().describe('Low-friction, conversational call to action.'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Confidence in context grounding and fit.'),
  confidenceRationale: z.string().describe('Explanation of the confidence level based on available data completeness.'),
  generatedAt: z.string().optional(),
});

export type OutreachIntelligence = z.infer<typeof OutreachIntelligenceSchema>;

// --- AI Output Schema (Combined Intelligence + Copywriting) ---
export const OutreachAIOutputSchema = z.object({
  intelligence: OutreachIntelligenceSchema,
  draft: z.object({
    subject: z.string().max(100).describe('Compelling, professional subject line under 100 characters.'),
    openingHook: z.string().describe('Personalized opening referencing verified context without generic fluff.'),
    valueNarrative: z.string().describe('Concise value explanation framing the opportunity hypothesis gently.'),
    callToAction: z.string().describe('Specific, conversational, low-friction closing call to action.'),
    fullBody: z.string().describe('Complete email text formatted and ready for human review.'),
    tone: z.enum(['DIRECT_EXECUTIVE', 'CONSULTATIVE_VALUE', 'BRIEF_TECHNICAL']),
  }),
});

export type OutreachAIOutput = z.infer<typeof OutreachAIOutputSchema>;

// --- Complete Outreach Draft Payload ---
export interface OutreachDraftPayload {
  id: string;
  organizationId: string;
  leadId: string;
  subject: string;
  body: string;
  tone: OutreachTone;
  intelligence: OutreachIntelligence;
  generationMode: GenerationMode;
  contextHash: string;
  isStale: boolean;
  version: number;
  status: DraftStatus;
  createdBy: string;
  approvedBy: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  pendingActionId?: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

// --- Request Validation Schemas ---
export const GenerateDraftRequestSchema = z.object({
  tone: z.enum(['DIRECT_EXECUTIVE', 'CONSULTATIVE_VALUE', 'BRIEF_TECHNICAL']).default('CONSULTATIVE_VALUE'),
  customAngle: z.string().max(200).optional(),
  forceRegenerate: z.boolean().optional().default(false),
});

export type GenerateDraftRequest = z.infer<typeof GenerateDraftRequestSchema>;

export const UpdateDraftRequestSchema = z.object({
  subject: z.string().min(1, 'Subject line cannot be empty').max(200),
  body: z.string().min(1, 'Body cannot be empty').max(5000),
});

export type UpdateDraftRequest = z.infer<typeof UpdateDraftRequestSchema>;

export const RejectDraftRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type RejectDraftRequest = z.infer<typeof RejectDraftRequestSchema>;
