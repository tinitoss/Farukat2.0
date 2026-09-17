importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// We need to fetch the configuration from the app. 
// For a static service worker, we have to hardcode or fetch the config.
// I will fetch it from the same config the app uses.

// Fallback config since SW can't easily import json outside its scope without a bundler setup.
// We will use the generic messagingSenderId which is usually enough, but let's provide full config.
const firebaseConfig = {
  projectId: "balmy-hue-1cf5x",
  appId: "1:533569720623:web:f32e690c68a1f6924c11da",
  apiKey: "AIzaSyByjxq9E98IipmmjVE2kPFc-14XJ58mVeg",
  authDomain: "balmy-hue-1cf5x.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-fpxcinema-4cea5145-8a53-436b-93bd-e87369ae56f2",
  storageBucket: "balmy-hue-1cf5x.firebasestorage.app",
  messagingSenderId: "533569720623",
  measurementId: ""
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Open the app when clicked
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
