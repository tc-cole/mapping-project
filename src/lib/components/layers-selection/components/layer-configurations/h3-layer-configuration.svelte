<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/io/FileUtils';
	import { LayerFactory } from '$lib/io/layer-management.svelte';
	import { layers } from '$lib/io/stores';
	import { SingletonDatabase } from '$lib/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import Sectional from './utils/sectional.svelte';
	import { cellToLatLng } from 'h3-js';

	const CHUNK_SIZE = 100000;

	// Required columns
	let h3Column = $state<string | undefined>();
	let valueColumn = $state<string | undefined>();

	let colorScale = $state<string>('viridis');
	let opacity = $state<number>(0.8);
	let elevationScale = $state<number>(10);
	let extruded = $state<boolean>(false);
	let wireframe = $state<boolean>(true);
	let coverage = $state<number>(1.0);
	let scaleType = $state<string>('linear');

	let prevColorScale = $state<string>('viridis');
	let prevOpacity = $state<number>(0.8);
	let prevElevationScale = $state<number>(10);
	let prevExtruded = $state<boolean>(false);
	let prevWireframe = $state<boolean>(true);
	let prevCoverage = $state<number>(1.0);
	let prevScaleType = $state<string>('linear');

	// State variables
	let hasInitialized = $state(false);
	let dataLoaded = $state(false);
	let valueRange = $state<[number, number]>([0, 1]);

	let { layer, dataset } = $props();

	// Available color scales (matching other layers for consistency)
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

	// Scale types
	const scaleTypes = ['linear', 'log'];

	let requiredColumnsSelected = $derived(h3Column !== undefined && valueColumn !== undefined);

	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			createH3Layer();
			hasInitialized = true;
		}
	});

	$effect(() => {
		if (!hasInitialized) {
			return;
		}

		// Find the current layer
		const currentLayer = layers.snapshot.find((l) => l.id === layer.id);

		// Recreate layer if main columns have changed
		if (
			currentLayer &&
			(currentLayer.props.h3Column !== h3Column || currentLayer.props.valueColumn !== valueColumn)
		) {
			console.log('H3 or value column changed, recreating layer');
			createH3Layer();
		}
	});

	// Update props when optional parameters change
	$effect(() => {
		// Only run after initial layer creation
		if (!hasInitialized || !requiredColumnsSelected) {
			return;
		}

		// Detect which properties have changed
		const changedProps: Record<string, any> = {};

		if (colorScale !== prevColorScale) {
			changedProps.colorScale = colorScale;
			prevColorScale = colorScale;
		}

		if (opacity !== prevOpacity) {
			changedProps.opacity = opacity;
			prevOpacity = opacity;
		}

		if (elevationScale !== prevElevationScale) {
			changedProps.elevationScale = elevationScale;
			prevElevationScale = elevationScale;
		}

		if (extruded !== prevExtruded) {
			changedProps.extruded = extruded;
			prevExtruded = extruded;
		}

		if (wireframe !== prevWireframe) {
			changedProps.wireframe = wireframe;
			prevWireframe = wireframe;
		}

		if (coverage !== prevCoverage) {
			changedProps.coverage = coverage;
			prevCoverage = coverage;
		}

		if (scaleType !== prevScaleType) {
			changedProps.scaleType = scaleType;
			prevScaleType = scaleType;
		}

		// Only update if something changed
		if (Object.keys(changedProps).length > 0) {
			updateOptionalProps(changedProps);
		}
	});

	// H3 data transformer function
	async function* transformRows(rows: AsyncIterable<any[]>) {
		console.log('Starting H3 transformRows with columns:', {
			h3: h3Column,
			value: valueColumn
		});

		// Stats tracking
		let allHexagons: any[] = [];
		let values = [];
		let batchCount = 0;
		let totalRowsProcessed = 0;
		let validHexagonCount = 0;
		let invalidH3Count = 0;
		let nullH3Count = 0;
		let invalidValueCount = 0;
		let nullValueCount = 0;

		try {
			yield [];

			for await (const batch of rows) {
				batchCount++;
				console.log(`Processing H3 batch ${batchCount} with ${batch.length} rows`);
				totalRowsProcessed += batch.length;

				// Process each row in the batch
				const validHexagons = [];

				for (const row of batch) {
					// Skip rows with missing data
					if (!row) {
						continue;
					}

					// Check for null/undefined H3 index
					//@ts-expect-error
					if (row[h3Column] === null || row[h3Column] === undefined) {
						nullH3Count++;
						continue;
					}

					// Check for null/undefined/NaN value
					if (
						//@ts-expect-error
						row[valueColumn] === null || //@ts-expect-error
						row[valueColumn] === undefined || //@ts-expect-error
						isNaN(Number(row[valueColumn]))
					) {
						// Distinguish between null and NaN
						//@ts-expect-error
						if (row[valueColumn] === null || row[valueColumn] === undefined) {
							nullValueCount++;
						} else {
							invalidValueCount++;
						}
						continue;
					}

					// Validate the H3 index format (basic check)
					// H3 indices are typically hexadecimal strings
					//@ts-expect-error
					const h3Index = row[h3Column].toString();
					const isValidH3 = /^[0-9a-fA-F]+$/.test(h3Index);

					if (!isValidH3) {
						invalidH3Count++;
						continue;
					}

					// Convert value to number
					//@ts-expect-error
					const value = Number(row[valueColumn]);

					// Try to convert H3 index to lat/lng using h3-js
					let lat = null;
					let lng = null;
					try {
						// Only used for validation - we don't need to store these
						const [lat, lng] = cellToLatLng(h3Index);
					} catch (error) {
						// If h3-js can't process this, it's an invalid H3 index
						invalidH3Count++;
						continue;
					}

					// Create hexagon object
					const hexagon = {
						hex: h3Index,
						value: value
					};

					// Collect values for range calculation
					values.push(value);
					validHexagons.push(hexagon);
					validHexagonCount++;
				}

				// Add batch hexagons to accumulated collection
				allHexagons = [...allHexagons, ...validHexagons];

				// Calculate value range from the first batch with valid values
				if (!dataLoaded && values.length > 0) {
					const min = Math.min(...values);
					const max = Math.max(...values);
					valueRange = [min, max];
					console.log('Value range calculated:', valueRange);
					dataLoaded = true;
				}

				// Yield the accumulated hexagons
				yield allHexagons;

				// If we've reached the chunk size, start a new collection
				if (allHexagons.length >= CHUNK_SIZE) {
					console.log(`Reached chunk size limit (${CHUNK_SIZE}), resetting hexagon collection`);
					allHexagons = [];
				}
			}

			// Final yield if we didn't yield any hexagons yet
			if (allHexagons.length === 0) {
				console.log('WARNING: No valid hexagons found in any batch');
				yield [];
			}

			console.log(`H3 transform complete: ${validHexagonCount} hexagons processed`);
		} catch (error) {
			console.error('ERROR in H3 transformRows:', error);

			// In case of error, yield what we have so far
			if (allHexagons.length > 0) {
				yield allHexagons;
			} else {
				yield [];
			}
		}
	}

	// Load data with async generator
	async function* loadData() {
		try {
			// Initial empty dataset
			yield [];

			// Get database instance
			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			if (dataset !== null) {
				var filename = checkNameForSpacesAndHyphens(dataset.datasetName);

				// Main query with H3 and value columns
				const query = `SELECT ${h3Column}, ${valueColumn} FROM ${filename}`;
				console.log(`Executing H3 layer query: ${query}`);

				try {
					const stream = await client.queryStream(query);

					// Transform the rows and yield the results
					const readRowsGenerator = stream.readRows();
					yield* transformRows(readRowsGenerator);
				} catch (streamError) {
					console.error('Error in H3 layer stream query:', streamError);
					yield [];
				}
			} else {
				console.log('No dataset chosen for H3 layer');
				yield [];
			}
		} catch (error) {
			console.error('Error in H3 loadData:', error);
			// Return empty array in case of error
			yield [];
		}
	}

	// Create initial H3 layer
	function createH3Layer() {
		try {
			console.log('Creating new H3 layer');

			// Define the initial layer properties
			const layerProps = {
				data: loadData(),
				getHexagon: (d: any) => {
					if (!d || !d.hex) {
						console.warn('Invalid hexagon data:', d);
						return '0'; // Return a default H3 index
					}
					return d.hex;
				},
				getFillColor: (d: any) => {
					// This will be handled by the layer's color mapping based on getColorValue
					return [255, 140, 0, Math.floor(opacity * 255)];
				},
				getElevation: (d: any) => {
					if (!extruded) return 0;
					return d.value || 0;
				},
				getColorValue: (d: any) => {
					return d.value;
				},
				elevationScale: elevationScale,
				extruded: extruded,
				wireframe: wireframe,
				coverage: coverage,
				colorScale: colorScale,
				colorScaleType: scaleType,
				colorDomain: valueRange,
				opacity: opacity,
				pickable: true,
				autoHighlight: true,
				filled: true,
				updateTriggers: {
					getElevation: [elevationScale, extruded, valueRange],
					getColorValue: [valueColumn, valueRange],
					getFillColor: [colorScale, opacity]
				},
				// Store the column selections as props to detect changes later
				h3Column: h3Column,
				valueColumn: valueColumn
			};

			// First check if a layer with this ID already exists (cleanup)
			const existingLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (existingLayer) {
				console.log(`Removing existing layer with ID: ${layer.id}`);
				layers.remove(layer.id);
			}

			// Create a new H3 layer
			const newLayer = LayerFactory.create('h3', {
				id: layer.id,
				props: layerProps
			});

			// Add the new layer
			layers.add(newLayer);
			console.log('H3 layer created successfully');
		} catch (error) {
			console.error('Error creating H3 layer:', error);
		}
	}

	// Update layer props when optional parameters change
	function updateOptionalProps(changedProps: Record<string, any>) {
		try {
			// Find the current layer
			const currentLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (!currentLayer) {
				console.warn(`Cannot update layer with ID: ${layer.id} - layer not found`);
				return;
			}

			// Base update object with updateTriggers
			const updateObj: Record<string, any> = { updateTriggers: {} };

			// Handle color scale changes
			if ('colorScale' in changedProps) {
				updateObj.colorScale = colorScale;
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getFillColor: [colorScale, opacity]
				};
			}

			// Handle opacity changes
			if ('opacity' in changedProps) {
				updateObj.opacity = opacity;
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getFillColor: [colorScale, opacity]
				};
			}

			// Handle elevation changes
			if ('elevationScale' in changedProps || 'extruded' in changedProps) {
				updateObj.elevationScale = elevationScale;
				updateObj.extruded = extruded;
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getElevation: [elevationScale, extruded, valueRange]
				};
			}

			// Handle wireframe changes
			if ('wireframe' in changedProps) {
				updateObj.wireframe = wireframe;
			}

			// Handle coverage changes
			if ('coverage' in changedProps) {
				updateObj.coverage = coverage;
			}

			// Handle scale type changes
			if ('scaleType' in changedProps) {
				updateObj.colorScaleType = scaleType;
			}

			// Apply the updates
			console.log('Updating H3 layer properties:', Object.keys(changedProps).join(', '));
			layers.updateProps(layer.id, updateObj);
		} catch (error) {
			console.error('Error updating H3 layer props:', error);
		}
	}
</script>

<Sectional label="Column Selection">
	<ColumnDropdown {dataset} bind:chosenColumn={h3Column} default_column="H3" placeholder="H3" />
	<ColumnDropdown
		{dataset}
		bind:chosenColumn={valueColumn}
		default_column="Value"
		placeholder="Column"
	/>
</Sectional>

<Sectional label="Color Settings">
	<select
		class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
		bind:value={colorScale}
	>
		{#each colorScales as scale}
			<option value={scale}>{scale}</option>
		{/each}
	</select>

	<select
		class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
		bind:value={scaleType}
	>
		{#each scaleTypes as type}
			<option value={type}>{type}</option>
		{/each}
	</select>
</Sectional>

<Sectional label="Display Settings">
	<input type="range" min="0.1" max="1" step="0.05" bind:value={opacity} class="w-full" />
	<div class="flex justify-between text-xs text-gray-500">
		<span>Transparent</span>
		<span>Solid</span>
	</div>

	<input type="range" min="0.5" max="1" step="0.05" bind:value={coverage} class="w-full" />
	<div class="flex justify-between text-xs text-gray-500">
		<span>Small</span>
		<span>Full</span>
	</div>
</Sectional>

<Sectional label="3D Settings">
	<input
		type="checkbox"
		bind:checked={extruded}
		class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
	/>
	<span class="ml-2 text-sm text-gray-700">Show 3D Extrusion</span>

	{#if extruded}
		<div class="mt-3">
			<input type="range" min="1" max="100" step="1" bind:value={elevationScale} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Low</span>
				<span>High</span>
			</div>
		</div>
	{/if}

	<div class="mt-3">
		<input
			type="checkbox"
			bind:checked={wireframe}
			class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
		/>
		<span class="ml-2 text-sm text-gray-700">Show Wireframe</span>
	</div>
</Sectional>

{#if !requiredColumnsSelected}
	<div class="mt-2 text-amber-500">Please select H3 index and value columns to display data.</div>
{/if}
