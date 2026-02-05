import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  facility_id: string | null;
  facility_name: string | null;
  organization_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isBusinessUser: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // ユーザープロフィールを取得（事業所名・組織名も取得）
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name, email, role, facility_id, avatar_url')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }

      let facilityName: string | null = null;
      let organizationName: string | null = null;

      if (data.facility_id) {
        const { data: facilityData } = await supabase
          .from('business_facilities')
          .select('name, organization_id')
          .eq('id', data.facility_id)
          .single();

        if (facilityData) {
          facilityName = facilityData.name;
          if (facilityData.organization_id) {
            const { data: orgData } = await supabase
              .from('business_organizations')
              .select('name')
              .eq('id', facilityData.organization_id)
              .single();
            organizationName = orgData?.name ?? null;
          }
        }
      }

      return {
        user_id: data.user_id,
        name: data.name,
        email: data.email,
        role: data.role,
        facility_id: data.facility_id,
        facility_name: facilityName,
        organization_name: organizationName,
        avatar_url: data.avatar_url,
      } as UserProfile;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            const p = await fetchProfile(initialSession.user.id);
            if (isMounted) setProfile(p);
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        if (isMounted) setAuthError(err instanceof Error ? err.message : '初期化エラー');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        try {
          if (!isMounted) return;
          console.log('onAuthStateChange:', event);

          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            const p = await fetchProfile(currentSession.user.id);
            if (!isMounted) return;

            if (p) {
              setProfile(p);
            } else {
              // Create profile if missing (Social Login)
              const { user: u } = currentSession;
              const newProfile = {
                user_id: u.id,
                email: u.email,
                name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
                avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
                auth_provider: u.app_metadata?.provider || 'social',
                role: 'staff'
              };
              await supabase.from('users').upsert(newProfile);
              const refreshed = await fetchProfile(u.id);
              if (isMounted) setProfile(refreshed || (newProfile as any));
            }

            // Clean URL
            if (window.location.hash && window.location.hash.includes('access_token')) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error('Auth change error:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (!error && data.user) {
      await supabase.from('users').insert({
        user_id: data.user.id,
        email: email,
        name: name,
        auth_provider: 'email',
        role: 'staff',
      });
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const isBusinessUser = profile?.facility_id !== null && profile?.facility_id !== undefined;

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    isBusinessUser,
    authError,
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
