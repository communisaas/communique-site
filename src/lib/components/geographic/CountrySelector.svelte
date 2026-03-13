<script lang="ts">
	let { value, onchange }: { value: string; onchange: (country: string) => void } = $props();

	const countries = [
		{ code: 'US', label: 'United States' },
		{ code: 'GB', label: 'United Kingdom' },
		{ code: 'CA', label: 'Canada' },
		{ code: 'AU', label: 'Australia' }
	];
</script>

<select
	class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none transition-colors"
	{value}
	onchange={(e) => onchange((e.target as HTMLSelectElement).value)}
>
	{#each countries as c}
		<option value={c.code} selected={value === c.code}>{c.label}</option>
	{/each}
</select>
