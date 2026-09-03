import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import Landing from '@/routes/Landing'
import Login from '@/routes/Login'
import Dashboard from '@/routes/Dashboard'
import Protected from '@/routes/Protected'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={<Protected><Dashboard /></Protected>}
          />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
