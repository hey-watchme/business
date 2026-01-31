import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
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
      // 常に現在のオリジン（http://localhost... または https://business...）をリダイレクト先とする
      const redirectUrl = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('Googleログインに失敗しました');
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

  if (signUpSuccess) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <span className="logo-icon">👁️</span>
              <span className="logo-text">WatchMe Business</span>
            </div>
          </div>
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
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">👁️</span>
            <span className="logo-text">WatchMe Business</span>
          </div>
          <p className="login-subtitle">
            {isSignUp ? 'アカウントを作成' : '児童発達支援事業所向け個別支援計画自動生成ツール'}
          </p>
        </div>

        {/* Googleログインボタン */}
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
          Googleでログイン
        </button>

        <div className="divider">
          <span>または</span>
        </div>

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

        <div className="login-info">
          <p className="info-note">
            ※ ビジネスアカウントへのアクセスには事業所への紐付けが必要です。<br />
            新規登録後、管理者にお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}
