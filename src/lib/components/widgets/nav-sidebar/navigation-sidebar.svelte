<script lang="ts">
	import { LayerFactory } from '$lib/components/io/layer-io.svelte';
	import SidebarLayerEditor from './components/editable-layer.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AddDataset from './components/add-dataset.svelte';
	import { layers } from '../../io/layer-io.svelte';
	import { Plus } from '@lucide/svelte';

	function addLayer() {
		layers.add(LayerFactory.blank());
	}

	function addArcLayer() {
		const arcLayer = LayerFactory.create('arc', {
			props: {
				data: [
					{ source: [-122.45, 37.78], target: [-122.39, 37.76] },
					{ source: [-122.41, 37.77], target: [-122.45, 37.78] }
				],
				getSourcePosition: (d) => d.source,
				getTargetPosition: (d) => d.target,
				getSourceColor: [255, 0, 0],
				getTargetColor: [0, 255, 0],
				getWidth: 5
			}
		});

		layers.add(arcLayer);
		console.log('Added arc layer:', arcLayer);
	}

	function addSampleLayer() {
		// Create a sample ScatterplotLayer with US city data
		const scatterLayer = LayerFactory.create('scatter', {
			props: {
				data: [
					{ position: [-74.006, 40.7128], name: 'New York', population: 8419000 },
					{ position: [-118.2437, 34.0522], name: 'Los Angeles', population: 3980000 },
					{ position: [-87.6298, 41.8781], name: 'Chicago', population: 2716000 },
					{ position: [-95.3698, 29.7604], name: 'Houston', population: 2320000 },
					{ position: [-112.074, 33.4484], name: 'Phoenix', population: 1680000 },
					{ position: [-75.1652, 39.9526], name: 'Philadelphia', population: 1584000 },
					{ position: [-98.4936, 29.4241], name: 'San Antonio', population: 1530000 },
					{ position: [-117.1611, 32.7157], name: 'San Diego', population: 1420000 },
					{ position: [-96.797, 32.7767], name: 'Dallas', population: 1340000 }
				],
				getPosition: (d) => d.position,
				getRadius: (d) => Math.sqrt(d.population) / 50, // Scale radius based on population
				getFillColor: [255, 140, 0, 180], // Orange with some transparency
				radiusMinPixels: 5,
				radiusMaxPixels: 30,
				pickable: true,
				autoHighlight: true,
				highlightColor: [255, 255, 0, 200],
				// Optional tooltip when hovering
				onHover: (info) => {
					if (info && info.object) {
						console.log(`Hover: ${info.object.name} - Pop: ${info.object.population}`);
					}
				}
			}
		});

		// Add it to the store
		layers.add(scatterLayer);
		console.log('Added scatter layer:', scatterLayer);
	}
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<AddDataset />
		<Button onclick={addSampleLayer}>Add Test Layer</Button>

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
