<script lang="ts">
	import {
		layers,
		layerDefs,
		type DeckLayerEntry
	} from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	let { layer, layertype = $bindable() }: { layer: DeckLayerEntry; layertype: string } = $props();

	let selectedLabel = $state('Choose Type');

	$effect(() => {
		layer.ctor
			? (Object.values(layerDefs).find((d) => d.ctor === layer.ctor)?.label ?? 'Choose type')
			: 'Choose type';
	});

	function chooseType(key: keyof typeof layerDefs) {
		layers.switchType(layer.id, key);
		selectedLabel = layerDefs[key].label;
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class="w-full rounded border px-2 py-1 text-left">
		{selectedLabel}
	</DropdownMenu.Trigger>

	<DropdownMenu.Content class="w-40">
		<DropdownMenu.Group>
			{#each Object.entries(layerDefs) as [key, def]}
				<DropdownMenu.Item onclick={() => chooseType(key)}>
					{def.label}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
