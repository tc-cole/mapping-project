<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let { children, label, defaultOpen = true, class: className = '' } = $props();

	let isOpen = $state(defaultOpen);
</script>

<div class={cn('overflow-hidden rounded-lg border border-gray-600 bg-gray-800', className)}>
	<Collapsible.Root bind:open={isOpen}>
		<Collapsible.Trigger class="w-full">
			<button
				class="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium transition-colors hover:bg-gray-700"
			>
				<span class="text-white">{label}</span>
				<ChevronDown
					class={cn(
						'h-4 w-4 text-gray-400 transition-transform duration-200',
						isOpen && 'rotate-180'
					)}
				/>
			</button>
		</Collapsible.Trigger>

		<Collapsible.Content>
			<div class="sectional-content space-y-3 border-t border-gray-600 bg-gray-800 px-3 pb-3 pt-3">
				{@render children()}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</div>

<style>
	/* Ensure child components fill width */
	:global(.sectional-content > *) {
		width: 100%;
	}

	/* Style direct button children to fill width and dark theme */
	:global(.sectional-content button) {
		width: 100%;
		justify-content: space-between;
		background-color: rgb(55 65 81); /* gray-700 */
		color: white;
		border: 1px solid rgb(75 85 99); /* gray-600 */
	}

	:global(.sectional-content button:hover) {
		background-color: rgb(31 41 55); /* gray-800 */
	}

	/* Better spacing for form elements */
	:global(.sectional-content input[type='range']) {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	/* Ensure dropdowns fill width and match theme */
	:global(.sectional-content [data-melt-dropdown-menu-trigger]) {
		width: 100%;
		background-color: rgb(55 65 81); /* gray-700 */
		color: white;
		border: 1px solid rgb(75 85 99); /* gray-600 */
	}

	:global(.sectional-content [data-melt-dropdown-menu-trigger]:hover) {
		background-color: rgb(31 41 55); /* gray-800 */
	}

	/* Style select elements */
	:global(.sectional-content select) {
		background-color: rgb(55 65 81); /* gray-700 */
		color: white;
		border: 1px solid rgb(75 85 99); /* gray-600 */
	}

	:global(.sectional-content select:hover) {
		background-color: rgb(31 41 55); /* gray-800 */
	}

	/* Style input elements */
	:global(.sectional-content input) {
		background-color: rgb(55 65 81); /* gray-700 */
		color: white;
		border: 1px solid rgb(75 85 99); /* gray-600 */
	}

	:global(.sectional-content input:focus) {
		border-color: rgb(59 130 246); /* blue-500 */
		box-shadow: 0 0 0 1px rgb(59 130 246);
	}

	/* Style labels */
	:global(.sectional-content label) {
		color: rgb(209 213 219); /* gray-300 */
	}

	/* Style text elements */
	:global(.sectional-content span) {
		color: rgb(209 213 219); /* gray-300 */
	}

	/* Style checkboxes */
	:global(.sectional-content input[type='checkbox']) {
		background-color: rgb(55 65 81); /* gray-700 */
		border: 1px solid rgb(75 85 99); /* gray-600 */
	}

	:global(.sectional-content input[type='checkbox']:checked) {
		background-color: rgb(59 130 246); /* blue-500 */
		border-color: rgb(59 130 246); /* blue-500 */
	}
</style>
