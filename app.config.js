/**
 * Expo App Configuration
 * Environment variables are loaded automatically by Expo from .env files
 * and available via process.env.EXPO_PUBLIC_*
 */

module.exports = {
  expo: {
    name: 'BetterAt',
    slug: 'betterat-app',
    owner: 'denneyke',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'betterat',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    deep: {
      scheme: 'betterat',
      hosts: ['auth', 'regattaflow.io'],
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.betterat.app',
      buildNumber: '3',
      usesAppleSignIn: true,
      // googleMapsApiKey removed from config — handled by withGoogleMaps plugin
      // to avoid Expo's built-in autolinking which generates a broken podspec reference
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          'BetterAt needs your location to track race performance and provide accurate wind and current data.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'BetterAt needs your location to track race performance and provide accurate wind and current data.',
        NSCameraUsageDescription:
          'BetterAt needs camera access to capture race moments and scan course marks.',
        NSMicrophoneUsageDescription:
          'BetterAt needs microphone access for voice notes and coaching feedback.',
        NSPhotoLibraryUsageDescription:
          'BetterAt needs photo library access to save and share race media.',
        NSSpeechRecognitionUsageDescription:
          'BetterAt uses speech recognition for voice commands and hands-free operation while sailing.',
      },
    },
    android: {
      package: 'com.betterat.app',
      versionCode: 6,
      adaptiveIcon: {
        backgroundColor: '#0a1832',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
      name: 'BetterAt - Get Better at What Matters to You',
      shortName: 'BetterAt',
      description:
        'The deliberate practice platform. Plan, Do, Review — whatever your discipline. Sailing, nursing, drawing, fitness, and more.',
      lang: 'en',
      scope: '/',
      themeColor: '#0a1832',
      backgroundColor: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: '#0a1832',
        },
      ],
      './plugins/withAndroidDependencyFix',
      './plugins/withGoogleMaps',
      '@maplibre/maplibre-react-native',
      'expo-apple-authentication',
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: 'com.googleusercontent.apps.176626806015-2aa2ujl7jiierinonf1v5rmnkjfhmodp',
        },
      ],
      [
        '@sentry/react-native/expo',
        {
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
        },
      ],
    ],
    updates: {
      enabled: false,
    },
    experiments: {
      typedRoutes: true,
    },
    // Expose environment variables via Constants.expoConfig.extra
    extra: {
      eas: {
        projectId: '88a65b55-6656-418d-86cd-909eea27e895',
      },
      openWeatherMapApiKey: process.env.EXPO_PUBLIC_OPENWEATHERMAP_API_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
