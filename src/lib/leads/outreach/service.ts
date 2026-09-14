import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import {
  OutreachAIOutput,
  OutreachAIOutputSchema,
  OutreachDraftPayload,
  OutreachIntelligence,
  OutreachTone,
  GenerationMode,
} from './types';
import { OutreachContextPayload } from './context-builder';

export interface AIStructuredProvider {
  generateStructured<T>(schema: z.ZodType<T>, prompt: string): Promise<T>;
}

export class DefaultGeminiOutreachProvider implements AIStructuredProvider {
  async generateStructured<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    const { object } = await generateObject({
      model: google('gemini-1.5-flash-latest'),
      schema: schema as any,
      prompt,
      temperature: 0.2, // Low temperature for high grounding and low hallucination
    });
    return object as T;
  }
}

export class AIOutreachService {
  /**
   * Generates grounded Outreach Intelligence and a Personalized Cold Email Draft.
   * Respects strict fact/observation/hypothesis separation.
   * Never recalculates or modifies the deterministic lead score.
   */
  static async generateDraft(
    context: OutreachContextPayload,
    options: {
      tone?: OutreachTone;
      customAngle?: string;
      provider?: AIStructuredProvider;
    } = {}
  ): Promise<{
    intelligence: OutreachIntelligence;
    draft: {
      subject: string;
      body: string;
      tone: OutreachTone;
    };
    generationMode: GenerationMode;
  }> {
    const tone = options.tone || 'CONSULTATIVE_VALUE';
    const provider = options.provider || new DefaultGeminiOutreachProvider();

    // 1. MOCK Fallback when API key is unconfigured
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !options.provider) {
      return this.generateMockDraft(context, tone, options.customAngle);
    }

    // 2. Build Structured Prompt with Epistemic Boundary Guidelines
    const prompt = `
You are an expert B2B Sales Intelligence Analyst and Executive Copywriter.
Your task is to analyze the qualified lead data below and produce:
1. Structured Outreach Intelligence (separating Verified Facts, Observations, and Opportunity Hypotheses).
2. A compelling, concise personalized cold email draft (< 120 words).

TONE SPECIFICATION: ${tone}
${options.customAngle ? `STRATEGIC ANGLE FOCUS: ${options.customAngle}` : ''}

CRITICAL ARCHITECTURAL CONSTRAINTS:
- DO NOT invent or assume unlisted technologies, revenue figures, or company milestones.
- DO NOT say "I see your deployment is failing" or state unverified assumptions as facts.
- DO separate VERIFIED FACTS (direct evidence from input), OBSERVATIONS (logical deductions from verified facts), and OPPORTUNITY HYPOTHESES (inferred potential needs framed as possibilities).
- DO write a subject line under 80 characters.
- DO provide a concise closing with a low-friction, conversational Call to Action (e.g. "open to a 10-minute intro chat?", "happy to share our benchmark teardown").
- DO NOT mention deterministic scores or internal qualification points in the email body.

QUALIFIED PROSPECT DATA:
${context.sanitizedPromptData}
`.trim();

    try {
      const output = await provider.generateStructured<OutreachAIOutput>(OutreachAIOutputSchema, prompt);

      // Validate output structure with Zod
      const parsed = OutreachAIOutputSchema.parse(output);

      return {
        intelligence: {
          leadId: context.leadId,
          verifiedEvidence: parsed.intelligence.verifiedEvidence,
          observations: parsed.intelligence.observations,
          opportunityHypotheses: parsed.intelligence.opportunityHypotheses,
          valueProposition: parsed.intelligence.valueProposition,
          recommendedAngle: parsed.intelligence.recommendedAngle,
          recommendedCTA: parsed.intelligence.recommendedCTA,
          confidence: parsed.intelligence.confidence,
          confidenceRationale: parsed.intelligence.confidenceRationale,
          generatedAt: new Date().toISOString(),
        },
        draft: {
          subject: parsed.draft.subject,
          body: parsed.draft.fullBody,
          tone: parsed.draft.tone,
        },
        generationMode: 'LIVE_AI',
      };
    } catch (error) {
      console.warn('[AIOutreachService] Structured generation error. Falling back to deterministic template:', error);
      return this.generateMockDraft(context, tone, options.customAngle);
    }
  }

  /**
   * Deterministic, safe fallback generator used when offline or in test environments.
   * Explicitly sets generationMode: 'MOCK'.
   */
  static generateMockDraft(
    context: OutreachContextPayload,
    tone: OutreachTone = 'CONSULTATIVE_VALUE',
    customAngle?: string
  ): {
    intelligence: OutreachIntelligence;
    draft: {
      subject: string;
      body: string;
      tone: OutreachTone;
    };
    generationMode: GenerationMode;
  } {
    const verifiedEvidence: string[] = [
      `Company: ${context.companyName}`,
      context.contactTitle ? `Contact Title: ${context.contactTitle}` : 'Role: Decision Maker',
      context.enrichment?.companySize ? `Headcount: ${context.enrichment.companySize}` : 'Verified Organization',
      context.enrichment?.technologies && context.enrichment.technologies.length > 0
        ? `Tech Stack: ${context.enrichment.technologies.slice(0, 3).join(', ')}`
        : 'Active SaaS Stack',
    ];

    const observations: string[] = [
      context.enrichment?.industry
        ? `Operating in ${context.enrichment.industry} space`
        : `Verified domain presence at ${context.domain || context.companyName}`,
      `Deterministic Qualification Tier: ${context.scoreCategory} (${context.score}/100 pts)`,
    ];

    const opportunityHypotheses: string[] = [
      `Organizations at this scale often seek to streamline operational overhead and tool sprawl.`,
      `Potential synergy in accelerating developer onboarding and workflow automation.`,
    ];

    const recommendedAngle = customAngle || (context.scoreCategory === 'HIGH' ? 'Executive Value & Scaling Efficiency' : 'Productivity & Tool Consolidation');
    const recommendedCTA = 'Would you be open to a brief 10-minute introductory conversation next week?';

    const greeting = context.contactName ? `Hi ${context.contactName},` : `Hi ${context.companyName} Team,`;
    const techMention = context.enrichment?.technologies && context.enrichment.technologies.length > 0
      ? ` around ${context.enrichment.technologies[0]}`
      : '';

    const subject = `Accelerating workflow productivity at ${context.companyName}`;
    const body = `${greeting}

Noticed ${context.companyName} is scaling operations${techMention}. For companies in your growth stage, minimizing engineering overhead and infrastructure friction is often a major lever for velocity.

We help teams streamline developer operations without disrupting existing workflows.

${recommendedCTA}

Best regards,
LeadMachine Team`;

    return {
      intelligence: {
        leadId: context.leadId,
        verifiedEvidence,
        observations,
        opportunityHypotheses,
        valueProposition: `Streamline operational efficiency and infrastructure overhead for ${context.companyName}.`,
        recommendedAngle,
        recommendedCTA,
        confidence: context.scoreCategory === 'HIGH' ? 'HIGH' : 'MEDIUM',
        confidenceRationale: 'Derived from verified company profile and deterministic scoring factors.',
        generatedAt: new Date().toISOString(),
      },
      draft: {
        subject,
        body,
        tone,
      },
      generationMode: 'MOCK',
    };
  }
}
