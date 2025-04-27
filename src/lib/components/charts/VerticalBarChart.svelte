<script lang="ts">
	import { scaleBand } from 'd3-scale';

	import { Axis, Bars, Chart, Highlight, Svg, Tooltip } from 'layerchart';

	import { format, PeriodType } from '@layerstack/utils';

	const data = [
		{
			date: new Date('2025-03-28T04:00:00.000Z'),
			value: 57,
			baseline: 68
		},
		{
			date: new Date('2025-03-29T04:00:00.000Z'),
			value: 43,
			baseline: 25
		},
		{
			date: new Date('2025-03-30T04:00:00.000Z'),
			value: 83,
			baseline: 25
		},
		{
			date: new Date('2025-03-31T04:00:00.000Z'),
			value: 21,
			baseline: 66
		},
		{
			date: new Date('2025-04-01T04:00:00.000Z'),
			value: 91,
			baseline: 79
		},
		{
			date: new Date('2025-04-02T04:00:00.000Z'),
			value: 80,
			baseline: 26
		},
		{
			date: new Date('2025-04-03T04:00:00.000Z'),
			value: 34,
			baseline: 89
		},
		{
			date: new Date('2025-04-04T04:00:00.000Z'),
			value: 91,
			baseline: 61
		},
		{
			date: new Date('2025-04-05T04:00:00.000Z'),
			value: 62,
			baseline: 54
		},
		{
			date: new Date('2025-04-06T04:00:00.000Z'),
			value: 73,
			baseline: 23
		},
		{
			date: new Date('2025-04-07T04:00:00.000Z'),
			value: 95,
			baseline: 37
		},
		{
			date: new Date('2025-04-08T04:00:00.000Z'),
			value: 87,
			baseline: 37
		},
		{
			date: new Date('2025-04-09T04:00:00.000Z'),
			value: 46,
			baseline: 67
		},
		{
			date: new Date('2025-04-10T04:00:00.000Z'),
			value: 71,
			baseline: 72
		},
		{
			date: new Date('2025-04-11T04:00:00.000Z'),
			value: 33,
			baseline: 50
		},
		{
			date: new Date('2025-04-12T04:00:00.000Z'),
			value: 70,
			baseline: 33
		},
		{
			date: new Date('2025-04-13T04:00:00.000Z'),
			value: 57,
			baseline: 26
		},
		{
			date: new Date('2025-04-14T04:00:00.000Z'),
			value: 84,
			baseline: 30
		},
		{
			date: new Date('2025-04-15T04:00:00.000Z'),
			value: 98,
			baseline: 92
		},
		{
			date: new Date('2025-04-16T04:00:00.000Z'),
			value: 99,
			baseline: 28
		},
		{
			date: new Date('2025-04-17T04:00:00.000Z'),
			value: 21,
			baseline: 68
		},
		{
			date: new Date('2025-04-18T04:00:00.000Z'),
			value: 71,
			baseline: 42
		},
		{
			date: new Date('2025-04-19T04:00:00.000Z'),
			value: 35,
			baseline: 53
		},
		{
			date: new Date('2025-04-20T04:00:00.000Z'),
			value: 21,
			baseline: 29
		},
		{
			date: new Date('2025-04-21T04:00:00.000Z'),
			value: 47,
			baseline: 75
		},
		{
			date: new Date('2025-04-22T04:00:00.000Z'),
			value: 61,
			baseline: 43
		},
		{
			date: new Date('2025-04-23T04:00:00.000Z'),
			value: 77,
			baseline: 46
		},
		{
			date: new Date('2025-04-24T04:00:00.000Z'),
			value: 64,
			baseline: 53
		},
		{
			date: new Date('2025-04-25T04:00:00.000Z'),
			value: 38,
			baseline: 82
		},
		{
			date: new Date('2025-04-26T04:00:00.000Z'),
			value: 66,
			baseline: 88
		}
	];
</script>

<div class="h-[300px] rounded border p-4">
	<Chart
		{data}
		x="date"
		xScale={scaleBand().padding(0.4)}
		y="value"
		yDomain={[0, null]}
		yNice={4}
		padding={{ left: 16, bottom: 24 }}
		tooltip={{ mode: 'band' }}
	>
		<Svg>
			<Axis placement="left" grid rule />
			<Axis
				placement="bottom"
				format={(d) => format(d, PeriodType.Day, { variant: 'short' })}
				rule
			/>
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
