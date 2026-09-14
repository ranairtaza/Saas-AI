import { EnrichedLeadData, ConsolidatedEnrichmentSnapshot, EnrichmentInput } from './types';
import { enrichmentOrchestrator } from './orchestrator';

export class EnrichmentService {
  /**
   * Enriches a lead using the multi-source orchestrator.
   * Backward-compatible interface returning normalized EnrichedLeadData.
   */
  async enrichLead(
    leadDomain?: string | null,
    companyName?: string | null,
    extraParams?: Partial<EnrichmentInput>
  ): Promise<EnrichedLeadData | null> {
    try {
      if (!leadDomain && !companyName) {
        return null;
      }

      const input: EnrichmentInput = {
        leadId: extraParams?.leadId || 'temp-lead',
        companyName: companyName || 'Unknown Company',
        domain: leadDomain || null,
        contactName: extraParams?.contactName || null,
        contactTitle: extraParams?.contactTitle || null,
        location: extraParams?.location || null,
      };

      const snapshot = await enrichmentOrchestrator.enrichLead(input);
      return snapshot;
    } catch (error) {
      console.error('[EnrichmentService] Error enriching lead:', error);
      return null;
    }
  }

  /**
   * Comprehensive enrichment returning all discovered evidence and conflicts.
   */
  async enrichLeadFull(
    input: EnrichmentInput,
    requestedProviders?: string[]
  ): Promise<ConsolidatedEnrichmentSnapshot> {
    return enrichmentOrchestrator.enrichLead(input, requestedProviders);
  }
}

export const enrichmentService = new EnrichmentService();
