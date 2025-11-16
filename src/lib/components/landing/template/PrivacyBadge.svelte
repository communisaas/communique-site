<script lang="ts">
	/**
	 * PrivacyIndicator: Empowering user agency through technical transparency
	 *
	 * DESIGN PHILOSOPHY:
	 * - Short declarative text: Focus on USER control
	 * - Tooltip on hover: Explains WHAT data powers this (new info)
	 * - Trust through clarity about mechanism
	 * - Link to full details for those who care
	 */
</script>

<a
	href="/privacy"
	class="group relative inline-flex items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-700"
	aria-label="Your location preferences stay in your browser"
>
	<!-- Lock icon (control indicator) -->
	<svg class="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
		<path
			fill-rule="evenodd"
			d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
			clip-rule="evenodd"
		/>
	</svg>

	<!-- Empowering user-focused text -->
	<span class="text-xs">Your location, your control</span>

	<!-- Tooltip on hover (explains WHAT powers this - actual new info) -->
	<div
		class="pointer-events-none absolute bottom-full left-0 mb-2 z-10 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100"
	>
		Uses IP address and timezone automatically. Enter your address for precise results. Stored only in your browser.
		<div class="absolute top-full left-4 -mt-1 h-2 w-2 rotate-45 bg-slate-900"></div>
	</div>
</a>
