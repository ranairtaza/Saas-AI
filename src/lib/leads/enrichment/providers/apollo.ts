import { EnrichmentProviderAdapter } from './adapter';
import { EnrichmentInput, ProviderEnrichmentResult, DiscoveredEvidenceItem } from '../types';

export class ApolloEnrichmentProvider implements EnrichmentProviderAdapter {
  readonly name = 'apollo-enrichment';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.APOLLO_API_KEY;
  }

  supports(input: EnrichmentInput): boolean {
    return Boolean(this.apiKey && (input.domain || input.companyName));
  }

  async enrich(input: EnrichmentInput): Promise<ProviderEnrichmentResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return {
        providerName: this.name,
        success: false,
        evidence: [],
        errorMessage: 'Apollo API key is not configured',
        latencyMs: 0,
      };
    }

    try {
      // In production, queries Apollo organization enrichment API
      const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          domain: input.domain || undefined,
          name: input.companyName || undefined,
        }),
      });

      if (!response.ok) {
        return {
          providerName: this.name,
          success: false,
          evidence: [],
          errorMessage: `Apollo API returned status ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const org = data.organization || {};
      const evidence: DiscoveredEvidenceItem[] = [];
      const observedAt = new Date().toISOString();
      const sourceUrl = 'https://api.apollo.io/v1/organizations/enrich';

      if (org.industry) {
        evidence.push({
          field: 'industry',
          value: org.industry,
          sourceType: 'DIRECTORY',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        });
      }

      if (org.estimated_num_employees) {
        const emp = org.estimated_num_employees;
        let sizeRange = '1-10';
        if (emp > 1000) sizeRange = '1000+';
        else if (emp > 200) sizeRange = '200-1000';
        else if (emp > 50) sizeRange = '50-200';
        else if (emp > 10) sizeRange = '10-50';

        evidence.push({
          field: 'companySize',
          value: sizeRange,
          sourceType: 'DIRECTORY',
          sourceUrl,
          provider: this.name,
          confidence: 'MEDIUM',
          verificationStatus: 'VERIFIED',
          observedAt,
        });
      }

      if (org.annual_revenue_printed || org.annual_revenue) {
        evidence.push({
          field: 'estimatedRevenue',
          value: org.annual_revenue_printed || `$${Math.round(org.annual_revenue / 1000000)}M`,
          sourceType: 'DIRECTORY',
          sourceUrl,
          provider: this.name,
          confidence: 'MEDIUM',
          verificationStatus: 'VERIFIED',
          observedAt,
        });
      }

      if (org.raw_address || org.city) {
        const loc = org.raw_address || `${org.city || ''}, ${org.state || ''} ${org.country || ''}`.trim();
        evidence.push({
          field: 'location',
          value: loc,
          sourceType: 'DIRECTORY',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        });
      }

      if (org.technologies && Array.isArray(org.technologies)) {
        evidence.push({
          field: 'technologies',
          value: org.technologies.slice(0, 10),
          sourceType: 'DIRECTORY',
          sourceUrl,
          provider: this.name,
          confidence: 'MEDIUM',
          verificationStatus: 'VERIFIED',
          observedAt,
        });
      }

      return {
        providerName: this.name,
        success: true,
        evidence,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        providerName: this.name,
        success: false,
        evidence: [],
        errorMessage: err.message || 'Apollo enrichment request failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
