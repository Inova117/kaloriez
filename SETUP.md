# 🏋️ CalorieCounter - Setup Guide

## 📋 Prerequisites

- Node.js 18+ installed
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Studio (for Android development)
- Groq API account
- Supabase account

## 🚀 Quick Start

### 1. Clone and Install Dependencies

```bash
cd /home/martin/ZerionStudio/MobileApps/CalorieCounter
npm install
```

### 2. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual credentials
nano .env  # or use your preferred editor
```

### 3. Required API Keys

#### **Groq API** (Required for AI features)
1. Visit [https://console.groq.com/](https://console.groq.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to `GROQ_API_KEY` in your `.env` file

#### **Supabase** (Required for backend)
1. Visit [https://app.supabase.com/](https://app.supabase.com/)
2. Create a new project
3. Go to Settings → API
4. Copy the following to your `.env`:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Supabase Database Setup

Run this SQL in your Supabase SQL Editor to create the necessary tables:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    daily_calorie_goal INTEGER DEFAULT 2000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Food entries table
CREATE TABLE food_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
    is_favorite BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quick add items (user's custom quick-add foods)
CREATE TABLE quick_add_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    calories INTEGER NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI suggestions cache
CREATE TABLE ai_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    query TEXT NOT NULL,
    suggestions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_add_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for food_entries
CREATE POLICY "Users can view own food entries" ON food_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food entries" ON food_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food entries" ON food_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own food entries" ON food_entries
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for quick_add_items
CREATE POLICY "Users can view own quick add items" ON quick_add_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quick add items" ON quick_add_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quick add items" ON quick_add_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quick add items" ON quick_add_items
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_suggestions
CREATE POLICY "Users can view own AI suggestions" ON ai_suggestions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI suggestions" ON ai_suggestions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_food_entries_user_timestamp ON food_entries(user_id, timestamp DESC);
CREATE INDEX idx_food_entries_meal_type ON food_entries(meal_type);
CREATE INDEX idx_quick_add_items_user ON quick_add_items(user_id);
CREATE INDEX idx_ai_suggestions_user_expires ON ai_suggestions(user_id, expires_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 5. Create Storage Bucket for Food Images

In Supabase Dashboard:
1. Go to Storage
2. Create a new bucket named `food-images`
3. Set it to **Public** (or configure policies as needed)

### 6. Run the App

```bash
# Start Expo development server
npm start

# Or run directly on a platform
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web browser
```

## 🔧 Optional Integrations

### USDA Nutrition API (Free)
- Get API key: [https://fdc.nal.usda.gov/api-key-signup.html](https://fdc.nal.usda.gov/api-key-signup.html)
- Add to `.env` as `USDA_API_KEY`

### Nutritionix API (More comprehensive)
- Get credentials: [https://developer.nutritionix.com/](https://developer.nutritionix.com/)
- Add to `.env` as `NUTRITIONIX_APP_ID` and `NUTRITIONIX_APP_KEY`

## 📱 Features Enabled

With this setup, you'll have:
- ✅ AI-powered food suggestions via Groq
- ✅ User authentication via Supabase Auth
- ✅ Real-time data sync across devices
- ✅ Secure data storage with RLS
- ✅ Food entry tracking by meal type
- ✅ Quick-add favorites
- ✅ Daily calorie goals

## 🛠️ Troubleshooting

### "Cannot connect to Supabase"
- Verify your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check if your Supabase project is active

### "Groq API error"
- Verify your `GROQ_API_KEY` is valid
- Check your Groq API rate limits

### "Module not found"
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
expo start -c
```

## 📚 Next Steps

1. Implement Supabase client in your app
2. Create authentication screens
3. Connect food entry forms to Supabase
4. Integrate Groq API for AI suggestions
5. Add image recognition (optional)

## 🔐 Security Notes

- **NEVER** commit your `.env` file to version control
- Keep your `SUPABASE_SERVICE_ROLE_KEY` secret (use only server-side)
- Rotate API keys regularly
- Use environment-specific keys for development/production

---

Need help? Check the [Supabase Docs](https://supabase.com/docs) or [Groq API Docs](https://console.groq.com/docs)
