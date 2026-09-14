import { EnrichmentProviderAdapter } from './providers/adapter';
import { WebsiteMetaProvider } from './providers/website';
import { TechDetectorProvider } from './providers/tech-detector';
import { ApolloEnrichmentProvider } from './providers/apollo';
import { MockEnrichmentProvider } from './providers/mock';
import {
  EnrichmentInput,
  ConsolidatedEnrichmentSnapshot,
  DiscoveredEvidenceItem,
  EnrichedLeadData,
} from './types';
import { normalizeAndResolveEvidence } from './normalizer';

export class EnrichmentOrchestrator {
  private providers: Map<string, EnrichmentProviderAdapter> = new Map();

  constructor() {
    this.registerProvider(new WebsiteMetaProvider());
    this.registerProvider(new TechDetectorProvider());
    this.registerProvider(new ApolloEnrichmentProvider());
    if (process.env.NODE_ENV !== 'production') {
      this.registerProvider(new MockEnrichmentProvider());
    }
  }

  registerProvider(provider: EnrichmentProviderAdapter) {
    this.providers.set(provider.name, provider);
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Orchestrates multi-source lead enrichment with failure isolation across all active providers.
   */
  async enrichLead(
    input: EnrichmentInput,
    requestedProviders?: string[]
  ): Promise<ConsolidatedEnrichmentSnapshot> {
    const activeProviders = this.getApplicableProviders(input, requestedProviders);
    const completedProviders: string[] = [];
    const allEvidence: DiscoveredEvidenceItem[] = [];

    // Execute providers concurrently with full failure isolation
    const results = await Promise.allSettled(
      activeProviders.map(async (provider) => {
        try {
          const res = await provider.enrich(input);
          return res;
        } catch (err: any) {
          console.warn(`[EnrichmentOrchestrator] Provider ${provider.name} failed:`, err.message);
          return {
            providerName: provider.name,
            success: false,
            evidence: [],
            errorMessage: err.message,
            latencyMs: 0,
          };
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        completedProviders.push(result.value.providerName);
        allEvidence.push(...result.value.evidence);
      }
    }

    // If all real external providers failed or returned no evidence, ensure fallback mock executes (dev only)
    if (allEvidence.length === 0 && process.env.NODE_ENV !== 'production') {
      const mock = this.providers.get('mock-enrichment');
      if (mock) {
        const fallbackRes = await mock.enrich(input);
        if (fallbackRes.success) {
          completedProviders.push(mock.name);
          allEvidence.push(...fallbackRes.evidence);
        }
      }
    }

    // Normalize, deduplicate, and resolve conflicts across evidence items
    return normalizeAndResolveEvidence(allEvidence, completedProviders);
  }

  private getApplicableProviders(
    input: EnrichmentInput,
    requested?: string[]
  ): EnrichmentProviderAdapter[] {
    const list: EnrichmentProviderAdapter[] = [];

    for (const [name, provider] of this.providers.entries()) {
      if (requested && requested.length > 0 && !requested.includes(name)) {
        continue;
      }
      if (provider.supports(input)) {
        list.push(provider);
      }
    }

    return list;
  }
}

export const enrichmentOrchestrator = new EnrichmentOrchestrator();
