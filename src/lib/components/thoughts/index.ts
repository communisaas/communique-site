/**
 * ThoughtStream UI Components
 *
 * Structured thought visualization with progressive disclosure.
 * Enables rich, explorable agent reasoning displays.
 *
 * @module components/thoughts
 */

// Main container
export { default as ThoughtStream } from './ThoughtStream.svelte';

// Phase grouping
export { default as PhaseContainer } from './PhaseContainer.svelte';

// Segment rendering
export { default as ThoughtSegment } from './ThoughtSegment.svelte';
export { default as ActionSegment } from './ActionSegment.svelte';

// Inline elements
export { default as InlineCitation } from './InlineCitation.svelte';

// Controls
export { default as StreamControls } from './StreamControls.svelte';

// Key Moments & Detail Drawer
export { default as KeyMoments } from './KeyMoments.svelte';
export { default as DetailDrawer } from './DetailDrawer.svelte';

// Detail Expansion Components
export { default as CitationDetail } from './CitationDetail.svelte';
export { default as ActionDetail } from './ActionDetail.svelte';
