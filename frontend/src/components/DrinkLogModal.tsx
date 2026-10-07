import { useState } from 'react'
import { X, Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DrinkLog, createDrinkLog, updateDrinkLog } from '../api'
import { toast } from 'sonner'

interface Props {
  drinkId: number
  log?: DrinkLog
  onClose: () => void
  onSaved: () => void
}

export default function DrinkLogModal({ drinkId, log, onClose, onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(log?.drunk_date || today)
  const [rating, setRating] = useState(log?.star_rating || 3)
  const [memo, setMemo] = useState(log?.memo || '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        drunk_date: date,
        star_rating: rating,
        memo: memo || null,
      }
      
      if (log) {
        await updateDrinkLog(log.id, payload)
        toast.success('記録を更新しました')
      } else {
        await createDrinkLog(drinkId, payload)
        toast.success('記録を追加しました')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{log ? '記録を編集' : '呑んだ記録を追加'}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">日付</label>
            <Input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="bg-zinc-950 border-zinc-800 text-white" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">評価</label>
            <div className="flex gap-2 justify-center py-2 bg-zinc-950 border border-zinc-800 rounded-lg">
              {[1, 2, 3, 4, 5].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setRating(val)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-hidden"
                >
                  <Star className={`h-8 w-8 ${val <= rating ? 'fill-amber-500 text-amber-500' : 'text-zinc-700'}`} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">感想・メモ</label>
            <textarea 
              value={memo} 
              onChange={e => setMemo(e.target.value)} 
              rows={4}
              placeholder="フルーティで美味しかった等..."
              className="w-full p-3 rounded-md bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
              キャンセル
            </Button>
            <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white min-w-[100px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
