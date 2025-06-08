<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible';

	import { layers } from '$lib/io/stores';
	import {
		X,
		MapPin,
		Layers,
		AlertCircle,
		CheckCircle,
		Clock,
		Eye,
		EyeOff,
		ChevronDown
	} from '@lucide/svelte';

	import ScatterLayerConfiguration from './layer-configurations/scatter-layer-configuration.svelte';
	import GeojsonLayerConfiguration from './layer-configurations/geojson-layer-configuration.svelte';
	import type { Dataset } from '$lib/types';

	let { dataset }: { dataset: Dataset } = $props<{ dataset: Dataset }>();
	let configurationOpen = $state(false);

	// Determine layer type from dataset metadata
	const layerType = $derived.by(() => {
		if (dataset.metadata?.geometry) {
			return 'geometry';
		} else if (dataset.metadata?.location) {
			return 'location';
		} else {
			return 'data';
		}
	});

	// Create display title
	const displayTitle = $derived.by(() => {
		const typeLabels = {
			geometry: 'Geometry Layer',
			location: 'Scatter Layer',
			data: 'Data Layer'
		};
		return `${dataset.datasetLabel} • ${typeLabels[layerType]}`;
	});

	// Get status color and icon (updated for dark theme)
	const statusInfo = $derived.by(() => {
		switch (dataset.status?.state) {
			case 'ready':
				return {
					color: 'text-green-400',
					icon: CheckCircle,
					bg: 'bg-green-900/30 border-green-700',
					ring: 'ring-green-500/20'
				};
			case 'processing':
				return {
					color: 'text-blue-400',
					icon: Clock,
					bg: 'bg-blue-900/30 border-blue-700',
					ring: 'ring-blue-500/20'
				};
			case 'error':
				return {
					color: 'text-red-400',
					icon: AlertCircle,
					bg: 'bg-red-900/30 border-red-700',
					ring: 'ring-red-500/20'
				};
			default:
				return {
					color: 'text-gray-400',
					icon: Layers,
					bg: 'bg-gray-800 border-gray-600',
					ring: 'ring-gray-500/20'
				};
		}
	});

	// Get dataset icon
	const DatasetIcon = $derived(dataset.icon || Layers);

	// Format row count for display
	const formattedRowCount = $derived.by(() => {
		if (!dataset.rowCount) return '';
		if (dataset.rowCount < 1000) return `${dataset.rowCount} rows`;
		if (dataset.rowCount < 1000000) return `${Math.round(dataset.rowCount / 1000)}K rows`;
		return `${Math.round(dataset.rowCount / 1000000)}M rows`;
	});

	// Get geographic info for location datasets
	const locationInfo = $derived.by(() => {
		if (!dataset.metadata?.location) return null;

		const chosen = dataset.metadata.location.chosenColumns;
		const hasCoords = chosen.latitude && chosen.longitude;
		const suggestions = dataset.metadata.location.recommendations.suggestedCoordinatePairs;

		return {
			hasCoords,
			coordCount: suggestions.length,
			confidence: suggestions[0]?.confidence || 0
		};
	});

	// Get geometry info for geometry datasets
	const geometryInfo = $derived.by(() => {
		if (!dataset.metadata?.geometry) return null;

		return {
			type: dataset.metadata.geometry.shape.type,
			featureCount: dataset.metadata.geometry.shape.featureCount,
			isUsedAsFilter: dataset.metadata.geometry.usage?.usedAsFilter
		};
	});

	// Check if layer is currently visible
	const isLayerVisible = $derived.by(() => {
		const layer = layers.snapshot.find((l) => l.id === dataset.datasetID);
		return layer?.props?.visible ?? true;
	});

	const remove = () => layers.remove(dataset.datasetID);

	const toggleVisibility = () => {
		const layer = layers.snapshot.find((l) => l.id === dataset.datasetID);
		if (layer) {
			layers.updateProps(dataset.datasetID, {
				visible: !isLayerVisible
			});
		}
	};

	const openConfiguration = () => {
		configurationOpen = !configurationOpen;
	};
</script>

<!-- Dataset Card -->
<Collapsible.Root bind:open={configurationOpen}>
	<div
		class="border-b-none group relative rounded-lg rounded-b-none border border-gray-600 bg-gray-800 transition-all duration-200 hover:shadow-lg hover:shadow-gray-900/20 hover:{statusInfo.ring} hover:ring-2"
	>
		<!-- Main Card Content -->
		<Collapsible.Trigger class="w-full">
			{#snippet child({ props })}
				<div
					{...props}
					class="hover:bg-gray-750 flex w-full cursor-pointer items-center gap-3 p-4"
					role="button"
					tabindex="0"
				>
					<!-- Dataset Icon with Color -->
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm"
						style="background-color: {dataset.color || '#6b7280'}"
					>
						<DatasetIcon size={20} />
					</div>

					<!-- Main Content -->
					<div class="min-w-0 flex-1">
						<!-- Title and Status -->
						<div class="mb-1 flex items-center gap-2">
							<h3 class="truncate text-sm font-medium text-white">{displayTitle}</h3>
							<div class="flex items-center gap-1 {statusInfo.color}">
								<statusInfo.icon size={14} />
							</div>
						</div>

						<!-- Metadata Row -->
						<div class="flex items-center gap-2 text-xs text-gray-300">
							<!-- Row Count -->
							{#if formattedRowCount}
								<span class="font-mono">{formattedRowCount}</span>
								<span class="text-gray-500">•</span>
							{/if}

							<!-- File Type -->
							<span class="font-medium capitalize"
								>{dataset.source.fileType || dataset.datasetType}</span
							>

							<!-- Location Info -->
							{#if locationInfo?.hasCoords}
								<span class="text-gray-500">•</span>
								<div class="flex items-center gap-1 text-green-400">
									<MapPin size={10} />
									<span class="font-medium">Coordinates Ready</span>
								</div>
							{:else if locationInfo}
								<span class="text-gray-500">•</span>
								<span class="font-medium text-amber-400"
									>{locationInfo.coordCount} coord suggestions</span
								>
							{/if}

							<!-- Geometry Info -->
							{#if geometryInfo}
								<span class="text-gray-500">•</span>
								<span class="font-medium text-blue-400">{geometryInfo.type}</span>
								{#if geometryInfo.featureCount > 1}
									<span class="text-gray-400">({geometryInfo.featureCount} features)</span>
								{/if}
							{/if}
						</div>
					</div>

					<!-- Expand Indicator -->
					<div class="flex items-center gap-2">
						<ChevronDown
							size={16}
							class="rotate-90 text-gray-400 transition-transform group-data-[state=open]:rotate-0"
						/>
					</div>
				</div>
			{/snippet}
		</Collapsible.Trigger>

		<!-- Action Buttons (top right) -->
		<div
			class="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
		>
			<!-- Visibility Toggle -->
			<button
				class="rounded-md border border-gray-600 bg-gray-800/90 p-1.5 text-gray-300 backdrop-blur-sm transition-colors hover:bg-gray-700 hover:text-white"
				onclick={(e) => {
					e.stopPropagation();
					toggleVisibility();
				}}
				title={isLayerVisible ? 'Hide layer' : 'Show layer'}
			>
				{#if isLayerVisible}
					<Eye size={14} />
				{:else}
					<EyeOff size={14} />
				{/if}
			</button>

			<!-- Remove Button -->
			<button
				class="rounded-md border border-gray-600 bg-gray-800/90 p-1.5 text-gray-300 backdrop-blur-sm transition-colors hover:bg-gray-700 hover:text-red-400"
				onclick={(e) => {
					e.stopPropagation();
					remove();
				}}
				title="Remove dataset and layer"
			>
				<X size={14} />
			</button>
		</div>
	</div>

	<!-- Configuration Panel (Collapsible Content) -->
	<Collapsible.Content>
		<div
			class="space-y-4 rounded-b-lg border-b border-l border-r border-gray-600 bg-gray-700/50 p-4"
		>
			<!-- Configuration Header -->

			<!-- Configuration Content -->
			{#if dataset.status?.state === 'ready'}
				{#if layerType === 'location'}
					<ScatterLayerConfiguration {dataset} />
				{:else if layerType === 'geometry'}
					<GeojsonLayerConfiguration {dataset} />
				{:else}
					<!-- Generic data layer configuration -->
					<div class="py-8 text-center text-gray-300">
						<Layers size={24} class="mx-auto mb-2 opacity-50" />
						<p class="text-sm">Layer configuration not available for this data type.</p>
					</div>
				{/if}
			{:else}
				<div class="py-8 text-center text-gray-300">
					<Clock size={24} class="mx-auto mb-2 opacity-50" />
					<p class="text-sm">Configuration available when dataset is ready.</p>
				</div>
			{/if}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
