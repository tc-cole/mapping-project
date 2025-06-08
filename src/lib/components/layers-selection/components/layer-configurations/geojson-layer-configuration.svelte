<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/io/FileUtils';
	import { LayerFactory } from '$lib/io/layer-management.svelte';

	import { layers } from '$lib/io/stores';
	import { SingletonDatabase } from '$lib/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

	// Required column
	let geojsonColumn = $state<string | undefined>();

	// Optional columns and visual parameters
	let colorProperty = $state<string | null>(null);
	let lineWidth = $state<number>(1);
	let fillOpacity = $state<number>(0.5);
	let lineOpacity = $state<number>(0.8);
	let fillColorScale = $state<string>('viridis');
	let lineColorScale = $state<string>('viridis');
	let extruded = $state<boolean>(false);
	let elevationProperty = $state<string | null>(null);
	let elevationScale = $state<number>(1);
	let scaleType = $state<string>('linear');

	// Previous values for tracking changes
	let prevColorProperty = $state<string | null>(null);
	let prevLineWidth = $state<number>(1);
	let prevFillOpacity = $state<number>(0.5);
	let prevLineOpacity = $state<number>(0.8);
	let prevFillColorScale = $state<string>('viridis');
	let prevLineColorScale = $state<string>('viridis');
	let prevExtruded = $state<boolean>(false);
	let prevElevationProperty = $state<string | null>(null);
	let prevElevationScale = $state<number>(1);
	let prevScaleType = $state<string>('linear');

	// State variables
	let hasInitialized = $state(false);
	let dataLoaded = $state(false);
	let colorRange = $state<[number, number]>([0, 1]);

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

	let { dataset } = $props();

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(geojsonColumn !== undefined);

	// Create a layer when required column is selected
	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			console.log('Initializing GeoJSON layer - required column selected');
			createGeoJSONLayer();
			hasInitialized = true;
		}
	});

	// Re-create layer if geojsonColumn changes
	$effect(() => {
		// Only run after initial creation and when main column changes
		if (!hasInitialized) {
			return;
		}

		// Find the current layer
		const currentLayer = layers.snapshot.find((l) => l.id === layer.id);

		// Recreate layer if geojson column has changed
		if (currentLayer && currentLayer.props.geojsonColumn !== geojsonColumn) {
			console.log('GeoJSON column changed, recreating layer');
			createGeoJSONLayer();
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

		if (colorProperty !== prevColorProperty) {
			changedProps.colorProperty = colorProperty;
			prevColorProperty = colorProperty;
		}

		if (lineWidth !== prevLineWidth) {
			changedProps.lineWidth = lineWidth;
			prevLineWidth = lineWidth;
		}

		if (fillOpacity !== prevFillOpacity) {
			changedProps.fillOpacity = fillOpacity;
			prevFillOpacity = fillOpacity;
		}

		if (lineOpacity !== prevLineOpacity) {
			changedProps.lineOpacity = lineOpacity;
			prevLineOpacity = lineOpacity;
		}

		if (fillColorScale !== prevFillColorScale) {
			changedProps.fillColorScale = fillColorScale;
			prevFillColorScale = fillColorScale;
		}

		if (lineColorScale !== prevLineColorScale) {
			changedProps.lineColorScale = lineColorScale;
			prevLineColorScale = lineColorScale;
		}

		if (extruded !== prevExtruded) {
			changedProps.extruded = extruded;
			prevExtruded = extruded;
		}

		if (elevationProperty !== prevElevationProperty) {
			changedProps.elevationProperty = elevationProperty;
			prevElevationProperty = elevationProperty;
		}

		if (elevationScale !== prevElevationScale) {
			changedProps.elevationScale = elevationScale;
			prevElevationScale = elevationScale;
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

	// In your layer management
	// In your layer management
	/*
	function toggleMaskMode(layerId: string) {
		// Find the layer
		const layer = layers.snapshot.find((l) => l.id === layerId);
		if (!layer) return;

		// Check if currently in mask mode
		const isCurrentlyMask = layer.props?.operation === 'mask';

		if (isCurrentlyMask) {
			// Turn off mask mode
			layers.updateProps(layerId, {
				operation: undefined,
				visible: true,
				// Reset appearance to standard GeoJSON look
				stroked: true,
				filled: true,
				getFillColor: [0, 128, 255, 128],
				getLineColor: [0, 0, 0]
			});

			// Remove masking from layers
			const layerSnapshot = layers.snapshot;
			layers.transaction(() => {
				for (const l of layerSnapshot) {
					if (l.props?.maskId === layerId) {
						layers.updateProps(l.id, {
							extensions: [],
							maskId: undefined
						});
					}
				}
			});
		} else {
			// Turn on mask mode
			layers.updateProps(layerId, {
				operation: 'mask',
				visible: false,
				// Set mask appearance
				stroked: true,
				lineWidthMinPixels: 2,
				getLineColor: [255, 255, 255],
				getFillColor: [0, 0, 0, 0] // Transparent
			});

			// Apply mask to layers
			const layerSnapshot = layers.snapshot;
			layers.transaction(() => {
				for (const l of layerSnapshot) {
					// Skip incompatible layers
					if (
						l.id === layerId ||
						l.props?.operation === 'mask' ||
						l.ctor?.name === 'CPUGridLayer' ||
						l.ctor?.name === 'HexagonLayer'
					) {
						continue;
					}

					// Apply mask
					layers.updateProps(l.id, {
						extensions: [new MaskExtension()],
						maskId: layerId
					});
				}
			});
		}
	}
	*/
	// Enhanced GeoJSON transformer function
	async function* transformRows(rows: AsyncIterable<any[]>) {
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
			yield { type: 'FeatureCollection', features: [] };

			// Process batches from DuckDB
			for await (const batch of rows) {
				batchCount++;
				console.log(`Processing GeoJSON batch ${batchCount} with ${batch.length} rows`);
				totalRowsProcessed += batch.length;

				// Process each row in the batch
				const batchFeatures = [];

				for (const row of batch) {
					// Skip rows with missing GeoJSON
					//@ts-expect-error
					if (!row || row[geojsonColumn] === null || row[geojsonColumn] === undefined) {
						nullGeoJsonCount++;
						continue;
					}

					// Process the GeoJSON data
					try {
						let geojson;

						// Check if the GeoJSON is stored as a string or object
						//@ts-expect-error
						if (typeof row[geojsonColumn] === 'string') {
							try {
								//@ts-expect-error
								geojson = JSON.parse(row[geojsonColumn]);
							} catch (parseError) {
								parseErrorCount++;
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
							continue;
						}

						// Process based on GeoJSON type
						if (geojson.type === 'Feature') {
							featureCount++;

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

							// Add properties to each feature in the collection
							const processedFeatures = geojson.features
								.filter((feature: any) => {
									if (!feature || !feature.type || feature.type !== 'Feature') {
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
						}
					} catch (e) {
						parseErrorCount++;
						continue;
					}
				}

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

				// Create feature collection for this batch
				const featureCollection = {
					type: 'FeatureCollection',
					features: allFeatures
				};

				// Yield feature collection
				yield featureCollection;

				// If we've reached the chunk size, start a new collection
				if (allFeatures.length >= CHUNK_SIZE) {
					console.log(`Reached chunk size limit (${CHUNK_SIZE}), resetting feature collection`);
					allFeatures = [];
				}
			}

			console.log(`GeoJSON transform complete: ${validFeatureCount} features processed`);
		} catch (error) {
			console.error('ERROR in GeoJSON transformRows:', error);
			// In case of error, yield what we have so far
			if (allFeatures.length > 0) {
				yield {
					type: 'FeatureCollection',
					features: allFeatures
				};
			} else {
				yield {
					type: 'FeatureCollection',
					features: []
				};
			}
		}
	}

	// Load data with async generator
	async function* loadData() {
		try {
			// Initial empty dataset
			yield { type: 'FeatureCollection', features: [] };

			// Get database instance
			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			if (dataset !== null) {
				var filename = checkNameForSpacesAndHyphens(dataset.datasetName);

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

				try {
					const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);

					// Transform the rows and yield the results
					const readRowsGenerator = stream.readRows();
					yield* transformRows(readRowsGenerator);
				} catch (streamError) {
					console.error('Error in GeoJSON layer stream query:', streamError);
					yield { type: 'FeatureCollection', features: [] };
				}
			} else {
				console.log('No dataset chosen for GeoJSON layer');
				yield { type: 'FeatureCollection', features: [] };
			}
		} catch (error) {
			console.error('Error in GeoJSON loadData:', error);
			// Return empty GeoJSON in case of error
			yield { type: 'FeatureCollection', features: [] };
		}
	}

	// Create initial GeoJSON layer
	function createGeoJSONLayer() {
		try {
			console.log('Creating new GeoJSON layer');

			// Define the initial layer properties
			const layerProps = {
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
					return f.properties?.colorValue;
				},
				getElevation: (f: any) => {
					if (!extruded) return 0;
					return f.properties?.elevationValue || 0;
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
				// Store the column selections as props to detect changes later
				geojsonColumn: geojsonColumn,
				colorProperty: colorProperty,
				elevationProperty: elevationProperty
			};

			// First check if a layer with this ID already exists (cleanup)
			const existingLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (existingLayer) {
				console.log(`Removing existing layer with ID: ${layer.id}`);
				layers.remove(layer.id);
			}

			// Create a new GeoJSON layer
			const newLayer = LayerFactory.create('geojson', {
				id: layer.id,
				props: layerProps
			});

			// Add the new layer
			layers.add(newLayer);
			console.log('GeoJSON layer created successfully');
		} catch (error) {
			console.error('Error creating GeoJSON layer:', error);
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

			// Handle fill color changes
			if (
				'colorProperty' in changedProps ||
				'fillColorScale' in changedProps ||
				'fillOpacity' in changedProps
			) {
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getFillColor: [fillColorScale, fillOpacity, colorProperty, colorRange]
				};
				updateObj.fillColorScale = fillColorScale;
			}

			// Handle line color changes
			if (
				'colorProperty' in changedProps ||
				'lineColorScale' in changedProps ||
				'lineOpacity' in changedProps
			) {
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getLineColor: [lineColorScale, lineOpacity, colorProperty, colorRange]
				};
				updateObj.lineColorScale = lineColorScale;
			}

			// Handle line width changes
			if ('lineWidth' in changedProps) {
				updateObj.lineWidthScale = lineWidth;
			}

			// Handle opacity changes
			if ('fillOpacity' in changedProps) {
				// The opacity is handled within getFillColor
			}

			if ('lineOpacity' in changedProps) {
				// The opacity is handled within getLineColor
			}

			// Handle elevation changes
			if (
				'extruded' in changedProps ||
				'elevationProperty' in changedProps ||
				'elevationScale' in changedProps
			) {
				updateObj.extruded = extruded;
				updateObj.elevationScale = elevationScale;
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getElevation: [extruded, elevationProperty, elevationScale]
				};
			}

			// Handle scale type changes
			if ('scaleType' in changedProps) {
				updateObj.colorScaleType = scaleType;
			}

			// Update column references
			if ('colorProperty' in changedProps) {
				updateObj.colorProperty = colorProperty;
				updateObj.colorDomain = colorProperty ? colorRange : undefined;
			}

			if ('elevationProperty' in changedProps) {
				updateObj.elevationProperty = elevationProperty;
			}

			// If data-related properties have changed, reload the data
			if ('colorProperty' in changedProps || 'elevationProperty' in changedProps) {
				updateObj.data = loadData();
			}

			// Apply the updates
			console.log('Updating GeoJSON layer properties:', Object.keys(changedProps).join(', '));
			layers.updateProps(layer.id, updateObj);
		} catch (error) {
			console.error('Error updating GeoJSON layer props:', error);
		}
	}
</script>

<Sectional label="GeoJSON">
	<!--
	<label class="flex items-center space-x-2">
		<input
			type="checkbox"
			checked={layer.props?.operation === 'mask'}
			onchange={() => toggleMaskMode(layer.id)}
			class="form-checkbox h-4 w-4 text-blue-600"
		/>
		<span class="text-sm text-gray-200">Filter other layers with this shape</span>
	</label>
	-->
	<ColumnDropdown
		{dataset}
		bind:chosenColumn={geojsonColumn}
		default_column="GeoJSON"
		placeholder="geojson"
	/>
	{#if !requiredColumnsSelected}
		<div class="mt-2 text-amber-500">Please select a GeoJSON column to display data.</div>
	{/if}
</Sectional>

{#if requiredColumnsSelected}
	<Sectional label="Color Configuration">
		<div class="grid grid-cols-2 gap-2">
			<ColumnDropdown
				{dataset}
				bind:chosenColumn={colorProperty}
				default_column="Color"
				placeholder="color"
			/>

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
				<ColumnDropdown
					{dataset}
					bind:chosenColumn={elevationProperty}
					default_column="Elevation"
					placeholder="Elevation"
				/>
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
