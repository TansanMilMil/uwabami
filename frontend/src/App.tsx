import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import TopPage from './pages/TopPage'
import DrinkDetailPage from './pages/DrinkDetailPage'
import LoginPage from './LoginPage'
import Header from './components/Header'
import ErrorBoundary from './components/ErrorBoundary'
import { checkAuth } from './api'
import { UserContext } from './contexts/UserContext'

function RoutedContent() {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/drinks/:id" element={<DrinkDetailPage />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default function App() {
  const [currentUsername, setCurrentUsername] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    checkAuth().then(username => {
      setCurrentUsername(username)
      setAuthLoading(false)
    })
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUsername(null)
    }
    window.addEventListener('unauthorized', handleUnauthorized)
    return () => window.removeEventListener('unauthorized', handleUnauthorized)
  }, [])

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Loading...</div>

  return (
    <UserContext.Provider value={currentUsername}>
      <BrowserRouter>
        <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30">
          <Header onLoginClick={() => setShowLogin(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-4xl lg:max-w-6xl p-4 md:p-8">
              <RoutedContent />
            </div>
          </main>
        </div>

        {showLogin && (
          <div
            onClick={() => setShowLogin(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs"
          >
            <div onClick={e => e.stopPropagation()} className="w-full max-w-xs animate-in fade-in zoom-in duration-200">
              <LoginPage onLoginSuccess={() => setShowLogin(false)} />
            </div>
          </div>
        )}
        <Toaster position="top-center" richColors theme="dark" />
      </BrowserRouter>
    </UserContext.Provider>
  )
}
