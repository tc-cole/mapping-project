<script lang="ts">
	import { layers, mapViewState } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import { chosenDataset } from '$lib/components/io/stores';
	import { Label } from '$lib/components/ui/label/index.js';
	import Input from '$lib/components/ui/input/input.svelte';
	import { flyTo } from './utils/flyto';

	import ColumnDropdown from './utils/column-dropdown.svelte';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

	let latitudeColumn = $state<string | undefined>();
	let longitudeColumn = $state<string | undefined>();
	let sizeColumn = $state<string | null>(null);
	let colorColumn = $state<string | null>(null);
	let labelColumn = $state<string | null>(null);

	let pointRadius = $state<number>(10);
	let minPointRadius = $state<number>(1);
	let maxPointRadius = $state<number>(100);
	let opacity = $state<number>(0.8);
	let colorScale = $state<string>('viridis');
	let showLabels = $state<boolean>(false);

	// Removed explicit state declaration as it's now handled by $derived

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

	let { layer } = $props();

	// Used to store pre-calculated values for size and color ranges
	let sizeRange = [0, 1];
	let colorRange = [0, 1];
	let dataLoaded = $state(false);
	let hasInitialized = $state(false);

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(
		latitudeColumn !== undefined && longitudeColumn !== undefined
	);

	// Derive the map layer configuration based on all input parameters
	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			updateMapLayers();
			hasInitialized = true;
		}
	});

	async function* transformRows(rows: AsyncIterable<any>) {
		let points = [];
		let sizeValues = [];
		let colorValues = [];

		for await (const row of rows) {
			// Skip rows with missing coordinates
			//@ts-ignore
			if (row[latitudeColumn] === null || row[longitudeColumn] === null) {
				continue;
			}

			const point = {
				//@ts-expect-error
				position: [row[longitudeColumn], row[latitudeColumn]],
				size: sizeColumn ? row[sizeColumn] : 1,
				color: colorColumn ? row[colorColumn] : null,
				label: labelColumn ? row[labelColumn] : null
			};

			// Collect values for calculating ranges
			if (sizeColumn && row[sizeColumn] !== null) {
				sizeValues.push(row[sizeColumn]);
			}

			if (colorColumn && row[colorColumn] !== null) {
				colorValues.push(row[colorColumn]);
			}

			points.push(point);

			if (points.length >= CHUNK_SIZE) {
				// Process ranges before yielding first chunk
				if (!dataLoaded && (sizeValues.length > 0 || colorValues.length > 0)) {
					if (sizeValues.length > 0) {
						sizeRange = [Math.min(...sizeValues), Math.max(...sizeValues)];
					}
					if (colorValues.length > 0) {
						colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
					}
					dataLoaded = true;
				}

				yield points;
				points = [];
			}
		}

		// Process ranges if this is the first and only chunk
		if (!dataLoaded && (sizeValues.length > 0 || colorValues.length > 0)) {
			if (sizeValues.length > 0) {
				sizeRange = [Math.min(...sizeValues), Math.max(...sizeValues)];
			}
			if (colorValues.length > 0) {
				colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
			}
			dataLoaded = true;
		}

		if (points.length > 0) {
			yield points;
		}
	}

	function updateMapLayers() {
		layers.updateProps(layer.id, {
			data: loadData(),
			getPosition: (d: any) => d.position,
			getRadius: getPointRadius,
			getFillColor: getPointColor,
			radiusScale: 1,
			radiusMinPixels: 1,
			radiusMaxPixels: 100,
			opacity: opacity,
			pickable: true,
			autoHighlight: true,
			stroked: true,
			filled: true,
			lineWidthMinPixels: 1,
			getLineColor: [0, 0, 0],
			colorScale: colorScale,
			updateTriggers: {
				getRadius: [pointRadius, sizeColumn, minPointRadius, maxPointRadius, sizeRange],
				getFillColor: [colorColumn, colorScale, colorRange, opacity]
			}
		});

		// Update text labels layer
		layers.updateProps(`${layer.id}-labels`, {
			data: loadData(),
			getPosition: (d: any) => d.position,
			getText: (d: any) => d.label || '',
			getSize: 12,
			getAngle: 0,
			getTextAnchor: 'middle',
			getAlignmentBaseline: 'center',
			getPixelOffset: [0, -20], // Offset above the point
			fontFamily: 'Arial',
			fontWeight: 'bold',
			outlineWidth: 2,
			outlineColor: [255, 255, 255],
			visible: showLabels && labelColumn !== null
		});
	}

	// Dynamic point radius calculation
	function getPointRadius(point: any) {
		if (!sizeColumn || point.size === null) {
			return pointRadius;
		}

		// Calculate normalized radius based on the data range
		const sizeMin = sizeRange[0];
		const sizeMax = sizeRange[1];

		// Handle edge case where min and max are the same
		if (sizeMin === sizeMax) {
			return pointRadius;
		}

		// Normalize the size value to 0-1 range
		const normalizedSize = (point.size - sizeMin) / (sizeMax - sizeMin);

		// Map the normalized value to the radius range
		return minPointRadius + normalizedSize * (maxPointRadius - minPointRadius);
	}

	// Dynamic color calculation
	function getPointColor(point: any) {
		if (!colorColumn || point.color === null) {
			return [64, 64, 180, Math.floor(opacity * 255)]; // Default blue
		}

		// In a real implementation, this would use the appropriate color scale
		// Here we're just passing the value along and assuming the layer will handle color mapping
		return [point.color, Math.floor(opacity * 255)];
	}

	const loadData = async function* () {
		const db = SingletonDatabase.getInstance();
		const client = await db.init();
		if ($chosenDataset !== null) {
			var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);

			// Build column list for query
			const columns = [latitudeColumn, longitudeColumn];
			if (sizeColumn) columns.push(sizeColumn);
			if (colorColumn) columns.push(colorColumn);
			if (labelColumn) columns.push(labelColumn);

			const columnsStr = columns.join(', ');
			const data = await client.query(`SELECT ${columnsStr} FROM ${filename} LIMIT 1`);

			//@ts-ignore-error
			const viewingPosition = data[0];
			//@ts-ignore-error
			flyTo(viewingPosition.longitude, viewingPosition.latitude);
			//mapViewState.set(viewingPosition);
			const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
			yield* transformRows(stream.readRows());
		}
	};
</script>

<!-- Required Coordinates -->
<div class="mb-4">
	<Sectional label="Choose Latitude and Longitude Columns">
		<div class="py-1">
			<ColumnDropdown bind:chosenColumn={latitudeColumn} default_column={'Latitude'} />
		</div>
		<div class="py-1">
			<ColumnDropdown bind:chosenColumn={longitudeColumn} default_column={'Longitude'} />
		</div>
		<div>
			{#if !requiredColumnsSelected}
				<p class="text-sm text-amber-500">Please select both columns to display points.</p>
			{/if}
		</div>
	</Sectional>
</div>

<!-- Optional Encodings -->
<div class="mb-4">
	<Sectional label="Optional Columns">
		<div class="space-y-4">
			<ColumnDropdown bind:chosenColumn={sizeColumn} default_column="Size" />
			<ColumnDropdown bind:chosenColumn={colorColumn} default_column="Color" />

			{#if colorColumn}
				<div class="mt-2 space-y-1">
					<select
						class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
						bind:value={colorScale}
					>
						{#each colorScales as scale}
							<option value={scale}>{scale}</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if sizeColumn}
				<div class="mt-2 space-y-2">
					<div>
						<Label>Min Radius</Label>
						<Input
							type="range"
							min="1"
							max="50"
							step="1"
							bind:value={minPointRadius}
							class="w-full"
						/>
					</div>
					<div>
						<Label>Max Radius</Label>
						<Input
							type="range"
							min="10"
							max="200"
							step="5"
							bind:value={maxPointRadius}
							class="w-full"
						/>
					</div>
				</div>
			{/if}
		</div>
	</Sectional>
</div>

<div class="mb-4">
	<Sectional label="Visual Adjustments">
		<div class="space-y-4">
			<div>
				<Input type="range" min="1" max="50" step="1" bind:value={pointRadius} class="w-full" />
				<div class="flex justify-between text-xs text-gray-500">
					<span>Small</span>
					<span>Large</span>
				</div>
			</div>
			<div>
				<Input type="range" min="0.1" max="1" step="0.05" bind:value={opacity} class="w-full" />
				<div class="flex justify-between text-xs text-gray-500">
					<span>Transparent</span>
					<span>Solid</span>
				</div>
			</div>
		</div>
	</Sectional>
</div>

<!-- Labels -->
<div class="mb-4">
	<Sectional label="Point Labels">
		<div class="space-y-2">
			<div class="grid grid-cols-2 items-center gap-4">
				<div>
					<ColumnDropdown bind:chosenColumn={labelColumn} default_column="Label" />
				</div>
				<div class="flex items-center">
					<input
						type="checkbox"
						bind:checked={showLabels}
						class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
						disabled={!labelColumn}
					/>
					<span class="ml-2 text-sm text-gray-700">Show Labels</span>
				</div>
			</div>
		</div>
	</Sectional>
</div>
