<script lang="ts">
	import { datasets } from '$lib/io/stores';

	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { SingletonDatabase } from '$lib/io/DuckDBWASMClient.svelte';
	import { generateID } from '$lib/io/generateID';

	import { FileUpload, type FileUploadError } from 'melt/builders';
	import { LocationColumnDetector } from '$lib/io/location-detector';
	import { UploadIcon, X, Plus, Sparkles } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils';

	// Add upload progress state
	let isProcessing = $state(false);
	let processingFile = $state<string>('');

	const fileUpload = new FileUpload({
		selected: [],
		onError: (e: FileUploadError) => {
			console.error(e);
		},
		onAccept: async (f: File) => {
			try {
				await processFileForDatabase(f);
			} catch (error) {
				console.log('Error processing file:', error);
			}
		},
		multiple: true,
		accept: '.csv, .parquet, .json, .geojson, .shp'
	});

	async function processFileForDatabase(file: File) {
		isProcessing = true;
		processingFile = file.name;

		try {
			const db = SingletonDatabase.getInstance();
			const client = await db.init();

			// Process each accepted file
			const fname = await client.importFile(file);
			const columns = await client.describeColumns(fname);

			// Enhanced dataset object with location recommendations
			const dataset = {
				datasetID: generateID(),
				schema: columns,
				datasetName: fname,
				locationRecommendations: undefined as any // Will be filled below
			};

			const locations = new LocationColumnDetector();

			const inputColumns = dataset.schema.map((c) => ({
				name: c.name,
				type: c.type
			}));

			// Basic location column detection
			const locationColumns = locations.detectLocationColumns(inputColumns);

			// Enhanced analysis with sample data for better accuracy
			let enhancedDetections = locationColumns;
			let sampleDataAnalyzed = false;

			try {
				// Get sample data for more accurate detection
				const sampleData = await client.query(`SELECT * FROM ${fname} LIMIT 5`);

				if (sampleData.length > 0) {
					enhancedDetections = locations.detectWithSampleData(inputColumns, sampleData);
					sampleDataAnalyzed = true;
				}
			} catch (error) {
				console.warn('Could not analyze sample data for location detection:', error);
			}

			// Generate coordinate pair suggestions
			const suggestedCoordinatePairs = locations.suggestCoordinatePairs(enhancedDetections);

			// Store location recommendations in dataset
			dataset.locationRecommendations = {
				detectedColumns: enhancedDetections,
				suggestedCoordinatePairs,
				analyzedAt: new Date(),
				sampleDataAnalyzed,
				fileProcessed: file.name
			};

			// Auto-create a layer if we have high-confidence coordinate detection			const bestPair = suggestedCoordinatePairs[0];

			// Update datasets store
			datasets.update((current) => {
				return [...current, dataset];
			});
		} catch (error) {
			console.error('Error processing file:', error);
		}
	}

	const files = $derived.by(() => {
		if (fileUpload.selected instanceof SvelteSet) {
			return Array.from(fileUpload.selected) as File[];
		}
		return fileUpload.selected ? [fileUpload.selected as File] : [];
	});

	function formatFileSize(bytes: number) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
</script>

<Dialog.Root>
	<div class="bg-grey-800 w-full">
		<Dialog.Trigger
			class={cn(
				buttonVariants({ variant: 'outline', size: 'lg' }),
				'border-gray-600 bg-gray-800 text-lg font-medium text-gray-200 hover:bg-gray-700 hover:text-white'
			)}
		>
			{#snippet child({ props }: { props: any })}
				<div {...props}>
					<span>Add Dataset</span>
					<Plus />
				</div>
			{/snippet}
		</Dialog.Trigger>
	</div>

	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Upload Dataset</Dialog.Title>
			<Dialog.Description
				>Upload your files to create a new dataset with smart location detection.</Dialog.Description
			>
		</Dialog.Header>
		<div class="flex flex-col items-center gap-4">
			<input {...fileUpload.input} />
			<div
				{...fileUpload.dropzone}
				class="relative flex min-h-[200px] w-[300px] cursor-pointer
									flex-col items-center justify-center gap-4
									rounded-xl border-2 border-dashed border-gray-300 bg-gray-50
									p-6 text-center transition-colors
									hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
				class:!border-accent-500={fileUpload.isDragging}
			>
				{#if fileUpload.isDragging}
					<p class="text-accent-400 font-medium">Drop files here</p>
				{:else}
					<div class="pointer-events-none flex flex-col items-center gap-2">
						<UploadIcon class="text-4xl" />

						<p class="text-sm text-gray-500 dark:text-gray-400">
							<span class="font-semibold text-gray-900 dark:text-white">Click to upload</span>
							or drag and drop
						</p>
						<p class="text-xs text-gray-400 dark:text-gray-500">
							Supports CSV, Parquet, JSON, GeoJSON, and Shapefiles
						</p>
					</div>
				{/if}
			</div>

			{#if files.length > 0}
				<ul class="w-[300px] list-none divide-y divide-gray-200 p-0 dark:divide-gray-700">
					{#each files as file}
						<li class="flex items-center gap-2 overflow-hidden py-3">
							<div class="flex min-w-0 flex-1 items-center justify-between gap-8">
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-gray-900 dark:text-white">
										{file.name}
									</p>
									<div class="flex items-center gap-2">
										<p class="truncate text-xs text-gray-500 dark:text-gray-400">
											{file.type}
										</p>
									</div>
								</div>
								<div class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
									{formatFileSize(file.size)}
								</div>
							</div>
							<button
								class="grid place-items-center bg-transparent text-gray-500
												hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-300"
								onclick={() => {
									fileUpload.remove(file);
								}}
								disabled={isProcessing && processingFile === file.name}
							>
								<X />
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<!--
			{#if isProcessing}
				<div
					class="w-[300px] rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950"
				>
					<div class="flex items-center gap-2 text-sm">
						<Sparkles class="h-4 w-4 text-blue-600" />
						<span class="font-medium text-blue-900 dark:text-blue-100">Smart Analysis Active</span>
					</div>
					<p class="mt-1 text-xs text-blue-700 dark:text-blue-300">
						Detecting location columns and suggesting coordinate pairs...
					</p>
				</div>
			{/if}
			-->
		</div>
	</Dialog.Content>
</Dialog.Root>
