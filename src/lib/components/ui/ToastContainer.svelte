<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
	import Toast from './Toast.svelte';
</script>

<div class="fixed right-4 top-4 z-50 flex max-w-sm flex-col gap-2">
	{#each toast.toasts as toastData (toastData.id)}
		<Toast
			type={toastData.type}
			title={toastData.title}
			message={toastData.message}
			duration={toastData.duration}
			dismissible={toastData.dismissible}
			onDismiss={() => toast.removeToast(toastData.id)}
		/>
	{/each}
</div>
