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
	let deckInstance: Deck = $state();

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

		const layers = layerEntries
			.filter(entry => {
				// Filter out invalid layers (those without a constructor)
				if (!entry || !entry.ctor) {
					return false;
				}
				return true;
			})
			.map(entry => {
				try {
					// Create a clean props object with only serializable values
					const props = { ...entry.props };
					
					// For safety, ensure required properties exist
					if (!props.data) {
						props.data = [];
					}
					
					// Create the layer instance
					const layer = new entry.ctor({
						id: entry.id,
						...props
					});
					
					return layer;
				} catch (error) {
					return null;
				}
			})
			.filter(Boolean); // Remove any null entries
		return layers;
	}
	
	$effect(() => {
		if (!deckInstance) return; // Early return if not initialized
		try {
			const updatedLayers = safeCreateLayers($layers);
			
			// Update deck instance with the new layers
			deckInstance.setProps({
				layers: updatedLayers,
				viewState: $mapViewState
			});
		} catch (error) {
			// Error handling without console.error
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
	
	  // Create deck.gl instance with proper initialization
	  try {
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
		  // Start with empty layers array
		  layers: [],

		});
	  } catch (deckError) {
		console.error('Failed to create Deck instance:', deckError);
	  }
	});
	
	onDestroy(() => {
		if (deckInstance) {
			try {
				deckInstance.finalize();
			} catch (error) {
				// Error handling without console.error
			}
		}
		
		if (map) {
			try {
				map.remove();
			} catch (error) {
				// Error handling without console.error
			}
		}
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
	  height: 100%;
	  width: 100%;
	}
	</style>