/**
 * Task Orchestrator - Unified Processing for Dual Submission Flows
 * 
 * Handles both:
 * 1. VOTER Protocol flow: Templates → Enhancement → On-chain Settlement → Congressional Delivery
 * 2. Direct Delivery flow: Templates → Enhancement → Direct Email/Platform Delivery
 * 
 * Uses the same agent consensus system for both flows while optimizing for different outcomes.
 */

import type { Template } from '@prisma/client';
import { agentRegistry, type AgentTask, type CostConstraints } from '../registry/agent-registry';
import type { BaseAgent, AgentResponse } from '../base/universal-agent';
import { AgentFactory } from '../providers/agent-factory';
import { db } from '$lib/core/db';

export interface ProcessingPipeline {
	stages: PipelineStage[];
	estimatedCost: number;
	estimatedTime: number;
	qualityTarget: number;
}

export interface PipelineStage {
	id: string;
	type: 'screening' | 'enhancement' | 'validation' | 'consensus';
	agentIds: string[];
	parallel: boolean;
	required: boolean;
	maxRetries: number;
	timeoutMs: number;
	costBudget: number;
}

export interface ProcessingResult {
	templateId: string;
	success: boolean;
	finalDecision: 'approved' | 'rejected' | 'escalated';
	confidence: number;
	processing: {
		stages: StageResult[];
		totalCost: number;
		totalTime: number;
		cacheEfficiency: number;
	};
	content: {
		original: string;
		enhanced?: string;
		changeLog: ContentChange[];
	};
	consensus: {
		agentVotes: AgentVote[];
		reasoning: string;
		minorityOpinions: string[];
	};
	metadata: {
		submissionFlow: 'voter-protocol' | 'direct-delivery';
		qualityScore: number;
		riskAssessment: RiskAssessment;
		nextSteps: string[];
	};
}

interface StageResult {
	stageId: string;
	success: boolean;
	agentResponses: AgentResponse[];
	duration: number;
	cost: number;
	retries: number;
	error?: string;
}

interface ContentChange {
	type: 'grammar' | 'tone' | 'structure' | 'professionalism' | 'fact-check';
	original: string;
	enhanced: string;
	reasoning: string;
	confidence: number;
}

interface AgentVote {
	agentId: string;
	decision: 'approve' | 'reject';
	confidence: number;
	reasoning: string;
	weight: number;
}

interface RiskAssessment {
	toxicityLevel: 0 | 1 | 2 | 3 | 4;
	politicalSensitivity: 'low' | 'medium' | 'high';
	legalRisks: string[];
	reputationRisks: string[];
	mitigationStrategies: string[];
}

export class TaskOrchestrator {
	private agentFactory: AgentFactory;
	private processingQueue: Map<string, ProcessingPipeline> = new Map();
	private activeProcessing: Set<string> = new Set();

	constructor() {
		this.agentFactory = new AgentFactory();
	}

	/**
	 * Process a template through the appropriate pipeline
	 */
	async processTemplate(
		templateId: string, 
		submissionFlow: 'voter-protocol' | 'direct-delivery',
		userBudget: number = 0.10 // Default $0.10 budget
	): Promise<ProcessingResult> {
		
		// Prevent concurrent processing of same template
		if (this.activeProcessing.has(templateId)) {
			throw new Error(`Template ${templateId} is already being processed`);
		}

		this.activeProcessing.add(templateId);
		const startTime = Date.now();

		try {
			// Load template
			const template = await this.loadTemplate(templateId);
			if (!template) {
				throw new Error(`Template ${templateId} not found`);
			}

			// Design optimal pipeline for this template and flow
			const pipeline = await this.designOptimalPipeline(template, submissionFlow, userBudget);
			this.processingQueue.set(templateId, pipeline);

			// Execute pipeline stages
			const stageResults: StageResult[] = [];
			let cumulativeCost = 0;
			let enhancedContent: string | undefined;
			const changeLog: ContentChange[] = [];

			for (const stage of pipeline.stages) {
				console.log(`🔄 Processing stage: ${stage.type} for template ${templateId}`);
				
				const stageResult = await this.executeStage(stage, template, enhancedContent || template.message_body, submissionFlow);
				stageResults.push(stageResult);
				cumulativeCost += stageResult.cost;

				// Handle stage failure
				if (!stageResult.success && stage.required) {
					return this.createFailureResult(templateId, submissionFlow, stageResults, 'Stage failure: ' + stageResult.error);
				}

				// Extract enhanced content from enhancement stages
				if (stage.type === 'enhancement' && stageResult.success) {
					const enhancementResult = stageResult.agentResponses.find(r => r.success)?.result as any;
					if (enhancementResult?.enhancedContent) {
						enhancedContent = enhancementResult.enhancedContent;
						if (enhancementResult.changes) {
							changeLog.push(...enhancementResult.changes);
						}
					}
				}

				// Check budget constraints
				if (cumulativeCost > userBudget) {
					console.warn(`⚠️ Budget exceeded for template ${templateId}: $${cumulativeCost} > $${userBudget}`);
					break;
				}
			}

			// Generate final consensus
			const consensus = await this.generateFinalConsensus(stageResults, template, enhancedContent);
			
			// Update database with results
			await this.updateTemplateWithResults(templateId, {
				stageResults,
				consensus,
				enhancedContent,
				changeLog,
				submissionFlow,
				totalCost: cumulativeCost
			});

			const totalTime = Date.now() - startTime;

			return {
				templateId,
				success: consensus.decision !== 'rejected',
				finalDecision: consensus.decision,
				confidence: consensus.confidence,
				processing: {
					stages: stageResults,
					totalCost: cumulativeCost,
					totalTime,
					cacheEfficiency: this.calculateCacheEfficiency(stageResults)
				},
				content: {
					original: template.message_body,
					enhanced: enhancedContent,
					changeLog
				},
				consensus: {
					agentVotes: consensus.votes,
					reasoning: consensus.reasoning,
					minorityOpinions: consensus.minorityOpinions
				},
				metadata: {
					submissionFlow,
					qualityScore: consensus.qualityScore,
					riskAssessment: consensus.riskAssessment,
					nextSteps: this.generateNextSteps(consensus.decision, submissionFlow)
				}
			};

		} finally {
			this.activeProcessing.delete(templateId);
			this.processingQueue.delete(templateId);
		}
	}

	/**
	 * Design optimal processing pipeline based on template and flow type
	 */
	private async designOptimalPipeline(
		template: Template, 
		submissionFlow: 'voter-protocol' | 'direct-delivery',
		budget: number
	): Promise<ProcessingPipeline> {
		
		const complexity = this.analyzeTemplateComplexity(template);
		const constraints: CostConstraints = {
			maxCostPerTemplate: budget,
			maxLatencyMs: submissionFlow === 'voter-protocol' ? 30000 : 15000, // VOTER Protocol allows more time
			qualityThreshold: submissionFlow === 'voter-protocol' ? 0.9 : 0.8, // Higher quality for legislative
			allowPremiumModels: budget > 0.05
		};

		// Base pipeline stages
		const stages: PipelineStage[] = [];

		// Stage 1: Fast screening (always required)
		const screeningAgents = agentRegistry.selectConsensusAgents({
			type: 'screening',
			submissionFlow,
			priority: 'high',
			maxCost: budget * 0.1,
			maxLatency: 5000,
			content: template.message_body,
			context: { complexity }
		}, constraints, 1);

		stages.push({
			id: 'screening',
			type: 'screening',
			agentIds: screeningAgents.map(a => a.id),
			parallel: false,
			required: true,
			maxRetries: 2,
			timeoutMs: 5000,
			costBudget: budget * 0.1
		});

		// Stage 2: Enhancement (conditional based on screening)
		if (complexity.enhancementNeeded > 0.3) {
			const enhancementAgents = agentRegistry.selectConsensusAgents({
				type: 'enhancement',
				submissionFlow,
				priority: 'normal',
				maxCost: budget * 0.5,
				maxLatency: 15000,
				content: template.message_body,
				context: { 
					complexity,
					targetAudience: submissionFlow === 'voter-protocol' ? 'legislative' : 'corporate'
				}
			}, constraints, 1);

			stages.push({
				id: 'enhancement',
				type: 'enhancement',
				agentIds: enhancementAgents.map(a => a.id),
				parallel: false,
				required: complexity.enhancementNeeded > 0.7,
				maxRetries: 1,
				timeoutMs: 15000,
				costBudget: budget * 0.5
			});
		}

		// Stage 3: Validation (multi-agent consensus)
		const validationAgents = agentRegistry.selectConsensusAgents({
			type: 'consensus',
			submissionFlow,
			priority: 'normal',
			maxCost: budget * 0.3,
			maxLatency: 10000,
			content: template.message_body,
			context: { complexity }
		}, constraints, 2); // Always use 2 agents for consensus

		stages.push({
			id: 'validation',
			type: 'consensus',
			agentIds: validationAgents.map(a => a.id),
			parallel: true, // Can run consensus agents in parallel
			required: true,
			maxRetries: 1,
			timeoutMs: 10000,
			costBudget: budget * 0.3
		});

		// Stage 4: Complex reasoning (only for edge cases or VOTER Protocol)
		if (complexity.requiresReasoning || submissionFlow === 'voter-protocol') {
			const reasoningAgents = agentRegistry.selectConsensusAgents({
				type: 'reasoning',
				submissionFlow,
				priority: 'low',
				maxCost: budget * 0.1,
				maxLatency: 20000,
				content: template.message_body,
				context: { complexity }
			}, constraints, 1);

			if (reasoningAgents.length > 0) {
				stages.push({
					id: 'reasoning',
					type: 'reasoning',
					agentIds: reasoningAgents.map(a => a.id),
					parallel: false,
					required: false,
					maxRetries: 1,
					timeoutMs: 20000,
					costBudget: budget * 0.1
				});
			}
		}

		const estimatedCost = stages.reduce((sum, stage) => sum + stage.costBudget, 0);
		const estimatedTime = stages.reduce((sum, stage) => sum + stage.timeoutMs, 0);

		return {
			stages,
			estimatedCost,
			estimatedTime,
			qualityTarget: constraints.qualityThreshold
		};
	}

	/**
	 * Execute a pipeline stage
	 */
	private async executeStage(
		stage: PipelineStage,
		template: Template,
		content: string,
		submissionFlow: 'voter-protocol' | 'direct-delivery'
	): Promise<StageResult> {
		
		const stageStart = Date.now();
		const agentResponses: AgentResponse[] = [];
		let retries = 0;
		let totalCost = 0;

		while (retries <= stage.maxRetries) {
			try {
				// Get agents for this stage
				const agents = await this.getAgentsForStage(stage);
				
				if (stage.parallel) {
					// Execute agents in parallel
					const promises = agents.map(agent => this.executeAgent(agent, {
						type: stage.type,
						submissionFlow,
						priority: 'normal',
						maxCost: stage.costBudget / agents.length,
						maxLatency: stage.timeoutMs,
						content,
						context: {
							templateType: template.type,
							targetAudience: submissionFlow === 'voter-protocol' ? 'legislative' : 'corporate'
						}
					}));

					const responses = await Promise.allSettled(promises);
					
					for (const response of responses) {
						if (response.status === 'fulfilled') {
							agentResponses.push(response.value);
							totalCost += response.value.cost;
						}
					}
				} else {
					// Execute agents sequentially
					for (const agent of agents) {
						const response = await this.executeAgent(agent, {
							type: stage.type,
							submissionFlow,
							priority: 'normal',
							maxCost: stage.costBudget,
							maxLatency: stage.timeoutMs,
							content,
							context: {
								templateType: template.type,
								targetAudience: submissionFlow === 'voter-protocol' ? 'legislative' : 'corporate'
							}
						});

						agentResponses.push(response);
						totalCost += response.cost;
						
						// For sequential stages, break on first success
						if (response.success) break;
					}
				}

				// Check if we have at least one successful response
				const successfulResponses = agentResponses.filter(r => r.success);
				if (successfulResponses.length > 0 || !stage.required) {
					return {
						stageId: stage.id,
						success: successfulResponses.length > 0,
						agentResponses,
						duration: Date.now() - stageStart,
						cost: totalCost,
						retries
					};
				}

			} catch (error) {
				console.error(`❌ Stage ${stage.id} attempt ${retries + 1} failed:`, error);
			}

			retries++;
			if (retries <= stage.maxRetries) {
				await this.sleep(1000 * retries); // Exponential backoff
			}
		}

		return {
			stageId: stage.id,
			success: false,
			agentResponses,
			duration: Date.now() - stageStart,
			cost: totalCost,
			retries,
			error: `Stage failed after ${stage.maxRetries} retries`
		};
	}

	/**
	 * Execute individual agent
	 */
	private async executeAgent(agent: BaseAgent, task: AgentTask): Promise<AgentResponse> {
		const startTime = Date.now();
		
		try {
			const response = await agent.execute(task, {
				temperature: 0.3, // Conservative temperature for consistent results
				maxTokens: 2000,
				enableCaching: true,
				timeoutMs: task.maxLatency
			});

			// Update performance metrics
			agentRegistry.updatePerformance(agent.getCapability().id, {
				success: response.success,
				latencyMs: Date.now() - startTime,
				cost: response.cost
			});

			return response;

		} catch (error) {
			const failureResponse: AgentResponse = {
				agentId: agent.getCapability().id,
				success: false,
				result: null,
				confidence: 0,
				reasoning: `Agent execution failed: ${error}`,
				cost: 0,
				tokensUsed: { input: 0, output: 0 },
				cacheHit: false,
				processingTime: Date.now() - startTime,
				error: error instanceof Error ? error.message : 'Unknown error'
			};

			// Update performance metrics for failures
			agentRegistry.updatePerformance(agent.getCapability().id, {
				success: false,
				latencyMs: Date.now() - startTime,
				cost: 0
			});

			return failureResponse;
		}
	}

	/**
	 * Get agent instances for a stage
	 */
	private async getAgentsForStage(stage: PipelineStage): Promise<BaseAgent[]> {
		const agents: BaseAgent[] = [];
		
		for (const agentId of stage.agentIds) {
			const capability = agentRegistry.getActiveAgents().find(a => a.id === agentId);
			if (capability) {
				const agent = await this.agentFactory.createAgent(capability);
				agents.push(agent);
			}
		}

		return agents;
	}

	/**
	 * Analyze template complexity to guide pipeline design
	 */
	private analyzeTemplateComplexity(template: Template): {
		enhancementNeeded: number;
		requiresReasoning: boolean;
		toxicityRisk: number;
		politicalSensitivity: number;
	} {
		const content = template.message_body;
		const length = content.length;
		
		// Simple heuristics for complexity assessment
		const profanityCount = (content.match(/\b(damn|hell|crap)\b/gi) || []).length;
		const capsRatio = (content.match(/[A-Z]/g) || []).length / length;
		const exclamationCount = (content.match(/!/g) || []).length;
		const grammarIssues = this.detectGrammarIssues(content);

		const enhancementNeeded = Math.min(1, 
			(profanityCount * 0.3) + 
			(capsRatio * 2) + 
			(exclamationCount * 0.1) + 
			(grammarIssues * 0.2)
		);

		const requiresReasoning = 
			length > 500 || 
			profanityCount > 2 || 
			content.includes('Congress') || 
			content.includes('unconstitutional');

		const toxicityRisk = Math.min(1, profanityCount * 0.5 + capsRatio * 3);
		
		const politicalSensitivity = content.toLowerCase().includes('congress') || 
			content.toLowerCase().includes('senator') || 
			content.toLowerCase().includes('representative') ? 0.8 : 0.3;

		return {
			enhancementNeeded,
			requiresReasoning,
			toxicityRisk,
			politicalSensitivity
		};
	}

	/**
	 * Detect basic grammar issues
	 */
	private detectGrammarIssues(content: string): number {
		let issues = 0;
		
		// Simple checks
		if (!/^[A-Z]/.test(content.trim())) issues++; // Doesn't start with capital
		if (!/[.!?]$/.test(content.trim())) issues++; // Doesn't end with punctuation
		if (content.includes('  ')) issues++; // Double spaces
		if (/\b(your|you're)\b.*\b(your|you're)\b/i.test(content)) issues++; // Your/you're confusion
		
		return issues;
	}

	/**
	 * Generate final consensus from all stage results
	 */
	private async generateFinalConsensus(
		stageResults: StageResult[],
		template: Template,
		enhancedContent?: string
	): Promise<{
		decision: 'approved' | 'rejected' | 'escalated';
		confidence: number;
		votes: AgentVote[];
		reasoning: string;
		minorityOpinions: string[];
		qualityScore: number;
		riskAssessment: RiskAssessment;
	}> {
		
		const allResponses = stageResults.flatMap(sr => sr.agentResponses.filter(r => r.success));
		const votes: AgentVote[] = [];
		
		// Extract votes from agent responses
		for (const response of allResponses) {
			const capability = agentRegistry.getActiveAgents().find(a => a.id === response.agentId);
			if (capability) {
				votes.push({
					agentId: response.agentId,
					decision: this.extractDecision(response),
					confidence: response.confidence,
					reasoning: response.reasoning,
					weight: capability.reliability
				});
			}
		}

		// Calculate weighted consensus
		const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
		const approvalWeight = votes
			.filter(vote => vote.decision === 'approve')
			.reduce((sum, vote) => sum + vote.weight, 0);
		
		const approvalRatio = totalWeight > 0 ? approvalWeight / totalWeight : 0;
		const averageConfidence = votes.length > 0 
			? votes.reduce((sum, vote) => sum + vote.confidence, 0) / votes.length 
			: 0;

		// Decision logic
		let decision: 'approved' | 'rejected' | 'escalated';
		if (approvalRatio >= 0.7 && averageConfidence >= 0.8) {
			decision = 'approved';
		} else if (approvalRatio <= 0.3 || averageConfidence <= 0.3) {
			decision = 'rejected';
		} else {
			decision = 'escalated'; // Borderline cases need human review
		}

		// Extract minority opinions
		const majorityDecision = approvalRatio >= 0.5 ? 'approve' : 'reject';
		const minorityOpinions = votes
			.filter(vote => vote.decision !== majorityDecision)
			.map(vote => `${vote.agentId}: ${vote.reasoning}`);

		// Generate reasoning
		const reasoning = this.synthesizeReasoning(votes, decision);

		// Risk assessment
		const riskAssessment = this.generateRiskAssessment(template, enhancedContent, votes);

		return {
			decision,
			confidence: averageConfidence,
			votes,
			reasoning,
			minorityOpinions,
			qualityScore: this.calculateQualityScore(stageResults, enhancedContent),
			riskAssessment
		};
	}

	/**
	 * Extract decision from agent response
	 */
	private extractDecision(response: AgentResponse): 'approve' | 'reject' {
		// This would be more sophisticated in a real implementation
		// examining the actual response structure
		if (response.confidence > 0.6) {
			return 'approve';
		}
		return 'reject';
	}

	/**
	 * Synthesize reasoning from multiple agent votes
	 */
	private synthesizeReasoning(votes: AgentVote[], decision: string): string {
		const approvals = votes.filter(v => v.decision === 'approve');
		const rejections = votes.filter(v => v.decision === 'reject');
		
		if (decision === 'approved') {
			return `Consensus reached for approval (${approvals.length}/${votes.length} agents). ${approvals[0]?.reasoning || 'Content meets quality standards.'}`;
		} else if (decision === 'rejected') {
			return `Consensus reached for rejection (${rejections.length}/${votes.length} agents). ${rejections[0]?.reasoning || 'Content requires improvement.'}`;
		} else {
			return `Mixed opinions require human review. Approvals: ${approvals.length}, Rejections: ${rejections.length}`;
		}
	}

	/**
	 * Generate risk assessment
	 */
	private generateRiskAssessment(
		template: Template,
		enhancedContent: string | undefined,
		votes: AgentVote[]
	): RiskAssessment {
		// Simple risk assessment based on content and agent feedback
		const content = enhancedContent || template.message_body;
		const lowConfidenceVotes = votes.filter(v => v.confidence < 0.7);
		
		return {
			toxicityLevel: content.includes('damn') ? 1 : 0,
			politicalSensitivity: content.toLowerCase().includes('congress') ? 'high' : 'low',
			legalRisks: lowConfidenceVotes.length > 1 ? ['Uncertain content classification'] : [],
			reputationRisks: lowConfidenceVotes.length > 2 ? ['Multiple agents uncertain'] : [],
			mitigationStrategies: lowConfidenceVotes.length > 0 ? ['Additional human review recommended'] : []
		};
	}

	/**
	 * Calculate overall quality score
	 */
	private calculateQualityScore(stageResults: StageResult[], enhancedContent?: string): number {
		const successfulStages = stageResults.filter(sr => sr.success).length;
		const totalStages = stageResults.length;
		const stageSuccessRatio = successfulStages / totalStages;
		
		const averageConfidence = stageResults
			.flatMap(sr => sr.agentResponses.filter(r => r.success))
			.reduce((sum, r, _, arr) => sum + r.confidence / arr.length, 0);

		const enhancementBonus = enhancedContent ? 0.1 : 0;
		
		return Math.min(1, stageSuccessRatio * 0.6 + averageConfidence * 0.3 + enhancementBonus);
	}

	/**
	 * Generate next steps based on decision and flow
	 */
	private generateNextSteps(decision: string, submissionFlow: string): string[] {
		if (decision === 'approved') {
			if (submissionFlow === 'voter-protocol') {
				return [
					'Add to on-chain settlement batch',
					'Schedule congressional delivery via CWC API',
					'Award VOTER tokens to user',
					'Update user reputation score'
				];
			} else {
				return [
					'Prepare for direct delivery',
					'Update template metrics',
					'Notify user of approval'
				];
			}
		} else if (decision === 'rejected') {
			return [
				'Provide user feedback for improvement',
				'Refund user deposit',
				'Log rejection reasons for analysis'
			];
		} else {
			return [
				'Queue for human moderation review',
				'Notify internal team',
				'Hold user deposit pending review'
			];
		}
	}

	/**
	 * Helper methods
	 */
	private async loadTemplate(templateId: string): Promise<Template | null> {
		return await db.template.findUnique({
			where: { id: templateId }
		});
	}

	private createFailureResult(
		templateId: string,
		submissionFlow: 'voter-protocol' | 'direct-delivery',
		stageResults: StageResult[],
		error: string
	): ProcessingResult {
		return {
			templateId,
			success: false,
			finalDecision: 'rejected',
			confidence: 0,
			processing: {
				stages: stageResults,
				totalCost: stageResults.reduce((sum, sr) => sum + sr.cost, 0),
				totalTime: stageResults.reduce((sum, sr) => sum + sr.duration, 0),
				cacheEfficiency: 0
			},
			content: {
				original: '',
				changeLog: []
			},
			consensus: {
				agentVotes: [],
				reasoning: error,
				minorityOpinions: []
			},
			metadata: {
				submissionFlow,
				qualityScore: 0,
				riskAssessment: {
					toxicityLevel: 4,
					politicalSensitivity: 'high',
					legalRisks: ['Processing failure'],
					reputationRisks: ['System error'],
					mitigationStrategies: ['Manual review required']
				},
				nextSteps: ['Manual intervention required']
			}
		};
	}

	private calculateCacheEfficiency(stageResults: StageResult[]): number {
		const allResponses = stageResults.flatMap(sr => sr.agentResponses);
		const cacheHits = allResponses.filter(r => r.cacheHit).length;
		return allResponses.length > 0 ? cacheHits / allResponses.length : 0;
	}

	private async updateTemplateWithResults(templateId: string, results: any): Promise<void> {
		await db.template.update({
			where: { id: templateId },
			data: {
				// Map results to database fields
				enhanced_content: results.enhancedContent,
				agent_votes: results.consensus.votes,
				consensus_score: results.consensus.confidence,
				verification_status: results.consensus.decision,
				actual_cost: results.totalCost,
				processing_time_ms: results.stageResults.reduce((sum: number, sr: StageResult) => sum + sr.duration, 0),
				reviewed_at: new Date()
			}
		});
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

// Export singleton instance
export const taskOrchestrator = new TaskOrchestrator();