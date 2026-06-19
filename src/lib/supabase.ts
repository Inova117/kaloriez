import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Environment variables
const supabaseUrl = SUPABASE_URL || '';
const supabaseAnonKey = SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Missing Supabase credentials. Please check your .env file.');
}

// Create Supabase client with AsyncStorage for persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});

// Database types (auto-generated from Supabase schema)
export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    daily_calorie_goal: number;
    created_at: string;
    updated_at: string;
}

export interface FoodEntryDB {
    id: string;
    user_id: string;
    name: string;
    calories: number;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
    is_favorite: boolean;
    timestamp: string;
    created_at: string;
}

export interface QuickAddItemDB {
    id: string;
    user_id: string;
    name: string;
    emoji: string;
    calories: number;
    usage_count: number;
    created_at: string;
}

export interface AISuggestion {
    id: string;
    user_id: string;
    query: string;
    suggestions: any;
    created_at: string;
    expires_at: string;
}
