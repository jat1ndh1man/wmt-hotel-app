import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabaseClient';

interface User {
  id: string;
  email: string;
  full_name?: string;
  mobile?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkUser();

    // 🔹 Listen for Supabase auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        await AsyncStorage.clear();
        setUser(null);
        router.replace('/login'); // ✅ Correct path
      } else if (event === 'SIGNED_IN' && session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata?.full_name,
          mobile: session.user.user_metadata?.mobile,
        };
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        router.replace('/'); // ✅ Go to home tabs
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // 🔹 Auto-redirect based on auth state
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/login'); // ✅ Corrected
    } else if (user && inAuthGroup) {
      router.replace('/'); // ✅ Corrected
    }
  }, [user, segments, loading]);

  const checkUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData: User) => {
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    router.replace('/'); // ✅ Go to main tabs
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'user',
        'userProfile',
        'isLoggedIn',
        'userId',
        'userEmail'
      ]);
      await supabase.auth.signOut();
      setUser(null);
      router.replace('/login'); // ✅ Redirect immediately
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
