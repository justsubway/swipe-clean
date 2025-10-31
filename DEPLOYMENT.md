# Deployment Guide for SwipeClean

## Option 1: Expo Application Services (EAS) - Recommended ⭐

Expo Application Services is the easiest way to deploy your React Native app without running it on your laptop.

### Steps:

1. **Install EAS CLI:**
```bash
npm install -g eas-cli
```

2. **Login to Expo:**
```bash
eas login
```

3. **Configure your project:**
```bash
eas build:configure
```

4. **Build for iOS:**
```bash
eas build --platform ios
```

5. **Build for Android:**
```bash
eas build --platform android
```

6. **Submit to App Stores:**
```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

**Pricing:** Free tier available, then pay-as-you-go for builds ($10-30 per build)

**Website:** https://expo.dev

---

## Option 2: React Native Cloud Build Services

### Codemagic
- **Website:** https://codemagic.io
- **Pricing:** Free tier (500 build minutes/month)
- **Setup:** Connect GitHub repo, configure build settings
- Supports both iOS and Android

### Bitrise
- **Website:** https://www.bitrise.io
- **Pricing:** Free tier available
- **Setup:** Connect repository, auto-detects React Native projects

### GitHub Actions (Free but requires macOS runner for iOS)
- **Website:** GitHub Actions (included with GitHub)
- **Pricing:** Free for public repos, limited minutes for private
- **Setup:** Create `.github/workflows` YAML files

---

## Option 3: App Stores Direct Upload

### For iOS:
1. **Use Xcode Cloud** (if you have Apple Developer account)
   - Build in the cloud
   - Automatic builds on commits
   - **Cost:** $99/year Apple Developer + Xcode Cloud (free tier)

2. **Manual Build** (requires macOS):
   - Build locally with Xcode
   - Upload to App Store Connect
   - **Cost:** $99/year Apple Developer account

### For Android:
1. **Google Play Console**
   - Build locally or use EAS
   - Upload APK/AAB to Play Console
   - **Cost:** $25 one-time fee

---

## Option 4: Self-Hosted Solutions

### Expo Go (Development Only)
- Share Expo Go link with testers
- **Limitations:** Only works with Expo Go app, some native modules not supported
- **Free:** Yes, but limited

### TestFlight (iOS) / Internal Testing (Android)
- Build once
- Upload to TestFlight/Play Console internal testing
- Share with testers
- **Cost:** $99/year (iOS), $25 one-time (Android)

---

## Recommended Approach:

1. **For Quick Testing:** Use Expo Go (free, but limited)
2. **For Production:** Use EAS Build + Submit (easiest, $10-30 per build)
3. **For Budget:** Use Codemagic free tier for builds, then manual App Store upload

---

## Quick Start with EAS (Recommended):

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login
eas login

# 3. Configure
eas build:configure

# 4. Build (choose one)
eas build --platform ios --profile preview
eas build --platform android --profile preview

# 5. When ready for production
eas build --platform all --profile production

# 6. Submit to stores
eas submit --platform ios
eas submit --platform android
```

The builds will happen in the cloud - no need to run anything on your laptop!

---

## Important Notes:

- **iOS requires:** Apple Developer account ($99/year)
- **Android requires:** Google Play Developer account ($25 one-time)
- **Expo SDK:** Make sure all packages are compatible with Expo SDK 54
- **App Store Review:** First submission takes 1-2 weeks typically
- **Testing:** Use TestFlight (iOS) or Internal Testing (Android) before public release

