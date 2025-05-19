<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import MapboxDraw from '@mapbox/mapbox-gl-draw';
	import DrawingTools from '$lib/components/widgets/menu/DrawingTools.svelte';
	import { layers, editableGeoJSON } from '$lib/components/io/stores';
	import { mapViewState } from '$lib/components/io/layer-management.svelte';

	mapboxgl.accessToken =
		'pk.eyJ1IjoiYXJwZXJ5YW4iLCJhIjoiY2l4cTJkc2t6MDAzcjJxcG9maWp1ZmFjMCJ9.XT957ywrTABjNFqGdp_37g';

	let map: mapboxgl.Map | undefined = $state();
	let container: HTMLElement;
	let draw: MapboxDraw | undefined = $state();
	let mapLoaded = $state(false);

	const initialViewState = {
		longitude: -74,
		latitude: 40.7,
		zoom: 4,
		maxZoom: 16,
		pitch: 0,
		bearing: 0
	};
	let deckInstance: any;

	$effect(() => {
		const updatedLayers = $layers
			.filter((e) => e.ctor) //@ts-ignore
			.map((e) => new e.ctor({ id: e.id, ...e.props }));
		if ($layers.length > 0 && deckInstance)
			deckInstance.setProps({ layers: updatedLayers, viewState: $mapViewState });
	});

	onMount(() => {
		map = new mapboxgl.Map({
			container: container,
			style: 'mapbox://styles/mapbox/navigation-night-v1',
			center: [initialViewState.longitude, initialViewState.latitude],
			zoom: initialViewState.zoom,
			maxZoom: initialViewState.maxZoom,
			pitch: initialViewState.pitch,
			bearing: initialViewState.bearing,
			interactive: true
		});

		map.on('load', () => {
			mapLoaded = true;

			draw = new MapboxDraw({
				displayControlsDefault: false,
				controls: {
					polygon: false,
					point: false,
					line_string: false,
					trash: false
				}
			});

			if ($editableGeoJSON.length > 0) {
				draw.add({
					type: 'FeatureCollection',
					features: $editableGeoJSON
				});
			}
		});
	});

	// Function to handle drawn features from child component
	function handleFeaturesUpdate(features: any) {}

	onDestroy(() => {
		map && map.remove();
	});
</script>

<div bind:this={container} class="map-container">
	{#if mapLoaded && map && draw}
		<div class="absolute left-1/2 top-4 z-10 -translate-x-1/2 transform">
			<DrawingTools {map} {draw} onFeaturesUpdate={handleFeaturesUpdate} />
		</div>
	{/if}
</div>

<style>
	.map-container {
		position: fixed;
		inset: 0;
		z-index: 0;
	}
</style>
