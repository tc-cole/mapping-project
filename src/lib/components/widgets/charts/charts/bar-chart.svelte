<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { scaleBand } from 'd3-scale';
	import { BarChart } from 'layerchart';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import { clickedGeoJSON, selectedGeometryId } from '$lib/components/io/stores';

	let { data = [] } = $props();

	// Reactive state for chart data
	let chartData = $state<any[]>([]);
	let isLoading = $state(false);
	let error = $state(null);
	let currentTableName = $state<string | null>(null);

	const chartConfig = {
		count: {
			label: 'Point Count',
			color: '#2563eb'
		},
		density: {
			label: 'Density',
			color: '#60a5fa'
		}
	} satisfies Chart.ChartConfig;

	// React to geometry selection changes
	$effect(() => {
		if ($clickedGeoJSON && $selectedGeometryId) {
			// Try to find the corresponding filter table
			findAndLoadFilterTable();
		} else {
			// No geometry selected, clear chart
			chartData = [];
			currentTableName = null;
		}
	});

	async function findAndLoadFilterTable() {
		try {
			isLoading = true;
			error = null;

			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			// List all tables to find filter tables
			const tables = await client.listTables();

			// Find tables that start with 'filter_' or 'filtered_'
			const filterTables = tables.filter(
				(table) => table.name.startsWith('filter_') || table.name.startsWith('filtered_')
			);

			if (filterTables.length === 0) {
				console.log('No filter tables found');
				chartData = [];
				return;
			}

			// Use the most recent filter table (or implement your own logic)
			// You could also match by geometry ID if you store it in the table name
			const latestTable = filterTables.sort((a, b) => b.name.localeCompare(a.name))[0];
			currentTableName = latestTable.name;

			console.log(`Using filter table: ${currentTableName}`);

			await loadChartDataFromTable(currentTableName);
		} catch (err: any) {
			console.error('Error finding filter table:', err);
			error = err.message;
			chartData = [];
		} finally {
			isLoading = false;
		}
	}

	async function loadChartDataFromTable(tableName: string | null) {
		if (!tableName) return;

		try {
			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			// First, get the table structure to understand what columns we have
			const columns = await client.describeColumns(tableName);
			console.log('Filter table columns:', columns);

			// Assume first two columns are lat/long (adjust based on your data)
			const latCol = columns[0]?.name;
			const lngCol = columns[1]?.name;

			if (!latCol || !lngCol) {
				throw new Error('Could not identify lat/lng columns');
			}

			// Get total count for percentage calculations
			const totalCount = await client.queryScalar(`SELECT COUNT(*) FROM ${tableName}`);

			// Simple latitude band aggregation
			const query = `
				SELECT 
					ROUND(${latCol}, 1) as lat_band,
					COUNT(*) as point_count
				FROM ${tableName}
				GROUP BY ROUND(${latCol}, 1)
				ORDER BY lat_band
			`;

			const results = await client.query(query);

			// Transform for chart
			chartData = results.map((row) => ({
				lat_band: `${row.lat_band}°`,
				count: row.point_count, //@ts-ignore
				density: Math.round((row.point_count / totalCount) * 100)
			}));

			console.log(`Loaded ${chartData.length} latitude bands`);
		} catch (err: any) {
			console.error('Error loading chart data:', err);
			error = err.message;
			chartData = [];
		}
	}

	// Alternative aggregation by longitude
	async function loadLongitudeBands() {
		if (!currentTableName) return;

		try {
			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			const columns = await client.describeColumns(currentTableName);
			const latCol = columns[0]?.name;
			const lngCol = columns[1]?.name;

			const totalCount = await client.queryScalar(`SELECT COUNT(*) FROM ${currentTableName}`);

			const query = `
				SELECT 
					ROUND(${lngCol}, 1) as lng_band,
					COUNT(*) as point_count
				FROM ${currentTableName}
				GROUP BY ROUND(${lngCol}, 1)
				ORDER BY lng_band
			`;

			const results = await client.query(query);

			chartData = results.map((row) => ({
				lng_band: `${row.lng_band}°`,
				count: row.point_count, //@ts-ignore
				density: Math.round((row.point_count / totalCount) * 100)
			}));
		} catch (err) {
			console.error('Error loading longitude bands:', err);
		}
	}

	// Simple stats aggregation
	async function loadBasicStats() {
		if (!currentTableName) return;

		try {
			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			const columns = await client.describeColumns(currentTableName);
			const latCol = columns[0]?.name;
			const lngCol = columns[1]?.name;

			const query = `
				SELECT 
					'Total Points' as category,
					COUNT(*) as count,
					100 as density
				FROM ${currentTableName}
				UNION ALL
				SELECT 
					'Unique Latitudes' as category,
					COUNT(DISTINCT ROUND(${latCol}, 2)) as count,
					0 as density
				UNION ALL
				SELECT 
					'Unique Longitudes' as category,
					COUNT(DISTINCT ROUND(${lngCol}, 2)) as count,
					0 as density
			`;

			const results = await client.query(query);

			chartData = results.map((row) => ({
				category: row.category,
				count: row.count,
				density: row.density
			}));
		} catch (err) {
			console.error('Error loading basic stats:', err);
		}
	}

	// Manual refresh function
	async function refreshChart() {
		if ($clickedGeoJSON) {
			await findAndLoadFilterTable();
		}
	}
</script>

{#if error}
	<div class="rounded border border-red-200 bg-red-50 p-4 text-red-700">
		<p class="text-sm">Error loading chart data: {error}</p>
		<button class="mt-2 text-xs text-blue-600 underline" onclick={refreshChart}> Try again </button>
	</div>
{:else if isLoading}
	<div class="flex items-center justify-center p-8">
		<div class="text-sm text-gray-500">Loading chart data...</div>
	</div>
{:else if chartData.length === 0}
	<div class="rounded border border-gray-200 bg-gray-50 p-4">
		<p class="text-sm text-gray-600">
			{#if $clickedGeoJSON}
				No data available for selected geometry
			{:else}
				Click on a geometry to view chart data
			{/if}
		</p>
		{#if currentTableName}
			<p class="mt-1 text-xs text-gray-500">Table: {currentTableName}</p>
		{/if}
	</div>
{:else}
	<div class="space-y-4">
		<!-- Chart controls -->
		<div class="flex gap-2">
			<button
				class="rounded bg-blue-100 px-3 py-1 text-xs text-blue-700 hover:bg-blue-200"
				onclick={() => loadChartDataFromTable(currentTableName)}
			>
				Latitude Bands
			</button>
			<button
				class="rounded bg-green-100 px-3 py-1 text-xs text-green-700 hover:bg-green-200"
				onclick={loadLongitudeBands}
			>
				Longitude Bands
			</button>
			<button
				class="rounded bg-purple-100 px-3 py-1 text-xs text-purple-700 hover:bg-purple-200"
				onclick={loadBasicStats}
			>
				Basic Stats
			</button>
		</div>

		<!-- Chart -->
		<Chart.Container config={chartConfig} class="min-h-[200px] w-full">
			<BarChart
				data={chartData}
				xScale={scaleBand().padding(0.25)}
				x={chartData[0]?.lat_band ? 'lat_band' : chartData[0]?.lng_band ? 'lng_band' : 'category'}
				axis="x"
				seriesLayout="group"
				tooltip={true}
				series={[
					{
						key: 'count',
						label: chartConfig.count.label,
						color: chartConfig.count.color
					},
					{
						key: 'density',
						label: chartConfig.density.label,
						color: chartConfig.density.color
					}
				]}
			/>
		</Chart.Container>

		<!-- Data summary -->
		<div class="text-xs text-gray-500">
			Showing {chartData.length} groups from {currentTableName}
		</div>
	</div>
{/if}
