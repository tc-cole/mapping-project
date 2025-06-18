<script lang="ts">
	import { datasets } from '$lib/io/stores';
	import type { Dataset } from '$lib/types'; // Import the Dataset type

	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { SingletonDatabase } from '$lib/io/DuckDBWASMClient.svelte';
	import { generateID } from '$lib/io/generateID';

	import { FileUpload, type FileUploadError } from 'melt/builders';
	import { LocationColumnDetector } from '$lib/io/location-detector';
	import { UploadIcon, X, Plus, Sparkles, FileIcon } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils';
	import { openDatasetDialog } from '../data-table/data-table-dialog-wrapper.svelte';

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

			// Import file into DuckDB
			const tableName = await client.importFile(file);
			const columns = await client.describeColumns(tableName);
			const stats = await client.tableStats(tableName);

			// Determine file type
			const fileExtension = file.name.split('.').pop()?.toLowerCase();
			const isGeographic = ['geojson', 'shp', 'kml'].includes(fileExtension || '');

			// Create base dataset following new interface
			const dataset: Dataset = {
				// Core Identity
				datasetID: generateID(),
				datasetLabel: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for label
				datasetType: 'file',
				datasetName: tableName,
				layerID: crypto.randomUUID?.() ?? `id-${Date.now()}`,

				// Schema & Structure
				schema: columns,
				rowCount: stats.rowCount,
				fileSize: file.size,

				// Source Information
				source: {
					type: 'file',
					originalFilename: file.name,
					fileType: fileExtension || 'unknown',
					uploadedAt: new Date(),
					fileHandle: file,
					importOptions: {} // Could store CSV delimiter, etc.
				},

				// Processing Status
				status: {
					state: 'processing',
					progress: 50,
					message: 'Analyzing data structure...'
				},

				// UI Metadata
				icon: FileIcon,
				color: getFileTypeColor(fileExtension || ''),
				tags: [fileExtension || 'unknown'],

				// Timestamps
				createdAt: new Date(),
				updatedAt: new Date(),

				// Performance & Indexing
				indexed: {
					spatialIndex: false,
					columnIndexes: [],
					optimized: false
				},

				// Statistics
				statistics: {
					rowCount: stats.rowCount,
					columnCount: columns.length,
					nullCounts: {}, // Could be calculated
					uniqueCounts: {} // Could be calculated
				}
			};

			// Add location-specific metadata for geographic files or detected coordinate data
			if (isGeographic) {
				// For geographic files, handle as geometry data
				await handleGeographicFile(dataset, client, tableName);
			} else {
				// For tabular data, detect location columns
				await detectLocationColumns(dataset, client, tableName, file.name);
			}

			// Final status update
			dataset.status = {
				state: 'ready',
				progress: 100,
				message: 'Dataset ready for use'
			};

			// Update datasets store
			datasets.update((current) => {
				return [...current, dataset];
			});
		} catch (error) {
			console.error('Error processing file:', error);

			// Create error dataset entry
			const errorDataset: Dataset = {
				datasetID: generateID(),
				datasetLabel: file.name,
				datasetType: 'file',
				datasetName: file.name,
				layerID: crypto.randomUUID?.() ?? `id-${Date.now()}`,

				schema: [],
				source: {
					type: 'file',
					originalFilename: file.name,
					fileType: file.name.split('.').pop() || 'unknown',
					uploadedAt: new Date(),
					fileHandle: file
				},
				status: {
					state: 'error',
					message: `Failed to process: ${error instanceof Error ? error.message : 'Unknown error'}`,
					errors: [
						{
							code: 'PROCESSING_ERROR',
							message: error instanceof Error ? error.message : 'Unknown error',
							severity: 'error'
						}
					]
				},
				createdAt: new Date(),
				updatedAt: new Date()
			};

			datasets.update((current) => [...current, errorDataset]);
		} finally {
			isProcessing = false;
			processingFile = '';
		}
	}

	async function detectLocationColumns(
		dataset: Dataset,
		client: any,
		tableName: string,
		filename: string
	) {
		const locations = new LocationColumnDetector();

		const inputColumns = dataset.schema.map((c: { name: string; type: string }) => ({
			name: c.name,
			type: c.type
		}));

		// Basic location column detection
		let locationColumns = locations.detectLocationColumns(inputColumns);
		let sampleDataAnalyzed = false;

		try {
			// Get sample data for more accurate detection
			const sampleData = await client.query(`SELECT * FROM ${tableName} LIMIT 5`);

			if (sampleData.length > 0) {
				locationColumns = locations.detectWithSampleData(inputColumns, sampleData);
				sampleDataAnalyzed = true;
			}
		} catch (error) {
			console.warn('Could not analyze sample data for location detection:', error);
		}

		// Generate coordinate pair suggestions
		const suggestedCoordinatePairs = locations.suggestCoordinatePairs(locationColumns);

		// Add location metadata if location columns detected
		if (locationColumns.length > 0) {
			dataset.metadata = {
				location: {
					recommendations: {
						detectedColumns: locationColumns,
						suggestedCoordinatePairs,
						analyzedAt: new Date(),
						sampleDataAnalyzed,
						fileProcessed: filename
					},
					chosenColumns: {
						// Initialize with best suggestions if confidence is high
						...(suggestedCoordinatePairs[0]?.confidence > 0.8 && {
							latitude: suggestedCoordinatePairs[0].latitude,
							longitude: suggestedCoordinatePairs[0].longitude
						})
					}
				}
			};

			// Update tags to include geographic info
			dataset.tags = [...(dataset.tags || []), 'geographic'];
		}
	}

	async function handleGeographicFile(dataset: Dataset, client: any, tableName: string) {
		try {
			// For GeoJSON/Shapefile, detect geometry columns and bounds
			const geomSample = await client.query(`SELECT * FROM ${tableName} LIMIT 1`);

			if (geomSample.length > 0) {
				// Find geometry column (could be 'geometry', 'geom', or similar)
				const geomColumn = dataset.schema.find(
					(col) =>
						col.name.toLowerCase().includes('geom') ||
						col.databaseType.toLowerCase().includes('geometry')
				);

				if (geomColumn) {
					dataset.metadata = {
						geometry: {
							geometryId: generateID(),
							shape: {
								type: 'Polygon', // Default, should be detected from actual data
								featureCount: dataset.rowCount || 0,
								bounds: {
									north: 0,
									south: 0,
									east: 0,
									west: 0 // Should calculate from data
								}
							},
							drawingContext: {
								tool: 'polygon', // Will vary based on geometry type
								createdBy: 'import'
							},
							properties: {
								hasZ: false,
								hasM: false,
								coordinateCount: 0 // Should calculate from data
							},
							usage: {
								usedAsFilter: false,
								usedAsMask: false,
								linkedLayerIds: []
							}
						}
					};

					// Update tags
					dataset.tags = [...(dataset.tags || []), 'geometry', 'vector'];
				}
			}
		} catch (error) {
			console.warn('Could not analyze geographic data:', error);
		}
	}

	function getFileTypeColor(fileType: string): string {
		const colorMap: Record<string, string> = {
			csv: '#10b981', // green
			json: '#f59e0b', // amber
			geojson: '#3b82f6', // blue
			parquet: '#8b5cf6', // violet
			shp: '#06b6d4', // cyan
			xlsx: '#10b981', // green
			default: '#6b7280' // gray
		};
		return colorMap[fileType] || colorMap.default;
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
								<button
									class={buttonVariants({ variant: 'ghost' })}
									onclick={() => {
										openDatasetDialog(file);
									}}
								>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-gray-900 dark:text-white">
											{file.name}
										</p>
										<div class="flex items-center gap-2">
											<p class="truncate text-xs text-gray-500 dark:text-gray-400">
												{file.type}
											</p>
											{#if isProcessing && processingFile === file.name}
												<div class="flex items-center gap-1">
													<span class="animate-pulse text-xs text-blue-600">Analyzing...</span>
												</div>
											{/if}
										</div>
									</div>

									<div class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
										{formatFileSize(file.size)}
									</div>
								</button>
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
		</div>
	</Dialog.Content>
</Dialog.Root>
