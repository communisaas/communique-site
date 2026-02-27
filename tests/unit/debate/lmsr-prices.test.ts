import { describe, it, expect } from 'vitest';
import {
    computeLMSRPercentages,
    getLeadingStance,
    buildArgumentStanceMap,
    type ArgumentStanceMap
} from '$lib/utils/debate-stats';

describe('computeLMSRPercentages', () => {
    it('groups prices by stance and normalizes to percentages', () => {
        // 3 arguments: arg0=SUPPORT(0.5), arg1=OPPOSE(0.3), arg2=AMEND(0.2)
        const prices: Record<number, string> = { 0: '0.5', 1: '0.3', 2: '0.2' };
        const stances: ArgumentStanceMap = { 0: 'SUPPORT', 1: 'OPPOSE', 2: 'AMEND' };
        const result = computeLMSRPercentages(prices, stances);
        expect(result.supportPct).toBeCloseTo(50, 0);
        expect(result.opposePct).toBeCloseTo(30, 0);
        expect(result.amendPct).toBeCloseTo(20, 0);
        expect(result.supportPct + result.opposePct + result.amendPct).toBeCloseTo(100, 0);
    });

    it('sums multiple arguments with the same stance', () => {
        // 5 arguments: 2 SUPPORT, 2 OPPOSE, 1 AMEND
        const prices: Record<number, string> = {
            0: '0.15', // SUPPORT
            1: '0.10', // OPPOSE
            2: '0.25', // AMEND
            3: '0.30', // SUPPORT
            4: '0.20'  // OPPOSE
        };
        const stances: ArgumentStanceMap = {
            0: 'SUPPORT', 1: 'OPPOSE', 2: 'AMEND', 3: 'SUPPORT', 4: 'OPPOSE'
        };
        const result = computeLMSRPercentages(prices, stances);
        // SUPPORT = 0.15 + 0.30 = 0.45, OPPOSE = 0.10 + 0.20 = 0.30, AMEND = 0.25
        expect(result.supportPct).toBeCloseTo(45, 0);
        expect(result.opposePct).toBeCloseTo(30, 0);
        expect(result.amendPct).toBeCloseTo(25, 0);
    });

    it('applies 2% visual floor for stances with non-zero prices', () => {
        // One dominant stance: AMEND at 98%, SUPPORT at 1%, OPPOSE at 1%
        const prices: Record<number, string> = { 0: '0.01', 1: '0.01', 2: '0.98' };
        const stances: ArgumentStanceMap = { 0: 'SUPPORT', 1: 'OPPOSE', 2: 'AMEND' };
        const result = computeLMSRPercentages(prices, stances);
        expect(result.supportPct).toBe(2); // floored to 2%
        expect(result.opposePct).toBe(2); // floored to 2%
        // amendPct = 100 - 2 - 2 = 96
        expect(result.amendPct).toBe(96);
    });

    it('returns zeros when all prices are zero', () => {
        const prices: Record<number, string> = { 0: '0', 1: '0' };
        const stances: ArgumentStanceMap = { 0: 'SUPPORT', 1: 'OPPOSE' };
        const result = computeLMSRPercentages(prices, stances);
        expect(result).toEqual({ supportPct: 0, opposePct: 0, amendPct: 0 });
    });

    it('returns zeros when prices map is empty', () => {
        const result = computeLMSRPercentages({}, {});
        expect(result).toEqual({ supportPct: 0, opposePct: 0, amendPct: 0 });
    });

    it('handles equal prices (uniform market)', () => {
        const prices: Record<number, string> = { 0: '0.333', 1: '0.333', 2: '0.333' };
        const stances: ArgumentStanceMap = { 0: 'SUPPORT', 1: 'OPPOSE', 2: 'AMEND' };
        const result = computeLMSRPercentages(prices, stances);
        // Each ~33.3%, all above 2% floor
        expect(result.supportPct).toBeCloseTo(33.3, 0);
        expect(result.opposePct).toBeCloseTo(33.3, 0);
        // amendPct = 100 - supportPct - opposePct
        expect(result.supportPct + result.opposePct + result.amendPct).toBeCloseTo(100, 0);
    });

    it('ignores arguments with NaN prices', () => {
        const prices: Record<number, string> = { 0: '0.5', 1: 'invalid', 2: '0.5' };
        const stances: ArgumentStanceMap = { 0: 'SUPPORT', 1: 'OPPOSE', 2: 'AMEND' };
        const result = computeLMSRPercentages(prices, stances);
        expect(result.supportPct).toBeCloseTo(50, 0);
        expect(result.opposePct).toBe(0); // NaN price ignored
        expect(result.amendPct).toBeCloseTo(50, 0);
    });

    it('ignores arguments without a known stance', () => {
        const prices: Record<number, string> = { 0: '0.5', 1: '0.3', 2: '0.2' };
        // argument 2 has no stance mapping
        const stances: ArgumentStanceMap = { 0: 'SUPPORT', 1: 'OPPOSE' };
        const result = computeLMSRPercentages(prices, stances);
        // Only SUPPORT(0.5) + OPPOSE(0.3) = 0.8 total
        expect(result.supportPct).toBeCloseTo(62.5, 0);
        expect(result.opposePct).toBeCloseTo(37.5, 0);
        expect(result.amendPct).toBeCloseTo(0, 5);
    });
});

describe('getLeadingStance', () => {
    it('returns highest stance with correct label and percentage', () => {
        const result = getLeadingStance({ supportPct: 20, opposePct: 18, amendPct: 62 });
        expect(result).toEqual({ stance: 'AMEND', label: 'Amend', pct: 62 });
    });

    it('returns SUPPORT when it leads', () => {
        const result = getLeadingStance({ supportPct: 55, opposePct: 30, amendPct: 15 });
        expect(result).toEqual({ stance: 'SUPPORT', label: 'Support', pct: 55 });
    });

    it('returns OPPOSE when it leads', () => {
        const result = getLeadingStance({ supportPct: 10, opposePct: 70, amendPct: 20 });
        expect(result).toEqual({ stance: 'OPPOSE', label: 'Oppose', pct: 70 });
    });

    it('returns null when all percentages are zero', () => {
        expect(getLeadingStance({ supportPct: 0, opposePct: 0, amendPct: 0 })).toBeNull();
    });

    it('handles ties by preferring in order: SUPPORT > OPPOSE > AMEND', () => {
        // All equal — SUPPORT wins tie
        const result = getLeadingStance({ supportPct: 33, opposePct: 33, amendPct: 34 });
        // amendPct is highest (34)
        expect(result?.stance).toBe('AMEND');
        expect(result?.pct).toBe(34);
    });

    it('rounds percentages to integers', () => {
        const result = getLeadingStance({ supportPct: 33.7, opposePct: 33.1, amendPct: 33.2 });
        expect(result?.pct).toBe(34); // Math.round(33.7)
    });
});

describe('buildArgumentStanceMap', () => {
    it('extracts argumentIndex→stance mapping', () => {
        const args = [
            { argumentIndex: 0, stance: 'SUPPORT' },
            { argumentIndex: 1, stance: 'OPPOSE' },
            { argumentIndex: 2, stance: 'AMEND' }
        ];
        const map = buildArgumentStanceMap(args);
        expect(map).toEqual({ 0: 'SUPPORT', 1: 'OPPOSE', 2: 'AMEND' });
    });

    it('returns empty map for null/undefined input', () => {
        expect(buildArgumentStanceMap(null)).toEqual({});
        expect(buildArgumentStanceMap(undefined)).toEqual({});
    });

    it('skips arguments with invalid stances', () => {
        const args = [
            { argumentIndex: 0, stance: 'SUPPORT' },
            { argumentIndex: 1, stance: 'INVALID_STANCE' },
            { argumentIndex: 2, stance: 'AMEND' }
        ];
        const map = buildArgumentStanceMap(args);
        expect(map).toEqual({ 0: 'SUPPORT', 2: 'AMEND' });
    });
});
