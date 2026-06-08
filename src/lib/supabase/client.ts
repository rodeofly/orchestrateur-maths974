import { browser } from '$app/environment';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from './database.types';

// Singleton. L'anon key est PUBLIQUE par design : la sécurité = RLS Postgres, pas le secret.
let _sb: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
	if (!browser) {
		throw new Error('getSupabase() est réservé au navigateur (app SPA, ssr=false).');
	}
	if (_sb) return _sb;
	_sb = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
			flowType: 'pkce',
			storageKey: 'm974.orchestrateur.auth'
		}
	});
	return _sb;
}
