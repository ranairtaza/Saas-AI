import { DiscoveryResult, Lead } from "@prisma/client";

export interface NormalizedLeadData {
  companyName: string;
  domain: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactTitle: string | null;
  phone: string | null;
  location: string | null;
  industry: string | null;
  source: string;
}

export class LeadNormalizer {
  /**
   * Normalizes raw text to Title Case
   */
  static toTitleCase(str: string | null | undefined): string | null {
    if (!str) return null;
    return str
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Cleans domain/website URL to just the domain
   */
  static normalizeDomain(url: string | null | undefined): string | null {
    if (!url) return null;
    let clean = url.trim().toLowerCase();
    if (clean.startsWith('http://')) clean = clean.slice(7);
    if (clean.startsWith('https://')) clean = clean.slice(8);
    if (clean.startsWith('www.')) clean = clean.slice(4);
    // strip paths
    const pathIdx = clean.indexOf('/');
    if (pathIdx !== -1) {
      clean = clean.slice(0, pathIdx);
    }
    return clean || null;
  }

  /**
   * Cleans email and lowercases it
   */
  static normalizeEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return clean || null;
  }

  /**
   * Cleans phone number (strips characters, leaves + and numbers)
   */
  static normalizePhone(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const clean = phone.trim().replace(/[^\d+]/g, '');
    return clean || null;
  }

  /**
   * Converts a DiscoveryResult into a normalized Lead data payload
   */
  static fromDiscoveryResult(result: DiscoveryResult): NormalizedLeadData {
    return {
      companyName: this.toTitleCase(result.companyName) || 'Unknown Company',
      domain: this.normalizeDomain(result.domain),
      contactName: this.toTitleCase(result.contactName),
      contactEmail: this.normalizeEmail(result.contactEmail),
      contactTitle: this.toTitleCase(result.contactTitle),
      phone: this.normalizePhone(result.phone),
      location: this.toTitleCase(result.location),
      industry: null, // Industry typically comes from enrichment unless metadata provides it
      source: `DISCOVERY_${result.provider}`
    };
  }

  /**
   * Updates an existing Lead with new normalized data, avoiding overwriting with nulls
   */
  static mergeIntoLead(lead: Partial<Lead>, newData: NormalizedLeadData): Partial<Lead> {
    return {
      ...lead,
      companyName: newData.companyName || lead.companyName,
      domain: newData.domain || lead.domain,
      contactName: newData.contactName || lead.contactName,
      contactEmail: newData.contactEmail || lead.contactEmail,
      contactTitle: newData.contactTitle || lead.contactTitle,
      phone: newData.phone || lead.phone,
      location: newData.location || lead.location,
      source: newData.source || lead.source
    };
  }
}
