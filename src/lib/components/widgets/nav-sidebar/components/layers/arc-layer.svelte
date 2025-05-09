<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { layers } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
	import { chosenDataset } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';

	const CHUNK_SIZE = 100000;

	let fromLatitude = $state<string | undefined>();
	let fromLongitude = $state<string | undefined>();
	let toLatitude = $state<string | undefined>();
	let toLongitude = $state<string | undefined>();

	let widthColumn = $state<string | null>(null);
	let colorColumn = $state<string | null>(null);
	let labelColumn = $state<string | null>(null);

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
	let widthRange = [0, 1];
	let colorRange = [0, 1];
	let dataLoaded = $state(false);
	let hasInitialized = $state(false);

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(
		fromLatitude !== undefined &&
			fromLongitude !== undefined &&
			toLatitude !== undefined &&
			toLongitude !== undefined
	);

	// Derive the map layer configuration based on all input parameters
	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			updateMapLayers();
			hasInitialized = true;
			console.log($layers);
		}
	});

	async function* transformRows(rows: AsyncIterable<any>) {
		let arcs = [];
		let widthValues = [];
		let colorValues = [];

		for await (const row of rows) {
			// Skip rows with missing coordinates
			if (
				//@ts-expect-error
				row[fromLatitude] === null || //@ts-expect-error
				row[fromLongitude] === null || //@ts-expect-error
				row[toLatitude] === null || //@ts-expect-error
				row[toLongitude] === null
			) {
				continue;
			}

			const arc = {
				//@ts-expect-error
				sourcePosition: [row[fromLongitude], row[fromLatitude]], //@ts-expect-error
				targetPosition: [row[toLongitude], row[toLatitude]],
				width: widthColumn ? row[widthColumn] : 1,
				color: colorColumn ? row[colorColumn] : null,
				label: labelColumn ? row[labelColumn] : null
			};

			// Collect values for calculating ranges
			if (widthColumn && row[widthColumn] !== null) {
				widthValues.push(row[widthColumn]);
			}

			if (colorColumn && row[colorColumn] !== null) {
				colorValues.push(row[colorColumn]);
			}

			arcs.push(arc);

			if (arcs.length >= CHUNK_SIZE) {
				// Process ranges before yielding first chunk
				if (!dataLoaded && (widthValues.length > 0 || colorValues.length > 0)) {
					if (widthValues.length > 0) {
						widthRange = [Math.min(...widthValues), Math.max(...widthValues)];
					}
					if (colorValues.length > 0) {
						colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
					}
					dataLoaded = true;
				}

				yield arcs;
				arcs = [];
			}
		}

		// Process ranges if this is the first and only chunk
		if (!dataLoaded && (widthValues.length > 0 || colorValues.length > 0)) {
			if (widthValues.length > 0) {
				widthRange = [Math.min(...widthValues), Math.max(...widthValues)];
			}
			if (colorValues.length > 0) {
				colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
			}
			dataLoaded = true;
		}

		if (arcs.length > 0) {
			yield arcs;
		}
	}

	function updateMapLayers() {
		// Update main arc layer
		layers.updateProps(layer.id, {
			data: loadData(),
			getSourcePosition: (d: any) => d.sourcePosition,
			getTargetPosition: (d: any) => d.targetPosition,
			getWidth: getArcWidth,
			getSourceColor: [0, 64, 128],
			getTargetColor: [255, 128, 0],
			getColor: getArcColor,
			widthScale: 1,
			widthMinPixels: 1,
			widthMaxPixels: 20,
			opacity: opacity,
			pickable: true,
			autoHighlight: true,
			getHeight: (d: any) => {
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
			colorScale: colorScale,
			updateTriggers: {
				getWidth: [arcWidth, widthColumn, minArcWidth, maxArcWidth, widthRange],
				getColor: [colorColumn, colorScale, colorRange, opacity],
				getHeight: [arcHeight, arcHeightMultiplier]
			}
		});

		// Update text labels layer
		layers.updateProps(`${layer.id}-labels`, {
			data: loadData,
			getPosition: (d: any) => {
				// Position label at the midpoint of the arc
				const sourceLng = d.sourcePosition[0];
				const sourceLat = d.sourcePosition[1];
				const targetLng = d.targetPosition[0];
				const targetLat = d.targetPosition[1];

				return [(sourceLng + targetLng) / 2, (sourceLat + targetLat) / 2];
			},
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

	// Dynamic arc width calculation
	function getArcWidth(arc: any) {
		if (!widthColumn || arc.width === null) {
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

	// Dynamic color calculation
	function getArcColor(arc: any) {
		if (!colorColumn || arc.color === null) {
			return [0, 128, 255, Math.floor(opacity * 255)]; // Default blue
		}

		// In a real implementation, this would use the appropriate color scale
		// Here we're just passing the value along and assuming the layer will handle color mapping
		return [arc.color, Math.floor(opacity * 255)];
	}

	const loadData = async function* () {
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

			const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
			yield* transformRows(stream.readRows());
		}
	};

	// Track changes in parameters and update the layer
	$effect(() => {
		if (hasInitialized && requiredColumnsSelected) {
			updateMapLayers();
		}
	});
</script>

<div class="grid grid-cols-2 gap-2">
	<div>
		<Label>From Latitude</Label>
		<ColumnDropdown bind:chosenColumn={fromLatitude} />
	</div>
	<div>
		<Label>From Longitude</Label>
		<ColumnDropdown bind:chosenColumn={fromLongitude} />
	</div>
</div>

<div class="mt-3 grid grid-cols-2 gap-2">
	<div>
		<Label>To Latitude</Label>
		<ColumnDropdown bind:chosenColumn={toLatitude} />
	</div>
	<div>
		<Label>To Longitude</Label>
		<ColumnDropdown bind:chosenColumn={toLongitude} />
	</div>
</div>

<div class="mt-3 grid grid-cols-2 gap-2">
	<div>
		<Label>Width Column (Optional)</Label>
		<ColumnDropdown bind:chosenColumn={widthColumn} />
	</div>
	<div>
		<Label>Color Column (Optional)</Label>
		<ColumnDropdown bind:chosenColumn={colorColumn} />
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
			<Label>Arc Width</Label>
			<input type="range" min="1" max="10" step="0.5" bind:value={arcWidth} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Thin</span>
				<span>Thick</span>
			</div>
		</div>
		<div>
			<Label>Opacity</Label>
			<input type="range" min="0.1" max="1" step="0.05" bind:value={opacity} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Transparent</span>
				<span>Solid</span>
			</div>
		</div>
	</div>
</div>

<div class="mt-3">
	<div class="grid grid-cols-2 gap-4">
		<div>
			<Label>Arc Height</Label>
			<input type="range" min="0" max="5" step="0.1" bind:value={arcHeight} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Flat</span>
				<span>Curved</span>
			</div>
		</div>
		<div>
			<Label>Height Multiplier</Label>
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
</div>

{#if widthColumn}
	<div class="mt-3">
		<Label>Width Range</Label>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<Label>Min Width</Label>
				<input type="range" min="0.5" max="5" step="0.5" bind:value={minArcWidth} class="w-full" />
			</div>
			<div>
				<Label>Max Width</Label>
				<input type="range" min="5" max="50" step="1" bind:value={maxArcWidth} class="w-full" />
			</div>
		</div>
	</div>
{/if}

<div class="mt-3">
	<div>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<Label>Label Column (Optional)</Label>
				<ColumnDropdown bind:chosenColumn={labelColumn} />
			</div>
			<div class="flex h-full items-center">
				<label class="flex items-center">
					<input
						type="checkbox"
						bind:checked={showLabels}
						class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
						disabled={!labelColumn}
					/>
					<span class="ml-2 text-sm text-gray-700">Show Labels</span>
				</label>
			</div>
		</div>
	</div>
</div>

{#if !requiredColumnsSelected}
	<div class="mt-2 text-amber-500">
		Please select source and destination coordinates to display arcs.
	</div>
{/if}
