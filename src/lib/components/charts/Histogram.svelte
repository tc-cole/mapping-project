<script lang="ts">
	import { bin } from 'd3-array';
	import { randomNormal } from 'd3-random';
	import { BarChart, Tooltip } from 'layerchart';
	import { RangeField } from 'svelte-ux';

	export let data;

	let thresholds = 10;

	$: binByWeight = bin<(typeof data.olympians)[0], number>()
		.value((d) => d.weight)
		.thresholds(thresholds);
	$: olympiansBins = binByWeight(data.olympians);

	let randomCount = 1000;
	$: random = randomNormal();
	$: randomData = Array.from({ length: randomCount }, () => random());
	$: binByValues = bin(); //.domain([0, 1]);

	$: getRandomDate = (from: Date, to: Date) => {
		const fromTime = from.getTime();
		const toTime = to.getTime();
		return new Date(fromTime + random() * (toTime - fromTime));
	};

	const now = new Date();
	let dateRange = 10;
</script>

<h1>Examples</h1>

<RangeField label="Thresholds" bind:value={thresholds} min={0} max={100} />

<h2>Vertical</h2>

<div class="h-[300px] rounded border p-4">
	<BarChart
		data={olympiansBins}
		x="x0"
		y="length"
		bandPadding={0.2}
		props={{
			xAxis: { tweened: true },
			yAxis: { format: 'metric', tweened: true },
			bars: { tweened: true }
		}}
	>
		<svelte:fragment slot="tooltip">
			<Tooltip.Root let:data>
				<Tooltip.Header class="text-center">{data.x0 + ' - ' + (data.x1 - 1)}</Tooltip.Header>
				<Tooltip.List>
					<Tooltip.Item label="count" value={data.length} format="integer" />
					<Tooltip.Separator />
					{#each data.slice(0, 5) as d}
						<Tooltip.Item label={d.name} value={d.weight} />
					{/each}
					{#if data.length > 5}
						<span></span>
						<span>...</span>
					{/if}
				</Tooltip.List>
			</Tooltip.Root>
		</svelte:fragment>
	</BarChart>
</div>
