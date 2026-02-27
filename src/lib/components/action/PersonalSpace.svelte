<script lang="ts">
  let { personalPrompt = null, onchange }: {
    personalPrompt: string | null;
    onchange: (text: string) => void;
  } = $props();

  let textarea: HTMLTextAreaElement;
  let value = $state('');

  $effect(() => {
    // Access value to create dependency
    void value;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 192) + 'px';
    }
  });

  function handleInput(e: Event) {
    value = (e.target as HTMLTextAreaElement).value;
    onchange(value);
  }
</script>

<div class="py-2">
  <textarea
    bind:this={textarea}
    rows="3"
    aria-label="Personal message"
    class="w-full resize-none border-0 border-b border-slate-200 bg-transparent px-0 text-sm text-slate-700 placeholder:text-slate-400 focus:border-participation-primary-400 focus:outline-none focus:ring-0"
    placeholder={personalPrompt ?? 'Add your perspective (optional)'}
    {value}
    oninput={handleInput}
  ></textarea>
</div>
