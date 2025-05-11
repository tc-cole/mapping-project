<script lang="ts">
	import SidebarMenuSubButton from '$lib/components/ui/sidebar/sidebar-menu-sub-button.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { chosenDataset } from '$lib/components/io/stores';
	import { buttonVariants } from '$lib/components/ui/button';

	let { chosenColumn = $bindable<string | undefined>(), default_column } = $props();
</script>

<DropdownMenu.Root>
	<SidebarMenuSubButton>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<button class={buttonVariants({ variant: 'secondary' })}>
					<span {...props}>{chosenColumn ? chosenColumn : `Choose ${default_column} Column`}</span>
				</button>
			{/snippet}
		</DropdownMenu.Trigger>
	</SidebarMenuSubButton>
	<DropdownMenu.Content>
		<DropdownMenu.Group>
			{#if $chosenDataset !== null}
				{#each $chosenDataset.schema as column (column.name)}
					<DropdownMenu.Item
						onclick={() => {
							chosenColumn = column.name;
						}}>{column.name}</DropdownMenu.Item
					>
				{/each}
			{/if}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
