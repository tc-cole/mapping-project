<script lang="ts">
	import { Move, Trash2, CircleDot, SplineIcon, Hexagon, Circle } from '@lucide/svelte';
	import { clickedGeoJSON, openDrawer, datasets } from '$lib/io/stores';
	import { mapInstance, drawInstance } from '$lib/components/deck-gl/DeckGL.svelte';
	import { MaskExtension } from '@deck.gl/extensions';

	import { LayerFactory } from '$lib/io/layer-management.svelte';
	import { layers } from '$lib/io/stores';
	import { generateID } from '$lib/io/generateID';
	import type { Dataset } from '$lib/types';

	import type { TableField } from '$lib/io/DuckDBWASMClient.svelte';
	let drawnFeatures = $state<any[]>([]);
	let activeEditTool = $state('simple_select');
	let isDrawing = $state(false);
	let lastCompletedFeature = $state<any>(null);
	let selectionTrigger = $state(0); // Used to trigger reactivity for selections

	// Computed values for UI state
	let canDelete = $derived(() => {
		selectionTrigger; // Subscribe to selection changes
		if (!$drawInstance) return false;
		const selectedIds = $drawInstance.getSelectedIds();
		return selectedIds.length > 0 || $clickedGeoJSON !== null;
	});

	let deleteTooltip = $derived(() => {
		selectionTrigger; // Subscribe to selection changes
		if (!$drawInstance) return 'Draw tools not ready';
		const selectedIds = $drawInstance.getSelectedIds();
		const clickedFeature = $clickedGeoJSON;

		if (selectedIds.length > 0) {
			return `Delete ${selectedIds.length} selected feature${selectedIds.length !== 1 ? 's' : ''}`;
		} else if (clickedFeature) {
			return `Delete clicked ${clickedFeature.geometry.type}`;
		} else {
			return 'Select a feature to delete';
		}
	});

	$effect(() => {
		if ($mapInstance && $drawInstance) {
			// Set up event handlers for draw actions
			$mapInstance.on('draw.create', handleDrawCreate);
			$mapInstance.on('draw.update', handleDrawUpdate);
			$mapInstance.on('draw.delete', handleDrawDelete);
			$mapInstance.on('draw.modechange', handleModeChange);
			$mapInstance.on('draw.selectionchange', handleSelectionChange);

			// These events track the drawing state
			$mapInstance.on('draw.render', handleDrawRender);
			$mapInstance.on('mouseup', handleMouseUp);
			$mapInstance.on('touchend', handleTouchEnd);

			return () => {
				if ($mapInstance) {
					$mapInstance.off('draw.create', handleDrawCreate);
					$mapInstance.off('draw.update', handleDrawUpdate);
					$mapInstance.off('draw.delete', handleDrawDelete);
					$mapInstance.off('draw.modechange', handleModeChange);
					$mapInstance.off('draw.selectionchange', handleSelectionChange);
					$mapInstance.off('draw.render', handleDrawRender);
					$mapInstance.off('mouseup', handleMouseUp);
					$mapInstance.off('touchend', handleTouchEnd);
				}
			};
		}
	});

	// Handle creating new features
	async function handleDrawCreate(e: any) {
		const newFeatures = e.features.map((feature: any) => {
			// If it's a circle (point with radius), convert it to a polygon for deck.gl
			if (feature.geometry.type === 'Point' && feature.properties?.radius) {
				const circlePolygon = createCirclePolygon(
					feature.geometry.coordinates,
					parseFloat(feature.properties.radius) / 1000 // Convert meters to km
				);

				return {
					...feature,
					geometry: circlePolygon.geometry,
					properties: {
						...feature.properties,
						originalType: 'circle',
						center: feature.geometry.coordinates,
						radiusKm: parseFloat(feature.properties.radius) / 1000
					}
				};
			}
			return feature;
		});

		drawnFeatures = [...drawnFeatures, ...newFeatures];
		lastCompletedFeature = newFeatures[0];

		isDrawing = false;

		// Create dataset for the drawn feature
		await createDatasetFromDrawnFeature(newFeatures[0]);

		onDrawingComplete(newFeatures[0]);
	}

	async function handleDrawUpdate(e: any) {
		const updatedIds = e.features.map((f: any) => f.id);
		const updatedFeatures = e.features.map((feature: any) => {
			// Handle circle updates similar to creation
			if (feature.geometry.type === 'Point' && feature.properties?.radius) {
				const circlePolygon = createCirclePolygon(
					feature.geometry.coordinates,
					parseFloat(feature.properties.radius) / 1000
				);

				return {
					...feature,
					geometry: circlePolygon.geometry,
					properties: {
						...feature.properties,
						originalType: 'circle',
						center: feature.geometry.coordinates,
						radiusKm: parseFloat(feature.properties.radius) / 1000
					}
				};
			}
			return feature;
		});

		drawnFeatures = [
			...drawnFeatures.filter((f) => !updatedIds.includes(f.id)),
			...updatedFeatures
		];
		lastCompletedFeature = updatedFeatures[0];

		isDrawing = false;

		// Update the dataset for the modified feature
		if (updatedFeatures[0]) {
			await updateDatasetFromDrawnFeature(updatedFeatures[0]);
		}
	}

	async function handleDrawDelete(e: any) {
		const deletedIds = e.features.map((f: any) => f.id);

		// Remove from datasets store and database
		for (const deletedId of deletedIds) {
			await removeDatasetForDrawnFeature(deletedId);
		}

		drawnFeatures = drawnFeatures.filter((f) => !deletedIds.includes(f.id));
		lastCompletedFeature = null;

		// Clear clicked feature if it was deleted
		const clickedFeature = $clickedGeoJSON;
		if (clickedFeature && deletedIds.includes(clickedFeature.id)) {
			clickedGeoJSON.set(null);
			openDrawer.set(false);
		}

		// Trigger reactivity update
		selectionTrigger++;
	}

	function handleModeChange(e: any) {
		activeEditTool = e.mode;
		isDrawing = e.mode.startsWith('draw_');
		selectionTrigger++; // Trigger reactivity

		if (e.mode === 'simple_select') {
			isDrawing = false;
		}
	}

	function handleSelectionChange(e: any) {
		selectionTrigger++; // Trigger reactivity

		if (e.features && e.features.length > 0) {
			openDrawer.set(true);
			clickedGeoJSON.set(e.features[0]);
		}
	}

	function handleDrawRender(e: any) {
		if (activeEditTool.startsWith('draw_') && !activeEditTool.includes('select')) {
			isDrawing = true;
		}
	}

	function handleMouseUp(e: any) {
		if (isDrawing) {
			const currentFeatures = $drawInstance?.getAll().features || [];
			const inProgressFeature = currentFeatures.find(
				(f: any) => f.id === $drawInstance?.getSelectedIds()[0]
			);

			if (inProgressFeature) {
				if (activeEditTool === 'draw_point') {
					isDrawing = false;
					lastCompletedFeature = inProgressFeature;
					onDrawingComplete(inProgressFeature);
				}
			}
		}
	}

	function handleTouchEnd(e: any) {
		handleMouseUp(e);
	}

	// Create a dataset from a drawn feature
	async function createDatasetFromDrawnFeature(feature: any) {
		try {
			// Generate unique identifiers
			const datasetID = generateID();
			const geometryId = feature.id || generateID();

			// Calculate bounds and other geometry properties
			const bounds = calculateBounds(feature.geometry);
			const area = calculateArea(feature.geometry);
			const centroid = calculateCentroid(feature.geometry);

			// Create simple schema for GeoJSON
			const schema: TableField[] = [
				{ name: 'geometry', type: 'object', databaseType: 'GEOMETRY', nullable: false },
				{ name: 'properties', type: 'object', databaseType: 'JSON', nullable: true }
			];

			// Create Dataset object
			const dataset: Dataset = {
				// Core Identity
				datasetID: datasetID,
				datasetLabel: `Drawn ${feature.geometry.type}`,
				datasetType: 'drawn',
				datasetName: `drawn_${geometryId}`, // No actual table, just identifier
				layerID: generateID(),

				// Schema & Structure
				schema: schema,
				rowCount: 1,

				// Source Information
				source: {
					type: 'drawn',
					features: [feature],
					drawingSession: {
						startedAt: new Date(),
						completedAt: new Date(),
						toolUsed: activeEditTool
					}
				},

				// Processing Status
				status: {
					state: 'ready',
					progress: 100
				},

				// Timestamps
				createdAt: new Date(),
				updatedAt: new Date(),

				// Geometry-specific metadata
				metadata: {
					geometry: {
						geometryId: geometryId,
						shape: {
							type: feature.geometry.type as any,
							featureCount: 1,
							bounds: bounds,
							area: area,
							centroid: centroid
						},
						drawingContext: {
							tool: activeEditTool.replace('draw_', '') as any,
							createdBy: 'user',
							editHistory: [
								{
									timestamp: new Date(),
									action: 'create',
									description: `Created ${feature.geometry.type} using ${activeEditTool}`
								}
							]
						},
						properties: {
							hasZ: false,
							hasM: false,
							coordinateCount: countCoordinates(feature.geometry),
							ringCount:
								feature.geometry.type === 'Polygon'
									? feature.geometry.coordinates.length
									: undefined
						},
						usage: {
							usedAsFilter: false,
							usedAsMask: false,
							linkedLayerIds: []
						}
					}
				}
			};

			// Add to datasets store
			datasets.update((datasets) => [...datasets, dataset]);

			console.log('Created dataset for drawn feature:', dataset);
			return dataset;
		} catch (error) {
			console.error('Error creating dataset from drawn feature:', error);
		}
	}

	// Update dataset when feature is modified
	async function updateDatasetFromDrawnFeature(feature: any) {
		try {
			const geometryId = feature.id;

			// Find existing dataset
			const datasetIndex = $datasets.findIndex(
				(d) => d.metadata?.geometry?.geometryId === geometryId
			);

			if (datasetIndex === -1) {
				console.warn('Dataset not found for updated feature:', geometryId);
				return;
			}

			const dataset = $datasets[datasetIndex];

			// Update bounds and other properties
			const bounds = calculateBounds(feature.geometry);
			const area = calculateArea(feature.geometry);
			const centroid = calculateCentroid(feature.geometry);

			// Update dataset
			const updatedDataset: Dataset = {
				...dataset,
				updatedAt: new Date(),
				source: {
					type: 'drawn',
					features: [feature],
					drawingSession: {
						startedAt: new Date(),
						completedAt: new Date(),
						toolUsed: activeEditTool
					}
				},
				metadata: {
					...dataset.metadata,
					geometry: {
						...dataset.metadata?.geometry!,
						shape: {
							...dataset.metadata?.geometry?.shape!,
							bounds: bounds,
							area: area,
							centroid: centroid
						},
						drawingContext: {
							...dataset.metadata?.geometry?.drawingContext!,
							editHistory: [
								...(dataset.metadata?.geometry?.drawingContext?.editHistory || []),
								{
									timestamp: new Date(),
									action: 'modify',
									description: `Modified ${feature.geometry.type}`
								}
							]
						}
					}
				}
			};

			// Update store
			datasets.update((datasets) => {
				const newDatasets = [...datasets];
				newDatasets[datasetIndex] = updatedDataset;
				return newDatasets;
			});

			console.log('Updated dataset for modified feature:', updatedDataset);
		} catch (error) {
			console.error('Error updating dataset for drawn feature:', error);
		}
	}

	// Remove dataset when feature is deleted
	async function removeDatasetForDrawnFeature(featureId: string) {
		try {
			const dataset = $datasets.find((d) => d.metadata?.geometry?.geometryId === featureId);

			if (!dataset) {
				console.warn('Dataset not found for deleted feature:', featureId);
				return;
			}

			// Remove from store
			datasets.update((datasets) => datasets.filter((d) => d.datasetID !== dataset.datasetID));

			console.log('Removed dataset for deleted feature:', dataset.datasetID);
		} catch (error) {
			console.error('Error removing dataset for drawn feature:', error);
		}
	}

	// Helper functions for geometry calculations
	function calculateBounds(geometry: any) {
		let minLng = Infinity,
			maxLng = -Infinity;
		let minLat = Infinity,
			maxLat = -Infinity;

		function processCoords(coords: any) {
			if (Array.isArray(coords[0])) {
				coords.forEach(processCoords);
			} else {
				const [lng, lat] = coords;
				minLng = Math.min(minLng, lng);
				maxLng = Math.max(maxLng, lng);
				minLat = Math.min(minLat, lat);
				maxLat = Math.max(maxLat, lat);
			}
		}

		processCoords(geometry.coordinates);

		return {
			north: maxLat,
			south: minLat,
			east: maxLng,
			west: minLng
		};
	}

	function calculateArea(geometry: any): number {
		// Simplified area calculation - in a real app you'd use a proper library
		if (geometry.type === 'Polygon') {
			// Very rough area calculation for demonstration
			const bounds = calculateBounds(geometry);
			return (bounds.east - bounds.west) * (bounds.north - bounds.south);
		}
		return 0;
	}

	function calculateCentroid(geometry: any): [number, number] {
		const bounds = calculateBounds(geometry);
		return [(bounds.east + bounds.west) / 2, (bounds.north + bounds.south) / 2];
	}

	function countCoordinates(geometry: any): number {
		let count = 0;
		function processCoords(coords: any) {
			if (Array.isArray(coords[0])) {
				coords.forEach(processCoords);
			} else {
				count++;
			}
		}
		processCoords(geometry.coordinates);
		return count;
	}

	// Helper function to create a circle polygon from center and radius
	function createCirclePolygon(center: [number, number], radiusInKm: number, points: number = 64) {
		const coords = {
			latitude: center[1],
			longitude: center[0]
		};
		const km = radiusInKm;

		const ret = [];
		const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
		const distanceY = km / 110.574;

		let theta, x, y;
		for (let i = 0; i < points; i += 1) {
			theta = (i / points) * (2 * Math.PI);
			x = distanceX * Math.cos(theta);
			y = distanceY * Math.sin(theta);
			ret.push([coords.longitude + x, coords.latitude + y]);
		}
		ret.push(ret[0]); // Close the polygon

		return {
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [ret]
			}
		};
	}

	// Function that runs whenever a drawing is completed
	function onDrawingComplete(feature: any) {
		try {
			// Create a mask layer with the drawn feature
			const maskLayerId = `mask-${Date.now()}`;
			const geojsonMaskLayer = LayerFactory.create('geojson', {
				id: maskLayerId,
				props: {
					operation: 'mask',
					data: feature,
					stroked: true,
					filled: true,
					lineWidthMinPixels: 2,
					getLineColor: [255, 255, 255],
					getFillColor: [0, 0, 0, 0] // Transparent fill
				}
			});

			// Add the mask layer to the deck
			layers.add(geojsonMaskLayer);

			// Apply the mask extension to all existing layers that should be masked
			const layersSnapshot = layers.snapshot;

			// Use a transaction to batch all updates
			layers.transaction(() => {
				for (const layer of layersSnapshot) {
					// Skip the mask layer itself and any layers you don't want to mask
					if (layer.id === maskLayerId || layer.id.includes('basemap')) {
						continue;
					}

					// Apply the mask extension
					layers.updateProps(layer.id, {
						extensions: [new MaskExtension()],
						maskId: maskLayerId
					});
				}
			});

			console.log('Drawing completed and mask applied:', feature);
		} catch (error) {
			console.error('Error completing drawing:', error);
		}
	}

	function setDrawMode(mode: string) {
		if ($drawInstance) {
			try {
				$drawInstance.changeMode(mode);
				activeEditTool = mode;
				selectionTrigger++; // Trigger reactivity update
			} catch (error) {
				console.error('Error changing draw mode:', error);
			}
		} else {
			console.warn('Draw object not initialized yet');
		}
	}

	async function trashSelected() {
		if (!$drawInstance) {
			console.warn('Draw object not initialized yet');
			return;
		}

		try {
			let idsToDelete: string[] = [];

			// Get currently selected features from draw instance
			const selectedIds = $drawInstance.getSelectedIds();

			// Also check if we have a clicked feature
			const clickedFeature = $clickedGeoJSON;

			if (selectedIds.length > 0) {
				idsToDelete = selectedIds;
			} else if (clickedFeature && clickedFeature.id) {
				// If no features are selected but we have a clicked feature, delete that
				idsToDelete = [clickedFeature.id];
				// Select the clicked feature first so we can delete it
				$drawInstance.changeMode('simple_select', { featureIds: [clickedFeature.id] });
			}

			if (idsToDelete.length > 0) {
				// Remove datasets for features being deleted
				for (const featureId of idsToDelete) {
					await removeDatasetForDrawnFeature(featureId);
				}

				// Delete from draw instance
				$drawInstance.trash();

				// Remove from our local state
				drawnFeatures = drawnFeatures.filter((f) => !idsToDelete.includes(f.id));

				// Clear clicked feature if it was deleted
				if (clickedFeature && idsToDelete.includes(clickedFeature.id)) {
					clickedGeoJSON.set(null);
					openDrawer.set(false);
				}

				// Trigger reactivity update
				selectionTrigger++;

				console.log('Deleted features:', idsToDelete);
			} else {
				console.log('No features selected for deletion');
			}
		} catch (error) {
			console.error('Error deleting features:', error);
		}
	}

	// Clear all drawn features
	async function clearAll() {
		if ($drawInstance) {
			try {
				// Get all features before clearing
				const allFeatures = $drawInstance.getAll().features;

				// Remove datasets for all features
				for (const feature of allFeatures) {
					if (feature.id) {
						await removeDatasetForDrawnFeature(String(feature.id));
					}
				}

				$drawInstance.deleteAll();
				drawnFeatures = [];
				lastCompletedFeature = null;

				// Clear any clicked feature and close drawer
				clickedGeoJSON.set(null);
				openDrawer.set(false);

				// Trigger reactivity update
				selectionTrigger++;
			} catch (error) {
				console.error('Error clearing all features:', error);
			}
		}
	}
</script>

<!-- Toolbar for quick access to editing tools -->
<div class="mt-4 flex items-center gap-3 rounded bg-gray-800 p-2">
	<!-- Selection/Modify Tool -->
	<button
		class={`rounded p-2 transition-colors ${activeEditTool === 'simple_select' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Select & Modify Features"
		onclick={() => setDrawMode('simple_select')}
		disabled={!$drawInstance}
	>
		<Move size={20} strokeWidth={2} />
		<span class="sr-only">Modify</span>
	</button>

	<!-- Draw Point Tool -->
	<button
		class={`rounded p-2 transition-colors ${activeEditTool === 'draw_point' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Point"
		onclick={() => setDrawMode('draw_point')}
		disabled={!$drawInstance}
	>
		<CircleDot size={20} />
		<span class="sr-only">Draw Point</span>
	</button>

	<!-- Draw Line Tool -->
	<button
		class={`rounded p-2 transition-colors ${activeEditTool === 'draw_line_string' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Line"
		onclick={() => setDrawMode('draw_line_string')}
		disabled={!$drawInstance}
	>
		<SplineIcon size={20} />
		<span class="sr-only">Draw Line</span>
	</button>

	<!-- Draw Polygon Tool -->
	<button
		class={`rounded p-2 transition-colors ${activeEditTool === 'draw_polygon' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Polygon"
		onclick={() => setDrawMode('draw_polygon')}
		disabled={!$drawInstance}
	>
		<Hexagon size={20} />
		<span class="sr-only">Draw Polygon</span>
	</button>

	<!-- Draw Circle Tool (commented out until custom mode is implemented) -->
	<!--
	<button
		class={`rounded p-2 transition-colors ${activeEditTool === 'draw_circle' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Circle"
		onclick={() => setDrawMode('draw_circle')}
		disabled={!$drawInstance}
	>
		<Circle size={20} />
		<span class="sr-only">Draw Circle</span>
	</button>
	-->

	<!-- Delete Tools -->
	<div class="mx-1 h-6 w-px bg-gray-600"></div>
	<button
		class="rounded p-2 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
		onclick={trashSelected}
		disabled={!canDelete}
	>
		<Trash2 size={20} />
		<span class="sr-only">Delete Selected</span>
	</button>

	<!-- Feature Counter and Status -->
	{#if drawnFeatures.length > 0}
		<div class="mx-2 flex items-center gap-3 text-sm text-gray-300">
			<button
				class="rounded px-2 py-1 text-xs transition-colors hover:bg-gray-700"
				title="Clear All Features"
				onclick={clearAll}
			>
				Clear All
			</button>
		</div>
	{/if}
</div>
