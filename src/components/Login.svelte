<script lang="ts">
	import { browser } from '$app/environment';
	import { signIn } from '@auth/sveltekit/client';
	import { createEventDispatcher } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { fade, scale } from 'svelte/transition';
	import { onMount } from 'svelte';

	export let providers: AuthSchema;

	let sessionStore: Writable<UserState>;
	onMount(async () => {
		sessionStore = (await import('$lib/data/sessionStorage')).store;
		console.log($sessionStore.loginCallbackURL);
	});

	let chosenProvider: string;
	const dispatch = createEventDispatcher();
	// TODO focus traps
	function setPopover(value: boolean) {
		dispatch('popover', value);
	}
</script>

<section role="dialog" class="flex flex-col items-center relative">
	{#if !chosenProvider}
		<p class="absolute mb-4 w-max mx-auto -top-8" out:fade={{ duration: 30 }}>Sign in with</p>
	{:else}
		<p class="absolute mb-4 w-max mx-auto -top-8" in:fade={{ delay: 30, duration: 150 }}>
			{`Going to ${chosenProvider}...`}
		</p>
	{/if}
	<article class="flex flex-col gap-3">
		<div class="flex gap-3">
			{#each Object.entries(providers.providers) as [id, attributes]}
				{#if !chosenProvider || chosenProvider === attributes.name}
					<button
						on:click={() => {
							signIn(id, { callbackUrl: $sessionStore.loginCallbackURL });
							chosenProvider = attributes.name;
							$sessionStore.show.login = false;
						}}
						class="flex flex-col items-center justify-center m-2 w-14 h-14"
					>
						<img
							src={providers.baseLogoURL + attributes.style.logoDark}
							alt="{attributes.name} logo"
						/>
					</button>
				{/if}
			{/each}
		</div>
		<div class="w-full h-10">
			{#if !chosenProvider}
				<button
					out:scale={{ delay: 20, duration: 150 }}
					class="w-full h-full"
					on:click={() => setPopover(false)}
				>
					Close
				</button>
			{/if}
		</div>
	</article>
</section>

<style lang="scss">
	button {
		background: rgba(255, 255, 255, 0.15);
		border-radius: 16px;
		box-shadow: 0 1px 2px 1px rgba(0, 0, 0, 0.1);
		transition: ease-in-out 0.1s;

		&:hover {
			background: rgba(255, 255, 255, 0.25);
			transform: translateY(-1px);
		}
		&:active {
			transform: translateY(1px);
			background: rgba(255, 255, 255, 0.15);
		}
	}
</style>
