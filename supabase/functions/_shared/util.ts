// Utilitaires partagés des Edge Functions (Deno). Service role = JAMAIS exposé au client.
// @ts-nocheck — exécuté par le runtime Deno de Supabase, pas par le tsc du frontend.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
	'Access-Control-Allow-Origin': '*', // restreindre aux origines prod avant la mise en service
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export function preflight(): Response {
	return new Response('ok', { headers: CORS });
}

export function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS, 'Content-Type': 'application/json' }
	});
}

// Client à privilèges (contourne la RLS) — réservé au serveur.
export function serviceClient() {
	return createClient(
		Deno.env.get('SUPABASE_URL')!,
		Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
		{ auth: { persistSession: false, autoRefreshToken: false } }
	);
}

// Identité de l'appelant, vérifiée via SON JWT (jamais une donnée du body).
export async function getCaller(req: Request) {
	const authHeader = req.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) return null;
	const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
		auth: { persistSession: false }
	});
	const { data, error } = await anon.auth.getUser(token);
	if (error || !data.user) return null;
	return data.user;
}
