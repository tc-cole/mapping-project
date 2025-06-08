<script lang="ts">
	import { datasets } from '$lib/io/stores';
	import DatasetCard from './components/dataset-card.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Layers, ChevronLeft, ChevronDown } from '@lucide/svelte';
</script>

<div class="bg-grey-800 overflow-hidden rounded-lg border border-border bg-card">
	<Collapsible.Root class="group">
		<Collapsible.Trigger class="w-full">
			{#snippet child({ props })}
				<div
					{...props}
					class="flex w-full cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
				>
					<div class="flex items-center gap-3">
						<Layers size={20} class="text-muted-foreground" />
						<span class="text-lg font-medium">Datasets & Layers</span>
						{#if $datasets.length > 0}
							<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
								{$datasets.length}
							</span>
						{/if}
					</div>
					<ChevronDown
						size={16}
						class="rotate-90 text-muted-foreground transition-transform group-data-[state=open]:rotate-0"
					/>
				</div>
			{/snippet}
		</Collapsible.Trigger>

		<Collapsible.Content>
			<div class="border-t border-border">
				{#if $datasets.length === 0}
					<div class="px-4 py-12 text-center">
						<h3 class="mb-2 font-medium text-foreground">No datasets yet</h3>
						<p class="mb-4 text-sm text-muted-foreground">
							Upload a file to create your first dataset and layer.
						</p>
					</div>
				{:else}
					<div class="space-y-3 p-4">
						{#each $datasets as dataset (dataset.datasetID)}
							<DatasetCard {dataset} />
						{/each}
					</div>
				{/if}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</div>
