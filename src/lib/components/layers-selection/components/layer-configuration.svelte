<script lang="ts">
	import ScatterLayer from './layer-configurations/scatter-layer-configuration.svelte';
	import PolygonLayer from './layer-configurations/polygon-layer-configuration.svelte';
	//import TripsLayer from './layers/trips-layer.svelte';
	import LineLayer from './layer-configurations/line-layer-configuration.svelte';
	import ArcLayer from './layer-configurations/arc-layer-configuration.svelte';
	import H3Layer from './layer-configurations/h3-layer-configuration.svelte';
	import { layerDefs } from '$lib/io/layer-management.svelte'; // singleton instance
	import GeoJSONLayer from './layer-configurations/geojson-layer-configuration.svelte';

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
