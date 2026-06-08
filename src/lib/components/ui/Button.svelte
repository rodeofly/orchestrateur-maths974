<script lang="ts">
	import type { Snippet } from 'svelte';
	type Variant = 'primary' | 'ghost' | 'danger';
	let {
		variant = 'primary',
		type = 'button',
		disabled = false,
		href,
		onclick,
		children
	}: {
		variant?: Variant;
		type?: 'button' | 'submit';
		disabled?: boolean;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a class="btn {variant}" {href} aria-disabled={disabled}>{@render children()}</a>
{:else}
	<button class="btn {variant}" {type} {disabled} {onclick}>{@render children()}</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: 0.6rem 1.1rem;
		border-radius: var(--radius);
		border: 1px solid transparent;
		font-weight: 600;
		cursor: pointer;
		transition: filter 0.12s, background 0.12s;
		text-decoration: none;
	}
	.btn:hover:not([disabled]):not([aria-disabled='true']) {
		filter: brightness(0.96);
	}
	.btn[disabled],
	.btn[aria-disabled='true'] {
		opacity: 0.5;
		cursor: default;
	}
	.primary {
		background: var(--role-accent);
		color: #fff;
	}
	.ghost {
		background: var(--surface);
		border-color: var(--border);
		color: var(--text);
	}
	.danger {
		background: var(--danger);
		color: #fff;
	}
</style>
