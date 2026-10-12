import { Wine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GOOGLE_LOGIN_URL } from './api'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

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
          <a href={GOOGLE_LOGIN_URL}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
              <GoogleIcon className="h-4 w-4" />
            </span>
            Googleでログイン
          </a>
        </Button>
        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
