import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Check your .env or Vercel settings.');
} else {
    // 開発/デバッグ用ログ。機密情報は伏せる。
    console.log('Supabase Initializing...');
    console.log('Project ID check:', supabaseUrl.includes('qvtlwotzuzbavrzqhyvt') ? 'OK (Match)' : 'MISMATCH or Custom');
    console.log('Key length:', supabaseAnonKey.length);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
