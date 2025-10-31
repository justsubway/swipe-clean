# SwipeClean 🧹

A React Native app that helps users clean up their phone storage by swiping through photos and videos to delete or keep them. Built with Expo.

## Features

- 🖼️ **Smart Photo Detection**: Automatically detects duplicates, similar photos, screenshots, and low-quality images
- 👆 **Tinder-like Swipe Interface**: Swipe left to delete, right to keep, up to favorite
- 🎥 **Video Cleanup**: View and delete videos sorted by size
- 📊 **Storage Dashboard**: Track storage cleared and review marked deletions
- ⚡ **Quick Cleanup Modes**: 
  - Screenshots
  - Duplicates
  - Large Files
  - Old Photos
  - Low Quality Images
- ⭐ **Favorites**: Mark photos to protect them from deletion
- ↶ **Undo**: Easy undo functionality for accidental deletions

## Tech Stack

- React Native (Expo SDK 54)
- React Navigation
- React Native Reanimated
- Expo MediaLibrary
- AsyncStorage

## Setup

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Or run on specific platform
npm run ios
npm run android
```

## Deployment

This app is ready to be deployed using Expo Application Services (EAS). See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Quick Deploy to Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for production
eas build --platform all --profile production

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

## Repository

https://github.com/justsubway/swipe-clean

## License

Private

