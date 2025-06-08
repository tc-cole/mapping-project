<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/io/FileUtils';
	import { LayerFactory } from '$lib/io/layer-management.svelte';
	import { layers } from '$lib/io/stores';
	import { SingletonDatabase } from '$lib/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import Sectional from './utils/sectional.svelte';
	import ConfigField from './utils/config-field.svelte';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js';
	import { AlertCircle } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { Dataset } from '$lib/types';

	// Source coordinates
	let fromLatitude = $state<string | undefined>();
	let fromLongitude = $state<string | undefined>();
	// Target coordinates
	let toLatitude = $state<string | undefined>();
	let toLongitude = $state<string | undefined>();

	// Optional visual encoding columns
	let widthColumn = $state<string | null>(null);
	let colorColumn = $state<string | null>(null);
	let labelColumn = $state<string | null>(null);

	// Visual parameters
	let arcWidth = $state<number>(2);
	let minArcWidth = $state<number>(1);
	let maxArcWidth = $state<number>(20);
	let opacity = $state<number>(0.8);
	let colorScale = $state<string>('viridis');
	let showLabels = $state<boolean>(false);
	let arcHeight = $state<number>(1);
	let arcHeightMultiplier = $state<number>(1);

	// Geospatial filtering
	let filterEnabled = $state<boolean>(false);
	let filterMode = $state<'distance' | 'bounds'>('distance');
	let maxDistance = $state<number>(1000);
	let boundsNorth = $state<number>(90);
	let boundsSouth = $state<number>(-90);
	let boundsEast = $state<number>(180);
	let boundsWest = $state<number>(-180);

	// Previous values for detecting changes
	let prevWidthColumn = $state<string | null>(null);
	let prevColorColumn = $state<string | null>(null);
	let prevLabelColumn = $state<string | null>(null);
	let prevArcWidth = $state<number>(2);
	let prevMinArcWidth = $state<number>(1);
	let prevMaxArcWidth = $state<number>(20);
	let prevOpacity = $state<number>(0.8);
	let prevColorScale = $state<string>('viridis');
	let prevShowLabels = $state<boolean>(false);
	let prevArcHeight = $state<number>(1);
	let prevArcHeightMultiplier = $state<number>(1);
	let prevFilterEnabled = $state<boolean>(false);
	let prevFilterMode = $state<'distance' | 'bounds'>('distance');
	let prevMaxDistance = $state<number>(1000);
	let prevBoundsNorth = $state<number>(90);
	let prevBoundsSouth = $state<number>(-90);
	let prevBoundsEast = $state<number>(180);
	let prevBoundsWest = $state<number>(-180);

	// Available color scales
	const colorScales = [
		'viridis',
		'plasma',
		'inferno',
		'magma',
		'blues',
		'greens',
		'reds',
		'greys',
		'oranges',
		'purples'
	];

	let { dataset } = $props<{ dataset: Dataset }>();

	// Used to store pre-calculated values for width and color ranges
	let widthRange = $state([0, 1]);
	let colorRange = $state([0, 1]);
	let hasInitialized = $state(false);

	let requiredColumnsSelected = $derived(
		fromLatitude !== undefined &&
			fromLongitude !== undefined &&
			toLatitude !== undefined &&
			toLongitude !== undefined
	);

	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			console.log('Initializing arc layer - all required columns selected');
			createArcLayer();
			hasInitialized = true;
		}
	});

	$effect(() => {
		if (!hasInitialized) {
			return;
		}

		const currentLayer = layers.snapshot.find((l) => l.id === dataset.layerID);

		if (
			currentLayer &&
			(currentLayer.props.fromLatColumn !== fromLatitude ||
				currentLayer.props.fromLngColumn !== fromLongitude ||
				currentLayer.props.toLatColumn !== toLatitude ||
				currentLayer.props.toLngColumn !== toLongitude)
		) {
			console.log('Coordinate columns changed, recreating arc layer');
			createArcLayer();
		}
	});

	// Update props when optional parameters change
	$effect(() => {
		if (!hasInitialized || !requiredColumnsSelected) {
			return;
		}

		const changedProps: Record<string, any> = {};

		if (widthColumn !== prevWidthColumn) {
			changedProps.widthColumn = widthColumn;
			prevWidthColumn = widthColumn;
		}

		if (colorColumn !== prevColorColumn) {
			changedProps.colorColumn = colorColumn;
			prevColorColumn = colorColumn;
		}

		if (labelColumn !== prevLabelColumn) {
			changedProps.labelColumn = labelColumn;
			prevLabelColumn = labelColumn;
		}

		if (arcWidth !== prevArcWidth) {
			changedProps.arcWidth = arcWidth;
			prevArcWidth = arcWidth;
		}

		if (minArcWidth !== prevMinArcWidth) {
			changedProps.minArcWidth = minArcWidth;
			prevMinArcWidth = minArcWidth;
		}

		if (maxArcWidth !== prevMaxArcWidth) {
			changedProps.maxArcWidth = maxArcWidth;
			prevMaxArcWidth = maxArcWidth;
		}

		if (opacity !== prevOpacity) {
			changedProps.opacity = opacity;
			prevOpacity = opacity;
		}

		if (colorScale !== prevColorScale) {
			changedProps.colorScale = colorScale;
			prevColorScale = colorScale;
		}

		if (showLabels !== prevShowLabels) {
			changedProps.showLabels = showLabels;
			prevShowLabels = showLabels;
		}

		if (arcHeight !== prevArcHeight) {
			changedProps.arcHeight = arcHeight;
			prevArcHeight = arcHeight;
		}

		if (arcHeightMultiplier !== prevArcHeightMultiplier) {
			changedProps.arcHeightMultiplier = arcHeightMultiplier;
			prevArcHeightMultiplier = arcHeightMultiplier;
		}

		if (filterEnabled !== prevFilterEnabled) {
			changedProps.filterEnabled = filterEnabled;
			prevFilterEnabled = filterEnabled;
		}

		if (filterMode !== prevFilterMode) {
			changedProps.filterMode = filterMode;
			prevFilterMode = filterMode;
		}

		if (maxDistance !== prevMaxDistance) {
			changedProps.maxDistance = maxDistance;
			prevMaxDistance = maxDistance;
		}

		if (
			boundsNorth !== prevBoundsNorth ||
			boundsSouth !== prevBoundsSouth ||
			boundsEast !== prevBoundsEast ||
			boundsWest !== prevBoundsWest
		) {
			changedProps.boundsNorth = boundsNorth;
			changedProps.boundsSouth = boundsSouth;
			changedProps.boundsEast = boundsEast;
			changedProps.boundsWest = boundsWest;
			prevBoundsNorth = boundsNorth;
			prevBoundsSouth = boundsSouth;
			prevBoundsEast = boundsEast;
			prevBoundsWest = boundsWest;
		}

		if (Object.keys(changedProps).length > 0) {
			updateOptionalProps(changedProps);
		}
	});

	// Calculate distance between two points (haversine formula)
	function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371; // Earth's radius in km
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	// Check if arc is within bounds
	function isWithinBounds(fromLat: number, fromLon: number, toLat: number, toLon: number): boolean {
		return (
			fromLat >= boundsSouth &&
			fromLat <= boundsNorth &&
			fromLon >= boundsWest &&
			fromLon <= boundsEast &&
			toLat >= boundsSouth &&
			toLat <= boundsNorth &&
			toLon >= boundsWest &&
			toLon <= boundsEast
		);
	}

	async function* transformRows(rows: AsyncIterable<any[]>): AsyncGenerator<any[], void, unknown> {
		let allArcs: any[] = [];
		let widthValues: number[] = [];
		let colorValues: number[] = [];
		let batchCount = 0;
		let totalRowsProcessed = 0;
		let totalValidArcs = 0;
		let filteredOutCount = 0;

		try {
			yield [];

			for await (const batch of rows) {
				batchCount++;
				totalRowsProcessed += batch.length;

				const validArcsBatch = [];

				for (const row of batch) {
					if (!row) continue;

					// Check for null/undefined coordinates
					if (
						row[fromLatitude!] == null ||
						row[fromLongitude!] == null ||
						row[toLatitude!] == null ||
						row[toLongitude!] == null
					) {
						continue;
					}

					// Convert coordinates to numbers
					const fromLong = Number(row[fromLongitude!]);
					const fromLat = Number(row[fromLatitude!]);
					const toLong = Number(row[toLongitude!]);
					const toLat = Number(row[toLatitude!]);

					// Skip invalid coordinates
					if (isNaN(fromLong) || isNaN(fromLat) || isNaN(toLong) || isNaN(toLat)) {
						continue;
					}

					// Apply geospatial filtering
					if (filterEnabled) {
						if (filterMode === 'distance') {
							const distance = calculateDistance(fromLat, fromLong, toLat, toLong);
							if (distance > maxDistance) {
								filteredOutCount++;
								continue;
							}
						} else if (filterMode === 'bounds') {
							if (!isWithinBounds(fromLat, fromLong, toLat, toLong)) {
								filteredOutCount++;
								continue;
							}
						}
					}

					// Get width value
					let widthValue = 1;
					if (widthColumn && row[widthColumn] != null) {
						widthValue = Number(row[widthColumn]);
						if (!isNaN(widthValue)) {
							widthValues.push(widthValue);
						} else {
							widthValue = 1;
						}
					}

					// Get color value
					let colorValue = null;
					if (colorColumn && row[colorColumn] != null) {
						colorValue = Number(row[colorColumn]);
						if (!isNaN(colorValue)) {
							colorValues.push(colorValue);
						} else {
							colorValue = null;
						}
					}

					// Get label value
					const labelValue =
						labelColumn && row[labelColumn] != null ? String(row[labelColumn]) : null;

					// Create arc
					const arc = {
						sourcePosition: [fromLong, fromLat],
						targetPosition: [toLong, toLat],
						width: widthValue,
						color: colorValue,
						label: labelValue
					};

					validArcsBatch.push(arc);
				}

				totalValidArcs += validArcsBatch.length;
				allArcs = [...allArcs, ...validArcsBatch];

				if (batchCount === 1 && validArcsBatch.length > 0) {
					if (widthValues.length > 0) {
						widthRange = [Math.min(...widthValues), Math.max(...widthValues)];
					}
					if (colorValues.length > 0) {
						colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
					}
				}

				yield allArcs;
			}

			console.log(`Filtered out ${filteredOutCount} arcs`);

			if (allArcs.length === 0) {
				yield [];
			}
		} catch (error: any) {
			console.error('ERROR in arc transformRows:', error);
			if (allArcs.length > 0) {
				yield allArcs;
			} else {
				yield [];
			}
		}
	}

	// Dynamic arc width calculation
	function getArcWidth(arc: any): number {
		if (!widthColumn || arc.width == null || isNaN(arc.width)) {
			return arcWidth;
		}

		const [widthMin, widthMax] = widthRange;
		if (widthMin === widthMax) return arcWidth;

		const normalizedWidth = (arc.width - widthMin) / (widthMax - widthMin);
		return minArcWidth + normalizedWidth * (maxArcWidth - minArcWidth);
	}

	// Dynamic color calculation
	function getArcColor(arc: any): number[] {
		if (!colorColumn || arc.color == null || isNaN(arc.color)) {
			return [0, 128, 255, Math.floor(opacity * 255)];
		}

		const [colorMin, colorMax] = colorRange;
		if (colorMin === colorMax) return [0, 128, 255, Math.floor(opacity * 255)];

		const normalizedValue = (arc.color - colorMin) / (colorMax - colorMin);
		let r, g, b;

		switch (colorScale) {
			case 'viridis':
				r = Math.floor((1 - normalizedValue) * 68);
				g = Math.floor(
					normalizedValue < 0.5 ? 85 + normalizedValue * 170 : 255 - (normalizedValue - 0.5) * 170
				);
				b = Math.floor(normalizedValue * 150 + 100);
				break;
			case 'blues':
				r = Math.floor(50 + (1 - normalizedValue) * 150);
				g = Math.floor(100 + (1 - normalizedValue) * 100);
				b = Math.floor(150 + normalizedValue * 100);
				break;
			case 'reds':
				r = Math.floor(150 + normalizedValue * 100);
				g = Math.floor(50 + (1 - normalizedValue) * 150);
				b = Math.floor(50 + (1 - normalizedValue) * 150);
				break;
			default:
				r = Math.floor(normalizedValue * 255);
				g = 64;
				b = Math.floor((1 - normalizedValue) * 255);
		}

		return [r, g, b, Math.floor(opacity * 255)];
	}

	// Load data with async generator
	async function* loadData(): AsyncGenerator<any[], void, unknown> {
		try {
			yield [];

			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			if (dataset !== null) {
				var filename = checkNameForSpacesAndHyphens(dataset.filename);

				const columns = [fromLatitude, fromLongitude, toLatitude, toLongitude];
				if (widthColumn) columns.push(widthColumn);
				if (colorColumn) columns.push(colorColumn);
				if (labelColumn) columns.push(labelColumn);

				const columnsStr = columns.join(', ');

				try {
					const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
					yield* transformRows(stream.readRows());
				} catch (streamError: any) {
					console.error('Error in arc layer stream query:', streamError);
					yield [];
				}
			} else {
				yield [];
			}
		} catch (error: any) {
			console.error('Error in arc loadData:', error);
			yield [];
		}
	}

	// Create arc layer
	function createArcLayer(): void {
		try {
			const layerProps = {
				data: loadData(),
				getSourcePosition: (d: any) => {
					if (!d || !d.sourcePosition || d.sourcePosition.length !== 2) {
						return [0, 0];
					}
					return d.sourcePosition;
				},
				getTargetPosition: (d: any) => {
					if (!d || !d.targetPosition || d.targetPosition.length !== 2) {
						return [0, 0];
					}
					return d.targetPosition;
				},
				getWidth: (d: any) => getArcWidth(d),
				getSourceColor: [0, 64, 128],
				getTargetColor: [255, 128, 0],
				getColor: (d: any) => getArcColor(d),
				widthScale: 1,
				widthMinPixels: 1,
				widthMaxPixels: 20,
				opacity: opacity,
				pickable: true,
				autoHighlight: true,
				getHeight: (d: any) => {
					if (!d || !d.sourcePosition || !d.targetPosition) return 0;

					const sourceLng = d.sourcePosition[0];
					const sourceLat = d.sourcePosition[1];
					const targetLng = d.targetPosition[0];
					const targetLat = d.targetPosition[1];

					const distance = Math.sqrt(
						Math.pow(targetLng - sourceLng, 2) + Math.pow(targetLat - sourceLat, 2)
					);

					return distance * arcHeight * arcHeightMultiplier;
				},
				updateTriggers: {
					getWidth: [arcWidth, widthColumn, minArcWidth, maxArcWidth, widthRange],
					getColor: [colorColumn, colorScale, colorRange, opacity],
					getHeight: [arcHeight, arcHeightMultiplier]
				},
				fromLatColumn: fromLatitude,
				fromLngColumn: fromLongitude,
				toLatColumn: toLatitude,
				toLngColumn: toLongitude,
				widthColumn: widthColumn,
				colorColumn: colorColumn,
				labelColumn: labelColumn
			};

			const existingLayer = layers.snapshot.find((l) => l.id === dataset.layerID);
			if (existingLayer) {
				layers.remove(dataset.layerID);
			}

			const newArcLayer = LayerFactory.create('arc', {
				id: dataset.layerID,
				props: layerProps
			});

			layers.add(newArcLayer);
		} catch (error) {
			console.error('Error creating arc layer:', error);
		}
	}

	// Update layer props
	function updateOptionalProps(changedProps: Record<string, any>): void {
		try {
			const currentLayer = layers.snapshot.find((l) => l.id === dataset.layerID);
			if (!currentLayer) return;

			const updateObj: Record<string, any> = { updateTriggers: {} };

			if (
				'arcWidth' in changedProps ||
				'minArcWidth' in changedProps ||
				'maxArcWidth' in changedProps ||
				'widthColumn' in changedProps
			) {
				updateObj.getWidth = (d: any) => getArcWidth(d);
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getWidth: [arcWidth, widthColumn, minArcWidth, maxArcWidth, widthRange]
				};
			}

			if (
				'colorColumn' in changedProps ||
				'colorScale' in changedProps ||
				'opacity' in changedProps
			) {
				updateObj.getColor = (d: any) => getArcColor(d);
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getColor: [colorColumn, colorScale, colorRange, opacity]
				};
			}

			if ('arcHeight' in changedProps || 'arcHeightMultiplier' in changedProps) {
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getHeight: [arcHeight, arcHeightMultiplier]
				};
			}

			if ('opacity' in changedProps) {
				updateObj.opacity = opacity;
			}

			if ('widthColumn' in changedProps) updateObj.widthColumn = widthColumn;
			if ('colorColumn' in changedProps) updateObj.colorColumn = colorColumn;
			if ('labelColumn' in changedProps) updateObj.labelColumn = labelColumn;

			if (
				'widthColumn' in changedProps ||
				'colorColumn' in changedProps ||
				'labelColumn' in changedProps ||
				'filterEnabled' in changedProps ||
				'filterMode' in changedProps ||
				'maxDistance' in changedProps ||
				'boundsNorth' in changedProps ||
				'boundsSouth' in changedProps ||
				'boundsEast' in changedProps ||
				'boundsWest' in changedProps
			) {
				updateObj.data = loadData();
			}

			layers.updateProps(dataset.layerID, updateObj);
		} catch (error) {
			console.error('Error updating arc layer props:', error);
		}
	}
</script>

<div class="space-y-1">
	{#if !requiredColumnsSelected}
		<Alert class="mx-2 mb-3 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
			<AlertCircle class="h-3 w-3" />
			<AlertDescription class="text-xs">
				Select all coordinate columns to display arcs
			</AlertDescription>
		</Alert>
	{/if}

	<Sectional label="Source Coordinates" defaultOpen={true}>
		<ConfigField label="Latitude">
			<ColumnDropdown
				bind:chosenColumn={fromLatitude}
				default_column="From Latitude"
				placeholder="Select latitude column"
			/>
		</ConfigField>

		<ConfigField label="Longitude">
			<ColumnDropdown
				bind:chosenColumn={fromLongitude}
				default_column="From Longitude"
				placeholder="Select longitude column"
			/>
		</ConfigField>
	</Sectional>

	<Sectional label="Target Coordinates" defaultOpen={true}>
		<ConfigField label="Latitude">
			<ColumnDropdown
				bind:chosenColumn={toLatitude}
				default_column="To Latitude"
				placeholder="Select latitude column"
			/>
		</ConfigField>

		<ConfigField label="Longitude">
			<ColumnDropdown
				bind:chosenColumn={toLongitude}
				default_column="To Longitude"
				placeholder="Select longitude column"
			/>
		</ConfigField>
	</Sectional>

	<Sectional label="Visual Properties" defaultOpen={false}>
		<ConfigField label="Arc Width" value="{arcWidth}px">
			<Slider
				type="single"
				value={arcWidth}
				min={1}
				max={10}
				step={0.5}
				onValueChange={(v: number) => (arcWidth = v)}
				class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
			/>
		</ConfigField>

		<ConfigField label="Opacity" value="{Math.round(opacity * 100)}%">
			<Slider
				type="single"
				value={opacity}
				min={0.1}
				max={1}
				step={0.05}
				onValueChange={(v: number) => (opacity = v)}
				class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
			/>
		</ConfigField>

		<ConfigField label="Arc Height" value={arcHeight.toFixed(1)}>
			<Slider
				type="single"
				value={arcHeight}
				min={0}
				max={5}
				step={0.1}
				onValueChange={(v: number) => (arcHeight = v)}
				class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
			/>
		</ConfigField>

		<ConfigField label="Height Multiplier" value="{arcHeightMultiplier.toFixed(1)}x">
			<Slider
				type="single"
				value={arcHeightMultiplier}
				min={0.1}
				max={5}
				step={0.1}
				onValueChange={(v: number) => (arcHeightMultiplier = v)}
				class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
			/>
		</ConfigField>
	</Sectional>

	<Sectional label="Data Encoding" defaultOpen={false}>
		<ConfigField label="Width Column">
			<ColumnDropdown
				bind:chosenColumn={widthColumn}
				default_column="Width"
				placeholder="Fixed width"
			/>
		</ConfigField>

		{#if widthColumn}
			<div class="space-y-3 border-l-2 border-border/30 pl-4">
				<ConfigField label="Min Width" value="{minArcWidth}px">
					<Slider
						type="single"
						value={minArcWidth}
						min={0.5}
						max={5}
						step={0.5}
						onValueChange={(v: number) => (minArcWidth = v)}
						class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
					/>
				</ConfigField>

				<ConfigField label="Max Width" value="{maxArcWidth}px">
					<Slider
						type="single"
						value={maxArcWidth}
						min={5}
						max={50}
						step={1}
						onValueChange={(v: number) => (maxArcWidth = v)}
						class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
					/>
				</ConfigField>
			</div>
		{/if}

		<ConfigField label="Color Column">
			<ColumnDropdown
				bind:chosenColumn={colorColumn}
				default_column="Color"
				placeholder="Fixed color"
			/>
		</ConfigField>

		{#if colorColumn}
			<ConfigField label="Color Scale" class="border-l-2 border-border/30 pl-4">
				<select
					class="flex h-7 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					bind:value={colorScale}
				>
					{#each colorScales as scale}
						<option value={scale} class="capitalize">{scale}</option>
					{/each}
				</select>
			</ConfigField>
		{/if}

		<ConfigField label="Label Column">
			<ColumnDropdown
				bind:chosenColumn={labelColumn}
				default_column="Label"
				placeholder="No labels"
			/>
		</ConfigField>

		{#if labelColumn}
			<div class="flex items-center space-x-2 border-l-2 border-border/30 py-2 pl-4">
				<Switch id="show-labels" bind:checked={showLabels} class="h-4 w-6" />
				<label for="show-labels" class="cursor-pointer text-xs font-normal text-muted-foreground">
					Display labels on map
				</label>
			</div>
		{/if}
	</Sectional>

	<Sectional label="Geospatial Filter" defaultOpen={false}>
		<div class="flex items-center space-x-2">
			<Switch id="filter-enabled" bind:checked={filterEnabled} class="h-4 w-6" />
			<label for="filter-enabled" class="cursor-pointer text-xs font-normal text-muted-foreground">
				Enable filtering
			</label>
		</div>

		{#if filterEnabled}
			<div class="space-y-3 border-l-2 border-border/30 pl-4">
				<ConfigField label="Filter Mode">
					<select
						class="flex h-7 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						bind:value={filterMode}
					>
						<option value="distance">By Distance</option>
						<option value="bounds">By Bounds</option>
					</select>
				</ConfigField>

				{#if filterMode === 'distance'}
					<ConfigField label="Max Distance" value="{maxDistance} km">
						<Slider
							type="single"
							value={maxDistance}
							min={1}
							max={5000}
							step={10}
							onValueChange={(v: number) => (maxDistance = v)}
							class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
						/>
					</ConfigField>
				{:else if filterMode === 'bounds'}
					<ConfigField label="North Bound">
						<Input
							type="number"
							bind:value={boundsNorth}
							min={-90}
							max={90}
							step={1}
							class="h-7 text-xs"
						/>
					</ConfigField>

					<ConfigField label="South Bound">
						<Input
							type="number"
							bind:value={boundsSouth}
							min={-90}
							max={90}
							step={1}
							class="h-7 text-xs"
						/>
					</ConfigField>

					<ConfigField label="East Bound">
						<Input
							type="number"
							bind:value={boundsEast}
							min={-180}
							max={180}
							step={1}
							class="h-7 text-xs"
						/>
					</ConfigField>

					<ConfigField label="West Bound">
						<Input
							type="number"
							bind:value={boundsWest}
							min={-180}
							max={180}
							step={1}
							class="h-7 text-xs"
						/>
					</ConfigField>
				{/if}
			</div>
		{/if}
	</Sectional>
</div>
