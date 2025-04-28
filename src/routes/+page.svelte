<script lang="ts">
	import AppSidebar from '$lib/components/widgets/navigation-sidebar.svelte';
	import DeckGL from '$lib/components/maps/DeckGL.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChartsSidebar from '$lib/components/widgets/charts-sidebar.svelte';
	import MenuBar from '$lib/components/widgets/MenuBar.svelte';
	
</script>

<Sidebar.Provider>
	<AppSidebar />
	<div class="flex justify-center relative z-10">
		<MenuBar />
	</div>
	<ChartsSidebar />
</Sidebar.Provider>

<DeckGL />
