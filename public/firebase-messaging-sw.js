// Firebase messaging service worker — runs in its own worker context,
// not through Vite. Config values are hardcoded here (they're public-safe
// like a Firebase apiKey — auth is enforced by security rules elsewhere).

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBHI1IoNpi0olnML-nA9ShJyYPsVxcU4EY',
  authDomain: 'veridex-ad8d8.firebaseapp.com',
  projectId: 'veridex-ad8d8',
  storageBucket: 'veridex-ad8d8.firebasestorage.app',
  messagingSenderId: '411611904345',
  appId: '1:411611904345:web:62de9280c4d8abda077448',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Veridex'
  const body  = payload.notification?.body  || payload.data?.body  || ''
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data || {},
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(clients.openWindow(url))
})
