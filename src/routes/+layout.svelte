<script lang="ts">
	import '../app.css';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'; // Import Draw CSS

	import { ModeWatcher } from 'mode-watcher';
	let { children } = $props();
</script>

<main>
	<ModeWatcher />
	{@render children?.()}
</main>
