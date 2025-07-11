# 🔥 Firebase Setup Guide for Push Notifications

## 📋 Overview

WebSocket connection works without Firebase, but for **push notifications when offline**, you need to setup Firebase Cloud Messaging (FCM).

## 🚀 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project or select existing one
3. Enable **Cloud Messaging** in project settings

## 🔧 Step 2: Get Configuration

### Web App Setup
1. In Firebase Console → Project Settings → General tab
2. Scroll to "Your apps" section
3. Click "Add app" → Web app icon
4. Register your app and copy the config

### VAPID Key (for Web Push)
1. In Firebase Console → Project Settings → Cloud Messaging tab
2. Under "Web configuration" → Generate key pair
3. Copy the "Key pair" value (this is your VAPID key)

## 📝 Step 3: Update Environment Variables

Add these to your `.env.local` file:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Firebase Cloud Messaging VAPID Key
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BH4dXcs...
```

## 🛠️ Step 4: Update Service Worker

Edit `public/firebase-messaging-sw.js` with your actual config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com", 
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## ✅ Step 5: Test Setup

1. Restart your development server
2. Open browser console
3. Look for: `✅ Firebase FCM token acquired`
4. Check: `🚀 WebSocket Service: Initialized successfully`

## 🔧 Troubleshooting

### Error: "Failed to register service worker"
- Make sure `public/firebase-messaging-sw.js` exists
- Check that Firebase config is correct
- Restart development server

### Error: "Firebase config incomplete"
- Verify all environment variables are set
- Check that `.env.local` is in the root directory
- Restart development server after adding env vars

### WebSocket works but no Firebase
- This is normal if Firebase config is missing
- WebSocket provides real-time data
- Firebase only adds push notifications when offline

## 🎯 Testing Push Notifications

1. Make sure Firebase is initialized successfully
2. Go to browser Dev Tools → Console
3. Look for: `📲 Registering FCM token with backend...`
4. Use app's test notification feature

## 📱 Production Deployment

1. Update Firebase config with production domains
2. Add your production domain to Firebase authorized domains
3. Deploy service worker with production config
4. Test notifications in production environment

## 🔒 Security Notes

- Never commit Firebase config to version control with real values
- Use environment variables for all sensitive data
- Firebase config in service worker is publicly visible
- Consider using Firebase App Check for additional security

---

**Need help?** Check the Firebase documentation or create an issue in the repository. 