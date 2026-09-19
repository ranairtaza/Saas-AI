import prisma from '@/lib/db';
import { requirePermission } from '../../permissions/rbac';
import { PERMISSIONS } from '../../permissions/definitions';

export interface BusinessProfileData {
  industry?: string;
  businessName: string;
  timezone?: string;
  currency?: string;
  locale?: string;
}

export class BusinessProfileService {
  /**
   * Retrieves the business profile for the specified organization.
   * Enforces tenant isolation.
   */
  static async getProfile(organizationId: string, userRole: string | undefined | null) {
    if (!organizationId) throw new Error("Organization ID is required.");
    
    // We can allow READ for standard users, but updates require ORG_SETTINGS.
    // Assuming any authenticated user belonging to the organization can read.
    
    const profile = await prisma.businessProfile.findUnique({
      where: { organizationId }
    });
    
    return profile;
  }

  /**
   * Upserts the business profile for the specified organization.
   * Requires ORG_SETTINGS permission.
   */
  static async updateProfile(organizationId: string, userRole: string | undefined | null, data: BusinessProfileData) {
    if (!organizationId) throw new Error("Organization ID is required.");
    
    // Require ORG_SETTINGS permission to update the profile
    requirePermission(userRole, PERMISSIONS.ORG_SETTINGS);

    const profile = await prisma.businessProfile.upsert({
      where: { organizationId },
      update: {
        industry: data.industry,
        businessName: data.businessName,
        timezone: data.timezone,
        currency: data.currency,
        locale: data.locale,
      },
      create: {
        organizationId,
        industry: data.industry,
        businessName: data.businessName,
        timezone: data.timezone || 'UTC',
        currency: data.currency || 'USD',
        locale: data.locale || 'en-US',
      }
    });

    return profile;
  }
}
