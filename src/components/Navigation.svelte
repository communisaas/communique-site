<script lang="ts">
	import Compose from '$components/icon/Compose.svelte';
	import { page } from '$app/stores';
	import Topic from './icon/Topic.svelte';

	const navLinks = {
		'/': { component: Topic, label: 'Home' },
		'/compose': { component: Compose, label: 'Compose email' }
	};
</script>

<aside class="object-cover inline-flex h-full">
	<div class="flex flex-col items-center h-full bg-peacockFeather-700 shadow-nav z-50">
		<nav aria-label="Page navigation" class="flex flex-col sticky top-0">
			{#each Object.entries(navLinks) as [route, link]}
				<span
					class:active={$page.route.id == route}
					class:pointer-events-none={$page.route.id == `${route}`}
				>
					<a
						data-sveltekit-preload-data="hover"
						data-sveltekit-preload-code="eager"
						class="min-h-full min-w-full"
						aria-label={link.label}
						href={route}
					>
						<icon>
							<svelte:component this={link.component} />
						</icon>
					</a>
					<ins
						style="transform-origin: center right;"
						class:active={$page.route.id == route}
						class="absolute top-0 left-0 w-full h-full bg-paper-500 opacity-20"
					/>
				</span>
			{/each}
		</nav>
	</div>
</aside>

<style>
	span {
		width: 100%;
		position: relative;
	}

	ins {
		height: 100%;
		transform: scale(0);
		transition: transform 0.1s ease-out;
	}

	.active {
		transform: scale(1);
		height: 100%;
		filter: contrast(0.4);
	}

	a::before {
		content: '';
		display: block;
		position: absolute;
		transition: all 0.05s ease-in;
		transform-origin: right;
		transform: scale(0);
		top: 0;
		bottom: 0;
		right: 0;
		left: 0;
	}
	a:hover::before {
		transition: border-right 0.1s ease-out;
		top: 25px;
		bottom: 25px;
		border-right: 4px solid theme('colors.larimarGreen.600');
		transform: scale(1);
	}
	a > :global(icon) {
		padding: 1em 0.5em;
		display: block;
	}

	.active a::before {
		border-right: 4px solid theme('colors.larimarGreen.600');
		display: block;
		position: absolute;
		transition: all 0.1s ease-out;
		right: 0;
		left: 0;
		transform: scale(1);
	}
</style>
