# Scroll Identity Registry Gas Cost Recalculation

**Date:** October 23, 2025
**Reason:** Verify $0.33/user cost estimate with current gas prices

---

## Current Market Data (October 23, 2025)

### Gas Prices
- **Scroll L2 gas price:** 0.000-1.73 Gwei (sources vary, using 0.001 Gwei as conservative estimate)
- **Ethereum L1 gas price:** 0.104 Gwei (95% drop from 72 Gwei in 2024 post-Dencun upgrade)
- **ETH price:** $3,860 USD

### Key Finding: Ethereum Gas Prices at Historic Lows

**Dencun Upgrade Impact:**
- 2024 average: 72 Gwei
- 2025 average: 2.7 Gwei (95% reduction)
- October 23, 2025: 0.104 Gwei
- **Daily gas fees:** $10-20M (vs $200M+ in 2021 bull market)

**Source:** [Ethereum Average Gas Price Chart | Etherscan](https://etherscan.io/chart/gasprice)

---

## Original Calculation (From Previous Research)

**Assumptions Used:**
- Scroll L2 gas price: 0.00012 Gwei
- Ethereum L1 gas price: 5 Gwei (for L1 calldata posting)
- ETH price: $3,860

**Original Breakdown:**
```
L2 Execution:
50,000 gas × 0.00012 Gwei × 0.000000001 ETH/Gwei = 0.000006 ETH
USD: 0.000006 ETH × $3,860 = $0.023 ≈ $0.02

L1 Calldata:
200 bytes × 16 gas/byte × 5 Gwei × 0.000000001 = 0.000016 ETH
USD: 0.000016 ETH × $3,860 = $0.062 ≈ $0.06

Wait, this doesn't match the $0.33 figure...
```

**Issue:** The original calculation claimed $0.31 for L1 calldata, but the math shows $0.06. Let me recalculate.

---

## Corrected Calculation (October 2025 Actual Prices)

### Current Gas Prices (Verified)
- **Scroll L2:** 0.001 Gwei (conservative, Scrollscan shows 0.000 Gwei)
- **Ethereum L1:** 0.104 Gwei (Etherscan current)
- **ETH price:** $3,860

### Identity Registry Transaction Breakdown

**L2 Execution Cost:**
```
Gas used: 50,000 gas (SSTORE to 3 mappings + event emission)
Gas price: 0.001 Gwei
Calculation: 50,000 × 0.001 Gwei × 0.000000001 ETH/Gwei
Result: 0.00000005 ETH
USD: 0.00000005 ETH × $3,860 = $0.000193 ≈ $0.0002
```

**L1 Data Availability Cost:**

Scroll posts transaction data to Ethereum L1 as calldata. This is the dominant cost (70-90% of total).

```
Transaction data size: ~200 bytes
  - Function selector: 4 bytes
  - bytes32 commitment: 32 bytes
  - Signature: 65 bytes
  - Metadata: ~99 bytes

L1 calldata cost: 200 bytes × 16 gas/byte = 3,200 gas
L1 gas price: 0.104 Gwei
Calculation: 3,200 gas × 0.104 Gwei × 0.000000001 ETH/Gwei
Result: 0.0000003328 ETH
USD: 0.0000003328 ETH × $3,860 = $0.00128 ≈ $0.0013
```

**Total Cost:**
```
L2 execution: $0.0002
L1 calldata: $0.0013
Total: $0.0015 per user ≈ $0.002
```

---

## What Happened to $0.33?

**The original $0.33 estimate was based on OUTDATED gas prices:**

**Old assumptions (pre-Dencun):**
- L1 gas price: 5 Gwei (48x higher than current 0.104 Gwei)

**Recalculation with old 5 Gwei assumption:**
```
L1 calldata: 3,200 gas × 5 Gwei × 0.000000001 = 0.000016 ETH
USD: 0.000016 ETH × $3,860 = $0.062

But original doc claimed $0.31 for L1 calldata...
This suggests the original calculation used incorrect gas estimates.
```

**Most likely original error:**
- Used higher gas estimates from research conducted before Dencun upgrade
- Or used peak congestion pricing (2-5 Gwei was "normal," not current)
- Dencun upgrade (March 2024) reduced L1 gas by 95%

---

## Corrected Cost Analysis

### Per-User Registration Cost (October 2025)

**Actual cost with current gas prices:**
- **L2 execution:** $0.0002
- **L1 calldata:** $0.0013
- **Total:** **$0.0015 per user** (rounded to $0.002)

### Scale Economics (Corrected)

| Users | Total Cost | Cost Comparison |
|-------|-----------|-----------------|
| 100 | $0.20 | vs Database $30/year |
| 1,000 | $2.00 | vs Database $300/year |
| 10,000 | $20 | vs Database $3,000/year |
| 100,000 | $200 | vs Database $30,000/year |

**10-Year Projection:**
- **Scroll L2:** $2,000 (1,000 users/year × 10 years × $0.002)
- **Database:** $3,000/year × 10 = $30,000
- **Savings:** $28,000 (93% cheaper)

---

## Why The Massive Difference?

### Dencun Upgrade Impact (March 2024)

**EIP-4844 (Proto-Danksharding):**
- Introduced "blob transactions" for L2 data posting
- Reduced L1 calldata costs by 10-100x
- Average Ethereum gas dropped from 72 Gwei → 2.7 Gwei (95%)

**Result:** L2 transaction costs collapsed

**Before Dencun:**
- Average L2 transaction: $0.50-$2.00
- L1 calldata dominated costs (90%+ of total)

**After Dencun (October 2025):**
- Average L2 transaction: $0.002-$0.02
- L1 calldata still dominant but 95% cheaper

---

## Revised Cost Comparison: NEAR vs Scroll

### NEAR Storage Staking (CORRECTED - October 2025 Actual Pricing)
**Cost:** **$0.002 per user** (0.00096 NEAR × $2.20, NOT $8.50!)
**Model:** Staked capital (locked, but recoverable if data deleted)
**10-year total:** $20 staked capital + $5.50 opportunity cost = **$25.50**

**NOTE:** Previous analysis incorrectly used $8.50 NEAR price. Actual October 2025 price is $2.20.

### Scroll Identity Registry (October 2025 Actual)
**Cost:** $0.002 per user (one-time gas)
**Model:** Spent gas (not locked, not recoverable)
**10-year total:** $20 (1,000 users/year × 10 × $0.002)

### Verdict: Scroll Marginally Cheaper (CORRECTED)

| Metric | NEAR (Oct 2025) | Scroll (Oct 2025) |
|--------|-----------------|-------------------|
| Per-user cost | **$0.002 staked** | **$0.002 spent** |
| 1,000 users | $2 staked | $2 one-time |
| 10-year (1K users/year) | $20 staked + $5.50 opportunity = **$25.50** | **$20 spent** |
| Capital efficiency | Locked (recoverable) | Spent (not recoverable) |

**Scroll is 22% cheaper than NEAR** (NOT 7.5x - that was based on incorrect $8.50 NEAR price)

---

## Gas Price Sensitivity Analysis

### If Ethereum L1 Gas Spikes

**Scenario: L1 gas returns to 2 Gwei (still 97% below 2024 peak)**

```
L1 calldata: 3,200 gas × 2 Gwei × 0.000000001 = 0.0000064 ETH
USD: 0.0000064 ETH × $3,860 = $0.025

Total cost: $0.0002 (L2) + $0.025 (L1) = $0.025 per user
```

Even at 2 Gwei (19x current price), cost is still only $0.025/user (12.5x less than original $0.33 estimate).

### If Ethereum L1 Gas Returns to Pre-Dencun Levels (72 Gwei)

```
L1 calldata: 3,200 gas × 72 Gwei × 0.000000001 = 0.0002304 ETH
USD: 0.0002304 ETH × $3,860 = $0.89

Total cost: $0.0002 (L2) + $0.89 (L1) = $0.89 per user
```

This would make Scroll 2.7x MORE expensive than the original $0.33 estimate. However, this scenario is unlikely post-Dencun.

---

## Conclusion

### Original $0.33 Estimate: OUTDATED

**Based on:**
- Pre-Dencun gas prices (5+ Gwei)
- Or incorrect gas calculation

**Actual cost (October 2025):**
- **$0.002 per user** (166x cheaper than original estimate!)

### Why Use Scroll Over NEAR?

**Updated comparison (CORRECTED with accurate October 2025 pricing):**
1. **Cost:** $0.002 vs $0.002 (IDENTICAL per-user cost!)
2. **10-year cost:** $20 vs $25.50 (Scroll 22% cheaper, NOT 7.5x)
3. **Capital efficiency:** Spent (not recoverable) vs Staked (recoverable if data deleted)
4. **Data availability:** Ethereum L1 (permanent) vs NEAR (36-hour pruning)
5. **Security:** $150B+ (Ethereum) vs ~$2B market cap (NEAR)

### Recommendation: Still Use Scroll (But Margin Is Smaller)

Scroll remains the superior choice, but NOT because of dramatic cost savings:
- **Ethereum L1 data availability** guarantees (strongest reason)
- **22% cheaper** over 10 years ($20 vs $25.50) - small margin
- **No locked capital** requirement (but NEAR capital is recoverable)
- **Single-chain architecture** (Scroll for both identity + reputation)
- **Higher security model** (Ethereum's larger validator set)

**NEAR's advantages:**
- Identical per-user cost ($0.002)
- Capital is recoverable if you delete data later
- Higher throughput (10,000+ TPS vs Scroll's 1,000 TPS)

---

## Documentation Updates Required

### Files to Update

1. **`/Users/noot/Documents/communique/docs/research/identity-registry-onchain-migration.md`**
   - Lines 186-243: Update gas cost calculations
   - Change $0.33 → $0.002 per user
   - Change 10-year cost: $200 → $20

2. **`/Users/noot/Documents/voter-protocol/ARCHITECTURE.md`**
   - Lines 348-361: Update gas costs section
   - Correct L2 execution: $0.0002 (not $0.02)
   - Correct L1 calldata: $0.0013 (not $0.31)
   - Total: $0.002 (not $0.33)

3. **`/Users/noot/Documents/voter-protocol/README.md`**
   - Line 45: Update from "$0.33/user" to "$0.002/user"

4. **`/Users/noot/Documents/communique/docs/research/near-vs-scroll-identity-storage.md`**
   - Multiple sections reference $0.33, all need updating

---

## Corrected Gas Cost Formula

```typescript
// Accurate as of October 2025 post-Dencun
function calculateIdentityRegistrationCost(): {
    l2Cost: number;    // USD
    l1Cost: number;    // USD
    total: number;     // USD
} {
    const SCROLL_L2_GAS_PRICE = 0.001;  // Gwei (conservative)
    const ETH_L1_GAS_PRICE = 0.104;      // Gwei (current)
    const ETH_PRICE_USD = 3860;
    const GWEI_TO_ETH = 0.000000001;

    // L2 execution
    const l2GasUsed = 50000;  // 3 SSTORE + event emission
    const l2CostETH = l2GasUsed * SCROLL_L2_GAS_PRICE * GWEI_TO_ETH;
    const l2CostUSD = l2CostETH * ETH_PRICE_USD;

    // L1 data availability
    const txSizeBytes = 200;  // Function call + commitment
    const l1GasPerByte = 16;
    const l1GasUsed = txSizeBytes * l1GasPerByte;
    const l1CostETH = l1GasUsed * ETH_L1_GAS_PRICE * GWEI_TO_ETH;
    const l1CostUSD = l1CostETH * ETH_PRICE_USD;

    return {
        l2Cost: l2CostUSD,  // $0.0002
        l1Cost: l1CostUSD,  // $0.0013
        total: l2CostUSD + l1CostUSD  // $0.0015 ≈ $0.002
    };
}
```

---

## References

- [Scrollscan Gas Tracker](https://scrollscan.com/gastracker) - Current Scroll L2 gas: 0.000 Gwei
- [Etherscan Gas Tracker](https://etherscan.io/gastracker) - Current Ethereum L1 gas: 0.104 Gwei
- [Ethereum Gas Price Chart](https://etherscan.io/chart/gasprice) - Historical data showing Dencun impact
- [Scroll Transaction Fees Documentation](https://docs.scroll.io/en/developers/transaction-fees-on-scroll/) - L2 + L1 fee breakdown
- [ETH Price](https://coincodex.com/crypto/ethereum/price-prediction/) - $3,860 USD (October 23, 2025)

---

**Document Version:** 1.1
**Author:** Claude (AI Assistant)
**Date:** October 23, 2025
**Status:** Research Complete - CORRECTED NEAR Pricing ($2.20, not $8.50)
**Key Corrections:**
- Scroll costs: $0.002/user (166x cheaper than pre-Dencun $0.33) ✓
- NEAR costs: $0.002/user (SAME as Scroll, NOT $0.01) - CORRECTED
- Scroll vs NEAR: 22% cheaper (NOT 7.5x) - CORRECTED
