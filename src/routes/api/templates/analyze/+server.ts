import { json } from '@sveltejs/kit';
import { templateCorrector } from '$lib/services/template-correction';
import { createApiError, type ApiResponse } from '$lib/types/errors';

interface AnalyzeRequest {
	title: string;
	content: string;
	deliveryMethod: string;
}

interface QuickFix {
	type: 'grammar' | 'clarity' | 'structure' | 'ask';
	fix: string;
	reason: string;
	severity: number;
}

interface AnalyzeResponse {
	status: 'ready' | 'needs_fixes' | 'needs_work';
	quickFixes: QuickFix[];
	scores: {
		grammar: number;
		clarity: number;
		completeness: number;
	};
	suggestions?: {
		aiNeeded: boolean;
		focusAreas: string[];
	};
}

export async function POST({ request }) {
	try {
		const { title, content, deliveryMethod }: AnalyzeRequest = await request.json();

		if (!content || !title) {
			const response: ApiResponse = {
				success: false,
				error: createApiError('validation', 'VALIDATION_REQUIRED', 'Title and content are required')
			};
			return json(response, { status: 400 });
		}

		// Check if this is certified congressional delivery
		const isCertifiedDelivery = deliveryMethod === 'certified';

		// Create mock template for analysis
		const mockTemplate = {
			id: 'temp-analysis',
			title,
			subject: title,
			message_body: content,
			deliveryMethod: deliveryMethod as any,
			preview: content.substring(0, 500),
			userId: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			description: '',
			category: '',
			type: '',
			status: 'draft',
			slug: '',
			is_public: false,
			delivery_config: {},
			cwc_config: {},
			recipient_config: {},
			metrics: {}
		};

		let corrections;
		if (isCertifiedDelivery) {
			// Full agent analysis for congressional templates
			corrections = await (templateCorrector as any).detectAndCorrect(mockTemplate);
		} else {
			// Lightweight analysis for direct outreach
			corrections = {
				changes: [],
				severity: 1,
				scores: {
					grammar: 95,
					clarity: 90,
					completeness: 85
				}
			};
		}
		
		// Transform corrections into quick fixes
		const quickFixes: QuickFix[] = corrections.changes.map((change: any) => {
			let fixMessage = '';
			let reason = change.reason;
			
			switch (change.type) {
				case 'grammar':
					fixMessage = `Fix: "${change.original}" → "${change.corrected}"`;
					break;
				case 'clarity':
					fixMessage = `Simplify: "${change.original}" → "${change.corrected}"`;
					break;
				case 'formatting':
					fixMessage = change.reason;
					break;
				default:
					fixMessage = `${change.original} → ${change.corrected}`;
			}

			// Map to our voice
			if (reason.includes('weak language')) {
				reason = 'Direct statements hit harder';
			} else if (reason.includes('specific ask')) {
				reason = 'Clear requests get action';
			} else if (reason.includes('too short')) {
				reason = 'Officials need substance to act on';
			}

			return {
				type: change.type === 'formatting' ? 'structure' : change.type,
				fix: fixMessage,
				reason,
				severity: 1
			};
		});

		// Add rule-based checks - more extensive for certified, basic for direct
		const additionalFixes = checkCommonIssues(content, isCertifiedDelivery);
		quickFixes.push(...additionalFixes);

		// Determine status
		let status: 'ready' | 'needs_fixes' | 'needs_work' = 'ready';
		if (corrections.severity >= 7 || quickFixes.length > 3) {
			status = 'needs_work';
		} else if (quickFixes.length > 0) {
			status = 'needs_fixes';
		}

		const analyzeResponse: AnalyzeResponse = {
			status,
			quickFixes,
			scores: corrections.scores,
			suggestions: status === 'needs_work' ? {
				aiNeeded: true,
				focusAreas: quickFixes.map(f => f.type)
			} : undefined
		};

		const response: ApiResponse = {
			success: true,
			data: analyzeResponse
		};

		return json(response);

	} catch (error) {
		console.error('Template analysis error:', error);
		
		const response: ApiResponse = {
			success: false,
			error: createApiError('server', 'SERVER_INTERNAL', 'Analysis failed')
		};

		return json(response, { status: 500 });
	}
}

function checkCommonIssues(content: string, isCertified: boolean = false): QuickFix[] {
	const fixes: QuickFix[] = [];
	const lowerContent = content.toLowerCase();

	// Basic checks for all templates
	// Check for weak language
	if (content.includes('I think') || content.includes('maybe') || content.includes('perhaps')) {
		fixes.push({
			type: 'clarity',
			fix: 'Cut weak language—"I think" doesn\'t persuade',
			reason: 'Direct statements hit harder',
			severity: 2
		});
	}

	// Check length - minimum for readability
	if (content.length < 100) {
		fixes.push({
			type: 'structure',
			fix: 'Message too short—add more detail',
			reason: 'Recipients need context',
			severity: 2
		});
	}

	// Additional checks only for certified congressional templates
	if (isCertified) {
		// Check for missing specific ask (congressional requirement)
		if (!lowerContent.includes('vote') && !lowerContent.includes('support') && 
			!lowerContent.includes('oppose') && !lowerContent.includes('fund') && 
			!lowerContent.includes('pass') && !lowerContent.includes('reject')) {
			fixes.push({
				type: 'ask',
				fix: 'Add specific ask—what exactly should they do?',
				reason: 'Clear requests get action',
				severity: 3
			});
		}

		// Check for vague language (more critical for congressional)
		if (lowerContent.includes('this issue') || lowerContent.includes('this matter') || 
			lowerContent.includes('this problem')) {
			fixes.push({
				type: 'clarity',
				fix: 'Name the issue specifically—what exactly are you talking about?',
				reason: 'Specifics beat generalities',
				severity: 2
			});
		}

		// Higher length requirement for congressional
		if (content.length < 150) {
			fixes.push({
				type: 'structure',
				fix: 'Congressional messages need more substance',
				reason: 'Officials need context to act',
				severity: 2
			});
		}

		// Check for personal story hook (important for congressional credibility)
		if (!lowerContent.includes('my') && !lowerContent.includes('our') && 
			!lowerContent.includes('local') && !lowerContent.includes('community')) {
			fixes.push({
				type: 'structure',
				fix: 'Add personal connection—why does this matter to you?',
				reason: 'Personal stakes get attention',
				severity: 1
			});
		}
	}

	return fixes;
}