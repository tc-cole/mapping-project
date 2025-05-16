<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { LayerFactory } from '$lib/components/io/layer-management.svelte';
	import { layers } from '$lib/components/io/stores';

	import { chosenDataset } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import Sectional from './utils/sectional.svelte';

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

	// Previous values for detecting changes
	let prevWidthColumn = $state<string | null>(null);
	let prevColorColumn = $state<string | null>(null);
	let prevLabelColumn = $state<string | null>(null);
	let prevArcWidth = $state<number>(2);
	let prevMinArcWidth = $state<number>(1);
	let prevMaxArcWidth = $state<number>(20);
	let prevOpacity = $state<number>(0.8);
	let prevColorScale = $state<string>('viridis');
	let prevShowLabels = $state<boolean>(false);
	let prevArcHeight = $state<number>(1);
	let prevArcHeightMultiplier = $state<number>(1);

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
	let hasInitialized = $state(false);

	let requiredColumnsSelected = $derived(
		fromLatitude !== undefined &&
			fromLongitude !== undefined &&
			toLatitude !== undefined &&
			toLongitude !== undefined
	);

	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			console.log('Initializing arc layer - all required columns selected');
			createArcLayer();
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
			(currentLayer.props.fromLatColumn !== fromLatitude ||
				currentLayer.props.fromLngColumn !== fromLongitude ||
				currentLayer.props.toLatColumn !== toLatitude ||
				currentLayer.props.toLngColumn !== toLongitude)
		) {
			console.log('Coordinate columns changed, recreating arc layer');
			createArcLayer();
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

		if (widthColumn !== prevWidthColumn) {
			changedProps.widthColumn = widthColumn;
			prevWidthColumn = widthColumn;
		}

		if (colorColumn !== prevColorColumn) {
			changedProps.colorColumn = colorColumn;
			prevColorColumn = colorColumn;
		}

		if (labelColumn !== prevLabelColumn) {
			changedProps.labelColumn = labelColumn;
			prevLabelColumn = labelColumn;
		}

		if (arcWidth !== prevArcWidth) {
			changedProps.arcWidth = arcWidth;
			prevArcWidth = arcWidth;
		}

		if (minArcWidth !== prevMinArcWidth) {
			changedProps.minArcWidth = minArcWidth;
			prevMinArcWidth = minArcWidth;
		}

		if (maxArcWidth !== prevMaxArcWidth) {
			changedProps.maxArcWidth = maxArcWidth;
			prevMaxArcWidth = maxArcWidth;
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

		if (arcHeight !== prevArcHeight) {
			changedProps.arcHeight = arcHeight;
			prevArcHeight = arcHeight;
		}

		if (arcHeightMultiplier !== prevArcHeightMultiplier) {
			changedProps.arcHeightMultiplier = arcHeightMultiplier;
			prevArcHeightMultiplier = arcHeightMultiplier;
		}

		// Only update if something changed
		if (Object.keys(changedProps).length > 0) {
			updateOptionalProps(changedProps);
		}
	});

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
			yield [];

			for await (const batch of rows) {
				batchCount++;

				totalRowsProcessed += batch.length;

				if (batch.length > 0) {
					console.log('First row in batch (raw):', JSON.stringify(batch[0], null, 2));
				}

				const validArcsBatch = [];

				for (const row of batch) {
					if (!row) {
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
						continue;
					}

					// Convert source coordinates to numbers explicitly
					const fromLong = Number(row[fromLongitude!]);
					const fromLat = Number(row[fromLatitude!]);

					// Skip if source coordinates couldn't be converted to valid numbers
					if (isNaN(fromLong) || isNaN(fromLat)) {
						invalidSourceCoordinates++;
						continue;
					}

					// Convert target coordinates to numbers explicitly
					const toLong = Number(row[toLongitude!]);
					const toLat = Number(row[toLatitude!]);

					// Skip if target coordinates couldn't be converted to valid numbers
					if (isNaN(toLong) || isNaN(toLat)) {
						invalidTargetCoordinates++;
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

				totalValidArcs += validArcsBatch.length;

				// Add valid arcs to our accumulated collection
				allArcs = [...allArcs, ...validArcsBatch];

				if (batchCount === 1 && validArcsBatch.length > 0) {
					if (widthValues.length > 0) {
						const min = Math.min(...widthValues);
						const max = Math.max(...widthValues);
						widthRange = [min, max];
					}

					// Calculate color range if we have color values
					if (colorValues.length > 0) {
						const min = Math.min(...colorValues);
						const max = Math.max(...colorValues);
						colorRange = [min, max];
					}
				}

				yield allArcs;
			}

			// Final yield if we didn't yield any arcs yet
			if (allArcs.length === 0) {
				yield [];
			}
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

	// Load data with async generator
	async function* loadData(): AsyncGenerator<any[], void, unknown> {
		try {
			// Initial empty dataset
			yield [];

			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			if ($chosenDataset !== null) {
				var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);

				// Build column list for query
				const columns = [fromLatitude, fromLongitude, toLatitude, toLongitude];
				if (widthColumn) columns.push(widthColumn);
				if (colorColumn) columns.push(colorColumn);
				if (labelColumn) columns.push(labelColumn);

				const columnsStr = columns.join(', ');

				try {
					const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
					yield* transformRows(stream.readRows());
				} catch (streamError: any) {
					console.error('Error in arc layer stream query:', streamError);
					yield [];
				}
			} else {
				yield [];
			}
			console.log('==================== ARC LOAD DATA END ====================');
		} catch (error: any) {
			console.error('Error in arc loadData:', error);
			// Return empty array in case of error
			yield [];
		}
	}

	// Create a new arc layer with all properties
	function createArcLayer(): void {
		try {
			// Define the initial layer properties
			const layerProps = {
				data: loadData(),
				getSourcePosition: (d: any) => {
					if (!d || !d.sourcePosition || d.sourcePosition.length !== 2) {
						console.warn('Invalid arc source position:', d);
						return [0, 0]; // Default to prevent errors
					}
					return d.sourcePosition;
				},
				getTargetPosition: (d: any) => {
					if (!d || !d.targetPosition || d.targetPosition.length !== 2) {
						console.warn('Invalid arc target position:', d);
						return [0, 0]; // Default to prevent errors
					}
					return d.targetPosition;
				},
				getWidth: (d: any) => getArcWidth(d),
				getSourceColor: [0, 64, 128],
				getTargetColor: [255, 128, 0],
				getColor: (d: any) => getArcColor(d),
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

					return distance * arcHeight * arcHeightMultiplier;
				},
				updateTriggers: {
					getWidth: [arcWidth, widthColumn, minArcWidth, maxArcWidth, widthRange],
					getColor: [colorColumn, colorScale, colorRange, opacity],
					getHeight: [arcHeight, arcHeightMultiplier]
				},
				// Store the column selections as props to detect changes later
				fromLatColumn: fromLatitude,
				fromLngColumn: fromLongitude,
				toLatColumn: toLatitude,
				toLngColumn: toLongitude,
				widthColumn: widthColumn,
				colorColumn: colorColumn,
				labelColumn: labelColumn
			};

			// First check if a layer with this ID already exists (cleanup)
			const existingLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (existingLayer) {
				console.log(`Removing existing layer with ID: ${layer.id}`);
				layers.remove(layer.id);
			}

			const newArcLayer = LayerFactory.create('arc', {
				id: layer.id,
				props: layerProps
			});

			layers.add(newArcLayer);
		} catch (error) {
			//@ts-expect-error
			console.error('Error creating arc layer:', error, error.stack);
		}
	}

	// Update layer props when optional parameters change
	function updateOptionalProps(changedProps: Record<string, any>): void {
		try {
			// Find the current layer
			const currentLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (!currentLayer) {
				console.warn(`Cannot update layer with ID: ${layer.id} - layer not found`);
				return;
			}

			// Base update object with updateTriggers
			const updateObj: Record<string, any> = { updateTriggers: {} };

			// Handle width changes
			if (
				'arcWidth' in changedProps ||
				'minArcWidth' in changedProps ||
				'maxArcWidth' in changedProps ||
				'widthColumn' in changedProps
			) {
				updateObj.getWidth = (d: any) => getArcWidth(d);
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getWidth: [arcWidth, widthColumn, minArcWidth, maxArcWidth, widthRange]
				};
			}

			// Handle color changes
			if (
				'colorColumn' in changedProps ||
				'colorScale' in changedProps ||
				'opacity' in changedProps
			) {
				updateObj.getColor = (d: any) => getArcColor(d);
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getColor: [colorColumn, colorScale, colorRange, opacity]
				};
			}

			// Handle height changes
			if ('arcHeight' in changedProps || 'arcHeightMultiplier' in changedProps) {
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getHeight: [arcHeight, arcHeightMultiplier]
				};
			}

			// Direct opacity setting
			if ('opacity' in changedProps) {
				updateObj.opacity = opacity;
			}

			// Update column references
			if ('widthColumn' in changedProps) {
				updateObj.widthColumn = widthColumn;
			}

			if ('colorColumn' in changedProps) {
				updateObj.colorColumn = colorColumn;
			}

			if ('labelColumn' in changedProps) {
				updateObj.labelColumn = labelColumn;
			}

			// If any data-related property changed, reload the data
			if (
				'widthColumn' in changedProps ||
				'colorColumn' in changedProps ||
				'labelColumn' in changedProps
			) {
				updateObj.data = loadData();
			}

			// Apply the updates
			layers.updateProps(layer.id, updateObj);
			console.log('Updated layer properties:', Object.keys(changedProps).join(', '));
		} catch (error) {
			console.error('Error updating arc layer props:', error);
		}
	}
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
