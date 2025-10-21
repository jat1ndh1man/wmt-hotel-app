import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://sottngvvplmqrpbfiyuy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdHRuZ3Z2cGxtcXJwYmZpeXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MjIzNzQsImV4cCI6MjA3Mjk5ODM3NH0.gwTtWo9Q5K4dzp8UE1iNtN8eqN4mVFs92zAHZneGyS0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});