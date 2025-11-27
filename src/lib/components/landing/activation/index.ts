/**
 * Activation Components - Perceptual Engineering
 *
 * The activation surface pattern replaces the traditional "hero + content" layout
 * with an immediately actionable interface where both primary affordances
 * (creation and browsing) are visible and accessible without abstract buttons.
 *
 * Components:
 * - CreationSpark: Inline creation entry point (visible writing surface)
 * - ActivationSurface: Split layout composing creation + template stream
 * - CoordinationExplainer: Collapsible "how it works" with RelayLoom
 * - ContextFooter: Minimal persistent context for sticky sidebar
 */

export { default as CreationSpark } from './CreationSpark.svelte';
export { default as ActivationSurface } from './ActivationSurface.svelte';
export { default as CoordinationExplainer } from './CoordinationExplainer.svelte';
export { default as ContextFooter } from './ContextFooter.svelte';
