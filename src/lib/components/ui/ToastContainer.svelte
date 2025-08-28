<script lang="ts">
	import { toast } from '$lib/stores/toast';
	import Toast from './Toast.svelte';
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
	{#each $toast.toasts as toastData (toastData.id)}
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