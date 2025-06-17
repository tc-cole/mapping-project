<script lang="ts">
	import DeckGL from '$lib/components/deck-gl/DeckGL.svelte';
	import ChartsDrawer from '$lib/components/charts-drawer/charts-drawer.svelte';
	import DrawingTools from '$lib/components/drawing-tools/drawing-tools.svelte';
	import DataInput from '$lib/components/data-input/data-input.svelte';
	import LayersSelection from '$lib/components/layers-selection/layers-selection.svelte';
	import DataTableDialogWrapper from '$lib/components/data-table/data-table-dialog-wrapper.svelte';
</script>

<div class="app-container">
	<DeckGL />
	<ChartsDrawer />

	<DataTableDialogWrapper />

	<div
		class="absolute left-0 right-0 top-4 z-10 flex flex-row items-start justify-between px-4 transition-all duration-200 ease-out"
	>
		<div></div>

		<div class="ml-2 flex-shrink-0">
			<DrawingTools />
		</div>

		<div class="relative flex-shrink-0">
			<div class="flex flex-row gap-4">
				<!--<Button>testing</Button> -->
				<DataInput />
			</div>
			<!-- LayersSelection positioned absolutely to avoid affecting main layout -->
			<div class="absolute right-0 top-full z-20 mt-4 w-72">
				<LayersSelection />
			</div>
		</div>
	</div>
</div>

<style>
	.app-container {
		position: relative;
		width: 100%;
		height: 100%;
	}
</style>
