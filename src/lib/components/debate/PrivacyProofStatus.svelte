<script lang="ts">
  import { Shield, ShieldAlert, Loader } from '@lucide/svelte';

  interface Props {
    status: 'idle' | 'generating' | 'complete' | 'failed';
    progress?: number;
    estimatedSeconds?: number;
    elapsedSeconds?: number;
  }

  let { status, progress, estimatedSeconds, elapsedSeconds }: Props = $props();

  const statusConfig = $derived.by(() => {
    switch (status) {
      case 'generating':
        return {
          label: 'Generating privacy proof...',
          border: 'border-l-indigo-500',
          bg: 'bg-indigo-50/60',
          text: 'text-indigo-700',
          animate: true,
        };
      case 'complete':
        return {
          label: 'Your position is private',
          border: 'border-l-emerald-500',
          bg: 'bg-emerald-50/60',
          text: 'text-emerald-700',
          animate: false,
        };
      case 'failed':
        return {
          label: 'Privacy proof failed \u2014 position visible',
          border: 'border-l-amber-500',
          bg: 'bg-amber-50/60',
          text: 'text-amber-700',
          animate: false,
        };
      default:
        return null;
    }
  });
</script>

{#if status !== 'idle'}
  {@const config = statusConfig}
  {#if config}
    <div
      class="flex items-center gap-2.5 rounded-lg border border-slate-100 border-l-[3px] {config.border} {config.bg} px-3 py-2"
      role="status"
      aria-live="polite"
      aria-label={config.label}
    >
      {#if status === 'generating'}
        <Loader
          size={16}
          strokeWidth={2}
          class="flex-shrink-0 text-indigo-500 animate-spin"
        />
      {:else if status === 'complete'}
        <Shield
          size={16}
          strokeWidth={2}
          class="flex-shrink-0 text-emerald-500"
        />
      {:else if status === 'failed'}
        <ShieldAlert
          size={16}
          strokeWidth={2}
          class="flex-shrink-0 text-amber-500"
        />
      {/if}

      <div class="flex flex-1 items-center justify-between gap-2">
        <span
          class="text-xs font-medium {config.text}"
          class:animate-pulse={config.animate}
        >
          {config.label}
        </span>

        {#if status === 'generating'}
          <span class="text-[10px] font-mono text-slate-400 tabular-nums">
            {#if elapsedSeconds != null}
              {elapsedSeconds}s
            {/if}
            {#if estimatedSeconds != null}
              / ~{estimatedSeconds}s
            {/if}
          </span>
        {/if}
      </div>
    </div>

    <!-- Progress bar (generating state only) -->
    {#if status === 'generating' && progress != null}
      <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          class="h-full rounded-full bg-indigo-500 transition-all duration-300 ease-out"
          style="width: {Math.min(progress, 100)}%"
        ></div>
      </div>
    {/if}
  {/if}
{/if}
