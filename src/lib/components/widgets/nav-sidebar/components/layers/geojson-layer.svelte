<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { layers } from '$lib/components/io/layer-io.svelte';
	import { chosenDataset } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

	let geojsonColumn = $state<string | undefined>();
	let colorProperty = $state<string | null>(null);
	let lineWidth = $state<number>(1);
	let fillOpacity = $state<number>(0.5);
	let lineOpacity = $state<number>(0.8);
	let fillColorScale = $state<string>('viridis');
	let lineColorScale = $state<string>('viridis');
	let extruded = $state<boolean>(false);
	let elevationProperty = $state<string | null>(null);
	let elevationScale = $state<number>(1);
	let hasInitialized = $state(false);
	let dataLoaded = $state(false);
	let colorRange = $state<[number, number]>([0, 1]);
	let currentLayerId = $state<string | null>(null);

	// Available color scales (consistent with other layers)
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

	let { layer } = $props();

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(geojsonColumn !== undefined);

	// Effect to update map when configuration changes
	$effect(() => {
		console.log('Effect checking required columns for GeoJSON Layer:', {
			geojsonColumn
		});

		if (requiredColumnsSelected && !hasInitialized) {
			console.log('Initializing GeoJSON layer - required column selected');
			updateMapLayers();
			hasInitialized = true;
		}
	});

	// Update effect whenever key parameters change
	$effect(() => {
		if (hasInitialized) {
			console.log('Updating GeoJSON layer due to parameter change');
			updateMapLayers();
		}
	});

	// Enhanced GeoJSON transformer function with detailed debugging
	async function* transformRows(rows: AsyncIterable<any[]>) {
		console.log('==================== GEOJSON TRANSFORM START ====================');
		console.log('Starting GeoJSON transformRows with columns:', {
			geojson: geojsonColumn,
			color: colorProperty,
			elevation: elevationProperty
		});

		// Stats tracking
		let allFeatures: any[] = [];
		let colorValues: number[] = [];
		let elevationValues: number[] = [];
		let batchCount = 0;
		let totalRowsProcessed = 0;
		let validFeatureCount = 0;
		let invalidGeoJsonCount = 0;
		let nullGeoJsonCount = 0;
		let parseErrorCount = 0;
		let featureCount = 0;
		let geometryCount = 0;
		let featureCollectionCount = 0;

		try {
			// First yield an empty feature collection to initialize
			console.log('Yielding initial empty FeatureCollection');
			yield { type: 'FeatureCollection', features: [] };

			// Process batches from DuckDB
			for await (const batch of rows) {
				batchCount++;
				console.log(`\n----- GEOJSON BATCH ${batchCount} -----`);
				console.log(`Received batch with ${batch.length} rows`);
				totalRowsProcessed += batch.length;

				// Log the first row of each batch to see the raw format
				if (batch.length > 0) {
					console.log('First row in batch (raw):', batch[0]);
					console.log(
						//@ts-expect-error
						`GeoJSON column in first row: ${batch[0][geojsonColumn]?.substring?.(0, 100)}${batch[0][geojsonColumn]?.length > 100 ? '...' : ''}`
					);
					if (colorProperty) {
						console.log(`Color property in first row: ${batch[0][colorProperty]}`);
					}
					if (elevationProperty) {
						console.log(`Elevation property in first row: ${batch[0][elevationProperty]}`);
					}
				} else {
					console.log('Batch is empty');
				}

				// Process each row in the batch
				const batchFeatures = [];

				for (const row of batch) {
					// Skip rows with missing GeoJSON
					//@ts-expect-error
					if (!row || row[geojsonColumn] === null || row[geojsonColumn] === undefined) {
						nullGeoJsonCount++;
						if (nullGeoJsonCount <= 5) {
							console.log('Skipping row with null/undefined GeoJSON:', row);
						}
						continue;
					}

					// Process the GeoJSON data
					try {
						let geojson;

						// Check if the GeoJSON is stored as a string or object
						//@ts-expect-error

						if (typeof row[geojsonColumn] === 'string') {
							try {
								console.log(`Parsing GeoJSON string from row ${batchFeatures.length}`); //@ts-expect-error
								geojson = JSON.parse(row[geojsonColumn]);
							} catch (parseError) {
								parseErrorCount++;
								if (parseErrorCount <= 5) {
									console.error(`Failed to parse GeoJSON string:`, parseError);
									console.log(
										//@ts-expect-error

										`Invalid GeoJSON string (first 200 chars): ${row[geojsonColumn].substring(0, 200)}`
									);
								}
								continue;
							}
						} else {
							// Already an object
							//@ts-expect-error
							geojson = row[geojsonColumn];
						}

						// Basic validation
						if (!geojson || typeof geojson !== 'object') {
							invalidGeoJsonCount++;
							if (invalidGeoJsonCount <= 5) {
								console.error(`Invalid GeoJSON data, not an object:`, geojson);
							}
							continue;
						}

						// Process based on GeoJSON type
						if (geojson.type === 'Feature') {
							featureCount++;

							// Log the feature structure for the first few features
							if (featureCount <= 2) {
								console.log(`Feature example:`, {
									type: geojson.type,
									geometry: {
										type: geojson.geometry?.type,
										coordinatesLength: geojson.geometry?.coordinates?.length
									},
									properties: geojson.properties
								});
							}

							// Add properties if they don't exist
							if (!geojson.properties) {
								geojson.properties = {};
							}

							// Add color property if available
							if (
								colorProperty &&
								row[colorProperty] !== undefined &&
								row[colorProperty] !== null
							) {
								const colorValue = Number(row[colorProperty]);
								if (!isNaN(colorValue)) {
									geojson.properties.colorValue = colorValue;
									colorValues.push(colorValue);

									// Log some color values for debugging
									if (colorValues.length <= 5 || colorValues.length % 1000 === 0) {
										console.log(`Added color value: ${colorValue} to feature`);
									}
								} else {
									console.warn(`Invalid color value (not a number): ${row[colorProperty]}`);
								}
							}

							// Add elevation property if enabled and available
							if (
								extruded &&
								elevationProperty &&
								row[elevationProperty] !== undefined &&
								row[elevationProperty] !== null
							) {
								const elevationValue = Number(row[elevationProperty]);
								if (!isNaN(elevationValue)) {
									geojson.properties.elevationValue = elevationValue;
									elevationValues.push(elevationValue);

									// Log some elevation values for debugging
									if (elevationValues.length <= 5 || elevationValues.length % 1000 === 0) {
										console.log(`Added elevation value: ${elevationValue} to feature`);
									}
								} else {
									console.warn(`Invalid elevation value (not a number): ${row[elevationProperty]}`);
								}
							}

							batchFeatures.push(geojson);
							validFeatureCount++;
						}
						// If it's a geometry, wrap it in a feature
						else if (
							geojson.type &&
							[
								'Point',
								'LineString',
								'Polygon',
								'MultiPolygon',
								'MultiLineString',
								'MultiPoint'
							].includes(geojson.type)
						) {
							geometryCount++;

							// Log the geometry structure for the first few geometries
							if (geometryCount <= 2) {
								console.log(`Geometry example (type: ${geojson.type}):`, {
									coordinatesLength: geojson.coordinates?.length
								});
							}

							const properties: any = {};

							// Add color property if available
							if (
								colorProperty &&
								row[colorProperty] !== undefined &&
								row[colorProperty] !== null
							) {
								const colorValue = Number(row[colorProperty]);
								if (!isNaN(colorValue)) {
									properties.colorValue = colorValue;
									colorValues.push(colorValue);
								}
							}

							// Add elevation property if enabled and available
							if (
								extruded &&
								elevationProperty &&
								row[elevationProperty] !== undefined &&
								row[elevationProperty] !== null
							) {
								const elevationValue = Number(row[elevationProperty]);
								if (!isNaN(elevationValue)) {
									properties.elevationValue = elevationValue;
									elevationValues.push(elevationValue);
								}
							}

							// Create a feature from the geometry
							const feature = {
								type: 'Feature',
								geometry: geojson,
								properties: properties
							};

							batchFeatures.push(feature);
							validFeatureCount++;
						}
						// Handle FeatureCollection
						else if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
							featureCollectionCount++;

							// Log feature collection info
							if (featureCollectionCount <= 2) {
								console.log(`FeatureCollection example: ${geojson.features.length} features`);
								if (geojson.features.length > 0) {
									console.log(`First feature in collection:`, {
										type: geojson.features[0]?.type,
										geometry: {
											type: geojson.features[0]?.geometry?.type,
											coordinatesLength: geojson.features[0]?.geometry?.coordinates?.length
										}
									});
								}
							}

							// Add properties to each feature in the collection
							const processedFeatures = geojson.features
								.filter((feature: any) => {
									if (!feature || !feature.type || feature.type !== 'Feature') {
										console.warn('Invalid feature in FeatureCollection:', feature);
										return false;
									}
									return true;
								})
								.map((feature: any) => {
									if (!feature.properties) {
										feature.properties = {};
									}

									// Add color property if available
									if (
										colorProperty &&
										row[colorProperty] !== undefined &&
										row[colorProperty] !== null
									) {
										const colorValue = Number(row[colorProperty]);
										if (!isNaN(colorValue)) {
											feature.properties.colorValue = colorValue;
											colorValues.push(colorValue);
										}
									}

									// Add elevation property if enabled and available
									if (
										extruded &&
										elevationProperty &&
										row[elevationProperty] !== undefined &&
										row[elevationProperty] !== null
									) {
										const elevationValue = Number(row[elevationProperty]);
										if (!isNaN(elevationValue)) {
											feature.properties.elevationValue = elevationValue;
											elevationValues.push(elevationValue);
										}
									}

									return feature;
								});

							validFeatureCount += processedFeatures.length;
							batchFeatures.push(...processedFeatures);
						} else {
							invalidGeoJsonCount++;
							if (invalidGeoJsonCount <= 5) {
								console.error(`Unrecognized GeoJSON type:`, geojson.type);
							}
						}
					} catch (e) {
						console.error('Error processing GeoJSON:', e);
						parseErrorCount++;
						continue;
					}
				}

				// Log batch summary
				console.log(
					`Batch ${batchCount} results: Processed ${batchFeatures.length} features from ${batch.length} rows`
				);

				// Add batch features to accumulated collection
				allFeatures = [...allFeatures, ...batchFeatures];

				// Calculate color range from the first batch with color values
				if (!dataLoaded && colorValues.length > 0) {
					const min = Math.min(...colorValues);
					const max = Math.max(...colorValues);
					colorRange = [min, max];
					console.log('Color range calculated:', colorRange);
					dataLoaded = true;
				}

				// Log the total features processed so far
				console.log(
					`TOTAL: ${allFeatures.length} valid features so far after ${batchCount} batches`
				);

				// Create feature collection for this batch
				const featureCollection = {
					type: 'FeatureCollection',
					features: allFeatures
				};

				// Log feature collection stats
				console.log(`Yielding FeatureCollection with ${allFeatures.length} features`);

				// Sample feature types in the collection
				const featureTypes = new Set();
				const geometryTypes = new Set();

				// Sample up to 100 features for type checking
				const sampleSize = Math.min(allFeatures.length, 100);
				for (let i = 0; i < sampleSize; i++) {
					const feature = allFeatures[i];
					if (feature && feature.type) {
						featureTypes.add(feature.type);
					}
					if (feature && feature.geometry && feature.geometry.type) {
						geometryTypes.add(feature.geometry.type);
					}
				}

				console.log(`Feature types in collection: ${Array.from(featureTypes).join(', ')}`);
				console.log(`Geometry types in collection: ${Array.from(geometryTypes).join(', ')}`);

				// Yield feature collection
				yield featureCollection;

				// If we've reached the chunk size, start a new collection
				if (allFeatures.length >= CHUNK_SIZE) {
					console.log(`Reached chunk size limit (${CHUNK_SIZE}), resetting feature collection`);
					allFeatures = [];
				}
			}

			// Final statistics
			console.log('\n========== GEOJSON TRANSFORM SUMMARY ==========');
			console.log(`Total batches processed: ${batchCount}`);
			console.log(`Total rows processed: ${totalRowsProcessed}`);
			console.log(`Valid features: ${validFeatureCount}`);
			console.log(`Feature types processed:`);
			console.log(` - Features: ${featureCount}`);
			console.log(` - Geometries wrapped as features: ${geometryCount}`);
			console.log(` - FeatureCollections processed: ${featureCollectionCount}`);
			console.log(`Invalid data counts:`);
			console.log(` - Null/undefined GeoJSON: ${nullGeoJsonCount}`);
			console.log(` - Invalid GeoJSON format: ${invalidGeoJsonCount}`);
			console.log(` - Parse errors: ${parseErrorCount}`);
			console.log(`Color values: ${colorValues.length}`);
			console.log(`Elevation values: ${elevationValues.length}`);
			console.log(`Color range: [${colorRange[0]}, ${colorRange[1]}]`);
			console.log('==================== GEOJSON TRANSFORM END ====================');
		} catch (error) {
			console.error('ERROR in GeoJSON transformRows:', error); //@ts-expect-error
			console.error('Error stack:', error.stack);

			// In case of error, yield what we have so far
			if (allFeatures.length > 0) {
				console.log(`Error occurred, but yielding ${allFeatures.length} features collected so far`);
				yield {
					type: 'FeatureCollection',
					features: allFeatures
				};
			} else {
				console.log('Error occurred and no features collected, yielding empty FeatureCollection');
				yield {
					type: 'FeatureCollection',
					features: []
				};
			}
		}
	}

	// Enhanced loadData function with better error handling and logging
	async function* loadData() {
		try {
			console.log('==================== GEOJSON LOAD DATA START ====================');
			// Initial empty dataset
			console.log('Yielding initial empty FeatureCollection from loadData');
			yield { type: 'FeatureCollection', features: [] };

			// Get database instance
			console.log('Getting database instance for GeoJSON layer');
			const db = SingletonDatabase.getInstance();
			const client = await db.init();
			console.log('Database client initialized for GeoJSON layer');

			if ($chosenDataset !== null) {
				console.log('Processing dataset for GeoJSON layer:', $chosenDataset);
				var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);
				console.log('Cleaned filename:', filename);

				// Build column list for query
				const columnsList = [geojsonColumn];
				if (colorProperty) {
					columnsList.push(colorProperty);
				}
				if (extruded && elevationProperty) {
					columnsList.push(elevationProperty);
				}

				const columnsStr = columnsList.join(', ');
				console.log('GeoJSON layer query columns:', columnsStr);

				// Main query with all data
				console.log(`Executing GeoJSON layer stream query: SELECT ${columnsStr} FROM ${filename}`);

				try {
					const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
					console.log('GeoJSON layer stream query executed successfully');
					console.log('GeoJSON layer stream schema:', stream.schema);

					// Log the schema details
					if (stream.schema) {
						console.log('Column details from schema for GeoJSON layer:');
						stream.schema.forEach((field) => {
							console.log(
								` - ${field.name}: ${field.type} (${field.databaseType}) ${field.nullable ? 'nullable' : 'not nullable'}`
							);
						});
					}

					// Transform the rows and yield the results
					console.log('Starting GeoJSON data transformation...');
					const readRowsGenerator = stream.readRows();
					yield* transformRows(readRowsGenerator);
				} catch (streamError) {
					console.error('Error in GeoJSON layer stream query:', streamError); //@ts-expect-error
					console.error('Stream error stack:', streamError.stack);
					yield { type: 'FeatureCollection', features: [] };
				}
			} else {
				console.log('No dataset chosen for GeoJSON layer');
				yield { type: 'FeatureCollection', features: [] };
			}
			console.log('==================== GEOJSON LOAD DATA END ====================');
		} catch (error) {
			console.error('Error in GeoJSON loadData:', error); //@ts-expect-error

			console.error('Error stack:', error.stack);
			// Return empty GeoJSON in case of error
			yield { type: 'FeatureCollection', features: [] };
		}
	}

	// Enhanced update map layers function with better error handling
	function updateMapLayers() {
		console.log('==================== UPDATE GEOJSON LAYER ====================');
		console.log('GeoJSON layer columns selected:', {
			geojson: geojsonColumn,
			color: colorProperty,
			elevation: elevationProperty
		});
		console.log('GeoJSON layer style settings:', {
			filled: true,
			stroked: true,
			lineWidth: lineWidth,
			fillOpacity: fillOpacity,
			lineOpacity: lineOpacity,
			fillColorScale: fillColorScale,
			lineColorScale: lineColorScale,
			extruded: extruded,
			elevationScale: elevationScale,
			scaleType: scaleType,
			colorRange: colorRange
		});

		try {
			// Update GeoJSON layer
			console.log(`Updating GeoJSON layer with ID: ${layer.id}`);

			layers.updateProps(layer.id, {
				data: loadData(),
				filled: true,
				stroked: true,
				lineWidthScale: lineWidth,
				getFillColor: (f: any) => {
					// Use colorProperty if available, otherwise use default color
					if (
						colorProperty &&
						f.properties?.colorValue !== undefined &&
						f.properties?.colorValue !== null
					) {
						// This will be handled by the layer's color mapping
						return [140, 170, 180, Math.floor(fillOpacity * 255)];
					} else {
						return [140, 170, 180, Math.floor(fillOpacity * 255)];
					}
				},
				getLineColor: (f: any) => {
					// Use colorProperty if available, otherwise use default color
					if (
						colorProperty &&
						f.properties?.colorValue !== undefined &&
						f.properties?.colorValue !== null
					) {
						// This will be handled by the layer's color mapping
						return [0, 0, 0, Math.floor(lineOpacity * 255)];
					} else {
						return [0, 0, 0, Math.floor(lineOpacity * 255)];
					}
				},
				getColorValue: (f: any) => {
					const colorValue = f.properties?.colorValue;
					// Periodically log color values for debugging
					if (Math.random() < 0.001) {
						// Log about 0.1% of features
						console.log(`GeoJSON feature color value:`, {
							colorValue: colorValue,
							colorRange: colorRange
						});
					}
					return colorValue;
				},
				getElevation: (f: any) => {
					if (!extruded) return 0;

					const elevationValue = f.properties?.elevationValue || 0;
					// Periodically log elevation values for debugging
					if (Math.random() < 0.001) {
						// Log about 0.1% of features
						console.log(`GeoJSON feature elevation:`, {
							elevationValue: elevationValue,
							elevationScale: elevationScale
						});
					}
					return elevationValue;
				},
				elevationScale: elevationScale,
				extruded: extruded,
				wireframe: false,
				pickable: true,
				autoHighlight: true,
				pointRadiusScale: 5,
				lineJointRounded: true,
				fillColorScale: fillColorScale,
				lineColorScale: lineColorScale,
				colorScaleType: scaleType,
				colorDomain: colorProperty ? colorRange : undefined,
				updateTriggers: {
					getFillColor: [fillColorScale, fillOpacity, colorProperty, colorRange],
					getLineColor: [lineColorScale, lineOpacity, colorProperty, colorRange],
					getElevation: [extruded, elevationProperty, elevationScale]
				},
				// Add callbacks for visibility debugging
				onDataLoad: (info: any) => {
					console.log('GeoJSON layer data loaded:', {
						featureCount: info?.data?.features?.length || 0,
						sampleFeature: info?.data?.features?.[0]
							? {
									type: info.data.features[0].type,
									geometryType: info.data.features[0].geometry?.type
								}
							: null
					});
				},
				onHover: (info: any) => {
					if (info && info.object) {
						// Don't log every hover to avoid console spam
						if (Math.random() < 0.1) {
							// Only log ~10% of hovers
							console.log('GeoJSON hover info:', {
								featureType: info.object.type,
								geometryType: info.object.geometry?.type,
								properties: info.object.properties,
								x: info.x,
								y: info.y
							});
						}
					}
				}
			});

			console.log(`GeoJSON layer updated successfully`);
			console.log('==================== GEOJSON UPDATE COMPLETE ====================');
		} catch (error) {
			console.error('Error updating GeoJSON layer:', error); //@ts-expect-error
			console.error('Error stack:', error.stack);
		}
	}
</script>

<Sectional label="GeoJSON">
	<ColumnDropdown bind:chosenColumn={geojsonColumn} default_column="GeoJSON" />
	{#if !requiredColumnsSelected}
		<div class="mt-2 text-amber-500">Please select a GeoJSON column to display data.</div>
	{/if}
</Sectional>

{#if requiredColumnsSelected}
	<Sectional label="Color Configuration">
		<div class="grid grid-cols-2 gap-2">
			<ColumnDropdown bind:chosenColumn={colorProperty} default_column="Color" />

			<select
				class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
				bind:value={scaleType}
				disabled={!colorProperty}
			>
				{#each scaleTypes as type}
					<option value={type}>{type}</option>
				{/each}
			</select>
		</div>

		{#if colorProperty}
			<div class="mt-3 grid grid-cols-2 gap-2">
				<div>
					<Label>Fill Color Scale</Label>
					<select
						class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
						bind:value={fillColorScale}
					>
						{#each colorScales as scale}
							<option value={scale}>{scale}</option>
						{/each}
					</select>
				</div>
				<div>
					<Label>Line Color Scale</Label>
					<select
						class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
						bind:value={lineColorScale}
					>
						{#each colorScales as scale}
							<option value={scale}>{scale}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}
	</Sectional>

	<Sectional label="3D Extrusion">
		<Label class="flex items-center">
			<input
				type="checkbox"
				bind:checked={extruded}
				class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
			/>
			<span class="ml-2 text-sm text-gray-700">Show 3D Extrusion</span>
		</Label>

		{#if extruded}
			<div class="mt-3 grid grid-cols-2 gap-2">
				<ColumnDropdown bind:chosenColumn={elevationProperty} default_column="Elevation" />
				<input type="range" min="1" max="100" step="1" bind:value={elevationScale} class="w-full" />
			</div>
		{/if}
	</Sectional>

	<Sectional label="Style Settings">
		<div class="grid grid-cols-2 gap-4">
			<input type="range" min="0.5" max="5" step="0.5" bind:value={lineWidth} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Thin</span>
				<span>Thick</span>
			</div>
			<input type="range" min="0" max="1" step="0.05" bind:value={fillOpacity} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Transparent</span>
				<span>Solid</span>
			</div>
		</div>

		<div class="mt-3">
			<input type="range" min="0" max="1" step="0.05" bind:value={lineOpacity} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Transparent</span>
				<span>Solid</span>
			</div>
		</div>
	</Sectional>
{/if}
