/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Tests de logique pure (rôles, routage) + RLS sur Postgres WASM (PGlite) : pas de DOM.
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}', 'supabase/**/*.{test,spec}.{js,ts}'],
		// PGlite (WASM) peut être lent à charger : marge sur les tests RLS.
		testTimeout: 30000,
		// Un oubli de test ne doit pas passer en silence (la CI exige des tests RLS/rôles).
		passWithNoTests: false
	}
});
