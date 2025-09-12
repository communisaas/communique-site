<script lang="ts">
	import { Info } from 'lucide-svelte';

	export let content: string;

	let show = false;
</script>

<div
	class="group relative inline-flex cursor-help items-center"
	role="tooltip"
	on:mouseenter={() => (show = true)}
	on:mouseleave={() => (show = false)}
>
	<slot />
	<Info class="ml-1 h-4 w-4 text-slate-400" />

	<div
		class="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 transform whitespace-nowrap rounded-lg
                bg-slate-800 px-3 py-2 text-sm text-white transition-all duration-150"
		class:opacity-0={!show}
		class:opacity-100={show}
		class:pointer-events-none={!show}
	>
		{content}
		<div
			class="absolute left-1/2 top-full -mt-1.5 -translate-x-1/2 transform
                    border-4 border-transparent border-t-slate-800"
		></div>
	</div>
</div>
