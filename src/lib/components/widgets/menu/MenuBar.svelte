<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { SquarePen, Eraser, Hand, Mouse, MousePointer } from '@lucide/svelte';
</script>

<Menubar.Root>
	<Menubar.Menu>
        <Menubar.Trigger>
			<MousePointer />
		</Menubar.Trigger>
		<Menubar.Trigger>
			<Hand />
		</Menubar.Trigger>
		<Menubar.Trigger>
			<SquarePen />
		</Menubar.Trigger>
		<Menubar.Trigger>
			<Eraser />
		</Menubar.Trigger>
        <Menubar.Trigger>
			<Mouse />
		</Menubar.Trigger>
	</Menubar.Menu>
</Menubar.Root>
