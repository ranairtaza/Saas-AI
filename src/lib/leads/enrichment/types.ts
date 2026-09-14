import { z } from 'zod';

export type SourceType =
  | 'WEBSITE'
  | 'TECH_DETECTOR'
  | 'SEARCH'
  | 'DIRECTORY'
  | 'API'
  | 'MOCK'
  | 'USER_PROVIDED'
  | 'OTHER';

export type EvidenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'CONFLICTING';

export type EnrichmentRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

// --- Single Discovered Evidence Item ---
export const DiscoveredEvidenceItemSchema = z.object({
  field: z.string().describe('Target attribute name, e.g. industry, companySize, technologies, estimatedRevenue, location, contactRole, decisionMakerIdentified'),
  value: z.any().describe('The observed attribute value (string, array of strings, or boolean)'),
  sourceType: z.enum(['WEBSITE', 'TECH_DETECTOR', 'SEARCH', 'DIRECTORY', 'API', 'MOCK', 'USER_PROVIDED', 'OTHER']),
  sourceUrl: z.string().nullable().optional(),
  provider: z.string().describe('Identifier of the provider adapter'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  verificationStatus: z.enum(['VERIFIED', 'UNVERIFIED', 'CONFLICTING']).default('VERIFIED'),
  observedAt: z.string().default(() => new Date().toISOString()),
  expiresAt: z.string().nullable().optional(),
});

export type DiscoveredEvidenceItem = z.infer<typeof DiscoveredEvidenceItemSchema>;

// --- Conflicting Evidence Signal ---
export interface ConflictingEvidenceGroup {
  field: string;
  values: Array<{
    value: any;
    provider: string;
    confidence: EvidenceConfidence;
    sourceUrl?: string | null;
  }>;
  resolvedValue: any;
  resolutionRationale: string;
}

// --- Enriched Lead Data (Backward-compatible normalized snapshot for Scoring Engine) ---
export interface EnrichedLeadData {
  companySize?: string;
  industry?: string;
  estimatedRevenue?: string;
  location?: string;
  technologies?: string[];
  decisionMakerIdentified?: boolean;
  contactRole?: string;
  sourceProvider: string;
  enrichedAt: string;
}

// --- Comprehensive Consolidated Enrichment Snapshot ---
export interface ConsolidatedEnrichmentSnapshot extends EnrichedLeadData {
  evidence: DiscoveredEvidenceItem[];
  conflicts: ConflictingEvidenceGroup[];
  isFresh: boolean;
  providersCompleted: string[];
}

// --- Input Contract for Providers ---
export interface EnrichmentInput {
  leadId: string;
  companyName: string;
  domain?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  location?: string | null;
}

// --- Provider Execution Result ---
export interface ProviderEnrichmentResult {
  providerName: string;
  success: boolean;
  evidence: DiscoveredEvidenceItem[];
  errorMessage?: string;
  latencyMs: number;
}

// --- Request Validation Schema ---
export const TriggerEnrichmentRequestSchema = z.object({
  forceRefresh: z.boolean().optional().default(false),
  providers: z.array(z.string()).optional(),
});

export type TriggerEnrichmentRequest = z.infer<typeof TriggerEnrichmentRequestSchema>;
