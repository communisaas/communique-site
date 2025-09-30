#!/usr/bin/env tsx
/**
 * N8N Workflow Management Script
 *
 * Manages workflows on our N8N instance:
 * - Export existing workflows for backup
 * - Clear all workflows
 * - Import new multi-agent consensus workflow
 */

import { config } from 'dotenv';

// Load environment variables
config();

const N8N_URL =
	process.env.N8N_INSTANCE_URL || process.env.FLYIO_N8N_URL || 'https://voter-n8n.fly.dev';
const N8N_API_KEY = process.env.N8N_API_KEY || process.env.FLYIO_N8N_API_KEY;
const N8N_AUTH_USER = process.env.N8N_BASIC_AUTH_USER || 'admin';
const N8N_AUTH_PASSWORD = process.env.N8N_BASIC_AUTH_PASSWORD;

if (!N8N_API_KEY && !N8N_AUTH_PASSWORD) {
	console.error('❌ Error: N8N_API_KEY or N8N_AUTH_PASSWORD required');
	process.exit(1);
}

// Create auth header - N8N uses X-N8N-API-KEY header
const authHeaders: Record<string, string> = N8N_API_KEY
	? { 'X-N8N-API-KEY': N8N_API_KEY }
	: {
			Authorization: `Basic ${Buffer.from(`${N8N_AUTH_USER}:${N8N_AUTH_PASSWORD}`).toString('base64')}`
		};

interface N8NWorkflow {
	id: string;
	name: string;
	active: boolean;
	nodes: Array<{
		id: string;
		name: string;
		type: string;
		typeVersion: number;
		position: [number, number];
		parameters: Record<string, unknown>;
	}>;
	connections: Record<
		string,
		{ main: Array<Array<{ node: string; type: string; index: number }>> }
	>;
	createdAt: string;
	updatedAt: string;
}

/**
 * Fetch all workflows from N8N
 */
async function getWorkflows(): Promise<N8NWorkflow[]> {
	try {
		const response = await fetch(`${N8N_URL}/api/v1/workflows`, {
			headers: {
				...authHeaders,
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch workflows: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		return data.data || [];
	} catch (error) {
		console.error('❌ Error fetching workflows:', error);
		throw error;
	}
}

/**
 * Delete a single workflow
 */
async function deleteWorkflow(id: string): Promise<void> {
	const response = await fetch(`${N8N_URL}/api/v1/workflows/${id}`, {
		method: 'DELETE',
		headers: authHeaders
	});

	if (!response.ok) {
		throw new Error(`Failed to delete workflow ${id}: ${response.status}`);
	}
}

/**
 * Clear all workflows from N8N
 */
async function clearAllWorkflows(): Promise<void> {
	console.log('🗑️  Clearing all workflows...');

	const workflows = await getWorkflows();

	if (workflows.length === 0) {
		console.log('📭 No workflows to clear');
		return;
	}

	for (const workflow of workflows) {
		console.log(`  Deleting: ${workflow.name} (${workflow.id})`);
		await deleteWorkflow(workflow.id);
	}

	console.log(`✅ Deleted ${workflows.length} workflows`);
}

/**
 * Create the new multi-agent consensus workflow
 * Uses N8N's native AI nodes instead of callbacks to Communique
 */
function createMultiAgentWorkflow(): Omit<N8NWorkflow, 'id' | 'createdAt' | 'updatedAt' | 'active'> {
	return {
		name: 'Multi-LLM Consensus Moderation',
		settings: {
			executionOrder: 'v1'
		},
		nodes: [
			{
				id: 'webhook_trigger',
				name: 'Webhook Trigger',
				type: 'n8n-nodes-base.webhook',
				typeVersion: 1,
				position: [250, 300],
				parameters: {
					path: 'template-moderation',
					responseMode: 'responseNode',
					options: {}
				}
			},
			{
				id: 'route_detection',
				name: 'Route Detection',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [450, 300],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Detect delivery route from template deliveryMethod
const templateId = $json.templateId;
const userId = $json.userId;
const template = $json.template || {};

// Use the template's deliveryMethod to determine route
const deliveryMethod = template.deliveryMethod || template.delivery_method || '';
const isCongressional = deliveryMethod === 'cwc';

const routeType = isCongressional ? 'congressional' : 'direct_outreach';

// Estimate token length for cost optimization
const messageBody = template.message_body || template.body || '';
const estimatedTokens = Math.ceil(messageBody.length / 4); // Rough estimate: 4 chars per token

return {
  json: {
    templateId,
    userId,
    routeType,
    deliveryMethod,
    estimatedTokens,
    template: $json.template,
    recipients: $json.recipients || [],
    submissionId: \`sub_\${Date.now()}_\${Math.random().toString(36).substring(2)}\`
  }
};`
				}
			},
			{
				id: 'get_template',
				name: 'Get Template',
				type: 'n8n-nodes-base.httpRequest',
				typeVersion: 3,
				position: [650, 300],
				parameters: {
					method: 'GET',
					url: "={{$env.COMMUNIQUE_API_URL}}/api/templates/{{$node['Set Variables'].json.templateId}}",
					authentication: 'genericCredentialType',
					genericAuthType: 'httpHeaderAuth',
					sendHeaders: true,
					headerParameters: {
						parameters: [
							{
								name: 'x-webhook-secret',
								value: '={{$env.N8N_WEBHOOK_SECRET}}'
							}
						]
					},
					options: {
						timeout: 5000
					}
				}
			},
			{
				id: 'gemini_safety_triage',
				name: 'Gemini Safety Triage',
				type: '@n8n/n8n-nodes-langchain.googleGemini',
				typeVersion: 1,
				position: [650, 300],
				parameters: {
					modelId: {
						__rl: true,
						mode: 'list',
						value: 'gemini-2.5-flash'
					},
					messages: {
						values: [
							{
								role: 'user',
								content:
									"You are a safety triage system. Quickly assess this template for obvious violations.\n\nTemplate: {{$node['Get Template'].json.message_body}}\nRoute: {{$node['Route Detection'].json.routeType}}\n\nRate ONLY:\n- threat_level: 0-10 (0=safe, 10=clear threat)\n- violation_type: none|threat|harassment|doxxing|spam\n- safety_status: SAFE|REVIEW|BLOCK"
							}
						]
					},
					options: {
						temperature: 0.1,
						maxTokens: 200
					}
				}
			},
			{
				id: 'parse_gemini_safety',
				name: 'Parse Gemini Safety',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [850, 300],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Parse Gemini safety response
const response = $node['Gemini Safety Triage'].json.response || $node['Gemini Safety Triage'].json.text || '';

// Extract structured data using regex patterns
const threatMatch = response.match(/threat_level:\\s*(\\d+)/i);
const violationMatch = response.match(/violation_type:\\s*(\\w+)/i);
const statusMatch = response.match(/safety_status:\\s*(\\w+)/i);

const threat_level = threatMatch ? parseInt(threatMatch[1]) : 0;
const violation_type = violationMatch ? violationMatch[1].toLowerCase() : 'none';
const safety_status = statusMatch ? statusMatch[1].toUpperCase() : 'SAFE';

return {
  json: {
    threat_level,
    violation_type,
    safety_status,
    raw_response: response
  }
};`
				}
			},
			{
				id: 'safety_decision',
				name: 'Safety Decision',
				type: 'n8n-nodes-base.if',
				typeVersion: 2,
				position: [1050, 300],
				parameters: {
					conditions: {
						options: {
							caseSensitive: true,
							leftValue: '',
							typeValidation: 'strict'
						},
						conditions: [
							{
								id: 'safety-condition',
								leftValue: "={{$node['Parse Gemini Safety'].json.safety_status}}",
								rightValue: 'SAFE',
								operator: {
									type: 'string',
									operation: 'equals'
								}
							}
						],
						combinator: 'and'
					}
				}
			},
			{
				id: 'gpt5_contextual_analysis',
				name: 'GPT-5 Contextual Analysis',
				type: '@n8n/n8n-nodes-langchain.openAi',
				typeVersion: 1,
				position: [1250, 200],
				parameters: {
					modelId: {
						__rl: true,
						mode: 'list',
						value: 'gpt-5'
					},
					messages: {
						values: [
							{
								role: 'user',
								content:
									"You are an expert in nuanced content analysis. Analyze this template for sophisticated judgment.\n\nTemplate: {{$node['Get Template'].json.message_body}}\nRoute: {{$node['Route Detection'].json.routeType}}\nSafety Assessment: {{$node['Parse Gemini Safety'].json}}\n\nProvide nuanced analysis:\n- intent_assessment: legitimate|borderline|problematic\n- context_appropriateness: appropriate|needs_review|inappropriate\n- democratic_value: high|medium|low|none\n- recommendation: approve|review|block"
							}
						]
					},
					options: {
						temperature: 0.2,
						maxTokens: 400
					}
				}
			},
			{
				id: 'parse_gpt5_analysis',
				name: 'Parse GPT-5 Analysis',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [1450, 200],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Parse GPT-5 analysis response
const response = $node['GPT-5 Contextual Analysis'].json.response || $node['GPT-5 Contextual Analysis'].json.text || '';

// Extract structured data using regex patterns
const intentMatch = response.match(/intent_assessment:\\s*(\\w+)/i);
const contextMatch = response.match(/context_appropriateness:\\s*(\\w+)/i);
const valueMatch = response.match(/democratic_value:\\s*(\\w+)/i);
const recommendationMatch = response.match(/recommendation:\\s*(\\w+)/i);

const intent_assessment = intentMatch ? intentMatch[1].toLowerCase() : 'legitimate';
const context_appropriateness = contextMatch ? contextMatch[1].toLowerCase() : 'appropriate';
const democratic_value = valueMatch ? valueMatch[1].toLowerCase() : 'medium';
const recommendation = recommendationMatch ? recommendationMatch[1].toLowerCase() : 'approve';

return {
  json: {
    intent_assessment,
    context_appropriateness,
    democratic_value,
    recommendation,
    raw_response: response
  }
};`
				}
			},
			{
				id: 'route_check',
				name: 'Route Check',
				type: 'n8n-nodes-base.if',
				typeVersion: 2,
				position: [1650, 200],
				parameters: {
					conditions: {
						options: {
							caseSensitive: true,
							leftValue: '',
							typeValidation: 'strict'
						},
						conditions: [
							{
								id: 'route-condition',
								leftValue: "={{$node['Route Detection'].json.routeType}}",
								rightValue: 'direct_outreach',
								operator: {
									type: 'string',
									operation: 'equals'
								}
							}
						],
						combinator: 'and'
					}
				}
			},
			{
				id: 'claude_quality_analysis',
				name: 'Claude Quality Analysis',
				type: '@n8n/n8n-nodes-langchain.anthropic',
				typeVersion: 1,
				position: [1850, 100],
				parameters: {
					modelId: {
						__rl: true,
						mode: 'list',
						value: 'claude-sonnet-4.5'
					},
					messages: {
						values: [
							{
								role: 'user',
								content:
									"You are a professional communication expert. Assess this template for professional standards and credibility.\n\nTemplate: {{$node['Get Template'].json.message_body}}\nRoute: {{$node['Route Detection'].json.routeType}}\nGPT-5 Analysis: {{$node['Parse GPT-5 Analysis'].json}}\n\nEvaluate:\n- professional_tone: excellent|good|needs_improvement|poor\n- grammar_quality: excellent|good|needs_improvement|poor\n- stakeholder_credibility: high|medium|low\n- grammar_corrections: [list of specific corrections needed]\n- final_recommendation: approve|approve_with_edits|reject"
							}
						]
					},
					options: {
						temperature: 0.1,
						maxTokens: 500
					}
				}
			},
			{
				id: 'parse_claude_quality',
				name: 'Parse Claude Quality',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [2050, 100],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Parse Claude quality response
const response = $node['Claude Quality Analysis'].json.response || $node['Claude Quality Analysis'].json.text || '';

// Extract structured data using regex patterns
const toneMatch = response.match(/professional_tone:\\s*(\\w+)/i);
const grammarMatch = response.match(/grammar_quality:\\s*(\\w+)/i);
const credibilityMatch = response.match(/stakeholder_credibility:\\s*(\\w+)/i);
const recommendationMatch = response.match(/final_recommendation:\\s*(\\w+(?:_\\w+)*)/i);

// Extract grammar corrections if present
const correctionsMatch = response.match(/grammar_corrections:\\s*\\[([^\\]]*)\\]/i);
const grammar_corrections = correctionsMatch ? 
  correctionsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')) : [];

const professional_tone = toneMatch ? toneMatch[1].toLowerCase() : 'good';
const grammar_quality = grammarMatch ? grammarMatch[1].toLowerCase() : 'good';
const stakeholder_credibility = credibilityMatch ? credibilityMatch[1].toLowerCase() : 'medium';
const final_recommendation = recommendationMatch ? recommendationMatch[1].toLowerCase() : 'approve';

return {
  json: {
    professional_tone,
    grammar_quality,
    stakeholder_credibility,
    grammar_corrections,
    final_recommendation,
    raw_response: response
  }
};`
				}
			},
			{
				id: 'consensus_decision',
				name: 'Consensus Decision',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [1850, 300],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Multi-LLM consensus logic
const routeType = $node['Route Detection'].json.routeType;
const geminiSafety = $node['Parse Gemini Safety'].json;
const gpt5Analysis = $node['Parse GPT-5 Analysis'].json;

// Base decision from Gemini + GPT-5
let finalDecision = 'approve';
let reasoning = [];
let approved = true;

// Check safety first
if (geminiSafety.safety_status === 'BLOCK') {
  finalDecision = 'block';
  approved = false;
  reasoning.push(\`Safety violation: \${geminiSafety.violation_type}\`);
}

// Check GPT-5 recommendation
if (gpt5Analysis.recommendation === 'block') {
  finalDecision = 'block';
  approved = false;
  reasoning.push('GPT-5 recommends blocking due to content issues');
} else if (gpt5Analysis.recommendation === 'review') {
  // For review cases, err on side of caution
  finalDecision = 'block';
  approved = false;
  reasoning.push('GPT-5 flagged for review - blocking to be safe');
}

// For direct route, check Claude quality assessment
if (routeType === 'direct_outreach' && $node['Parse Claude Quality']) {
  const claudeQuality = $node['Parse Claude Quality'].json;
  
  if (claudeQuality.final_recommendation === 'reject') {
    finalDecision = 'block';
    approved = false;
    reasoning.push('Claude recommends rejection due to quality/professional issues');
  } else if (claudeQuality.final_recommendation === 'approve_with_edits') {
    finalDecision = 'approve_with_edits';
    reasoning.push('Claude recommends approval with grammar corrections');
  }
}

// Default to approval if no blocks
if (reasoning.length === 0) {
  reasoning.push('All AI agents approve the template');
}

// Prepare comprehensive output
return {
  json: {
    approved,
    finalDecision,
    routeType,
    reasoning: reasoning.join('; '),
    safetyAssessment: geminiSafety,
    contextualAnalysis: gpt5Analysis,
    qualityAnalysis: routeType === 'direct_outreach' ? ($node['Parse Claude Quality']?.json || null) : null,
    templateId: $node['Route Detection'].json.templateId,
    submissionId: $node['Route Detection'].json.submissionId,
    estimatedCost: routeType === 'congressional' ? 0.006 : 0.015, // Rough cost estimate
    consensusType: approved ? 'approved' : 'rejected',
    votes: [
      {
        agent: 'gemini',
        approved: geminiSafety.safety_status === 'SAFE',
        reasoning: \`Safety assessment: \${geminiSafety.safety_status}\`
      },
      {
        agent: 'gpt5',
        approved: gpt5Analysis.recommendation === 'approve',
        reasoning: \`Contextual analysis: \${gpt5Analysis.recommendation}\`
      }
    ]
  }
};`
				}
			},
			{
				id: 'check_approval',
				name: 'Check Approval',
				type: 'n8n-nodes-base.if',
				typeVersion: 2,
				position: [1850, 250],
				parameters: {
					conditions: {
						options: {
							caseSensitive: true,
							leftValue: '',
							typeValidation: 'strict'
						},
						conditions: [
							{
								id: 'approval-condition',
								leftValue: '={{$json.approved}}',
								rightValue: true,
								operator: {
									type: 'boolean',
									operation: 'equals'
								}
							}
						],
						combinator: 'and'
					}
				}
			},
			{
				id: 'cwc_submit_async',
				name: 'Submit to CWC (Async)',
				type: 'n8n-nodes-base.httpRequest',
				typeVersion: 3,
				position: [2050, 150],
				parameters: {
					method: 'POST',
					url: '={{$env.COMMUNIQUE_API_URL}}/api/cwc/submit',
					authentication: 'genericCredentialType',
					genericAuthType: 'httpHeaderAuth',
					sendHeaders: true,
					headerParameters: {
						parameters: [
							{
								name: 'x-webhook-secret',
								value: '={{$env.N8N_WEBHOOK_SECRET}}'
							},
							{
								name: 'Content-Type',
								value: 'application/json'
							}
						]
					},
					sendBody: true,
					contentType: 'json',
					jsonParameters: {
						parameters: [
							{
								name: 'templateId',
								value: "={{$node['Final Consensus'].json.templateId}}"
							},
							{
								name: 'userId',
								value: "={{$node['Set Variables'].json.userId}}"
							},
							{
								name: 'template',
								value: "={{$node['Get Template'].json}}"
							},
							{
								name: 'user',
								value:
									"={{$json.user || { id: $node['Set Variables'].json.userId, name: 'N8N User', email: 'user@example.com' }}}"
							}
						]
					},
					options: {
						timeout: 30000
					}
				}
			},
			{
				id: 'wait_initial',
				name: 'Wait 5 seconds',
				type: 'n8n-nodes-base.wait',
				typeVersion: 1,
				position: [2250, 150],
				parameters: {
					resume: 'timeInterval',
					amount: 5,
					unit: 'seconds'
				}
			},
			{
				id: 'poll_job_status',
				name: 'Poll Job Status',
				type: 'n8n-nodes-base.httpRequest',
				typeVersion: 3,
				position: [2450, 150],
				parameters: {
					method: 'GET',
					url: "={{$env.COMMUNIQUE_API_URL}}/api/cwc/jobs/{{$node['Submit to CWC (Async)'].json.jobId}}",
					authentication: 'genericCredentialType',
					genericAuthType: 'httpHeaderAuth',
					sendHeaders: true,
					headerParameters: {
						parameters: [
							{
								name: 'x-webhook-secret',
								value: '={{$env.N8N_WEBHOOK_SECRET}}'
							}
						]
					},
					options: {
						timeout: 10000
					}
				}
			},
			{
				id: 'check_job_complete',
				name: 'Job Complete?',
				type: 'n8n-nodes-base.if',
				typeVersion: 2,
				position: [2650, 150],
				parameters: {
					conditions: {
						options: {
							caseSensitive: true,
							leftValue: '',
							typeValidation: 'strict'
						},
						conditions: [
							{
								id: 'not-queued-condition',
								leftValue: '={{$json.status}}',
								rightValue: 'queued',
								operator: {
									type: 'string',
									operation: 'notEquals'
								}
							},
							{
								id: 'not-processing-condition',
								leftValue: '={{$json.status}}',
								rightValue: 'processing',
								operator: {
									type: 'string',
									operation: 'notEquals'
								}
							}
						],
						combinator: 'and'
					}
				}
			},
			{
				id: 'wait_retry',
				name: 'Wait 3 seconds',
				type: 'n8n-nodes-base.wait',
				typeVersion: 1,
				position: [2850, 250],
				parameters: {
					resume: 'timeInterval',
					amount: 3,
					unit: 'seconds'
				}
			},
			{
				id: 'check_timeout',
				name: 'Check Timeout',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [3050, 250],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Check if we've been polling too long (max 5 minutes)
const startTime = $node['Submit to CWC (Async)'].json.timestamp;
const currentTime = new Date().toISOString();
const elapsedMs = new Date(currentTime).getTime() - new Date(startTime).getTime();
const maxTimeoutMs = 5 * 60 * 1000; // 5 minutes

if (elapsedMs > maxTimeoutMs) {
  throw new Error('Job status polling timeout after 5 minutes');
}

// Continue polling
return $input.all();`
				}
			},
			{
				id: 'format_response',
				name: 'Format Response',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [2850, 150],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Format the final response with all consensus and async job data
const consensusData = $node['Consensus Decision'].json;
const cwcAsyncResult = $node['Submit to CWC (Async)'] ? $node['Submit to CWC (Async)'].json : null;
const jobStatusResult = $node['Poll Job Status'] ? $node['Poll Job Status'].json : null;

// Determine overall success
const moderationApproved = consensusData.approved;
const cwcSubmitted = cwcAsyncResult && cwcAsyncResult.success && cwcAsyncResult.queuedSubmissions > 0;
const jobCompleted = jobStatusResult && (jobStatusResult.status === 'completed' || jobStatusResult.status === 'partial');

return {
  json: {
    success: moderationApproved && (cwcSubmitted || !moderationApproved),
    submissionId: consensusData.submissionId,
    templateId: consensusData.templateId,
    moderation: {
      approved: consensusData.approved,
      consensusType: consensusData.consensusType,
      votes: consensusData.votes,
      estimatedCost: consensusData.estimatedCost,
      reasoning: consensusData.reasoning,
      finalDecision: consensusData.finalDecision,
      routeType: consensusData.routeType
    },
    cwc: {
      submitted: cwcSubmitted,
      jobId: cwcAsyncResult?.jobId,
      queuedSubmissions: cwcAsyncResult?.queuedSubmissions || 0,
      jobStatus: jobStatusResult?.status,
      submissionCount: jobStatusResult?.submissionCount || 0,
      completedSubmissions: jobStatusResult?.submissions ? jobStatusResult.submissions.filter(s => s.status === 'submitted').length : 0,
      rateLimited: cwcAsyncResult?.rateLimitedRecipients || [],
      duplicates: cwcAsyncResult?.duplicateSubmissions || [],
      errors: cwcAsyncResult?.errors || [],
      reason: !moderationApproved ? 'Template not approved by consensus' : 
              !cwcSubmitted ? 'Failed to queue CWC submissions' :
              !jobCompleted ? 'Job still processing' : 'Success'
    },
    timing: {
      moderationCompleted: new Date().toISOString(),
      cwcQueued: cwcAsyncResult?.timestamp,
      jobStarted: jobStatusResult?.createdAt,
      jobCompleted: jobStatusResult?.completedAt
    }
  }
};`
				}
			},
			{
				id: 'respond',
				name: 'Respond to Webhook',
				type: 'n8n-nodes-base.respondToWebhook',
				typeVersion: 1,
				position: [1450, 300],
				parameters: {
					responseMode: 'lastNode',
					responseCode: 200
				}
			}
		],
		connections: {
			'Webhook Trigger': {
				main: [[{ node: 'Route Detection', type: 'main', index: 0 }]]
			},
			'Route Detection': {
				main: [[{ node: 'Get Template', type: 'main', index: 0 }]]
			},
			'Get Template': {
				main: [[{ node: 'Gemini Safety Triage', type: 'main', index: 0 }]]
			},
			'Gemini Safety Triage': {
				main: [[{ node: 'Parse Gemini Safety', type: 'main', index: 0 }]]
			},
			'Parse Gemini Safety': {
				main: [[{ node: 'Safety Decision', type: 'main', index: 0 }]]
			},
			'Safety Decision': {
				main: [
					[{ node: 'GPT-5 Contextual Analysis', type: 'main', index: 0 }],
					[{ node: 'Format Response', type: 'main', index: 0 }]
				]
			},
			'GPT-5 Contextual Analysis': {
				main: [[{ node: 'Parse GPT-5 Analysis', type: 'main', index: 0 }]]
			},
			'Parse GPT-5 Analysis': {
				main: [[{ node: 'Route Check', type: 'main', index: 0 }]]
			},
			'Route Check': {
				main: [
					[{ node: 'Claude Quality Analysis', type: 'main', index: 0 }],
					[{ node: 'Consensus Decision', type: 'main', index: 0 }]
				]
			},
			'Claude Quality Analysis': {
				main: [[{ node: 'Parse Claude Quality', type: 'main', index: 0 }]]
			},
			'Parse Claude Quality': {
				main: [[{ node: 'Consensus Decision', type: 'main', index: 0 }]]
			},
			'Consensus Decision': {
				main: [[{ node: 'Check Approval', type: 'main', index: 0 }]]
			},
			'Check Approval': {
				main: [
					[{ node: 'Submit to CWC (Async)', type: 'main', index: 0 }],
					[{ node: 'Format Response', type: 'main', index: 0 }]
				]
			},
			'Submit to CWC (Async)': {
				main: [[{ node: 'Wait 5 seconds', type: 'main', index: 0 }]]
			},
			'Wait 5 seconds': {
				main: [[{ node: 'Poll Job Status', type: 'main', index: 0 }]]
			},
			'Poll Job Status': {
				main: [[{ node: 'Job Complete?', type: 'main', index: 0 }]]
			},
			'Job Complete?': {
				main: [
					[{ node: 'Format Response', type: 'main', index: 0 }],
					[{ node: 'Wait 3 seconds', type: 'main', index: 0 }]
				]
			},
			'Wait 3 seconds': {
				main: [[{ node: 'Check Timeout', type: 'main', index: 0 }]]
			},
			'Check Timeout': {
				main: [[{ node: 'Poll Job Status', type: 'main', index: 0 }]]
			},
			'Format Response': {
				main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]]
			}
		}
	};
}

/**
 * Import a workflow to N8N
 */
async function importWorkflow(workflow: Omit<N8NWorkflow, 'id' | 'createdAt' | 'updatedAt' | 'active'>): Promise<void> {
	const response = await fetch(`${N8N_URL}/api/v1/workflows`, {
		method: 'POST',
		headers: {
			...authHeaders,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(workflow)
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to import workflow: ${response.status} - ${error}`);
	}

	const created = await response.json();
	console.log(`✅ Created workflow: ${created.name} (ID: ${created.id})`);
}

/**
 * Main execution
 */
async function main() {
	console.log('🚀 N8N Workflow Sync');
	console.log(`📍 Instance: ${N8N_URL}`);
	console.log('');

	const command = process.argv[2];

	try {
		switch (command) {
			case 'clear':
				await clearAllWorkflows();
				break;

			case 'sync': {
				console.log('🔄 Full sync: clear and deploy new workflow');
				await clearAllWorkflows();
				console.log('');
				console.log('📝 Creating new multi-agent workflow...');
				const workflow = createMultiAgentWorkflow();
				await importWorkflow(workflow);
				console.log('');
				console.log('✨ Sync complete!');
				break;
			}

			case 'list': {
				const workflows = await getWorkflows();
				console.log(`📋 Found ${workflows.length} workflows:`);
				workflows.forEach((w) => {
					console.log(`  - ${w.name} (${w.id}) ${w.active ? '✅ Active' : '⏸️  Inactive'}`);
				});
				break;
			}

			default:
				console.log('Usage: tsx scripts/n8n-workflow-sync.ts <command>');
				console.log('');
				console.log('Commands:');
				console.log('  list    - List all workflows');
				console.log('  clear   - Clear all workflows');
				console.log('  sync    - Full sync (clear and deploy new workflow)');
				process.exit(1);
		}
	} catch (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	}
}

// Run if called directly
main();
