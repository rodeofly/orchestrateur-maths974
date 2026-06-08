// SPA pure : rendu 100% client, aucun prerender. GitHub Pages ne sert que du statique ;
// l'auth Supabase + la RLS vivent dans le navigateur. La garde de rôles côté client n'est
// QUE de l'UX/redirection — l'autorité de sécurité reste la RLS Postgres.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'ignore';
