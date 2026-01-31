<script lang="ts">
	/**
	 * ThoughtStream Demo Page
	 *
	 * Interactive demonstration of the ThoughtStream component with:
	 * - Simulated agent reasoning segments
	 * - Document Map wiring for L2/L3 previews
	 * - DetailDrawer integration
	 * - KeyMoments tracking
	 *
	 * This demo shows the complete wiring pattern for document integration:
	 * 1. Create `documents` state as a reactive Map
	 * 2. Pass documents down through ThoughtStream -> PhaseContainer -> ThoughtSegment -> InlineCitation
	 * 3. Handle `onrequestdocument` callback to fetch and cache documents
	 * 4. Update Map to trigger reactive UI updates
	 */

	import { ThoughtStream, KeyMoments, DetailDrawer } from '$lib/components/thoughts';
	import { ThoughtEmitter } from '$lib/core/thoughts/emitter';
	import type {
		ThoughtSegment,
		PhaseState,
		Citation,
		ActionTrace,
		KeyMoment
	} from '$lib/core/thoughts/types';
	import type { ParsedDocument } from '$lib/server/reducto/types';
	import { onMount } from 'svelte';
	import { Play, RotateCcw, BookOpen } from '@lucide/svelte';

	// ============================================================================
	// State Management
	// ============================================================================

	// Thought stream state
	let segments = $state<ThoughtSegment[]>([]);
	let phases = $state<PhaseState[]>([]);
	let keyMoments = $state<KeyMoment[]>([]);
	let streaming = $state(false);

	// Detail drawer state
	let drawerOpen = $state(false);
	let drawerContent = $state<Citation | ActionTrace | null>(null);
	let drawerDocument = $state<ParsedDocument | null>(null);

	// Track L3 state for stream de-emphasis (bound from DetailDrawer)
	let isL3Active = $state(false);

	/**
	 * CRITICAL: Document cache using Svelte 5 $state Map
	 *
	 * This Map stores fetched ParsedDocuments keyed by documentId.
	 * When a document is fetched, we update this Map, which triggers
	 * reactivity throughout the component tree:
	 *
	 * ThoughtStream -> PhaseContainer -> ThoughtSegment -> InlineCitation
	 *
	 * InlineCitation checks `isDocumentCitation = citation.sourceType === 'document' && document !== undefined`
	 * If document is in the Map, the L2 preview shows on hover.
	 */
	let documents = $state(new Map<string, ParsedDocument>());

	// Loading state for document fetches
	let loadingDocuments = $state(new Set<string>());

	// Initialize ThoughtEmitter with callback to update segments
	const emitter = new ThoughtEmitter((segment) => {
		segments = [...segments, segment];
	});

	// ============================================================================
	// Event Handlers
	// ============================================================================

	function handleCitationClick(citation: Citation) {
		drawerContent = citation;
		drawerDocument = null; // Reset document when opening citation
		drawerOpen = true;
	}

	function handleActionExpand(action: ActionTrace) {
		drawerContent = action;
		drawerDocument = null;
		drawerOpen = true;
	}

	function handleMomentClick(moment: KeyMoment) {
		// Scroll to segment in stream
		const element = document.querySelector(`[data-segment-id="${moment.segmentId}"]`);
		element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

		// Open in detail drawer if it's a citation
		if (moment.type === 'citation' && moment.metadata?.citation) {
			drawerContent = moment.metadata.citation as Citation;
			drawerDocument = null;
			drawerOpen = true;
		}
	}

	/**
	 * Handle L3 document request from CitationDetail
	 *
	 * This is called when user clicks "View Full Document" in the drawer.
	 * Fetches the document from the API and sets it on the drawer.
	 */
	async function handleRequestDocument(documentId: string) {
		// Check if already loading
		if (loadingDocuments.has(documentId)) {
			return;
		}

		// Check cache first
		const cached = documents.get(documentId);
		if (cached) {
			drawerDocument = cached;
			return;
		}

		// Fetch from API
		loadingDocuments.add(documentId);
		loadingDocuments = new Set(loadingDocuments); // Trigger reactivity

		try {
			const response = await fetch(`/api/documents/${documentId}`);
			const result = await response.json();

			if (result.success && result.data?.document) {
				const doc = result.data.document as ParsedDocument;
				// Update the Map (triggers reactivity for L2 previews)
				documents.set(documentId, doc);
				documents = new Map(documents); // Trigger reactivity
				// Set for L3 view in drawer
				drawerDocument = doc;
			} else {
				console.error('[ThoughtStream Demo] Document fetch failed:', result.error);
			}
		} catch (error) {
			console.error('[ThoughtStream Demo] Document fetch error:', error);
		} finally {
			loadingDocuments.delete(documentId);
			loadingDocuments = new Set(loadingDocuments);
		}
	}

	/**
	 * Handle "View Full" from DocumentPreview (L2 hover preview)
	 *
	 * This opens the document in the DetailDrawer for full L3 analysis.
	 */
	function handleViewFullDocument(doc: ParsedDocument) {
		// Find the related citation if any
		let sourceCitation: Citation | null = null;
		for (const segment of segments) {
			if (segment.citations) {
				const citation = segment.citations.find((c) => c.documentId === doc.id);
				if (citation) {
					sourceCitation = citation;
					break;
				}
			}
		}

		drawerContent = sourceCitation;
		drawerDocument = doc;
		drawerOpen = true;

		// Capture Key Moment
		handleDocumentView(doc, sourceCitation);
	}

	/**
	 * Capture Key Moment when user enters L3 document view
	 */
	function handleDocumentView(doc: ParsedDocument, sourceCitation: Citation | null) {
		const moment: KeyMoment = {
			id: crypto.randomUUID(),
			type: 'document',
			label: doc.title.length > 30 ? `${doc.title.slice(0, 30)}...` : doc.title,
			icon: 'file-text',
			segmentId: sourceCitation?.id || doc.id,
			metadata: {
				documentId: doc.id,
				documentTitle: doc.title,
				sourceCitationId: sourceCitation?.id
			}
		};
		keyMoments = [...keyMoments, moment];
	}

	function closeDrawer() {
		drawerOpen = false;
		// Keep content for smooth exit animation
		setTimeout(() => {
			drawerContent = null;
			drawerDocument = null;
		}, 300);
	}

	// ============================================================================
	// Demo Agent Execution
	// ============================================================================

	/**
	 * Mock parsed documents for the demo
	 * In production, these would come from the Reducto API
	 */
	const mockDocuments: Record<string, ParsedDocument> = {
		'doc-apple-env-2025': {
			id: 'doc-apple-env-2025',
			title: 'Apple Environmental Progress Report 2025',
			source: {
				name: 'Apple Inc.',
				url: 'https://apple.com/environment/pdf/Apple_Environmental_Progress_Report_2025.pdf',
				date: '2025-04-15',
				type: 'corporate'
			},
			type: 'corporate',
			sections: [
				{
					id: 'section-1',
					title: 'Executive Summary',
					level: 0,
					content:
						'Apple remains committed to becoming carbon neutral across our entire business, manufacturing supply chain, and product life cycle by 2030. In fiscal year 2025, we reduced our total carbon footprint by 55% since 2015.'
				},
				{
					id: 'section-2',
					title: 'Climate Action',
					level: 0,
					content:
						'Our Scope 1 and 2 emissions decreased by 75% since 2015. However, Scope 3 emissions (primarily from manufacturing and product use) increased by 12% due to expanded production. Lisa Jackson, VP of Environmental Policy, oversees all sustainability initiatives.'
				},
				{
					id: 'section-3',
					title: 'Supply Chain Commitments',
					level: 0,
					content:
						'Over 300 suppliers have committed to using 100% renewable energy for Apple production by 2030. We are investing $4.7 billion in clean energy projects globally.'
				}
			],
			entities: [
				{ type: 'person', value: 'Lisa Jackson', context: 'VP Environmental Policy', normalized: 'Lisa Jackson' },
				{ type: 'organization', value: 'Apple Inc.', context: 'Report publisher', normalized: 'Apple' },
				{ type: 'amount', value: '$4.7 billion', context: 'Clean energy investment', normalized: 4700000000 },
				{ type: 'date', value: '2030', context: 'Carbon neutrality target', normalized: '2030' }
			],
			crossRefs: [],
			metadata: {
				parsedAt: new Date(),
				sourceUrl: 'https://apple.com/environment/pdf/Apple_Environmental_Progress_Report_2025.pdf',
				pageCount: 94
			}
		},
		'doc-sec-filing-10k': {
			id: 'doc-sec-filing-10k',
			title: 'Apple Inc. Form 10-K Annual Report (FY2025)',
			source: {
				name: 'SEC EDGAR',
				url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193',
				date: '2025-10-28',
				type: 'corporate'
			},
			type: 'corporate',
			sections: [
				{
					id: 'section-1',
					title: 'Business Overview',
					level: 0,
					content:
						'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories. The Company also offers various related services.'
				},
				{
					id: 'section-2',
					title: 'Risk Factors',
					level: 0,
					content:
						'Climate change and environmental regulations may materially impact our operations. Increasing regulatory requirements related to carbon emissions, particularly in the European Union and California, could require significant capital expenditures.'
				}
			],
			entities: [
				{ type: 'organization', value: 'Apple Inc.', context: 'Filing company', normalized: 'Apple' },
				{ type: 'organization', value: 'SEC', context: 'Regulatory body', normalized: 'Securities and Exchange Commission' }
			],
			crossRefs: [],
			metadata: {
				parsedAt: new Date(),
				sourceUrl: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193',
				pageCount: 127
			}
		}
	};

	/**
	 * Pre-populate the documents Map with mock data
	 * This ensures L2 previews work immediately for demo citations
	 */
	function initializeMockDocuments() {
		for (const [id, doc] of Object.entries(mockDocuments)) {
			documents.set(id, doc);
		}
		documents = new Map(documents);
	}

	async function runAgent() {
		streaming = true;
		segments = [];
		phases = [];
		keyMoments = [];

		// Pre-populate documents for demo
		initializeMockDocuments();

		try {
			// PHASE 1: Understanding
			emitter.startPhase('understanding');
			emitter.think('Analyzing user message and intent...');

			await simulateDelay(400);
			emitter.insight('User wants to advocate for climate policy to corporate decision-makers.');
			emitter.completePhase();

			// PHASE 2: Research
			emitter.startPhase('research');
			emitter.think('Searching for corporate targets related to climate policy...');

			await simulateDelay(500);

			// Start research action
			const research = emitter.startResearch('Apple Inc.', 'corporate');

			await simulateDelay(800);
			research.addPage?.('https://apple.com/sustainability', 'Apple Sustainability', true);
			research.addFinding('Lisa Jackson leads Environmental Policy');
			research.addFinding('Committed to carbon neutrality by 2030');
			research.addFinding('Scope 3 emissions increased 12% in 2025');

			await simulateDelay(400);
			research.complete('Found sustainability leadership and emissions data');

			// Create citation WITH documentId (enables L2/L3 features)
			const citation1 = emitter.cite("Apple's 2025 Environmental Report", {
				url: 'https://apple.com/environmental-report-2025',
				excerpt:
					'We are committed to achieving carbon neutrality across our entire supply chain by 2030. Lisa Jackson, VP Environmental Policy, leads these efforts. Scope 3 emissions increased 12% due to expanded production.',
				documentId: 'doc-apple-env-2025', // This enables L2 preview + L3 document view
				sourceType: 'document'
			});

			await simulateDelay(300);
			emitter.insight('Lisa Jackson (VP Environmental Policy) reports directly to CEO Tim Cook.', {
				citations: [citation1]
			});

			// Create another citation with document reference
			const citation2 = emitter.cite('Apple SEC 10-K Filing (FY2025)', {
				url: 'https://sec.gov/apple-10k-2025',
				excerpt:
					'Climate change and environmental regulations may materially impact our operations. Increasing regulatory requirements related to carbon emissions could require significant capital expenditures.',
				documentId: 'doc-sec-filing-10k',
				sourceType: 'document'
			});

			await simulateDelay(300);
			emitter.think('Found SEC filing with climate risk disclosure.', {
				citations: [citation2]
			});

			emitter.completePhase();

			// PHASE 3: Context Retrieval
			emitter.startPhase('context');
			emitter.think('Retrieving relevant intelligence from knowledge base...');

			await simulateDelay(400);

			const retrieval = emitter.startRetrieval('climate policy corporate sustainability Apple');
			await simulateDelay(600);
			retrieval.addFinding('Found 15 relevant intelligence items');
			retrieval.complete('Retrieved context on climate policy and corporate sustainability');

			// Create a web citation (no document preview, just tooltip)
			const citation3 = emitter.cite('Bloomberg Climate Report', {
				url: 'https://bloomberg.com/climate-tech-2025',
				excerpt:
					'Corporate climate commitments accelerated in 2025, with Fortune 500 companies announcing $150 billion in green investments.',
				sourceType: 'web'
			});

			emitter.insight('Recent corporate climate commitments provide leverage points.', {
				citations: [citation3]
			});

			emitter.completePhase();

			// PHASE 4: Drafting
			emitter.startPhase('drafting');
			emitter.think('Crafting message based on research and user intent...');

			await simulateDelay(1000);

			emitter.recommend(
				'I recommend addressing Lisa Jackson directly, focusing on Scope 3 emissions which increased despite neutrality goals. The SEC filing shows climate risk is material to investors.',
				{ pin: true }
			);

			emitter.completePhase();

			// Update phases and key moments
			phases = emitter.getPhases();
			keyMoments = emitter.getKeyMoments();
		} catch (error) {
			console.error('Agent execution failed:', error);
			emitter.think(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
				emphasis: 'muted'
			});
		} finally {
			streaming = false;
		}
	}

	function simulateDelay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function resetDemo() {
		segments = [];
		phases = [];
		keyMoments = [];
		documents = new Map();
		drawerOpen = false;
		drawerContent = null;
		drawerDocument = null;
		isL3Active = false;
		streaming = false;
	}
</script>

<svelte:head>
	<title>ThoughtStream Demo | Communique</title>
</svelte:head>

<div class="demo-page flex h-screen flex-col bg-gradient-to-b from-slate-50 to-white">
	<!-- Header -->
	<header class="shrink-0 border-b border-surface-border bg-surface-base px-6 py-4">
		<div class="mx-auto max-w-7xl">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold text-text-primary">ThoughtStream Demo</h1>
					<p class="mt-1 text-sm text-text-secondary">
						Agent reasoning visualization with L2/L3 document integration
					</p>
				</div>

				<!-- Demo Controls -->
				<div class="flex gap-3">
					<button
						type="button"
						onclick={runAgent}
						disabled={streaming}
						class="inline-flex items-center gap-2 rounded-lg bg-coord-route-solid px-4 py-2 text-sm font-medium text-white transition-all hover:bg-coord-route-solid/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Play class="h-4 w-4" strokeWidth={2} />
						Run Agent
					</button>

					<button
						type="button"
						onclick={resetDemo}
						disabled={streaming}
						class="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-white px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
					>
						<RotateCcw class="h-4 w-4" strokeWidth={2} />
						Reset
					</button>
				</div>
			</div>

			<!-- Stats Bar -->
			<div class="mt-4 flex gap-6 text-sm">
				<div class="flex items-center gap-2">
					<span class="text-text-quaternary">Segments:</span>
					<span class="font-medium text-text-primary">{segments.length}</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-text-quaternary">Documents Cached:</span>
					<span class="font-medium text-text-primary">{documents.size}</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-text-quaternary">Loading:</span>
					<span class="font-medium text-text-primary">{loadingDocuments.size}</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-text-quaternary">Status:</span>
					<span class="font-medium {streaming ? 'text-coord-route-solid' : 'text-coord-verified'}">
						{streaming ? 'Streaming...' : 'Ready'}
					</span>
				</div>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="flex flex-1 overflow-hidden">
		<!-- Thought stream (takes full width when drawer closed, shrinks when open) -->
		<!-- Stream container: de-emphasize (40% opacity) when L3 document view is active -->
		<div
			class="stream-container flex-1 overflow-hidden transition-all duration-300"
			class:mr-[480px]={drawerOpen && !isL3Active}
			class:mr-[720px]={drawerOpen && isL3Active}
			class:de-emphasized={isL3Active}
		>
			{#if segments.length > 0 || streaming}
				<!--
					CRITICAL WIRING:
					Pass `documents` Map and `onViewFullDocument` callback to ThoughtStream.
					These flow through the component tree:
					ThoughtStream -> PhaseContainer -> ThoughtSegment -> InlineCitation

					When a citation has sourceType='document' and documentId, AND that documentId
					exists in the documents Map, InlineCitation will show the L2 hover preview.
				-->
				<ThoughtStream
					{segments}
					{phases}
					{streaming}
					{documents}
					oncitationclick={handleCitationClick}
					onactionexpand={handleActionExpand}
					onViewFullDocument={handleViewFullDocument}
				/>
			{:else}
				<!-- Empty state -->
				<div class="flex h-full items-center justify-center">
					<div class="text-center">
						<BookOpen class="mx-auto h-16 w-16 text-text-quaternary" strokeWidth={1.5} />
						<h3 class="mt-4 text-lg font-medium text-text-secondary">No thoughts yet</h3>
						<p class="mt-2 text-sm text-text-tertiary">
							Click "Run Agent" to see the thought stream in action
						</p>
					</div>
				</div>
			{/if}
		</div>

		<!--
			Detail drawer (slides in from right)
			Supports L1/L2 citation/action detail and L3 document analysis

			CRITICAL WIRING:
			- `onrequestdocument`: Called when user clicks "View Full Document" in CitationDetail
			  We fetch the document and set `parsedDocument` prop to show L3 view.
			- `ondocumentview`: Called when L3 view becomes active, for KeyMoment capture.
		-->
		<DetailDrawer
			bind:open={drawerOpen}
			bind:isL3Active
			content={drawerContent}
			parsedDocument={drawerDocument}
			onclose={closeDrawer}
			onrequestdocument={handleRequestDocument}
			ondocumentview={handleDocumentView}
		/>
	</main>

	<!-- Key moments footer (sticky at bottom) -->
	<KeyMoments moments={keyMoments} onmomentclick={handleMomentClick} />
</div>

<!-- Usage Guide Panel (fixed position) -->
<div class="fixed bottom-24 right-4 z-40 w-80 rounded-xl border border-surface-border bg-surface-overlay/95 p-4 shadow-xl backdrop-blur-sm">
	<h3 class="text-sm font-semibold text-text-primary">L2/L3 Document Integration</h3>
	<ul class="mt-3 space-y-2 text-xs text-text-secondary">
		<li class="flex items-start gap-2">
			<span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coord-route-solid"></span>
			<span><strong>L2 Preview:</strong> Hover over document citations to see a preview card</span>
		</li>
		<li class="flex items-start gap-2">
			<span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500"></span>
			<span><strong>L3 Full View:</strong> Click "View Full" in preview or citation detail</span>
		</li>
		<li class="flex items-start gap-2">
			<span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"></span>
			<span><strong>Key Moments:</strong> Document views are captured in the footer timeline</span>
		</li>
		<li class="flex items-start gap-2">
			<span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"></span>
			<span><strong>Web Citations:</strong> Show simple tooltips (no document preview)</span>
		</li>
	</ul>
</div>

<style>
	.demo-page {
		font-family: 'Satoshi', ui-sans-serif, system-ui, -apple-system, sans-serif;
	}

	/* Stream de-emphasis when L3 document view is active */
	.stream-container {
		opacity: 1;
		transition:
			opacity 300ms ease-out,
			margin-right 300ms ease-out;
	}

	.stream-container.de-emphasized {
		opacity: 0.4;
	}
</style>
