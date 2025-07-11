// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBsh7estLRpBIu0ajoQgl3gJtviEPwlyJg",
    authDomain: "moonx-farm-notification.firebaseapp.com",
    projectId: "moonx-farm-notification",
    storageBucket: "moonx-farm-notification.firebasestorage.app",
    messagingSenderId: "606808205515",
    appId: "1:606808205515:web:9e0fe8d101ea4ecc50d34e",
    measurementId: "G-M78RG1DNFC"
  };

// Initialize Firebase app with error handling
try {
  firebase.initializeApp(firebaseConfig);
  console.log('[firebase-messaging-sw.js] Firebase initialized successfully');
} catch (error) {
  console.error('[firebase-messaging-sw.js] Firebase initialization failed:', error);
  // Service worker will still work for caching, just without Firebase messaging
}

// Initialize Firebase Messaging only if Firebase was initialized successfully
let messaging;
try {
  messaging = firebase.messaging();
  console.log('[firebase-messaging-sw.js] Firebase Messaging initialized');
} catch (error) {
  console.error('[firebase-messaging-sw.js] Firebase Messaging initialization failed:', error);
}

// Handle background messages (only if messaging is available)
if (messaging) {
  messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    // Customize notification here
    const notificationTitle = payload.notification?.title || 'MoonX Farm DEX';
    const notificationOptions = {
      body: payload.notification?.body || 'New update available',
      icon: '/icons/favicon.ico', // Updated to use existing favicon
      badge: '/icons/favicon.ico',
      tag: 'moonx-notification',
      requireInteraction: false,
      actions: [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'close', 
          title: 'Close'
        }
      ],
      data: payload.data
    };

    // Show notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received:', event);

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    // Open or focus the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If app is not open, open it
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Basic service worker for caching (optional)
self.addEventListener('fetch', function(event) {
  // Basic fetch handler - can be expanded for caching strategies
  if (event.request.destination === 'document') {
    // Let the browser handle document requests normally
    return;
  }
}); 