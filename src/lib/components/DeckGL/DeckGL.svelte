<script module lang="ts">
	import { writable } from 'svelte/store';
	export const mapInstance = writable<mapboxgl.Map | undefined>();
	export const drawInstance = writable<MapboxDraw | undefined>();
</script>

<script lang="ts">
	import MapboxDraw from '@mapbox/mapbox-gl-draw';
	import mapboxgl from 'mapbox-gl';
	import RadiusMode from "$lib/components/menu/utils/custom-draw-circle"
	console.log(RadiusMode)

	import { layers, editableGeoJSON, mapViewState } from '$lib/io/stores';
	import { Deck, MapView } from '@deck.gl/core';
	import { onDestroy, onMount } from 'svelte';

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

	function safeCreateLayers(layerEntries: any[]) {
		if (!layerEntries || !Array.isArray(layerEntries)) {
			return [];
		}

		return layerEntries
			.filter((entry) => {
				if (!entry || !entry.ctor) {
					return false;
				}
				return true;
			})
			.map((entry) => {
				try {
					const props = { ...entry.props };

					if (!props.data) {
						props.data = [];
					}

					return new entry.ctor({
						id: entry.id,
						...props
					});
				} catch (error) {
					console.error(`Error creating layer ${entry.id}:`, error);
					return null;
				}
			})
			.filter(Boolean);
	}

	$effect(() => {
		if (!deckInstance || !map) return;
		try {
			const updatedLayers = safeCreateLayers($layers);
			console.log(updatedLayers);
			deckInstance.setProps({
				layers: updatedLayers
			});
		} catch (error) {
			console.error('Error updating deck layers:', error);
		}
	});

	onMount(() => {
		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/mapbox/navigation-night-v1',
			center: [initialViewState.longitude, initialViewState.latitude],
			zoom: initialViewState.zoom,
			maxZoom: initialViewState.maxZoom,
			pitch: initialViewState.pitch,
			bearing: initialViewState.bearing
		});

		map.on('load', () => {
			draw = new MapboxDraw({
				userProperties: true,

				displayControlsDefault: false,
				controls: {
					polygon: false,
					point: false,
					line_string: false,
					trash: false
				},
				modes: {
					...MapboxDraw.modes,
					draw_circle: RadiusMode
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

			deckInstance = new Deck({
				canvas: deckCanvas,
				width: '100%',
				height: '100%', //@ts-ignore
				initialViewState: initialViewState,
				controller: false,
				views: [new MapView()],
				layers: [],
				onViewStateChange: ({ viewState }: any) => {
					mapViewState.set(viewState);
				}
			});

			map?.on('move', () => {
				if (!deckInstance || !map) return;
				const { lng, lat } = map.getCenter();
				const newViewState = {
					longitude: lng,
					latitude: lat,
					zoom: map.getZoom(),
					pitch: map.getPitch(),
					bearing: map.getBearing(),
					maxZoom: initialViewState.maxZoom
				};

				deckInstance.setProps({
					viewState: newViewState
				});

				mapViewState.set(newViewState);
			});
		});
	});

	onDestroy(() => {
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
	<div bind:this={mapContainer} class="map-container"></div>
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
