<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { layers } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
	import { chosenDataset } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';

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
	let colorRange = [0, 1];
	let dataLoaded = $state(false);
	let hasInitialized = $state(false);

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(polygonColumn !== undefined && idColumn !== undefined);

	// Derive the map layer configuration based on all input parameters
	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			updateMapLayers();
			hasInitialized = true;
			console.log($layers);
		}
	});

	async function* transformRows(rows: AsyncIterable<any>) {
		let polygons = [];
		let colorValues = [];

		for await (const row of rows) {
			// Skip rows with missing data
			//@ts-expect-error

			if (row[polygonColumn] === null || row[idColumn] === null) {
				continue;
			}

			// Parse the GeoJSON/WKT polygon from the selected column
			let polygonData;
			try {
				// Check if the polygon data is in GeoJSON format (as a string)
				//@ts-expect-error
				if (typeof row[polygonColumn] === 'string' && row[polygonColumn].includes('coordinates')) {
					//@ts-expect-error
					polygonData = JSON.parse(row[polygonColumn]);
				} else {
					// Assume it's already a valid object
					//@ts-expect-error
					polygonData = row[polygonColumn];
				}
			} catch (e) {
				console.error('Failed to parse polygon data:', e);
				continue;
			}

			const polygon = {
				polygon: polygonData, //@ts-expect-error
				id: row[idColumn],
				colorValue: colorColumn && row[colorColumn] !== null ? row[colorColumn] : null,
				label: labelColumn && row[labelColumn] !== null ? row[labelColumn] : null
			};

			// Collect values for calculating color range
			if (colorColumn && row[colorColumn] !== null && !isNaN(row[colorColumn])) {
				colorValues.push(row[colorColumn]);
			}

			polygons.push(polygon);

			if (polygons.length >= CHUNK_SIZE) {
				// Process ranges before yielding first chunk
				if (!dataLoaded && colorValues.length > 0) {
					colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
					dataLoaded = true;
				}

				yield polygons;
				polygons = [];
			}
		}

		// Process ranges if this is the first and only chunk
		if (!dataLoaded && colorValues.length > 0) {
			colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
			dataLoaded = true;
		}

		if (polygons.length > 0) {
			yield polygons;
		}
	}

	function updateMapLayers() {
		layers.updateProps(layer.id, {
			data: loadData(),
			getFillColor: getPolygonFillColor,
			getLineColor: [0, 0, 0, 200],
			getLineWidth: lineWidth,
			lineWidthUnits: 'pixels',
			extruded: false,
			filled: true,
			pickable: true,
			opacity: fillOpacity,
			colorScale: colorScale,
			updateTriggers: {
				getFillColor: [colorColumn, colorScale, fillOpacity, defaultColor, colorRange],
				getLineWidth: [lineWidth]
			}
		});

		// Update text labels layer
		layers.updateProps(`${layer.id}-labels`, {
			data: loadData(),
			getPosition: (d: any) => getCentroid(d.polygon),
			getText: (d: any) => d.label || '',
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
	}

	// Function to get polygon centroid for label placement
	function getCentroid(polygon: any) {
		// This is a simplified centroid calculation
		// A proper implementation would need to handle multipolygons and complex shapes
		try {
			if (polygon.type === 'Polygon' && polygon.coordinates && polygon.coordinates[0]) {
				// Use the first ring of coordinates
				const coordinates = polygon.coordinates[0];
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
			console.error('Error calculating centroid:', e);
			return [0, 0];
		}
	}

	// Dynamic color function based on the selected color column
	function getPolygonFillColor(d: any) {
		// If no color column is selected or the value is null, return the default color
		if (!colorColumn || d.colorValue === null) {
			return [...defaultColor, Math.floor(fillOpacity * 255)];
		}

		// For numeric values, let the deck.gl layer handle the color scaling
		// by returning the raw value with the opacity
		return [d.colorValue, Math.floor(fillOpacity * 255)];
	}

	const loadData = async function* () {
		const db = SingletonDatabase.getInstance();
		const client = await db.init();
		if ($chosenDataset !== null) {
			var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);

			// Build column list for query
			const columns = [polygonColumn, idColumn];
			if (colorColumn) columns.push(colorColumn);
			if (labelColumn) columns.push(labelColumn);

			const columnsStr = columns.join(', ');
			const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
			yield* transformRows(stream.readRows());
		}
	};
</script>

<div class="grid grid-cols-2 gap-2">
	<div>
		<Label>Polygon Column</Label>
		<ColumnDropdown bind:chosenColumn={polygonColumn} />
	</div>
	<div>
		<Label>ID Column</Label>
		<ColumnDropdown bind:chosenColumn={idColumn} />
	</div>
</div>

<div class="mt-3 grid grid-cols-2 gap-2">
	<div>
		<Label>Color Column (Optional)</Label>
		<ColumnDropdown bind:chosenColumn={colorColumn} />
	</div>
	<div>
		<Label>Label Column (Optional)</Label>
		<ColumnDropdown bind:chosenColumn={labelColumn} />
	</div>
</div>

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

<div class="mt-3">
	<div class="grid grid-cols-2 gap-4">
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
	</div>
</div>

{#if labelColumn}
	<div class="mt-3 flex items-center">
		<input
			type="checkbox"
			bind:checked={showLabels}
			id="show-labels"
			class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
		/>
		<label for="show-labels" class="ml-2 text-sm text-gray-700">Show Labels</label>
	</div>
{/if}

{#if !requiredColumnsSelected}
	<div class="mt-2 text-amber-500">Please select polygon and ID columns to display data.</div>
{/if}
