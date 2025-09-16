/**
 * N8N Workflow Integration
 */

import axios, { type AxiosInstance } from 'axios';
import type { 
  N8NWebhookPayload, 
  N8NWorkflowResult,
  VerificationResult,
  ConsensusResult,
  ReputationUpdate 
} from '@/types';
import { getConfig } from '@/utils/config';

export class N8NClient {
  private client: AxiosInstance;
  private config = getConfig();
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = this.config.api.n8nWebhookSecret;
    
    this.client = axios.create({
      baseURL: this.config.api.n8nUrl,
      timeout: 60000, // N8N workflows can take longer
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': this.webhookSecret,
        'User-Agent': 'Delivery-Platform/2.0'
      }
    });
  }

  /**
   * Trigger template moderation workflow
   */
  public async triggerTemplateModeration(
    payload: N8NWebhookPayload
  ): Promise<N8NWorkflowResult> {
    try {
      console.log(`[N8N] Triggering template moderation for ${payload.templateId}`);
      
      const response = await this.client.post<{
        executionId: string;
        data: {
          verified: boolean;
          verificationId: string;
          severity: number;
          corrections?: Record<string, string>;
          approved?: boolean;
          consensusScore?: number;
        };
      }>('/webhook/template-moderation', payload);
      
      return {
        workflowId: 'template-moderation',
        executionId: response.data.executionId,
        success: true,
        data: response.data.data
      };
      
    } catch (error) {
      console.error('[N8N] Template moderation workflow failed:', error);
      return {
        workflowId: 'template-moderation',
        executionId: 'error',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Trigger verification workflow
   */
  public async triggerVerification(
    templateId: string,
    templateData: Record<string, unknown>
  ): Promise<VerificationResult> {
    try {
      const response = await this.client.post<VerificationResult>(
        '/webhook/verification',
        {
          templateId,
          templateData,
          timestamp: new Date().toISOString()
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('[N8N] Verification workflow failed:', error);
      return {
        verified: false,
        verificationId: 'error',
        severity: 10,
        confidence: 0
      };
    }
  }

  /**
   * Trigger consensus workflow
   */
  public async triggerConsensus(
    verificationId: string,
    templateData: Record<string, unknown>,
    severity: number
  ): Promise<ConsensusResult> {
    try {
      const response = await this.client.post<ConsensusResult>(
        '/webhook/consensus',
        {
          verificationId,
          templateData,
          severity,
          timestamp: new Date().toISOString()
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('[N8N] Consensus workflow failed:', error);
      return {
        approved: false,
        consensusScore: 0,
        agentVotes: {},
        diversityScore: 0,
        recommendation: 'Unable to reach consensus'
      };
    }
  }

  /**
   * Trigger reputation update workflow
   */
  public async triggerReputationUpdate(
    userId: string,
    userAddress: string | undefined,
    action: 'template_submission' | 'template_approval' | 'message_sent',
    metadata: Record<string, unknown>
  ): Promise<ReputationUpdate> {
    try {
      const response = await this.client.post<ReputationUpdate>(
        '/webhook/reputation',
        {
          userId,
          userAddress,
          action,
          metadata,
          timestamp: new Date().toISOString()
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('[N8N] Reputation workflow failed:', error);
      return {
        userId,
        userAddress,
        reputationDelta: 0,
        totalReputation: 0,
        explanation: 'Reputation update failed',
        timestamp: new Date()
      };
    }
  }

  /**
   * Trigger custom workflow
   */
  public async triggerWorkflow(
    workflowName: string,
    payload: Record<string, unknown>
  ): Promise<N8NWorkflowResult> {
    try {
      console.log(`[N8N] Triggering workflow: ${workflowName}`);
      
      const response = await this.client.post<{
        executionId: string;
        status: string;
        data?: Record<string, unknown>;
      }>(`/webhook/${workflowName}`, {
        ...payload,
        _meta: {
          source: 'delivery-platform',
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        workflowId: workflowName,
        executionId: response.data.executionId,
        success: response.data.status === 'success',
        data: response.data.data
      };
      
    } catch (error) {
      console.error(`[N8N] Workflow ${workflowName} failed:`, error);
      return {
        workflowId: workflowName,
        executionId: 'error',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check workflow execution status
   */
  public async checkExecutionStatus(executionId: string): Promise<{
    status: 'running' | 'success' | 'error' | 'unknown';
    data?: Record<string, unknown>;
  }> {
    try {
      const response = await this.client.get<{
        status: string;
        finished: boolean;
        data?: Record<string, unknown>;
      }>(`/executions/${executionId}`);
      
      if (!response.data.finished) {
        return { status: 'running' };
      }
      
      return {
        status: response.data.status === 'success' ? 'success' : 'error',
        data: response.data.data
      };
      
    } catch (error) {
      console.error(`[N8N] Failed to check execution ${executionId}:`, error);
      return { status: 'unknown' };
    }
  }

  /**
   * Wait for workflow completion
   */
  public async waitForCompletion(
    executionId: string,
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 1000
  ): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkExecutionStatus(executionId);
      
      if (status.status === 'success') {
        return { success: true, data: status.data };
      }
      
      if (status.status === 'error') {
        return { success: false, error: 'Workflow execution failed' };
      }
      
      if (status.status === 'unknown') {
        return { success: false, error: 'Unable to check execution status' };
      }
      
      // Still running, wait before next check
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    return { success: false, error: 'Workflow execution timeout' };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get<{ status: string }>('/health');
      return response.data.status === 'ok';
    } catch (error) {
      console.error('[N8N] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get workflow execution metrics
   */
  public async getWorkflowMetrics(workflowId?: string): Promise<{
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    average_execution_time: number;
    last_24h_executions: number;
  }> {
    try {
      const response = await this.client.get<{
        metrics: {
          total_executions: number;
          successful_executions: number;
          failed_executions: number;
          average_execution_time: number;
          last_24h_executions: number;
        };
      }>(`/metrics${workflowId ? `?workflow=${workflowId}` : ''}`);
      
      return response.data.metrics;
    } catch (error) {
      console.error('[N8N] Failed to get workflow metrics:', error);
      return {
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        average_execution_time: 0,
        last_24h_executions: 0
      };
    }
  }

  /**
   * Monitor workflow performance
   */
  public async monitorWorkflowPerformance(workflowName: string): Promise<{
    status: 'healthy' | 'degraded' | 'failing';
    success_rate: number;
    avg_response_time: number;
    recommendations: string[];
  }> {
    try {
      const metrics = await this.getWorkflowMetrics(workflowName);
      const successRate = metrics.total_executions > 0 
        ? metrics.successful_executions / metrics.total_executions 
        : 1;
      
      let status: 'healthy' | 'degraded' | 'failing' = 'healthy';
      const recommendations: string[] = [];
      
      if (successRate < 0.5) {
        status = 'failing';
        recommendations.push('High failure rate - check workflow configuration');
      } else if (successRate < 0.8) {
        status = 'degraded';
        recommendations.push('Moderate failure rate - monitor closely');
      }
      
      if (metrics.average_execution_time > 30000) {
        status = status === 'healthy' ? 'degraded' : status;
        recommendations.push('High execution time - optimize workflow');
      }
      
      if (metrics.last_24h_executions === 0) {
        recommendations.push('No recent executions - check workflow triggers');
      }
      
      return {
        status,
        success_rate: successRate,
        avg_response_time: metrics.average_execution_time,
        recommendations
      };
    } catch (error) {
      console.error(`[N8N] Failed to monitor workflow ${workflowName}:`, error);
      return {
        status: 'failing',
        success_rate: 0,
        avg_response_time: 0,
        recommendations: ['Unable to fetch monitoring data']
      };
    }
  }

  /**
   * List available workflows
   */
  public async listWorkflows(): Promise<Array<{
    id: string;
    name: string;
    active: boolean;
    webhook?: string;
  }>> {
    try {
      const response = await this.client.get<{
        workflows: Array<{
          id: string;
          name: string;
          active: boolean;
          nodes?: Array<{
            type: string;
            webhookId?: string;
          }>;
        }>;
      }>('/workflows');
      
      return response.data.workflows.map(workflow => {
        const webhookNode = workflow.nodes?.find(
          node => node.type === 'n8n-nodes-base.webhook'
        );
        
        return {
          id: workflow.id,
          name: workflow.name,
          active: workflow.active,
          webhook: webhookNode?.webhookId
        };
      });
      
    } catch (error) {
      console.error('[N8N] Failed to list workflows:', error);
      return [];
    }
  }
}