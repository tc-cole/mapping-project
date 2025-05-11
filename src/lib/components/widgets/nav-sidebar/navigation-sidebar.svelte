<script lang="ts">
	import { LayerFactory } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
	import SidebarLayerEditor from './components/editable-layer.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AddDataset from './components/add-dataset.svelte';
	import { layers } from './io/layer-io.svelte';
	import { Plus } from '@lucide/svelte';

	function addLayer() {
		layers.add(LayerFactory.blank());
	}
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<AddDataset />
		<Sidebar.Group class="-px-4">
			<Button onclick={addLayer}>
				<span>Add Layer </span>
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
		<!--
		<Collapsible.Root open={true} class="group/collapsible">
			<Sidebar.Group>
				<Sidebar.GroupLabel
					class="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
				>
					{#snippet child({ props })}
						<Collapsible.Trigger {...props}>
							Layers
							<ChevronRight
								class="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90"
							/>
						</Collapsible.Trigger>
					{/snippet}
				</Sidebar.GroupLabel>
				<Collapsible.Content>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							{#each layers as layer (layer.title)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton isActive={layer.isActive}>
										{#snippet child({ props })}
											<a {...props}>{layer.title}</a>
										{/snippet}
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Collapsible.Content>
			</Sidebar.Group>
		</Collapsible.Root>
	-->
	</Sidebar.Content>
</Sidebar.Root>
