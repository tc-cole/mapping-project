<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { ArrowUpDown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	// Destructure the 'variant' prop and any additional props
	let { variant = 'ghost', ...restProps }: ComponentProps<typeof Button> = $props();
</script>

<Button {variant} {...restProps}>
	{#if restProps.innerText}
		{restProps.innerText}
	{/if}
	<ArrowUpDown class="ml-2 size-4" />
</Button>
