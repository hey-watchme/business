import { createClient } from '@supabase/supabase-js';

const sanitize = (val: string | undefined) =>
    val?.trim().replace(/^["'](.+)["']$/, '$1') || '';

const supabaseUrl = sanitize(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

// 診断用：Authサーバーに直接問い合わせて、エラーの「生の声」を聞く
if (typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey) {
    fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'apikey': supabaseAnonKey }
    }).then(async r => {
        if (r.status === 401) {
            const detail = await r.json();
            console.error('【決定的なエラー原因】:', detail);
            // 画面上にも出す
            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;z-index:9999;padding:10px;font-size:12px;';
            div.innerText = `Supabase 401接続不可: ${JSON.stringify(detail)}`;
            document.body.appendChild(div);
        } else {
            console.log('Supabase API Key Check: PASS');
        }
    }).catch(err => console.error('Connection check failed:', err));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
