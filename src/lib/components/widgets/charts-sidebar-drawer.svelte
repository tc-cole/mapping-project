<script lang="ts">
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import { clsx } from 'clsx';
	const drawerDirection = 'right';
</script>

<Drawer.Root direction="right">
	<Drawer.Trigger
		class="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
	>
		Open right drawer
	</Drawer.Trigger>
	<Drawer.Portal>
		<Drawer.Overlay class="fixed inset-0 bg-black/40" />
		<Drawer.Content
			data-testid="content"
			class={clsx({
				'fixed flex bg-zinc-800 p-6': true,

				'bottom-0 right-0 top-0 w-[50%] flex-row rounded-l-[10px]': drawerDirection === 'right'
			})}
		>
			<div
				class={clsx({
					'flex h-full w-full gap-8 rounded-full': true,
					'flex-row ': drawerDirection === 'right'
				})}
			>
				<div
					class={clsx({
						'rounded-full bg-zinc-300': true,
						'mx-auto h-1.5 w-12': drawerDirection === 'top' || drawerDirection === 'bottom',
						'my-auto h-12 w-1.5': drawerDirection === 'left' || drawerDirection === 'right'
					})}
				/>
				<div class="grid h-full w-full place-content-center">
					<div class="mx-auto max-w-md">
						<Drawer.Title class="mb-4 font-medium">Drawer for Svelte.</Drawer.Title>
						<p class="mb-2 text-gray-600">
							This component can be used as a Dialog replacement on mobile and tablet devices.
						</p>
						
						<slot />
					</div>
				</div>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
