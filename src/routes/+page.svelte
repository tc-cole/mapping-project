<script lang="ts">
	import AppSidebar from '$lib/components/widgets/nav-sidebar/navigation-sidebar.svelte';
	import DeckGL from '$lib/components/DeckGL/DeckGL.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChartsSidebar from '$lib/components/widgets/charts/charts-sidebar.svelte';
	import DrawingTools from '$lib/components/widgets/menu/DrawingTools.svelte';
</script>

<Sidebar.Provider>
	<AppSidebar />

	<!--
		<ChartsSidebar />
	-->
	<!-- Centered MenuBar -->
</Sidebar.Provider>

<DeckGL />
