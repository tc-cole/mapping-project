<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Sidebar from '$lib/components/ui/sidebar/index';

	import ChooseLayerType from './choose-layer-type.svelte';
	import ChooseDataset from './choose-dataset.svelte';

	import { layers, layerDefs } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte'; // singleton instance
	import { X, ChevronDown } from '@lucide/svelte';
	import { MenuItem } from 'svelte-ux';
	import { buttonVariants } from '$lib/components/ui/button';

	let layertype = $state('');
	let { layer } = $props();

	$effect(() => {
		const match = Object.values(layerDefs).find((d) => d.ctor === layer.ctor);
		if (match) {
			layertype = match.label;
		}
	});

	const remove = () => layers.remove(layer.id);
</script>

<Collapsible.Root>
	<Collapsible.Trigger class="flex w-full items-center gap-2 px-4 py-3 hover:bg-muted/50">
		{#snippet child({ props })}
			<Sidebar.MenuButton {...props} class={buttonVariants({ variant: 'secondary' })}>
				<span class="flex-1 truncate">Layer</span>

				<!--<Switch checked={layer.props.visible ?? true} onchange={(e) => update({ visible: e.detail })} /> -->
				<button class="p-1 text-muted-foreground hover:text-destructive" onclick={remove}>
					<X size={16} />
				</button>
				<ChevronDown
					class="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180"
				/>
			</Sidebar.MenuButton>
		{/snippet}
	</Collapsible.Trigger>

	<!-- body -->
	<Collapsible.Content class="space-y-4 px-2 pb-4">
		<Sidebar.MenuItem class="py-2">
			<ChooseDataset />
		</Sidebar.MenuItem>
		<Sidebar.MenuItem>
			<ChooseLayerType {layer} />
		</Sidebar.MenuItem>
	</Collapsible.Content>
</Collapsible.Root>
