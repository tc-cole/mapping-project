<script lang="ts">
	import { LayerFactory } from '$lib/io/layer-management.svelte';
	import SidebarLayerEditor from './components/layer-editor.svelte';
	//import Button from '$lib/components/ui/button/button.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { layers } from '$lib/io/stores';

	function addLayer() {
		layers.add(LayerFactory.blank());
	}
</script>

<Sidebar.Root side="right" variant="floating" class="h-1/2">
	<Sidebar.Content class="h-1/2">
		<!--

		<Sidebar.Group class="-px-4">
			<Button onclick={addLayer}>
				<span>Add Layer</span>
				<Plus />
			</Button>
		</Sidebar.Group>
				-->

		<Sidebar.Group class="-px-4">
			<Sidebar.Menu>
				{#each $layers as layer}
					<SidebarLayerEditor {layer} />
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>
