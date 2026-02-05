import { createClient } from '@supabase/supabase-js';

const sanitize = (val: string | undefined) => {
    if (!val) return '';
    return val.trim().replace(/^["']|["']$/g, '');
};

const supabaseUrl = sanitize(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Check your Vercel settings.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
