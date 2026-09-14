import * as crypto from 'crypto';
import { DeterministicScoringEngine, ScoreResult } from '../scoring/engine';

export interface RawLeadContextInput {
  id: string;
  organizationId: string;
  companyName: string;
  domain?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactTitle?: string | null;
  phone?: string | null;
  location?: string | null;
  source?: string | null;
  notes?: string | null;
  enrichmentData?: string | null;
  score?: number | null;
  scoreType?: string | null;
}

export interface OutreachContextPayload {
  leadId: string;
  organizationId: string;
  companyName: string;
  domain: string | null;
  contactName: string | null;
  contactTitle: string | null;
  location: string | null;
  score: number;
  scoreCategory: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNQUALIFIED';
  scoringFactors: ScoreResult['factors'];
  enrichment: {
    industry?: string;
    companySize?: string;
    estimatedRevenue?: string;
    technologies?: string[];
    decisionMakerIdentified?: boolean;
    contactRole?: string;
    enrichedCompany?: string;
  } | null;
  contextHash: string;
  sanitizedPromptData: string;
}

/**
 * Computes deterministic SHA-256 context hash over authoritative lead and qualification state.
 */
export function computeOutreachContextHash(params: {
  leadId: string;
  companyName: string;
  domain?: string | null;
  contactTitle?: string | null;
  score?: number | null;
  scoreCategory?: string | null;
  enrichmentDataString?: string | null;
}): string {
  const normalized = [
    params.leadId.trim(),
    params.companyName.trim().toLowerCase(),
    (params.domain || '').trim().toLowerCase(),
    (params.contactTitle || '').trim().toLowerCase(),
    params.score !== null && params.score !== undefined ? String(params.score) : 'unscored',
    params.scoreCategory || 'none',
    (params.enrichmentDataString || '').trim(),
  ].join('::');

  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Strips dangerous injection keywords and wraps untrusted fields in strictly passive delimiters.
 */
export function sanitizeUntrustedLeadField(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '') // remove HTML tags
    .replace(/[{}[\]]/g, '') // strip potential template injection brackets
    .trim();
}

/**
 * Builds normalized context, runs deterministic scoring as authoritative truth, and generates contextHash.
 */
export function buildOutreachContext(lead: RawLeadContextInput): OutreachContextPayload {
  // 1. Parse enrichment data safely if present
  let parsedEnrichment: any = null;
  if (lead.enrichmentData) {
    try {
      const raw = typeof lead.enrichmentData === 'string' ? JSON.parse(lead.enrichmentData) : lead.enrichmentData;
      parsedEnrichment = {
        industry: raw.industry || raw.company?.industry,
        companySize: raw.companySize || raw.company?.size || raw.employees_range,
        estimatedRevenue: raw.estimatedRevenue || raw.company?.annual_revenue,
        technologies: Array.isArray(raw.technologies) ? raw.technologies : raw.company?.technologies || [],
        decisionMakerIdentified: Boolean(raw.decisionMakerIdentified || raw.is_decision_maker),
        contactRole: raw.contactRole || raw.person?.title || lead.contactTitle || undefined,
        enrichedCompany: raw.enrichedCompany || raw.company?.name,
      };
    } catch {
      parsedEnrichment = null;
    }
  }

  // 2. Authoritative deterministic scoring calculation
  const scoringResult = DeterministicScoringEngine.score(
    {
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      phone: lead.phone,
    },
    parsedEnrichment
  );

  // 3. Compute deterministic context hash
  const contextHash = computeOutreachContextHash({
    leadId: lead.id,
    companyName: lead.companyName,
    domain: lead.domain,
    contactTitle: lead.contactTitle,
    score: scoringResult.score,
    scoreCategory: scoringResult.category,
    enrichmentDataString: lead.enrichmentData,
  });

  // 4. Construct prompt data block with strict boundary isolation
  const sanitizedCompany = sanitizeUntrustedLeadField(lead.companyName);
  const sanitizedDomain = sanitizeUntrustedLeadField(lead.domain);
  const sanitizedContact = sanitizeUntrustedLeadField(lead.contactName);
  const sanitizedTitle = sanitizeUntrustedLeadField(lead.contactTitle);
  const sanitizedLocation = sanitizeUntrustedLeadField(lead.location);
  const sanitizedNotes = sanitizeUntrustedLeadField(lead.notes);

  const sanitizedPromptData = `
<UNTRUSTED_LEAD_DATA>
  <Company>${sanitizedCompany}</Company>
  <Domain>${sanitizedDomain || 'N/A'}</Domain>
  <ContactName>${sanitizedContact || 'Decision Maker'}</ContactName>
  <ContactTitle>${sanitizedTitle || 'Unknown Role'}</ContactTitle>
  <Location>${sanitizedLocation || 'N/A'}</Location>
  <Notes>${sanitizedNotes || 'None'}</Notes>
  <VerifiedScore>${scoringResult.score}/100 (Tier: ${scoringResult.category})</VerifiedScore>
  <ScoringFactors>
    ${scoringResult.factors.map((f) => `- ${f.name}: ${f.points}/${f.maxPoints} pts (${f.reason})`).join('\n    ')}
  </ScoringFactors>
  <Enrichment>
    Industry: ${parsedEnrichment?.industry || 'Unknown'}
    CompanySize: ${parsedEnrichment?.companySize || 'Unknown'}
    EstimatedRevenue: ${parsedEnrichment?.estimatedRevenue || 'Unknown'}
    Technologies: ${parsedEnrichment?.technologies && parsedEnrichment.technologies.length > 0 ? parsedEnrichment.technologies.join(', ') : 'None listed'}
    DecisionMakerStatus: ${parsedEnrichment?.decisionMakerIdentified ? 'Verified' : 'Unverified'}
  </Enrichment>
</UNTRUSTED_LEAD_DATA>
`.trim();

  return {
    leadId: lead.id,
    organizationId: lead.organizationId,
    companyName: sanitizedCompany,
    domain: lead.domain ?? null,
    contactName: sanitizedContact || null,
    contactTitle: sanitizedTitle || null,
    location: sanitizedLocation || null,
    score: scoringResult.score,
    scoreCategory: scoringResult.category,
    scoringFactors: scoringResult.factors,
    enrichment: parsedEnrichment,
    contextHash,
    sanitizedPromptData,
  };
}
