<script lang="ts">
	import { Mail } from '@lucide/svelte';
</script>

<footer class="mt-16 border-t border-slate-200">
	<div class="mx-auto max-w-6xl px-6 py-12">
		<div class="grid gap-8 md:grid-cols-2">
			<!-- Platform Info -->
			<div>
				<h3 class="mb-3 text-sm font-semibold text-slate-900">About Communiqué</h3>
				<p class="text-sm text-slate-600">
					Message templates and delivery tools for effective civic engagement campaigns.
				</p>
			</div>

			<!-- Contact -->
			<div class="md:text-right">
				<h3 class="mb-3 text-sm font-semibold text-slate-900">Contact</h3>
				<a
					href="mailto:support@communique.com"
					class="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
				>
					<Mail class="h-4 w-4" />
					hello@communi.email
				</a>
			</div>
		</div>

		<div class="mt-8 border-t border-slate-200 pt-8">
			<p class="text-center text-sm text-slate-500">© 2024 Communique Inc.</p>
		</div>
	</div>
</footer>
