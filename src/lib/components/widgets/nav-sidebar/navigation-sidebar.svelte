<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { ChevronRight, Plus } from '@lucide/svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import AddLayer from './add-layer.svelte';
	import DataInput from './data-input.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	// Menu items.

	const storedLayers = $state([]);

	const layers = [
		{
			title: 'Path',
			isActive: false,
			icon: Search,
			action: null
		},
		{
			title: 'Line',
			isActive: false,
			icon: Search,
			action: null
		}
	];
</script>

<Sidebar.Root>
	<Sidebar.Content >
			<AddLayer />
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
	</Sidebar.Content>
</Sidebar.Root>
