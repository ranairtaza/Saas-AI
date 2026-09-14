import { AIContext } from '../providers/provider';

export interface AITool {
  name: string;
  description: string;
  parameters: any; // JSON schema for parameters
  requiredPermission?: string;
  riskLevel: 'READ_ONLY' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // Standard execute for READ_ONLY / immediate actions
  execute?: (context: AIContext, args: any) => Promise<any>;
  
  // Action Builder for MEDIUM/HIGH/actions requiring approval
  buildAction?: (context: AIContext, args: any) => Promise<{ humanDescription: string, sanitizedArgs: any }>;
  
  // Execution handler invoked only post-approval
  executeAction?: (context: AIContext, args: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, AITool> = new Map();

  register(tool: AITool) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): AITool[] {
    return Array.from(this.tools.values());
  }

  getToolSchemas(): any[] {
    return this.getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }
}
