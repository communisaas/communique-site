/**
 * Feature flags — flip to `true` when ready to reveal.
 *
 * These are compile-time constants. Svelte's dead-code elimination
 * will strip the gated UI from the bundle when a flag is `false`.
 */
export const FEATURES = {
	/** Deliberation surfaces, argument submission, LMSR market, resolution/appeal */
	DEBATE: false,

	/** CWC delivery, district officials, congressional template routing */
	CONGRESSIONAL: false,

	/** Address collection forms, district lookup, geocoding, location-based filtering */
	ADDRESS_VERIFICATION: false,

	/** Stance registration (support/oppose), TrustJourney signal strength, verified positions */
	STANCE_POSITIONS: false,

	/** Wallet connect, balance display, on-chain identity */
	WALLET: false
} as const;
