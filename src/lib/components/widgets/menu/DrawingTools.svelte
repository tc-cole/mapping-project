<script lang="ts">
	import { Move, Trash2, CircleDot, SplineIcon, Hexagon } from '@lucide/svelte';
	import { clickedGeoJSON, openDrawer } from '$lib/components/io/stores';

	// Define props with correct typing
	let { map, draw, onFeaturesUpdate } = $props<{
		map: mapboxgl.Map | undefined;
		draw: MapboxDraw | undefined;
		onFeaturesUpdate: Function;
	}>();

	let drawnFeatures = $state<any[]>([]);
	let activeEditTool = $state('simple_select');
	let isDrawing = $state(false);
	let lastCompletedFeature = $state<any>(null);

	$effect(() => {
		if (map && draw) {
			// Set up event handlers for draw actions
			map.on('draw.create', handleDrawCreate);
			map.on('draw.update', handleDrawUpdate);
			map.on('draw.delete', handleDrawDelete);
			map.on('draw.modechange', handleModeChange);
			map.on('draw.selectionchange', handleSelectionChange);

			// These events track the drawing state
			map.on('draw.render', handleDrawRender);
			map.on('mouseup', handleMouseUp);
			map.on('touchend', handleTouchEnd);

			return () => {
				map.off('draw.create', handleDrawCreate);
				map.off('draw.update', handleDrawUpdate);
				map.off('draw.delete', handleDrawDelete);
				map.off('draw.modechange', handleModeChange);
				map.off('draw.selectionchange', handleSelectionChange);
				map.off('draw.render', handleDrawRender);
				map.off('mouseup', handleMouseUp);
				map.off('touchend', handleTouchEnd);
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

	function handleMouseUp(e: any) {
		if (isDrawing) {
			const currentFeatures = draw?.getAll().features || [];
			const inProgressFeature = currentFeatures.find(
				(f: any) => f.id === draw?.getSelectedIds()[0]
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
		console.log('Drawing completed!', feature);
		// You can perform any actions here, such as:
		// - Saving to a database
		// - Adding to a DeckGL layer
		// - Showing details in the UI
		// - etc.
	}

	function setDrawMode(mode: string) {
		if (draw) {
			try {
				draw.changeMode(mode);
				activeEditTool = mode;
			} catch (error) {
				console.error('Error changing draw mode:', error);
			}
		} else {
			console.warn('Draw object not initialized yet');
		}
	}

	function trashSelected() {
		if (draw) {
			try {
				draw.trash();
			} catch (error) {
				console.error('Error deleting features:', error);
			}
		} else {
			console.warn('Draw object not initialized yet');
		}
	}
</script>

\

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
