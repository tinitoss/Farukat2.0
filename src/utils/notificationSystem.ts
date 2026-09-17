import { getToken, onMessage } from 'firebase/messaging';
import { getFCM } from '../firebase';
import { syncFcmToken } from './tursoClient';

// NOTE: Replace with your actual VAPID key in production or .env
// You can get this from Firebase Console > Project Settings > Cloud Messaging > Web configuration > Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || 'BD06qFIn1dztibkhbE3dYUcYrx0d35x0lWBsFCmhxUwJxWo8HzPzFaD29KM3ik8a0fyQrtWoEeZR6MWwTvhirD0';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return await initializeFCM();
    } else {
      console.warn('Notification permission denied by user.');
      return false;
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

export async function initializeFCM(): Promise<boolean> {
  try {
    const messaging = await getFCM();
    if (!messaging) {
      console.warn('FCM is not supported in this browser.');
      return false;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission is not granted. Cannot initialize FCM.');
      return false;
    }

    // Get registration token.
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    
    if (currentToken) {
      // Send the token to your server and update the UI if necessary
      await syncFcmToken(currentToken);
      
      // Handle incoming messages when the app is in the foreground
      onMessage(messaging, (payload) => {
        console.log('Message received in foreground. ', payload);
        
        // Show a UI toast/notification
        if (payload.notification) {
          const { title, body } = payload.notification;
          // Could dispatch a custom event here to show a toast in App.tsx
          const event = new CustomEvent('fcm-foreground-message', { 
            detail: { title, body, data: payload.data } 
          });
          window.dispatchEvent(event);
        }
      });
      return true;
    } else {
      console.warn('No registration token available. Request permission to generate one.');
      return false;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
    return false;
  }
}

/**
 * Clean conceptual wrapper that can be extended later for sending notifications
 */
export async function sendNotification(userId: string, title: string, body: string, data?: any) {
  // Client side does not send notifications directly using FCM.
  // This would call a backend endpoint (e.g. /api/turso/notifications/send)
  // which will look up the user's FCM token from the database and send it securely
  // using Firebase Admin SDK.
  console.log(`[Notification System] Scheduled send to ${userId}: ${title} - ${body}`);
  // In a real implementation:
  // await fetch('/api/turso/notifications/send', { method: 'POST', body: JSON.stringify({ userId, title, body, data }) });
}

export async function getLocalFcmToken(): Promise<string | null> {
  try {
    const messaging = await getFCM();
    if (!messaging) return null;

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission is not granted. Cannot get token.');
      return null;
    }

    return await getToken(messaging, { vapidKey: VAPID_KEY });
  } catch (err) {
    console.error('Failed to get local FCM token:', err);
    return null;
  }
}

export function simulateLocalNotification() {
  const event = new CustomEvent('fcm-foreground-message', { 
    detail: { 
      title: 'Fara Cinema Alert', 
      body: 'This is a test notification to verify your UI works!', 
      data: {} 
    } 
  });
  window.dispatchEvent(event);
}
