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
			class="flex h-9 w-full items-center justify-between rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white transition-colors hover:border-gray-500 hover:bg-gray-600"
		>
			<span class={cn('truncate text-left', !chosenColumn && 'text-gray-400')}>
				{displayText}
			</span>
			<ChevronDown class="ml-2 h-4 w-4 flex-shrink-0 text-gray-400" />
		</button>
	</DropdownMenu.Trigger>

	<DropdownMenu.Content
		class="w-full min-w-[200px] border border-gray-600 bg-gray-800"
		align="start"
	>
		{#if dataset !== null}
			{#if dataset.schema.length > 0}
				<DropdownMenu.Group>
					<DropdownMenu.Label class="px-2 py-1.5 text-xs text-gray-400">
						Available Columns
					</DropdownMenu.Label>
					{#each dataset.schema as column (column.name)}
						<DropdownMenu.Item
							class="flex items-center justify-between text-white hover:bg-gray-500 focus:bg-gray-700"
							onclick={() => {
								chosenColumn = column.name;
							}}
						>
							<div class="flex flex-col items-start">
								<span class="text-sm text-white">{column.name}</span>
								<span class="text-xs text-gray-400">{column.type}</span>
							</div>
							{#if chosenColumn === column.name}
								<Check class="h-4 w-4 text-blue-400" />
							{/if}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Group>
			{:else}
				<div class="px-2 py-6 text-center text-sm text-gray-400">No columns available</div>
			{/if}
		{:else}
			<div class="px-2 py-6 text-center text-sm text-gray-400">Please select a dataset first</div>
		{/if}

		{#if chosenColumn}
			<DropdownMenu.Separator class="bg-gray-600" />
			<DropdownMenu.Item
				class="text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-300 focus:bg-gray-700"
				onclick={() => {
					chosenColumn = undefined;
				}}
			>
				Clear selection
			</DropdownMenu.Item>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
