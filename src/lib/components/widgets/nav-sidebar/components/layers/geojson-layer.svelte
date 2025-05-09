<script lang="ts">
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { layers } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
	import { chosenDataset } from '$lib/components/io/stores';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import ColumnDropdown from './utils/column-dropdown.svelte';
	import { Label } from '$lib/components/ui/label/index.js';

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
		let features: any[] = [];
		let colorValues: number[] = [];
		let elevationValues: number[] = [];

		for await (const row of rows) {
			// Skip rows with missing geojson
			//@ts-expect-error
			if (row[geojsonColumn] === null) {
				continue;
			}

			let geojson;
			try {
				// Check if the GeoJSON is stored as a string or object
				//@ts-expect-error
				if (typeof row[geojsonColumn] === 'string') {
					//@ts-expect-error

					geojson = JSON.parse(row[geojsonColumn]);
				} else {
					//@ts-expect-error

					geojson = row[geojsonColumn];
				}

				// Process based on GeoJSON type
				if (geojson.type === 'Feature') {
					// Add properties if they exist
					if (!geojson.properties) {
						geojson.properties = {};
					}

					if (colorProperty && row[colorProperty] !== undefined && row[colorProperty] !== null) {
						geojson.properties.colorValue = row[colorProperty];
						colorValues.push(row[colorProperty]);
					}

					if (
						extruded &&
						elevationProperty &&
						row[elevationProperty] !== undefined &&
						row[elevationProperty] !== null
					) {
						geojson.properties.elevationValue = row[elevationProperty];
						elevationValues.push(row[elevationProperty]);
					}

					features.push(geojson);
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
					const properties: any = {};

					if (colorProperty && row[colorProperty] !== undefined && row[colorProperty] !== null) {
						properties.colorValue = row[colorProperty];
						colorValues.push(row[colorProperty]);
					}

					if (
						extruded &&
						elevationProperty &&
						row[elevationProperty] !== undefined &&
						row[elevationProperty] !== null
					) {
						properties.elevationValue = row[elevationProperty];
						elevationValues.push(row[elevationProperty]);
					}

					const feature = {
						type: 'Feature',
						geometry: geojson,
						properties: properties
					};

					features.push(feature);
				}
				// Handle FeatureCollection
				else if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
					// Add properties to each feature in the collection
					geojson.features.forEach((feature: any) => {
						if (!feature.properties) {
							feature.properties = {};
						}

						if (colorProperty && row[colorProperty] !== undefined && row[colorProperty] !== null) {
							feature.properties.colorValue = row[colorProperty];
							colorValues.push(row[colorProperty]);
						}

						if (
							extruded &&
							elevationProperty &&
							row[elevationProperty] !== undefined &&
							row[elevationProperty] !== null
						) {
							feature.properties.elevationValue = row[elevationProperty];
							elevationValues.push(row[elevationProperty]);
						}
					});

					features = features.concat(geojson.features);
				}
			} catch (e) {
				console.error('Failed to parse GeoJSON:', e);
				continue;
			}

			if (features.length >= CHUNK_SIZE) {
				// Process ranges before yielding first chunk
				if (!dataLoaded && colorValues.length > 0) {
					colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
					dataLoaded = true;
				}

				yield {
					type: 'FeatureCollection',
					features: features
				};

				features = [];
			}
		}

		// Process ranges if this is the first and only chunk
		if (!dataLoaded && colorValues.length > 0) {
			colorRange = [Math.min(...colorValues), Math.max(...colorValues)];
			dataLoaded = true;
		}

		if (features.length > 0) {
			yield {
				type: 'FeatureCollection',
				features: features
			};
		}
	}

	function updateMapLayers() {
		layers.updateProps(layer.id, {
			data: loadData(),
			filled: true,
			stroked: true,
			lineWidthScale: lineWidth,
			getFillColor: [140, 170, 180, Math.floor(fillOpacity * 255)],
			getLineColor: [0, 0, 0, Math.floor(lineOpacity * 255)],
			getColorValue: (f: any) => f.properties?.colorValue,
			getElevation: extruded ? (f: any) => f.properties?.elevationValue || 0 : 0,
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
			}
		});
	}

	const loadData = async function* () {
		const db = SingletonDatabase.getInstance();
		const client = await db.init();
		if ($chosenDataset !== null) {
			var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);
			const columnsList = [geojsonColumn];

			if (colorProperty) {
				columnsList.push(colorProperty);
			}

			if (extruded && elevationProperty) {
				columnsList.push(elevationProperty);
			}

			const columnsStr = columnsList.join(', ');
			const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
			yield* transformRows(stream.readRows());
		}
	};
</script>

<div class="grid grid-cols-2 gap-2">
	<div class="col-span-2">
		<Label>GeoJSON Column</Label>
		<ColumnDropdown bind:chosenColumn={geojsonColumn} />
	</div>
</div>

<div class="mt-3 grid grid-cols-2 gap-2">
	<div>
		<Label>Color Property (Optional)</Label>
		<ColumnDropdown bind:chosenColumn={colorProperty} />
	</div>
	<div>
		<Label>Scale Type</Label>
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

<div class="mt-3">
	<div>
		<label class="flex items-center">
			<input
				type="checkbox"
				bind:checked={extruded}
				class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
			/>
			<span class="ml-2 text-sm text-gray-700">Show 3D Extrusion</span>
		</label>
	</div>
</div>

{#if extruded}
	<div class="mt-3 grid grid-cols-2 gap-2">
		<div>
			<Label>Elevation Property</Label>
			<ColumnDropdown bind:chosenColumn={elevationProperty} />
		</div>
		<div>
			<Label>Elevation Scale</Label>
			<input type="range" min="1" max="100" step="1" bind:value={elevationScale} class="w-full" />
		</div>
	</div>
{/if}

<div class="mt-3 grid grid-cols-2 gap-4">
	<div>
		<Label>Line Width</Label>
		<input type="range" min="0.5" max="5" step="0.5" bind:value={lineWidth} class="w-full" />
		<div class="flex justify-between text-xs text-gray-500">
			<span>Thin</span>
			<span>Thick</span>
		</div>
	</div>
	<div>
		<Label>Fill Opacity</Label>
		<input type="range" min="0" max="1" step="0.05" bind:value={fillOpacity} class="w-full" />
		<div class="flex justify-between text-xs text-gray-500">
			<span>Transparent</span>
			<span>Solid</span>
		</div>
	</div>
</div>

<div class="mt-3">
	<Label>Line Opacity</Label>
	<input type="range" min="0" max="1" step="0.05" bind:value={lineOpacity} class="w-full" />
	<div class="flex justify-between text-xs text-gray-500">
		<span>Transparent</span>
		<span>Solid</span>
	</div>
</div>

{#if !requiredColumnsSelected}
	<div class="mt-2 text-amber-500">Please select a GeoJSON column to display data.</div>
{/if}
