<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { layers } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
	import { chosenDataset } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';
	import Sectional from './utils/sectional.svelte';

	const CHUNK_SIZE = 100000;

	let h3Column = $state<string | undefined>();
	let valueColumn = $state<string | undefined>();
	let colorScale = $state<string>('viridis');
	let opacity = $state<number>(0.8);
	let elevationScale = $state<number>(10);
	let extruded = $state<boolean>(false);
	let wireframe = $state<boolean>(true);
	let coverage = $state<number>(1.0);
	let hasInitialized = $state(false);
	let dataLoaded = $state(false);
	let valueRange = $state<[number, number]>([0, 1]);

	let { layer } = $props();

	// Available color scales (matching the scatter plot for consistency)
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

	// Use derived state for checking if required columns are selected
	let requiredColumnsSelected = $derived(h3Column !== undefined && valueColumn !== undefined);

	// Effect to update map when configuration changes
	$effect(() => {
		if (requiredColumnsSelected && !hasInitialized) {
			updateMapLayers();
			hasInitialized = true;
		}
	});

	// Update effect whenever key parameters change
	$effect(() => {
		if (hasInitialized) {
			updateMapLayers();
		}
	});

	async function* transformRows(rows: AsyncIterable<any>) {
		let hexagons = [];
		let values = [];

		for await (const row of rows) {
			// Skip rows with missing H3 indices or values
			//@ts-expect-error
			if (row[h3Column] === null || row[valueColumn] === null || isNaN(row[valueColumn])) {
				continue;
			}

			const hexagon = {
				//@ts-ignore
				hex: row[h3Column], //@ts-ignore
				value: row[valueColumn]
			};

			// Collect values for calculating ranges
			//@ts-ignore
			values.push(row[valueColumn]);
			hexagons.push(hexagon);

			if (hexagons.length >= CHUNK_SIZE) {
				// Process ranges before yielding first chunk
				if (!dataLoaded && values.length > 0) {
					valueRange = [Math.min(...values), Math.max(...values)];
					dataLoaded = true;
				}

				yield hexagons;
				hexagons = [];
			}
		}

		// Process ranges if this is the first and only chunk
		if (!dataLoaded && values.length > 0) {
			valueRange = [Math.min(...values), Math.max(...values)];
			dataLoaded = true;
		}

		if (hexagons.length > 0) {
			yield hexagons;
		}
	}

	function updateMapLayers() {
		layers.updateProps(layer.id, {
			data: loadData(),
			getHexagon: (d: any) => d.hex,
			getFillColor: [255, 140, 0, Math.floor(opacity * 255)], // Default color, will be handled by deck.gl's color mapping
			getElevation: (d: any) => (extruded ? d.value : 0),
			elevationScale: elevationScale,
			extruded: extruded,
			wireframe: wireframe,
			coverage: coverage,
			colorScale: colorScale,
			colorScaleType: scaleType,
			colorDomain: valueRange,
			getColorValue: (d: any) => d.value,
			opacity: opacity,
			pickable: true,
			autoHighlight: true,
			filled: true,
			updateTriggers: {
				getElevation: [elevationScale, extruded, valueRange],
				getColorValue: [valueColumn, valueRange],
				getFillColor: [colorScale, opacity]
			}
		});
	}

	const loadData = async function* () {
		const db = SingletonDatabase.getInstance();
		const client = await db.init();
		if ($chosenDataset !== null) {
			var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);
			const stream = await client.queryStream(
				`SELECT ${h3Column}, ${valueColumn} FROM ${filename}`
			);
			yield* transformRows(stream.readRows());
		}
	};
</script>

<Sectional label="Column Selection">
	<ColumnDropdown bind:chosenColumn={h3Column} default_column="H3" />
	<ColumnDropdown bind:chosenColumn={valueColumn} default_column="Value" />
</Sectional>

<Sectional label="Color Settings">
	<select
		class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
		bind:value={colorScale}
	>
		{#each colorScales as scale}
			<option value={scale}>{scale}</option>
		{/each}
	</select>

	<select
		class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
		bind:value={scaleType}
	>
		{#each scaleTypes as type}
			<option value={type}>{type}</option>
		{/each}
	</select>
</Sectional>

<Sectional label="Display Settings">
	<input type="range" min="0.1" max="1" step="0.05" bind:value={opacity} class="w-full" />
	<div class="flex justify-between text-xs text-gray-500">
		<span>Transparent</span>
		<span>Solid</span>
	</div>

	<input type="range" min="0.5" max="1" step="0.05" bind:value={coverage} class="w-full" />
	<div class="flex justify-between text-xs text-gray-500">
		<span>Small</span>
		<span>Full</span>
	</div>
</Sectional>

<Sectional label="3D Settings">
	<input
		type="checkbox"
		bind:checked={extruded}
		class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
	/>
	<span class="ml-2 text-sm text-gray-700">Show 3D Extrusion</span>

	{#if extruded}
		<div class="mt-3">
			<input type="range" min="1" max="100" step="1" bind:value={elevationScale} class="w-full" />
			<div class="flex justify-between text-xs text-gray-500">
				<span>Low</span>
				<span>High</span>
			</div>
		</div>
	{/if}

	<div class="mt-3">
		<input
			type="checkbox"
			bind:checked={wireframe}
			class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
		/>
		<span class="ml-2 text-sm text-gray-700">Show Wireframe</span>
	</div>
</Sectional>

{#if !requiredColumnsSelected}
	<div class="mt-2 text-amber-500">Please select H3 index and value columns to display data.</div>
{/if}
