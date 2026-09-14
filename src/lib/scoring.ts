import { Lead } from "@prisma/client";

/**
 * Calculates a deterministic, rule-based score (0-100) based on data completeness.
 * This function is isolated so that a future AI scoring system can easily augment or replace it.
 */
export function calculateRuleBasedScore(lead: Partial<Lead>): number {
  let score = 0;

  // Key contact information
  if (lead.contactEmail) score += 30;
  if (lead.phone) score += 25;
  if (lead.contactName) score += 15;

  // Company information
  if (lead.companyName) score += 10;
  if (lead.domain) score += 10;
  if (lead.location) score += 10;

  return Math.min(score, 100);
}
