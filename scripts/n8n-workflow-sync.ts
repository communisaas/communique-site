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
	connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }>;
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
function createMultiAgentWorkflow(): N8NWorkflow {
	return {
		name: 'Multi-Agent Template Moderation',
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
				id: 'set_variables',
				name: 'Set Variables',
				type: 'n8n-nodes-base.set',
				typeVersion: 1,
				position: [450, 300],
				parameters: {
					values: {
						string: [
							{
								name: 'templateId',
								value: '={{$json.templateId}}'
							},
							{
								name: 'userId',
								value: '={{$json.userId}}'
							},
							{
								name: 'submissionId',
								value: '=sub_{{Date.now()}}_{{Math.random().toString(36).substring(2)}}'
							}
						]
					}
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
				id: 'openai_moderation',
				name: 'OpenAI Moderation',
				type: '@n8n/n8n-nodes-langchain.openAi',
				typeVersion: 3,
				position: [850, 200],
				parameters: {
					resource: 'moderation',
					text: "={{$node['Get Template'].json.message_body}}",
					options: {}
				}
			},
			{
				id: 'gemini_analysis',
				name: 'Gemini Analysis',
				type: '@n8n/n8n-nodes-langchain.googleGemini',
				typeVersion: 2,
				position: [850, 300],
				parameters: {
					resource: 'text',
					model: 'gemini-1.5-flash',
					prompt:
						'Analyze this civic template for appropriateness. Return ONLY valid JSON in this exact format: {"approved": boolean, "confidence": number, "reasoning": "string"}.\n\nTemplate content:\n{{$node[\'Get Template\'].json.message_body}}',
					options: {
						temperature: 0.2,
						maxTokens: 500,
						systemInstruction:
							'You are a civic engagement expert analyzing templates for democratic participation.'
					}
				}
			},
			{
				id: 'check_consensus',
				name: 'Check Consensus',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [1050, 250],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Multi-agent consensus logic
const openaiResult = $node['OpenAI Moderation'].json;
const geminiResult = $node['Gemini Analysis'].json;

// OpenAI vote (using moderation API)
const openaiVote = {
  agent: 'openai',
  approved: !openaiResult.flagged,
  confidence: openaiResult.flagged ? 0.1 : 0.9,
  reasoning: openaiResult.flagged ? 
    \`Flagged for: \${Object.keys(openaiResult.categories || {}).filter(c => openaiResult.categories[c]).join(', ')}\` :
    'Content appears appropriate'
};

// Parse Gemini response (LangChain node format)
let geminiAnalysis;
try {
  const geminiText = geminiResult.response || geminiResult.text || '{"approved": false, "confidence": 0, "reasoning": "No response"}';
  geminiAnalysis = JSON.parse(geminiText);
} catch (e) {
  geminiAnalysis = { approved: false, confidence: 0, reasoning: "Failed to parse Gemini response" };
}

const geminiVote = {
  agent: 'gemini',
  approved: geminiAnalysis.approved,
  confidence: geminiAnalysis.confidence,
  reasoning: geminiAnalysis.reasoning
};

// Check if we have consensus
const consensus = openaiVote.approved === geminiVote.approved;

// Calculate weighted approval (OpenAI 40%, Gemini 35%, Claude 25% if needed)
const weightedScore = (openaiVote.approved ? 0.4 : 0) + (geminiVote.approved ? 0.35 : 0);

// Prepare output
return {
  json: {
    consensus,
    needsTiebreaker: !consensus,
    votes: [openaiVote, geminiVote],
    consensusType: consensus ? 'unanimous' : 'pending',
    approved: consensus ? openaiVote.approved : null,
    weightedScore,
    templateId: $node['Set Variables'].json.templateId,
    submissionId: $node['Set Variables'].json.submissionId
  }
};`
				}
			},
			{
				id: 'tiebreaker_needed',
				name: 'Tiebreaker Needed?',
				type: 'n8n-nodes-base.if',
				typeVersion: 2,
				position: [1250, 250],
				parameters: {
					conditions: {
						options: {
							caseSensitive: true,
							leftValue: '',
							typeValidation: 'strict'
						},
						conditions: [
							{
								id: 'tiebreaker-condition',
								leftValue: '={{$json.needsTiebreaker}}',
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
				id: 'claude_tiebreaker',
				name: 'Claude Tiebreaker',
				type: '@n8n/n8n-nodes-langchain.anthropic',
				typeVersion: 2,
				position: [1450, 150],
				parameters: {
					resource: 'message',
					model: 'claude-3-5-sonnet-20241022',
					prompt:
						"You are a tiebreaker for content moderation. OpenAI voted: {{$node['Check Consensus'].json.votes[0].approved}} ({{$node['Check Consensus'].json.votes[0].reasoning}}). Gemini voted: {{$node['Check Consensus'].json.votes[1].approved}} ({{$node['Check Consensus'].json.votes[1].reasoning}}). Analyze this civic template and cast the deciding vote. Return ONLY valid JSON in this exact format: {\"approved\": boolean, \"confidence\": number, \"reasoning\": \"string\"}.\n\nTemplate content:\n{{$node['Get Template'].json.message_body}}",
					options: {
						temperature: 0.1,
						maxTokens: 500
					}
				}
			},
			{
				id: 'final_consensus',
				name: 'Final Consensus',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [1650, 250],
				parameters: {
					mode: 'runOnceForAllItems',
					language: 'javaScript',
					jsCode: `// Combine all votes including tiebreaker if needed
const baseVotes = $node['Check Consensus'].json.votes;
const needsTiebreaker = $node['Check Consensus'].json.needsTiebreaker;

let finalApproved = $node['Check Consensus'].json.approved;
let consensusType = $node['Check Consensus'].json.consensusType;
let allVotes = [...baseVotes];

if (needsTiebreaker && $node['Claude Tiebreaker']) {
  const claudeResponse = $node['Claude Tiebreaker'].json;
  
  // Parse Claude response (LangChain node format)
  let claudeAnalysis;
  try {
    const claudeText = claudeResponse.response || claudeResponse.text || '{"approved": false, "confidence": 0, "reasoning": "No response"}';
    claudeAnalysis = JSON.parse(claudeText);
  } catch (e) {
    claudeAnalysis = { approved: false, confidence: 0, reasoning: "Failed to parse Claude response" };
  }
  
  const claudeVote = {
    agent: 'claude',
    approved: claudeAnalysis.approved,
    confidence: claudeAnalysis.confidence,
    reasoning: claudeAnalysis.reasoning
  };
  
  allVotes.push(claudeVote);
  
  // Calculate final weighted score with Claude (25% weight)
  const weightedScore = 
    (allVotes[0].approved ? 0.4 : 0) +  // OpenAI 40%
    (allVotes[1].approved ? 0.35 : 0) + // Gemini 35%
    (claudeVote.approved ? 0.25 : 0);   // Claude 25%
  
  finalApproved = weightedScore >= 0.5;
  consensusType = finalApproved ? 'majority' : 'rejected';
}

// Calculate total cost (estimated)
const totalCost = 0.00105 + (needsTiebreaker ? 0.0004 : 0);

return {
  json: {
    approved: finalApproved,
    consensusType,
    votes: allVotes,
    totalCost,
    severity: finalApproved ? 1 : 10,
    templateId: $node['Check Consensus'].json.templateId,
    submissionId: $node['Check Consensus'].json.submissionId
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
const consensusData = $node['Final Consensus'].json;
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
      totalCost: consensusData.totalCost,
      severity: consensusData.severity
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
				main: [[{ node: 'Set Variables', type: 'main', index: 0 }]]
			},
			'Set Variables': {
				main: [[{ node: 'Get Template', type: 'main', index: 0 }]]
			},
			'Get Template': {
				main: [
					[
						{ node: 'OpenAI Moderation', type: 'main', index: 0 },
						{ node: 'Gemini Analysis', type: 'main', index: 0 }
					]
				]
			},
			'OpenAI Moderation': {
				main: [[{ node: 'Check Consensus', type: 'main', index: 0 }]]
			},
			'Gemini Analysis': {
				main: [[{ node: 'Check Consensus', type: 'main', index: 0 }]]
			},
			'Check Consensus': {
				main: [[{ node: 'Tiebreaker Needed?', type: 'main', index: 0 }]]
			},
			'Tiebreaker Needed?': {
				main: [
					[{ node: 'Claude Tiebreaker', type: 'main', index: 0 }],
					[{ node: 'Final Consensus', type: 'main', index: 0 }]
				]
			},
			'Claude Tiebreaker': {
				main: [[{ node: 'Final Consensus', type: 'main', index: 0 }]]
			},
			'Final Consensus': {
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
async function importWorkflow(workflow: N8NWorkflow): Promise<void> {
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
