import { createClient } from '@supabase/supabase-js';

import { getItemAsync, setItemAsync, deleteItemAsync } from '../utils/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

const storage = {
  getItem: async (key: string) => {
    return await getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    await setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
