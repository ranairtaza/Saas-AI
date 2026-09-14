import { z } from 'zod';

export const createLeadSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(100, 'Company name is too long'),
  domain: z.string().max(255).optional(),
  contactName: z.string().max(100).optional(),
  contactEmail: z.string().email('Invalid email address').max(255).optional().or(z.literal('')),
  contactTitle: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  location: z.string().max(255).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  status: z.enum(['DISCOVERED', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const leadQuerySchema = z.object({
  search: z.string().max(100, 'Search query is too long').optional(),
  status: z.enum(['DISCOVERED', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
});
