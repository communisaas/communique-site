// Bubble module — Postal Bubble identity object
//
// Geometry engine: zero-dependency spatial math for per-frame intersection tests
// Client: typed wrapper for Shadow Atlas /v1/bubble-query
// State: Svelte 5 reactive state with derived precision

export {
	toMerc,
	fenceInsideBubble,
	pointInDistrict,
	projectFences,
	projectDistricts,
	computeBubbleState,
	type ProjectedFence,
	type ProjectedDistrict,
	type ApiFence,
	type ApiDistrict,
	type BubbleComputeResult
} from './geometry';

export {
	BubbleClient,
	type BubbleQueryRequest,
	type BubbleQueryResponse,
	type BubbleOfficial,
	type PostalExtent
} from './client';
