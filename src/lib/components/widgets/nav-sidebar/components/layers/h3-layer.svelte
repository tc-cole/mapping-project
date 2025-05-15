<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { LayerFactory } from '$lib/components/io/layer-management.svelte';
	import { chosenDataset, layers } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

	let h3Column = $state<string | undefined>();
	let valueColumn = $state<string | undefined>();
	let colorScale = $state<string>('viridis');
	let opacity = $state<number>(0.8);
	let elevationScale = $state<number>(10);
	let extruded = $state<boolean>(false);
	let wireframe = $state<boolean>(true);
	let coverage = $state<number>(1.0);
	let hasInitialized = $state(false);
	let dataLoaded = $state(false);
	let valueRange = $state<[number, number]>([0, 1]);
	let currentLayerId = $state<string | null>(null); // Track the current layer ID

	let { layer } = $props();

	// Available color scales (matching the scatter plot for consistency)
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
	let scaleType = $state<string>('linear');

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(h3Column !== undefined && valueColumn !== undefined);

	// Effect to update map when configuration changes
	$effect(() => {
		console.log('Effect checking required columns for H3 Layer:', {
			h3Column,
			valueColumn
		});

		if (requiredColumnsSelected && !hasInitialized) {
			console.log('Initializing H3 layer - all required columns selected');
			updateMapLayers();
			hasInitialized = true;
		}
	});

	// Update effect whenever key parameters change
	$effect(() => {
		if (hasInitialized) {
			console.log('Updating H3 layer due to parameter change');
			updateMapLayers();
		}
	});

	// Enhanced H3 data transformer with comprehensive debugging
	async function* transformRows(rows: AsyncIterable<any[]>) {
		console.log('==================== H3 TRANSFORM START ====================');
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
			// First yield an empty array to initialize
			console.log('Yielding initial empty array');
			yield [];

			// Process batches from DuckDB
			for await (const batch of rows) {
				batchCount++;
				console.log(`\n----- H3 BATCH ${batchCount} -----`);
				console.log(`Received batch with ${batch.length} rows`);
				totalRowsProcessed += batch.length;

				// Log the first row of each batch to see the raw format
				if (batch.length > 0) {
					console.log('First row in batch (raw):', batch[0]);
				} else {
					console.log('Batch is empty');
				}

				// Process each row in the batch
				const validHexagons = [];

				for (const row of batch) {
					// Skip rows with missing data
					if (!row) {
						console.log('Skipping undefined/null row');
						continue;
					}

					// Check for null/undefined H3 index
					//@ts-expect-error
					if (row[h3Column] === null || row[h3Column] === undefined) {
						nullH3Count++;
						if (nullH3Count <= 5) {
							console.log('Skipping row with null/undefined H3 index:', row);
						}
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
							if (nullValueCount <= 5) {
								console.log('Skipping row with null/undefined value:', row);
							}
						} else {
							invalidValueCount++;
							if (invalidValueCount <= 5) {
								//@ts-expect-error
								console.log(`Skipping row with NaN value: ${row[valueColumn]}`, row);
							}
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
						if (invalidH3Count <= 5) {
							console.log(`Skipping row with invalid H3 index format: ${h3Index}`, row);
						}
						continue;
					}

					// Convert value to number
					//@ts-expect-error
					const value = Number(row[valueColumn]);

					// Create hexagon object
					const hexagon = {
						hex: h3Index,
						value: value
					};

					// Collect values for range calculation
					values.push(value);
					validHexagons.push(hexagon);
					validHexagonCount++;

					// Occasionally log sample hexagons
					if (validHexagonCount <= 5 || validHexagonCount % 10000 === 0) {
						console.log(`Processed hexagon: H3=${h3Index}, value=${value}`);
					}
				}

				// Log batch summary
				console.log(
					`Batch ${batchCount} results: ${validHexagons.length} valid hexagons from ${batch.length} rows`
				);

				// Add batch hexagons to accumulated collection
				allHexagons = [...allHexagons, ...validHexagons];

				// Calculate value range from the first batch with valid values
				if (!dataLoaded && values.length > 0) {
					const min = Math.min(...values);
					const max = Math.max(...values);
					valueRange = [min, max];
					console.log('Value range calculated:', valueRange);

					// Basic statistics
					const sum = values.reduce((acc, val) => acc + val, 0);
					const avg = sum / values.length;
					const sortedValues = [...values].sort((a, b) => a - b);
					const median = sortedValues[Math.floor(sortedValues.length / 2)];

					console.log('Value statistics:', {
						min,
						max,
						avg,
						median,
						count: values.length
					});

					dataLoaded = true;
				}

				// Log the total hexagons processed so far
				console.log(
					`TOTAL: ${allHexagons.length} valid hexagons so far after ${batchCount} batches`
				);

				// Show a sample of hexagons
				if (allHexagons.length > 0) {
					console.log('Sample of accumulated hexagons:');
					console.log(' - First hexagon:', allHexagons[0]);
					if (allHexagons.length > 1) {
						const middleIndex = Math.floor(allHexagons.length / 2);
						console.log(` - Middle hexagon (${middleIndex}):`, allHexagons[middleIndex]);
					}
					if (allHexagons.length > 2) {
						console.log(
							` - Last hexagon (${allHexagons.length - 1}):`,
							allHexagons[allHexagons.length - 1]
						);
					}
				}

				// Yield the accumulated hexagons
				console.log(`Yielding array with ${allHexagons.length} total hexagons`);
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

			// Log final statistics
			console.log('\n========== H3 TRANSFORM SUMMARY ==========');
			console.log(`Total batches processed: ${batchCount}`);
			console.log(`Total rows processed: ${totalRowsProcessed}`);
			console.log(`Valid hexagons: ${validHexagonCount}`);
			console.log(`Invalid data counts:`);
			console.log(` - Null/undefined H3 indices: ${nullH3Count}`);
			console.log(` - Invalid H3 format: ${invalidH3Count}`);
			console.log(` - Null/undefined values: ${nullValueCount}`);
			console.log(` - Invalid (NaN) values: ${invalidValueCount}`);
			console.log(`Value range: [${valueRange[0]}, ${valueRange[1]}]`);
			console.log('==================== H3 TRANSFORM END ====================');
		} catch (error) {
			console.error('ERROR in H3 transformRows:', error); //@ts-expect-error
			console.error('Error stack:', error.stack);

			// In case of error, yield what we have so far
			if (allHexagons.length > 0) {
				console.log(`Error occurred, but yielding ${allHexagons.length} hexagons collected so far`);
				yield allHexagons;
			} else {
				console.log('Error occurred and no hexagons collected, yielding empty array');
				yield [];
			}
		}
	}

	// Enhanced loadData function with better error handling and logging
	async function* loadData() {
		try {
			console.log('==================== H3 LOAD DATA START ====================');
			// Initial empty dataset
			console.log('Yielding initial empty array from loadData');
			yield [];

			// Get database instance
			console.log('Getting database instance for H3 layer');
			const db = SingletonDatabase.getInstance();
			const client = await db.init();
			console.log('Database client initialized for H3 layer');

			if ($chosenDataset !== null) {
				console.log('Processing dataset for H3 layer:', $chosenDataset);
				var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);
				console.log('Cleaned filename:', filename);

				// Main query with H3 and value columns
				const query = `SELECT ${h3Column}, ${valueColumn} FROM ${filename}`;
				console.log(`Executing H3 layer query: ${query}`);

				try {
					const stream = await client.queryStream(query);
					console.log('H3 layer stream query executed successfully');
					console.log('H3 layer stream schema:', stream.schema);

					// Log the schema details
					if (stream.schema) {
						console.log('Column details from schema for H3 layer:');
						stream.schema.forEach((field) => {
							console.log(
								` - ${field.name}: ${field.type} (${field.databaseType}) ${field.nullable ? 'nullable' : 'not nullable'}`
							);
						});
					}

					// Transform the rows and yield the results
					console.log('Starting H3 data transformation...');
					const readRowsGenerator = stream.readRows();
					yield* transformRows(readRowsGenerator);
				} catch (streamError) {
					console.error('Error in H3 layer stream query:', streamError); //@ts-expect-error
					console.error('Stream error stack:', streamError.stack);
					yield [];
				}
			} else {
				console.log('No dataset chosen for H3 layer');
				yield [];
			}
			console.log('==================== H3 LOAD DATA END ====================');
		} catch (error) {
			console.error('Error in H3 loadData:', error); //@ts-expect-error
			console.error('Error stack:', error.stack);
			// Return empty array in case of error
			yield [];
		}
	}

	// Updated update map layers function to use the add/remove pattern
	function updateMapLayers() {
		console.log('==================== UPDATE H3 LAYER ====================');
		console.log('H3 layer columns selected:', {
			h3: h3Column,
			value: valueColumn
		});
		console.log('H3 layer style settings:', {
			colorScale,
			scaleType,
			opacity,
			coverage,
			extruded,
			elevationScale,
			wireframe,
			valueRange
		});

		try {
			// Remove existing layer if it exists
			if (currentLayerId) {
				console.log(`Removing previous H3 layer with ID: ${currentLayerId}`);
				layers.remove(currentLayerId);
				currentLayerId = null;
			} else {
				console.log(`Initial layer creation, no previous layer to remove`);
			}

			// Create a new H3 layer using LayerFactory
			console.log(`Creating new H3 layer`);

			const newLayer = LayerFactory.create('h3', {
				props: {
					data: loadData(),
					getHexagon: (d: any) => {
						// Validate hexagon
						if (!d || !d.hex) {
							console.warn('Invalid hexagon data:', d);
							return '0'; // Return a default H3 index
						}
						// Occasionally log hexagon indices
						if (Math.random() < 0.001) {
							// Log ~0.1% of hexagons
							console.log(`H3 index: ${d.hex}`);
						}
						return d.hex;
					},
					getFillColor: (d: any) => {
						// This will be handled by the layer's color mapping based on getColorValue
						return [255, 140, 0, Math.floor(opacity * 255)];
					},
					getElevation: (d: any) => {
						if (!extruded) return 0;

						const value = d.value || 0;
						// Occasionally log elevation values
						if (Math.random() < 0.001) {
							// Log ~0.1% of hexagons
							console.log(`H3 elevation value: ${value}, scaled: ${value * elevationScale}`);
						}
						return value;
					},
					getColorValue: (d: any) => {
						const value = d.value;
						// Occasionally log color values
						if (Math.random() < 0.001) {
							// Log ~0.1% of hexagons
							console.log(`H3 color value: ${value}, range: [${valueRange[0]}, ${valueRange[1]}]`);
						}
						return value;
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
					// Add callbacks for visibility debugging
					onDataLoad: (info: any) => {
						console.log('H3 layer data loaded:', {
							hexagonCount: Array.isArray(info?.data) ? info.data.length : 0,
							sampleHexagon: Array.isArray(info?.data) && info.data.length > 0 ? info.data[0] : null
						});
					},
					onHover: (info: any) => {
						if (info && info.object) {
							// Don't log every hover to avoid console spam
							if (Math.random() < 0.1) {
								// Only log ~10% of hovers
								console.log('H3 hover info:', {
									hex: info.object.hex,
									value: info.object.value,
									x: info.x,
									y: info.y
								});
							}
						}
					}
				}
			});

			// Store the new layer ID for future updates
			currentLayerId = newLayer.id;

			// Add the new layer to the map
			console.log(`Adding new H3 layer with ID: ${newLayer.id}`);
			layers.add(newLayer);

			console.log(`H3 layer updated successfully using add/remove pattern`);
			console.log('==================== H3 UPDATE COMPLETE ====================');
		} catch (error) {
			console.error('Error updating H3 layer:', error); //@ts-expect-error
			console.error('Error stack:', error.stack);
		}
	}
</script>

<Sectional label="Column Selection">
	<ColumnDropdown bind:chosenColumn={h3Column} default_column="H3" />
	<ColumnDropdown bind:chosenColumn={valueColumn} default_column="Value" />
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
