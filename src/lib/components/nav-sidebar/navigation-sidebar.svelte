<script lang="ts">
	import { LayerFactory } from '$lib/io/layer-management.svelte';
	import SidebarLayerEditor from './components/layer-editor.svelte';
	//import SidebarFilterEditor from './components/filter-editor.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AddDataset from './components/add-dataset.svelte';
	import { layers } from '$lib/io/stores';
	import { Plus } from '@lucide/svelte';

	function addLayer() {
		layers.add(LayerFactory.blank());
	}
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<AddDataset />
		<Sidebar.Separator></Sidebar.Separator>

		<Sidebar.Group class="-px-4">
			<Button onclick={addLayer}>
				<span>Add Layer</span>
				<Plus />
			</Button>
		</Sidebar.Group>
		<Sidebar.Group class="-px-4">
			<Sidebar.Menu>
				{#each $layers as layer}
					<SidebarLayerEditor {layer} />
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>
