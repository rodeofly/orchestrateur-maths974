<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppShell from '$components/shell/AppShell.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<AppShell>{@render children()}</AppShell>
