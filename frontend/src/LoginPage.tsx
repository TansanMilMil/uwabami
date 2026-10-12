import { Wine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GOOGLE_LOGIN_URL } from './api'

export default function LoginPage({ error }: { error?: string | null }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-md">
      <CardHeader className="items-center pb-4">
        <div className="rounded-full bg-amber-500/10 p-3 mb-2">
          <Wine className="h-8 w-8 text-amber-500" />
        </div>
        <CardTitle className="text-center text-2xl font-semibold text-zinc-100">Uwabami</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button asChild className="w-full bg-amber-600 hover:bg-amber-700 text-white transition-colors">
          <a href={GOOGLE_LOGIN_URL}>Googleでログイン</a>
        </Button>
        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
