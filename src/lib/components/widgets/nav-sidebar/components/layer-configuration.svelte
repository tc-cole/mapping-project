<script lang="ts">
	import ScatterLayer from './layers/scatter-layer.svelte';
	import PolygonLayer from './layers/polygon-layer.svelte';
	//import TripsLayer from './layers/trips-layer.svelte';
	import LineLayer from './layers/line-layer.svelte';
	import ArcLayer from './layers/arc-layer.svelte';
	import H3Layer from './layers/h3-layer.svelte';
	import EditableGeoJsonLayer from './layers/editable-geojson-layer.svelte';
	import { layerDefs } from '$lib/components/maps/layer-io.svelte'; // singleton instance

	let { layertype, layer } = $props();
</script>

<div>
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
</div>
