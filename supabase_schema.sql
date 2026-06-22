-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    daily_calorie_goal INTEGER DEFAULT 2000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create food_entries table
CREATE TABLE IF NOT EXISTS food_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')) NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quick_add_items table
CREATE TABLE IF NOT EXISTS quick_add_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    calories INTEGER NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weight_entries table (one row per user per day)
CREATE TABLE IF NOT EXISTS weight_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    weight NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, date)
);

-- Create ai_suggestions table (for caching)
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    query TEXT NOT NULL,
    suggestions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_food_entries_user_id ON food_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_food_entries_timestamp ON food_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_timestamp ON food_entries(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quick_add_items_user_id ON quick_add_items(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_id ON ai_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_expires_at ON ai_suggestions(expires_at);

-- Index for weight lookups
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_add_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own food entries" ON food_entries;
DROP POLICY IF EXISTS "Users can insert own food entries" ON food_entries;
DROP POLICY IF EXISTS "Users can update own food entries" ON food_entries;
DROP POLICY IF EXISTS "Users can delete own food entries" ON food_entries;
DROP POLICY IF EXISTS "Users can view own quick add items" ON quick_add_items;
DROP POLICY IF EXISTS "Users can insert own quick add items" ON quick_add_items;
DROP POLICY IF EXISTS "Users can update own quick add items" ON quick_add_items;
DROP POLICY IF EXISTS "Users can delete own quick add items" ON quick_add_items;
DROP POLICY IF EXISTS "Users can view own ai suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Users can insert own ai suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Users can delete own ai suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Users can view own weight entries" ON weight_entries;
DROP POLICY IF EXISTS "Users can insert own weight entries" ON weight_entries;
DROP POLICY IF EXISTS "Users can update own weight entries" ON weight_entries;
DROP POLICY IF EXISTS "Users can delete own weight entries" ON weight_entries;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Food entries policies
CREATE POLICY "Users can view own food entries" ON food_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food entries" ON food_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food entries" ON food_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own food entries" ON food_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Quick add items policies
CREATE POLICY "Users can view own quick add items" ON quick_add_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quick add items" ON quick_add_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quick add items" ON quick_add_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quick add items" ON quick_add_items
    FOR DELETE USING (auth.uid() = user_id);

-- AI suggestions policies
CREATE POLICY "Users can view own ai suggestions" ON ai_suggestions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai suggestions" ON ai_suggestions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai suggestions" ON ai_suggestions
    FOR DELETE USING (auth.uid() = user_id);

-- Weight entries policies
CREATE POLICY "Users can view own weight entries" ON weight_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight entries" ON weight_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight entries" ON weight_entries
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight entries" ON weight_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Automatically create a profile row when a new auth user is created. Runs
-- server-side with SECURITY DEFINER so it works regardless of email-confirmation
-- gating and removes the need for the client to insert its own profile row.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, daily_calorie_goal)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        2000
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Function to clean up expired AI suggestions
CREATE OR REPLACE FUNCTION cleanup_expired_suggestions()
RETURNS void AS $$
BEGIN
    DELETE FROM ai_suggestions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- You can set up a cron job in Supabase to run this function periodically
-- Example: SELECT cron.schedule('cleanup-suggestions', '0 0 * * *', 'SELECT cleanup_expired_suggestions()');
