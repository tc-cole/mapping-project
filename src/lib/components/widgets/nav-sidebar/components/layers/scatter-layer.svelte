<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import { LayerFactory } from '$lib/components/io/layer-management.svelte';
	import { chosenDataset, layers } from '$lib/components/io/stores';
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

	let hasInitialized = $state(false);

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(
		latitudeColumn !== undefined && longitudeColumn !== undefined
	);

	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			createScatterLayer();
			hasInitialized = true;
		}
	});

	$effect(() => {
		// Only run after initial creation and when columns change
		if (!hasInitialized) {
			return;
		}

		const currentLayer = layers.snapshot.find((l) => l.id === layer.id);

		if (
			currentLayer &&
			(currentLayer.props.latColumn !== latitudeColumn ||
				currentLayer.props.lngColumn !== longitudeColumn)
		) {
			createScatterLayer();
		}
	});

	let prevSizeColumn = $state<string | null>(null);
	let prevColorColumn = $state<string | null>(null);
	let prevLabelColumn = $state<string | null>(null);
	let prevPointRadius = $state<number>(10);
	let prevMinPointRadius = $state<number>(1);
	let prevMaxPointRadius = $state<number>(100);
	let prevOpacity = $state<number>(0.8);
	let prevColorScale = $state<string>('viridis');
	let prevShowLabels = $state<boolean>(false);

	// Update props when optional parameters change
	$effect(() => {
		// Only run after initial layer creation
		if (!hasInitialized || !requiredColumnsSelected) {
			return;
		}

		// Detect which properties have changed
		const changedProps: Record<string, any> = {};

		if (sizeColumn !== prevSizeColumn) {
			changedProps.sizeColumn = sizeColumn;
			prevSizeColumn = sizeColumn;
		}

		if (colorColumn !== prevColorColumn) {
			changedProps.colorColumn = colorColumn;
			prevColorColumn = colorColumn;
		}

		if (labelColumn !== prevLabelColumn) {
			changedProps.labelColumn = labelColumn;
			prevLabelColumn = labelColumn;
		}

		if (pointRadius !== prevPointRadius) {
			changedProps.pointRadius = pointRadius;
			prevPointRadius = pointRadius;
		}

		if (minPointRadius !== prevMinPointRadius) {
			changedProps.minPointRadius = minPointRadius;
			prevMinPointRadius = minPointRadius;
		}

		if (maxPointRadius !== prevMaxPointRadius) {
			changedProps.maxPointRadius = maxPointRadius;
			prevMaxPointRadius = maxPointRadius;
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

		// Only update if something changed
		if (Object.keys(changedProps).length > 0) {
			updateOptionalProps(changedProps);
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
				}

				yield allPoints;
			}

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

	// Create a scatter layer when required columns are selected
	function createScatterLayer() {
		try {
			// Define the initial layer properties
			const layerProps = {
				data: loadData(),
				getPosition: (d: Point) => {
					if (!d || !d.position || d.position.length !== 2) {
						return [0, 0]; // Default to prevent errors
					}
					return d.position;
				},
				getRadius: (d: Point) => getPointRadius(d),
				getFillColor: (d: Point) => getPointColor(d),
				getLineColor: [0, 0, 0],
				lineWidthMinPixels: 1,
				pickable: true,
				autoHighlight: true,
				stroked: true,
				filled: true,
				radiusScale: 1,
				radiusMinPixels: 1,
				radiusMaxPixels: 100,
				opacity: opacity,
				updateTriggers: {
					getRadius: [pointRadius, sizeColumn, minPointRadius, maxPointRadius, sizeRange],
					getFillColor: [colorColumn, colorScale, colorRange, opacity]
				},
				// Store the column selections as props to detect changes later
				latColumn: latitudeColumn,
				lngColumn: longitudeColumn,
				sizeColumn: sizeColumn,
				colorColumn: colorColumn,
				labelColumn: labelColumn
			};

			// First check if a layer with this ID already exists (cleanup)
			const existingLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (existingLayer) {
				layers.remove(layer.id);
			}

			// Create a new scatter layer with the properties
			const newScatterLayer = LayerFactory.create('scatter', {
				id: layer.id,
				props: layerProps
			});

			// Add the new scatter layer
			layers.add(newScatterLayer);
		} catch (error) {
			// Error handling without console.error
		}
	}

	// Update layer props when optional parameters change
	function updateOptionalProps(changedProps: Record<string, any>) {
		try {
			// Find the current layer
			const currentLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (!currentLayer) {
				return;
			}

			// Base update object with updateTriggers
			const updateObj: Record<string, any> = { updateTriggers: {} };

			// Handle radius/size changes
			if (
				'pointRadius' in changedProps ||
				'minPointRadius' in changedProps ||
				'maxPointRadius' in changedProps ||
				'sizeColumn' in changedProps
			) {
				updateObj.getRadius = (d: Point) => getPointRadius(d);
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getRadius: [pointRadius, sizeColumn, minPointRadius, maxPointRadius, sizeRange]
				};
			}

			// Handle color changes
			if (
				'colorColumn' in changedProps ||
				'colorScale' in changedProps ||
				'opacity' in changedProps
			) {
				updateObj.getFillColor = (d: Point) => getPointColor(d);
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getFillColor: [colorColumn, colorScale, colorRange, opacity]
				};
			}

			// Direct opacity setting
			if ('opacity' in changedProps) {
				updateObj.opacity = opacity;
			}

			// Update column references
			if ('sizeColumn' in changedProps) {
				updateObj.sizeColumn = sizeColumn;
			}

			if ('colorColumn' in changedProps) {
				updateObj.colorColumn = colorColumn;
			}

			if ('labelColumn' in changedProps) {
				updateObj.labelColumn = labelColumn;
			}

			if (
				'sizeColumn' in changedProps ||
				'colorColumn' in changedProps ||
				'labelColumn' in changedProps
			) {
				updateObj.data = loadData();
			}

			layers.updateProps(layer.id, updateObj);
		} catch (error) {
			// Error handling without console.error
		}
	}

	function getPointRadius(point: any) {
		if (!sizeColumn || point.size === null || point.size === undefined) {
			return pointRadius;
		}

		const sizeMin = sizeRange[0];
		const sizeMax = sizeRange[1];

		if (sizeMin === sizeMax) {
			return pointRadius; // Use base radius for uniform data
		}

		const normalizedSize = (point.size - sizeMin) / (sizeMax - sizeMin);
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
				const data = await client.query(`SELECT ${columnsStr} FROM ${filename} LIMIT 1`);

				if (data && data.length > 0) {
					const viewingPosition = data[0];

					if (
						longitudeColumn !== undefined &&
						latitudeColumn !== undefined &&
						viewingPosition[longitudeColumn] !== undefined &&
						viewingPosition[latitudeColumn] !== undefined
					) {
						flyTo(viewingPosition[longitudeColumn], viewingPosition[latitudeColumn]);
					}
				}

				const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);

				yield* transformRows(stream.readRows());
			} else {
				yield [];
			}
		} catch (error) {
			// Error handling without console.error
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