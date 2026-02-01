# Representative Profile Page

Progressive disclosure demonstration using Vote components.

## Usage

Navigate to `/representatives/{bioguideId}` where `bioguideId` is a member's Congress.gov bioguide ID.

Example:
```
/representatives/A000370  # Alma Adams (NC-12)
/representatives/P000197  # Nancy Pelosi (CA-11)
```

## Progressive Disclosure Levels

### L1: Peripheral Awareness (VoteIndicator)
- Color-coded vote badges (Green=Yea, Red=Nay, Gray=Not Voting)
- Visible at-a-glance in the vote list
- No interaction required

### L2: Recognition (VoteContext)
- Appears on hover after 300ms delay
- Shows bill context, party breakdown, result
- Prevents accidental activation
- Provides "View Full Roll Call" action

### L3: Focal Immersion (RollCall)
- Opens in modal on click
- Full member-by-member breakdown
- Filtering and sorting capabilities
- Official record link

## Perceptual Engineering Principles

### Timing
- **300ms hover delay**: Below the 400ms "perceived delay" threshold
- Prevents accidental triggers during mouse movement
- Maintains perceived responsiveness

### Visual Hierarchy
1. Vote indicator (highest contrast)
2. Bill title (scannable)
3. Metadata (supporting)
4. Context (progressive)

### Motion Design
- Respects `prefers-reduced-motion`
- Smooth but not distracting transitions
- Immediate dismissal on hover end

### Keyboard Navigation
- Full keyboard support throughout
- Focus visible indicators
- Escape to close modal
- Enter/Space to activate

## Component Integration

### VoteIndicator
```svelte
<VoteIndicator position="yea" size="md" showLabel={true} />
```

### VoteContext (on hover)
```svelte
<VoteContext
  vote={{
    billNumber: "HR-1234",
    billTitle: "Infrastructure Investment Act",
    voteDate: new Date(),
    position: "yea",
    result: "passed",
    partyBreakdown: { /* ... */ },
    summary: "Voted YES on infrastructure spending"
  }}
  onViewFull={() => openModal()}
/>
```

### RollCall (in modal)
```svelte
<SimpleModal title="Full Roll Call" maxWidth="max-w-4xl">
  <RollCall
    billNumber="HR-1234"
    billTitle="Infrastructure Investment Act"
    voteDate={new Date()}
    result="passed"
    votes={memberVotes}
    rollCallUrl="https://congress.gov/..."
    summary="Bill summary"
    context="Legislative context"
  />
</SimpleModal>
```

## Data Flow

```
User enters page
  ↓
Server loads representative + votes (parallel)
  ↓
Page renders with L1 indicators
  ↓
User hovers → 300ms delay → L2 context appears
  ↓
User clicks → L3 modal opens with full roll call
```

## Testing

Test with different representatives:
- House members: Include district in data
- Senators: No district, state-wide representation
- Different parties: Verify color coding
- Various vote counts: Test stats display

## Future Enhancements

1. **Pagination**: Load more votes on scroll/click
2. **Filtering**: By bill type, date range, result
3. **Real roll call data**: Fetch full member breakdown on L3 open
4. **Party breakdown**: Add actual vote counts in VoteContext
5. **Comparison**: Side-by-side representative comparison
6. **Vote explanations**: Link to member's stated reasoning
