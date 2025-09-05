<script lang="ts">
	let { 
		classNames = ''
	}: {
		classNames?: string;
	} = $props();
</script>

<div class="text-center {classNames}">
	<div class="h-8 w-12 bg-slate-200 rounded mx-auto mb-1 animate-pulse"></div>
	<div class="h-3 w-16 bg-slate-100 rounded mx-auto animate-pulse"></div>
</div>