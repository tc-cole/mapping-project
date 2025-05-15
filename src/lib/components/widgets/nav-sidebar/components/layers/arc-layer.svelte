<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { layers } from '$lib/components/io/layer-io.svelte';
	import { chosenDataset } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

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

	// Used to store pre-calculated values for width and color ranges
	let widthRange = $state([0, 1]);
	let colorRange = $state([0, 1]);
	let dataLoaded = $state(false);
	let hasInitialized = $state(false);
	let currentLabelLayerId = $state<string | null>(null);

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(
		fromLatitude !== undefined &&
			fromLongitude !== undefined &&
			toLatitude !== undefined &&
			toLongitude !== undefined
	);

	// Derive the map layer configuration based on all input parameters
	$effect(() => {
		console.log('Effect checking required columns for Arc Layer:', {
			fromLat: fromLatitude,
			fromLng: fromLongitude,
			toLat: toLatitude,
			toLng: toLongitude
		});

		if (requiredColumnsSelected && !hasInitialized) {
			console.log('Initializing arc layer - all required columns selected');
			updateMapLayers();
			hasInitialized = true;
		}
	});

	// Enhanced transformer function for DuckDB query results
	async function* transformRows(rows: AsyncIterable<any[]>): AsyncGenerator<any[], void, unknown> {
		console.log('==================== ARC TRANSFORM START ====================');
		console.log('Starting arc transformRows with columns:', {
			fromLat: fromLatitude,
			fromLng: fromLongitude,
			toLat: toLatitude,
			toLng: toLongitude,
			width: widthColumn,
			color: colorColumn,
			label: labelColumn
		});

		// Start with empty collections
		let allArcs: any[] = [];
		let widthValues: number[] = [];
		let colorValues: number[] = [];
		let batchCount = 0;
		let totalRowsProcessed = 0;
		let totalValidArcs = 0;
		let invalidSourceCoordinates = 0;
		let invalidTargetCoordinates = 0;
		let nullCoordinates = 0;

		try {
			// First yield an empty array to initialize the layer
			console.log('Yielding initial empty array');
			yield [];

			// Process batches from DuckDB
			for await (const batch of rows) {
				batchCount++;
				console.log(`\n----- ARC BATCH ${batchCount} -----`);
				console.log(`Received batch with ${batch.length} rows`);
				totalRowsProcessed += batch.length;

				// Log the first row of each batch to see the raw format
				if (batch.length > 0) {
					console.log('First row in batch (raw):', JSON.stringify(batch[0], null, 2));
					console.log(
						`Source coordinates in first row: fromLat=${batch[0][fromLatitude!]}, fromLng=${batch[0][fromLongitude!]}`
					);
					console.log(
						`Target coordinates in first row: toLat=${batch[0][toLatitude!]}, toLng=${batch[0][toLongitude!]}`
					);
				} else {
					console.log('Batch is empty');
				}

				// Process each row in the batch
				const validArcsBatch = [];

				for (const row of batch) {
					// Skip rows with missing coordinates
					if (!row) {
						console.log('Skipping undefined/null row');
						continue;
					}

					// Check for null/undefined source coordinates
					if (
						row[fromLatitude!] === null ||
						row[fromLatitude!] === undefined ||
						row[fromLongitude!] === null ||
						row[fromLongitude!] === undefined
					) {
						nullCoordinates++;
						if (nullCoordinates <= 5) {
							console.log(
								'Skipping row with null/undefined source coordinates:',
								JSON.stringify(row, null, 2)
							);
						}
						continue;
					}

					// Check for null/undefined target coordinates
					if (
						row[toLatitude!] === null ||
						row[toLatitude!] === undefined ||
						row[toLongitude!] === null ||
						row[toLongitude!] === undefined
					) {
						nullCoordinates++;
						if (nullCoordinates <= 5) {
							console.log(
								'Skipping row with null/undefined target coordinates:',
								JSON.stringify(row, null, 2)
							);
						}
						continue;
					}

					// Convert source coordinates to numbers explicitly
					const fromLong = Number(row[fromLongitude!]);
					const fromLat = Number(row[fromLatitude!]);

					// Skip if source coordinates couldn't be converted to valid numbers
					if (isNaN(fromLong) || isNaN(fromLat)) {
						invalidSourceCoordinates++;
						if (invalidSourceCoordinates <= 5) {
							console.log(
								`Skipping row with invalid source coordinates (NaN): fromLat=${row[fromLatitude!]}, fromLng=${row[fromLongitude!]}`
							);
						}
						continue;
					}

					// Convert target coordinates to numbers explicitly
					const toLong = Number(row[toLongitude!]);
					const toLat = Number(row[toLatitude!]);

					// Skip if target coordinates couldn't be converted to valid numbers
					if (isNaN(toLong) || isNaN(toLat)) {
						invalidTargetCoordinates++;
						if (invalidTargetCoordinates <= 5) {
							console.log(
								`Skipping row with invalid target coordinates (NaN): toLat=${row[toLatitude!]}, toLng=${row[toLongitude!]}`
							);
						}
						continue;
					}

					// Get the width value (with default)
					let widthValue = 1;
					if (widthColumn && row[widthColumn] !== null && row[widthColumn] !== undefined) {
						widthValue = Number(row[widthColumn]);
						if (!isNaN(widthValue)) {
							widthValues.push(widthValue);
						} else {
							widthValue = 1;
						}
					}

					// Get the color value
					let colorValue = null;
					if (colorColumn && row[colorColumn] !== null && row[colorColumn] !== undefined) {
						colorValue = Number(row[colorColumn]);
						if (!isNaN(colorValue)) {
							colorValues.push(colorValue);
						} else {
							colorValue = null;
						}
					}

					// Get the label value
					const labelValue =
						labelColumn && row[labelColumn] !== null && row[labelColumn] !== undefined
							? String(row[labelColumn])
							: null;

					// Create arc with properly formatted values
					const arc = {
						sourcePosition: [fromLong, fromLat],
						targetPosition: [toLong, toLat],
						width: widthValue,
						color: colorValue,
						label: labelValue
					};

					validArcsBatch.push(arc);
				}

				// Log batch summary
				totalValidArcs += validArcsBatch.length;
				console.log(
					`Batch ${batchCount} results: ${validArcsBatch.length} valid arcs from ${batch.length} rows`
				);

				// Sample the transformed arcs
				if (validArcsBatch.length > 0) {
					console.log(
						'First valid arc in batch (transformed):',
						JSON.stringify(validArcsBatch[0], null, 2)
					);

					if (validArcsBatch.length > 1) {
						console.log(
							'Last valid arc in batch (transformed):',
							JSON.stringify(validArcsBatch[validArcsBatch.length - 1], null, 2)
						);
					}
				}

				// Add valid arcs to our accumulated collection
				allArcs = [...allArcs, ...validArcsBatch];

				// Calculate ranges from the first batch for consistent visualization
				if (batchCount === 1 && validArcsBatch.length > 0) {
					// Calculate width range if we have width values
					if (widthValues.length > 0) {
						const min = Math.min(...widthValues);
						const max = Math.max(...widthValues);
						widthRange = [min, max];
						console.log('Width range calculated:', widthRange);
					}

					// Calculate color range if we have color values
					if (colorValues.length > 0) {
						const min = Math.min(...colorValues);
						const max = Math.max(...colorValues);
						colorRange = [min, max];
						console.log('Color range calculated:', colorRange);
					}

					dataLoaded = true;
				}

				// Log the current arc count
				console.log(`TOTAL: ${allArcs.length} valid arcs so far after ${batchCount} batches`);

				// Show a sample of current accumulated arcs
				if (allArcs.length > 0) {
					console.log('Sample of accumulated arcs:');
					console.log(' - First arc:', JSON.stringify(allArcs[0], null, 2));
					if (allArcs.length > 1) {
						const middleIndex = Math.floor(allArcs.length / 2);
						console.log(
							` - Middle arc (${middleIndex}):`,
							JSON.stringify(allArcs[middleIndex], null, 2)
						);
					}
					if (allArcs.length > 2) {
						console.log(
							` - Last arc (${allArcs.length - 1}):`,
							JSON.stringify(allArcs[allArcs.length - 1], null, 2)
						);
					}
				}

				// Yield the complete accumulated array
				console.log(`Yielding array with ${allArcs.length} total arcs`);
				yield allArcs;
			}

			// Final yield if we didn't yield any arcs yet
			if (allArcs.length === 0) {
				console.log('WARNING: No valid arcs found in any batch');
				yield [];
			}

			// Log final statistics
			console.log('\n========== ARC TRANSFORM SUMMARY ==========');
			console.log(`Total batches processed: ${batchCount}`);
			console.log(`Total rows processed: ${totalRowsProcessed}`);
			console.log(`Total valid arcs: ${totalValidArcs}`);
			console.log(`Invalid source coordinates: ${invalidSourceCoordinates}`);
			console.log(`Invalid target coordinates: ${invalidTargetCoordinates}`);
			console.log(`Null/undefined coordinates: ${nullCoordinates}`);
			console.log(`Final arc array size: ${allArcs.length}`);
			console.log('==================== ARC TRANSFORM END ====================');
		} catch (error: any) {
			console.error('ERROR in arc transformRows:', error);
			console.error('Error stack:', error.stack);
			// In case of error, yield any arcs we've collected so far
			if (allArcs.length > 0) {
				console.log(`Error occurred, but yielding ${allArcs.length} collected arcs`);
				yield allArcs;
			} else {
				console.log('Error occurred and no valid arcs collected, yielding empty array');
				yield [];
			}
		}
	}

	// Dynamic arc width calculation
	function getArcWidth(arc: any): number {
		// If no width column specified or arc has no width, use fixed width
		if (!widthColumn || arc.width === null || arc.width === undefined || isNaN(arc.width)) {
			return arcWidth;
		}

		// Calculate normalized width based on the data range
		const widthMin = widthRange[0];
		const widthMax = widthRange[1];

		// Handle edge case where min and max are the same
		if (widthMin === widthMax) {
			return arcWidth;
		}

		// Normalize the width value to 0-1 range
		const normalizedWidth = (arc.width - widthMin) / (widthMax - widthMin);

		// Map the normalized value to the width range
		return minArcWidth + normalizedWidth * (maxArcWidth - minArcWidth);
	}

	// Dynamic color calculation based on color values
	function getArcColor(arc: any): number[] {
		// Default color if no color column or value
		if (!colorColumn || arc.color === null || arc.color === undefined || isNaN(arc.color)) {
			return [0, 128, 255, Math.floor(opacity * 255)]; // Default blue
		}

		// Get color based on colorScale
		const colorMin = colorRange[0];
		const colorMax = colorRange[1];

		// Handle case where all values are the same
		if (colorMin === colorMax) {
			return [0, 128, 255, Math.floor(opacity * 255)];
		}

		// Normalize value to 0-1 range
		const normalizedValue = (arc.color - colorMin) / (colorMax - colorMin);

		// Color mapping based on the selected color scale
		let r, g, b;

		switch (colorScale) {
			case 'viridis':
				// Simple approximation of viridis
				r = Math.floor((1 - normalizedValue) * 68);
				g = Math.floor(
					normalizedValue < 0.5 ? 85 + normalizedValue * 170 : 255 - (normalizedValue - 0.5) * 170
				);
				b = Math.floor(normalizedValue * 150 + 100);
				break;
			case 'plasma':
				// Simple approximation of plasma
				r = Math.floor(normalizedValue * 200 + 50);
				g = Math.floor(
					normalizedValue < 0.5 ? normalizedValue * 170 : 85 - (normalizedValue - 0.5) * 170
				);
				b = Math.floor((1 - normalizedValue) * 150 + 100);
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
				// Default blue to red gradient
				r = Math.floor(normalizedValue * 255);
				g = 64;
				b = Math.floor((1 - normalizedValue) * 255);
		}

		return [r, g, b, Math.floor(opacity * 255)];
	}

	// Enhanced load data function with better error handling and logging
	async function* loadData(): AsyncGenerator<any[], void, unknown> {
		try {
			console.log('==================== ARC LOAD DATA START ====================');
			// Initial empty dataset
			console.log('Yielding initial empty array from loadData');
			yield [];

			// Get database instance
			console.log('Getting database instance for arc layer');
			const db = SingletonDatabase.getInstance();
			const client = await db.init();
			console.log('Database client initialized for arc layer');

			if ($chosenDataset !== null) {
				console.log('Processing dataset for arc layer:', $chosenDataset);
				var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);
				console.log('Cleaned filename:', filename);

				// Build column list for query
				const columns = [fromLatitude, fromLongitude, toLatitude, toLongitude];
				if (widthColumn) columns.push(widthColumn);
				if (colorColumn) columns.push(colorColumn);
				if (labelColumn) columns.push(labelColumn);

				const columnsStr = columns.join(', ');
				console.log('Arc layer query columns:', columnsStr);

				// Main query with all data
				console.log(`Executing arc layer stream query: SELECT ${columnsStr} FROM ${filename}`);

				try {
					const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
					console.log('Arc layer stream query executed successfully');
					console.log('Arc layer stream object:', stream);
					console.log('Arc layer stream schema:', stream.schema);

					// Log the schema details
					if (stream.schema) {
						console.log('Column details from schema for arc layer:');
						stream.schema.forEach((field) => {
							console.log(
								` - ${field.name}: ${field.type} (${field.databaseType}) ${field.nullable ? 'nullable' : 'not nullable'}`
							);
						});
					}

					// Transform the rows and yield the results
					console.log('Starting arc data transformation...');
					const readRowsGenerator = stream.readRows();
					yield* transformRows(readRowsGenerator);
				} catch (streamError: any) {
					console.error('Error in arc layer stream query:', streamError);
					console.error('Stream error stack:', streamError.stack);
					yield [];
				}
			} else {
				console.log('No dataset chosen for arc layer');
				yield [];
			}
			console.log('==================== ARC LOAD DATA END ====================');
		} catch (error: any) {
			console.error('Error in arc loadData:', error);
			console.error('Error stack:', error.stack);
			// Return empty array in case of error
			yield [];
		}
	}

	// Enhanced update map layers function with better error handling and logging
	function updateMapLayers(): void {
		console.log('==================== UPDATE ARC LAYERS ====================');
		console.log('Arc layer columns selected:', {
			fromLat: fromLatitude,
			fromLng: fromLongitude,
			toLat: toLatitude,
			toLng: toLongitude,
			width: widthColumn,
			color: colorColumn,
			label: labelColumn
		});

		try {
			// Update main arc layer
			console.log(`Updating main arc layer with ID: ${layer.id}`);
			layers.updateProps(layer.id, {
				data: loadData(),
				getSourcePosition: (d: any) => {
					// Add validation for source position
					if (!d || !d.sourcePosition || d.sourcePosition.length !== 2) {
						console.warn('Invalid arc source position:', d);
						return [0, 0]; // Default to prevent errors
					}
					return d.sourcePosition;
				},
				getTargetPosition: (d: any) => {
					// Add validation for target position
					if (!d || !d.targetPosition || d.targetPosition.length !== 2) {
						console.warn('Invalid arc target position:', d);
						return [0, 0]; // Default to prevent errors
					}
					return d.targetPosition;
				},
				getWidth: (d: any) => {
					const width = getArcWidth(d);
					// Periodically log width calculations
					if (Math.random() < 0.001) {
						// Log roughly 0.1% of arcs
						console.log(`Width calculation for arc:`, {
							width: d.width,
							calculatedWidth: width,
							widthRange
						});
					}
					return width;
				},
				getSourceColor: [0, 64, 128],
				getTargetColor: [255, 128, 0],
				getColor: (d: any) => {
					const color = getArcColor(d);
					// Periodically log color calculations
					if (Math.random() < 0.001) {
						// Log roughly 0.1% of arcs
						console.log(`Color calculation for arc:`, {
							colorValue: d.color,
							calculatedColor: color,
							colorRange,
							colorScale
						});
					}
					return color;
				},
				widthScale: 1,
				widthMinPixels: 1,
				widthMaxPixels: 20,
				opacity: opacity,
				pickable: true,
				autoHighlight: true,
				getHeight: (d: any) => {
					// Validate inputs
					if (!d || !d.sourcePosition || !d.targetPosition) {
						return 0;
					}

					// Calculate distance in degrees as a simple proxy for arc height
					const sourceLng = d.sourcePosition[0];
					const sourceLat = d.sourcePosition[1];
					const targetLng = d.targetPosition[0];
					const targetLat = d.targetPosition[1];

					// Simple Euclidean distance as a baseline
					const distance = Math.sqrt(
						Math.pow(targetLng - sourceLng, 2) + Math.pow(targetLat - sourceLat, 2)
					);

					const height = distance * arcHeight * arcHeightMultiplier;

					// Occasionally log height calculations
					if (Math.random() < 0.001) {
						console.log(`Arc height calculation:`, {
							sourcePosition: [sourceLng, sourceLat],
							targetPosition: [targetLng, targetLat],
							distance,
							arcHeight,
							arcHeightMultiplier,
							calculatedHeight: height
						});
					}

					return height;
				},
				colorScale: colorScale,
				updateTriggers: {
					getWidth: [arcWidth, widthColumn, minArcWidth, maxArcWidth, widthRange],
					getColor: [colorColumn, colorScale, colorRange, opacity],
					getHeight: [arcHeight, arcHeightMultiplier]
				},
				// Add callbacks for visibility debugging
				onDataLoad: (info: any) => {
					console.log('Arc layer data loaded:', info);
				},
				onHover: (info: any) => {
					if (info && info.object) {
						// Don't log every hover to avoid console spam
						if (Math.random() < 0.1) {
							// Only log ~10% of hovers
							console.log('Arc hover info:', {
								sourcePosition: info.object.sourcePosition,
								targetPosition: info.object.targetPosition,
								width: info.object.width,
								color: info.object.color,
								label: info.object.label,
								x: info.x,
								y: info.y
							});
						}
					}
				}
			});
			console.log(`Arc layer updated successfully`);

			// Create or update label layer
			const labelLayerId = `${layer.id}-labels`;
			console.log(`Updating label layer with ID: ${labelLayerId}`);

			try {
				// Check if the label layer exists by attempting to update it
				layers.updateProps(labelLayerId, {
					data: loadData(),
					getPosition: (d: any) => {
						// Position label at the midpoint of the arc
						if (!d || !d.sourcePosition || !d.targetPosition) {
							console.warn('Invalid arc for label positioning:', d);
							return [0, 0];
						}

						const sourceLng = d.sourcePosition[0];
						const sourceLat = d.sourcePosition[1];
						const targetLng = d.targetPosition[0];
						const targetLat = d.targetPosition[1];

						return [(sourceLng + targetLng) / 2, (sourceLat + targetLat) / 2];
					},
					getText: (d: any) => {
						const text = d && d.label ? d.label.toString() : '';
						// Occasionally log label text
						if (text && Math.random() < 0.01) {
							console.log(`Label for arc: "${text}"`);
						}
						return text;
					},
					getSize: 12,
					getAngle: 0,
					getTextAnchor: 'middle',
					getAlignmentBaseline: 'center',
					fontFamily: 'Arial',
					fontWeight: 'bold',
					outlineWidth: 2,
					outlineColor: [255, 255, 255],
					visible: showLabels && labelColumn !== null
				});
				console.log(`Label layer updated successfully`);
			} catch (labelError: any) {
				// If updating fails, the layer might not exist yet, so create it
				console.log(`Label layer doesn't exist yet. Creating it...`);
				// Here you would add code to create the label layer
				// This depends on how your LayerFactory is set up
			}

			console.log('==================== ARC LAYER UPDATE COMPLETE ====================');
		} catch (error: any) {
			console.error('Error updating arc layers:', error);
			console.error('Error stack:', error.stack);
		}
	}

	// Re-run updateMapLayers when parameters change after initialization
	$effect(() => {
		if (hasInitialized && requiredColumnsSelected) {
			console.log('Updating arc layers due to parameter change');
			updateMapLayers();
		}
	});
</script>

<Sectional label="Required Coordinates">
	<ColumnDropdown bind:chosenColumn={fromLatitude} default_column="Starting Latitude" />
	<ColumnDropdown bind:chosenColumn={fromLongitude} default_column="Starting Longitude" />
	<ColumnDropdown bind:chosenColumn={toLatitude} default_column="Destination Latitude" />
	<ColumnDropdown bind:chosenColumn={toLongitude} default_column="Destination Longitude" />
</Sectional>

<Sectional label="Optional Columns">
	<ColumnDropdown bind:chosenColumn={widthColumn} default_column="Width" />
	<ColumnDropdown bind:chosenColumn={colorColumn} default_column="Color" />
	<ColumnDropdown bind:chosenColumn={labelColumn} default_column="Label" />
</Sectional>

<Sectional label="Color Settings">
	{#if colorColumn}
		<select
			class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
			bind:value={colorScale}
		>
			{#each colorScales as scale}
				<option value={scale}>{scale}</option>
			{/each}
		</select>
	{/if}
</Sectional>

<Sectional label="Arc Style">
	<div class="grid grid-cols-2 gap-4">
		<div>
			<input type="range" min="1" max="10" step="0.5" bind:value={arcWidth} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Thin</span>
				<span>Thick</span>
			</div>
		</div>
		<div>
			<input type="range" min="0.1" max="1" step="0.05" bind:value={opacity} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Transparent</span>
				<span>Solid</span>
			</div>
		</div>
	</div>
</Sectional>

<Sectional label="Arc Height">
	<div class="grid grid-cols-2 gap-4">
		<div>
			<input type="range" min="0" max="5" step="0.1" bind:value={arcHeight} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Flat</span>
				<span>Curved</span>
			</div>
		</div>
		<div>
			<input
				type="range"
				min="0.1"
				max="5"
				step="0.1"
				bind:value={arcHeightMultiplier}
				class="w-full"
			/>
			<div class="flex justify-between text-xs text-gray-500">
				<span>Low</span>
				<span>High</span>
			</div>
		</div>
	</div>
</Sectional>

<Sectional label="Width Range">
	{#if widthColumn}
		<div class="grid grid-cols-2 gap-4">
			<div>
				<input type="range" min="0.5" max="5" step="0.5" bind:value={minArcWidth} class="w-full" />
			</div>
			<div>
				<input type="range" min="5" max="50" step="1" bind:value={maxArcWidth} class="w-full" />
			</div>
		</div>
	{/if}
</Sectional>

<Sectional label="Label Settings">
	{#if labelColumn}
		<div class="flex items-center">
			<input
				type="checkbox"
				bind:checked={showLabels}
				class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
			/>
			<span class="ml-2 text-sm text-gray-700">Show Labels</span>
		</div>
	{/if}
</Sectional>

{#if !requiredColumnsSelected}
	<div class="mt-2 text-amber-500">
		Please select source and destination coordinates to display arcs.
	</div>
{/if}
