<script lang="ts">
	import { ROLE_LABELS, type Role } from '$auth/roles';
	let { role }: { role: Role } = $props();
</script>

<span class="badge" data-role={role}>{ROLE_LABELS[role]}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.6rem;
		border-radius: var(--radius-full);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--role-accent);
		background: var(--role-accent-soft);
	}
</style>
