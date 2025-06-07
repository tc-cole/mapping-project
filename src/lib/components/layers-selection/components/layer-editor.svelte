<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible';
	//import * as Sidebar from '$lib/components/ui/sidebar/index';

	import ChooseLayerType from './choose-layer-type.svelte';
	//import ChooseDataset from './choose-dataset.svelte';

	import { layers } from '$lib/io/stores';
	import { layerDefs } from '$lib/io/layer-management.svelte'; // singleton instance
	import { X, ChevronDown } from '@lucide/svelte';

	let layertype = $state('Layer');
	let { layer } = $props();

	$effect(() => {
		const match = Object.values(layerDefs).find((d) => d.ctor === layer.ctor);
		if (match) {
			layertype = match.label + ' Layer';
		} else {
			layertype = 'Layer';
		}
	});

	const remove = () => layers.remove(layer.id);
</script>

<Collapsible.Root>
	<Collapsible.Trigger class="flex w-full items-center gap-2 px-4 py-3 hover:bg-muted/50">
		{#snippet child({ props })}
			<span class="flex-1 truncate">{layertype}</span>

			<!--<Switch checked={layer.props.visible ?? true} onchange={(e) => update({ visible: e.detail })} /> -->
			<button class="p-1 text-muted-foreground hover:text-destructive" onclick={remove}>
				<X size={16} />
			</button>
			<ChevronDown
				class="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180"
			/>
		{/snippet}
	</Collapsible.Trigger>

	<!-- body -->
	<Collapsible.Content class="px-2 pb-4">
		<ChooseLayerType {layer} />
	</Collapsible.Content>
</Collapsible.Root>
