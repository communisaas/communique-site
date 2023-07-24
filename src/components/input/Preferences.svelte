<script lang="ts">
	export let flow: Settable[];
</script>

<section>
	{#each flow as step (step.key)}
		<input on:input={step.onUpdate} type={step.inputType} />
	{/each}
</section>
