import { createClient } from '@supabase/supabase-js';

// 環境変数を取得し、あらゆる「ゴミ」を強制排除する
const sanitize = (val: string | undefined) => {
    if (!val) return '';
    // 前後の空白を消し、前後にある引用符(" や ')を剥ぎ取る
    let s = val.trim().replace(/^["']|["']$/g, '');
    // さらに、JWTとして使えない文字（改行や不可視文字）を正規表現で排除する
    // JWTは [A-Za-z0-9-_.] のみで構成される
    return s.replace(/[^A-Za-z0-9-_.]/g, '');
};

const supabaseUrl = sanitize(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey) {
    console.log('Supabase Initializing...');
    console.log('Cleaned Key length:', supabaseAnonKey.length);

    // 3文字の差があった場合のための診断用ログ
    if (supabaseAnonKey.length !== 205) {
        console.warn('Warning: Key length is not 205. Check for corruption.');
    }

    fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { 'apikey': supabaseAnonKey }
    }).then(async r => {
        if (r.status === 401) {
            const detail = await r.json();
            console.error('【401ログ】:', detail);
            const div = document.createElement('div');
            div.id = 'auth-debug-bar';
            div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff4d4d;color:white;z-index:9999;padding:8px 15px;font-size:11px;font-family:monospace;white-space:pre-wrap;';
            div.innerText = `[Supabase ERROR] 鍵が拒否されました: ${JSON.stringify(detail)}\n使用中のKey(末尾): ...${supabaseAnonKey.slice(-10)} (Length: ${supabaseAnonKey.length})`;
            document.body.appendChild(div);
        }
    }).catch(() => { });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
