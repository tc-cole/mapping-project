<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { fileUploadStore, chosenDataset } from '$lib/components/io/stores';
	import SidebarMenuSubButton from '$lib/components/ui/sidebar/sidebar-menu-sub-button.svelte';
	import SidebarMenuSubItem from '$lib/components/ui/sidebar/sidebar-menu-sub-item.svelte';
	import { buttonVariants } from '$lib/components/ui/button';
</script>

<DropdownMenu.Root>
	<SidebarMenuSubButton>
		{#snippet child({ props })}
			<DropdownMenu.Trigger {...props} class={buttonVariants({ variant: 'secondary' })}
				>{$chosenDataset === null
					? 'Choose Dataset'
					: $chosenDataset.filename}</DropdownMenu.Trigger
			>
		{/snippet}
	</SidebarMenuSubButton>
	<DropdownMenu.Content class="w-40">
		<DropdownMenu.Group>
			{#each $fileUploadStore as dataset (dataset.filename)}
				<SidebarMenuSubItem
					onclick={() => {
						chosenDataset.set(dataset);
					}}>{dataset.filename}</SidebarMenuSubItem
				>
			{/each}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
