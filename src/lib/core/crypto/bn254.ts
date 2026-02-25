/**
 * BN254 (alt_bn128) scalar field constants.
 *
 * The BN254 curve's scalar field (Fr) has order p, a ~254-bit prime.
 * All ZK circuit field elements must be in [0, p).
 *
 * This module is the single source of truth for BN254 constants in the
 * communique codebase. Do NOT import BN254_MODULUS from @voter-protocol/*
 * packages — the npm builds may not export it.
 */

/** BN254 scalar field modulus (Fr order) */
export const BN254_MODULUS =
	21888242871839275222246405745257275088548364400416034343698204186575808495617n;
