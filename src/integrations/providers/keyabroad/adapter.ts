import { IntegrationProvider, SyncResult } from '../../core/types';
import prisma from '@/lib/db';
import { decrypt } from '../../../lib/encryption';

const KEYABROAD_API_URL = process.env.KEYABROAD_CRM_BASE_URL || 'https://api.keyabroad.com';

interface KeyAbroadResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

export const keyabroadAdapter: IntegrationProvider = {
  id: 'keyabroad',
  name: 'KeyAbroad CRM',
  type: 'CRM',

  async connect(organizationId: string, credentials: any): Promise<boolean> {
    if (!credentials.apiKey) return false;
    return await this.testConnection(credentials.apiKey);
  },

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${KEYABROAD_API_URL}/api/integrations/leadmachine?limit=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  async disconnect(organizationId: string): Promise<boolean> {
    return true;
  },

  async validateConnection(organizationId: string): Promise<boolean> {
    const cred = await prisma.providerCredential.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: 'keyabroad'
        }
      }
    });

    if (!cred) return false;

    try {
      const apiKey = decrypt(cred.encryptedKey);
      return await this.testConnection(apiKey);
    } catch {
      return false;
    }
  },

  async sync(organizationId: string, connectionId: string): Promise<SyncResult> {
    const cred = await prisma.providerCredential.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: 'keyabroad'
        }
      }
    });

    if (!cred) {
      return { success: false, recordsProcessed: 0, errorMessage: 'Missing credentials' };
    }

    try {
      const apiKey = decrypt(cred.encryptedKey);
      let page = 1;
      const limit = 500;
      let hasMore = true;
      let recordsProcessed = 0;
      let leadsFetched = 0;
      let activeLeads = 0;
      let pipelineValue = 0;
      let studentCount = 0;

      while (hasMore) {
        const response = await fetch(`${KEYABROAD_API_URL}/api/integrations/leadmachine?page=${page}&limit=${limit}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`KeyAbroad API returned ${response.status}`);
        }

        const data: KeyAbroadResponse = await response.json();
        
        for (const record of data.data) {
          // Normalize record
          const isStudent = record.type === 'student';
          const isEnquiry = record.type === 'enquiry' || record.type === 'lead';
          
          if (isEnquiry) leadsFetched++;
          if (isStudent) studentCount++;
          if (record.status !== 'LOST' && record.status !== 'CLOSED') activeLeads++;
          if (record.total_budget_pkr) pipelineValue += Number(record.total_budget_pkr);

          await prisma.lead.upsert({
            where: { id: `keyabroad-${record.id}` }, // Note: Need a valid ID strategy if lead ID is UUID, but SQLite needs a valid String. Actually id is String @id @default(uuid()).
            update: {
              companyName: record.company || 'Unknown',
              contactName: record.name,
              contactEmail: record.email,
              phone: record.phone,
              status: record.status || 'DISCOVERED',
              source: `keyabroad:${record.id}`,
              enrichmentData: JSON.stringify(record),
              updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
            },
            create: {
              id: `keyabroad-${record.id}`,
              organizationId,
              companyName: record.company || 'Unknown',
              contactName: record.name,
              contactEmail: record.email,
              phone: record.phone,
              status: record.status || 'DISCOVERED',
              source: `keyabroad:${record.id}`,
              enrichmentData: JSON.stringify(record),
              createdAt: record.created_at ? new Date(record.created_at) : new Date(),
              updatedAt: record.updated_at ? new Date(record.updated_at) : new Date(),
            }
          });
          recordsProcessed++;
        }

        hasMore = data.pagination?.has_more || false;
        page++;
      }

      const now = new Date();
      const metricsToSync = [
        { key: 'KEYABROAD_TOTAL_LEADS', name: 'KeyAbroad Total Leads', unit: 'COUNT', category: 'SALES', value: leadsFetched },
        { key: 'KEYABROAD_ACTIVE_LEADS', name: 'KeyAbroad Active Leads', unit: 'COUNT', category: 'SALES', value: activeLeads },
        { key: 'KEYABROAD_STUDENTS', name: 'KeyAbroad Students', unit: 'COUNT', category: 'SALES', value: studentCount },
        { key: 'KEYABROAD_PIPELINE_VALUE_PKR', name: 'KeyAbroad Pipeline Value (PKR)', unit: 'CURRENCY', category: 'FINANCIAL', value: pipelineValue },
      ];

      for (const m of metricsToSync) {
        const metric = await prisma.businessMetric.upsert({
          where: { organizationId_key: { organizationId, key: m.key } },
          update: {},
          create: {
            organizationId,
            key: m.key,
            name: m.name,
            description: `Auto-synced ${m.name} from KeyAbroad CRM`,
            unit: m.unit,
            category: m.category
          }
        });

        await prisma.metricSnapshot.create({
          data: {
            organizationId,
            metricId: metric.id,
            timestamp: now,
            value: m.value,
            source: 'keyabroad'
          }
        });
      }

      return { success: true, recordsProcessed };
    } catch (err: any) {
      console.error('KeyAbroad sync failed:', err);
      return { success: false, recordsProcessed: 0, errorMessage: err.message };
    }
  },

  async healthCheck(): Promise<boolean> {
    return true;
  }
};
