// Block Bloom! — centralized ads.
//
// Google's official SAMPLE/TEST IDs (Android):
//   app id:       ca-app-pub-3940256099942544~3347511713
//   banner:       ca-app-pub-3940256099942544/9214589741
//   interstitial: ca-app-pub-3940256099942544/1033173712
//
// USE_REAL_ADS = false — PLACEHOLDER TEST IDs — swap for real AdMob IDs before monetizing.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
} from 'react-native-google-mobile-ads';

export const USE_REAL_ADS = false;

export const AD_IDS = {
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/9214589741',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
};

const AD_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
};

function AdPlaceholder({ label }: { label: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{label}</Text>
    </View>
  );
}

// Banner shown on the game-over overlay. If the native ad fails to load,
// it degrades to a labeled placeholder instead of crashing.
export function AdBanner() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <AdPlaceholder label="AD · test banner" />;
  }

  try {
    return (
      <View style={styles.bannerWrap}>
        <BannerAd
          unitId={AD_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={AD_REQUEST_OPTIONS}
          onAdFailedToLoad={() => setFailed(true)}
        />
      </View>
    );
  } catch {
    return <AdPlaceholder label="AD · test banner" />;
  }
}

// Shows an interstitial every 3rd game over. All failures are swallowed so a
// native ad problem can never break the game flow.
export function maybeShowInterstitial(gameOverCount: number) {
  try {
    if (gameOverCount <= 0 || gameOverCount % 3 !== 0) return;
    const interstitial = InterstitialAd.createForAdRequest(
      AD_IDS.interstitial,
      AD_REQUEST_OPTIONS,
    );
    const unsubscribe = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      try {
        interstitial.show();
      } catch {
        /* ignore */
      }
      unsubscribe();
    });
    interstitial.load();
  } catch {
    /* degrade silently */
  }
}

const styles = StyleSheet.create({
  bannerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#1b2a4a',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  placeholderText: {
    color: '#8fa0c2',
    fontSize: 12,
    letterSpacing: 2,
  },
});
