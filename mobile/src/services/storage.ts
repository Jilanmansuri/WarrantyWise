import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'warrantywise_auth_token';
const ONBOARDING_KEY = 'warrantywise_onboarding_done';
const CUSTOM_API_URL_KEY = 'warrantywise_custom_api_url';

export async function saveAuthToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteAuthToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function setOnboardingCompleted(completed: boolean): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, completed ? '1' : '0');
}

export async function isOnboardingCompleted(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_KEY);
  return val === '1';
}

export async function saveCustomApiUrl(url: string): Promise<void> {
  if (!url.trim()) {
    await AsyncStorage.removeItem(CUSTOM_API_URL_KEY);
    return;
  }
  await AsyncStorage.setItem(CUSTOM_API_URL_KEY, url.trim().replace(/\/+$/, ''));
}

export async function getCustomApiUrl(): Promise<string | null> {
  return AsyncStorage.getItem(CUSTOM_API_URL_KEY);
}
