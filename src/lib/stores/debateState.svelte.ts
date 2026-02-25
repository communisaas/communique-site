/**
 * Debate State Store — Svelte 5 runes
 *
 * Manages debate data for the current template view and
 * draft argument state during the debate modal flow.
 *
 * Pattern follows guestState.svelte.ts (factory function, exported singleton).
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type Stance = 'SUPPORT' | 'OPPOSE' | 'AMEND';

export interface ArgumentData {
	id: string;
	argumentIndex: number;
	stance: Stance;
	body: string;
	amendmentText?: string;
	stakeAmount: string; // BigInt serialized as string
	engagementTier: number;
	weightedScore: string;
	totalStake: string;
	coSignCount: number;
	createdAt: string;
	currentPrice?: string;
	priceHistory?: Array<{ epoch: number; price: string; timestamp: string }>;
	positionCount?: number;
}

export interface DebateData {
	id: string;
	debateIdOnchain: string;
	templateId: string;
	propositionText: string;
	propositionHash: string;
	actionDomain: string;
	deadline: string;
	jurisdictionSize: number;
	status: 'active' | 'resolved';
	argumentCount: number;
	uniqueParticipants: number;
	totalStake: string;
	arguments: ArgumentData[];
	winningArgumentIndex?: number;
	winningStance?: string;
	resolvedAt?: string;
	// LMSR market state
	marketStatus?: 'pre_market' | 'active' | 'resolved';
	marketLiquidity?: string;
	currentPrices?: Record<number, string>;
	currentEpoch?: number;
	tradeDeadline?: string;
	resolutionDeadline?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_STAKE = 1_000_000; // 1 USDC in 6-decimal

function createDebateState() {
	// Current debate for the viewed template
	let currentDebate = $state<DebateData | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// LMSR price state
	let lmsrPrices = $state<Record<number, number>>({});
	let epochPhase = $state<'commit' | 'reveal' | 'executing' | 'idle'>('idle');
	let epochSecondsRemaining = $state(0);
	let epochCountdownTimer = $state<ReturnType<typeof setInterval> | null>(null);
	let sseConnection = $state<EventSource | null>(null);

	// Draft argument state (persists during modal flow)
	let draftStance = $state<Stance | null>(null);
	let draftBody = $state('');
	let draftAmendment = $state('');
	let draftStake = $state(DEFAULT_STAKE);

	return {
		// ── Getters ──────────────────────────────────────────────────────
		get debate() {
			return currentDebate;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
		get draftStance() {
			return draftStance;
		},
		get draftBody() {
			return draftBody;
		},
		get draftAmendment() {
			return draftAmendment;
		},
		get draftStake() {
			return draftStake;
		},

		get lmsrPrices() {
			return lmsrPrices;
		},
		get epochPhase() {
			return epochPhase;
		},
		get epochSecondsRemaining() {
			return epochSecondsRemaining;
		},
		get isTrading() {
			return epochPhase === 'commit' || epochPhase === 'reveal';
		},

		// ── Derived ──────────────────────────────────────────────────────
		get isActive() {
			return currentDebate?.status === 'active';
		},
		get isResolved() {
			return currentDebate?.status === 'resolved';
		},
		get hasDebate() {
			return currentDebate !== null;
		},

		// ── Setters ──────────────────────────────────────────────────────
		setDebate(debate: DebateData | null) {
			currentDebate = debate;
		},
		setDraftStance(stance: Stance | null) {
			draftStance = stance;
		},
		setDraftBody(body: string) {
			draftBody = body;
		},
		setDraftAmendment(text: string) {
			draftAmendment = text;
		},
		setDraftStake(amount: number) {
			draftStake = amount;
		},

		// ── Actions ──────────────────────────────────────────────────────
		resetDraft() {
			draftStance = null;
			draftBody = '';
			draftAmendment = '';
			draftStake = DEFAULT_STAKE;
		},

		/** Connect to debate SSE stream for real-time price updates */
		connectSSE(debateId: string) {
			this.disconnectSSE();
			const source = new EventSource(`/api/debates/${debateId}/stream`);
			sseConnection = source;

			source.addEventListener('state', (e: MessageEvent) => {
				const data = JSON.parse(e.data);
				if (data.prices) {
					lmsrPrices = Object.fromEntries(
						Object.entries(data.prices).map(([k, v]) => [Number(k), Number(v)])
					);
				}
				epochPhase = data.epochPhase ?? 'idle';
				epochSecondsRemaining = data.epochSecondsRemaining ?? 0;
			});

			source.addEventListener('epoch_executed', (e: MessageEvent) => {
				const data = JSON.parse(e.data);
				if (data.prices) {
					lmsrPrices = Object.fromEntries(
						Object.entries(data.prices).map(([k, v]) => [Number(k), Number(v)])
					);
				}
			});

			source.addEventListener('trade_activity', (e: MessageEvent) => {
				// Could update pending trade count UI
			});

			source.addEventListener('resolved', (e: MessageEvent) => {
				// Reload full debate state on resolution
				if (currentDebate) {
					this.loadDebate(currentDebate.templateId);
				}
			});

			source.onerror = () => {
				// Reconnect after 5s on error
				this.disconnectSSE();
				setTimeout(() => {
					if (currentDebate) {
						this.connectSSE(debateId);
					}
				}, 5000);
			};
		},

		/** Disconnect SSE stream */
		disconnectSSE() {
			if (sseConnection) {
				sseConnection.close();
				sseConnection = null;
			}
			if (epochCountdownTimer) {
				clearInterval(epochCountdownTimer);
				epochCountdownTimer = null;
			}
		},

		/** Start countdown timer for epoch phase */
		startEpochCountdown() {
			if (epochCountdownTimer) clearInterval(epochCountdownTimer);
			epochCountdownTimer = setInterval(() => {
				if (epochSecondsRemaining > 0) {
					epochSecondsRemaining--;
				}
			}, 1000);
		},

		async loadDebate(templateId: string) {
			isLoading = true;
			error = null;
			try {
				const res = await fetch(`/api/debates/by-template/${templateId}`);
				if (res.ok) {
					const data = await res.json();
					currentDebate = data.debate ?? null;
				} else if (res.status === 404) {
					currentDebate = null;
				} else {
					throw new Error(`Failed to load debate (${res.status})`);
				}
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to load debate';
				currentDebate = null;
			} finally {
				isLoading = false;
			}
		},

		clear() {
			this.disconnectSSE();
			currentDebate = null;
			isLoading = false;
			error = null;
			draftStance = null;
			draftBody = '';
			draftAmendment = '';
			draftStake = DEFAULT_STAKE;
		}
	};
}

export const debateState = createDebateState();
