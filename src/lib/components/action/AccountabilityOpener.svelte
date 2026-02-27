<script lang="ts">
  let { name, title, opener = null, onchange }: {
    name: string;
    title: string;
    opener: string | null;
    onchange: (text: string) => void;
  } = $props();

  let content = $state(opener ?? '');
  const charCount = $derived(content.length);
  const showCount = $derived(charCount > 400);
  const overLimit = $derived(charCount > 500);

  function handleInput(e: Event) {
    const target = e.target as HTMLDivElement;
    content = target.textContent ?? '';
    onchange(content);
  }
</script>

<div class="rounded-lg bg-participation-primary-50 p-4">
  <!-- Header: always visible -->
  <p class="mb-2 text-xs font-medium uppercase tracking-wider text-participation-primary-400">
    To: {name}, {title}
  </p>

  <!-- Editable opener (only if opener exists) -->
  {#if opener !== null}
    <div
      contenteditable="true"
      role="textbox"
      aria-label="Accountability opener"
      aria-multiline="true"
      aria-describedby={showCount ? 'opener-char-count' : undefined}
      class="min-h-[2rem] text-sm text-participation-primary-800 outline-none"
      oninput={handleInput}
    >{content}</div>

    {#if showCount}
      <p id="opener-char-count" class="mt-1 text-right text-xs {overLimit ? 'text-red-500' : 'text-participation-primary-400'}" aria-live="polite">
        {charCount}/500
      </p>
    {/if}
  {/if}
</div>
