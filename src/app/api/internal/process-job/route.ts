import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { MockProvider } from '@/lib/providers/mock-provider';
import { ApolloProvider } from '@/lib/providers/apollo-provider';
import { normalizeEmail, normalizeDomain } from '@/lib/providers/lead-provider';
import { calculateRuleBasedScore } from '@/lib/scoring';
import { decrypt } from '@/lib/encryption';
import { consumeCredits, refundCredits } from '@/lib/billing/credits';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const expectedSecret = process.env.INTERNAL_JOB_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized internal request' }, { status: 401 });
    }

    const { jobId, organizationId } = await request.json();

    if (!jobId || !organizationId) {
      return NextResponse.json({ error: 'Missing job ID or organization ID' }, { status: 400 });
    }

    const job = await prisma.discoveryJob.findUnique({
      where: { id: jobId }
    });

    if (!job || job.status !== 'QUEUED') {
      return NextResponse.json({ error: 'Job not found or not in QUEUED state' }, { status: 400 });
    }

    // Verify org isolation
    if (job.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.discoveryJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() }
    });

    try {
      const criteria = JSON.parse(job.criteria);
      const requestedProvider = criteria.provider || 'apollo';
      const limit = criteria.limit || 10;

      let providerInstance: any;
      
      if (requestedProvider === 'apollo') {
        const apolloCred = await prisma.providerCredential.findUnique({
          where: {
            organizationId_provider: {
              organizationId: organizationId,
              provider: 'apollo'
            }
          }
        });

        if (!apolloCred) {
          throw new Error('Provider credentials are not configured.');
        }

        providerInstance = new ApolloProvider(decrypt(apolloCred.encryptedKey));
      } else if (requestedProvider === 'mock') {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('MockProvider cannot be used in production environment.');
        }
        providerInstance = new MockProvider();
      } else {
        throw new Error(`Unsupported provider: ${requestedProvider}`);
      }

      let page = 1;
      let hasMore = true;
      let processedCount = 0;
      let apiTotal = limit;

      while (hasMore && processedCount < limit) {
        const result = await providerInstance.search(criteria, page);
        
        // Dynamically adjust total if provider reports fewer than requested limit
        if (page === 1 && result.total !== undefined) {
          apiTotal = Math.min(limit, result.total);
          await prisma.discoveryJob.update({
            where: { id: jobId },
            data: { total: apiTotal }
          });
        }

        const rawLeads = result.leads;
        
        // 1. Normalize and in-batch deduplicate
        const normalizedLeads = [];
        const batchEmailMap = new Set<string>();
        const batchDomainNameMap = new Set<string>();

        for (const rawLead of rawLeads) {
          const email = normalizeEmail(rawLead.contactEmail);
          const domain = normalizeDomain(rawLead.domain);
          
          const normalizedLead = {
            ...rawLead,
            contactEmail: email,
            domain: domain,
          };

          let isDuplicate = false;
          if (email) {
            if (batchEmailMap.has(email)) isDuplicate = true;
            else batchEmailMap.add(email);
          } else if (domain) {
            const namePart = rawLead.contactName ? rawLead.contactName.toLowerCase().trim() : 'NO_CONTACT';
            const domainNameKey = `${domain}::${namePart}`;
            if (batchDomainNameMap.has(domainNameKey)) isDuplicate = true;
            else batchDomainNameMap.add(domainNameKey);
          }

          if (!isDuplicate) {
            normalizedLeads.push(normalizedLead);
          }
        }

        // 2. Database Deduplication & Persistence
        for (const lead of normalizedLeads) {
          if (processedCount >= limit) break; // Break early if limit exactly reached inside chunk

          const orConditions: any[] = [];
          
          if (lead.contactEmail) {
            orConditions.push({ contactEmail: lead.contactEmail });
          } else if (lead.domain) {
            if (lead.contactName) {
               orConditions.push({ domain: lead.domain, contactName: lead.contactName });
            } else {
               orConditions.push({ domain: lead.domain, contactEmail: null, contactName: null });
            }
          }

          let isExisting = false;
          if (orConditions.length > 0) {
            const existing = await prisma.lead.findFirst({
              where: {
                organizationId: organizationId,
                OR: orConditions
              }
            });
            if (existing) isExisting = true;
          }

          if (!isExisting) {
            const score = calculateRuleBasedScore(lead);
            
            await prisma.discoveryResult.create({
              data: {
                discoveryJobId: jobId,
                organizationId: organizationId,
                provider: lead.source || 'UNKNOWN',
                providerRecordId: lead.enrichmentData ? JSON.parse(lead.enrichmentData).apollo_id : null,
                companyName: lead.companyName,
                domain: lead.domain,
                contactName: lead.contactName,
                contactEmail: lead.contactEmail,
                contactTitle: lead.contactTitle,
                phone: lead.phone,
                location: lead.location,
                metadata: lead.enrichmentData,
                score,
                verificationStatus: lead.status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
              }
            });
          }
          
          processedCount++;
        }

        // Update progress per page chunk
        const progress = apiTotal > 0 ? Math.floor((processedCount / apiTotal) * 100) : 100;
        await prisma.discoveryJob.update({
          where: { id: jobId },
          data: { processed: processedCount, progress: Math.min(progress, 100) }
        });

        hasMore = result.hasMore;
        page++;
      }

      await prisma.discoveryJob.update({
        where: { id: jobId },
        data: { 
          status: 'COMPLETED', 
          processed: processedCount,
          progress: 100,
          completedAt: new Date()
        }
      });

      // CONSUME reserved credits based on what was actually processed
      await consumeCredits(organizationId, processedCount, 'DISCOVERY_JOB', jobId, `Consumed for ${processedCount} leads`);
      
      // REFUND any unused reserved credits
      if (processedCount < limit) {
        await refundCredits(organizationId, limit - processedCount, 'DISCOVERY_JOB', `${jobId}-refund`, `Refunded unused leads`);
      }

    } catch (jobError: any) {
      console.error(`Job processing failed for ${jobId}:`, jobError);
      await prisma.discoveryJob.update({
        where: { id: jobId },
        data: { 
          status: 'FAILED', 
          error: jobError.message || 'Unknown processing error',
          completedAt: new Date()
        }
      });
      // REFUND full reserved credits on catastrophic job failure
      const criteria = JSON.parse(job.criteria);
      const limit = criteria.limit || 10;
      await refundCredits(organizationId, limit, 'DISCOVERY_JOB', `${jobId}-fail-refund`, `Refunded full limit due to job failure`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Job Processor Trigger Error:', error);
    return NextResponse.json({ error: 'Failed to process job' }, { status: 500 });
  }
}
