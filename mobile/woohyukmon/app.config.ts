import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "우혁몬(WOOHYUKMON)",
  slug: "woohyukmon",
  version: "1.0.0",
  scheme: "woohyukmon",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: { bundleIdentifier: "com.kline.woohyukmon", supportsTablet: true },
  android: {
    package: "com.kline.woohyukmon",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#FFFFFF",
    },
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
    ],
  },
  web: { favicon: "./assets/icon.png", bundler: "metro" },
  plugins: [
    "expo-secure-store",
    "expo-web-browser",
    "expo-localization",
    [
      "expo-image-picker",
      {
        photosPermission: "선택한 행사 사진을 추억록에 등록합니다.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/icon.png",
        imageWidth: 180,
        backgroundColor: "#FFFFFF",
      },
    ],
  ],
  extra: {
    apiOrigin:
      process.env.EXPO_PUBLIC_API_ORIGIN ||
      "https://kline-nine-wheat.vercel.app",
  },
};
export default config;
