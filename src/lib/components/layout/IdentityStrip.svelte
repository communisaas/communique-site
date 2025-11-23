<script lang="ts">
	/**
	 * IdentityStrip - Minimal 48px header for template pages
	 *
	 * Perceptual Engineering: Working memory constraint (4±1 chunks).
	 * Only 3 elements: Back navigation | Brand | User identity
	 *
	 * Layout: [Back] -------- [Avatar/SignIn]
	 */
	import { page } from '$app/stores';
	import HeaderBackButton from './header/HeaderBackButton.svelte';
	import HeaderAvatar from './header/HeaderAvatar.svelte';
	import HeaderSignIn from './header/HeaderSignIn.svelte';
	import type { HeaderUser, HeaderTemplate, TemplateUseEvent } from '$lib/types/any-replacements';

	let {
		user = null,
		template = null,
		isScrolled = false,
		isHidden = false,
		onTemplateUse: _onTemplateUse = null
	}: {
		user?: HeaderUser | null;
		template?: HeaderTemplate | null;
		isScrolled?: boolean;
		isHidden?: boolean;
		onTemplateUse?: ((event: TemplateUseEvent) => void) | null;
	} = $props();

	// Derive back navigation from context
	const backConfig = $derived.by(() => {
		const routeId = $page.route.id;

		if (routeId === '/s/[slug]' && template) {
			return {
				show: true,
				href: '/',
				label: 'All Templates'
			};
		}

		// Other pages: show home link if not on homepage
		if (routeId !== '/') {
			return {
				show: true,
				href: '/',
				label: 'Home'
			};
		}

		return { show: false, href: '/', label: '' };
	});
</script>

<header
	class="identity-strip"
	class:identity-strip--scrolled={isScrolled}
	class:identity-strip--hidden={isHidden}
	aria-label="Site header"
>
	<nav class="identity-strip__inner" aria-label="Primary navigation">
		<!-- Left: Back navigation or brand -->
		<div class="identity-strip__left">
			{#if backConfig.show}
				<HeaderBackButton href={backConfig.href} label={backConfig.label} />
			{:else}
				<a href="/" class="identity-strip__brand"> Communique </a>
			{/if}
		</div>

		<!-- Center: Empty (flexible space) -->
		<div class="identity-strip__center"></div>

		<!-- Right: User identity -->
		<div class="identity-strip__right">
			{#if user}
				<HeaderAvatar {user} />
			{:else}
				<HeaderSignIn />
			{/if}
		</div>
	</nav>
</header>

<style>
	.identity-strip {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 48px;
		z-index: 100;

		background: var(--header-bg);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--header-border);

		transform: translateY(0);
		transition:
			transform var(--header-transition-normal) var(--header-easing),
			box-shadow var(--header-transition-normal) var(--header-easing);
	}

	.identity-strip--scrolled {
		box-shadow: var(--header-shadow-scrolled);
	}

	.identity-strip--hidden {
		transform: translateY(-100%);
	}

	.identity-strip__inner {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 16px;
		height: 100%;
		max-width: 80rem;
		margin: 0 auto;
		padding: 0 16px;
	}

	@media (min-width: 640px) {
		.identity-strip__inner {
			padding: 0 24px;
		}
	}

	.identity-strip__left {
		display: flex;
		align-items: center;
	}

	.identity-strip__center {
		/* Flexible spacer */
	}

	.identity-strip__right {
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.identity-strip__brand {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-weight: 600;
		font-size: 1.125rem;
		letter-spacing: -0.01em;
		color: var(--header-text-primary);
		text-decoration: none;
		transition: opacity var(--header-transition-fast) var(--header-easing);
	}

	.identity-strip__brand:hover {
		opacity: 0.8;
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.identity-strip {
			transition: none;
		}

		.identity-strip--hidden {
			visibility: hidden;
		}
	}
</style>
