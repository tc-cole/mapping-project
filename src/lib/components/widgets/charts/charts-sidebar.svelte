<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { openDrawer } from '../menu/DrawingTools.svelte';
	import * as Chart from '$lib/components/ui/chart/index.js';

	const chartData = [
		{ month: 'January', desktop: 186, mobile: 80 },
		{ month: 'February', desktop: 305, mobile: 200 },
		{ month: 'March', desktop: 237, mobile: 120 },
		{ month: 'April', desktop: 73, mobile: 190 },
		{ month: 'May', desktop: 209, mobile: 130 },
		{ month: 'June', desktop: 214, mobile: 140 }
	];

	const chartConfig = {
		desktop: {
			label: 'Desktop',
			color: '#2563eb'
		},
		mobile: {
			label: 'Mobile',
			color: '#60a5fa'
		}
	} satisfies Chart.ChartConfig;
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
			<div class="flex h-full w-full flex-col overflow-auto p-4">
				<input class="my-8 border border-gray-400" placeholder="Input" />
				<p>
					But I must explain to you how all this mistaken idea of denouncing pleasure and praising
					pain was born and I will give you a complete account of the system, and expound the actual
					teachings of the great explorer of the truth, the master-builder of human happiness. No
					one rejects, dislikes, or avoids pleasure itself, because it is pleasure, but because
					those who do not know how to pursue pleasure rationally encounter consequences that are
					extremely painful.
				</p>
				<input class="my-8 border border-gray-400" placeholder="Input" />
				<!-- Rest of content -->
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
