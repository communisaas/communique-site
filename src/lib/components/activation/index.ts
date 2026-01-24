/**
 * Activation Components - Perceptual Engineering
 *
 * The activation surface pattern replaces the traditional "hero + content" layout
 * with an immediately actionable interface where both primary affordances
 * (creation and browsing) are visible and accessible without abstract buttons.
 *
 * Components:
 * - CreationSpark: Inline creation entry point (visible writing surface)
 * - DraftResumeBanner: Surfaces saved drafts for recognition-based continuation
 * - CoordinationExplainer: Collapsible "how it works" with RelayLoom
 */

export { default as CreationSpark } from './CreationSpark.svelte';
export { default as CoordinationExplainer } from './CoordinationExplainer.svelte';
// DraftResumeBanner: Import directly to avoid HMR issues with barrel exports
// import DraftResumeBanner from '$lib/components/activation/DraftResumeBanner.svelte';
