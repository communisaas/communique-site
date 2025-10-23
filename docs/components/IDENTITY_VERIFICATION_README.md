# Identity Verification UI Components

## Overview

This suite of components handles identity verification for Communiqué's congressional advocacy platform. The design balances **civic credibility** with **digital sovereignty**, making users feel empowered rather than surveilled.

## Design Philosophy: "Stealthily Cypherpunk"

### Core Principles

1. **Agency over Extraction**: Users control their data; we facilitate verification without storing PII
2. **Privacy as Feature**: Cryptographic privacy is positioned as empowerment, not paranoia
3. **Constitutional Weight**: Civic duty meets digital sovereignty without heavy-handed messaging
4. **Conversion Optimization**: Clear value proposition backed by impact statistics

### Emotional Architecture

- **Approach motivation**: "3x response rate" = tangible benefit
- **Autonomy preservation**: "Your address never leaves this device" = user control
- **Status elevation**: "Join verified constituents" = aspirational group membership
- **Trust through transparency**: Show exactly what Congress sees = demystify the process

## Component Architecture

### 1. `IdentityVerificationFlow.svelte` (Main Orchestrator)

**Purpose**: Complete verification flow from value proposition through completion

**Usage**:
```svelte
<script>
  import IdentityVerificationFlow from '$lib/components/auth/IdentityVerificationFlow.svelte';

  function handleComplete(event) {
    const { verified, method, userId } = event.detail;
    // User successfully verified
  }
</script>

<IdentityVerificationFlow
  userId={currentUser.id}
  templateSlug="contact-congress"
  skipValueProp={false}
  on:complete={handleComplete}
  on:cancel={handleCancel}
  on:back={handleBack}
/>
```

**Props**:
- `userId` (required): User identifier for verification session
- `templateSlug` (optional): Template context for verification
- `skipValueProp` (default: `false`): Skip value proposition step if shown elsewhere
- `defaultMethod` (default: `null`): Pre-select verification method

**Events**:
- `complete`: `{ verified: boolean; method: string; userId: string }`
- `cancel`: User canceled verification
- `back`: User went back from first step

**Flow Steps**:
1. **Value Proposition** (optional): Why verification matters, impact statistics
2. **Method Selection**: NFC passport (recommended) vs. Government ID (fallback)
3. **Verification**: Execute chosen verification method
4. **Completion**: Success state with next steps

---

### 2. `VerificationChoice.svelte` (Method Selection)

**Purpose**: Present verification method options with clear affordances

**Design Decisions**:
- **Visual hierarchy**: NFC passport has "Recommended" badge and gradient background
- **Progressive disclosure**: Benefits revealed on hover/focus
- **Social proof**: Time estimates and trust indicators
- **Gestalt principles**: Figure-ground relationship through shadow and color

**Usage**:
```svelte
<VerificationChoice
  defaultMethod={null}
  on:select={handleMethodSelection}
/>
```

**Cognitive Design**:
- **Fitts's Law**: Large touch targets (entire card is clickable)
- **Hick's Law**: Only 2 choices to minimize decision paralysis
- **Jakob's Law**: Card-based selection pattern (familiar from e-commerce, payment methods)

---

### 3. `VerificationValueProp.svelte` (Value Communication)

**Purpose**: Communicate verification benefits WITHOUT being preachy

**Variants**:
- `full`: Complete value proposition with statistics, privacy guarantees
- `compact`: Condensed version for sidebar/modal contexts
- `inline`: Single-line banner for contextual prompts

**Usage**:
```svelte
<!-- Full value prop -->
<VerificationValueProp variant="full" showStats={true} showPrivacy={true} />

<!-- Compact sidebar -->
<VerificationValueProp variant="compact" showStats={true} showPrivacy={false} />

<!-- Inline banner -->
<VerificationValueProp variant="inline" />
```

**Design Strategy**:
- **Statistics**: Concrete impact data (3x response rate, 87% prioritization)
- **Framing**: "What Congress Sees" section demystifies verification
- **Privacy positioning**: Features, not warnings (✓ bullets, not ⚠️ alerts)

---

### 4. `SelfXyzVerification.svelte` (NFC Passport Flow)

**Purpose**: Guide users through NFC passport verification

**Technical Flow**:
1. Initialize verification session via `/api/identity/init`
2. Display QR code for mobile app
3. Poll verification status every 2 seconds
4. Handle success/failure states

**UX Patterns**:
- **Numbered steps**: Clear progression (1→2→3→4)
- **Visual feedback**: Loading states, waiting animations, success icons
- **Error recovery**: "Try Again" with retry mechanism
- **Trust indicators**: "Trusted verification partner" with context

**Usage**:
```svelte
<SelfXyzVerification
  userId={currentUser.id}
  templateSlug="contact-congress"
  on:complete={handleVerificationComplete}
  on:error={handleVerificationError}
/>
```

**Privacy Messaging**:
- ✅ "Your passport data **never leaves your device**"
- ✅ "We verify district membership **without storing your address**"
- ✅ "Cryptographic proof generated **locally on your phone**"

---

### 5. `DiditVerification.svelte` (Government ID Flow)

**Purpose**: Alternative verification via government ID (driver's license, state ID)

**Technical Flow**:
1. Initialize Didit session via `/api/identity/didit/init`
2. Redirect to Didit verification URL (new window)
3. Monitor window close or webhook completion
4. Handle return and success state

**Design Decisions**:
- **Fallback positioning**: "Alternative" badge (not "secondary" or "worse")
- **Trust building**: SOC 2 certification, trusted partner messaging
- **Accessibility**: No NFC hardware required

**Usage**:
```svelte
<DiditVerification
  userId={currentUser.id}
  templateSlug="contact-congress"
  on:complete={handleVerificationComplete}
  on:error={handleVerificationError}
/>
```

---

### 6. `VerificationPrompt.svelte` (Contextual Prompts)

**Purpose**: Lightweight verification prompts for in-flow contexts

**Variants**:
- `banner`: Dismissible top banner (high visibility, low disruption)
- `compact`: Card prompt for sidebars (balanced visibility)
- `full`: Complete prompt card (maximum persuasion)

**Usage**:
```svelte
<!-- Dismissible banner at top of message editor -->
<VerificationPrompt
  variant="banner"
  dismissible={true}
  on:verify={openVerificationFlow}
  on:dismiss={handleDismiss}
/>

<!-- Sidebar prompt in template customization -->
<VerificationPrompt
  variant="compact"
  on:verify={openVerificationFlow}
/>

<!-- Full prompt in dedicated verification page -->
<VerificationPrompt
  variant="full"
  on:verify={startVerification}
/>
```

**Conversion Optimization**:
- **Banner**: 3x response rate badge for immediate impact
- **Compact**: Statistics grid (3x + 87%) for credibility
- **Full**: Complete value prop with privacy guarantees

---

## Design System Integration

### Color Palette

**Verification states**:
- `blue-600` → `indigo-600`: Primary gradient (NFC passport, verified status)
- `slate-200` → `slate-600`: Alternative method (government ID)
- `green-600`: Success states, privacy guarantees
- `red-600`: Error states, retry prompts

**Semantic colors**:
- **Trust**: Blue/Indigo gradients
- **Privacy**: Green accents
- **Alternative**: Slate grays
- **Error**: Red accents

### Typography

- **Headlines**: `text-2xl` / `text-3xl`, `font-bold`, slate-900
- **Subheadlines**: `text-lg`, `font-semibold`, slate-900
- **Body**: `text-sm` / `text-base`, slate-600
- **Emphasis**: `font-medium` / `font-semibold`, color variations

### Icons (Lucide Svelte)

- `Shield`: Primary verification icon (trust, protection)
- `QrCode`: NFC passport flow
- `FileText`: Government ID flow
- `Lock`: Privacy guarantees
- `Check`: Success states, benefits
- `TrendingUp`: Impact statistics
- `Loader2`: Loading states (spinning animation)
- `AlertCircle`: Error states

### Spacing & Layout

- **Card padding**: `p-6` / `p-8` (24px/32px)
- **Gap between elements**: `gap-4` / `gap-6` (16px/24px)
- **Maximum content width**: `max-w-3xl` (768px)
- **Border radius**: `rounded-lg` (8px) / `rounded-xl` (12px) / `rounded-2xl` (16px)

---

## Accessibility Standards

### Keyboard Navigation

- All verification methods accessible via keyboard
- Clear focus indicators on interactive elements
- Logical tab order through flow

### Screen Readers

- Semantic HTML (`<button>`, `<h2>`, `<p>`)
- `aria-label` on icon-only buttons
- Status updates announced via state changes

### Color Contrast

- All text meets WCAG AA standards (4.5:1 for body, 3:1 for large text)
- Status indicators use both color AND icons (not color alone)

### Mobile Responsiveness

- Touch targets minimum 44x44px (iOS/Android standards)
- Grid layouts collapse to single column on mobile
- QR codes sized for optimal scanning distance

---

## Conversion Optimization Strategy

### Value Proposition Hierarchy

1. **Immediate benefit**: "3x higher response rate" (concrete, measurable)
2. **Social proof**: "87% of offices prioritize" (authority, consensus)
3. **Time investment**: "30 seconds" (low friction)
4. **Privacy guarantee**: "Your address never stored" (risk mitigation)

### Choice Architecture

**Default to NFC passport**:
- "Recommended" badge
- Gradient background (visual prominence)
- Listed first (primacy effect)

**Graceful fallback to government ID**:
- "Alternative" framing (not "worse")
- Clear benefits (no passport required)
- Visible but de-emphasized

### Friction Reduction

- **Auto-advance**: Selecting method immediately starts verification
- **Clear steps**: Numbered progression (1→2→3→4)
- **Visual feedback**: Loading states prevent uncertainty
- **Error recovery**: "Try Again" with clear retry paths

---

## Privacy Communication Patterns

### What Works

✅ **"Your address never leaves this device"**
- Active voice, user-centric
- Concrete protection (not abstract "encryption")

✅ **"Congress sees: ✓ Verified constituent from [District]"**
- Shows exactly what's revealed
- Demystifies verification process

✅ **"We store: Verification status + timestamp. That's it."**
- Transparent data practices
- Minimalist approach builds trust

### What to Avoid

❌ **"Zero-knowledge cryptographic proofs"**
- Technical jargon
- Sounds like crypto/Web3 pitch

❌ **"Blockchain-based identity"**
- Alienates non-technical users
- Triggers crypto skepticism

❌ **"Military-grade encryption"**
- Marketing cliché
- Sounds paranoid

---

## Testing & Validation

### Unit Tests

- Component rendering with various props
- Event dispatching (complete, error, cancel)
- State transitions (idle → initializing → verified)

### Integration Tests

- Complete verification flow
- API endpoint integration
- Error handling and retry logic

### User Testing Focus Areas

1. **Comprehension**: Do users understand WHY verification matters?
2. **Trust**: Do users feel safe providing identity information?
3. **Motivation**: Do statistics (3x response rate) drive conversion?
4. **Privacy**: Do users understand what data is/isn't stored?

---

## Implementation Checklist

### Backend Requirements

- [x] `/api/identity/init` - Self.xyz session initialization
- [x] `/api/identity/status` - Self.xyz verification polling
- [x] `/api/identity/didit/init` - Didit session initialization
- [x] `/api/identity/didit/webhook` - Didit webhook handler

### Frontend Components

- [x] `IdentityVerificationFlow.svelte` - Main orchestrator
- [x] `VerificationChoice.svelte` - Method selection
- [x] `VerificationValueProp.svelte` - Value communication
- [x] `SelfXyzVerification.svelte` - NFC passport flow
- [x] `DiditVerification.svelte` - Government ID flow
- [x] `VerificationPrompt.svelte` - Contextual prompts

### Design Assets

- [x] Color palette (blue/indigo gradients, green privacy, slate alternative)
- [x] Icon system (Lucide Svelte)
- [x] Typography scale (responsive sizing)
- [x] Spacing system (Tailwind utilities)

---

## Maintenance & Evolution

### Metrics to Track

- **Conversion rate**: % of users who start verification
- **Completion rate**: % of users who finish verification
- **Method preference**: NFC vs. Government ID selection
- **Drop-off points**: Where users abandon flow
- **Error frequency**: Which verification errors occur most

### A/B Testing Opportunities

1. **Value prop messaging**: "3x response rate" vs. "Priority attention"
2. **Statistics prominence**: Above vs. below method selection
3. **Privacy framing**: Technical detail vs. simplified messaging
4. **CTA copy**: "Start Verification" vs. "Verify Now" vs. "Boost Impact"

### Future Enhancements

- **Biometric verification**: Face ID / Touch ID for repeat verifications
- **Reputation display**: Show user's accumulated civic reputation score
- **Social proof**: "X verified constituents in your district"
- **Gamification**: Progress bars, achievement badges for civic participation

---

## Contact & Support

For questions about design decisions, implementation details, or user research findings:

- **Design Lead**: [Contact info]
- **Engineering Lead**: [Contact info]
- **User Research**: [Contact info]

---

## Appendix: Design Research

### Cognitive Load Analysis

**Information Architecture**:
- Primary path: 3 steps (value prop → choice → verify)
- Decision points: 2 (learn more vs. proceed, NFC vs. ID)
- Input fields: 0 (fully automated verification)

**Visual Complexity**:
- Color palette: 4 semantic colors (blue, green, slate, red)
- Typography hierarchy: 3 levels (headline, subheadline, body)
- Layout grids: Responsive 1-3 columns

### Gestalt Principles Applied

1. **Figure-ground**: Cards elevated with shadow, contrasting backgrounds
2. **Proximity**: Related elements grouped (statistics, privacy bullets)
3. **Similarity**: Consistent icon+text patterns for features
4. **Closure**: Progress bars show completion path
5. **Continuity**: Linear flow (top to bottom, left to right)

### Interaction Patterns

- **Selection**: Card-based (familiar from payment methods, shipping options)
- **Feedback**: Immediate state changes (loading spinners, success icons)
- **Progression**: Numbered steps + progress bar
- **Recovery**: Clear error states with retry actions

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0
**Status**: Production-ready
