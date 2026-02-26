<script lang="ts">
  import { Lock, Unlock, Loader, Pause } from '@lucide/svelte';

  type Phase = 'commit' | 'reveal' | 'executing' | 'idle';

  interface Props {
    phase: Phase;
    secondsRemaining: number;
    epoch: number;
    compact?: boolean;
  }

  let { phase, secondsRemaining, epoch, compact = false }: Props = $props();

  const PHASE_CONFIG: Record<
    Phase,
    { icon: typeof Lock; label: string; badge: string; text: string }
  > = {
    commit: {
      icon: Lock,
      label: 'COMMIT PHASE',
      badge: 'bg-green-100 text-green-700 ring-green-600/20',
      text: 'text-green-700',
    },
    reveal: {
      icon: Unlock,
      label: 'REVEAL PHASE',
      badge: 'bg-blue-100 text-blue-700 ring-blue-600/20',
      text: 'text-blue-700',
    },
    executing: {
      icon: Loader,
      label: 'EXECUTING',
      badge: 'bg-amber-100 text-amber-700 ring-amber-600/20',
      text: 'text-amber-700',
    },
    idle: {
      icon: Pause,
      label: 'BETWEEN EPOCHS',
      badge: 'bg-slate-100 text-slate-600 ring-slate-500/20',
      text: 'text-slate-600',
    },
  };

  let countdown = $state(secondsRemaining);

  $effect(() => {
    countdown = secondsRemaining;
  });

  $effect(() => {
    if (countdown <= 0) return;

    const interval = setInterval(() => {
      countdown = Math.max(0, countdown - 1);
    }, 1000);

    return () => clearInterval(interval);
  });

  const isUrgent = $derived(countdown > 0 && countdown < 30);

  const formattedTime = $derived.by(() => {
    if (countdown <= 0) return '\u2014';
    const mins = Math.floor(countdown / 60);
    const secs = countdown % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  const config = $derived(PHASE_CONFIG[phase]);
</script>

<div
  class="inline-flex items-center {compact ? 'gap-2' : 'gap-3'}"
  role="status"
  aria-label="{config.label}, {formattedTime} remaining, Epoch {epoch}"
>
  <!-- Phase badge -->
  <span
    class="inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-medium
      {config.badge}
      {compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}"
  >
    <svelte:component
      this={config.icon}
      size={compact ? 12 : 14}
      class="{phase === 'executing' ? 'animate-spin' : ''}"
      strokeWidth={2.5}
    />
    {config.label}
  </span>

  <!-- Countdown timer -->
  <span
    class="font-mono font-semibold tabular-nums
      {compact ? 'text-sm' : 'text-base'}
      {isUrgent ? 'text-red-600 animate-pulse' : 'text-slate-700'}"
  >
    {formattedTime}
  </span>

  <!-- Epoch number (hidden in compact mode) -->
  {#if !compact}
    <span class="text-sm font-medium text-slate-400">
      Epoch {epoch}
    </span>
  {/if}
</div>
