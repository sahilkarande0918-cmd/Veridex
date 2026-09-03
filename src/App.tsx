import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import Landing from '@/routes/Landing'
import Login from '@/routes/Login'
import Protected from '@/routes/Protected'

// Every dashboard route is lazy-loaded so the landing/login pages
// don't ship ApexCharts, lightweight-charts, or the Firebase SDK.
const DashboardShell = lazy(() => import('@/components/DashboardShell'))
const Overview  = lazy(() => import('@/routes/dashboard/Overview'))
const Profile   = lazy(() => import('@/routes/dashboard/Profile'))
const Charts    = lazy(() => import('@/routes/dashboard/Charts'))
const Portfolio = lazy(() => import('@/routes/dashboard/Portfolio'))
const Screener  = lazy(() => import('@/routes/dashboard/Screener'))
const News      = lazy(() => import('@/routes/dashboard/News'))
const Signals   = lazy(() => import('@/routes/dashboard/Signals'))
const Chat      = lazy(() => import('@/routes/dashboard/Chat'))

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={<Protected><DashboardShell /></Protected>}
            >
              <Route index element={<Overview />} />
              <Route path="profile"   element={<Profile />} />
              <Route path="charts"    element={<Charts />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="screener"  element={<Screener />} />
              <Route path="signals"   element={<Signals />} />
              <Route path="news"      element={<News />} />
              <Route path="chat"      element={<Chat />} />
            </Route>
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}

function Fallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-neutral-500 text-xs">
      <span className="inline-flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" /> Loading…
      </span>
    </div>
  )
}
