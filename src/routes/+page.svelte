<script lang="ts">
	//import AppSidebar from '$lib/components/layers-selection/layers-selection.svelte';
	import DeckGL from '$lib/components/deck-gl/DeckGL.svelte';
	//import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChartsDrawer from '$lib/components/charts-drawer/charts-drawer.svelte';
	import DrawingTools from '$lib/components/drawing-tools/drawing-tools.svelte';
	import { openDrawer, openSidebar } from '$lib/io/stores';
	import DataInput from '$lib/components/data-input/data-input.svelte';
	import LayersSelection from '$lib/components/layers-selection/layers-selection.svelte';
	//import { Button } from '$lib/components/ui/button/index.js';
</script>

<div class="app-container">
	<!--<ChartsDrawer /> -->

	<DeckGL />

	<!-- Drawing Tools with CSS-only centering -->
	<div
		class="drawing-tools-container"
		class:sidebar-open={$openSidebar}
		class:drawer-open={$openDrawer}
	>
		<DrawingTools />
	</div>
	<div class="data-input-container">
		<DataInput />
	</div>

	<div class="layer-selection-container">
		<LayersSelection />
	</div>
</div>

<style>
	.app-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.drawing-tools-container {
		position: absolute;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		transition: left 0.2s ease-out;
	}

	.layer-selection-container {
		position: absolute;
		top: 5rem;
		right: 1rem;
		z-index: 10;
	}

	.data-input-container {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 10;
	}

	/* When sidebar is open, adjust the position */
	.drawing-tools-container.sidebar-open {
		left: calc(30% + 128px); /* 50% + half of sidebar width (256px/2) */
	}

	/* When drawer is open, adjust the position */
	.drawing-tools-container.drawer-open {
		left: calc(50% - 20%); /* 50% - half of drawer width (40%/2) */
	}

	/* When both are open, adjust the position */
	.drawing-tools-container.sidebar-open.drawer-open {
		left: calc(50% + 128px - 20%); /* Combined adjustment */
	}
</style>
