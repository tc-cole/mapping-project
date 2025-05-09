<script lang="ts">
	import { layers, layerDefs } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte'; // singleton instance
	import * as Collapsible from '$lib/components/ui/collapsible';

	import { Trash2, ChevronRight } from '@lucide/svelte';
	import ChooseLayerType from './choose-layer-type.svelte';
	import ColumnDropdown from './layers/utils/column-dropdown.svelte';
	import ChooseDataset from './choose-dataset.svelte';

	import ScatterLayer from './layers/scatter-layer.svelte';
	import PolygonLayer from './layers/polygon-layer.svelte';
	import TripsLayer from './layers/trips-layer.svelte';
	import LineLayer from './layers/line-layer.svelte';
	import ArcLayer from './layers/arc-layer.svelte';
	import H3Layer from './layers/h3-layer.svelte';
	import EditableGeoJsonLayer from './layers/editable-geojson-layer.svelte';

	let { layer } = $props();

	// Initialize layertype based on the layer's constructor
	let layertype = $state('');

	$effect(() => {
		const match = Object.values(layerDefs).find((d) => d.ctor === layer.ctor);
		if (match) {
			layertype = match.label;
		}
	});

	$effect(() => {
		console.log('Current layer type:', layertype);
	});

	const update = (patch: any) => layers.updateProps(layer.id, patch);
	const remove = () => layers.remove(layer.id);
</script>

<Collapsible.Root>
	<Collapsible.Trigger class="flex w-full items-center gap-2 px-4 py-3 hover:bg-muted/50">
		<ChevronRight class="transition-transform" size={16} />

		<span class="flex-1 truncate">Layer</span>

		<!--<Switch checked={layer.props.visible ?? true} onchange={(e) => update({ visible: e.detail })} /> -->
		<button class="p-1 text-muted-foreground hover:text-destructive" onclick={remove}>
			<Trash2 size={16} />
		</button>
	</Collapsible.Trigger>

	<!-- body -->
	<Collapsible.Content class="space-y-4 px-4 pb-4">
		<ChooseLayerType {layer} bind:layertype />
		{#if layertype === layerDefs.arc.label}
			<ArcLayer {layer} />
		{:else if layertype === layerDefs.h3.label}
			<H3Layer {layer} />
		{:else if layertype === layerDefs.line.label}
			<LineLayer {layer} />
		{:else if layertype === layerDefs.polygon.label}
			<PolygonLayer {layer} />
		{:else if layertype === layerDefs.scatter.label}
			<ScatterLayer {layer} />
			<!--
		{:else if layertype === layerDefs.trips.label}
			<TripsLayer {layer} />
			-->
		{:else if layertype === 'GeoJSON'}
			<EditableGeoJsonLayer {layer} />
		{/if}
		<ChooseDataset />

		<div class="flex items-center justify-between">
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				oninput={(e: any) => update({ opacity: +e.target.value })}
			/>
		</div>
	</Collapsible.Content>
</Collapsible.Root>
