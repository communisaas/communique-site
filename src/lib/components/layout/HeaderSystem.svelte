<script lang="ts">
	/**
	 * HeaderSystem - Context-aware header router
	 *
	 * Perceptual Engineering Principle: The header provides orientation and identity
	 * confirmation. Nothing more. Different contexts demand different presence levels.
	 *
	 * Context → Header Variant:
	 * - Homepage → AmbientPresence (floating elements, no bar)
	 * - Template Page → IdentityStrip (48px minimal bar)
	 * - Profile → None (page manages own navigation)
	 * - Focus Mode → MinimalBar (future: exit + progress only)
	 */
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import AmbientPresence from './AmbientPresence.svelte';
	import IdentityStrip from './IdentityStrip.svelte';
	import MobileBottomBar from './MobileBottomBar.svelte';
	import type { HeaderUser, HeaderTemplate, TemplateUseEvent } from '$lib/types/any-replacements';

	let {
		user = null,
		template = null,
		onTemplateUse = null
	}: {
		user?: HeaderUser | null;
		template?: HeaderTemplate | null;
		onTemplateUse?: ((event: TemplateUseEvent) => void) | null;
	} = $props();

	// Determine header context from route
	type HeaderContext = 'homepage' | 'template' | 'profile' | 'other';

	const headerContext = $derived.by((): HeaderContext => {
		const routeId = $page.route.id;

		if (routeId === '/') return 'homepage';
		if (routeId === '/s/[slug]') return 'template';
		if (routeId?.startsWith('/profile')) return 'profile';
		return 'other';
	});

	// Should show mobile bottom bar (template pages only, mobile only)
	const showMobileBottomBar = $derived(
		headerContext === 'template' && template !== null && browser
	);

	// Scroll state for hide-on-scroll behavior
	let isScrolled = $state(false);
	let isHidden = $state(false);
	let lastScrollY = $state(0);

	// Scroll configuration
	const SCROLL_CONFIG = {
		hideThreshold: 60, // px scrolled down to hide
		showThreshold: 20, // px scrolled up to show
		topZone: 100, // px from top where header always shows
		scrolledThreshold: 10 // px to consider "scrolled" (for shadow)
	};

	// Handle scroll for header visibility
	function handleScroll(): void {
		if (!browser) return;

		const currentScrollY = window.scrollY;

		// Update scrolled state (for shadow)
		isScrolled = currentScrollY > SCROLL_CONFIG.scrolledThreshold;

		// Always show in top zone
		if (currentScrollY < SCROLL_CONFIG.topZone) {
			isHidden = false;
			lastScrollY = currentScrollY;
			return;
		}

		// Calculate scroll delta
		const scrollDelta = currentScrollY - lastScrollY;

		// Hide on scroll down (past threshold)
		if (scrollDelta > SCROLL_CONFIG.hideThreshold) {
			isHidden = true;
			lastScrollY = currentScrollY;
		}
		// Show on scroll up (past threshold)
		else if (scrollDelta < -SCROLL_CONFIG.showThreshold) {
			isHidden = false;
			lastScrollY = currentScrollY;
		}
	}

	// Attach scroll listener
	$effect(() => {
		if (!browser) return;

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	});
</script>

<!--
  Header System renders context-appropriate header variant.
  Profile pages render nothing (page manages own nav).
-->

{#if headerContext === 'profile'}
	<!-- Profile pages manage their own navigation -->
{:else if headerContext === 'homepage'}
	<!-- Homepage: Floating ambient presence, no bar -->
	<AmbientPresence {user} {isScrolled} />
{:else}
	<!-- Template & other pages: Minimal identity strip -->
	<IdentityStrip {user} {template} {isScrolled} {isHidden} {onTemplateUse} />
{/if}

<!-- Mobile bottom bar for template pages -->
{#if showMobileBottomBar && template}
	<MobileBottomBar {template} {user} {onTemplateUse} />
{/if}
