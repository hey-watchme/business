import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

console.error('Supabase check:', !!supabaseUrl, !!supabaseAnonKey);
console.error('Supabase URL:', supabaseUrl || '(empty)');
console.error('Supabase Key:', supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : '(empty)');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
