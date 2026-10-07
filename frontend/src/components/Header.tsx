import { useContext } from 'react'
import { Link } from 'react-router'
import { LogIn, LogOut, Wine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserContext } from '../contexts/UserContext'
import { logout } from '../api'

export default function Header({ onLoginClick }: { onLoginClick: () => void }) {
  const currentUsername = useContext(UserContext)

  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return
    await logout()
    window.location.reload()
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl px-4 py-3 md:px-8">
      <div className="flex items-center justify-between mx-auto max-w-4xl">
        <Link
          to="/"
          state={{ resetSearch: true }}
          className="flex items-center gap-2 group transition-transform hover:scale-105 active:scale-95"
        >
          <div className="bg-linear-to-br from-amber-400 to-orange-600 p-1.5 rounded-lg shadow-lg shadow-amber-500/20">
            <Wine className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-100 group-hover:text-amber-500 transition-colors">Uwabami</span>
        </Link>
        <div className="flex items-center gap-3">
          {currentUsername ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-400 hidden sm:inline-block">
                {currentUsername}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline-block">ログアウト</span>
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoginClick}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <LogIn className="h-4 w-4 mr-1" />
              ログイン
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
