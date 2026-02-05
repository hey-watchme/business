import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 画面の最上部に、今アプリが使っている設定を一瞬だけ表示する（確認用）
if (typeof window !== 'undefined') {
    const check = () => {
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;bottom:0;right:0;background:black;color:green;padding:5px;font-size:10px;z-index:9999;opacity:0.7;';
        banner.innerText = `Connected to: ...${supabaseUrl?.slice(-10)} | Key: ...${supabaseAnonKey?.slice(-5)}`;
        document.body.appendChild(banner);
    };
    if (document.body) check(); else window.addEventListener('DOMContentLoaded', check);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
