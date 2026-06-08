import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Runes partout sauf dans node_modules (libs). Retirable en Svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// SPA pure : aucun code serveur (GitHub Pages ne sert que du statique).
		// fallback = toutes les routes non prerendues retombent sur index.html (routage client).
		adapter: adapter({ fallback: 'index.html', strict: false }),
		// Base path : '/orchestrateur-maths974' en prod (GitHub Pages), '' en dev.
		paths: { base: process.env.BASE_PATH || '' },
		alias: {
			$components: 'src/lib/components',
			$m974: 'src/lib/m974',
			$styles: 'src/lib/styles',
			$auth: 'src/lib/auth'
		},
		// CSP stricte (RGPD/mineurs : le refresh token vit en localStorage → durcir le XSS).
		// SvelteKit hashe ses propres scripts inline et injecte la CSP dans le HTML statique.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'connect-src': ['self', 'https://*.supabase.co', 'wss://*.supabase.co'],
				// frame-src = liste blanche des origines d'apps embarquables (= allowOrigin du host embed).
				// localhost = démo du runner en dev ; à retirer/ajuster selon les apps réellement embarquées.
				'frame-src': [
					'self',
					'https://ftobe-maths974.github.io',
					'https://rodeofly.github.io',
					'https://automaths.maths974.fr',
					'http://localhost:5173',
					'http://localhost:4173',
					'http://localhost:4321'
				],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		}
	}
};

export default config;
