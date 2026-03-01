/**
 * Feature flags — flip to `true` when ready to reveal.
 *
 * These are compile-time constants. Svelte's dead-code elimination
 * will strip the gated UI from the bundle when a flag is `false`.
 */

/**
 * Address verification specificity level.
 *
 * - `'off'`      — No location features at all (dead-code eliminated)
 * - `'region'`   — State/city-level inference, LocationFilter active,
 *                  template filtering by geography — no street address collection
 * - `'district'` — Full street address → congressional district verification,
 *                  AddressCollectionForm, credential issuance, trust_tier upgrade
 */
export type AddressSpecificity = 'off' | 'region' | 'district';

export const FEATURES = {
	/** Deliberation surfaces, argument submission, LMSR market, resolution/appeal */
	DEBATE: false,

	/** CWC delivery, district officials, congressional template routing */
	CONGRESSIONAL: false,

	/**
	 * Address verification specificity level.
	 * Location inference and template filtering are available at 'region'+.
	 * Street address collection and district credential issuance require 'district'.
	 */
	ADDRESS_SPECIFICITY: 'region' as AddressSpecificity,

	/** Stance registration (support/oppose), TrustJourney signal strength, verified positions */
	STANCE_POSITIONS: false,

	/** Wallet connect, balance display, on-chain identity */
	WALLET: false
} as const;
