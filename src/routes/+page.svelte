<script lang="ts">
	import AppSidebar from '$lib/components/widgets/nav-sidebar/navigation-sidebar.svelte';
	import DeckGL from '$lib/components/DeckGL/DeckGL.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChartsDrawer from '$lib/components/widgets/charts/charts-drawer.svelte';
	import DrawingTools from '$lib/components/widgets/menu/DrawingTools.svelte';
</script>

<Sidebar.Provider>
	<AppSidebar />
</Sidebar.Provider>
<ChartsDrawer />

<DeckGL />
<div class="absolute left-1/2 top-4 z-10 -translate-x-1/2 transform">
	<DrawingTools />
</div>
