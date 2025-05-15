<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { LayerFactory } from '$lib/components/io/layer-management.svelte';
	import { chosenDataset, layers } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

	let polygonColumn = $state<string | undefined>();
	let idColumn = $state<string | undefined>();
	let colorColumn = $state<string | null>(null);
	let labelColumn = $state<string | null>(null);

	// Styling options
	let fillOpacity = $state<number>(0.7);
	let lineWidth = $state<number>(1);
	let colorScale = $state<string>('viridis');
	let showLabels = $state<boolean>(false);
	let defaultColor = $state<[number, number, number]>([140, 170, 180]); // Default teal color
	let currentLabelLayerId = $state<string | null>(null);

	// Available color scales for choropleth mapping
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

	// Used to store pre-calculated values for color ranges
	let colorRange = $state<[number, number]>([0, 1]);
	let dataLoaded = $state(false);
	let hasInitialized = $state(false);

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(polygonColumn !== undefined && idColumn !== undefined);

	// Derive the map layer configuration based on all input parameters
	$effect(() => {
		console.log('Effect checking required columns for Polygon Layer:', {
			polygonColumn,
			idColumn
		});

		if (requiredColumnsSelected && !hasInitialized) {
			console.log('Initializing polygon layer - all required columns selected');
			updateMapLayers();
			hasInitialized = true;
		}
	});

	// Also update when parameters change
	$effect(() => {
		if (hasInitialized && requiredColumnsSelected) {
			console.log('Updating polygon layer due to parameter change');
			updateMapLayers();
		}
	});

	// Enhanced polygon transformer function with comprehensive debugging
	async function* transformRows(rows: AsyncIterable<any[]>) {
		console.log('==================== POLYGON TRANSFORM START ====================');
		console.log('Starting polygon transformRows with columns:', {
			polygon: polygonColumn,
			id: idColumn,
			color: colorColumn,
			label: labelColumn
		});

		// Stats tracking
		let allPolygons: any[] = [];
		let colorValues = [];
		let batchCount = 0;
		let totalRowsProcessed = 0;
		let validPolygonCount = 0;
		let invalidPolygonCount = 0;
		let nullPolygonCount = 0;
		let nullIdCount = 0;
		let parseErrorCount = 0;
		let polygonTypeCount = 0;
		let multiPolygonTypeCount = 0;
		let otherGeometryTypeCount = 0;

		try {
			// First yield an empty array to initialize
			console.log('Yielding initial empty array');
			yield [];

			// Process batches from DuckDB
			for await (const batch of rows) {
				batchCount++;
				console.log(`\n----- POLYGON BATCH ${batchCount} -----`);
				console.log(`Received batch with ${batch.length} rows`);
				totalRowsProcessed += batch.length;

				// Log the first row of each batch to see the raw format
				if (batch.length > 0) {
					console.log('First row in batch (raw):', JSON.stringify(batch[0], null, 2));

					if (colorColumn) {
						console.log(`Color column in first row: ${batch[0][colorColumn]}`);
					}
					if (labelColumn) {
						console.log(`Label column in first row: ${batch[0][labelColumn]}`);
					}
				} else {
					console.log('Batch is empty');
				}

				// Process each row in the batch
				const validPolygons = [];

				for (const row of batch) {
					// Skip rows with missing data
					if (!row) {
						console.log('Skipping undefined/null row');
						continue;
					}

					// Check for null/undefined polygon
					//@ts-expect-error
					if (row[polygonColumn] === null || row[polygonColumn] === undefined) {
						nullPolygonCount++;
						if (nullPolygonCount <= 5) {
							console.log(
								'Skipping row with null/undefined polygon:',
								JSON.stringify(row, null, 2)
							);
						}
						continue;
					}

					// Check for null/undefined ID
					//@ts-expect-error
					if (row[idColumn] === null || row[idColumn] === undefined) {
						nullIdCount++;
						if (nullIdCount <= 5) {
							console.log('Skipping row with null/undefined ID:', JSON.stringify(row, null, 2));
						}
						continue;
					}

					// Parse the GeoJSON/WKT polygon from the selected column
					let polygonData;
					try {
						// Check if the polygon data is in GeoJSON format as a string
						//@ts-expect-error
						if (typeof row[polygonColumn] === 'string') {
							// Try to parse as JSON
							if (
								//@ts-expect-error
								row[polygonColumn].includes('coordinates') ||
								//@ts-expect-error
								row[polygonColumn].includes('geometry') ||
								//@ts-expect-error
								row[polygonColumn].includes('type')
							) {
								try {
									//@ts-expect-error
									polygonData = JSON.parse(row[polygonColumn]);
									//@ts-expect-error
									console.log(`Successfully parsed polygon data as JSON for ID ${row[idColumn]}`);
								} catch (parseError) {
									parseErrorCount++;
									if (parseErrorCount <= 5) {
										console.error(
											//@ts-expect-error
											`Failed to parse polygon string as JSON for ID ${row[idColumn]}:`,
											parseError
										);
										console.log(
											//@ts-expect-error
											`Invalid polygon string (first 200 chars): ${row[polygonColumn].substring(0, 200)}`
										);
									}
									continue;
								}
							} else {
								// If doesn't look like JSON, could be WKT or other format
								console.warn(
									//@ts-expect-error
									`Polygon data for ID ${row[idColumn]} is a string but doesn't appear to be JSON, skipping:`,
									//@ts-expect-error
									row[polygonColumn].substring(0, 100)
								);
								invalidPolygonCount++;
								continue;
							}
						} else {
							// Assume it's already a valid object
							//@ts-expect-error
							polygonData = row[polygonColumn];
						}

						// Basic validation of polygon data
						if (!polygonData || typeof polygonData !== 'object') {
							invalidPolygonCount++;
							if (invalidPolygonCount <= 5) {
								console.error(
									//@ts-expect-error
									`Invalid polygon data for ID ${row[idColumn]}, not an object:`,
									polygonData
								);
							}
							continue;
						}

						// Count polygon types
						let polygonType = polygonData.type;

						// If it's a Feature, extract the geometry type
						if (polygonType === 'Feature' && polygonData.geometry) {
							polygonType = polygonData.geometry.type;
						}

						// Count by geometry type
						if (polygonType === 'Polygon') {
							polygonTypeCount++;
						} else if (polygonType === 'MultiPolygon') {
							multiPolygonTypeCount++;
						} else {
							otherGeometryTypeCount++;
							if (otherGeometryTypeCount <= 5) {
								//@ts-expect-error
								console.warn(`Unexpected geometry type for ID ${row[idColumn]}: ${polygonType}`);
							}
						}

						// Log some polygon structure examples for debugging
						if (validPolygonCount < 2) {
							if (polygonType === 'Polygon') {
								//@ts-expect-error
								console.log(`Polygon example (ID ${row[idColumn]}):`, {
									type: polygonType,
									rings: polygonData.coordinates ? polygonData.coordinates.length : 'unknown',
									firstRingPoints:
										polygonData.coordinates && polygonData.coordinates[0]
											? polygonData.coordinates[0].length
											: 'unknown'
								});
							} else if (polygonType === 'MultiPolygon') {
								//@ts-expect-error
								console.log(`MultiPolygon example (ID ${row[idColumn]}):`, {
									type: polygonType,
									polygons: polygonData.coordinates ? polygonData.coordinates.length : 'unknown'
								});
							} else if (polygonType === 'Feature') {
								//@ts-expect-error
								console.log(`Feature example (ID ${row[idColumn]}):`, {
									type: polygonType,
									geometryType: polygonData.geometry ? polygonData.geometry.type : 'unknown'
								});
							}
						}
					} catch (e) {
						//@ts-expect-error
						console.error(`Failed to process polygon data for ID ${row[idColumn]}:`, e);
						invalidPolygonCount++;
						continue;
					}

					// Get color value if column is specified
					let colorValue = null;
					if (colorColumn && row[colorColumn] !== null && row[colorColumn] !== undefined) {
						const numericValue = Number(row[colorColumn]);
						if (!isNaN(numericValue)) {
							colorValue = numericValue;
							colorValues.push(numericValue);

							// Log some color values for debugging
							if (colorValues.length <= 5 || colorValues.length % 1000 === 0) {
								//@ts-expect-error
								console.log(`Added color value: ${numericValue} for polygon ID ${row[idColumn]}`);
							}
						} else {
							console.warn(
								//@ts-expect-error
								`Invalid color value (not a number) for ID ${row[idColumn]}: ${row[colorColumn]}`
							);
						}
					}

					// Get label if column is specified
					let labelValue = null;
					if (labelColumn && row[labelColumn] !== null && row[labelColumn] !== undefined) {
						labelValue = String(row[labelColumn]);
					}

					// Create polygon object
					const polygon = {
						polygon: polygonData,
						//@ts-expect-error
						id: row[idColumn],
						colorValue: colorValue,
						label: labelValue
					};

					validPolygons.push(polygon);
					validPolygonCount++;

					// Log progress occasionally
					if (validPolygonCount <= 5 || validPolygonCount % 1000 === 0) {
						//@ts-expect-error
						console.log(`Processed polygon ${validPolygonCount}: ID=${row[idColumn]}`);
					}
				}

				// Log batch summary
				console.log(
					`Batch ${batchCount} results: ${validPolygons.length} valid polygons from ${batch.length} rows`
				);

				// Add valid polygons to accumulated collection
				allPolygons = [...allPolygons, ...validPolygons];

				// Calculate color range from the first batch with valid values
				if (!dataLoaded && colorValues.length > 0) {
					const min = Math.min(...colorValues);
					const max = Math.max(...colorValues);
					colorRange = [min, max];
					console.log('Color range calculated:', colorRange);
					dataLoaded = true;
				}

				// Log the total polygons processed so far
				console.log(
					`TOTAL: ${allPolygons.length} valid polygons so far after ${batchCount} batches`
				);

				// Yield the accumulated polygons
				console.log(`Yielding array with ${allPolygons.length} total polygons`);
				yield allPolygons;

				// If we've reached the chunk size, start a new collection
				if (allPolygons.length >= CHUNK_SIZE) {
					console.log(`Reached chunk size limit (${CHUNK_SIZE}), resetting polygon collection`);
					allPolygons = [];
				}
			}

			// Final yield if we didn't yield any polygons yet
			if (allPolygons.length === 0) {
				console.log('WARNING: No valid polygons found in any batch');
				yield [];
			}

			// Log final statistics
			console.log('\n========== POLYGON TRANSFORM SUMMARY ==========');
			console.log(`Total batches processed: ${batchCount}`);
			console.log(`Total rows processed: ${totalRowsProcessed}`);
			console.log(`Valid polygons: ${validPolygonCount}`);
			console.log(`Geometry types:`);
			console.log(` - Polygon: ${polygonTypeCount}`);
			console.log(` - MultiPolygon: ${multiPolygonTypeCount}`);
			console.log(` - Other/unknown: ${otherGeometryTypeCount}`);
			console.log(`Invalid data counts:`);
			console.log(` - Null/undefined polygons: ${nullPolygonCount}`);
			console.log(` - Null/undefined IDs: ${nullIdCount}`);
			console.log(` - Invalid polygon format: ${invalidPolygonCount}`);
			console.log(` - Parse errors: ${parseErrorCount}`);
			console.log(`Color values: ${colorValues.length}`);
			console.log(`Color range: [${colorRange[0]}, ${colorRange[1]}]`);
			console.log('==================== POLYGON TRANSFORM END ====================');
		} catch (error) {
			console.error('ERROR in polygon transformRows:', error);
			//@ts-expect-error
			console.error('Error stack:', error.stack);

			// In case of error, yield what we have so far
			if (allPolygons.length > 0) {
				console.log(`Error occurred, but yielding ${allPolygons.length} polygons collected so far`);
				yield allPolygons;
			} else {
				console.log('Error occurred and no polygons collected, yielding empty array');
				yield [];
			}
		}
	}

	// Function to get polygon centroid for label placement with enhanced error handling
	function getCentroid(polygon: any) {
		// This is a simplified centroid calculation
		try {
			// Handle different polygon formats
			let coordinates = null;

			// Direct Polygon object
			if (polygon.type === 'Polygon' && polygon.coordinates && polygon.coordinates[0]) {
				coordinates = polygon.coordinates[0];
			}
			// Feature with Polygon geometry
			else if (
				polygon.type === 'Feature' &&
				polygon.geometry &&
				polygon.geometry.type === 'Polygon' &&
				polygon.geometry.coordinates &&
				polygon.geometry.coordinates[0]
			) {
				coordinates = polygon.geometry.coordinates[0];
			}
			// MultiPolygon - use the first polygon's centroid
			else if (
				polygon.type === 'MultiPolygon' &&
				polygon.coordinates &&
				polygon.coordinates.length > 0
			) {
				coordinates = polygon.coordinates[0][0];
			}
			// Feature with MultiPolygon geometry
			else if (
				polygon.type === 'Feature' &&
				polygon.geometry &&
				polygon.geometry.type === 'MultiPolygon' &&
				polygon.geometry.coordinates &&
				polygon.geometry.coordinates.length > 0
			) {
				coordinates = polygon.geometry.coordinates[0][0];
			}

			// Calculate centroid if we have coordinates
			if (coordinates && coordinates.length > 0) {
				let x = 0,
					y = 0;
				for (const coord of coordinates) {
					x += coord[0];
					y += coord[1];
				}
				return [x / coordinates.length, y / coordinates.length];
			}

			// Log the issue if we can't determine the centroid
			// But don't spam the console if there are many such cases
			if (Math.random() < 0.01) {
				// Log roughly 1% of problem cases
				console.warn('Unable to determine polygon centroid:', {
					polygonType: polygon.type,
					hasCoordinates: polygon.coordinates ? 'yes' : 'no',
					hasGeometry: polygon.geometry ? 'yes' : 'no'
				});
			}

			// Return a default position if we can't calculate
			return [0, 0];
		} catch (e) {
			console.error('Error calculating centroid:', e);
			return [0, 0];
		}
	}

	// Dynamic color function based on the selected color column with enhanced logging
	function getPolygonFillColor(d: any) {
		// If no color column is selected or the value is null, return the default color
		if (!colorColumn || d.colorValue === null || d.colorValue === undefined) {
			// Occasionally log default color usage
			if (Math.random() < 0.001) {
				// Log ~0.1% of polygons
				console.log(`Using default color for polygon ID ${d.id}`);
			}
			return [...defaultColor, Math.floor(fillOpacity * 255)];
		}

		// For numeric values, let the deck.gl layer handle the color scaling
		// Occasionally log color values for debugging
		if (Math.random() < 0.001) {
			// Log ~0.1% of polygons
			console.log(
				`Polygon ${d.id} color value: ${d.colorValue}, range: [${colorRange[0]}, ${colorRange[1]}]`
			);
		}
		return [d.colorValue, Math.floor(fillOpacity * 255)];
	}

	// Enhanced loadData function with better error handling and logging
	async function* loadData() {
		try {
			console.log('==================== POLYGON LOAD DATA START ====================');
			// Initial empty dataset
			console.log('Yielding initial empty array from loadData');
			yield [];

			// Get database instance
			console.log('Getting database instance for polygon layer');
			const db = SingletonDatabase.getInstance();
			const client = await db.init();
			console.log('Database client initialized for polygon layer');

			if ($chosenDataset !== null) {
				console.log('Processing dataset for polygon layer:', $chosenDataset);
				var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);
				console.log('Cleaned filename:', filename);

				// Build column list for query
				const columns = [polygonColumn, idColumn];
				if (colorColumn) columns.push(colorColumn);
				if (labelColumn) columns.push(labelColumn);

				const columnsStr = columns.join(', ');
				console.log('Polygon layer query columns:', columnsStr);

				// Main query with all data
				console.log(`Executing polygon layer query: SELECT ${columnsStr} FROM ${filename}`);

				try {
					const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
					console.log('Polygon layer stream query executed successfully');
					console.log('Polygon layer stream schema:', stream.schema);

					// Log the schema details
					if (stream.schema) {
						console.log('Column details from schema for polygon layer:');
						stream.schema.forEach((field) => {
							console.log(
								` - ${field.name}: ${field.type} (${field.databaseType}) ${field.nullable ? 'nullable' : 'not nullable'}`
							);
						});
					}

					// Transform the rows and yield the results
					console.log('Starting polygon data transformation...');
					const readRowsGenerator = stream.readRows();
					yield* transformRows(readRowsGenerator);
				} catch (streamError) {
					console.error('Error in polygon layer stream query:', streamError);
					//@ts-expect-error
					console.error('Stream error stack:', streamError.stack);
					yield [];
				}
			} else {
				console.log('No dataset chosen for polygon layer');
				yield [];
			}
			console.log('==================== POLYGON LOAD DATA END ====================');
		} catch (error) {
			console.error('Error in polygon loadData:', error);
			//@ts-expect-error
			console.error('Error stack:', error.stack);
			// Return empty array in case of error
			yield [];
		}
	}

	// Enhanced update map layers function with better error handling
	function updateMapLayers() {
		console.log('==================== UPDATE POLYGON LAYER ====================');
		console.log('Polygon layer columns selected:', {
			polygon: polygonColumn,
			id: idColumn,
			color: colorColumn,
			label: labelColumn
		});
		console.log('Polygon layer style settings:', {
			fillOpacity,
			lineWidth,
			colorScale,
			showLabels,
			defaultColor
		});

		try {
			// Remove the existing polygon layer
			console.log(`Removing polygon layer with ID: ${layer.id}`);
			layers.remove(layer.id);

			// Create a new polygon layer with updated properties
			console.log(`Creating new polygon layer with ID: ${layer.id}`);
			const newLayer = LayerFactory.create('polygon', {
				id: layer.id,
				props: {
					data: loadData(),
					getPolygon: (d: any) => {
						// Add validation for polygon data
						if (!d || !d.polygon) {
							console.warn('Invalid polygon data for getPolygon accessor:', d);
							return [
								[
									[0, 0],
									[0, 0],
									[0, 0]
								]
							]; // Return a tiny triangle as default
						}

						// Handle different polygon formats
						try {
							// Direct Polygon object
							if (d.polygon.type === 'Polygon' && d.polygon.coordinates) {
								return d.polygon.coordinates;
							}
							// Feature with Polygon geometry
							else if (
								d.polygon.type === 'Feature' &&
								d.polygon.geometry &&
								d.polygon.geometry.type === 'Polygon'
							) {
								return d.polygon.geometry.coordinates;
							}
							// MultiPolygon
							else if (d.polygon.type === 'MultiPolygon' && d.polygon.coordinates) {
								// Flatten MultiPolygon coordinates to single Polygon for simplicity
								return d.polygon.coordinates[0];
							}
							// Feature with MultiPolygon geometry
							else if (
								d.polygon.type === 'Feature' &&
								d.polygon.geometry &&
								d.polygon.geometry.type === 'MultiPolygon'
							) {
								return d.polygon.geometry.coordinates[0];
							}

							// Log the issue if we can't determine the polygon format
							console.warn('Unknown polygon format:', d.polygon);
							return [
								[
									[0, 0],
									[0, 0],
									[0, 0]
								]
							]; // Return a tiny triangle as default
						} catch (e) {
							console.error(`Error in getPolygon accessor for ID ${d.id}:`, e);
							return [
								[
									[0, 0],
									[0, 0],
									[0, 0]
								]
							]; // Return a tiny triangle as default
						}
					},
					getFillColor: (d: any) => getPolygonFillColor(d),
					getLineColor: [0, 0, 0, 200],
					getLineWidth: lineWidth,
					lineWidthUnits: 'pixels',
					extruded: false,
					filled: true,
					pickable: true,
					autoHighlight: true,
					opacity: fillOpacity,
					colorScale: colorScale,
					updateTriggers: {
						getFillColor: [colorColumn, colorScale, fillOpacity, defaultColor, colorRange],
						getLineWidth: [lineWidth],
						getPolygon: [polygonColumn] // Update if polygon column changes
					},
					onDataLoad: (info: any) => {
						console.log('Polygon layer data loaded:', {
							polygonCount: Array.isArray(info?.data) ? info.data.length : 0,
							samplePolygon:
								Array.isArray(info?.data) && info.data.length > 0
									? {
											id: info.data[0].id,
											hasColor: info.data[0].colorValue !== null,
											hasLabel: info.data[0].label !== null
										}
									: null
						});
					},
					onHover: (info: any) => {
						if (info && info.object) {
							// Don't log every hover to avoid console spam
							if (Math.random() < 0.1) {
								// Only log ~10% of hovers
								console.log('Polygon hover info:', {
									id: info.object.id,
									colorValue: info.object.colorValue,
									label: info.object.label,
									x: info.x,
									y: info.y
								});
							}
						}
					}
				}
			});

			// Add the new polygon layer to the map
			console.log(`Adding new polygon layer with ID: ${layer.id}`);
			layers.add(newLayer);

			//console.log(`Polygon layer updated successfully`);

			// Remove the existing label layer if it exists
			//const labelLayerId = `${layer.id}-labels`;
			//if (currentLabelLayerId) {
			//	console.log(`Removing existing label layer with ID: ${currentLabelLayerId}`);
			//	try {
			//		layers.remove(currentLabelLayerId);
			//	} catch (e) {
			//		console.warn(`Failed to remove label layer: ${e}`);
			//	}
			//}

			// Create and add a new label layer if labels are enabled

			// Update the current label layer ID
			//	currentLabelLayerId = labelLayerId;
			//	console.log(`Label layer updated successfully`);
			//}

			console.log('==================== POLYGON UPDATE COMPLETE ====================');
		} catch (error) {
			console.error('Error updating polygon layer:', error);
			//@ts-expect-error
			console.error('Error stack:', error.stack);
		}
	}
</script>

<Sectional label="Required Columns">
	<ColumnDropdown bind:chosenColumn={polygonColumn} default_column="Polygon" />
	<ColumnDropdown bind:chosenColumn={idColumn} default_column="ID" />
</Sectional>

<Sectional label="Optional Columns">
	<ColumnDropdown bind:chosenColumn={colorColumn} default_column="Color" />
	<ColumnDropdown bind:chosenColumn={labelColumn} default_column="Label" />
</Sectional>

<Sectional label="Color Settings">
	{#if colorColumn}
		<div class="mt-2">
			<Label>Color Scale</Label>
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
</Sectional>

<Sectional label="Display Settings">
	<div>
		<Label>Fill Opacity</Label>
		<input type="range" min="0.1" max="1" step="0.05" bind:value={fillOpacity} class="w-full" />
		<div class="flex justify-between text-xs text-gray-500">
			<span>Transparent</span>
			<span>Solid</span>
		</div>
	</div>
	<div>
		<Label>Line Width</Label>
		<input type="range" min="0" max="3" step="0.5" bind:value={lineWidth} class="w-full" />
		<div class="flex justify-between text-xs text-gray-500">
			<span>None</span>
			<span>Thick</span>
		</div>
	</div>
</Sectional>

<Sectional label="Label Settings">
	{#if labelColumn}
		<div class="flex items-center">
			<input
				type="checkbox"
				bind:checked={showLabels}
				id="show-labels"
				class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
			/>
			<label for="show-labels" class="ml-2 text-sm text-gray-700">Show Labels</label>
		</div>
	{/if}
</Sectional>

{#if !requiredColumnsSelected}
	<div class="mt-2 text-amber-500">Please select polygon and ID columns to display data.</div>
{/if}
