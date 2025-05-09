<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { fileUploadStore, chosenDataset } from '$lib/components/io/stores';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		>{$chosenDataset === null ? 'Choose Dataset' : $chosenDataset.filename}</DropdownMenu.Trigger
	>
	<DropdownMenu.Content>
		<DropdownMenu.Group>
			{#each $fileUploadStore as dataset (dataset.filename)}
				<DropdownMenu.Item
					onclick={() => {
						chosenDataset.set(dataset);
					}}>{dataset.filename}</DropdownMenu.Item
				>
			{/each}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
