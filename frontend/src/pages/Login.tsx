import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import loginVisual from '../assets/login_visual.png';
import './Login.css';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin;
      console.log('Initiating OAuth login with redirectUrl:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google login error:', err);
      setError(err instanceof Error ? err.message : 'Googleログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, name);
        if (error) {
          setError(error.message);
        } else {
          setSignUpSuccess(true);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        }
      }
    } catch (err) {
      setError('予期せぬエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // DEBUG: Check environment variables (internal)
  const isEnvLoaded = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  const renderForm = () => {
    if (signUpSuccess) {
      return (
        <div className="success-message">
          <div className="success-icon">✅</div>
          <h2>アカウント作成完了</h2>
          <p>
            確認メールを送信しました。<br />
            メール内のリンクをクリックして認証を完了してください。
          </p>
          <button
            className="login-button"
            onClick={() => {
              setSignUpSuccess(false);
              setIsSignUp(false);
            }}
          >
            ログイン画面に戻る
          </button>
        </div>
      );
    }

    return (
      <div className="login-form-container">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">👁️</span>
            <span className="logo-text">WatchMe Business</span>
          </div>
          <p className="login-subtitle">
            {isSignUp ? '専門的な支援を、もっと身近に。' : '児童発達支援事業所向け個別支援計画自動生成ツール'}
          </p>
        </div>

        <button
          type="button"
          className="google-login-button"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Googleアカウントでログイン
        </button>

        <div className="divider">
          <span>または</span>
        </div>

        {/* Temporary Debug Info */}
        {!isEnvLoaded && (
          <div style={{
            padding: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ff4d4d',
            borderRadius: '6px',
            fontSize: '11px',
            marginBottom: '20px',
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            ⚠️ 設定エラー: 環境変数が読み込めていません。<br />
            VercelのSettingsで VITE_... が設定されているか確認してください。
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="name">お名前</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? '処理中...' : isSignUp ? 'アカウントを作成' : 'ログイン'}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {isSignUp ? 'すでにアカウントをお持ちですか？' : 'アカウントをお持ちでないですか？'}
            <button
              type="button"
              className="toggle-button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
            >
              {isSignUp ? 'ログイン' : '新規登録'}
            </button>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="login-page">
      <div className="login-left">
        {renderForm()}
      </div>

      <div className="login-right">
        <div className="visual-content">
          <img src={loginVisual} alt="WatchMe Visual" className="login-visual" />
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon">✨</div>
              <div className="feature-text">
                <h3>AI自動生成</h3>
                <p>ヒアリング内容からアセスメントと個別支援計画案を数分で作成。</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🎙️</div>
              <div className="feature-text">
                <h3>リアルタイム解析</h3>
                <p>会話をリアルタイムで文字起こしし、重要な事実を自動抽出。</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📋</div>
              <div className="feature-text">
                <h3>公的書類対応</h3>
                <p>厚労省ガイドラインに準拠した正式な形式で書類を出力。</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <div className="feature-text">
                <h3>セキュアな管理</h3>
                <p>お子様の個人情報を安全な暗号化環境で管理します。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
