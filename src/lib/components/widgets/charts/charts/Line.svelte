<script lang="ts">
	import { scaleOrdinal, scaleSequential, scaleTime } from 'd3-scale';
	import { format } from 'date-fns';
	import { formatDate, PeriodType } from '@layerstack/utils';

	import {
		Axis,
		Canvas,
		Chart,
		Highlight,
		Labels,
		Legend,
		LinearGradient,
		Spline,
		Svg,
		Text,
		Tooltip,
		pivotLonger
	} from 'layerchart';



	const keys = ['apples', 'bananas', 'oranges'];



	const data = [
		{
			date: new Date('2025-03-28T04:00:00.000Z'),
			value: 57
		},
		{
			date: new Date('2025-03-29T04:00:00.000Z'),
			value: 84
		},
		{
			date: new Date('2025-03-30T04:00:00.000Z'),
			value: 79
		},
		{
			date: new Date('2025-03-31T04:00:00.000Z'),
			value: 54
		},
		{
			date: new Date('2025-04-01T04:00:00.000Z'),
			value: 89
		},
		{
			date: new Date('2025-04-02T04:00:00.000Z'),
			value: 66
		},
		{
			date: new Date('2025-04-03T04:00:00.000Z'),
			value: 52
		},
		{
			date: new Date('2025-04-04T04:00:00.000Z'),
			value: 84
		},
		{
			date: new Date('2025-04-05T04:00:00.000Z'),
			value: 73
		},
		{
			date: new Date('2025-04-06T04:00:00.000Z'),
			value: 54
		},
		{
			date: new Date('2025-04-07T04:00:00.000Z'),
			value: 58
		},
		{
			date: new Date('2025-04-08T04:00:00.000Z'),
			value: 69
		},
		{
			date: new Date('2025-04-09T04:00:00.000Z'),
			value: 96
		},
		{
			date: new Date('2025-04-10T04:00:00.000Z'),
			value: 87
		},
		{
			date: new Date('2025-04-11T04:00:00.000Z'),
			value: 61
		},
		{
			date: new Date('2025-04-12T04:00:00.000Z'),
			value: 67
		},
		{
			date: new Date('2025-04-13T04:00:00.000Z'),
			value: 82
		},
		{
			date: new Date('2025-04-14T04:00:00.000Z'),
			value: 88
		},
		{
			date: new Date('2025-04-15T04:00:00.000Z'),
			value: 96
		},
		{
			date: new Date('2025-04-16T04:00:00.000Z'),
			value: 94
		},
		{
			date: new Date('2025-04-17T04:00:00.000Z'),
			value: 72
		},
		{
			date: new Date('2025-04-18T04:00:00.000Z'),
			value: 82
		},
		{
			date: new Date('2025-04-19T04:00:00.000Z'),
			value: 54
		},
		{
			date: new Date('2025-04-20T04:00:00.000Z'),
			value: 87
		},
		{
			date: new Date('2025-04-21T04:00:00.000Z'),
			value: 78
		},
		{
			date: new Date('2025-04-22T04:00:00.000Z'),
			value: 85
		},
		{
			date: new Date('2025-04-23T04:00:00.000Z'),
			value: 63
		},
		{
			date: new Date('2025-04-24T04:00:00.000Z'),
			value: 93
		},
		{
			date: new Date('2025-04-25T04:00:00.000Z'),
			value: 63
		},
		{
			date: new Date('2025-04-26T04:00:00.000Z'),
			value: 62
		}
	];
</script>

<div class="h-[300px] rounded border p-4">
	<Chart
		data={data}
		x="date"
		xScale={scaleTime()}
		y="value"
		yDomain={[0, null]}
		yNice
		padding={{ left: 16, bottom: 24 }}
		tooltip={{ mode: 'bisect-x' }}
	>
		<Svg>
			<Axis placement="left" grid rule />
			<Axis
				placement="bottom"
				format={(d) => formatDate(d, PeriodType.Day, { variant: 'short' })}
				rule
			/>
			<Spline class="stroke-primary stroke-2" />
			<Highlight points lines />
		</Svg>

		<Tooltip.Root let:data>
			<Tooltip.Header>{format(data.date, 'eee, MMMM do')}</Tooltip.Header>
			<Tooltip.List>
				<Tooltip.Item label="value" value={data.value} />
			</Tooltip.List>
		</Tooltip.Root>
	</Chart>
</div>
