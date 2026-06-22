import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MainApp } from './src/screens/MainApp';
import { OnboardingScreen, HAS_COMPLETED_ONBOARDING_KEY } from './src/screens/OnboardingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { migrateLocalDataToSupabase } from './src/services/dataMigration';
import { flushQueue } from './src/services/syncQueue';
import { supabase } from './src/lib/supabase';
import { colors } from './src/theme/colors';
import { logger } from './src/utils/logger';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://baaa3819c6e3a90d23939d1971475e92@o4510757466406912.ingest.us.sentry.io/4510757486264320',

  // This is a health app handling diet/weight data. Do NOT attach IP/identity
  // PII by default, and only stream verbose logs in development.
  sendDefaultPii: false,
  enableLogs: __DEV__,

  // Session Replay (text/images are masked by default in the RN SDK). Only
  // capture on errors to minimise data collection until a consent flow exists.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  // Depend on user?.id (a stable string) rather than the user object, so routine
  // TOKEN_REFRESHED auth events don't re-run onboarding checks / migration.
  useEffect(() => {
    checkOnboardingStatus();
  }, [user?.id]);

  useEffect(() => {
    if (user && hasOnboarded) {
      handleDataMigration();
    }
  }, [user?.id, hasOnboarded]);

  // Drain any writes that were queued while offline once we have a user.
  useEffect(() => {
    if (user) flushQueue();
  }, [user?.id]);

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
      logger.error('Error checking onboarding status', error);
      setHasOnboarded(false);
    }
  };

  const handleDataMigration = async () => {
    if (!user) return;
    // Run once per user. Runs in the background so it never blocks the UI.
    const flagKey = `@migrated_v1_${user.id}`;
    try {
      const alreadyMigrated = await AsyncStorage.getItem(flagKey);
      if (alreadyMigrated) return;
      await migrateLocalDataToSupabase(user.id);
      await AsyncStorage.setItem(flagKey, 'true');
    } catch (error) {
      logger.error('Migration error', error);
    }
  };

  if (authLoading || hasOnboarded === null) {
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

function ErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>
        The app ran into an unexpected problem. Your saved data is safe.
      </Text>
      <Pressable style={styles.errorButton} onPress={resetError}>
        <Text style={styles.errorButtonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default Sentry.wrap(function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Sentry.ErrorBoundary fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
          <AppContent />
        </Sentry.ErrorBoundary>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
});