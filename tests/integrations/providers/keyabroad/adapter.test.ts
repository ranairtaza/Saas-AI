import { keyabroadAdapter } from '../../../../src/integrations/providers/keyabroad/adapter';
import prisma from '@/lib/db';

jest.mock('@/lib/db', () => ({
  providerCredential: {
    findUnique: jest.fn(),
  },
  lead: {
    upsert: jest.fn(),
  },
  businessMetric: {
    upsert: jest.fn(),
  },
  metricSnapshot: {
    create: jest.fn(),
  }
}));

jest.mock('../../../../src/lib/encryption', () => ({
  decrypt: jest.fn(() => 'test-api-key'),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('KeyAbroad CRM Adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('testConnection / validateConnection', () => {
    it('returns true on valid credentials (HTTP 200)', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const result = await keyabroadAdapter.testConnection('valid-key');
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('returns false on HTTP 401', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });
      const result = await keyabroadAdapter.testConnection('invalid-key');
      expect(result).toBe(false);
    });

    it('returns false on missing credentials', async () => {
      const result = await keyabroadAdapter.connect('org-id', {});
      expect(result).toBe(false);
    });
  });

  describe('sync', () => {
    it('returns error when credentials missing', async () => {
      (prisma.providerCredential.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await keyabroadAdapter.sync('org-id', 'conn-id');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Missing credentials');
    });

    it('fetches data and maps into leads', async () => {
      (prisma.providerCredential.findUnique as jest.Mock).mockResolvedValue({
        encryptedKey: 'encrypted',
      });

      const mockData = {
        data: [
          {
            id: '123',
            type: 'enquiry',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '12345',
            status: 'OPEN',
            company: 'JD Corp',
            total_budget_pkr: 50000,
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            id: '124',
            type: 'student',
            name: 'Jane Smith',
            email: 'jane@example.com',
            status: 'CLOSED',
            company: 'JS LLC',
            created_at: '2026-01-02T00:00:00Z',
          }
        ],
        pagination: { has_more: false }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockData)
      });

      (prisma.lead.upsert as jest.Mock).mockResolvedValue({});
      (prisma.businessMetric.upsert as jest.Mock).mockResolvedValue({ id: 'metric-1' });

      const result = await keyabroadAdapter.sync('org-id', 'conn-id');

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(2);

      // Verify Upsert Calls
      expect(prisma.lead.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.businessMetric.upsert).toHaveBeenCalledTimes(4); // 4 metrics
      expect(prisma.metricSnapshot.create).toHaveBeenCalledTimes(4);
    });

    it('handles pagination correctly until has_more is false', async () => {
      (prisma.providerCredential.findUnique as jest.Mock).mockResolvedValue({
        encryptedKey: 'encrypted',
      });

      // Page 1
      const page1 = {
        data: [{ id: '1', type: 'student' }],
        pagination: { has_more: true }
      };
      
      // Page 2
      const page2 = {
        data: [{ id: '2', type: 'student' }],
        pagination: { has_more: false }
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(page1) })
        .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(page2) });

      const result = await keyabroadAdapter.sync('org-id', 'conn-id');

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('handles HTTP error safely and returns error message', async () => {
      (prisma.providerCredential.findUnique as jest.Mock).mockResolvedValue({
        encryptedKey: 'encrypted',
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429
      });

      const result = await keyabroadAdapter.sync('org-id', 'conn-id');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('KeyAbroad API returned 429');
    });
  });
});
