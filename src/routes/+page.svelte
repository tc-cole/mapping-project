<script lang="ts">
	import AppSidebar from '$lib/components/widgets/nav-sidebar/navigation-sidebar.svelte';
	import DeckGL from '$lib/components/maps/DeckGL.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChartsSidebar from '$lib/components/widgets/charts/charts-sidebar.svelte';
	import MenuBar from '$lib/components/widgets/menu/MenuBar.svelte';
	import DataInput from '$lib/components/widgets/nav-sidebar/data-input.svelte';
</script>

<Sidebar.Provider>
	<AppSidebar />

	<ChartsSidebar />


	<!-- Centered MenuBar -->
	<div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">

		<MenuBar />
	</div>
</Sidebar.Provider>

<DataInput />

<!-- Map full screen in the background -->
<DeckGL />