import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TodayScreen } from './src/screens/TodayScreen';
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

export default Sentry.wrap(function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <TodayScreen />
    </SafeAreaProvider>
  );
});