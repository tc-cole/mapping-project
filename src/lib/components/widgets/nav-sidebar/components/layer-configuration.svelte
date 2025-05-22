<script lang="ts">
	import ScatterLayer from './layers/scatter-layer.svelte';
	import PolygonLayer from './layers/polygon-layer.svelte';
	//import TripsLayer from './layers/trips-layer.svelte';
	import LineLayer from './layers/line-layer.svelte';
	import ArcLayer from './layers/arc-layer.svelte';
	import H3Layer from './layers/h3-layer.svelte';
	import { layerDefs } from '$lib/components/io/layer-management.svelte'; // singleton instance
	import GeoJSONLayer from './layers/geojson-layer.svelte';

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
	{:else if layertype === 'geojson'}
		<GeoJSONLayer {layer} />
	{/if}
</div>
