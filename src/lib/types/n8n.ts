/**
 * N8N Integration Types
 */

export interface N8NWebhookPayload {
	templateId: string;
	templateData: Record<string, unknown>;
	userId?: string;
	userEmail?: string;
	userName?: string;
	userAddress?: string;
	userZip?: string;
	subject?: string;
	message_body?: string;
	deliveryMethod?: string;
	actionType?: string;
	timestamp: string;
	metadata?: Record<string, unknown>;
}

export interface N8NWorkflowResult {
	workflowId: string;
	executionId: string;
	success: boolean;
	data?: Record<string, unknown>;
	error?: string;
}

export interface VerificationResult {
	verified: boolean;
	verificationId: string;
	severity: number;
	confidence: number;
	corrections?: Record<string, string>;
	metadata?: Record<string, unknown>;
}

export interface ConsensusResult {
	approved: boolean;
	consensusScore: number;
	agentVotes: Record<string, boolean | number>;
	diversityScore: number;
	recommendation: string;
	metadata?: Record<string, unknown>;
}

export interface ReputationUpdate {
	userId: string;
	userAddress?: string;
	reputationDelta: number;
	totalReputation: number;
	explanation: string;
	timestamp: Date;
	metadata?: Record<string, unknown>;
}

export interface N8NWorkflowMetrics {
	total_executions: number;
	successful_executions: number;
	failed_executions: number;
	average_execution_time: number;
	last_24h_executions: number;
}

export interface N8NWorkflowStatus {
	status: 'healthy' | 'degraded' | 'failing';
	success_rate: number;
	avg_response_time: number;
	recommendations: string[];
}

export interface N8NWorkflow {
	id: string;
	name: string;
	active: boolean;
	webhook?: string;
}

// N8N Process Template Response Types
export interface ProcessTemplateStages {
	verification?: {
		approved: boolean;
		severityLevel?: number;
		corrections?: {
			subject?: string;
			body?: string;
		};
		violations?: string[];
	};
	consensus?: {
		approved: boolean;
		score: number;
		agentCount: number;
		diversityScore: number;
	};
	reward?: {
		amount: string;
		formatted: string;
		breakdown: {
			supply: string;
			marketMultiplier: number;
			impactMultiplier: number;
		};
	};
	reputation?: {
		changes: Record<string, number>;
		newTier: string;
		badges: string[];
	};
}

export interface ProcessTemplateResponse {
	success: boolean;
	templateId: string;
	submissionId: string;
	stages: ProcessTemplateStages;
	approved?: boolean;
	reason?: string;
	cwcReady?: {
		subject: string;
		body: string;
		recipients: string[];
		templateId: string;
	};
}
