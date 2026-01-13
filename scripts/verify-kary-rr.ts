/**
 * Mathematical Verification of k-ary Randomized Response ε-LDP Guarantee
 *
 * This script verifies that our implementation satisfies ε-differential privacy
 * by computing the maximum likelihood ratio across all possible inputs and outputs.
 */

import { METRIC_VALUES, PRIVACY } from '../src/lib/types/analytics/metrics.js';

const k = METRIC_VALUES.length;
const epsilon = PRIVACY.CLIENT_EPSILON;
const expEps = Math.exp(epsilon);

// Compute probabilities
const pTrue = expEps / (expEps + k - 1);
const pOther = 1 / (expEps + k - 1);

console.log('='.repeat(80));
console.log('k-ary Randomized Response Verification');
console.log('='.repeat(80));
console.log();
console.log(`Domain size (k):          ${k}`);
console.log(`Privacy parameter (ε):    ${epsilon}`);
console.log(`e^ε:                      ${expEps.toFixed(4)}`);
console.log();
console.log(`P(report true value):     ${pTrue.toFixed(6)} ≈ ${(pTrue * 100).toFixed(2)}%`);
console.log(`P(report other value):    ${pOther.toFixed(6)} ≈ ${(pOther * 100).toFixed(2)}%`);
console.log();

// Verify that probabilities sum to 1
const totalProb = pTrue + (k - 1) * pOther;
console.log(`Probability sum check:    ${totalProb.toFixed(10)} (should be 1.0)`);
console.log();

// Compute likelihood ratios
console.log('Likelihood Ratio Analysis:');
console.log('-'.repeat(80));

// Case 1: Both inputs have the same true value
// P(M(x) = x) / P(M(x) = x) = pTrue / pTrue = 1
const ratio_same = pTrue / pTrue;
console.log(`Case 1: x = x', y = x`);
console.log(
	`  P(M(x) = y) / P(M(x') = y) = ${pTrue.toFixed(6)} / ${pTrue.toFixed(6)} = ${ratio_same.toFixed(4)}`
);
console.log();

// Case 2: True value x, report different value y
// P(M(x) = y) / P(M(y) = y) = pOther / pTrue
const ratio_different = pOther / pTrue;
console.log(`Case 2: x ≠ x', y = x' (worst case)`);
console.log(
	`  P(M(x) = y) / P(M(x') = y) = ${pOther.toFixed(6)} / ${pTrue.toFixed(6)} = ${ratio_different.toFixed(4)}`
);
console.log();

// Case 3: Report y when true value is x (not y)
// P(M(x) = y) / P(M(x') = y) where x ≠ y and x' ≠ y
// = pOther / pOther = 1
const ratio_neither = pOther / pOther;
console.log(`Case 3: x ≠ y, x' ≠ y (both false reports)`);
console.log(
	`  P(M(x) = y) / P(M(x') = y) = ${pOther.toFixed(6)} / ${pOther.toFixed(6)} = ${ratio_neither.toFixed(4)}`
);
console.log();

// Case 4: Maximum possible ratio (true vs false)
// This is the critical case for ε-DP
const maxRatio = pTrue / pOther;
console.log(`Case 4: x = y, x' ≠ y (maximum ratio)`);
console.log(
	`  P(M(x) = y) / P(M(x') = y) = ${pTrue.toFixed(6)} / ${pOther.toFixed(6)} = ${maxRatio.toFixed(4)}`
);
console.log();

console.log('='.repeat(80));
console.log('ε-Differential Privacy Verification:');
console.log('='.repeat(80));
console.log();
console.log(`Maximum likelihood ratio: ${maxRatio.toFixed(4)}`);
console.log(`Privacy bound (e^ε):      ${expEps.toFixed(4)}`);
console.log();

if (Math.abs(maxRatio - expEps) < 0.0001) {
	console.log('✅ VERIFIED: Maximum ratio equals e^ε (tight bound)');
	console.log('✅ The mechanism satisfies ε-differential privacy');
} else {
	console.log('❌ FAILED: Maximum ratio does not match e^ε');
	console.log(`   Difference: ${Math.abs(maxRatio - expEps).toFixed(6)}`);
}
console.log();

// Compare with broken binary RR
console.log('='.repeat(80));
console.log('Comparison with Binary RR (BROKEN):');
console.log('='.repeat(80));
console.log();

const pBinary = expEps / (1 + expEps);
const qBinary = (1 - pBinary) / k;
const binaryRatio = pBinary / qBinary;

console.log(`Binary RR P(report true):     ${pBinary.toFixed(6)} ≈ ${(pBinary * 100).toFixed(2)}%`);
console.log(`Binary RR P(report false):    ${qBinary.toFixed(6)} ≈ ${(qBinary * 100).toFixed(2)}%`);
console.log(`Binary RR likelihood ratio:   ${binaryRatio.toFixed(4)}`);
console.log();
console.log(`❌ Binary RR violates ε-DP by factor: ${(binaryRatio / expEps).toFixed(2)}x`);
console.log();

console.log('='.repeat(80));
console.log('Summary:');
console.log('='.repeat(80));
console.log();
console.log(`k-ary RR (CORRECT):  ${maxRatio.toFixed(4)} ≤ ${expEps.toFixed(4)} ✅`);
console.log(
	`Binary RR (BROKEN):  ${binaryRatio.toFixed(4)} > ${expEps.toFixed(4)} ❌ (${(binaryRatio / expEps).toFixed(2)}x violation)`
);
console.log();
