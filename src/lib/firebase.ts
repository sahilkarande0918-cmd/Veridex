import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let msg: Messaging | null = null

function ensure() {
  if (!config.apiKey) throw new Error('Firebase env vars missing')
  if (!app) app = initializeApp(config)
  if (!msg) msg = getMessaging(app)
  return msg
}

// Register the FCM token for this browser. Returns null if the user
// declines or the browser doesn't support push.
export async function requestFcmToken(): Promise<string | null> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return null

  const messaging = ensure()
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: reg,
  })
  return token || null
}

// Foreground message handler — for when the app is open in the tab.
export function onForegroundMessage(cb: (title: string, body: string) => void) {
  try {
    const messaging = ensure()
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Veridex'
      const body  = payload.notification?.body  || payload.data?.body  || ''
      cb(title, body)
    })
  } catch {
    return () => {}
  }
}
