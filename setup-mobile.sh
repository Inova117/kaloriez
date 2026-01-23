#!/bin/bash

echo "📱 CalorieCounter - Mobile Deployment Setup"
echo "==========================================="
echo ""

# Check if eas-cli is installed
if ! command -v eas &> /dev/null; then
    echo "📦 Installing EAS CLI..."
    npm install -g eas-cli
else
    echo "✅ EAS CLI already installed"
fi

echo ""
echo "🔐 Logging into Expo..."
eas login

echo ""
echo "⚙️ Configuring EAS for your project..."
eas build:configure

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "For Android (APK):"
echo "  eas build --profile development --platform android"
echo ""
echo "For iOS:"
echo "  eas device:create  # Register your iPhone first"
echo "  eas build --profile development --platform ios"
echo ""
echo "After installing the build on your phone:"
echo "  npx expo start --dev-client"
echo ""
