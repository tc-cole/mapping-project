<script lang="ts">
	//import { layers, mostRecentChartID, allCharts } from '$lib/io/Stores';
	import { onDestroy, onMount } from 'svelte';
	import { Deck } from '@deck.gl/core';
	import mapboxgl from 'mapbox-gl';
	import { writable } from 'svelte/store';
	import Button from '../ui/button/button.svelte';

	const layers = writable([]);

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

	onMount(() => {
		var id = 'base-map';

		map = new mapboxgl.Map({
			container: container,
			style: 'mapbox://styles/mapbox/navigation-night-v1',
			...INITIAL_VIEW_STATE
		});

		layers.set([]);

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

	.overlay-button {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 10;
	}
</style>
