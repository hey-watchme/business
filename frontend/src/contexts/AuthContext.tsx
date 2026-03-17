import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../api/client';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  facility_id: string | null;
  status: string | null;
  avatar_url: string | null;
  facility_name: string | null;
  organization_name: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isBusinessUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    console.log('🔓 fetchProfile: Fetching from BACKEND for', userId);
    try {
      // Bypassing Supabase Frontend Client (RLS) entirely for profile
      // Using our API client which talks to our FastAPI backend using Service Role
      const data = await api.getMe(userId);
      console.log('🔓 fetchProfile: Backend returned profile:', data);
      return data as UserProfile;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('🔓 fetchProfile: Backend error:', message);

      // No profile means "not registered as business user yet" (handled as access denied UI)
      if (message.includes('404')) {
        return null;
      }

      // Other errors are treated as connectivity/backend failures
      throw err;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setLoading(true);
      setError(null);
      console.log('🔓 initAuth: Getting Supabase session...');

      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(`セッションエラー: ${sessionError.message}`);
          return;
        }

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            console.log('🔓 initAuth: Found user, fetching profile from backend...');
            try {
              const p = await fetchProfile(initialSession.user.id);
              if (isMounted) {
                setProfile(p);
                setError(null);
              }
            } catch (profileError: unknown) {
              const message = profileError instanceof Error ? profileError.message : 'Unknown error';
              if (isMounted) {
                setProfile(null);
                setError(`プロフィール取得失敗: ${message}`);
              }
            }
          }
        }
      } catch (err: any) {
        setError(`初期化失敗: ${err.message}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;
        console.log('🔓 onAuthStateChange:', event);

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          try {
            const p = await fetchProfile(currentSession.user.id);
            if (isMounted) {
              setProfile(p);
              setError(null);
            }
          } catch (profileError: unknown) {
            const message = profileError instanceof Error ? profileError.message : 'Unknown error';
            if (isMounted) {
              setProfile(null);
              setError(`プロフィール取得失敗: ${message}`);
            }
          }
        } else {
          setProfile(null);
          setError(null);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (!err && data.user) {
      // Note: We still use direct supabase insert for signup if RLS allows, 
      // but signups are rare. Profile fetching is the critical part.
      await supabase.from('users').insert({
        user_id: data.user.id,
        email: email,
        name: name,
        auth_provider: 'email',
        role: 'staff',
      });
    }
    return { error: err };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setError(null);
  };

  const isBusinessUser = profile?.facility_id !== null && profile?.facility_id !== undefined;

  const value = {
    user,
    session,
    profile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    isBusinessUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
