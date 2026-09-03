import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import Landing from '@/routes/Landing'
import Login from '@/routes/Login'
import Protected from '@/routes/Protected'
import DashboardShell from '@/components/DashboardShell'
import Overview from '@/routes/dashboard/Overview'
import Placeholder from '@/routes/dashboard/Placeholder'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={<Protected><DashboardShell /></Protected>}
          >
            <Route index element={<Overview />} />
            <Route path="portfolio" element={<Placeholder title="Portfolio" phase="Phase 4" />} />
            <Route path="screener"  element={<Placeholder title="Screener"  phase="Phase 5" />} />
            <Route path="news"      element={<Placeholder title="News"      phase="Phase 6" />} />
            <Route path="chat"      element={<Placeholder title="AI Chat"   phase="Phase 8" />} />
          </Route>
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
