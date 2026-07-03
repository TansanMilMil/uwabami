import { useState } from 'react'
import { Loader2, Wine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { login } from './api'
import { toast } from 'sonner'

export default function LoginPage({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(user, pass)
      toast.success('ログインしました')
      onLoginSuccess()
      window.location.reload() // Force reload to apply user context globally
    } catch {
      toast.error('ユーザー名またはパスワードが違います')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-md">
      <CardHeader className="items-center pb-4">
        <div className="rounded-full bg-amber-500/10 p-3 mb-2">
          <Wine className="h-8 w-8 text-amber-500" />
        </div>
        <CardTitle className="text-center text-2xl font-semibold text-zinc-100">Uwabami</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="text"
            placeholder="ユーザー名"
            value={user}
            onChange={e => setUser(e.target.value)}
            autoFocus
            disabled={loading}
            className="bg-zinc-950/50 border-zinc-800 text-zinc-100 focus-visible:ring-amber-500/50"
          />
          <Input
            type="password"
            placeholder="パスワード"
            value={pass}
            onChange={e => setPass(e.target.value)}
            disabled={loading}
            className="bg-zinc-950/50 border-zinc-800 text-zinc-100 focus-visible:ring-amber-500/50"
          />
          <Button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white transition-colors mt-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ログイン'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
