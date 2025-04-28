<script lang="ts">
	import AppSidebar from '$lib/components/widgets/navigation-sidebar.svelte';
	import ChartSidebar from "$lib/components/widgets/charts-sidebar-drawer.svelte"
	import DeckGL from '$lib/components/maps/DeckGL.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Chart } from 'layerchart';
	import { scaleTime } from 'd3-scale';

	import * as d3 from 'd3';

	import * as Sheet from '$lib/components/ui/sheet';
	import ChartsSidebar from '$lib/components/widgets/charts-sidebar-drawer.svelte';

	const dateSeriesData = [
		{
			date: new Date('2025-03-27T04:00:00.000Z'),
			value: 73
		},
		{
			date: new Date('2025-03-28T04:00:00.000Z'),
			value: 57
		},
		{
			date: new Date('2025-03-29T04:00:00.000Z'),
			value: 64
		},
		{
			date: new Date('2025-03-30T04:00:00.000Z'),
			value: 91
		},
		{
			date: new Date('2025-03-31T04:00:00.000Z'),
			value: 91
		},
		{
			date: new Date('2025-04-01T04:00:00.000Z'),
			value: 98
		},
		{
			date: new Date('2025-04-02T04:00:00.000Z'),
			value: 79
		},
		{
			date: new Date('2025-04-03T04:00:00.000Z'),
			value: 70
		},
		{
			date: new Date('2025-04-04T04:00:00.000Z'),
			value: 68
		},
		{
			date: new Date('2025-04-05T04:00:00.000Z'),
			value: 58
		},
		{
			date: new Date('2025-04-06T04:00:00.000Z'),
			value: 65
		},
		{
			date: new Date('2025-04-07T04:00:00.000Z'),
			value: 74
		},
		{
			date: new Date('2025-04-08T04:00:00.000Z'),
			value: 56
		},
		{
			date: new Date('2025-04-09T04:00:00.000Z'),
			value: 88
		},
		{
			date: new Date('2025-04-10T04:00:00.000Z'),
			value: 63
		},
		{
			date: new Date('2025-04-11T04:00:00.000Z'),
			value: 95
		},
		{
			date: new Date('2025-04-12T04:00:00.000Z'),
			value: 55
		},
		{
			date: new Date('2025-04-13T04:00:00.000Z'),
			value: 76
		},
		{
			date: new Date('2025-04-14T04:00:00.000Z'),
			value: 57
		},
		{
			date: new Date('2025-04-15T04:00:00.000Z'),
			value: 50
		},
		{
			date: new Date('2025-04-16T04:00:00.000Z'),
			value: 61
		},
		{
			date: new Date('2025-04-17T04:00:00.000Z'),
			value: 52
		},
		{
			date: new Date('2025-04-18T04:00:00.000Z'),
			value: 70
		},
		{
			date: new Date('2025-04-19T04:00:00.000Z'),
			value: 95
		},
		{
			date: new Date('2025-04-20T04:00:00.000Z'),
			value: 74
		},
		{
			date: new Date('2025-04-21T04:00:00.000Z'),
			value: 71
		},
		{
			date: new Date('2025-04-22T04:00:00.000Z'),
			value: 79
		},
		{
			date: new Date('2025-04-23T04:00:00.000Z'),
			value: 86
		},
		{
			date: new Date('2025-04-24T04:00:00.000Z'),
			value: 94
		},
		{
			date: new Date('2025-04-25T04:00:00.000Z'),
			value: 99
		}
	];
</script>


<ChartsSidebar />

