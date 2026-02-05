import { createClient } from '@supabase/supabase-js';

// 環境変数を取得し、前後の空白や引用符 (", ') を確実に除去する
const sanitize = (val: string | undefined) =>
    val?.trim().replace(/^["'](.+)["']$/, '$1') || '';

const supabaseUrl = sanitize(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables.');
} else {
    console.log('Supabase Initializing...');
    console.log('Project ID check:', supabaseUrl.includes('qvtlwotzuzbavrzqhyvt') ? 'OK (Match)' : 'MISMATCH');
    console.log('Sanitized Key length:', supabaseAnonKey.length);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
