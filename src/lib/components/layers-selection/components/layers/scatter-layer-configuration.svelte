<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/io/FileUtils';
	import { SingletonDatabase } from '$lib/io/DuckDBWASMClient.svelte';
	import { LayerFactory } from '$lib/io/layer-management.svelte';
	import { GeometryFilterManager, getGeometryId } from '$lib/io/geometry-management.svelte';
	import { chosenDataset, clickedGeoJSON, selectedGeometryId, layers } from '$lib/io/stores';

	import { Label } from '$lib/components/ui/label/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Alert, AlertDescription } from '$lib/components/ui/alert/index.js';
	import { AlertCircle } from '@lucide/svelte';
	import { flyTo } from './utils/flyto';

	import ColumnDropdown from './utils/column-dropdown.svelte';
	import Sectional from './utils/sectional.svelte';
	import ConfigField from './utils/config-field.svelte';

	//import { drawInstance } from '$lib/components/DeckGL/DeckGL.svelte';

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

	let currentFilter = $state();
	let isFiltered = $state(false);
	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(
		latitudeColumn !== undefined && longitudeColumn !== undefined
	);
	// Define the Point type for clarity
	interface Point {
		position: [number, number];
		size: number;
		color: number | null;
		label: string | null;
	}

	let hasAppliedInference = $state(false);
	let showInferenceBanner = $state(false);
	let inferredPair = $state<{ latitude: string; longitude: string; confidence: number } | null>(
		null
	);

	$effect(() => {
		if (!requiredColumnsSelected) return;

		if ($clickedGeoJSON && $clickedGeoJSON !== currentFilter && !isFiltered) {
			// New filter applied
			currentFilter = $clickedGeoJSON;
			isFiltered = true;

			const geometryId = getGeometryId($clickedGeoJSON);

			// Set the selected geometry ID
			selectedGeometryId.set(geometryId);

			// Create or get existing filter table
			createTempFilterTable($clickedGeoJSON).then((filterInfo) => {
				if (filterInfo) {
					console.log(`Geometry ${geometryId} mapped to table: ${filterInfo.tableName}`);

					// Update layer with filtered data from the table
					layers.updateProps(layer.id, {
						data: loadDataFromTable(filterInfo.tableName)
					});
				}
			});
		} else if (!$clickedGeoJSON && isFiltered) {
			// Filter cleared
			currentFilter = null;
			isFiltered = false;
			selectedGeometryId.set(null);

			// Return to original data
			layers.updateProps(layer.id, {
				data: loadData()
			});
		}
	});

	$effect(() => {
		if ($chosenDataset && !hasAppliedInference) {
			const recommendations = getLocationRecommendations();

			if (recommendations.hasRecommendations && recommendations.bestPair) {
				const bestPair = recommendations.bestPair;

				// Auto-apply high confidence suggestions (>80%)
				if (bestPair.confidence > 0.8) {
					latitudeColumn = bestPair.latitude;
					longitudeColumn = bestPair.longitude;
					hasAppliedInference = true;

					console.log('🎯 Auto-applied inferred coordinates:', {
						latitude: bestPair.latitude,
						longitude: bestPair.longitude,
						confidence: Math.round(bestPair.confidence * 100) + '%',
						dataset: $chosenDataset.datasetName
					});
				}
				// Show banner for lower confidence suggestions
				else if (bestPair.confidence > 0.5) {
					inferredPair = bestPair;
					showInferenceBanner = true;
				}
			}
		}
	});

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

	function getLocationRecommendations() {
		if (!$chosenDataset?.locationRecommendations) {
			return {
				hasRecommendations: false,
				detectedColumns: [],
				suggestedPairs: [],
				bestPair: null
			};
		}

		const recommendations = $chosenDataset.locationRecommendations;
		return {
			hasRecommendations: true,
			detectedColumns: recommendations.detectedColumns,
			suggestedPairs: recommendations.suggestedCoordinatePairs,
			bestPair: recommendations.suggestedCoordinatePairs[0] || null
		};
	}

	// Updated createTempFilterTable function
	async function createTempFilterTable(feature: any) {
		if (!feature || !feature.geometry) {
			console.error('Invalid feature for filtering');
			return null;
		}

		try {
			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			// Load spatial extension
			try {
				await db.hasExtension('spatial');
			} catch (e) {
				console.log('Spatial extension handling:', e);
			}

			if ($chosenDataset === null) {
				console.error('No dataset selected');
				return null;
			}

			const sourceTable = checkNameForSpacesAndHyphens($chosenDataset.datasetName);

			// Build columns array
			if (!latitudeColumn || !longitudeColumn) return;
			const columns = [latitudeColumn, longitudeColumn];
			if (sizeColumn) columns.push(sizeColumn);
			if (colorColumn) columns.push(colorColumn);
			if (labelColumn) columns.push(labelColumn);

			// Use the manager to get or create filter table
			const filterManager = GeometryFilterManager.getInstance();
			const filterInfo = await filterManager.getOrCreateFilterTable(
				feature,
				client,
				sourceTable,
				columns
			);

			return filterInfo;
		} catch (error) {
			console.error('Error creating filtered table:', error);
			return null;
		}
	}

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

	// Create a scatter layer when required columns are selected
	function createScatterLayer() {
		try {
			// Define the initial layer properties
			const layerProps = {
				data: loadData(),
				getPosition: (d: Point) => {
					if (!d || !d.position || d.position.length !== 2) {
						console.warn('Invalid scatter position:', d);
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
				console.log(`Removing existing layer with ID: ${layer.id}`);
				layers.remove(layer.id);
			}

			const newScatterLayer = LayerFactory.create('scatter', {
				id: layer.id,
				props: layerProps
			});

			layers.add(newScatterLayer);
		} catch (error: any) {
			console.error('Error creating scatter layer:', error, error.stack);
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
			//@ts-expect-error
			console.error('Error updating scatter layer props:', error, error.stack);
		}
	} // Modify your updateMapLayers to use the new functions

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

	function getPointColor(point: any) {
		if (!colorColumn || point.color === null) {
			return [64, 64, 180, Math.floor(opacity * 255)]; // Default blue
		}

		// In a real implementation, this would use the appropriate color scale
		// Here we're just passing the value along and assuming the layer will handle color mapping
		return [point.color, Math.floor(opacity * 255)];
	}

	async function* loadDataFromTable(tableName: string) {
		try {
			yield [];

			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			// Build column list for query (same as your existing logic)
			const columns = [latitudeColumn, longitudeColumn];
			if (sizeColumn) columns.push(sizeColumn);
			if (colorColumn) columns.push(colorColumn);
			if (labelColumn) columns.push(labelColumn);

			const columnsStr = columns.join(', ');

			console.log(`Loading data from filter table: ${tableName}`);

			// Query the pre-filtered table instead of doing spatial filtering again
			const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${tableName}`);

			// Use your existing transformRows function
			yield* transformRows(stream.readRows());
		} catch (error) {
			console.error(`Error loading data from table ${tableName}:`, error);
			yield [];
		}
	}

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
						flyTo(
							Number(viewingPosition[longitudeColumn]),
							Number(viewingPosition[latitudeColumn])
						);
					}
				}

				const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);

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

<div class="space-y-1">
	{#if !requiredColumnsSelected}
		<Alert class="mx-2 mb-3 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
			<AlertCircle class="h-3 w-3" />
			<AlertDescription class="text-xs">
				Select latitude and longitude columns to display points.
			</AlertDescription>
		</Alert>
	{/if}

	<Sectional label="Coordinates" defaultOpen={true}>
		<ConfigField label="Latitude">
			<ColumnDropdown
				bind:chosenColumn={latitudeColumn}
				default_column="Latitude"
				placeholder="Select latitude column"
			/>
		</ConfigField>

		<ConfigField label="Longitude">
			<ColumnDropdown
				bind:chosenColumn={longitudeColumn}
				default_column="Longitude"
				placeholder="Select longitude column"
			/>
		</ConfigField>
	</Sectional>

	<Sectional label="Style" defaultOpen={true}>
		<ConfigField label="Point Size" value="{pointRadius}px">
			<Slider
				type="single"
				value={pointRadius}
				min={1}
				max={50}
				step={1}
				onValueChange={(v: number) => (pointRadius = v)}
				class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
			/>
		</ConfigField>

		<ConfigField label="Opacity" value="{Math.round(opacity * 100)}%">
			<Slider
				type="single"
				value={opacity}
				min={0.1}
				max={1}
				step={0.05}
				onValueChange={(v: number) => (opacity = v)}
				class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
			/>
		</ConfigField>
	</Sectional>

	<Sectional label="Data Encoding" defaultOpen={false}>
		<ConfigField label="Size Column">
			<ColumnDropdown
				bind:chosenColumn={sizeColumn}
				default_column="Size"
				placeholder="Fixed size"
			/>
		</ConfigField>

		{#if sizeColumn}
			<div class="space-y-3 border-l-2 border-border/30 pl-4">
				<ConfigField label="Min Size" value="{minPointRadius}px">
					<Slider
						type="single"
						value={minPointRadius}
						min={1}
						max={50}
						step={1}
						onValueChange={(v: number) => (minPointRadius = v)}
						class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
					/>
				</ConfigField>

				<ConfigField label="Max Size" value="{maxPointRadius}px">
					<Slider
						type="single"
						value={maxPointRadius}
						min={10}
						max={200}
						step={5}
						onValueChange={(v: number) => (maxPointRadius = v)}
						class="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
					/>
				</ConfigField>
			</div>
		{/if}

		<ConfigField label="Color Column">
			<ColumnDropdown
				bind:chosenColumn={colorColumn}
				default_column="Color"
				placeholder="Fixed color"
			/>
		</ConfigField>

		{#if colorColumn}
			<ConfigField label="Color Scale" class="border-l-2 border-border/30 pl-4">
				<select
					class="flex h-7 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					bind:value={colorScale}
				>
					{#each colorScales as scale}
						<option value={scale} class="capitalize">{scale}</option>
					{/each}
				</select>
			</ConfigField>
		{/if}
	</Sectional>

	<Sectional label="Labels" defaultOpen={false}>
		<ConfigField label="Label Column">
			<ColumnDropdown
				bind:chosenColumn={labelColumn}
				default_column="Label"
				placeholder="No labels"
			/>
		</ConfigField>

		{#if labelColumn}
			<div class="flex items-center space-x-2 border-l-2 border-border/30 py-2 pl-4">
				<input
					type="checkbox"
					bind:checked={showLabels}
					id="show-labels"
					class="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
				/>
				<Label for="show-labels" class="cursor-pointer text-xs font-normal">
					Display labels on map
				</Label>
			</div>
		{/if}
	</Sectional>
</div>
