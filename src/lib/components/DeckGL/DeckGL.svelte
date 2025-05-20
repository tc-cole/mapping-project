<script module lang="ts">
	import { writable } from 'svelte/store';
	export const mapInstance = writable<mapboxgl.Map | undefined>();
	export const drawInstance = writable<MapboxDraw | undefined>();
</script>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css'; // Import Mapbox GL CSS
	import MapboxDraw from '@mapbox/mapbox-gl-draw';
	import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'; // Import Draw CSS

	import { layers, editableGeoJSON } from '$lib/components/io/stores';
	import { mapViewState } from '$lib/components/io/layer-management.svelte';
	import { Deck, MapView } from '@deck.gl/core';

	mapboxgl.accessToken =
		'pk.eyJ1IjoiYXJwZXJ5YW4iLCJhIjoiY2l4cTJkc2t6MDAzcjJxcG9maWp1ZmFjMCJ9.XT957ywrTABjNFqGdp_37g';

	let mapContainer: HTMLElement;
	let deckCanvas: HTMLCanvasElement;
	let map: mapboxgl.Map | undefined = $state();
	let draw: MapboxDraw | undefined = $state();
	let deckInstance = $state<any>();

	const initialViewState = {
		longitude: -74,
		latitude: 40.7,
		zoom: 4,
		maxZoom: 16,
		pitch: 0,
		bearing: 0
	};

	// Helper function to safely instantiate deck.gl layers
	function safeCreateLayers(layerEntries: any[]) {
		if (!layerEntries || !Array.isArray(layerEntries)) {
			return [];
		}

		return layerEntries
			.filter((entry) => {
				// Filter out invalid layers (those without a constructor)
				if (!entry || !entry.ctor) {
					return false;
				}
				return true;
			})
			.map((entry) => {
				try {
					// Create a clean props object with only serializable values
					const props = { ...entry.props };

					// For safety, ensure required properties exist
					if (!props.data) {
						props.data = [];
					}

					// Create the layer instance
					return new entry.ctor({
						id: entry.id,
						...props
					});
				} catch (error) {
					console.error(`Error creating layer ${entry.id}:`, error);
					return null;
				}
			})
			.filter(Boolean); // Remove any null entries
	}

	$effect(() => {
		if (!deckInstance || !map) return; // Early return if not initialized

		try {
			const updatedLayers = safeCreateLayers($layers);

			// Update deck instance with the new layers
			deckInstance.setProps({
				layers: updatedLayers
				// Don't set viewState here as it's synced with Mapbox
			});
		} catch (error) {
			console.error('Error updating deck layers:', error);
		}
	});

	onMount(() => {
		// Initialize Mapbox GL map first with an empty container
		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/mapbox/navigation-night-v1',
			center: [initialViewState.longitude, initialViewState.latitude],
			zoom: initialViewState.zoom,
			maxZoom: initialViewState.maxZoom,
			pitch: initialViewState.pitch,
			bearing: initialViewState.bearing
		});

		// Set up map load handler
		map.on('load', () => {
			// Initialize the MapboxDraw instance
			draw = new MapboxDraw({
				displayControlsDefault: false,
				controls: {
					polygon: false,
					point: false,
					line_string: false,
					trash: false
				}
				// Explicitly include all drawing modes
				//modes: MapboxDraw.modes
			});

			// Add the draw control to the map
			map?.addControl(draw);

			// Update the writable stores with the instances
			mapInstance.set(map);
			drawInstance.set(draw);

			// Add any existing GeoJSON features
			if ($editableGeoJSON.length > 0) {
				draw.add({
					type: 'FeatureCollection',
					features: $editableGeoJSON
				});
			}

			// Now create the Deck.gl instance as an overlay
			deckInstance = new Deck({
				canvas: deckCanvas,
				width: '100%',
				height: '100%',
				initialViewState: initialViewState,
				controller: false, // Let Mapbox handle the controller
				views: [new MapView()],
				layers: [],
				onViewStateChange: ({ viewState }: any) => {
					// This typically won't fire since controller is false
					mapViewState.set(viewState);
				}
			});

			// Set up map move synchronization with Deck.gl
			map?.on('move', () => {
				if (!deckInstance) return;
				if (!map) return;
				const { lng, lat } = map.getCenter();
				const newViewState = {
					longitude: lng,
					latitude: lat,
					zoom: map.getZoom(),
					pitch: map.getPitch(),
					bearing: map.getBearing(),
					maxZoom: initialViewState.maxZoom
				};

				// Update Deck.gl viewState
				deckInstance.setProps({
					viewState: newViewState
				});

				// Update the mapViewState store
				mapViewState.set(newViewState);
			});
		});
	});

	onDestroy(() => {
		// Clean up resources when component is destroyed
		if (deckInstance) {
			try {
				deckInstance.finalize();
			} catch (error) {
				console.error('Error finalizing Deck instance:', error);
			}
		}

		if (map) {
			try {
				map.remove();
			} catch (error) {
				console.error('Error removing map:', error);
			}
		}
	});
</script>

<div class="map-container-wrapper">
	<!-- Mapbox container - must be empty when map initializes -->
	<div bind:this={mapContainer} class="map-container"></div>

	<!-- Deck.gl canvas overlay -->
	<canvas bind:this={deckCanvas} class="deck-canvas"></canvas>
</div>

<style>
	.map-container-wrapper {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	.map-container {
		position: absolute;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	.deck-canvas {
		position: absolute;
		width: 100%;
		height: 100%;
		z-index: 2;
		pointer-events: none; /* Let clicks pass through to the map */
	}
</style>
