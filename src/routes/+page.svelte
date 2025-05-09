<script lang="ts">
	import AppSidebar from '$lib/components/widgets/nav-sidebar/navigation-sidebar.svelte';
	import DeckGL from '$lib/components/maps/DeckGL.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChartsSidebar from '$lib/components/widgets/charts/charts-sidebar.svelte';
	import MenuBar from '$lib/components/widgets/menu/MenuBar.svelte';
</script>

<Sidebar.Provider>
	<AppSidebar />

	<ChartsSidebar />

	<!-- Centered MenuBar -->
	<div class="absolute left-1/2 top-4 z-10 -translate-x-1/2 transform">
		<MenuBar />
	</div>
</Sidebar.Provider>

<DeckGL />
