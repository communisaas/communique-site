/**
 * ThoughtEmitter - Structured thought emission service for agents
 *
 * Provides a clean API for agents to emit rich, expandable thought segments
 * instead of raw text streams. Supports progressive disclosure, inline citations,
 * and research traces.
 *
 * @example Basic usage
 * ```typescript
 * const emitter = new ThoughtEmitter((segment) => {
 *   console.log('New thought:', segment.content);
 * });
 *
 * emitter.startPhase('research');
 * emitter.think('Analyzing Apple Inc. sustainability leadership...');
 *
 * const research = emitter.startResearch('Apple Inc.', 'corporate');
 * research.addFinding('Lisa Jackson leads Environmental Policy');
 * research.complete('Found key sustainability leadership information');
 * ```
 *
 * @module thoughts/emitter
 */

import type {
	ThoughtSegment,
	Citation,
	CitationSource,
	ActionTrace,
	ActionHandle,
	ActionType,
	KeyMoment,
	PhaseState,
	ActionTargetType,
	ThinkOptions,
	InsightOptions,
	RecommendOptions
} from './types';
import type {
	DocumentAnalysisEvent,
	DocumentProgressEvent,
	AnalysisStartEvent
} from '$lib/server/reducto/types';

// ============================================================================
// ThoughtEmitter Class
// ============================================================================

/**
 * Agent-side service for emitting structured thoughts
 *
 * Provides a simple, intentional API for agents to express their reasoning
 * as rich, expandable segments rather than raw text streams.
 *
 * The emitter tracks:
 * - Current reasoning phase
 * - Key moments for persistent affordances
 * - Phase progression state
 *
 * All emitted segments are immediately sent to the callback for UI updates.
 */
export class ThoughtEmitter {
	/** Current reasoning phase */
	private currentPhase: string = 'init';

	/** Key moments captured for footer */
	private keyMoments: KeyMoment[] = [];

	/** Phase progression tracking */
	private phases: Map<string, PhaseState> = new Map();

	/** Callback invoked for each emitted segment */
	private onEmit: (segment: ThoughtSegment) => void;

	/**
	 * Create a new ThoughtEmitter
	 *
	 * @param onEmit - Callback invoked for each emitted thought segment
	 */
	constructor(onEmit: (segment: ThoughtSegment) => void) {
		this.onEmit = onEmit;
	}

	// ========================================================================
	// Phase Management
	// ========================================================================

	/**
	 * Start a new reasoning phase
	 *
	 * Phases group related thoughts together and enable visual organization
	 * in the UI (collapsible sections, progress indicators).
	 *
	 * Common phases:
	 * - 'understanding' - Comprehending user intent
	 * - 'research' - Gathering information
	 * - 'context' - Retrieving relevant context
	 * - 'drafting' - Creating message draft
	 * - 'validation' - Checking and refining
	 *
	 * @param phase - Phase identifier (e.g., 'research', 'context', 'drafting')
	 *
	 * @example
	 * ```typescript
	 * emitter.startPhase('research');
	 * emitter.think('Searching for Apple sustainability leadership...');
	 * ```
	 */
	startPhase(phase: string): void {
		// Complete previous phase if exists
		if (this.currentPhase !== 'init') {
			this.completePhase();
		}

		this.currentPhase = phase;

		// Initialize phase state
		const phaseState: PhaseState = {
			name: phase,
			status: 'active',
			startTime: Date.now()
		};
		this.phases.set(phase, phaseState);

		// Emit phase marker (empty reasoning segment)
		this.emit({
			type: 'reasoning',
			phase,
			content: '',
			emphasis: 'normal'
		});
	}

	/**
	 * Complete the current phase
	 *
	 * Marks the current phase as complete and records end time.
	 * Called automatically when starting a new phase.
	 *
	 * @example
	 * ```typescript
	 * emitter.startPhase('research');
	 * // ... research actions ...
	 * emitter.completePhase();
	 * ```
	 */
	completePhase(): void {
		const phaseState = this.phases.get(this.currentPhase);
		if (phaseState) {
			phaseState.status = 'complete';
			phaseState.endTime = Date.now();
		}
	}

	// ========================================================================
	// Thought Emission
	// ========================================================================

	/**
	 * Emit a reasoning thought
	 *
	 * The primary method for expressing agent reasoning. Emits a standard
	 * thought segment with optional citations and emphasis.
	 *
	 * @param content - The thought content to display
	 * @param options - Optional configuration
	 *
	 * @example Simple thought
	 * ```typescript
	 * emitter.think('Apple is a Fortune 500 company focused on sustainability.');
	 * ```
	 *
	 * @example Thought with citation
	 * ```typescript
	 * const citation = emitter.cite("Apple's 2025 Report", {
	 *   url: 'https://apple.com/report',
	 *   excerpt: 'Committed to carbon neutrality...'
	 * });
	 * emitter.think('Apple has committed to carbon neutrality by 2030.', {
	 *   citations: [citation]
	 * });
	 * ```
	 *
	 * @example Highlighted thought
	 * ```typescript
	 * emitter.think('This is a critical finding.', { emphasis: 'highlight', pin: true });
	 * ```
	 */
	think(content: string, options?: ThinkOptions): void {
		const segment = this.emit({
			type: 'reasoning',
			phase: this.currentPhase,
			content,
			citations: options?.citations,
			emphasis: options?.emphasis || 'normal',
			expandable: !!options?.citations?.length,
			pinToKeyMoments: options?.pin
		});

		// Pin to key moments if requested
		if (options?.pin) {
			this.keyMoments.push({
				id: crypto.randomUUID(),
				type: 'insight',
				label: this.truncateLabel(content),
				icon: '💭',
				segmentId: segment.id
			});
		}
	}

	/**
	 * Emit an insight (key finding or discovery)
	 *
	 * Similar to think() but with 'insight' type and highlighted by default.
	 * Automatically pins to key moments unless explicitly disabled.
	 *
	 * @param content - The insight content
	 * @param options - Optional configuration
	 *
	 * @example
	 * ```typescript
	 * emitter.insight('Lisa Jackson leads Apple Environmental Policy and reports to CEO.');
	 * ```
	 */
	insight(content: string, options?: InsightOptions): void {
		const shouldPin = options?.pin !== false; // Default to true

		const segment = this.emit({
			type: 'insight',
			phase: this.currentPhase,
			content,
			citations: options?.citations,
			emphasis: 'highlight',
			expandable: !!options?.citations?.length,
			pinToKeyMoments: shouldPin
		});

		if (shouldPin) {
			this.keyMoments.push({
				id: crypto.randomUUID(),
				type: 'insight',
				label: this.truncateLabel(content),
				icon: options?.icon || '💡',
				segmentId: segment.id
			});
		}
	}

	/**
	 * Emit a recommendation
	 *
	 * Suggests an action or decision to the user. Highlighted by default
	 * and automatically pinned to key moments.
	 *
	 * @param content - The recommendation content
	 * @param options - Optional configuration
	 *
	 * @example
	 * ```typescript
	 * emitter.recommend('I recommend contacting Lisa Jackson at Apple Inc.');
	 * ```
	 */
	recommend(content: string, options?: RecommendOptions): void {
		const shouldPin = options?.pin !== false; // Default to true

		const segment = this.emit({
			type: 'recommendation',
			phase: this.currentPhase,
			content,
			citations: options?.citations,
			emphasis: 'highlight',
			expandable: !!options?.citations?.length,
			pinToKeyMoments: shouldPin
		});

		if (shouldPin) {
			this.keyMoments.push({
				id: crypto.randomUUID(),
				type: 'insight',
				label: this.truncateLabel(content),
				icon: options?.icon || '✨',
				segmentId: segment.id
			});
		}
	}

	// ========================================================================
	// Research Actions
	// ========================================================================

	/**
	 * Start a research action (Firecrawl web research)
	 *
	 * Emits an action segment and returns a handle for updating the action
	 * as research progresses (adding findings, marking complete).
	 *
	 * @param target - What is being researched (e.g., 'Apple Inc.')
	 * @param targetType - Optional type of target for context
	 * @returns ActionHandle for updating the research action
	 *
	 * @example
	 * ```typescript
	 * const research = emitter.startResearch('Apple Inc.', 'corporate');
	 *
	 * // As research progresses
	 * research.addFinding('Lisa Jackson leads Environmental Policy');
	 * research.addFinding('Scope 3 emissions increased 12% in 2025');
	 *
	 * // When complete
	 * research.complete('Found sustainability leadership and emissions data');
	 * ```
	 */
	startResearch(target: string, targetType?: ActionTargetType): ActionHandle {
		const action: ActionTrace = {
			type: 'research',
			target,
			targetType,
			status: 'pending',
			startTime: Date.now(),
			pagesVisited: [],
			findings: []
		};

		const segment = this.emit({
			type: 'action',
			phase: this.currentPhase,
			content: `Researching ${target}...`,
			action,
			expandable: true,
			pinToKeyMoments: true
		});

		// Add to key moments
		this.keyMoments.push({
			id: crypto.randomUUID(),
			type: 'action',
			label: `Research: ${this.truncateLabel(target)}`,
			icon: '🔍',
			segmentId: segment.id
		});

		// Return handle for updating action
		return {
			addPage: (url: string, title: string, relevant: boolean) => {
				action.pagesVisited?.push({ url, title, relevant });
			},
			addFinding: (finding: string) => {
				action.findings?.push(finding);
			},
			complete: (summary: string) => {
				action.status = 'complete';
				action.endTime = Date.now();
				this.think(summary, { pin: true });
			},
			error: (message: string) => {
				action.status = 'error';
				action.endTime = Date.now();
				action.error = message;
				this.think(`Research failed: ${message}`, { emphasis: 'muted' });
			}
		};
	}

	/**
	 * Start a generic action (analyze, search, etc.)
	 *
	 * Emits an action segment and returns a handle for updating the action
	 * as it progresses. Useful for tool invocations like document analysis.
	 *
	 * @param actionType - Type of action (e.g., 'analyze', 'search')
	 * @param description - Human-readable description of the action
	 * @returns ActionHandle for updating the action
	 *
	 * @example
	 * ```typescript
	 * const action = emitter.startAction('analyze', 'Analyzing document: https://...');
	 *
	 * action.addFinding('Found 3 relevant sections');
	 * action.complete('Document analysis complete');
	 * ```
	 */
	startAction(actionType: ActionType, description: string): ActionHandle {
		const action: ActionTrace = {
			type: actionType,
			target: description,
			status: 'pending',
			startTime: Date.now(),
			findings: []
		};

		const segment = this.emit({
			type: 'action',
			phase: this.currentPhase,
			content: description,
			action,
			expandable: true,
			pinToKeyMoments: true
		});

		// Add to key moments
		this.keyMoments.push({
			id: crypto.randomUUID(),
			type: 'action',
			label: this.truncateLabel(description),
			icon: actionType === 'analyze' ? '📄' : '🔧',
			segmentId: segment.id
		});

		// Return handle for updating action
		return {
			addFinding: (finding: string) => {
				action.findings?.push(finding);
			},
			complete: (summary: string) => {
				action.status = 'complete';
				action.endTime = Date.now();
				this.think(summary, { pin: true });
			},
			error: (message: string) => {
				action.status = 'error';
				action.endTime = Date.now();
				action.error = message;
				this.think(`Action failed: ${message}`, { emphasis: 'muted' });
			}
		};
	}

	/**
	 * Start a retrieval action (MongoDB/vector search)
	 *
	 * Emits an action segment for context retrieval and returns a handle
	 * for updating as results are found.
	 *
	 * @param query - Search query string
	 * @returns ActionHandle for updating the retrieval action
	 *
	 * @example
	 * ```typescript
	 * const retrieval = emitter.startRetrieval('climate policy corporate sustainability');
	 *
	 * retrieval.addFinding('Found 15 relevant intelligence items');
	 * retrieval.complete('Retrieved context on climate policy and sustainability');
	 * ```
	 */
	startRetrieval(query: string): ActionHandle {
		const action: ActionTrace = {
			type: 'retrieve',
			target: query,
			status: 'pending',
			startTime: Date.now(),
			query,
			resultsCount: 0,
			topResults: []
		};

		const segment = this.emit({
			type: 'action',
			phase: this.currentPhase,
			content: `Retrieving context: ${query}...`,
			action,
			expandable: true,
			pinToKeyMoments: false // Retrieval is less notable than research
		});

		// Return handle for updating action
		return {
			addFinding: (finding: string) => {
				// For retrieval, findings are just text notes
				if (!action.findings) {
					action.findings = [];
				}
				action.findings.push(finding);
			},
			complete: (summary: string) => {
				action.status = 'complete';
				action.endTime = Date.now();
				this.think(summary);
			},
			error: (message: string) => {
				action.status = 'error';
				action.endTime = Date.now();
				action.error = message;
				this.think(`Retrieval failed: ${message}`, { emphasis: 'muted' });
			}
		};
	}

	// ========================================================================
	// Citations
	// ========================================================================

	/**
	 * Create a citation for inline source references
	 *
	 * Citations can be included in think(), insight(), or recommend() calls
	 * to enable progressive disclosure of source material.
	 *
	 * @param label - Human-readable citation label
	 * @param source - Source information (URL, excerpt, IDs)
	 * @returns Citation object for use in thought options
	 *
	 * @example
	 * ```typescript
	 * const citation = emitter.cite("Apple's 2025 Report", {
	 *   url: 'https://apple.com/environmental-report-2025',
	 *   excerpt: 'We are committed to achieving carbon neutrality...',
	 *   mongoId: '507f1f77bcf86cd799439011'
	 * });
	 *
	 * emitter.think('Apple has committed to carbon neutrality by 2030.', {
	 *   citations: [citation]
	 * });
	 * ```
	 */
	cite(label: string, source: CitationSource): Citation {
		const citation: Citation = {
			id: crypto.randomUUID(),
			label,
			url: source.url,
			excerpt: source.excerpt,
			sourceType: this.inferSourceType(source),
			mongoId: source.mongoId,
			documentId: source.documentId
		};

		// Add to key moments for quick access
		this.keyMoments.push({
			id: crypto.randomUUID(),
			type: 'citation',
			label: this.truncateLabel(label),
			icon: '📄',
			segmentId: citation.id, // Use citation ID as reference
			metadata: { citation }
		});

		return citation;
	}

	// ========================================================================
	// Document Analysis Streaming (Perceptual Engineering)
	// ========================================================================

	/**
	 * Bridge Reducto document analysis events to thought segments.
	 *
	 * This method implements perceptual engineering for long-running document
	 * analysis (30-60s). It converts DocumentAnalysisEvents into appropriate
	 * ThoughtSegments that maintain user engagement:
	 *
	 * Timing budget awareness:
	 * - 0-1s: Immediate feedback (analysis_start -> action segment)
	 * - 1-30s: Granular progress (document_progress -> updates)
	 * - 30s+: "Still working" signals (interim findings, stage changes)
	 *
	 * @param event - Document analysis event from Reducto client
	 *
	 * @example
	 * ```typescript
	 * const emitter = new ThoughtEmitter(onSegment);
	 *
	 * await client.parseMultiple(urls, {
	 *   onProgress: (event) => emitter.handleDocumentAnalysisEvent(event)
	 * });
	 * ```
	 */
	handleDocumentAnalysisEvent(event: DocumentAnalysisEvent): void {
		switch (event.type) {
			case 'analysis_start':
				this.handleAnalysisStart(event);
				break;
			case 'document_progress':
				this.handleDocumentProgress(event);
				break;
			case 'document_interim':
				this.handleDocumentInterim(event);
				break;
			case 'analysis_complete':
				this.handleAnalysisComplete(event);
				break;
		}
	}

	/**
	 * Handle analysis start event - immediate feedback (0-1s timing budget)
	 */
	private handleAnalysisStart(event: AnalysisStartEvent): void {
		const estimatedSeconds = Math.round(event.estimatedTimeMs / 1000);
		const parallelNote = event.parallel ? ' in parallel' : '';

		this.think(
			`Analyzing ${event.count} document${event.count > 1 ? 's' : ''}${parallelNote}. ` +
			`Estimated time: ~${estimatedSeconds}s.`,
			{ emphasis: 'normal' }
		);

		// Create action for tracking
		const action = this.startAction(
			'analyze',
			`Document analysis: ${event.count} file${event.count > 1 ? 's' : ''}`
		);

		// Store the action handle for later updates (using closure)
		// We'll emit progress as document_progress events arrive
		this.documentAnalysisAction = action;
	}

	/**
	 * Handle document progress event - granular updates (1-30s timing budget)
	 */
	private handleDocumentProgress(event: DocumentProgressEvent): void {
		const progressPercent = Math.round(((event.index + 1) / event.total) * 100);
		const seconds = (event.timeElapsedMs / 1000).toFixed(1);

		// Map stage to user-friendly message
		const stageMessages: Record<DocumentProgressEvent['stage'], string> = {
			queued: 'Queued for analysis',
			parsing: 'Parsing document structure',
			extracting: 'Extracting key information',
			complete: `Complete (${seconds}s)${event.cached ? ' [cached]' : ''}`,
			error: `Failed: ${event.error || 'Unknown error'}`,
			timeout: `Timed out after ${seconds}s`
		};

		const stageMessage = stageMessages[event.stage] || event.stage;
		const docLabel = event.title || this.extractUrlName(event.url);

		// Emit progress thought with muted emphasis (ambient awareness)
		if (event.stage === 'complete') {
			this.documentAnalysisAction?.addFinding(`${docLabel}: ${stageMessage}`);
		} else if (event.stage === 'error' || event.stage === 'timeout') {
			this.think(`[${event.index + 1}/${event.total}] ${docLabel}: ${stageMessage}`, {
				emphasis: 'muted'
			});
		} else if (event.stage === 'parsing') {
			// Only emit parsing start for ambient awareness (not queued, which is too noisy)
			this.think(`[${event.index + 1}/${event.total}] ${docLabel}: ${stageMessage}`, {
				emphasis: 'muted'
			});
		}
	}

	/**
	 * Handle interim finding event - prevents "stuck" perception (30s+ timing budget)
	 */
	private handleDocumentInterim(event: { documentIndex: number; finding: string; confidence: number }): void {
		// Convert confidence to a more human-readable indicator
		const confidenceLabel = event.confidence >= 0.7 ? 'likely relevant' :
			event.confidence >= 0.4 ? 'potentially relevant' : 'mentioned';

		this.insight(
			`Found (${confidenceLabel}): "${event.finding}"`,
			{ pin: event.confidence >= 0.7 }
		);
	}

	/**
	 * Handle analysis complete event
	 */
	private handleAnalysisComplete(event: {
		total: number;
		successful: number;
		failed: number;
		timedOut: number;
		totalTimeMs: number;
	}): void {
		const seconds = (event.totalTimeMs / 1000).toFixed(1);

		// Build summary message
		const parts: string[] = [];
		if (event.successful > 0) {
			parts.push(`${event.successful} succeeded`);
		}
		if (event.failed > 0) {
			parts.push(`${event.failed} failed`);
		}
		if (event.timedOut > 0) {
			parts.push(`${event.timedOut} timed out`);
		}

		const summary = `Document analysis complete: ${parts.join(', ')} in ${seconds}s`;

		// Complete the action
		this.documentAnalysisAction?.complete(summary);
		this.documentAnalysisAction = undefined;
	}

	/**
	 * Extract a readable name from a URL for display
	 */
	private extractUrlName(url: string): string {
		try {
			const urlObj = new URL(url);
			// Get filename or last path segment
			const path = urlObj.pathname;
			const segments = path.split('/').filter(Boolean);
			if (segments.length > 0) {
				const last = segments[segments.length - 1];
				// Remove extension and truncate if too long
				const name = last.replace(/\.[^.]+$/, '');
				return name.length > 40 ? name.slice(0, 37) + '...' : name;
			}
			return urlObj.hostname;
		} catch {
			return url.length > 50 ? url.slice(0, 47) + '...' : url;
		}
	}

	/** Internal handle for tracking document analysis action */
	private documentAnalysisAction?: ActionHandle;

	// ========================================================================
	// State Access
	// ========================================================================

	/**
	 * Get all captured key moments
	 *
	 * Key moments are important items (insights, citations, actions) that
	 * are pinned to a persistent footer so they don't scroll away.
	 *
	 * @returns Array of key moments
	 */
	getKeyMoments(): KeyMoment[] {
		return this.keyMoments;
	}

	/**
	 * Get all phase states
	 *
	 * Returns progression through reasoning phases for UI visualization
	 * (timeline, progress indicators, collapsible sections).
	 *
	 * @returns Array of phase states
	 */
	getPhases(): PhaseState[] {
		return Array.from(this.phases.values());
	}

	// ========================================================================
	// Internal Helpers
	// ========================================================================

	/**
	 * Emit a thought segment
	 *
	 * Internal method that creates a complete segment and invokes the callback.
	 * Handles ID generation, timestamps, and defaults.
	 *
	 * @param partial - Partial segment data
	 * @returns Complete emitted segment
	 */
	private emit(partial: Partial<ThoughtSegment>): ThoughtSegment {
		const segment: ThoughtSegment = {
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			type: 'reasoning',
			phase: this.currentPhase,
			content: '',
			expandable: false,
			...partial
		};

		this.onEmit(segment);
		return segment;
	}

	/**
	 * Truncate a label to reasonable length for key moments
	 *
	 * @param text - Full text
	 * @param maxLength - Maximum length (default: 50)
	 * @returns Truncated text with ellipsis if needed
	 */
	private truncateLabel(text: string, maxLength = 50): string {
		if (text.length <= maxLength) {
			return text;
		}
		return text.slice(0, maxLength - 3) + '...';
	}

	/**
	 * Infer citation source type from source data
	 *
	 * @param source - Citation source
	 * @returns Inferred source type
	 */
	private inferSourceType(source: CitationSource): Citation['sourceType'] {
		// Use explicit sourceType if provided
		if (source.sourceType) return source.sourceType;
		// Otherwise infer from IDs/URL
		if (source.mongoId) return 'intelligence';
		if (source.documentId) return 'document';
		if (source.url?.includes('communique.vote')) return 'organization';
		return 'web';
	}
}
