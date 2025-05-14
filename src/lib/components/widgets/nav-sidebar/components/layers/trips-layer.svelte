<script lang="ts">
	import { layers } from '$lib/components/maps/layer-io.svelte';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import { checkNameForSpacesAndHyphens } from '$lib/components/io/FileUtils';
	import { chosenDataset } from '$lib/components/io/stores';
	import ColumnDropdown from './utils/column-dropdown.svelte';

	const CHUNK_SIZE = 100000;

	let fromLatitude = $state<string>('from-lat');
	let fromLongitude = $state<string>('from-long');
	let toLatitude = $state<string>('to-lat');
	let toLongitude = $state<string>('to-long');
	let timestampColumn = $state<string | null>(null);
	let weightColumn = $state<string | null>(null);
	let pathWidth = $state<number>(2);
	let animationSpeed = $state<number>(1);
	let trailLength = $state<number>(0.2); // Value from 0-1 for trail length

	let { layer } = $props();

	async function* transformRows(rows: AsyncIterable<any>) {
		let data = [];
		for await (const row of rows) {
			const trip = {
				path: [
					[row[fromLongitude], row[fromLatitude]],
					[row[toLongitude], row[toLatitude]]
				],
				timestamp: timestampColumn ? row[timestampColumn] : 0,
				weight: weightColumn ? row[weightColumn] : 1
			};

			data.push(trip);

			if (data.length >= CHUNK_SIZE) {
				yield data;
				data = [];
			}
		}

		if (data.length > 0) {
			yield data;
		}
	}

	let allRequiredColumnsSelected = $derived(
		fromLatitude !== 'from-lat' &&
			fromLongitude !== 'from-long' &&
			toLatitude !== 'to-lat' &&
			toLongitude !== 'to-long'
	);

	$effect(() => {
		if (allRequiredColumnsSelected) {
			layers.updateProps(layer.id, {
				data: loadData(),
				getPath: (d: any) => d.path,
				getTimestamps: (d: any) => [0, d.timestamp || 1], // Start and end timestamps
				getColor: [253, 128, 93],
				getWidth: (d: any) => d.weight * pathWidth,
				widthMinPixels: 2,
				widthMaxPixels: 20,
				rounded: true,
				fadeTrail: true,
				trailLength: trailLength,
				currentTime: 0,
				shadowEnabled: false,
				pickable: true
			});

			// Set up animation if timestamp column is selected
			if (timestampColumn) {
				setupAnimation();
			}
		}
	});

	// Animation reference and state
	let animationFrame: any;
	let startTime = 0;
	let currentTime = 0;
	let maxTime = 1;
	let isAnimating = $state(false);

	function setupAnimation() {
		// Clear any existing animation
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}

		// Only animate if we have a timestamp column
		if (!timestampColumn) return;

		isAnimating = false;
		currentTime = 0;
		maxTime = 1; // Will be updated with actual data

		// We'll update maxTime once data is loaded
		loadData()
			.next()
			.then((result) => {
				if (result.value && result.value.length > 0) {
					// Find the maximum timestamp
					maxTime = Math.max(...result.value.map((d) => d.timestamp || 1));
				}
			});
	}

	function toggleAnimation() {
		if (isAnimating) {
			// Stop animation
			cancelAnimationFrame(animationFrame);
			isAnimating = false;
		} else {
			// Start animation
			startTime = Date.now();
			isAnimating = true;
			animate();
		}
	}

	function animate() {
		const elapsed = (Date.now() - startTime) * animationSpeed;
		currentTime = (elapsed / 1000) % maxTime;

		// Update the current time in the layer
		layers.updateProps(layer.id, {
			currentTime: currentTime
		});

		animationFrame = requestAnimationFrame(animate);
	}

	const loadData = async function* () {
		const db = SingletonDatabase.getInstance();
		const client = await db.init();
		if ($chosenDataset !== null) {
			var filename = checkNameForSpacesAndHyphens($chosenDataset.filename);

			// Build column list for query
			const columns = [fromLatitude, fromLongitude, toLatitude, toLongitude];
			if (timestampColumn) columns.push(timestampColumn);
			if (weightColumn) columns.push(weightColumn);

			const columnsStr = columns.join(', ');

			const stream = await client.queryStream(`SELECT ${columnsStr} FROM ${filename}`);
			yield* transformRows(stream.readRows());
		}
	};

	// Clean up animation on component destruction
	function onDestroy() {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
	}

	$effect(() => {
		onDestroy();
	});
</script>

<div>
	<div>
		<ColumnDropdown bind:chosenColumn={fromLatitude} default_column="Starting Latitude" />
	</div>
	<div>
		<ColumnDropdown bind:chosenColumn={fromLongitude} default_column="Starting Longitude" />
	</div>
	<div>
		<ColumnDropdown bind:chosenColumn={toLatitude} default_column="Destination Latitude" />
	</div>
	<div>
		<ColumnDropdown bind:chosenColumn={toLongitude} default_column="Destination Longitude" />
	</div>
</div>

<div class="mt-3">
	<div class="grid grid-cols-2 gap-2">
		{#if timestampColumn && weightColumn}
			<div>
				<ColumnDropdown bind:chosenColumn={timestampColumn} default_column="Timestamp" />
			</div>
			<div>
				<ColumnDropdown bind:chosenColumn={weightColumn} default_column="Weight" />
			</div>
		{/if}
	</div>
</div>

{#if timestampColumn}
	<div class="mt-3">
		<div class="flex items-center justify-between">
			<button
				class="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
				onclick={toggleAnimation}
			>
				{isAnimating ? 'Pause' : 'Play'}
			</button>
		</div>

		<div class="mt-2 grid grid-cols-2 gap-4">
			<div>
				<input
					type="range"
					min="0.1"
					max="5"
					step="0.1"
					bind:value={animationSpeed}
					class="w-full"
				/>
				<div class="flex justify-between text-xs text-gray-500">
					<span>Slow</span>
					<span>Fast</span>
				</div>
			</div>
			<div>
				<input
					type="range"
					min="0.05"
					max="1"
					step="0.05"
					bind:value={trailLength}
					class="w-full"
				/>
				<div class="flex justify-between text-xs text-gray-500">
					<span>Short</span>
					<span>Long</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<div class="mt-3">
	<input type="range" min="0.5" max="10" step="0.5" bind:value={pathWidth} class="w-full" />
	<div class="flex justify-between text-xs text-gray-500">
		<span>Thin</span>
		<span>Thick</span>
	</div>
</div>

{#if !allRequiredColumnsSelected}
	<div class="mt-2 text-amber-500">Please select all four coordinate fields to display trips.</div>
{/if}
