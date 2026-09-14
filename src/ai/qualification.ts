import { generateObject } from 'ai';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { EnrichedLeadData } from '../lib/leads/enrichment/types';
import { ScoreResult } from '../lib/leads/scoring/engine';

export const AIQualificationSchema = z.object({
  summary: z.string().describe('A concise 2-3 sentence summary of the lead.'),
  strengths: z.array(z.string()).describe('List of objective strengths based on the data.'),
  weaknesses: z.array(z.string()).describe('List of objective weaknesses based on the data.'),
  missingInformation: z.array(z.string()).describe('List of missing data points that would improve qualification.'),
  recommendedAction: z.string().describe('The recommended next action for a sales rep.'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('AI confidence in its qualification analysis.'),
});

export type AIQualificationResult = z.infer<typeof AIQualificationSchema>;

export interface AIProvider {
  generateStructured<T>(schema: z.ZodType<T>, prompt: string): Promise<T>;
}

export class DefaultGeminiProvider implements AIProvider {
  async generateStructured<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    const { object } = await generateObject({
      model: google('gemini-1.5-flash-latest'),
      schema: schema as any,
      prompt
    });
    return object as T;
  }
}

export class AIQualificationService {
  /**
   * Generates a structured qualification summary for a lead.
   * STRICT RULE: The AI is NOT allowed to invent or change the official deterministic score.
   */
  static async qualifyLead(
    lead: any,
    enrichment: EnrichedLeadData | null,
    scoreResult: ScoreResult,
    provider: AIProvider = new DefaultGeminiProvider()
  ): Promise<AIQualificationResult> {
    
    // When Gemini API key is not configured in environment,
    // return grounded baseline summary without failing.
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
      return {
        summary: "Preliminary qualification summary: Lead evaluated based on deterministic data points. Detailed generative analysis activates with configured Gemini API key.",
        strengths: ["Deterministic scoring criteria satisfied"],
        weaknesses: [lead.phone ? "Pending contact verification" : "Contact phone not yet provided"],
        missingInformation: [!lead.phone ? "Phone" : null, !lead.location ? "Location" : null].filter(Boolean) as string[],
        recommendedAction: "Review lead profile and verify contact outreach channel.",
        confidence: "MEDIUM"
      };
    }

    const context = `
      LEAD DATA:
      Name: ${lead.contactName || 'Unknown'}
      Email: ${lead.contactEmail || 'Unknown'}
      Company: ${lead.companyName || 'Unknown'}
      Domain: ${lead.domain || 'Unknown'}
      
      ENRICHMENT DATA:
      ${enrichment ? JSON.stringify(enrichment, null, 2) : 'None available'}
      
      OFFICIAL DETERMINISTIC SCORE: ${scoreResult.score}/100
      OFFICIAL QUALIFICATION CATEGORY: ${scoreResult.category}
      
      SCORING FACTORS:
      ${JSON.stringify(scoreResult.factors, null, 2)}
    `;

    try {
      const prompt = `
        You are an AI Executive Assistant evaluating a lead.
        
        You have been provided with normalized lead data, verified enrichment data, and a DETERMINISTIC SCORE.
        
        RULES:
        1. DO NOT change, invent, or recalculate the score. The official score is final.
        2. Explain WHY the lead received this score based on the provided Scoring Factors and Enrichment Data.
        3. Distinguish known information from unknown information.
        4. If enrichment data is missing, note it as a weakness or missingInformation.
        5. Keep the summary professional and concise.
        
        Analyze the following lead context and return the structured output:
        ${context}
      `;

      return await provider.generateStructured(AIQualificationSchema, prompt);
    } catch (error) {
      console.error('[AIQualificationService] Error generating qualification:', error);
      throw error;
    }
  }
}
