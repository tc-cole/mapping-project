<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index';
	import { Plus } from '@lucide/svelte';
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel
		>Datasets
		<Sidebar.GroupAction>
			<Dialog.Root>
				<Dialog.Trigger>
					<Plus />
					<span class="sr-only">Add Project</span>
				</Dialog.Trigger>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>Are you sure absolutely sure?</Dialog.Title>
						<Dialog.Description>
							This action cannot be undone. This will permanently delete your account and remove
							your data from our servers.
						</Dialog.Description>
					</Dialog.Header>
				</Dialog.Content>
			</Dialog.Root>
		</Sidebar.GroupAction>
	</Sidebar.GroupLabel>
</Sidebar.Group>
