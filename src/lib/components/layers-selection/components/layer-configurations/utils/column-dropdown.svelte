<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { ChevronDown, Check } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let {
		chosenColumn = $bindable<string | undefined>(),
		default_column,
		placeholder,
		class: className = '',
		dataset
	} = $props();

	let displayText = $derived(chosenColumn || placeholder || `Select ${default_column}`);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={cn('w-full', className)}>
		<button
			class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			<span class={cn('truncate text-left', !chosenColumn && 'text-muted-foreground')}>
				{displayText}
			</span>
			<ChevronDown class="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
		</button>
	</DropdownMenu.Trigger>

	<DropdownMenu.Content class="w-full min-w-[200px]" align="start">
		{#if dataset !== null}
			{#if dataset.schema.length > 0}
				<DropdownMenu.Group>
					<DropdownMenu.Label class="px-2 py-1.5 text-xs text-muted-foreground">
						Available Columns
					</DropdownMenu.Label>
					{#each dataset.schema as column (column.name)}
						<DropdownMenu.Item
							class="flex items-center justify-between"
							onclick={() => {
								chosenColumn = column.name;
							}}
						>
							<div class="flex flex-col items-start">
								<span class="text-sm">{column.name}</span>
								<span class="text-xs text-muted-foreground">{column.type}</span>
							</div>
							{#if chosenColumn === column.name}
								<Check class="h-4 w-4 text-primary" />
							{/if}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Group>
			{:else}
				<div class="px-2 py-6 text-center text-sm text-muted-foreground">No columns available</div>
			{/if}
		{:else}
			<div class="px-2 py-6 text-center text-sm text-muted-foreground">
				Please select a dataset first
			</div>
		{/if}

		{#if chosenColumn}
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				class="text-sm text-muted-foreground"
				onclick={() => {
					chosenColumn = undefined;
				}}
			>
				Clear selection
			</DropdownMenu.Item>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
