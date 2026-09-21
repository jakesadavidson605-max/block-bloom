// Block Bloom! — tiny AsyncStorage helpers (best score, interstitial counter).
import AsyncStorage from '@react-native-async-storage/async-storage';

const BEST_KEY = 'blockbloom:best';
const GAMEOVER_COUNT_KEY = 'blockbloom:gameovers';

export async function getBestScore(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(BEST_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function saveBestScore(score: number): Promise<void> {
  try {
    await AsyncStorage.setItem(BEST_KEY, String(score));
  } catch {
    /* offline-safe: ignore */
  }
}

// Increments the game-over counter and returns the new value (for ad cadence).
export async function bumpGameOverCount(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(GAMEOVER_COUNT_KEY);
    const next = (v ? parseInt(v, 10) || 0 : 0) + 1;
    await AsyncStorage.setItem(GAMEOVER_COUNT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}
