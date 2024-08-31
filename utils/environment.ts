import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True when running inside Expo Go, which dropped expo-notifications support in SDK 53+. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
