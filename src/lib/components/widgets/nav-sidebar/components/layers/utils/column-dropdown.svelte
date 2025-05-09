<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { chosenDataset } from '$lib/components/io/stores';

	let { chosenColumn = $bindable<string | undefined>() } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>{chosenColumn ? chosenColumn : 'Choose Column'}</DropdownMenu.Trigger>
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
