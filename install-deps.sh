#!/bin/bash

echo "🏋️ CalorieCounter - Installing Dependencies"
echo "==========================================="
echo ""

# Install Supabase client
echo "📦 Installing Supabase client..."
npm install @supabase/supabase-js

# Install Groq SDK
echo "🤖 Installing Groq AI SDK..."
npm install groq-sdk

# Install environment variable support
echo "🔐 Installing environment variable support..."
npm install react-native-dotenv
npm install -D @types/react-native-dotenv

# Install additional helpful packages
echo "📱 Installing additional utilities..."
npm install date-fns  # For date formatting
npm install react-native-url-polyfill  # For Supabase compatibility

echo ""
echo "✅ All dependencies installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Copy .env.example to .env"
echo "2. Fill in your API keys in .env"
echo "3. Set up your Supabase database (see SETUP.md)"
echo "4. Run 'npm start' to launch the app"
echo ""
