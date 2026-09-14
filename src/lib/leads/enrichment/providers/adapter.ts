import { EnrichmentInput, ProviderEnrichmentResult } from '../types';

export interface EnrichmentProviderAdapter {
  readonly name: string;
  supports(input: EnrichmentInput): boolean;
  enrich(input: EnrichmentInput): Promise<ProviderEnrichmentResult>;
}
