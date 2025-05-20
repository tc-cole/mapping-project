<script module lang="ts">
	import { writable } from 'svelte/store';
	export const mapInstance = writable<mapboxgl.Map | undefined>();
	export const drawInstance = writable<MapboxDraw | undefined>();
</script>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import MapboxDraw from '@mapbox/mapbox-gl-draw';

	import { layers, editableGeoJSON } from '$lib/components/io/stores';
	import { mapViewState } from '$lib/components/io/layer-management.svelte';
	import { Deck } from '@deck.gl/core';

	mapboxgl.accessToken =
		'pk.eyJ1IjoiYXJwZXJ5YW4iLCJhIjoiY2l4cTJkc2t6MDAzcjJxcG9maWp1ZmFjMCJ9.XT957ywrTABjNFqGdp_37g';

	let map: mapboxgl.Map | undefined = $state();
	let container: any;
	let draw: MapboxDraw | undefined = $state();

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
		if (!deckInstance) return; // Early return if not initialized

		try {
			// Filter out invalid layers (those without a constructor)
			const validLayers = $layers.filter((e) => e.ctor);

			// Create layer instances from valid layer entries
			const updatedLayers = validLayers
				.map((e) => {
					try {
						//@ts-ignore
						return new e.ctor({ id: e.id, ...e.props });
					} catch (error) {
						console.error(`Failed to instantiate layer ${e.id}:`, error);
						return null;
					}
				})
				.filter(Boolean); // Remove any null entries

			// Update deck instance with the new layers
			deckInstance.setProps({
				layers: updatedLayers,
				viewState: $mapViewState
			});
		} catch (error) {
			console.error('Error updating deck layers:', error);
		}
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
			draw = new MapboxDraw({
				displayControlsDefault: false,
				controls: {
					polygon: false,
					point: false,
					line_string: false,
					trash: false
				}
			});

			map?.addControl(draw);

			mapInstance.set(map);
			drawInstance.set(draw);

			if ($editableGeoJSON.length > 0) {
				draw.add({
					type: 'FeatureCollection',
					features: $editableGeoJSON
				});
			}
		});

		deckInstance = new Deck({
			id: 'basemap',
			canvas: 'deck-canvas',
			width: '100%',
			height: '100%',
			initialViewState: initialViewState,
			controller: true,
			onViewStateChange: ({ viewState }: any) => {
				mapViewState.set(viewState);
				map?.jumpTo({
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

<div bind:this={container} class="map-container"></div>

<style>
	.map-container {
		position: fixed;
		inset: 0;
		z-index: 0;
		height: 100%;
		width: 100%;
	}
</style>
