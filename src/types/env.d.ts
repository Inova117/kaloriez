declare module '@env' {
    // Only the Supabase anon credentials are needed in the client. The anon key
    // is safe to ship (it is gated by Row Level Security). The Gemini and USDA
    // keys are NO LONGER bundled — they live server-side in the `food-ai` Edge
    // Function. Do not re-import secret keys here.
    export const SUPABASE_URL: string;
    export const SUPABASE_ANON_KEY: string;
}
