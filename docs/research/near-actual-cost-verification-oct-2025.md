# NEAR Storage Cost Verification (Actual October 2025 Pricing)

**Date:** October 23, 2025
**Critical Issue:** Previous analysis used incorrect NEAR price ($8.50 vs actual $2.20)

---

## Corrected NEAR Pricing

### Current Market Data (October 23, 2025)

**NEAR Token Price:** $2.20 USD (actual current price, NOT $8.50)
- Source: CoinMarketCap, CoinGecko
- Previous analysis used $8.50 (WRONG!)

### NEAR Storage Staking (CORRECTED)

**Storage cost formula:**
- **1E19 yoctoNEAR per byte** = 0.00001 NEAR per byte
- Alternative: 100KB per 1 NEAR token

**Identity Commitment Storage (96 bytes per user):**
```
Data per user:
- bytes32 commitment: 32 bytes
- uint256 timestamp: 32 bytes
- address mapping: 32 bytes
Total: 96 bytes per user

Storage staking required:
96 bytes × 0.00001 NEAR/byte = 0.00096 NEAR per user

USD cost (CORRECTED):
0.00096 NEAR × $2.20 = $0.002112 ≈ $0.002 per user

1,000 users: 1,000 × $0.002 = $2 staked
```

**CRITICAL FINDING: NEAR costs $0.002/user, SAME as Scroll L2!**

---

## Recalculated Cost Comparison: NEAR vs Scroll

### Per-User Costs (October 2025 Actual Pricing)

| Metric | NEAR | Scroll L2 | Winner |
|--------|------|-----------|--------|
| **Per-user cost** | $0.002 staked | $0.002 one-time | **TIE** |
| **1,000 users** | $2 staked | $2 spent | **TIE** |
| **10,000 users** | $20 staked | $20 spent | **TIE** |

### 10-Year Cost Analysis (1,000 users/year)

#### NEAR Storage Staking
```
Year 1: $2 staked (1,000 users)
Year 2: $2 staked (1,000 new users)
...
Year 10: $2 staked (1,000 new users)

Total staked capital: 10 × $2 = $20 (locked forever)

Opportunity cost (5% APY):
Year 1: $2 × 5% × 10 years = $1
Year 2: $2 × 5% × 9 years = $0.90
...
Year 10: $2 × 5% × 1 year = $0.10

Total opportunity cost: ~$5.50

TRUE 10-YEAR COST (NEAR): $20 staked + $5.50 opportunity = $25.50
```

#### Scroll L2 Gas Fees
```
Year 1: $2 spent (1,000 users)
Year 2: $2 spent (1,000 users)
...
Year 10: $2 spent (1,000 users)

Total spent: 10 × $2 = $20 (no lock-up, no opportunity cost)

TRUE 10-YEAR COST (Scroll): $20 spent
```

### Corrected Verdict

**Scroll is ~22% cheaper than NEAR** when accounting for opportunity cost ($20 vs $25.50)

But this is **NOT 7.5x cheaper** as previous analysis claimed!

---

## Where Previous Analysis Went Wrong

### Error 1: NEAR Price
**Claimed:** $8.50/NEAR
**Actual:** $2.20/NEAR
**Impact:** Overestimated NEAR costs by 3.86x

### Error 2: 10-Year Calculation
**Original claim:** NEAR costs $150 over 10 years
**Actual (corrected):** NEAR costs $25.50 over 10 years

**Original calculation breakdown:**
```
Year 1: $10 staked (WRONG - used $8.50 NEAR price)
Years 2-10: $90 staked (WRONG)
Opportunity cost: $50 (WRONG - based on inflated principal)

Total: $150 (COMPLETELY WRONG)
```

**Corrected calculation:**
```
Total staked: $20 (CORRECT - using $2.20 NEAR price)
Opportunity cost: $5.50 (CORRECT - 5% APY on growing principal)

Total: $25.50 (CORRECT)
```

---

## Revised Cost Comparison: Scroll vs NEAR vs Database

| Solution | Per-User | 10-Year (1K/year) | Capital Model | Winner |
|----------|----------|-------------------|---------------|--------|
| **Scroll L2** | $0.002 | **$20** | Spent (no lock-up) | ✅ **Best** |
| **NEAR** | $0.002 | **$25.50** | Staked (locked) | 🟡 Close 2nd |
| **Database** | $0.30/year | **$3,000** | Recurring | ❌ 150x more expensive |

### Key Insights

1. **Per-user costs are IDENTICAL:** Both Scroll and NEAR cost $0.002/user
2. **Scroll wins on capital efficiency:** No locked capital vs $20 locked on NEAR
3. **Scroll wins on opportunity cost:** No APY loss vs $5.50 lost on NEAR
4. **Margin is small:** Scroll only 22% cheaper, NOT 7.5x as claimed

---

## Why Scroll Still Wins (Updated Rationale)

### 1. Capital Efficiency
- **Scroll:** $20 spent over 10 years (no lock-up)
- **NEAR:** $20 locked forever + $5.50 opportunity cost

**Winner:** Scroll (capital not tied up)

### 2. Data Availability
- **Scroll:** Inherits Ethereum L1 (permanent, immutable)
- **NEAR:** NEAR validators (36-hour pruning for full nodes)

**Winner:** Scroll (Ethereum L1 security)

### 3. Integration Complexity
- **Scroll:** Same chain as ERC-8004 reputation (simple)
- **NEAR:** Multi-chain bridge required (complex)

**Winner:** Scroll (single-chain architecture)

### 4. Decentralization
- **Scroll:** Ethereum L1 (900k+ validators, $150B+ staked)
- **NEAR:** NEAR L1 (~100 validators, ~$2B market cap)

**Winner:** Scroll (more decentralized data availability)

### 5. Failure Recovery
- **Scroll:** Trustless (data on Ethereum L1 forever)
- **NEAR:** Social consensus (requires coordinated recovery)

**Winner:** Scroll (trustless recovery)

---

## Corrected Recommendation

**Use Scroll L2 for identity storage** because:

1. **Same per-user cost:** $0.002/user (identical to NEAR)
2. **Lower total cost:** $20 vs $25.50 over 10 years (22% cheaper)
3. **No locked capital:** Spend $20 vs lock $20 forever
4. **Better data availability:** Ethereum L1 permanence
5. **Simpler integration:** Same chain as reputation system
6. **Stronger decentralization:** Ethereum's larger validator set

**NEAR would be better if:**
- You need high-throughput (10,000+ TPS)
- You plan to delete identity data later (recover staked NEAR)
- You're already using NEAR for other infrastructure

**But for permanent, low-frequency identity commitments:** Scroll wins by a small margin (22% cheaper + better architecture).

---

## Action Items: Documentation Updates Required

### Files with INCORRECT NEAR cost claims:

1. **`/Users/noot/Documents/communique/docs/research/near-vs-scroll-identity-storage.md`**
   - Line 41: Claims $0.01/user (should be $0.002/user)
   - Line 54: Claims $150 total cost (should be $25.50)
   - Line 84: Claims NEAR loses 7.5x (should be wins by 22%)
   - **ENTIRE DOCUMENT NEEDS REVISION**

2. **`/Users/noot/Documents/communique/docs/research/scroll-gas-cost-recalculation-oct-2025.md`**
   - Line 169: Claims "Scroll 7.5x cheaper" (should be "Scroll 22% cheaper")
   - Line 183-186: Cost comparison table WRONG

3. **`/Users/noot/Documents/voter-protocol/ARCHITECTURE.md`**
   - Line 393: May reference NEAR costs incorrectly

### Critical Error to Fix

**STOP CLAIMING:**
- "Scroll 7.5x cheaper than NEAR"
- "NEAR costs $150 over 10 years"
- "NEAR costs $0.01/user"

**START SAYING:**
- "Scroll 22% cheaper than NEAR (when including opportunity cost)"
- "NEAR costs $25.50 over 10 years vs Scroll's $20"
- "Both cost $0.002/user, but Scroll has no locked capital"

---

## The Real Comparison (Honest Version)

**NEAR and Scroll have IDENTICAL per-user costs ($0.002).**

The difference is:
- **Scroll:** You spend $20 over 10 years (no lock-up)
- **NEAR:** You lock $20 forever + lose $5.50 in opportunity cost

**Scroll wins by a small margin (22%), NOT the massive 7.5x difference we claimed.**

The real reasons to choose Scroll:
1. ✅ Ethereum L1 data availability (stronger than NEAR's sharded model)
2. ✅ Single-chain integration (same as ERC-8004 reputation)
3. ✅ No locked capital (capital efficiency)
4. ✅ Proven security model ($150B+ Ethereum vs ~$2B NEAR)

**NOT** because it's "7.5x cheaper" (that was a calculation error).

---

**Document Version:** 1.0
**Author:** Claude (AI Assistant)
**Date:** October 23, 2025
**Status:** CRITICAL CORRECTION - Previous NEAR cost analysis was WRONG
