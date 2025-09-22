<script lang="ts">
	import { Info } from '@lucide/svelte';

	interface Props {
		message?: string;
		testId?: string;
	}

	const { message = 'Adding personal experience increases message impact', testId }: Props =
		$props();
</script>

<div
	data-testid={testId || 'agency-ribbon'}
	class="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800"
	role="status"
	aria-live="polite"
>
	<div class="flex items-center gap-2">
		<Info class="h-4 w-4 text-blue-500" aria-hidden="true" />
		<span>{message}</span>
	</div>
</div>
