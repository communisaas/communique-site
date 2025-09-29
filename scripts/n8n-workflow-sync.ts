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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

const N8N_URL = process.env.N8N_INSTANCE_URL || process.env.FLYIO_N8N_URL || 'https://voter-n8n.fly.dev';
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
	: { 'Authorization': `Basic ${Buffer.from(`${N8N_AUTH_USER}:${N8N_AUTH_PASSWORD}`).toString('base64')}` };

interface N8NWorkflow {
	id: string;
	name: string;
	active: boolean;
	nodes: any[];
	connections: any;
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
				'Accept': 'application/json'
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
 * Export workflows to backup file
 */
async function exportWorkflows(): Promise<void> {
	console.log('📦 Exporting existing workflows...');
	
	const workflows = await getWorkflows();
	
	if (workflows.length === 0) {
		console.log('📭 No workflows to export');
		return;
	}

	// Create backups directory
	const backupDir = join(process.cwd(), 'n8n-backups');
	if (!existsSync(backupDir)) {
		mkdirSync(backupDir);
	}

	// Save backup with timestamp
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupFile = join(backupDir, `workflows-backup-${timestamp}.json`);
	
	writeFileSync(backupFile, JSON.stringify(workflows, null, 2));
	console.log(`✅ Exported ${workflows.length} workflows to ${backupFile}`);
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
function createMultiAgentWorkflow(): any {
	return {
		name: "Multi-Agent Template Moderation",
		settings: {
			executionOrder: "v1"
		},
		nodes: [
			{
				id: "webhook_trigger",
				name: "Webhook Trigger",
				type: "n8n-nodes-base.webhook",
				typeVersion: 1,
				position: [250, 300],
				parameters: {
					path: "template-moderation",
					responseMode: "responseNode",
					options: {}
				}
			},
			{
				id: "set_variables",
				name: "Set Variables",
				type: "n8n-nodes-base.set",
				typeVersion: 1,
				position: [450, 300],
				parameters: {
					values: {
						string: [
							{
								name: "templateId",
								value: "={{$json.templateId}}"
							},
							{
								name: "userId",
								value: "={{$json.userId}}"
							},
							{
								name: "submissionId",
								value: "=sub_{{Date.now()}}_{{Math.random().toString(36).substring(2)}}"
							}
						]
					}
				}
			},
			{
				id: "get_template",
				name: "Get Template",
				type: "n8n-nodes-base.httpRequest",
				typeVersion: 3,
				position: [650, 300],
				parameters: {
					method: "GET",
					url: "={{$env.COMMUNIQUE_API_URL}}/api/templates/{{$node['Set Variables'].json.templateId}}",
					authentication: "genericCredentialType",
					genericAuthType: "httpHeaderAuth",
					sendHeaders: true,
					headerParameters: {
						parameters: [
							{
								name: "x-webhook-secret",
								value: "={{$env.N8N_WEBHOOK_SECRET}}"
							}
						]
					},
					options: {
						timeout: 5000
					}
				}
			},
			{
				id: "openai_moderation",
				name: "OpenAI Moderation",
				type: "n8n-nodes-base.openAi",
				typeVersion: 1,
				position: [850, 200],
				parameters: {
					resource: "text",
					operation: "moderate",
					input: "={{$node['Get Template'].json.message_body}}"
				}
			},
			{
				id: "gemini_analysis", 
				name: "Gemini Analysis",
				type: "n8n-nodes-base.httpRequest",
				typeVersion: 3,
				position: [850, 300],
				parameters: {
					method: "POST",
					url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
					authentication: "genericCredentialType",
					genericAuthType: "httpQueryAuth",
					sendQuery: true,
					queryParameters: {
						parameters: [
							{
								name: "key",
								value: "={{$env.GEMINI_API_KEY}}"
							}
						]
					},
					sendHeaders: true,
					headerParameters: {
						parameters: [
							{
								name: "Content-Type",
								value: "application/json"
							}
						]
					},
					sendBody: true,
					jsonBody: `{
						"contents": [
							{
								"parts": [
									{
										"text": "Analyze this civic template for appropriateness. Return JSON with {approved: boolean, confidence: number, reasoning: string}:\\n\\n{{$node['Get Template'].json.message_body}}"
									}
								]
							}
						],
						"generationConfig": {
							"temperature": 0.2,
							"maxOutputTokens": 500
						}
					}`
				}
			},
			{
				id: "check_consensus",
				name: "Check Consensus",
				type: "n8n-nodes-base.code",
				typeVersion: 2,
				position: [1050, 250],
				parameters: {
					mode: "runOnceForAllItems",
					language: "javaScript",
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

// Parse Gemini response
let geminiAnalysis;
try {
  const geminiText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '{"approved": false, "confidence": 0, "reasoning": "No response"}';
  geminiAnalysis = JSON.parse(geminiText);
} catch (e) {
  geminiAnalysis = { approved: false, confidence: 0, reasoning: "Failed to parse response" };
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
				id: "tiebreaker_needed",
				name: "Tiebreaker Needed?",
				type: "n8n-nodes-base.if",
				typeVersion: 1,
				position: [1250, 250],
				parameters: {
					conditions: {
						boolean: [
							{
								value1: "={{$json.needsTiebreaker}}",
								value2: true
							}
						]
					}
				}
			},
			{
				id: "claude_tiebreaker",
				name: "Claude Tiebreaker",
				type: "n8n-nodes-base.httpRequest",
				typeVersion: 3,
				position: [1450, 150],
				parameters: {
					method: "POST",
					url: "https://api.anthropic.com/v1/messages",
					authentication: "genericCredentialType",
					genericAuthType: "httpHeaderAuth",
					sendHeaders: true,
					headerParameters: {
						parameters: [
							{
								name: "x-api-key",
								value: "={{$env.ANTHROPIC_API_KEY}}"
							},
							{
								name: "anthropic-version",
								value: "2023-06-01"
							},
							{
								name: "Content-Type",
								value: "application/json"
							}
						]
					},
					sendBody: true,
					jsonBody: `{
						"model": "claude-3-haiku-20240307",
						"max_tokens": 500,
						"temperature": 0.1,
						"messages": [
							{
								"role": "user",
								"content": "You are a tiebreaker for content moderation. OpenAI voted: {{$node['Check Consensus'].json.votes[0].approved}} ({{$node['Check Consensus'].json.votes[0].reasoning}}). Gemini voted: {{$node['Check Consensus'].json.votes[1].approved}} ({{$node['Check Consensus'].json.votes[1].reasoning}}). Analyze this civic template and cast the deciding vote. Return JSON with {approved: boolean, confidence: number, reasoning: string}:\\n\\n{{$node['Get Template'].json.message_body}}"
							}
						]
					}`
				}
			},
			{
				id: "final_consensus",
				name: "Final Consensus",
				type: "n8n-nodes-base.code",
				typeVersion: 2,
				position: [1650, 250],
				parameters: {
					mode: "runOnceForAllItems",
					language: "javaScript",
					jsCode: `// Combine all votes including tiebreaker if needed
const baseVotes = $node['Check Consensus'].json.votes;
const needsTiebreaker = $node['Check Consensus'].json.needsTiebreaker;

let finalApproved = $node['Check Consensus'].json.approved;
let consensusType = $node['Check Consensus'].json.consensusType;
let allVotes = [...baseVotes];

if (needsTiebreaker && $node['Claude Tiebreaker']) {
  const claudeResponse = $node['Claude Tiebreaker'].json;
  
  // Parse Claude response
  let claudeAnalysis;
  try {
    const claudeText = claudeResponse.content?.[0]?.text || '{"approved": false, "confidence": 0, "reasoning": "No response"}';
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
				id: "check_approval",
				name: "Check Approval",
				type: "n8n-nodes-base.if",
				typeVersion: 1,
				position: [1850, 250],
				parameters: {
					conditions: {
						boolean: [
							{
								value1: "={{$json.approved}}",
								value2: true
							}
						]
					}
				}
			},
			{
				id: "cwc_submit",
				name: "Submit to CWC",
				type: "n8n-nodes-base.httpRequest",
				typeVersion: 3,
				position: [2050, 150],
				parameters: {
					method: "POST",
					url: "={{$env.COMMUNIQUE_API_URL}}/api/cwc/submit",
					authentication: "genericCredentialType",
					genericAuthType: "httpHeaderAuth",
					sendHeaders: true,
					headerParameters: {
						parameters: [
							{
								name: "x-webhook-secret",
								value: "={{$env.N8N_WEBHOOK_SECRET}}"
							}
						]
					},
					sendBody: true,
					bodyParameters: {
						parameters: [
							{
								name: "templateId",
								value: "={{$node['Final Consensus'].json.templateId}}"
							},
							{
								name: "submissionId",
								value: "={{$node['Final Consensus'].json.submissionId}}"
							}
						]
					}
				}
			},
			{
				id: "format_response",
				name: "Format Response",
				type: "n8n-nodes-base.code",
				typeVersion: 2,
				position: [2250, 250],
				parameters: {
					mode: "runOnceForAllItems",
					language: "javaScript",
					jsCode: `// Format the final response with all consensus data
const consensusData = $node['Final Consensus'].json;
const cwcResult = $node['Submit to CWC'] ? $node['Submit to CWC'].json : null;

return {
  json: {
    success: true,
    submissionId: consensusData.submissionId,
    templateId: consensusData.templateId,
    moderation: {
      approved: consensusData.approved,
      consensusType: consensusData.consensusType,
      votes: consensusData.votes,
      totalCost: consensusData.totalCost,
      severity: consensusData.severity
    },
    cwc: cwcResult ? {
      submitted: true,
      response: cwcResult
    } : {
      submitted: false,
      reason: consensusData.approved ? 'Not submitted yet' : 'Template not approved'
    }
  }
};`
				}
			},
			{
				id: "respond",
				name: "Respond to Webhook",
				type: "n8n-nodes-base.respondToWebhook",
				typeVersion: 1,
				position: [1450, 300],
				parameters: {
					responseMode: "lastNode",
					responseCode: 200
				}
			}
		],
		connections: {
			"Webhook Trigger": {
				"main": [
					[{ "node": "Set Variables", "type": "main", "index": 0 }]
				]
			},
			"Set Variables": {
				"main": [
					[{ "node": "Get Template", "type": "main", "index": 0 }]
				]
			},
			"Get Template": {
				"main": [
					[
						{ "node": "OpenAI Moderation", "type": "main", "index": 0 },
						{ "node": "Gemini Analysis", "type": "main", "index": 0 }
					]
				]
			},
			"OpenAI Moderation": {
				"main": [
					[{ "node": "Check Consensus", "type": "main", "index": 0 }]
				]
			},
			"Gemini Analysis": {
				"main": [
					[{ "node": "Check Consensus", "type": "main", "index": 0 }]
				]
			},
			"Check Consensus": {
				"main": [
					[{ "node": "Tiebreaker Needed?", "type": "main", "index": 0 }]
				]
			},
			"Tiebreaker Needed?": {
				"main": [
					[{ "node": "Claude Tiebreaker", "type": "main", "index": 0 }],
					[{ "node": "Final Consensus", "type": "main", "index": 0 }]
				]
			},
			"Claude Tiebreaker": {
				"main": [
					[{ "node": "Final Consensus", "type": "main", "index": 0 }]
				]
			},
			"Final Consensus": {
				"main": [
					[{ "node": "Check Approval", "type": "main", "index": 0 }]
				]
			},
			"Check Approval": {
				"main": [
					[{ "node": "Submit to CWC", "type": "main", "index": 0 }],
					[{ "node": "Format Response", "type": "main", "index": 0 }]
				]
			},
			"Submit to CWC": {
				"main": [
					[{ "node": "Format Response", "type": "main", "index": 0 }]
				]
			},
			"Format Response": {
				"main": [
					[{ "node": "Respond to Webhook", "type": "main", "index": 0 }]
				]
			}
		}
	};
}

/**
 * Import a workflow to N8N
 */
async function importWorkflow(workflow: any): Promise<void> {
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
			case 'export':
				await exportWorkflows();
				break;

			case 'clear':
				await exportWorkflows(); // Backup first
				await clearAllWorkflows();
				break;

			case 'sync':
				console.log('🔄 Full sync: backup, clear, and deploy new workflow');
				await exportWorkflows();
				await clearAllWorkflows();
				console.log('');
				console.log('📝 Creating new multi-agent workflow...');
				const workflow = createMultiAgentWorkflow();
				await importWorkflow(workflow);
				console.log('');
				console.log('✨ Sync complete!');
				break;

			case 'list':
				const workflows = await getWorkflows();
				console.log(`📋 Found ${workflows.length} workflows:`);
				workflows.forEach(w => {
					console.log(`  - ${w.name} (${w.id}) ${w.active ? '✅ Active' : '⏸️  Inactive'}`);
				});
				break;

			default:
				console.log('Usage: tsx scripts/n8n-workflow-sync.ts <command>');
				console.log('');
				console.log('Commands:');
				console.log('  list    - List all workflows');
				console.log('  export  - Export workflows to backup');
				console.log('  clear   - Backup and clear all workflows');
				console.log('  sync    - Full sync (backup, clear, deploy new)');
				process.exit(1);
		}
	} catch (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	}
}

// Run if called directly
main();