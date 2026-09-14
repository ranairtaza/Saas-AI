import { inngest } from '../client';
import prisma from '@/lib/db';

export const cleanupDiscoveryResults = inngest.createFunction(
  { id: 'cleanup-discovery-results', triggers: [{ cron: '0 0 * * *' }] },
  async ({ step }) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await step.run('delete-old-results', async () => {
      // Delete DiscoveryResults older than 7 days that are not somehow linked to promoted leads.
      // DiscoveryResults are temporary staging records, Lead is the CRM record. 
      // Deleting DiscoveryResult does not delete Lead records because there is no foreign key from Lead to DiscoveryResult.
      
      const { count } = await prisma.discoveryResult.deleteMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo
          }
        }
      });
      return count;
    });

    return { deleted: result };
  }
);
