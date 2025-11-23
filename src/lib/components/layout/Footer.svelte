<script lang="ts">
	/**
	 * Footer: The Quiet Coda
	 *
	 * Perceptual Engineering: The footer is a spatial boundary, not content.
	 * It answers: "Who made this?" and "Can I contact them?"
	 * Everything else is cognitive surplus.
	 *
	 * Visual bookends: Hero opens with "communiqué", footer closes with it.
	 */
</script>

<footer class="footer-coda">
	<div class="footer-coda__inner">
		<!-- Brand closure: matches hero overture -->
		<p class="footer-coda__brand">communiqué</p>

		<!-- Contact: single recognizable element -->
		<a href="mailto:hello@communi.email" class="footer-coda__contact"> hello@communi.email </a>

		<!-- Legal minimum -->
		<p class="footer-coda__legal">© {new Date().getFullYear()} Communiqué PBC</p>
	</div>
</footer>

<style>
	.footer-coda {
		margin-top: 4rem;
		padding: 3rem 1.5rem;
		border-top: 1px solid oklch(0.9 0.01 250 / 0.6);
	}

	.footer-coda__inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		max-width: 80rem;
		margin: 0 auto;
	}

	/*
	 * Brand whisper: echoes hero overture
	 *
	 * Same warm human tone, quieter presence.
	 * Visual bookend: opens with communiqué, closes with communiqué
	 * The warmth carries through - people at both ends.
	 */
	.footer-coda__brand {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem; /* 14px - quieter than hero, still present */
		font-weight: 600; /* Same confidence */
		letter-spacing: -0.015em; /* Same collective density */
		text-transform: lowercase;
		color: oklch(0.48 0.06 55); /* Same warm hue, lighter = coda whisper */
	}

	/* Contact: simple, recognizable */
	.footer-coda__contact {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.875rem;
		color: oklch(0.45 0.02 250);
		text-decoration: none;
		transition: color 150ms ease-out;
	}

	.footer-coda__contact:hover {
		color: oklch(0.35 0.02 250);
	}

	/* Legal: minimal presence */
	.footer-coda__legal {
		font-family: 'Satoshi', system-ui, sans-serif;
		font-size: 0.75rem;
		color: oklch(0.6 0.01 250);
		margin-top: 0.5rem;
	}
</style>
