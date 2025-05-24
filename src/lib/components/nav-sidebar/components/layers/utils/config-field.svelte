<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { cn } from '$lib/utils';

	let { label, value = undefined, children, class: className = '' } = $props();
</script>

<div class={cn('space-y-1', className)}>
	{#if label}
		<div class="flex items-center justify-between">
			<Label class="text-xs text-muted-foreground">{label}</Label>
			{#if value !== undefined}
				<span class="font-mono text-xs text-muted-foreground">{value}</span>
			{/if}
		</div>
	{/if}
	{@render children()}
</div>
