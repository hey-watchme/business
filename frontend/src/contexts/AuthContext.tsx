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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ユーザープロフィールを取得（事業所名・組織名も取得）
  const fetchProfile = async (userId: string) => {
    try {
      console.log('fetchProfile: querying users table...');
      const { data, error } = await supabase
        .from('users')
        .select('user_id, name, email, role, facility_id, avatar_url')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }

      console.log('fetchProfile: got data', data);

      let facilityName: string | null = null;
      let organizationName: string | null = null;

      // 事業所名・組織名を取得
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
    console.log('AuthContext: setting up onAuthStateChange');

    // onAuthStateChangeは初期状態も含めてイベントを発火する
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('onAuthStateChange:', event, !!session);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // バックグラウンドでプロフィール取得を試みる
          fetchProfile(session.user.id).then(async (userProfile) => {
            if (userProfile) {
              console.log('Profile loaded:', userProfile);
              setProfile(userProfile);
              setLoading(false);
            } else {
              // プロフィールが存在しない場合、新規ユーザーとして作成（Googleログイン等の初回対応）
              console.log('Profile not found, creating one from session info...');
              const { user: u } = session;
              const newProfile = {
                user_id: u.id,
                email: u.email,
                name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
                avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
                auth_provider: u.app_metadata?.provider || 'social',
                role: 'staff'
              };

              const { error: insertError } = await supabase.from('users').upsert(newProfile);

              if (!insertError) {
                const refreshedProfile = await fetchProfile(u.id);
                setProfile(refreshedProfile || (newProfile as any));
              } else {
                console.error('Failed to auto-create profile:', insertError);
              }
              setLoading(false);
            }
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    // サインアップ成功後、public.usersにレコードを作成
    if (!error && data.user) {
      await supabase.from('users').insert({
        user_id: data.user.id,
        email: email,
        name: name,
        auth_provider: 'email',
        role: 'staff', // デフォルトはstaff
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  // ビジネスユーザー判定: facility_idが設定されていればビジネスユーザー
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
