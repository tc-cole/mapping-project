<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Square, EllipsisVertical } from '@lucide/svelte';
	import SidebarMenuButton from '$lib/components/ui/sidebar/sidebar-menu-button.svelte';
	import { buttonVariants } from '$lib/components/ui/button';

	let { children, label } = $props();
</script>

<Collapsible.Root>
	<Collapsible.Trigger>
		{#snippet child({ props })}
			<SidebarMenuButton {...props} class={buttonVariants({ variant: 'secondary' })}>
				<Square />
				<span class="flex-1 truncate">{label}</span>
				<EllipsisVertical class="ml-auto" />
			</SidebarMenuButton>
		{/snippet}
	</Collapsible.Trigger>
	<Collapsible.Content class="mt-2 pl-2">
		{@render children()}
	</Collapsible.Content>
</Collapsible.Root>
