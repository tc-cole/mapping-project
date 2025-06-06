<script lang="ts">
	import AppSidebar from '$lib/components/nav-sidebar/navigation-sidebar.svelte';
	import DeckGL from '$lib/components/DeckGL/DeckGL.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChartsDrawer from '$lib/components/charts-drawer/charts-drawer.svelte';
	import DrawingTools from '$lib/components/menu/DrawingTools.svelte';
	import { openDrawer, openSidebar } from '$lib/io/stores';
</script>

<div class="app-container">
	<Sidebar.Provider>
		<AppSidebar />
		<div class="z-10">
			<Sidebar.Trigger
				onclick={() => {
					$openSidebar = !$openSidebar;
				}}
			/>
		</div>
	</Sidebar.Provider>

	<ChartsDrawer />

	<DeckGL />

	<!-- Drawing Tools with CSS-only centering -->
	<div
		class="drawing-tools-container"
		class:sidebar-open={$openSidebar}
		class:drawer-open={$openDrawer}
	>
		<DrawingTools />
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
