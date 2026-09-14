import { QualificationCategory } from '../scoring/engine';

export type WorkflowActionName = 'assign_lead' | 'update_lead_status' | 'add_lead_note';

export type WorkflowRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type WorkflowRecommendationSource = 'DETERMINISTIC_RULE' | 'AI_SUGGESTION';

export interface AssignLeadParams {
  leadId: string;
  userId: string;
  oldOwnerId?: string | null;
}

export interface UpdateLeadStatusParams {
  leadId: string;
  newStatus: string;
  oldStatus?: string;
}

export interface AddLeadNoteParams {
  leadId: string;
  noteContent: string;
}

export type TypedActionParameters = AssignLeadParams | UpdateLeadStatusParams | AddLeadNoteParams;

export interface WorkflowRecommendation {
  id: string; // Deterministic fingerprint
  leadId: string;
  actionName: WorkflowActionName;
  title: string;
  description: string;
  riskLevel: WorkflowRiskLevel;
  parameters: TypedActionParameters;
  rationale: string;
  source: WorkflowRecommendationSource;
  suggestedAssigneeName?: string;
}

export interface WorkflowRoutingContext {
  lead: {
    id: string;
    companyName: string;
    domain?: string | null;
    status: string;
    ownerId?: string | null;
    score?: number | null;
    scoreType?: string | null;
    enrichmentData?: string | null;
    aiSummary?: string | null;
  };
  scoreResult?: {
    score: number;
    category: QualificationCategory;
    factors: Array<{
      name: string;
      points: number;
      maxPoints: number;
      reason: string;
    }>;
  } | null;
  aiQualification?: {
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    missingInformation?: string[];
    recommendedAction?: string;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  } | null;
  organizationUsers?: Array<{
    id: string;
    name?: string | null;
    email: string;
    role?: string;
  }>;
}
