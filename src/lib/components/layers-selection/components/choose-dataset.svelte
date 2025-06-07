<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { datasets, chosenDataset } from '$lib/io/stores';
	import SidebarMenuSubButton from '$lib/components/ui/sidebar/sidebar-menu-sub-button.svelte';
	// import SidebarMenuSubItem from '$lib/components/ui/sidebar/sidebar-menu-sub-item.svelte';
	import { buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
</script>

<DropdownMenu.Root>
	<SidebarMenuSubButton>
		{#snippet child({ props })}
			<DropdownMenu.Trigger
				{...props}
				class={cn(buttonVariants({ variant: 'secondary' }), 'w-full justify-between')}
				>{$chosenDataset === null
					? 'Choose Dataset'
					: $chosenDataset.datasetName}</DropdownMenu.Trigger
			>
		{/snippet}
	</SidebarMenuSubButton>
	<DropdownMenu.Content class="w-40">
		<DropdownMenu.Group>
			{#each $datasets as dataset (dataset.datasetName)}
				<DropdownMenu.Item
					onclick={() => {
						chosenDataset.set(dataset);
					}}>{dataset.datasetName}</DropdownMenu.Item
				>
			{/each}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
