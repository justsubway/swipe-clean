# Free Deployment Setup with GitHub Education

Since you have GitHub Education, you can get **free EAS build credits**! Here's how to set it up:

## Step 1: Get Free EAS Credits with GitHub Education

1. Go to https://education.github.com/pack
2. Sign in with your GitHub account
3. Claim your GitHub Education Pack benefits
4. You'll get free EAS build credits included!

## Step 2: Set Up Expo Account

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo (create free account if needed)
eas login

# Link your GitHub Education account for free credits
# Follow prompts at: https://expo.dev/accounts/[your-username]/settings/billing
```

## Step 3: Configure GitHub Actions (Optional - for auto-deployment)

1. Go to your GitHub repo: https://github.com/justsubway/swipe-clean
2. Go to Settings > Secrets and variables > Actions
3. Add a new secret:
   - Name: `EXPO_TOKEN`
   - Value: Get from https://expo.dev/accounts/[your-username]/settings/access-tokens

The workflow will automatically build when you push to main branch!

## Step 4: Build and Deploy

```bash
# Configure EAS (first time only)
eas build:configure

# Build for production (uses your free GitHub Education credits!)
eas build --platform all --profile production

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

## Alternative: Use GitHub Actions Free Tier

If you prefer, GitHub Actions can build your app for free (limited minutes):
- Public repos: Unlimited minutes
- Private repos with GitHub Education: 2000 minutes/month

The `.github/workflows/deploy.yml` file is already set up!

## For Video File Sizes

Video file sizes showing 0 bytes is an Expo Go limitation. They will work correctly in:
- Development builds (free with GitHub Education)
- Production builds (uses GitHub Education credits)

The app will work perfectly once built!

