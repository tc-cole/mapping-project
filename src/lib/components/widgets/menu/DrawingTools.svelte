<script lang="ts">
	import { Move, Trash2, CircleDot, SplineIcon, Hexagon } from '@lucide/svelte';
	import { clickedGeoJSON, openDrawer } from '$lib/components/io/stores';
	import { mapInstance, drawInstance } from '$lib/components/DeckGL/DeckGL.svelte';
	import { MaskExtension } from '@deck.gl/extensions';

	import { LayerFactory } from '$lib/components/io/layer-management.svelte';
	import { layers } from '$lib/components/io/stores';

	// Define props with correct typing

	let drawnFeatures = $state<any[]>([]);
	let activeEditTool = $state('simple_select');
	let isDrawing = $state(false);
	let lastCompletedFeature = $state<any>(null);

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
				$mapInstance.off('draw.create', handleDrawCreate);
				$mapInstance.off('draw.update', handleDrawUpdate);
				$mapInstance.off('draw.delete', handleDrawDelete);
				$mapInstance.off('draw.modechange', handleModeChange);
				$mapInstance.off('draw.selectionchange', handleSelectionChange);
				$mapInstance.off('draw.render', handleDrawRender);
				$mapInstance.off('mouseup', handleMouseUp);
				$mapInstance.off('touchend', handleTouchEnd);
			};
		}
	});

	// Handle creating new features
	function handleDrawCreate(e: any) {
		drawnFeatures = [...drawnFeatures, ...e.features];
		lastCompletedFeature = e.features[0];

		isDrawing = false;

		onDrawingComplete(e.features[0]);
	}

	function handleDrawUpdate(e: any) {
		const updatedIds = e.features.map((f: any) => f.id);
		drawnFeatures = [...drawnFeatures.filter((f) => !updatedIds.includes(f.id)), ...e.features];
		lastCompletedFeature = e.features[0];

		// The editing is complete when a feature is updated
		isDrawing = false;
	}

	function handleDrawDelete(e: any) {
		const deletedIds = e.features.map((f: any) => f.id);
		drawnFeatures = drawnFeatures.filter((f) => !deletedIds.includes(f.id));
		lastCompletedFeature = null;
	}

	function handleModeChange(e: any) {
		activeEditTool = e.mode;

		isDrawing = e.mode.startsWith('draw_');

		if (e.mode === 'simple_select') {
			isDrawing = false;
			console.log(e);
		}
	}

	function handleSelectionChange(e: any) {
		openDrawer.set(true);
		clickedGeoJSON.set(e.features[0]);
	}

	// This event fires continuously during drawing
	function handleDrawRender(e: any) {
		if (activeEditTool.startsWith('draw_') && !activeEditTool.includes('select')) {
			isDrawing = true;
		}
	}

	// Test function to create a polygon mask over part of Manhattan
	function createTestMask() {
		// Rectangle covering part of Midtown Manhattan
		const manhattanPolygon = {
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[-73.99, 40.75], // Southwest corner
						[-73.97, 40.75], // Southeast corner
						[-73.97, 40.77], // Northeast corner
						[-73.99, 40.77], // Northwest corner
						[-73.99, 40.75] // Close the polygon
					]
				]
			}
		};

		// Call your mask creation function with this polygon
		onDrawingComplete(manhattanPolygon);
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

	function onDrawingComplete(feature: any) {
		if (!feature || !feature.geometry) {
			console.error('Invalid feature drawn');
			return;
		}

		const maskLayerId = `mask-${Date.now()}`;

		// Create and add the mask layer
		const maskLayer = LayerFactory.create('geojson', {
			id: maskLayerId,
			props: {
				operation: 'mask',
				data: feature,
				stroked: true,
				filled: true,
				visible: false,
				lineWidthMinPixels: 2,
				getLineColor: [255, 255, 255],
				getFillColor: [0, 0, 0, 0]
			}
		});

		layers.add(maskLayer);

		// Get all existing layers
		const layersSnapshot = [...layers.snapshot];

		// Remove and recreate each layer with masks applied
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
					// Optional: control how masking works
					// maskByInstance: true or false depending on the layer type
				});
			}
		});
	}

	function setDrawMode(mode: string) {
		if ($drawInstance) {
			try {
				$drawInstance.changeMode(mode);
				activeEditTool = mode;
			} catch (error) {
				console.error('Error changing draw mode:', error);
			}
		} else {
			console.warn('Draw object not initialized yet');
		}
	}

	function trashSelected() {
		if ($drawInstance) {
			try {
				$drawInstance.trash();
			} catch (error) {
				console.error('Error deleting features:', error);
			}
		} else {
			console.warn('Draw object not initialized yet');
		}
	}
</script>

<!-- Toolbar for quick access to editing tools - KEEPING ORIGINAL STYLING -->
<div class="mt-4 flex items-center gap-3 rounded bg-gray-800 p-2">
	<button
		class="rounded bg-purple-600 p-2 text-white"
		title="Test Mask in Manhattan"
		onclick={createTestMask}
	>
		Test NYC Mask
	</button>
	<!-- Selection/Modify Tool -->
	<button
		class={`rounded p-2 ${activeEditTool === 'simple_select' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Select & Modify Features"
		onclick={() => setDrawMode('simple_select')}
	>
		<Move size={20} strokeWidth={2} />
		<span class="sr-only">Modify</span>
	</button>

	<!-- Draw Point Tool -->
	<button
		class={`rounded p-2 ${activeEditTool === 'draw_point' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Point"
		onclick={() => setDrawMode('draw_point')}
	>
		<CircleDot size={20} />
		<span class="sr-only">Draw Point</span>
	</button>

	<!-- Draw Line Tool -->
	<button
		class={`rounded p-2 ${activeEditTool === 'draw_line_string' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Line"
		onclick={() => setDrawMode('draw_line_string')}
	>
		<SplineIcon size={20} />
		<span class="sr-only">Draw Line</span>
	</button>

	<!-- Draw Polygon Tool -->
	<button
		class={`rounded p-2 ${activeEditTool === 'draw_polygon' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Polygon"
		onclick={() => setDrawMode('draw_polygon')}
	>
		<Hexagon size={20} />
		<span class="sr-only">Draw Polygon</span>
	</button>

	<!-- Delete Tool -->
	<div class="mx-1 h-6 w-px bg-gray-600"></div>
	<button
		class="rounded p-2 hover:bg-gray-700"
		title="Delete Selected Features"
		onclick={trashSelected}
	>
		<Trash2 size={20} />
		<span class="sr-only">Delete</span>
	</button>
</div>
