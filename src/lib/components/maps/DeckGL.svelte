<script lang="ts">
	import { layers as layerStore } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';

	import { onDestroy, onMount } from 'svelte';
	import { Deck } from '@deck.gl/core';
	import mapboxgl from 'mapbox-gl';

	mapboxgl.accessToken =
		'pk.eyJ1IjoiYXJwZXJ5YW4iLCJhIjoiY2l4cTJkc2t6MDAzcjJxcG9maWp1ZmFjMCJ9.XT957ywrTABjNFqGdp_37g';
	let deckInstance: any;
	let map: mapboxgl.Map;
	let container: HTMLElement;

	let INITIAL_VIEW_STATE = {
		longitude: -74,
		latitude: 40.7,
		zoom: 4,
		maxZoom: 16,
		pitch: 0,
		bearing: 0
	};

	$effect(() => {
		const updatedLayers = $layerStore
			.filter((e) => e.ctor)
			.map((e) => new e.ctor({ id: e.id, ...e.props }));
		//1;
		console.log(updatedLayers);
		if (updatedLayers.length > 0) deckInstance.setProps({ layers: updatedLayers });
	});

	onMount(() => {
		var id = 'base-map';

		map = new mapboxgl.Map({
			container: container,
			style: 'mapbox://styles/mapbox/navigation-night-v1',
			...INITIAL_VIEW_STATE
		});

		deckInstance = new Deck({
			canvas: 'deck-canvas',
			width: '100%',
			height: '100%',
			initialViewState: INITIAL_VIEW_STATE,
			controller: true,
			onViewStateChange: ({ viewState }) => {
				map.jumpTo({
					center: [viewState.longitude, viewState.latitude],
					zoom: viewState.zoom,
					bearing: viewState.bearing,
					pitch: viewState.pitch
				});
			},
			layers: []
		});
	});

	onDestroy(() => {
		deckInstance && deckInstance.finalize();
		map && map.remove();
	});
</script>

<div bind:this={container} class="map-container">
	<canvas id="deck-canvas" class="absolute h-full w-full"></canvas>
</div>

<style>
	.map-container {
		position: fixed;
		inset: 0;
		z-index: 0;
	}
</style>
