<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { stackOffsetExpand } from 'd3-shape';

	import { format, PeriodType } from '@layerstack/utils';

	import {
		Bar,
		Bars,
		Axis,
		Chart,
		Highlight,
		Labels,
		LinearGradient,
		RectClipPath,
		Rule,
		Svg,
		Text,
		Tooltip,
		groupStackData,
		stackOffsetSeparated,
		Pattern
	} from 'layerchart';

	const data = [
		{
			date: new Date('2025-04-17T04:00:00.000Z'),
			value: 20,
			baseline: 55
		},
		{
			date: new Date('2025-04-18T04:00:00.000Z'),
			value: 62,
			baseline: 29
		},
		{
			date: new Date('2025-04-19T04:00:00.000Z'),
			value: 79,
			baseline: 86
		},
		{
			date: new Date('2025-04-20T04:00:00.000Z'),
			value: 98,
			baseline: 84
		},
		{
			date: new Date('2025-04-21T04:00:00.000Z'),
			value: 34,
			baseline: 40
		},
		{
			date: new Date('2025-04-22T04:00:00.000Z'),
			value: 50,
			baseline: 40
		},
		{
			date: new Date('2025-04-23T04:00:00.000Z'),
			value: 20,
			baseline: 48
		},
		{
			date: new Date('2025-04-24T04:00:00.000Z'),
			value: 27,
			baseline: 28
		},
		{
			date: new Date('2025-04-25T04:00:00.000Z'),
			value: 40,
			baseline: 91
		},
		{
			date: new Date('2025-04-26T04:00:00.000Z'),
			value: 31,
			baseline: 82
		}
	];
</script>

<div class="h-[300px] rounded border p-4">
	<Chart
		{data}
		x="value"
		xDomain={[0, null]}
		xNice
		y="date"
		yScale={scaleBand().padding(0.4)}
		padding={{ left: 16, bottom: 24 }}
		tooltip={{ mode: 'band' }}
	>
		<Svg>
			<Axis placement="bottom" grid rule />
			<Axis placement="left" format={(d) => format(d, PeriodType.Day, { variant: 'short' })} rule />
			<Bars strokeWidth={1} class="fill-primary" />
			<Highlight area />
		</Svg>
		<Tooltip.Root let:data>
			<Tooltip.Header
				>{format(data.date, PeriodType.Custom, { custom: 'eee, MMMM do' })}</Tooltip.Header
			>
			<Tooltip.List>
				<Tooltip.Item label="value" value={data.value} />
			</Tooltip.List>
		</Tooltip.Root>
	</Chart>
</div>
