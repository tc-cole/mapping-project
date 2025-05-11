<script lang="ts">
	import {
		layers,
		layerDefs,
		type DeckLayerEntry
	} from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';

	//import SidebarMenuItem from '$lib/components/ui/sidebar/sidebar-menu-item.svelte';
	import SidebarMenuSubButton from '$lib/components/ui/sidebar/sidebar-menu-sub-button.svelte';
	import SidebarMenuSubItem from '$lib/components/ui/sidebar/sidebar-menu-sub-item.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import LayerConfiguration from './layer-configuration.svelte';
	import { ChevronRight } from '@lucide/svelte';
	import { buttonVariants } from '$lib/components/ui/button';

	let { layer }: { layer: DeckLayerEntry } = $props();
	let selectedLabel = $state('Choose Type');

	$effect(() => {
		layer.ctor
			? (Object.values(layerDefs).find((d) => d.ctor === layer.ctor)?.label ?? 'Choose type')
			: 'Choose type';
	});

	function chooseType(key: keyof typeof layerDefs) {
		layers.switchType(layer.id, key);
		selectedLabel = layerDefs[key].label;
	}
</script>

<SidebarMenuSubItem>
	<Collapsible.Root class="group/collapsible" open={true}>
		<Collapsible.Trigger>
			{#snippet child({ props })}
				<SidebarMenuSubButton {...props} class={buttonVariants({ variant: 'secondary' })}>
					Configure Layer
					<ChevronRight
						class="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90"
					/>
				</SidebarMenuSubButton>
			{/snippet}
		</Collapsible.Trigger>
		<Collapsible.Content class="my-3">
			<DropdownMenu.Root>
				<SidebarMenuSubButton>
					{#snippet child({ props })}
						<DropdownMenu.Trigger {...props} class={buttonVariants({ variant: 'secondary' })}>
							{selectedLabel}
						</DropdownMenu.Trigger>
					{/snippet}
				</SidebarMenuSubButton>
				<DropdownMenu.Content class="w-40">
					<DropdownMenu.Group>
						{#each Object.entries(layerDefs) as [key, def]}
							<DropdownMenu.Item onclick={(e) => chooseType(key)}>
								{def.label}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<div class="my-3">
				<LayerConfiguration layertype={selectedLabel} {layer} />
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</SidebarMenuSubItem>
