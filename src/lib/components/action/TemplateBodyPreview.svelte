<script lang="ts">
  let { body, districtName, onchange }: {
    body: string;
    districtName: string;
    onchange: (text: string) => void;
  } = $props();

  let expanded = $state(false);
  // Strip [Personal Connection] — handled by PersonalSpace (Zone 2) in compose flow
  let content = $state(
    body
      .replace(/\[District\]/g, districtName)
      .replace(/\s*\[Personal Connection\]\s*/g, ' ')
      .replace(/  +/g, ' ')
      .trim()
  );

  function handleInput(e: Event) {
    content = (e.target as HTMLTextAreaElement).value;
    onchange(content);
  }

  function toggle() {
    expanded = !expanded;
  }
</script>

<div class="py-2">
  {#if expanded}
    <!-- Expanded: editable textarea -->
    <textarea
      rows="8"
      class="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-participation-primary-400 focus:outline-none focus:ring-0"
      value={content}
      oninput={handleInput}
    ></textarea>
  {:else}
    <!-- Collapsed: 3-line preview -->
    {#if content.trim()}
      <p class="line-clamp-3 text-sm text-slate-700">
        {content}
      </p>
    {:else}
      <p class="text-sm text-slate-400 italic">No message body available</p>
    {/if}
  {/if}

  {#if content.trim()}
    <button
      type="button"
      aria-expanded={expanded}
      class="mt-1 text-xs font-medium text-participation-primary-600 hover:text-participation-primary-800"
      onclick={toggle}
    >
      {#if expanded}
        Collapse &#x25B3;
      {:else}
        Read full message &#x25BE;
      {/if}
    </button>
  {/if}
</div>
