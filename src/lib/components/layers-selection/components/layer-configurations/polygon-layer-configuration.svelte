<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/io/FileUtils';
	import { LayerFactory } from '$lib/io/layer-management.svelte';
	import { chosenDataset, layers } from '$lib/io/stores';
	import { SingletonDatabase } from '$lib/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

	// Required columns
	let polygonColumn = $state<string | undefined>();
	let idColumn = $state<string | undefined>();

	// Optional columns
	let colorColumn = $state<string | null>(null);
	let labelColumn = $state<string | null>(null);

	// Styling options
	let fillOpacity = $state<number>(0.7);
	let lineWidth = $state<number>(1);
	let colorScale = $state<string>('viridis');
	let showLabels = $state<boolean>(false);
	let defaultColor = $state<[number, number, number]>([140, 170, 180]); // Default teal color

	// Previous values for tracking changes
	let prevColorColumn = $state<string | null>(null);
	let prevLabelColumn = $state<string | null>(null);
	let prevFillOpacity = $state<number>(0.7);
	let prevLineWidth = $state<number>(1);
	let prevColorScale = $state<string>('viridis');
	let prevShowLabels = $state<boolean>(false);
	let prevDefaultColor = $state<[number, number, number]>([140, 170, 180]);

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
	let currentLabelLayerId = $state<string | null>(null);

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(polygonColumn !== undefined && idColumn !== undefined);

	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			createPolygonLayer();
			hasInitialized = true;
		}
	});

	$effect(() => {
		if (!hasInitialized) {
			return;
		}

		const currentLayer = layers.snapshot.find((l) => l.id === layer.id);

		if (
			currentLayer &&
			(currentLayer.props.polygonColumn !== polygonColumn ||
				currentLayer.props.idColumn !== idColumn)
		) {
			createPolygonLayer();
		}
	});

	$effect(() => {
		if (!hasInitialized || !requiredColumnsSelected) {
			return;
		}

		const changedProps: Record<string, any> = {};

		if (colorColumn !== prevColorColumn) {
			changedProps.colorColumn = colorColumn;
			prevColorColumn = colorColumn;
		}

		if (labelColumn !== prevLabelColumn) {
			changedProps.labelColumn = labelColumn;
			prevLabelColumn = labelColumn;
		}

		if (fillOpacity !== prevFillOpacity) {
			changedProps.fillOpacity = fillOpacity;
			prevFillOpacity = fillOpacity;
		}

		if (lineWidth !== prevLineWidth) {
			changedProps.lineWidth = lineWidth;
			prevLineWidth = lineWidth;
		}

		if (colorScale !== prevColorScale) {
			changedProps.colorScale = colorScale;
			prevColorScale = colorScale;
		}

		if (showLabels !== prevShowLabels) {
			changedProps.showLabels = showLabels;
			prevShowLabels = showLabels;
		}

		if (defaultColor !== prevDefaultColor) {
			changedProps.defaultColor = defaultColor;
			prevDefaultColor = defaultColor;
		}

		if (Object.keys(changedProps).length > 0) {
			updateOptionalProps(changedProps);
		}
	});

	async function* transformRows(rows: AsyncIterable<any[]>) {
		let allPolygons: any[] = [];
		let colorValues = [];
		let validPolygonCount = 0;
		let batchCount = 0;

		try {
			yield [];

			// Process batches from DuckDB
			for await (const batch of rows) {
				batchCount++;
				const validPolygons = [];

				for (const row of batch) {
					if (!row) continue;

					// Check for required column values
					if (
						//@ts-expect-error
						row[polygonColumn] === null || //@ts-expect-error
						row[polygonColumn] === undefined ||
						//@ts-expect-error
						row[idColumn] === null || //@ts-expect-error
						row[idColumn] === undefined
					) {
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
								} catch (parseError) {
									continue;
								}
							} else {
								// If doesn't look like JSON, could be WKT or other format
								continue;
							}
						} else {
							// Assume it's already a valid object
							//@ts-expect-error
							polygonData = row[polygonColumn];
						}

						// Basic validation of polygon data
						if (!polygonData || typeof polygonData !== 'object') {
							continue;
						}
					} catch (e) {
						continue;
					}

					// Get color value if column is specified
					let colorValue = null;
					if (colorColumn && row[colorColumn] !== null && row[colorColumn] !== undefined) {
						const numericValue = Number(row[colorColumn]);
						if (!isNaN(numericValue)) {
							colorValue = numericValue;
							colorValues.push(numericValue);
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
				}

				// Add valid polygons to accumulated collection
				allPolygons = [...allPolygons, ...validPolygons];

				// Calculate color range from the first batch with valid values
				if (!dataLoaded && colorValues.length > 0) {
					const min = Math.min(...colorValues);
					const max = Math.max(...colorValues);
					colorRange = [min, max];
					dataLoaded = true;
				}

				// Yield the accumulated polygons
				yield allPolygons;

				// Reset collection if chunk size limit is reached
				if (allPolygons.length >= CHUNK_SIZE) {
					allPolygons = [];
				}
			}

			// Final empty yield if no polygons were found
			if (allPolygons.length === 0) {
				yield [];
			}
		} catch (error) {
			console.error('ERROR in polygon transformRows:', error);

			// In case of error, yield what we have so far
			if (allPolygons.length > 0) {
				yield allPolygons;
			} else {
				yield [];
			}
		}
	}

	// Function to get polygon centroid for label placement
	function getCentroid(polygon: any) {
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

			// Return a default position if we can't calculate
			return [0, 0];
		} catch (e) {
			return [0, 0];
		}
	}

	// Dynamic color function based on the selected color column
	function getPolygonFillColor(d: any) {
		// If no color column is selected or the value is null, return the default color
		if (!colorColumn || d.colorValue === null || d.colorValue === undefined) {
			return [...defaultColor, Math.floor(fillOpacity * 255)];
		}

		// For numeric values, let the deck.gl layer handle the color scaling
		return [d.colorValue, Math.floor(fillOpacity * 255)];
	}

	// Load data from DuckDB
	async function* loadData() {
		try {
			// Initial empty dataset
			yield [];

			// Get database instance
			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			if ($chosenDataset !== null) {
				var filename = checkNameForSpacesAndHyphens($chosenDataset.datasetName);

				// Build column list for query
				const columns = [polygonColumn, idColumn];
				if (colorColumn) columns.push(colorColumn);
				if (labelColumn) columns.push(labelColumn);

				const columnsStr = columns.join(', ');

				try {
					const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
					const readRowsGenerator = stream.readRows();
					yield* transformRows(readRowsGenerator);
				} catch (streamError) {
					console.error('Error in polygon layer stream query:', streamError);
					yield [];
				}
			} else {
				yield [];
			}
		} catch (error) {
			console.error('Error in polygon loadData:', error);
			yield [];
		}
	}

	// Create initial polygon layer
	function createPolygonLayer() {
		try {
			const layerProps = {
				data: loadData(),
				getPolygon: (d: any) => {
					// Add validation for polygon data
					if (!d || !d.polygon) {
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

						// Return a default if we can't determine the polygon format
						return [
							[
								[0, 0],
								[0, 0],
								[0, 0]
							]
						]; // Return a tiny triangle as default
					} catch (e) {
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
				// Store the column selections as props to detect changes later
				polygonColumn: polygonColumn,
				idColumn: idColumn,
				colorColumn: colorColumn,
				labelColumn: labelColumn
			};

			// First check if a layer with this ID already exists (cleanup)
			const existingLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (existingLayer) {
				layers.remove(layer.id);
			}

			// Also remove any existing label layer
			if (currentLabelLayerId) {
				try {
					layers.remove(currentLabelLayerId);
					currentLabelLayerId = null;
				} catch (e) {
					console.warn(`Failed to remove label layer: ${e}`);
				}
			}

			const newLayer = LayerFactory.create('polygon', {
				id: layer.id,
				props: layerProps
			});

			layers.add(newLayer);
			console.log('Polygon layer created successfully');

			if (showLabels && labelColumn) {
				createLabelLayer();
			}
		} catch (error) {
			console.error('Error creating polygon layer:', error);
		}
	}

	function createLabelLayer() {
		if (!showLabels || !labelColumn) return;

		try {
			const labelLayerId = `${layer.id}-labels`;

			const labelLayer = LayerFactory.create('text', {
				id: labelLayerId,
				props: {
					data: loadData(),
					getText: (d: any) => (d.label !== null && d.label !== undefined ? String(d.label) : ''),
					getPosition: (d: any) => {
						if (!d || !d.polygon) return [0, 0];
						return getCentroid(d.polygon);
					},
					getColor: [0, 0, 0, 255],
					getSize: 12,
					getAngle: 0,
					getTextAnchor: 'middle',
					getAlignmentBaseline: 'center',
					getPixelOffset: [0, 0],
					billboard: true,
					sizeScale: 1,
					fontFamily: 'Arial',
					fontWeight: 'normal',
					maxWidth: 200,
					wordBreak: 'break-word',
					pickable: true,
					updateTriggers: {
						getText: [labelColumn],
						getPosition: [polygonColumn]
					}
				}
			});

			layers.add(labelLayer);
			currentLabelLayerId = labelLayerId;
			console.log('Label layer created successfully');
		} catch (error) {
			console.error('Error creating label layer:', error);
		}
	}

	function updateOptionalProps(changedProps: Record<string, any>) {
		try {
			const currentLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (!currentLayer) {
				console.warn(`Cannot update layer with ID: ${layer.id} - layer not found`);
				return;
			}

			const updateObj: Record<string, any> = { updateTriggers: {} };

			if (
				'colorColumn' in changedProps ||
				'colorScale' in changedProps ||
				'fillOpacity' in changedProps ||
				'defaultColor' in changedProps
			) {
				updateObj.colorScale = colorScale;
				updateObj.opacity = fillOpacity;
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getFillColor: [colorColumn, colorScale, fillOpacity, defaultColor, colorRange]
				};
			}

			// Handle line width changes
			if ('lineWidth' in changedProps) {
				updateObj.getLineWidth = lineWidth;
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getLineWidth: [lineWidth]
				};
			}

			if ('colorColumn' in changedProps) {
				updateObj.colorColumn = colorColumn;
			}

			if ('labelColumn' in changedProps) {
				updateObj.labelColumn = labelColumn;
			}

			if ('colorColumn' in changedProps || 'labelColumn' in changedProps) {
				updateObj.data = loadData();
			}

			layers.updateProps(layer.id, updateObj);

			if ('showLabels' in changedProps || 'labelColumn' in changedProps) {
				if (currentLabelLayerId) {
					try {
						layers.remove(currentLabelLayerId);
						currentLabelLayerId = null;
					} catch (e) {
						console.warn(`Failed to remove label layer: ${e}`);
					}
				}

				if (showLabels && labelColumn) {
					createLabelLayer();
				}
			} else if (
				currentLabelLayerId &&
				('polygonColumn' in changedProps ||
					'colorColumn' in changedProps ||
					'labelColumn' in changedProps)
			) {
				const labelUpdateObj = {
					data: loadData(),
					updateTriggers: {
						getText: [labelColumn],
						getPosition: [polygonColumn]
					}
				};

				layers.updateProps(currentLabelLayerId, labelUpdateObj);
			}
		} catch (error) {
			console.error('Error updating polygon layer props:', error);
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
