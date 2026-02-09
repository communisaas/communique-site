/**
 * Unit tests for TokenUsage utilities
 *
 * Tests: sumTokenUsage, extractTokenUsage, computeCostUsd
 */

import { describe, it, expect } from 'vitest';
import { sumTokenUsage, type TokenUsage } from '../../../src/lib/core/agents/types';
import { extractTokenUsage } from '../../../src/lib/core/agents/gemini-client';
import { computeCostUsd } from '../../../src/lib/server/llm-cost-protection';

describe('sumTokenUsage', () => {
	it('returns undefined when all inputs are undefined', () => {
		expect(sumTokenUsage()).toBeUndefined();
		expect(sumTokenUsage(undefined, undefined)).toBeUndefined();
	});

	it('returns the single input when only one is defined', () => {
		const usage: TokenUsage = {
			promptTokens: 100,
			candidatesTokens: 50,
			totalTokens: 150
		};
		expect(sumTokenUsage(usage)).toEqual(usage);
		expect(sumTokenUsage(undefined, usage, undefined)).toEqual(usage);
	});

	it('sums multiple token usages', () => {
		const a: TokenUsage = { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 };
		const b: TokenUsage = { promptTokens: 200, candidatesTokens: 100, totalTokens: 300 };
		const c: TokenUsage = { promptTokens: 50, candidatesTokens: 25, totalTokens: 75 };

		expect(sumTokenUsage(a, b, c)).toEqual({
			promptTokens: 350,
			candidatesTokens: 175,
			thoughtsTokens: undefined,
			totalTokens: 525
		});
	});

	it('handles mixed defined and undefined inputs', () => {
		const a: TokenUsage = { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 };
		const b: TokenUsage = { promptTokens: 200, candidatesTokens: 100, totalTokens: 300 };

		expect(sumTokenUsage(a, undefined, b)).toEqual({
			promptTokens: 300,
			candidatesTokens: 150,
			thoughtsTokens: undefined,
			totalTokens: 450
		});
	});

	it('sums thoughtsTokens when present on any input', () => {
		const a: TokenUsage = {
			promptTokens: 100,
			candidatesTokens: 50,
			thoughtsTokens: 500,
			totalTokens: 650
		};
		const b: TokenUsage = { promptTokens: 200, candidatesTokens: 100, totalTokens: 300 };

		const result = sumTokenUsage(a, b);
		expect(result?.thoughtsTokens).toBe(500);
	});

	it('omits thoughtsTokens when absent from all inputs', () => {
		const a: TokenUsage = { promptTokens: 100, candidatesTokens: 50, totalTokens: 150 };
		const b: TokenUsage = { promptTokens: 200, candidatesTokens: 100, totalTokens: 300 };

		const result = sumTokenUsage(a, b);
		expect(result?.thoughtsTokens).toBeUndefined();
	});
});

describe('extractTokenUsage', () => {
	it('returns undefined when usageMetadata is absent', () => {
		const response = { text: 'hello' } as never;
		expect(extractTokenUsage(response)).toBeUndefined();
	});

	it('extracts token counts from usageMetadata', () => {
		const response = {
			text: 'hello',
			usageMetadata: {
				promptTokenCount: 1500,
				candidatesTokenCount: 800,
				thoughtsTokenCount: 2000,
				totalTokenCount: 4300
			}
		} as never;

		expect(extractTokenUsage(response)).toEqual({
			promptTokens: 1500,
			candidatesTokens: 800,
			thoughtsTokens: 2000,
			totalTokens: 4300
		});
	});

	it('defaults missing counts to 0', () => {
		const response = {
			text: 'hello',
			usageMetadata: {}
		} as never;

		expect(extractTokenUsage(response)).toEqual({
			promptTokens: 0,
			candidatesTokens: 0,
			thoughtsTokens: undefined,
			totalTokens: 0
		});
	});

	it('handles partial usageMetadata', () => {
		const response = {
			text: 'hello',
			usageMetadata: {
				promptTokenCount: 500,
				totalTokenCount: 500
			}
		} as never;

		expect(extractTokenUsage(response)).toEqual({
			promptTokens: 500,
			candidatesTokens: 0,
			thoughtsTokens: undefined,
			totalTokens: 500
		});
	});
});

describe('computeCostUsd', () => {
	it('returns undefined when tokenUsage is undefined', () => {
		expect(computeCostUsd()).toBeUndefined();
		expect(computeCostUsd(undefined)).toBeUndefined();
	});

	it('computes cost from known token counts', () => {
		// 1M input tokens at $0.075 + 1M output tokens at $0.30 = $0.375
		const cost = computeCostUsd({
			promptTokens: 1_000_000,
			candidatesTokens: 1_000_000
		});
		expect(cost).toBeCloseTo(0.375, 6);
	});

	it('computes cost for small token counts', () => {
		// 2000 input at $0.075/1M = $0.00015
		// 1000 output at $0.30/1M = $0.0003
		// Total = $0.00045
		const cost = computeCostUsd({
			promptTokens: 2000,
			candidatesTokens: 1000
		});
		expect(cost).toBeCloseTo(0.00045, 8);
	});

	it('returns 0 for zero tokens', () => {
		const cost = computeCostUsd({
			promptTokens: 0,
			candidatesTokens: 0
		});
		expect(cost).toBe(0);
	});
});
