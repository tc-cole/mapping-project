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
		console.log(e);
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

	// Function that runs whenever a drawing is completed
	function onDrawingComplete(feature: any) {
		// Create a mask layer with the drawn feature
		const maskLayerId = `mask-${Date.now()}`;
		const geojsonMaskLayer = LayerFactory.create('geojson', {
			id: maskLayerId,
			props: {
				operation: 'mask',
				data: feature,
				// Optional additional styling if needed
				stroked: true,
				filled: true,
				lineWidthMinPixels: 2,
				getLineColor: [255, 255, 255],
				getFillColor: [0, 0, 0, 0] // Transparent fill
			}
		});

		// Add the mask layer to the deck
		layers.add(geojsonMaskLayer);

		// Now apply the mask extension to all existing layers that should be masked
		const layersSnapshot = layers.snapshot;

		// Use a transaction to batch all updates
		layers.transaction(() => {
			// Loop through layers
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

		// You can perform any additional actions here, such as:
		// - Saving to a database
		// - Showing details in the UI
		// - etc.
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
