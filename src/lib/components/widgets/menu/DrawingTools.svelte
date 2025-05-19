<script lang="ts">
	import { Move, Trash2, CircleDot, SplineIcon, Hexagon } from '@lucide/svelte';

	let { map, draw, onFeaturesUpdate } = $props();

	// State variables
	let drawnFeatures = $state<any[]>([]);
	let activeDrawMode = $state('simple_select');

	$effect(() => {
		if (map && draw) {
			map.on('draw.create', handleDrawCreate);
			map.on('draw.update', handleDrawUpdate);
			map.on('draw.delete', handleDrawDelete);
			map.on('draw.modechange', handleModeChange);

			return () => {
				map.off('draw.create', handleDrawCreate);
				map.off('draw.update', handleDrawUpdate);
				map.off('draw.delete', handleDrawDelete);
				map.off('draw.modechange', handleModeChange);
			};
		}
	});

	// Handle creating new features
	function handleDrawCreate(e: any) {
		drawnFeatures = [...drawnFeatures, ...e.features];
		onFeaturesUpdate(drawnFeatures);
	}

	// Handle updating existing features
	function handleDrawUpdate(e: any) {
		// Update our features array
		const updatedIds = e.features.map((f: any) => f.id);
		drawnFeatures = [...drawnFeatures.filter((f) => !updatedIds.includes(f.id)), ...e.features];
		onFeaturesUpdate(drawnFeatures);
	}

	// Handle deleting features
	function handleDrawDelete(e: any) {
		// Remove deleted features from our array
		const deletedIds = e.features.map((f: any) => f.id);
		drawnFeatures = drawnFeatures.filter((f) => !deletedIds.includes(f.id));
		onFeaturesUpdate(drawnFeatures);
	}

	// Handle mode changes
	function handleModeChange(e: any) {
		activeDrawMode = e.mode;
	}

	// Helper function to directly activate a drawing mode
	function setDrawMode(mode: any) {
		if (draw) {
			draw.changeMode(mode);
			activeDrawMode = mode;
		}
	}
</script>

<!-- Toolbar for quick access to editing tools -->
<div class="mt-4 flex items-center gap-3 rounded bg-gray-800 p-2">
	<!-- Selection/Modify Tool -->
	<button
		class={`rounded p-2 ${activeDrawMode === 'simple_select' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Select & Modify Features"
		onclick={() => setDrawMode('simple_select')}
	>
		<Move size={20} strokeWidth={2} />
		<span class="sr-only">Modify</span>
	</button>

	<!-- Draw Point Tool -->
	<button
		class={`rounded p-2 ${activeDrawMode === 'draw_point' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Point"
		onclick={() => setDrawMode('draw_point')}
	>
		<CircleDot size={20} />
		<span class="sr-only">Draw Point</span>
	</button>

	<!-- Draw Line Tool -->
	<button
		class={`rounded p-2 ${activeDrawMode === 'draw_line_string' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
		title="Draw Line"
		onclick={() => setDrawMode('draw_line_string')}
	>
		<SplineIcon size={20} />
		<span class="sr-only">Draw Line</span>
	</button>

	<!-- Draw Polygon Tool -->
	<button
		class={`rounded p-2 ${activeDrawMode === 'draw_polygon' ? 'bg-blue-800' : 'hover:bg-gray-700'}`}
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
		onclick={() => draw.trash()}
	>
		<Trash2 size={20} />
		<span class="sr-only">Delete</span>
	</button>
</div>
