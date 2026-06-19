import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MainApp } from './src/screens/MainApp';
import { OnboardingScreen, HAS_COMPLETED_ONBOARDING_KEY } from './src/screens/OnboardingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { migrateLocalDataToSupabase } from './src/services/dataMigration';
import { supabase } from './src/lib/supabase';
import { colors } from './src/theme/colors';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://baaa3819c6e3a90d23939d1971475e92@o4510757466406912.ingest.us.sentry.io/4510757486264320',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, [user]);

  useEffect(() => {
    if (user && hasOnboarded) {
      handleDataMigration();
    }
  }, [user, hasOnboarded]);

  const checkOnboardingStatus = async () => {
    try {
      // First check if user has a profile in Supabase
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('daily_calorie_goal')
          .eq('id', user.id)
          .single();

        if (profile && profile.daily_calorie_goal) {
          // User has completed onboarding in Supabase
          setHasOnboarded(true);
          // Also save to AsyncStorage for future checks
          await AsyncStorage.setItem(HAS_COMPLETED_ONBOARDING_KEY, 'true');
          return;
        }
      }

      // Fallback to AsyncStorage check
      const status = await AsyncStorage.getItem(HAS_COMPLETED_ONBOARDING_KEY);
      setHasOnboarded(status === 'true');
    } catch (error) {
      console.error('Error checking onboarding status', error);
      setHasOnboarded(false);
    }
  };

  const handleDataMigration = async () => {
    try {
      setMigrating(true);
      await migrateLocalDataToSupabase(user!.id);
    } catch (error) {
      console.error('Migration error:', error);
    } finally {
      setMigrating(false);
    }
  };

  if (authLoading || hasOnboarded === null || migrating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!hasOnboarded) {
    return <OnboardingScreen onComplete={() => setHasOnboarded(true)} />;
  }

  return <MainApp />;
}

export default Sentry.wrap(function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
});

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});