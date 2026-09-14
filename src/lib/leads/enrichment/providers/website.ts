import { EnrichmentProviderAdapter } from './adapter';
import { EnrichmentInput, ProviderEnrichmentResult, DiscoveredEvidenceItem } from '../types';
import { safeFetchHtml } from '../security/ssrf-guard';

export class WebsiteMetaProvider implements EnrichmentProviderAdapter {
  readonly name = 'website-crawler';

  supports(input: EnrichmentInput): boolean {
    return Boolean(input.domain && input.domain.trim().length > 0);
  }

  async enrich(input: EnrichmentInput): Promise<ProviderEnrichmentResult> {
    const startTime = Date.now();
    const domain = input.domain?.trim();

    if (!domain) {
      return {
        providerName: this.name,
        success: false,
        evidence: [],
        errorMessage: 'Domain is required for website crawling',
        latencyMs: 0,
      };
    }

    try {
      const fetchResult = await safeFetchHtml(domain, { timeoutMs: 4000 });

      if (!fetchResult.ok || !fetchResult.html && !fetchResult.headers) {
        return {
          providerName: this.name,
          success: false,
          evidence: [],
          errorMessage: fetchResult.error || 'Website unreachable or returned empty payload',
          latencyMs: Date.now() - startTime,
        };
      }

      const evidence: DiscoveredEvidenceItem[] = [];
      const sourceUrl = `https://${domain}`;
      const observedAt = new Date().toISOString();

      // 1. Analyze HTTP Response Headers for Server Technologies
      const detectedHeaderTech: string[] = [];
      const headers = fetchResult.headers || {};

      if (headers['x-powered-by']) {
        detectedHeaderTech.push(headers['x-powered-by']);
      }
      if (headers['server']) {
        detectedHeaderTech.push(headers['server'].split('/')[0]);
      }
      if (headers['x-nextjs-page'] || headers['x-nextjs-cache'] || headers['x-nextjs-matched-path']) {
        detectedHeaderTech.push('Next.js');
      }
      if (headers['x-vercel-id']) {
        detectedHeaderTech.push('Vercel');
      }
      if (headers['cf-ray']) {
        detectedHeaderTech.push('Cloudflare');
      }
      if (headers['x-shopify-stage'] || headers['x-shopid']) {
        detectedHeaderTech.push('Shopify');
      }

      if (detectedHeaderTech.length > 0) {
        const uniqueTech = Array.from(new Set(detectedHeaderTech.filter(Boolean)));
        evidence.push({
          field: 'technologies',
          value: uniqueTech,
          sourceType: 'WEBSITE',
          sourceUrl,
          provider: this.name,
          confidence: 'HIGH',
          verificationStatus: 'VERIFIED',
          observedAt,
        });
      }

      // 2. Parse HTML Meta Tags (Description, OpenGraph, Title)
      const html = fetchResult.html || '';
      const metaDescriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i) ||
                                   html.match(/<meta\s+content=["'](.*?)["']\s+name=["']description["']/i);
      const ogDescriptionMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                                 html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:description["']/i);
      
      const pageDescription = metaDescriptionMatch?.[1] || ogDescriptionMatch?.[1] || '';

      // Infer industry from meta keywords / description safely via keyword signatures
      const lowerDesc = pageDescription.toLowerCase();
      let inferredIndustry: string | null = null;

      if (lowerDesc.includes('saas') || lowerDesc.includes('software') || lowerDesc.includes('cloud') || lowerDesc.includes('api')) {
        inferredIndustry = 'Software & Technology';
      } else if (lowerDesc.includes('shop') || lowerDesc.includes('ecommerce') || lowerDesc.includes('store') || lowerDesc.includes('retail')) {
        inferredIndustry = 'E-Commerce & Retail';
      } else if (lowerDesc.includes('health') || lowerDesc.includes('medical') || lowerDesc.includes('clinic')) {
        inferredIndustry = 'Healthcare & Life Sciences';
      } else if (lowerDesc.includes('bank') || lowerDesc.includes('finance') || lowerDesc.includes('invest') || lowerDesc.includes('fintech')) {
        inferredIndustry = 'Finance & Banking';
      }

      if (inferredIndustry) {
        evidence.push({
          field: 'industry',
          value: inferredIndustry,
          sourceType: 'WEBSITE',
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
        errorMessage: err.message || 'Website extraction failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
