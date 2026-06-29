import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import { logger } from '../utils/logger';

// Prefer EXPO_PUBLIC_* (inlined by Expo at build time, so standalone EAS builds
// get them via eas.json env). Fall back to @env / react-native-dotenv for local
// dev. The anon key is public by design (gated by RLS), so embedding it is safe.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    logger.warn('⚠️ Missing Supabase credentials. Please check your .env file.');
}

/**
 * Supabase auth-session storage adapter (Supabase's official "LargeSecureStore"
 * pattern).
 *
 * Why: Supabase JWT sessions are > 2KB and expo-secure-store rejects values over
 * the iOS Keychain ~2048-byte limit. So we keep only a small 256-bit AES key in
 * SecureStore (iOS Keychain / Android Keystore) and store the AES-CTR encrypted
 * session blob in AsyncStorage.
 *
 * Web: expo-secure-store is native-only, so on react-native-web we fall back to
 * plain AsyncStorage (localStorage-backed) and skip encryption entirely.
 */
class LargeSecureStore {
    private async _encrypt(key: string, value: string): Promise<string> {
        // 256-bit key from a CSPRNG (expo-crypto, bundled with SDK 54, web-safe).
        const encryptionKey = Crypto.getRandomValues(new Uint8Array(256 / 8));
        const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
        const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
        // Store the tiny AES key in the Keychain/Keystore, indexed by the same key.
        await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
        return aesjs.utils.hex.fromBytes(encryptedBytes);
    }

    private async _decrypt(key: string, value: string): Promise<string | null> {
        const encryptionKeyHex = await SecureStore.getItemAsync(key);
        if (!encryptionKeyHex) return null; // no AES key => not ours / legacy plaintext
        const cipher = new aesjs.ModeOfOperation.ctr(
            aesjs.utils.hex.toBytes(encryptionKeyHex),
            new aesjs.Counter(1),
        );
        const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
        return aesjs.utils.utf8.fromBytes(decryptedBytes);
    }

    async getItem(key: string): Promise<string | null> {
        if (Platform.OS === 'web') return AsyncStorage.getItem(key);

        const stored = await AsyncStorage.getItem(key);
        if (!stored) return null;

        // One-time, no-logout migration: a pre-existing PLAINTEXT session (written
        // before this adapter) has no AES key in SecureStore, so _decrypt returns
        // null. In that case return the raw value so the session is NOT lost;
        // supabase-js re-saves it via setItem (encrypted) on the next refresh.
        const looksLikeHex = /^[0-9a-f]+$/i.test(stored);
        if (!looksLikeHex) return stored; // plaintext JSON => legacy, hand it back

        try {
            const decrypted = await this._decrypt(key, stored);
            if (decrypted == null) {
                // Looked like hex but there is no AES key in the Keychain/Keystore:
                // orphaned ciphertext (e.g. the Keystore was cleared on reinstall).
                // Handing this hex back to supabase-js would be unparseable garbage,
                // so drop it and let the user re-authenticate once.
                await this.removeItem(key);
                return null;
            }
            return decrypted;
        } catch {
            // Corrupt entry — drop it so the user just re-authenticates once.
            await this.removeItem(key);
            return null;
        }
    }

    async setItem(key: string, value: string): Promise<void> {
        if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
        const encrypted = await this._encrypt(key, value);
        await AsyncStorage.setItem(key, encrypted);
    }

    async removeItem(key: string): Promise<void> {
        if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
        await AsyncStorage.removeItem(key);
        await SecureStore.deleteItemAsync(key);
    }
}

// Create Supabase client with an encrypted-at-rest session store for persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: new LargeSecureStore(),
        autoRefreshToken: true,
        persistSession: true,
        // false on native: detectSessionInUrl is a web-only option that parses
        // the session out of window.location. On React Native it does nothing
        // useful and can interfere with native deep-link handling.
        detectSessionInUrl: false,
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
