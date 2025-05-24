<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import Highlight from 'svelte-highlight';
	import sql from 'svelte-highlight/languages/sql';
	// Import a theme for styling
	import github from 'svelte-highlight/styles/github';

	let sqlQuery = 'SELECT * FROM users WHERE active = true;';
	let showPreview = true;

	function handleSend() {
		console.log('Executing SQL:', sqlQuery);
		// Add your SQL execution logic here
	}
</script>

<!-- Inject the CSS theme -->
<svelte:head>
	{@html github}
</svelte:head>

<div class="grid w-full gap-2">
	<!-- SQL Input Textarea -->
	<div class="relative">
		<Textarea
			bind:value={sqlQuery}
			placeholder="Type your SQL query here..."
			rows={6}
			class="font-mono text-sm"
		/>

		<!-- Toggle for preview -->
		<div class="mt-2 flex items-center gap-2">
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={showPreview} class="rounded" />
				Show syntax highlighting
			</label>
		</div>
	</div>

	<!-- Highlighted Preview -->
	{#if showPreview && sqlQuery.trim()}
		<div class="rounded-md border bg-muted/50 p-3">
			<div class="mb-2 text-xs font-medium text-muted-foreground">Preview:</div>
			<Highlight language={sql} code={sqlQuery} />
		</div>
	{/if}

	<!-- Action Button -->
	<Button on:click={handleSend} disabled={!sqlQuery.trim()}>Execute Query</Button>
</div>

<style>
	/* Ensure the highlighted code uses proper monospace font */
	:global(pre code) {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
		font-size: 14px;
	}

	/* Improve the highlighting container */
	:global(.hljs) {
		background: transparent !important;
		padding: 0 !important;
	}
</style>
