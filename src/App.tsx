import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import Landing from '@/routes/Landing'
import Login from '@/routes/Login'
import Protected from '@/routes/Protected'
import DashboardShell from '@/components/DashboardShell'
import Overview from '@/routes/dashboard/Overview'
import Charts from '@/routes/dashboard/Charts'
import Portfolio from '@/routes/dashboard/Portfolio'
import Screener from '@/routes/dashboard/Screener'
import News from '@/routes/dashboard/News'
import Signals from '@/routes/dashboard/Signals'
import Chat from '@/routes/dashboard/Chat'

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
            <Route path="charts"    element={<Charts />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="screener"  element={<Screener />} />
            <Route path="signals"   element={<Signals />} />
            <Route path="news"      element={<News />} />
            <Route path="chat"      element={<Chat />} />
          </Route>
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
