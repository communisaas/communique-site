<script lang="ts">
  import { spring } from 'svelte/motion';

  import type { ArgumentData } from '$lib/stores/debateState.svelte';
  type Stance = 'SUPPORT' | 'OPPOSE' | 'AMEND';

  interface Props {
    prices: Record<number, number>;
    arguments: ArgumentData[];
    showLabels?: boolean;
    height?: 'sm' | 'md' | 'lg';
    animated?: boolean;
  }

  let {
    prices,
    arguments: args,
    showLabels = true,
    height = 'md',
    animated = true,
  }: Props = $props();

  const STANCE_CONFIG: Record<Stance, { color: string; bg: string; label: string }> = {
    SUPPORT: { color: 'bg-indigo-500', bg: 'text-indigo-600', label: 'Support' },
    OPPOSE: { color: 'bg-red-500', bg: 'text-red-600', label: 'Oppose' },
    AMEND: { color: 'bg-amber-500', bg: 'text-amber-600', label: 'Amend' },
  };

  const STANCE_ORDER: Stance[] = ['SUPPORT', 'OPPOSE', 'AMEND'];

  const HEIGHT_MAP: Record<string, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const MIN_VISIBLE_PCT = 2;

  const hasAnyPrices = $derived(
    Object.keys(prices).length > 0 && Object.values(prices).some((p) => p > 0),
  );

  const stanceTotals = $derived.by(() => {
    const totals: Partial<Record<Stance, number>> = {};
    for (const arg of args) {
      const price = prices[arg.argumentIndex] ?? 0;
      totals[arg.stance] = (totals[arg.stance] ?? 0) + price;
    }
    return totals;
  });

  const segments = $derived.by(() => {
    const totals = stanceTotals;
    const raw: { stance: Stance; value: number }[] = [];

    for (const stance of STANCE_ORDER) {
      const value = totals[stance];
      if (value !== undefined && value > 0) {
        raw.push({ stance, value });
      }
    }

    if (raw.length === 0) return [];

    const sum = raw.reduce((acc, s) => acc + s.value, 0);

    return raw.map((s) => ({
      stance: s.stance,
      pct: Math.max((s.value / sum) * 100, MIN_VISIBLE_PCT),
    }));
  });

  // Normalize so percentages add to exactly 100 after applying minimums
  const normalizedSegments = $derived.by(() => {
    const segs = segments;
    if (segs.length === 0) return [];

    const total = segs.reduce((acc, s) => acc + s.pct, 0);
    return segs.map((s) => ({
      ...s,
      pct: (s.pct / total) * 100,
    }));
  });

  // Springs for each stance — we always maintain all three so order is stable
  const supportWidth = spring(0, { stiffness: 0.4, damping: 0.8 });
  const opposeWidth = spring(0, { stiffness: 0.4, damping: 0.8 });
  const amendWidth = spring(0, { stiffness: 0.4, damping: 0.8 });

  const springMap: Record<Stance, typeof supportWidth> = {
    SUPPORT: supportWidth,
    OPPOSE: opposeWidth,
    AMEND: amendWidth,
  };

  $effect(() => {
    const segs = normalizedSegments;
    for (const stance of STANCE_ORDER) {
      const seg = segs.find((s) => s.stance === stance);
      const target = seg ? seg.pct : 0;
      if (animated) {
        springMap[stance].set(target);
      } else {
        springMap[stance].set(target, { hard: true });
      }
    }
  });

  const visibleStances = $derived.by(() => {
    const segs = normalizedSegments;
    return STANCE_ORDER.filter((stance) => segs.some((s) => s.stance === stance));
  });

  // Display percentages (rounded, derived from raw totals for label accuracy)
  const displayPcts = $derived.by(() => {
    const totals = stanceTotals;
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    if (sum === 0) return {};

    const result: Partial<Record<Stance, number>> = {};
    for (const stance of STANCE_ORDER) {
      const val = totals[stance];
      if (val !== undefined && val > 0) {
        result[stance] = Math.round((val / sum) * 100);
      }
    }
    return result;
  });
</script>

<div class="w-full">
  {#if hasAnyPrices}
    <div
      class="flex w-full overflow-hidden rounded-lg {HEIGHT_MAP[height]}"
      role="img"
      aria-label="Market price distribution"
    >
      {#each visibleStances as stance, i}
        {@const config = STANCE_CONFIG[stance]}
        {@const isFirst = i === 0}
        {@const isLast = i === visibleStances.length - 1}
        {@const w = stance === 'SUPPORT' ? $supportWidth : stance === 'OPPOSE' ? $opposeWidth : $amendWidth}
        <div
          class="{config.color} transition-none {isFirst ? 'rounded-l-lg' : ''} {isLast ? 'rounded-r-lg' : ''}"
          style="width: {w.toFixed(2)}%; min-width: 0;"
          role="meter"
          aria-valuenow={Math.round(w)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="{config.label} {Math.round(w)}%"
        ></div>
      {/each}
    </div>

    {#if showLabels}
      <div class="mt-2 flex items-center gap-4">
        {#each visibleStances as stance}
          {@const config = STANCE_CONFIG[stance]}
          {@const pct = displayPcts[stance] ?? 0}
          <div class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-2 rounded-full {config.color}"></span>
            <span class="text-sm font-medium text-slate-600">
              {config.label}
            </span>
            <span class="font-mono text-sm font-semibold {config.bg}">
              {pct}%
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="w-full overflow-hidden rounded-lg {HEIGHT_MAP[height]} bg-slate-200"></div>
    {#if showLabels}
      <p class="mt-2 text-center text-sm font-medium text-slate-400">Market not active</p>
    {/if}
  {/if}
</div>
