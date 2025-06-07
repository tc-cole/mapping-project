<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let { children, label, defaultOpen = true, class: className = '' } = $props();

	let isOpen = $state(defaultOpen);
</script>

<div class={cn('overflow-hidden rounded-lg border border-border/50 bg-muted/30', className)}>
	<Collapsible.Root bind:open={isOpen}>
		<Collapsible.Trigger class="w-full">
			<button
				class="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
			>
				<span class="text-foreground/90">{label}</span>
				<ChevronDown
					class={cn(
						'h-4 w-4 text-muted-foreground transition-transform duration-200',
						isOpen && 'rotate-180'
					)}
				/>
			</button>
		</Collapsible.Trigger>

		<Collapsible.Content>
			<div class="space-y-3 px-3 pb-3 pt-1">
				{@render children()}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</div>

<style>
	/* Ensure child components fill width */
	:global(.sectional-content > *) {
		width: 100%;
	}

	/* Style direct button children to fill width */
	:global(.sectional-content button) {
		width: 100%;
		justify-content: space-between;
	}

	/* Better spacing for form elements */
	:global(.sectional-content input[type='range']) {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	/* Ensure dropdowns fill width */
	:global(.sectional-content [data-melt-dropdown-menu-trigger]) {
		width: 100%;
	}
</style>
