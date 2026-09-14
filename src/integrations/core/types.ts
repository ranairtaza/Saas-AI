export interface IntegrationProvider {
  id: string;
  name: string;
  type: string;
  connect(organizationId: string, credentials: any): Promise<boolean>;
  disconnect(organizationId: string): Promise<boolean>;
  validateConnection(organizationId: string): Promise<boolean>;
  sync(organizationId: string, connectionId: string): Promise<SyncResult>;
  healthCheck(): Promise<boolean>;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  errorMessage?: string;
}

export interface SyncContext {
  organizationId: string;
  connectionId: string;
}
