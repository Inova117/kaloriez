import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MainApp } from './src/screens/MainApp';
import { OnboardingScreen, HAS_COMPLETED_ONBOARDING_KEY } from './src/screens/OnboardingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { PremiumProvider } from './src/contexts/PremiumContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { migrateLocalDataToSupabase } from './src/services/dataMigration';
import { flushQueue } from './src/services/syncQueue';
import { subscribeConnectivity } from './src/services/connectivity';
import { USER_PROFILE_KEY } from './src/screens/onboarding/OnboardingFlow';
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
  // mobileReplay/feedback are native-only — exclude on web so it can run.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  integrations: Platform.OS === 'web'
    ? []
    : [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // Health app: sendDefaultPii:false only suppresses Sentry's AUTOMATIC PII, not
  // custom paths. Strip identity/request vectors before any event leaves the
  // device so diet/account data can never ride along in an error report.
  beforeSend(event) {
    delete event.user;
    delete event.request;
    return event;
  },

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

function AppContent() {
  const { user, loading: authLoading, passwordRecovery } = useAuth();
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

  // Auto-sync the moment connectivity returns.
  useEffect(() => subscribeConnectivity((online) => {
    if (online) flushQueue();
  }), []);

  const checkOnboardingStatus = async () => {
    try {
      // Onboarding counts as done ONLY when the user's real profile (sex, age,
      // body metrics, goal) has been saved. The Supabase `profiles` row is
      // auto-created on sign-up with a DEFAULT daily_calorie_goal, so it can't be
      // the signal — relying on it skipped onboarding for every new account, and
      // people ended up with empty profiles. Use the saved profile instead.
      const profileRaw = await AsyncStorage.getItem(USER_PROFILE_KEY);
      const done = !!profileRaw;
      setHasOnboarded(done);
      if (done) await AsyncStorage.setItem(HAS_COMPLETED_ONBOARDING_KEY, 'true');
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

  // A recovery deep link takes precedence over everything else: the user must
  // set a new password before reaching the app (and before any onboarding load).
  if (passwordRecovery) {
    return <ResetPasswordScreen />;
  }

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
        <ThemeProvider>
          <PremiumProvider>
            <StatusBar style="dark" />
            <Sentry.ErrorBoundary fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
              <AppContent />
            </Sentry.ErrorBoundary>
          </PremiumProvider>
        </ThemeProvider>
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