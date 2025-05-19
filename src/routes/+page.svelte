<script lang="ts">
	import AppSidebar from '$lib/components/widgets/nav-sidebar/navigation-sidebar.svelte';
	import DeckGL from '$lib/components/DeckGL/DeckGL.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChartsDrawer from '$lib/components/widgets/charts/charts-drawer.svelte';
	//import DrawingTools from '$lib/components/widgets/menu/DrawingTools.svelte';
</script>

<Sidebar.Provider>
	<AppSidebar />

	<ChartsDrawer />
</Sidebar.Provider>

<DeckGL />
