// FCM HTTP v1 sender for Deno / Supabase Edge Functions.
//
// Requires secrets:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL   (from service-account JSON)
//   FIREBASE_PRIVATE_KEY    (from service-account JSON; \n escapes ok)

declare const Deno: { env: { get: (k: string) => string | undefined } }

type Payload = { token: string; title: string; body: string; url?: string }

let cachedAccessToken: { token: string; expires_at: number } | null = null

export async function fcmSend(p: Payload) {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID unset')
  const accessToken = await getAccessToken()

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: p.token,
          notification: { title: p.title, body: p.body },
          data: { title: p.title, body: p.body, url: p.url ?? '/dashboard' },
          webpush: {
            fcm_options: { link: p.url ?? '/dashboard' },
          },
        },
      }),
    },
  )
  const body = await res.json()
  if (!res.ok) throw new Error('fcm send failed: ' + JSON.stringify(body).slice(0, 300))
  return body
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.expires_at > now + 60) return cachedAccessToken.token

  const email = Deno.env.get('FIREBASE_CLIENT_EMAIL')
  const key   = Deno.env.get('FIREBASE_PRIVATE_KEY')
  if (!email || !key) throw new Error('FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY unset')

  const jwt = await signJwt(
    {
      iss: email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    key.replace(/\\n/g, '\n'),
  )
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error('oauth exchange failed: ' + JSON.stringify(body))
  cachedAccessToken = { token: body.access_token, expires_at: now + body.expires_in }
  return body.access_token as string
}

async function signJwt(claims: Record<string, unknown>, pkcs8Pem: string) {
  const b64url = (u8: Uint8Array | string) =>
    (typeof u8 === 'string' ? btoa(u8) : btoa(String.fromCharCode(...u8)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = { alg: 'RS256', typ: 'JWT' }
  const toSign = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
  const pk = await importPkcs8(pkcs8Pem)
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' }, pk, new TextEncoder().encode(toSign),
  ))
  return `${toSign}.${b64url(sig)}`
}

async function importPkcs8(pem: string) {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}
