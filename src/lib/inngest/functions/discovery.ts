import { inngest } from '../client';
import prisma from '@/lib/db';
import { ApolloProvider } from '@/lib/providers/apollo-provider';
import { normalizeEmail, normalizeDomain } from '@/lib/providers/lead-provider';
import { calculateRuleBasedScore } from '@/lib/scoring';
import { decrypt } from '@/lib/encryption';
import { consumeCredits, refundCredits } from '@/lib/billing/credits';

export const processDiscoveryJob = inngest.createFunction(
  { id: 'process-discovery-job', triggers: [{ event: 'discovery.job.process' }], retries: 3 },
  async ({ event, step }) => {
    const { jobId, organizationId } = event.data;

    // Verify job exists and is QUEUED
    const job = await step.run('fetch-job', async () => {
      const j = await prisma.discoveryJob.findUnique({ where: { id: jobId } });
      if (!j) throw new Error('Job not found');
      if (j.organizationId !== organizationId) throw new Error('Unauthorized');
      return j;
    });

    if (job.status !== 'QUEUED') {
      return { message: 'Job already processed or not queued' };
    }

    // Set to RUNNING
    await step.run('set-running', async () => {
      await prisma.discoveryJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date() }
      });
    });

    try {
      const criteria = JSON.parse(job.criteria);
      const limit = criteria.limit || 10;
      const requestedProvider = criteria.provider || 'apollo';

      if (requestedProvider !== 'apollo') {
         throw new Error(`Unsupported provider: ${requestedProvider}. MockProvider is strictly disabled in production pipelines.`);
      }

      // Fetch Credentials
      const apiKey = await step.run('fetch-credentials', async () => {
        const apolloCred = await prisma.providerCredential.findUnique({
          where: {
            organizationId_provider: {
              organizationId: organizationId,
              provider: 'apollo'
            }
          }
        });
        if (!apolloCred) throw new Error('Provider credentials are not configured.');
        return decrypt(apolloCred.encryptedKey); // decrypted purely in memory
      });

      let page = 1;
      let hasMore = true;
      let processedCount = 0;
      let apiTotal = limit;

      while (hasMore && processedCount < limit) {
        // Step wrapper for Apollo fetch to allow retries (e.g. 429 rate limit)
        const result = await step.run(`fetch-apollo-page-${page}`, async () => {
          const providerInstance = new ApolloProvider(apiKey);
          return await providerInstance.search(criteria, page);
        });

        if (page === 1 && result.total !== undefined) {
          apiTotal = Math.min(limit, result.total);
          await step.run('update-total', async () => {
            await prisma.discoveryJob.update({
              where: { id: jobId },
              data: { total: apiTotal }
            });
          });
        }

        const rawLeads = result.leads;
        
        // Normalize and persist leads
        const persistResult = await step.run(`persist-leads-page-${page}`, async () => {
          let batchProcessedCount = 0;
          const normalizedLeads = [];
          const batchEmailMap = new Set<string>();
          const batchDomainNameMap = new Set<string>();

          for (const rawLead of rawLeads) {
            const email = normalizeEmail(rawLead.contactEmail);
            const domain = normalizeDomain(rawLead.domain);
            
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
              normalizedLeads.push({
                ...rawLead,
                contactEmail: email,
                domain: domain,
              });
            }
          }

          // DB Deduplication
          for (const lead of normalizedLeads) {
            if (processedCount + batchProcessedCount >= limit) break;

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
            
            batchProcessedCount++;
          }
          return batchProcessedCount;
        });

        processedCount += persistResult;

        // Update progress
        await step.run(`update-progress-${page}`, async () => {
          const progress = apiTotal > 0 ? Math.floor((processedCount / apiTotal) * 100) : 100;
          await prisma.discoveryJob.update({
            where: { id: jobId },
            data: { processed: processedCount, progress: Math.min(progress, 100) }
          });
        });

        hasMore = result.hasMore;
        page++;
      }

      await step.run('complete-job', async () => {
        await prisma.discoveryJob.update({
          where: { id: jobId },
          data: { 
            status: 'COMPLETED', 
            processed: processedCount,
            progress: 100,
            completedAt: new Date()
          }
        });

        await consumeCredits(organizationId, processedCount, 'DISCOVERY_JOB', jobId, `Consumed for ${processedCount} leads`);
        
        if (processedCount < limit) {
          await refundCredits(organizationId, limit - processedCount, 'DISCOVERY_JOB', `${jobId}-refund`, `Refunded unused leads`);
        }
      });

      return { success: true, processed: processedCount };

    } catch (jobError: any) {
      await step.run('fail-job', async () => {
        await prisma.discoveryJob.update({
          where: { id: jobId },
          data: { 
            status: 'FAILED', 
            error: jobError.message || 'Unknown processing error',
            completedAt: new Date()
          }
        });
        const criteria = JSON.parse(job.criteria);
        const limit = criteria.limit || 10;
        await refundCredits(organizationId, limit, 'DISCOVERY_JOB', `${jobId}-fail-refund`, `Refunded full limit due to job failure`);
      });
      
      throw jobError; // Throw so Inngest knows it failed (if it runs out of retries)
    }
  }
);
