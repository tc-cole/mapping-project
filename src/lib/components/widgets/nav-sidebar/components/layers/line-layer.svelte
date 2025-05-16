<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { LayerFactory } from '$lib/components/io/layer-management.svelte';
	import { chosenDataset, layers } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

	// Required columns for line layer
	let sourcePositionColumn = $state<string | undefined>();
	let targetPositionColumn = $state<string | undefined>();
	let idColumn = $state<string | undefined>();

	// Optional columns
	let colorColumn = $state<string | null>(null);
	let widthColumn = $state<string | null>(null);

	// Styling options
	let opacity = $state<number>(0.8);
	let lineWidth = $state<number>(2);
	let colorScale = $state<string>('viridis');
	let defaultColor = $state<[number, number, number]>([0, 0, 255]); // Default blue color

	// Previous values for tracking changes
	let prevColorColumn = $state<string | null>(null);
	let prevWidthColumn = $state<string | null>(null);
	let prevOpacity = $state<number>(0.8);
	let prevLineWidth = $state<number>(2);
	let prevColorScale = $state<string>('viridis');
	let prevDefaultColor = $state<[number, number, number]>([0, 0, 255]);

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

	// Used to store pre-calculated values for ranges
	let colorRange = $state<[number, number]>([0, 1]);
	let widthRange = $state<[number, number]>([1, 10]);
	let dataLoaded = $state(false);
	let hasInitialized = $state(false);

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(
		sourcePositionColumn !== undefined &&
			targetPositionColumn !== undefined &&
			idColumn !== undefined
	);

	// Create a layer when all required columns are selected
	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			console.log('Initializing line layer - required columns selected');
			createLineLayer();
			hasInitialized = true;
		}
	});

	// Re-create layer if any of the main columns change
	$effect(() => {
		// Only run after initial creation and when columns change
		if (!hasInitialized) {
			return;
		}

		// Find the current layer
		const currentLayer = layers.snapshot.find((l) => l.id === layer.id);

		// Recreate layer if main columns have changed
		if (
			currentLayer &&
			(currentLayer.props.sourcePositionColumn !== sourcePositionColumn ||
				currentLayer.props.targetPositionColumn !== targetPositionColumn ||
				currentLayer.props.idColumn !== idColumn)
		) {
			console.log('Main columns changed, recreating line layer');
			createLineLayer();
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

		if (colorColumn !== prevColorColumn) {
			changedProps.colorColumn = colorColumn;
			prevColorColumn = colorColumn;
		}

		if (widthColumn !== prevWidthColumn) {
			changedProps.widthColumn = widthColumn;
			prevWidthColumn = widthColumn;
		}

		if (opacity !== prevOpacity) {
			changedProps.opacity = opacity;
			prevOpacity = opacity;
		}

		if (lineWidth !== prevLineWidth) {
			changedProps.lineWidth = lineWidth;
			prevLineWidth = lineWidth;
		}

		if (colorScale !== prevColorScale) {
			changedProps.colorScale = colorScale;
			prevColorScale = colorScale;
		}

		if (defaultColor !== prevDefaultColor) {
			changedProps.defaultColor = defaultColor;
			prevDefaultColor = defaultColor;
		}

		// Only update if something changed
		if (Object.keys(changedProps).length > 0) {
			updateOptionalProps(changedProps);
		}
	});

	// Line transformer function
	async function* transformRows(rows: AsyncIterable<any[]>) {
		let allLines: any[] = [];
		let colorValues = [];
		let widthValues = [];
		let validLineCount = 0;

		try {
			// First yield an empty array to initialize
			yield [];

			// Process batches from DuckDB
			for await (const batch of rows) {
				const validLines = [];

				for (const row of batch) {
					if (!row) continue;

					// Check for required column values
					if (
						//@ts-expect-error
						row[sourcePositionColumn] === null || //@ts-expect-error
						row[sourcePositionColumn] === undefined ||
						//@ts-expect-error
						row[targetPositionColumn] === null || //@ts-expect-error
						row[targetPositionColumn] === undefined ||
						//@ts-expect-error
						row[idColumn] === null || //@ts-expect-error
						row[idColumn] === undefined
					) {
						continue;
					}

					// Parse positions
					//@ts-expect-error
					const sourcePosition = parsePosition(row[sourcePositionColumn]);
					//@ts-expect-error
					const targetPosition = parsePosition(row[targetPositionColumn]);

					if (!sourcePosition || !targetPosition) continue;

					// Get color value if column is specified
					let colorValue = null;
					if (colorColumn && row[colorColumn] !== null && row[colorColumn] !== undefined) {
						const numericValue = Number(row[colorColumn]);
						if (!isNaN(numericValue)) {
							colorValue = numericValue;
							colorValues.push(numericValue);
						}
					}

					// Get width if column is specified
					let widthValue = null;
					if (widthColumn && row[widthColumn] !== null && row[widthColumn] !== undefined) {
						const numericWidth = Number(row[widthColumn]);
						if (!isNaN(numericWidth)) {
							widthValue = numericWidth;
							widthValues.push(numericWidth);
						}
					}

					// Create line object
					const line = {
						//@ts-expect-error
						id: row[idColumn],
						sourcePosition,
						targetPosition,
						colorValue,
						widthValue
					};

					validLines.push(line);
					validLineCount++;
				}

				// Add valid lines to accumulated collection
				allLines = [...allLines, ...validLines];

				// Calculate ranges from the first batch with valid values
				if (!dataLoaded) {
					// Calculate color range if we have values
					if (colorValues.length > 0) {
						colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
					}

					// Calculate width range if we have values
					if (widthValues.length > 0) {
						widthRange = [Math.min(...widthValues), Math.max(...widthValues)];
					}

					if (colorValues.length > 0 || widthValues.length > 0) {
						dataLoaded = true;
					}
				}

				// Yield the accumulated lines
				yield allLines;

				// Reset collection if chunk size limit is reached
				if (allLines.length >= CHUNK_SIZE) {
					allLines = [];
				}
			}

			// Final empty yield if no lines were found
			if (allLines.length === 0) {
				yield [];
			}
		} catch (error) {
			console.error('ERROR in line transformRows:', error);

			// In case of error, yield what we have so far
			if (allLines.length > 0) {
				yield allLines;
			} else {
				yield [];
			}
		}
	}

	function parsePosition(positionData: any): [number, number] | null {
		try {
			if (Array.isArray(positionData) && positionData.length >= 2) {
				const x = Number(positionData[0]);
				const y = Number(positionData[1]);
				if (!isNaN(x) && !isNaN(y)) return [x, y];
			}

			if (typeof positionData === 'string') {
				if (positionData.startsWith('[') && positionData.endsWith(']')) {
					const parsed = JSON.parse(positionData);
					if (Array.isArray(parsed) && parsed.length >= 2) {
						const x = Number(parsed[0]);
						const y = Number(parsed[1]);
						if (!isNaN(x) && !isNaN(y)) return [x, y];
					}
				}

				if (positionData.includes(',')) {
					const parts = positionData.split(',').map((p) => p.trim());
					if (parts.length >= 2) {
						const x = Number(parts[0]);
						const y = Number(parts[1]);
						if (!isNaN(x) && !isNaN(y)) return [x, y];
					}
				}

				if (positionData.includes('coordinates') && positionData.includes('type')) {
					try {
						const parsed = JSON.parse(positionData);
						if (
							parsed.type === 'Point' &&
							Array.isArray(parsed.coordinates) &&
							parsed.coordinates.length >= 2
						) {
							return [parsed.coordinates[0], parsed.coordinates[1]];
						}
					} catch (e) {
						console.warn('Warning, not valid JSON', e);
					}
				}
			}

			// If it's an object with x/y or lon/lat properties
			if (typeof positionData === 'object' && positionData !== null) {
				// Check for x,y format
				if ('x' in positionData && 'y' in positionData) {
					const x = Number(positionData.x);
					const y = Number(positionData.y);
					if (!isNaN(x) && !isNaN(y)) return [x, y];
				}

				// Check for lon,lat or lng,lat format
				if (('lon' in positionData || 'lng' in positionData) && 'lat' in positionData) {
					const lon = Number('lon' in positionData ? positionData.lon : positionData.lng);
					const lat = Number(positionData.lat);
					if (!isNaN(lon) && !isNaN(lat)) return [lon, lat];
				}

				// Check for GeoJSON point format
				if (
					positionData.type === 'Point' &&
					Array.isArray(positionData.coordinates) &&
					positionData.coordinates.length >= 2
				) {
					return [positionData.coordinates[0], positionData.coordinates[1]];
				}
			}

			return null;
		} catch (e) {
			return null;
		}
	}

	async function* loadData() {
		try {
			yield [];

			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			if ($chosenDataset !== null) {
				var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);

				// Build column list for query
				const columns = [sourcePositionColumn, targetPositionColumn, idColumn];
				if (colorColumn) columns.push(colorColumn);
				if (widthColumn) columns.push(widthColumn);

				const columnsStr = columns.join(', ');

				try {
					const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
					const readRowsGenerator = stream.readRows();
					yield* transformRows(readRowsGenerator);
				} catch (streamError) {
					console.error('Error in line layer stream query:', streamError);
					yield [];
				}
			} else {
				yield [];
			}
		} catch (error) {
			console.error('Error in line loadData:', error);
			yield [];
		}
	}

	// Create initial line layer
	function createLineLayer() {
		try {
			console.log('Creating new line layer');

			// Define the initial layer properties
			const layerProps = {
				data: loadData(),
				getSourcePosition: (d: any) => {
					if (!d || !d.sourcePosition) return [0, 0];
					return d.sourcePosition;
				},
				getTargetPosition: (d: any) => {
					if (!d || !d.targetPosition) return [0, 0];
					return d.targetPosition;
				},
				getColor: (d: any) => {
					// Dynamic color based on the selected color column
					if (!colorColumn || d.colorValue === null || d.colorValue === undefined) {
						return [...defaultColor, Math.floor(opacity * 255)];
					}
					return [d.colorValue, Math.floor(opacity * 255)];
				},
				getWidth: (d: any) => {
					// Dynamic width based on the selected width column
					if (!widthColumn || d.widthValue === null || d.widthValue === undefined) {
						return lineWidth;
					}
					return d.widthValue;
				},
				widthUnits: 'pixels',
				pickable: true,
				autoHighlight: true,
				opacity: opacity,
				colorScale: colorScale,
				updateTriggers: {
					getColor: [colorColumn, colorScale, opacity, defaultColor, colorRange],
					getWidth: [widthColumn, lineWidth, widthRange],
					getSourcePosition: [sourcePositionColumn],
					getTargetPosition: [targetPositionColumn]
				},

				sourcePositionColumn: sourcePositionColumn,
				targetPositionColumn: targetPositionColumn,
				idColumn: idColumn,
				colorColumn: colorColumn,
				widthColumn: widthColumn
			};

			const existingLayer = layers.snapshot.find((l) => l.id === layer.id);
			if (existingLayer) {
				console.log(`Removing existing layer with ID: ${layer.id}`);
				layers.remove(layer.id);
			}

			// Create a new line layer
			const newLayer = LayerFactory.create('line', {
				id: layer.id,
				props: layerProps
			});

			// Add the new layer
			layers.add(newLayer);
		} catch (error) {
			console.error('Error creating line layer:', error);
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

			// Handle color changes
			if (
				'colorColumn' in changedProps ||
				'colorScale' in changedProps ||
				'opacity' in changedProps ||
				'defaultColor' in changedProps
			) {
				updateObj.colorScale = colorScale;
				updateObj.opacity = opacity;
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getColor: [colorColumn, colorScale, opacity, defaultColor, colorRange]
				};
			}

			// Handle width changes
			if ('widthColumn' in changedProps || 'lineWidth' in changedProps) {
				updateObj.updateTriggers = {
					...updateObj.updateTriggers,
					getWidth: [widthColumn, lineWidth, widthRange]
				};
			}

			// Update column references
			if ('colorColumn' in changedProps) {
				updateObj.colorColumn = colorColumn;
			}

			if ('widthColumn' in changedProps) {
				updateObj.widthColumn = widthColumn;
			}

			// If data-related properties have changed, reload the data
			if ('colorColumn' in changedProps || 'widthColumn' in changedProps) {
				updateObj.data = loadData();
			}

			layers.updateProps(layer.id, updateObj);
		} catch (error) {
			console.error('Error updating line layer props:', error);
		}
	}
</script>

<Sectional label="Required Columns">
	<ColumnDropdown bind:chosenColumn={sourcePositionColumn} default_column="Source" />
	<ColumnDropdown bind:chosenColumn={targetPositionColumn} default_column="Target" />
	<ColumnDropdown bind:chosenColumn={idColumn} default_column="ID" />
</Sectional>

<Sectional label="Optional Columns">
	<ColumnDropdown bind:chosenColumn={colorColumn} default_column="Color" />
	<ColumnDropdown bind:chosenColumn={widthColumn} default_column="Width" />
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
	{:else}
		<div class="mt-2">
			<Label>Default Color</Label>
			<div class="flex items-center space-x-2">
				<div
					class="h-6 w-6 border border-gray-300"
					style="background-color: rgb({defaultColor[0]}, {defaultColor[1]}, {defaultColor[2]});"
				></div>
				<select
					class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
					bind:value={defaultColor}
				>
					<option value={[0, 0, 255]}>Blue</option>
					<option value={[255, 0, 0]}>Red</option>
					<option value={[0, 255, 0]}>Green</option>
					<option value={[255, 165, 0]}>Orange</option>
					<option value={[128, 0, 128]}>Purple</option>
					<option value={[0, 0, 0]}>Black</option>
				</select>
			</div>
		</div>
	{/if}
</Sectional>

<Sectional label="Display Settings">
	<div>
		<Label>Opacity</Label>
		<input type="range" min="0.1" max="1" step="0.05" bind:value={opacity} class="w-full" />
		<div class="flex justify-between text-xs text-gray-500">
			<span>Transparent</span>
			<span>Solid</span>
		</div>
	</div>

	{#if !widthColumn}
		<div>
			<Label>Line Width</Label>
			<input type="range" min="1" max="10" step="0.5" bind:value={lineWidth} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Thin</span>
				<span>Thick</span>
			</div>
		</div>
	{/if}
</Sectional>

{#if !requiredColumnsSelected}
	<div class="mt-2 text-amber-500">
		Please select source position, target position, and ID columns to display data.
	</div>
{/if}
