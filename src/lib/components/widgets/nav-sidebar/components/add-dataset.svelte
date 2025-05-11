<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index';
	import { Plus } from '@lucide/svelte';
	import Dropzone from './dropzone/add-data-dropzone.svelte';
	import { SingletonDatabase } from '$lib/components/io/DuckDBWASMClient.svelte';
	import { fileUploadStore } from '$lib/components/io/stores';
	import { generateID } from '$lib/components/io/generateID';

	let files = {
		accepted: [],
		rejected: []
	};

	async function handleFilesSelect(e: any) {
		const db = SingletonDatabase.getInstance();

		const client = await db.init();
		const { acceptedFiles, fileRejections } = e.detail; //@ts-expect-error
		files.accepted = [...files.accepted, ...acceptedFiles]; //@ts-expect-error
		files.rejected = [...files.rejected, ...fileRejections];
		const fname = await client.importFile(files.accepted[0]);

		const columns = await client.describeColumns(fname);
		const dataset = {
			datasetID: generateID(),
			schema: columns,
			filename: fname
		};

		fileUploadStore.update((current) => {
			return [...current, dataset];
		});
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>
		<div class="flex flex-row">
			Datasets
			<Sidebar.GroupAction>
				<Dialog.Root>
					<Dialog.Trigger>
						{#snippet child({ props })}
							<Plus {...props} />
							<span class="sr-only">Add Project</span>
						{/snippet}
					</Dialog.Trigger>
					<Dialog.Content>
						<Dialog.Header>
							<Dialog.Title>Are you sure absolutely sure?</Dialog.Title>
							<Dialog.Description>
								This action cannot be undone. This will permanently delete your account and remove
								your data from our servers.
							</Dialog.Description>
						</Dialog.Header>
						<Dropzone ondrop={handleFilesSelect} />
					</Dialog.Content>
				</Dialog.Root>
			</Sidebar.GroupAction>
		</div>
	</Sidebar.GroupLabel>
</Sidebar.Group>
