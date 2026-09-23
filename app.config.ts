import { ExpoConfig, ConfigContext } from 'expo/config';


export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Block Bloom! Puzzle',
  slug: 'block-bloom',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'block-bloom',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0d1830',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.jakesadavidson.blockbloom',
  },
  android: {
    package: 'com.jakesadavidson.blockbloom',
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      backgroundColor: '#0d1830',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
    },
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0d1830',
      },
    ],
    [
      'react-native-google-mobile-ads',
      {
        // Google's official SAMPLE app ID (test). Swap for the real AdMob
        // app ID before monetizing.
        androidAppId: 'ca-app-pub-3940256099942544~3347511713',
        iosAppId: 'ca-app-pub-3940256099942544~1458002511',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '1faa0720-892a-4731-936c-2372f5275453',
    },
  },
});
