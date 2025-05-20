<script lang="ts">
	import '../app.css';
	import 'mapbox-gl/dist/mapbox-gl.css';

	import { ModeWatcher } from 'mode-watcher';
	let { children } = $props();
</script>

<main>
	<ModeWatcher />
	{@render children?.()}
</main>
