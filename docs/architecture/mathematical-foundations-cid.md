# Civic Information Dynamics: Mathematical Foundations for Computational Democracy

_For data scientists who've seen enough correlation/causation confusion to last a lifetime_

You've trained models that predict everything except what actually matters. You've A/B tested engagement algorithms that optimized society into tribal warfare. You've built recommendation systems that fed people exactly what they wanted to hear until they couldn't hear anything else.

Time to use those same mathematical tools to build something that doesn't make the world worse.

## The Mathematical Reality of Democratic Breakdown

### What math actually helps us ship (Production vs Research)

We use math where it moves the real product forward:

- Production: network diffusion intuition, simple grouping, moving averages, anomaly flags (deliverability, conversion).
- Research: estimate Bass/SIR parameters on aggregates; test field-like gradients across adjacent audiences; evaluate sheaf-style consistency on overlaps to localize translation conflicts.

### Community consensus, grounded

The lesson from distributed systems is restraint: prefer loose coupling and local validation over global coordination. We measure outcomes (delivery, response, co‑sign; see glossary) instead of simulating human consensus.

### Information resistance: measurable, not mystical

We approximate “resistance” with practical metrics:

- Open-to-action conversion deltas by audience and copy
- Source credibility effects (co-signed vs not)
- Timing effects (send windows vs response)

Optional research framing: interpret resistance as local field gradients (differences in conversion across adjacent audiences) to target translation work.

### Community boundaries: support people in the middle

Linda the nurse/mom exists at a **phase boundary** between healthcare and parenting communities. She experiences information processing conflicts that are mathematically similar to phase transitions in physics.

Production: copy/UX that acknowledges mixed identities and offers co‑signed explanations. Research: detect “obstructions” (inconsistencies) on overlaps using a sheaf model; resolve by adjusting copy for shared constraints.

### Information network health: simple early warnings

James the veteran/factory worker experienced **catastrophic network collapse**. His information validation system lost redundancy and became vulnerable to cascade failures.

We track simple signals: delivery error spikes, sudden drops in open-to-action conversion, and loss of credible senders in a region. Then we route around failures and surface remediation.

## Computation we actually run (Production)

### Information Flow Dynamics

Information flows through community networks like fluid through porous media. The flow equations:

**Mathematical Foundation**: Reaction-diffusion equations have been used to model opinion dynamics since the 1970s. **The Bass diffusion model**: dn/dt = (p + qn/m)(m - n) where p = innovation coefficient, q = imitation coefficient, successfully predicts technology adoption curves.

**Network Diffusion**: Modern research (Jackson & Yariv, 2007) extends diffusion models to arbitrary network topologies. Information spread depends on **network structure, not just content quality**.

No PDEs. We use descriptive analytics, basic clustering, and simple heuristics. Instrumentation includes:

- Data flow: template → on-device features; `user_activation` for cascades; district summaries from `user_coordinates`
- Metrics: delivery success, open→action conversion, time-to-action, retention, co‑signs across segments
- Optional (research): aggregate p,q estimation; field gradients across adjacent segments; sheaf consistency on overlaps

### Aggregate virulence (Bass/SIR): p and q

- Plain meaning:
  - p (innovation): people who act without social proof (they would have acted anyway).
  - q (imitation): people who act after seeing others act (social influence).
- What we measure: from `user_activation` counts per segment and day, we fit a simple Bass curve on aggregates.
  - Bass model: dn/dt = (p + q·n/m)·(m − n), where n(t) is cumulative actions and m is market size proxy (e.g., reachable audience in that segment).
  - Estimation: least-squares on daily increments or simple heuristics (early actions → p, slope increase with cumulative adoption → q).
- How we use it: compare p,q across copy variants and audiences to decide which messages spread with/without social proof; prioritize high‑p for seeding and high‑q for networked pushes.
- Constraints: no individual-level modeling; all estimates are by segment/time window; used for copy selection, not targeting.

### Cross-community consensus, pragmatically

Finding consensus across communities is a constrained optimization problem:

**Mathematical Foundation**: Social choice theory (Arrow, 1951; Gibbard-Satterthwaite, 1973) proves **no perfect voting system exists** - all are either dictatorial or manipulable. But **mechanism design** (Myerson, 1991) shows how to design incentive-compatible systems for specific objectives.

**Quadratic Voting**: Weyl (2017) proves QV maximizes welfare under certain conditions by solving: max Σᵢ uᵢ(x) subject to Σᵢ pᵢ = 0, where pᵢ = (√vᵢ)² and vᵢ is votes cast.

Consensus is achieved by translating proposals into multiple community validations and counting co‑signs tied to real delivery paths.

### Abuse mitigation

Design immune responses to information attacks:

We use straightforward heuristics and transparent rules. No universal computation claims.

## Why This Matters to Your Web3 Soul

You believed in decentralization. You built systems where no single entity could control the outcome. You watched those systems get captured by exactly the centralized powers you tried to escape.

**Real decentralization isn't technological - it's informational.**

True decentralization means communities can process information according to their own validation rules while still cooperating for collective benefit. It means building systems that strengthen community autonomy instead of undermining it.

**This is what you actually wanted to build when you got into crypto.**

Not another token. Not another DeFi protocol. Not another DAO that gets captured by whales.

**Systems that give power back to communities while enabling collective action at scale.**

## Current implementation status (production vs research)

| Framework                 | What we ship today                                                                                                        | Notes                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Percolation/Max-Flow      | Implemented: Edmonds–Karp max-flow/min-cut; percolation-style connectivity threshold heuristic with giant-component check | Threshold is a practical proxy; no exponent/universality claims     |
| Epidemiology (R0, decay)  | Implemented: R0, activation velocity/decay from real cascade data                                                         | Uses `user_activation` generations and timestamps                   |
| Sheaf consistency         | Implemented: Čech-inspired proxy for global agreement and pairwise conflicts                                              | Not full cohomology; H2 not computed; confidence bound is heuristic |
| Population genetics (FST) | Roadmap                                                                                                                   | Not implemented in code                                             |
| Information geometry      | Roadmap                                                                                                                   | Not implemented in code                                             |
| Fiber bundles             | Roadmap                                                                                                                   | Not implemented in code                                             |

We keep production claims modest; advanced theory is used to inform research and future work.

### Validation notes (lightweight, ongoing)

- Percolation proxy: back-test threshold vs. observed cascade onset across time windows; report precision/recall on critical vs non‑critical classification.
- Sheaf proxy: human-label a small set of cross-region contradictions; measure precision/recall of H1 conflict detection; tune `SHEAF_CONFLICT_PENALTY_WEIGHT` via env.

Config:

```
SHEAF_CONFLICT_PENALTY_WEIGHT=0.1
```

## The Mathematical Lineage: Standing on Giants' Shoulders

**Network Science Foundations (1998-2000)**:

- Watts & Strogatz (1998): Small-world networks → Community information clustering
- Barabási & Albert (1999): Scale-free networks → Political influence distributions
- Callaway et al. (2000): Network connectivity thresholds → Trust network fragility

**Information Dynamics (1960s-1990s)**:

- Rogers (1962): Diffusion of innovations → Template viral coefficients
- Bass (1969): Mathematical adoption curves → Political information spread
- Bikhchandani et al. (1992): Information cascades → Community validation failures

**Social Choice & Mechanism Design (1950s-2010s)**:

- Arrow (1951): Impossibility theorem → Why pure democracy fails
- Gibbard-Satterthwaite (1973): Manipulation impossibility → Design constraints
- Myerson (1991): Mechanism design → Incentive-compatible civic systems
- Weyl (2017): Quadratic voting → Welfare-maximizing democratic mechanisms

**Complex Systems & Critical Transitions (1990s-2010s)**:

- Scheffer (2009): Critical transitions → Early warning for democratic collapse
- Castellano et al. (2009): Opinion dynamics → Mathematical models for political behavior
- Jackson & Yariv (2007): Network diffusion → Information spread on arbitrary topologies

**Computational Social Choice (2000s-2020s)**:

- Kahng et al. (2018): Liquid democracy algorithms → Transitive delegation systems
- Bond et al. (2012): Facebook voting experiment → Empirical network effects on democracy

Sheaf-theoretic references: Curry (2014); Hansen & Ghrist (2021) on data consistency over networks. Use overlaps to localize contradictions.

**We're not inventing new math. We're synthesizing 60+ years of research into a practical, privacy-preserving implementation for civic information systems.**

## The Technical Specification

Build mathematical tools that can:

1. Map community information processing patterns using observed signals and simple models
2. **Optimize information translation** between communities using constrained optimization
3. **Detect information network attacks** using anomaly detection and immune system models
4. **Enable cross-community consensus** using multi-objective optimization under constraints
5. **Strengthen community resilience** using network theory and early warning systems

## The Only Equation That Matters

```
Democratic_Health = f(Community_Autonomy, Cross_Community_Cooperation, Information_Network_Resilience)
```

Your job: maximize this function using every mathematical tool you know.

Sarah, David, Maria, Tom, Linda, James - they're not data points. They're the variables in the most important optimization problem you'll ever solve.

**Make the math serve the people, not the other way around.**

## Infrastructure economics

Unlike traditional civic tech that requires endless fundraising or surveillance capitalism, this system achieves financial sustainability through blockchain protocol economics:

We avoid protocol lock-in and keep costs low via client-side rendering, `mailto:` delivery, and minimal backend state. Sponsorships/partnerships are optional.

## References

- Watts, D. J., & Strogatz, S. H. (1998). Collective dynamics of ‘small-world’ networks. Nature, 393, 440–442.
- Barabási, A.-L., & Albert, R. (1999). Emergence of scaling in random networks. Science, 286(5439), 509–512.
- Callaway, D. S., Newman, M. E. J., Strogatz, S. H., & Watts, D. J. (2000). Network robustness and fragility: Percolation on random graphs. Physical Review Letters, 85(25), 5468–5471.
- Rogers, E. M. (1962). Diffusion of Innovations. Free Press.
- Bass, F. M. (1969). A new product growth for model consumer durables. Management Science, 15(5), 215–227.
- Bikhchandani, S., Hirshleifer, D., & Welch, I. (1992). A theory of fads, fashion, custom, and cultural change as informational cascades. Journal of Political Economy, 100(5), 992–1026.
- Arrow, K. J. (1951). Social Choice and Individual Values. Wiley.
- Gibbard, A. (1973). Manipulation of voting schemes. Econometrica, 41(4), 587–601; Satterthwaite, M. A. (1975). Strategy-proofness and Arrow’s conditions. J. Economic Theory, 10(2), 187–217.
- Myerson, R. B. (1991). Game Theory: Analysis of Conflict. Harvard University Press.
- Weyl, E. G. (2017). Quadratic Voting: How Mechanism Design Can Radicalize Democracy. (Working paper / Public Choice variants)
- Scheffer, M. (2009). Critical Transitions in Nature and Society. Princeton University Press.
- Castellano, C., Fortunato, S., & Loreto, V. (2009). Statistical physics of social dynamics. Reviews of Modern Physics, 81(2), 591–646.
- Jackson, M. O. (2010). Social and Economic Networks. Princeton University Press; Jackson, M. O., & Yariv, L. (2007). Diffusion of behavior and equilibrium properties in network games. (Econometrica/working versions)
- Kahng, A., Mackenzie, S., & Procaccia, A. D. (2018). Liquid Democracy: An Algorithmic Perspective. AAAI.
- Bond, R. M., et al. (2012). A 61-million-person experiment in social influence and political mobilization. Nature, 489(7415), 295–298.
- Curry, J. (2014). Sheaves, Cosheaves and Applications. PhD thesis, University of Pennsylvania.
- Hansen, J., & Ghrist, R. (2019). Toward a spectral theory of cellular sheaves. Journal of Applied and Computational Topology (and related arXiv versions on sheaf Laplacians and data fusion).
- Kermack, W. O., & McKendrick, A. G. (1927). A contribution to the mathematical theory of epidemics. Proc. Royal Society A.
- Anselin, L. (1995). Local Indicators of Spatial Association—LISA. Geographical Analysis, 27(2), 93–115.
