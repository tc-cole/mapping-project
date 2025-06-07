<script lang="ts">
	import LayerEditor from './components/layer-editor.svelte';
	import { layers } from '$lib/io/stores';
	import { layerDefs } from '$lib/io/layer-management.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Layers, ChevronDown, Eye, EyeOff } from '@lucide/svelte';

	// Get layer type colors - you can customize these
	const layerTypeColors: Record<string, string> = {
		scatter: 'bg-blue-500',
		geojson: 'bg-green-500',
		arc: 'bg-purple-500',
		line: 'bg-red-500',
		path: 'bg-yellow-500',
		polygon: 'bg-indigo-500',
		text: 'bg-pink-500',
		h3: 'bg-orange-500'
	};

	function getLayerInfo(layer: any) {
		const def = Object.entries(layerDefs).find(([key, def]) => def.ctor === layer.ctor);
		return {
			type: def ? def[0] : 'unknown',
			label: def ? def[1].label : 'Unknown Layer',
			color: def ? layerTypeColors[def[0]] || 'bg-gray-500' : 'bg-gray-500'
		};
	}

	function toggleLayerVisibility(layerId: string) {
		const layer = $layers.find((l) => l.id === layerId);
		if (layer) {
			layers.updateProps(layerId, {
				visible: !(layer.props.visible ?? true)
			});
		}
	}
</script>

<div class="overflow-hidden rounded-lg bg-gray-800">
	<Collapsible.Root open={true}>
		<Collapsible.Trigger class="w-full">
			{#snippet child({ props })}
				<div
					{...props}
					class="flex w-60 cursor-pointer items-center justify-between px-4 py-3 text-white transition-colors hover:bg-gray-700"
				>
					<div class="flex items-center gap-3">
						<Layers size={20} class="text-gray-300" />
						<span class="text-lg font-medium"> Layers</span>
					</div>
					<ChevronDown
						size={16}
						class="text-gray-400 transition-transform group-data-[state=open]/collapsible:rotate-180"
					/>
				</div>
			{/snippet}
		</Collapsible.Trigger>

		<Collapsible.Content class="bg-gray-800">
			<div class="border-t border-gray-700">
				{#if $layers.length === 0}
					<div class="px-4 py-6 text-center text-sm text-gray-400">No layers added yet</div>
				{:else}
					<div class="divide-y divide-gray-700">
						{#each $layers as layer (layer.id)}
							{@const layerInfo = getLayerInfo(layer)}
							{@const isVisible = layer.props.visible ?? true}

							<div class="hover:bg-gray-750 group px-4 py-3 transition-colors">
								<div class="flex items-start justify-between">
									<div class="flex min-w-0 flex-1 items-start gap-3">
										<!-- Layer type indicator -->
										<div class="mt-1 flex-shrink-0">
											<div class="h-3 w-3 rounded-full {layerInfo.color}"></div>
										</div>

										<!-- Layer info -->
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<h4 class="truncate text-sm font-medium text-white">
													{layerInfo.label}
												</h4>
											</div>

											<div class="mt-1 space-y-1">
												<p class="text-xs text-gray-500">
													All {layerInfo.type}
												</p>
											</div>
										</div>
									</div>

									<!-- Actions -->
									<div
										class="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
									>
										<button
											onclick={() => toggleLayerVisibility(layer.id)}
											class="rounded p-1 transition-colors hover:bg-gray-600"
											title={isVisible ? 'Hide layer' : 'Show layer'}
										>
											{#if isVisible}
												<Eye size={14} class="text-gray-300" />
											{:else}
												<EyeOff size={14} class="text-gray-500" />
											{/if}
										</button>
									</div>
								</div>

								<!-- Expandable layer editor -->
								<div class="mt-3">
									<LayerEditor {layer} />
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</div>

<style>
	/* Custom hover color for better contrast */
	.hover\:bg-gray-750:hover {
		background-color: rgb(55 65 81); /* Custom gray-750 */
	}
</style>
