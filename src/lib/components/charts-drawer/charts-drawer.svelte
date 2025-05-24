<script lang="ts">
	import BarChart from './charts/bar-chart.svelte';
	import { openDrawer } from '$lib/io/stores';
	import { Drawer } from 'vaul-svelte';
</script>

<Drawer.Root direction="right" open={$openDrawer}>
	<Drawer.Portal>
		<Drawer.Content
			class="fixed bottom-0 right-0 top-0 flex h-full w-2/5 flex-col bg-zinc-800 shadow-lg"
			onEscapeKeydown={(e) => {
				e.preventDefault();
				openDrawer.set(false);
			}}
			onInteractOutside={(e) => {
				e.preventDefault();
				openDrawer.set(false);
			}}
		>
			<BarChart />
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
