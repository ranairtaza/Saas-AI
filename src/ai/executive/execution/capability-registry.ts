import { Capability, CapabilityCategory } from './types';

export class CapabilityRegistry {
  private static capabilities: Capability[] = [
    {
      id: 'CAP_CRM_UPDATE_LEAD',
      name: 'Update CRM Lead',
      category: 'CRM',
      supported: true,
      requiresApproval: true,
      requiredIntegration: 'hubspot',
      actionType: 'hubspot_update_lead',
    },
    {
      id: 'CAP_CRM_ASSIGN_LEAD',
      name: 'Assign CRM Lead',
      category: 'CRM',
      supported: true,
      requiresApproval: true,
      requiredIntegration: 'hubspot',
      actionType: 'hubspot_assign_lead',
    },
    {
      id: 'CAP_SYSTEM_UPDATE_GOAL',
      name: 'Update System Goal',
      category: 'SYSTEM',
      supported: true,
      requiresApproval: true,
      requiredIntegration: null,
      actionType: 'system_update_goal',
    },
    {
      id: 'CAP_REPORTING_GENERATE',
      name: 'Generate Report',
      category: 'REPORTING',
      supported: true,
      requiresApproval: false,
      requiredIntegration: null,
      actionType: 'reporting_generate',
    },
    {
      id: 'CAP_COMMUNICATE_TEAM',
      name: 'Communicate with Team',
      category: 'SYSTEM',
      supported: false, // Explicitly false to test UNSUPPORTED state handling
      requiresApproval: true,
      requiredIntegration: 'slack',
      actionType: 'slack_send_message',
    },
    {
      id: 'CAP_AD_CAMPAIGN_UPDATE',
      name: 'Update Ad Campaign',
      category: 'SYSTEM',
      supported: true,
      requiresApproval: true,
      requiredIntegration: 'google_ads',
      actionType: 'ads_update_budget',
    }
  ];

  static getCapabilities(): Capability[] {
    return this.capabilities;
  }

  static getCapabilityById(id: string): Capability | null {
    return this.capabilities.find(c => c.id === id) || null;
  }

  static getCapabilitiesByCategory(category: CapabilityCategory): Capability[] {
    return this.capabilities.filter(c => c.category === category);
  }
}
