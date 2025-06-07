<script lang="ts">
	//import { LayerFactory } from '$lib/io/layer-management.svelte';
	import SidebarLayerEditor from './components/layer-editor.svelte';
	//import Button from '$lib/components/ui/button/button.svelte';
	//import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { layers } from '$lib/io/stores';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Layers } from '@lucide/svelte';
</script>

<Collapsible.Root>
	<Collapsible.Trigger>
		<div class="flex items-center gap-2">
			<Layers size={20} />
			<span class="text-sm">Layers</span>
		</div>
	</Collapsible.Trigger>
	<Collapsible.Content>
		{#each $layers as layer}
			<SidebarLayerEditor {layer} />
		{/each}
	</Collapsible.Content>
</Collapsible.Root>
