<script module lang="ts">
	import { searchDatasetsByFilename } from '$lib/io/FileUtils';
	import { get } from 'svelte/store';

	export function openDatasetDialog(file: File) {
		dataTableDialogOpen.set(!get(dataTableDialogOpen));
		const dataset = searchDatasetsByFilename(get(datasets), file.name);
		currentDataset.set(dataset[0]);
	}

	export function openDatasetPreview(dataset: Dataset) {
		dataTableDialogOpen.set(!get(dataTableDialogOpen));
		currentDataset.set(dataset);
	}
</script>

<script lang="ts">
	import DataTable from '$lib/components/data-table/data-table.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { SingletonDatabase } from '$lib/io/DuckDBWASMClient.svelte';
	import { currentDataset, dataTableDialogOpen, datasets } from '$lib/io/stores';
	import { createTableColumns } from './columns';
	import type { Dataset } from '$lib/types';

	type ColumnTypes = 'string' | 'number' | 'date' | 'object';
	type Schema<Key extends string, T> = {
		columnName: Key;
		type: T;
	};
	type DatabaseSchema = Schema<string, ColumnTypes>[];

	// Function to fetch sample data and return a promise
	async function loadDataset(dataset: Dataset) {
		if (!dataset?.datasetName) {
			throw new Error('No dataset name provided');
		}

		const db = SingletonDatabase.getInstance({ logQueries: false });
		const client = await db.init();

		const result = await client.query(`SELECT * FROM ${dataset.datasetName} LIMIT 100`);

		// Map TableField schema to DatabaseSchema format
		const mappedSchema: DatabaseSchema = (dataset.schema || []).map((field) => ({
			columnName: field.name,
			type:
				field.type === 'string'
					? 'string'
					: field.type === 'number' || field.type === 'integer' || field.type === 'bigint'
						? 'number'
						: field.type === 'date'
							? 'date'
							: 'object'
		}));

		const columns = createTableColumns(mappedSchema);

		return {
			data: result,
			columns,
			dataset
		};
	}

	// Create a reactive promise that updates when currentDataset changes
	const datasetPromise = $derived.by(() => {
		if ($currentDataset && $dataTableDialogOpen) {
			return loadDataset($currentDataset);
		}
		return null;
	});
</script>

<Dialog.Root bind:open={$dataTableDialogOpen}>
	<Dialog.Content class="z-50 max-h-[95vh] max-w-7xl overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>
				Dataset Preview
				{#if $currentDataset}
					- {$currentDataset.datasetLabel}
				{/if}
			</Dialog.Title>
		</Dialog.Header>

		<div class="max-h-[75vh] overflow-auto p-2">
			{#if datasetPromise}
				{#await datasetPromise}
					<!-- Loading state -->
					<div class="flex justify-center p-8">
						<div class="text-muted-foreground">Loading data...</div>
					</div>
				{:then result}
					<!-- Success state -->
					<div class="space-y-4">
						<Dialog.Description>
							{result.data.length} rows • {result.columns.length} columns
						</Dialog.Description>
						<DataTable data={result.data} columns={result.columns} pageSize={50} />
					</div>
				{:catch error}
					<!-- Error state -->
					<div class="p-8 text-center text-red-500">
						<p class="font-semibold">Error loading data:</p>
						<p class="text-sm">{error.message}</p>
					</div>
				{/await}
			{:else}
				<!-- No dataset selected -->
				<div class="p-8 text-center text-muted-foreground">
					<p>No dataset selected</p>
					<p class="text-sm">Select a dataset to preview its data</p>
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
