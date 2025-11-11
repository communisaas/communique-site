# Location as Filter, Not Category

**Created**: 2025-11-10
**Status**: Core Design Principle

---

## The Principle

**Location names stand alone. No prefixes. No category labels.**

### ✅ CORRECT

```
Texas
47 coordinating
```

### ❌ WRONG

```
Campaigns in Texas
Issues in Texas
Bills in Texas
```

---

## Why This Matters

### 1. Category Words Carry Baggage

**"Campaigns"**:
- Politically loaded
- Implies fundraising/elections
- Feels like activism industry

**"Issues"**:
- Heavy, problem-focused
- Political connotation
- Negative framing

**"Bills"**:
- Only works for Congress
- Excludes companies, school boards, HOAs
- Too narrow

### 2. Templates Speak for Themselves

The template titles already say what they are:
- "Tell Spotify: Fair artist pay"
- "Austin City Council: Affordable housing"
- "Rep. McCaul: Vote yes on H.R. 1234"

**No need for category label.** Just show them.

### 3. Location = Filter, Not Container

**Bad mental model**: "Issues IN Texas"
- Implies location contains issues
- Category-first thinking
- Adds conceptual overhead

**Good mental model**: "Texas [filter applied]"
- Location is a lens, not a bucket
- Shows what's relevant here
- Simpler cognitive load

### 4. Coordination Count = Signal

**What matters**: How many people are coordinating on this
**Not**: What category bucket it fits in

```
Texas
47 coordinating
```

The number shows activity. The location shows scope. That's it.

---

## Implementation Pattern

### Header Component

```svelte
<header>
  <h1 class="text-3xl font-bold">
    {#if district}
      {district}
    {:else if county}
      {county}
    {:else if state}
      {state}
    {:else}
      Nationwide
    {/if}
  </h1>

  <p class="text-sm text-slate-600">
    {coordinationCount} coordinating
  </p>
</header>
```

**NO "in". NO "campaigns". NO "issues".**

Just the place. Just the count.

### Progressive Refinement Affordances

```svelte
{#if !county && state}
  <button>
    See what's happening in your county →
  </button>
{:else if !district && county}
  <button>
    Find who represents you →
  </button>
{/if}
```

**Affordances can use descriptive language** ("what's happening", "find who represents you").

**Headers stay minimal** (just location name).

---

## Voice Guidance for Future Agents

### When Writing Headers

**ASK**: "Does this need a category label?"
**ANSWER**: No. Location name only.

**ASK**: "Should I say 'Issues in California'?"
**ANSWER**: No. Just "California".

**ASK**: "What about explaining what the page shows?"
**ANSWER**: Coordination count does that. "47 coordinating" tells you there's activity.

### When Writing Template Cards

**ASK**: "Should template cards say 'Campaign' or 'Issue'?"
**ANSWER**: No. Template title is self-explanatory.

**EXAMPLE**:
```
Tell Spotify: Fair artist pay
1,247 sent this
Active in 12 states

[Send Now] [Share]
```

No category label needed. Title says what it is.

### When Writing Navigation

**ASK**: "Should nav say 'Browse Issues' or 'Browse Campaigns'?"
**ANSWER**: No.

**BETTER**: Just show locations as filters
```
Nationwide | California | Travis County | TX-25
```

Or no nav at all—just the current location in the header.

### When Writing Empty States

**WRONG**:
```
No campaigns in TX-25 yet
```

**CORRECT**:
```
Nothing coordinating in TX-25 yet
Create the first template for your district
```

Focus on **coordination** (the action), not categories.

---

## The Core Insight

**Users don't care about taxonomy.**

They care about:
1. **What's happening** (template titles show this)
2. **Who's coordinating** (counts show this)
3. **Where it's relevant** (location shows this)

Category labels like "campaigns" or "issues" add zero value and carry political/emotional baggage.

**Just show the place. Show the count. Show the templates.**

---

## Exceptions (None)

There are no exceptions to this principle.

Even if it feels awkward at first, resist the urge to add "in" or category words.

**Trust the minimalism.**

Location name + coordination count + template list = complete context.

---

## Examples Across States

### State-Level (IP)

```
Texas
47 coordinating

Templates:
- Austin City Council: Affordable housing (12 sent this)
- Texas school board: Ban book bans (23 sent this)
- Tell Amazon: Stop union busting (5,247 sent this)
```

### County-Level (GPS)

```
Travis County
12 coordinating

Templates:
- Travis County Sheriff: End ICE cooperation (8 sent this)
- Austin City Council: Affordable housing (12 sent this)
- Round Rock ISD: Teacher pay raise (4 sent this)
```

### District-Level (Address)

```
TX-25
You + 8 others

Templates:
- Rep. McCaul: Vote yes on H.R. 1234 (9 sent this)
- Cedar Park HOA: Stop excessive fines (3 sent this)
- Round Rock ISD: Teacher pay raise (4 sent this)
```

**No "in". No "campaigns". No "issues".**

**Just place, count, action.**

---

## Progressive Precision Funnel (2025-11-11)

**Location isn't just a filter—it's a funnel.**

Each refinement step reveals MORE RELEVANT templates, creating natural incentive to share location.

### The 3-Step Funnel

**STEP 1: IP → State** ("California" + 47 coordinating)
- Show: Federal + State templates
- Affordance: "Find who represents you →"
- User sees statewide advocacy, wants county-level

**STEP 2: GPS → County** ("San Francisco County" + 12 coordinating)
- Show: Federal + State + County templates
- Affordance: "Find who represents you →"
- User sees county advocacy, wants district-specific

**STEP 3: Address → District** ("California's 16th Congressional District" + 8 coordinating)
- Show: ALL templates (Federal + State + County + District)
- Affordance: Filter toggle ("See 8 coordinating")
- User sees neighborhood coordination: "You + 8 others"

### Why This Works

**Progressive disclosure creates pull:**
- State templates → "What's happening in my county?"
- County templates → "What's happening in my district?"
- District templates → "Who's coordinating near me?"

**Each step is an upgrade:**
- More precise location = More relevant templates
- More relevant templates = Higher engagement
- Higher engagement = More coordination

**Natural funnel, not forced:**
- IP detection is automatic (89% accurate state)
- GPS is optional but valuable (95% accurate county)
- Address is highest value (100% accurate district)

---

## Bottom Line for Future Agents

**If you're about to write "campaigns in" or "issues in", STOP.**

**Just use the location name.**

This isn't about being terse for the sake of it. It's about:
- Avoiding politically loaded language
- Letting templates speak for themselves
- Making location a filter, not a container
- Keeping coordination (the count) as the primary signal
- Creating a progressive funnel where precision = value

**Minimal ≠ Unclear**

"Texas" + "47 coordinating" + template list = crystal clear.

**No category labels needed. Ever.**

---

**Principle established**: 2025-11-10
**Progressive funnel added**: 2025-11-11
**Apply universally**: Headers, navigation, empty states, meta descriptions, everywhere
