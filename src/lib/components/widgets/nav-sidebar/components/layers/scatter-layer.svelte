<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import { LayerFactory, layers } from '$lib/components/io/layer-io.svelte';
	import { chosenDataset } from '$lib/components/io/stores';
	import { Label } from '$lib/components/ui/label/index.js';
	import Input from '$lib/components/ui/input/input.svelte';
	import { flyTo } from './utils/flyto';

	import ColumnDropdown from './utils/column-dropdown.svelte';
	import Sectional from './utils/sectional.svelte';

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

	async function* transformRows(
		rows: AsyncIterable<Record<string, any>[]>
	): AsyncGenerator<Point[], void, unknown> {
		// Start with empty collections
		let allPoints: Point[] = [];
		let sizeValues: number[] = [];
		let colorValues: number[] = [];
		let batchCount = 0;
		let totalRowsProcessed = 0;
		let totalValidPoints = 0;
		let invalidCoordinates = 0;
		let nullCoordinates = 0;

		try {
			yield [];

			// DuckDB's queryStream.readRows() yields arrays of row objects
			for await (const batch of rows) {
				batchCount++;
				totalRowsProcessed += batch.length;

				const validPointsBatch: Point[] = [];

				for (const row of batch) {
					if (!row) {
						continue;
					}

					if (
						latitudeColumn === undefined ||
						longitudeColumn === undefined ||
						row[latitudeColumn] === null ||
						row[latitudeColumn] === undefined ||
						row[longitudeColumn] === null ||
						row[longitudeColumn] === undefined
					) {
						nullCoordinates++;
						continue;
					}

					// Convert coordinates to numbers explicitly
					const longitude = Number(row[longitudeColumn]);
					const latitude = Number(row[latitudeColumn]);

					// Skip if coordinates couldn't be converted to valid numbers
					if (isNaN(longitude) || isNaN(latitude)) {
						invalidCoordinates++;
						continue;
					}

					// Get the size value (with default)
					let sizeValue = 1;
					if (sizeColumn && row[sizeColumn] !== null && row[sizeColumn] !== undefined) {
						sizeValue = Number(row[sizeColumn]);
						if (!isNaN(sizeValue)) {
							sizeValues.push(sizeValue);
						} else {
							sizeValue = 1;
						}
					}

					// Get the color value
					let colorValue: number | null = null;
					if (colorColumn && row[colorColumn] !== null && row[colorColumn] !== undefined) {
						const val = Number(row[colorColumn]);
						if (!isNaN(val)) {
							colorValue = val;
							colorValues.push(val);
						} else {
							colorValue = null;
						}
					}

					// Get the label value
					const labelValue =
						labelColumn && row[labelColumn] !== null && row[labelColumn] !== undefined
							? String(row[labelColumn])
							: null;

					// Create a point with properly formatted values
					const point: Point = {
						position: [longitude, latitude],
						size: sizeValue,
						color: colorValue,
						label: labelValue
					};

					validPointsBatch.push(point);
				}

				totalValidPoints += validPointsBatch.length;
				allPoints = [...allPoints, ...validPointsBatch];
				if (batchCount === 1 && validPointsBatch.length > 0) {
					// Calculate size range if we have size values
					if (sizeValues.length > 0) {
						const min = Math.min(...sizeValues);
						const max = Math.max(...sizeValues);
						sizeRange = [min, max];
					}

					// Calculate color range if we have color values
					if (colorValues.length > 0) {
						const min = Math.min(...colorValues);
						const max = Math.max(...colorValues);
						colorRange = [min, max];
					}

					dataLoaded = true;
				}

				// Yield the complete accumulated array (important for deck.gl)
				yield allPoints;
			}

			// Final yield if we didn't yield any points yet
			if (allPoints.length === 0) {
				yield [];
			}
		} catch (error: unknown) {
			// In case of error, yield any points we've collected so far
			if (allPoints.length > 0) {
				yield allPoints;
			} else {
				yield [];
			}
		}
	}

	// Define the Point type for clarity
	interface Point {
		position: [number, number];
		size: number;
		color: number | null;
		label: string | null;
	}

	function updateMapLayers() {
		layers.remove(layer.id);

		const scatterLayer = LayerFactory.create('scatter', {
			props: {
				data: loadData(),
				getPosition: (d: Point) => d.position,
				getRadius: (d: Point) => Math.sqrt(d.size) / 50, // Scale radius based on size
				radiusScale: 1,
				radiusMinPixels: 1,
				radiusMaxPixels: 100,
				pickable: true,
				autoHighlight: true,
				stroked: true,
				filled: true,
				lineWidthMinPixels: 1,
				getLineColor: [0, 0, 0],
				getSize: 12,
				getAngle: 0,
				getTextAnchor: 'middle',
				getAlignmentBaseline: 'center',
				getPixelOffset: [0, -20], // Offset above the point
				fontFamily: 'Arial',
				fontWeight: 'bold',
				outlineWidth: 2,
				outlineColor: [255, 255, 255]
			}
		});
		layers.add(scatterLayer);
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

	async function* loadData() {
		try {
			// Initial empty dataset
			yield [];

			// Get database instance
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

				// Sample query to get first row for positioning
				console.log(`Executing query: SELECT ${columnsStr} FROM ${filename} LIMIT 1`);
				const data = await client.query(`SELECT ${columnsStr} FROM ${filename} LIMIT 1`);

				if (data && data.length > 0) {
					const viewingPosition = data[0];
					console.log('Initial viewing position:', viewingPosition);

					// Fly to first point location

					if (
						longitudeColumn !== undefined &&
						latitudeColumn !== undefined &&
						viewingPosition[longitudeColumn] !== undefined &&
						viewingPosition[latitudeColumn] !== undefined
					) {
						//@ts-expect-error
						flyTo(viewingPosition[longitudeColumn], viewingPosition[latitudeColumn]);
					}
				}

				// Main query with all data
				console.log(`Executing stream query: SELECT ${columnsStr} FROM ${filename}`);
				const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);

				// Transform the rows and yield the results
				yield* transformRows(stream.readRows());
			} else {
				console.log('No dataset chosen');
				yield [];
			}
		} catch (error) {
			console.error('Error loading data:', error);
			// Return empty array in case of error
			yield [];
		}
	}
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
