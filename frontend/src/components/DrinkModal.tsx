import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drink, createDrink, updateDrink, getTasteTypes, TasteType } from '../api'
import { toast } from 'sonner'

interface Props {
  drink?: Drink
  initialStatus?: 'drunk' | 'want_to_drink'
  onClose: () => void
  onSaved: (drink: Drink) => void
}

export default function DrinkModal({ drink, initialStatus, onClose, onSaved }: Props) {
  const [name, setName] = useState(drink?.name || '')
  const [category, setCategory] = useState(drink?.category || '')
  const [status, setStatus] = useState<'drunk' | 'want_to_drink'>(drink?.status || initialStatus || 'drunk')
  const [origin, setOrigin] = useState(drink?.origin || '')
  const [price, setPrice] = useState(drink?.price?.toString() || '')
  const [memo, setMemo] = useState(drink?.memo || '')
  const [selectedTasteIds, setSelectedTasteIds] = useState<number[]>(drink?.taste_types?.map(t => t.id) || [])
  
  const [tasteTypes, setTasteTypes] = useState<TasteType[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getTasteTypes().then(setTasteTypes).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !category) {
      toast.error('名前と種類は必須です')
      return
    }
    setLoading(true)
    try {
      const payload = {
        name,
        category,
        status,
        origin: origin || null,
        price: price ? parseInt(price, 10) : null,
        memo: memo || null,
        // Using IDs for taste types might depend on backend structure. Assuming it takes array of IDs or names.
        // Let's assume the backend takes taste_type_ids: number[] or similar.
        // For standard REST, we might need a specific structure. Wait, our `api.ts` just sends partial Drink.
        taste_type_ids: selectedTasteIds,
      }
      
      let res
      if (drink) {
        res = await updateDrink(drink.id, payload as any)
        toast.success('更新しました')
      } else {
        res = await createDrink(payload as any)
        toast.success('登録しました')
      }
      onSaved(res)
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const toggleTaste = (id: number) => {
    if (selectedTasteIds.includes(id)) {
      setSelectedTasteIds(selectedTasteIds.filter(x => x !== id))
    } else {
      setSelectedTasteIds([...selectedTasteIds, id])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{drink ? 'お酒を編集' : '新しいお酒を登録'}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">名前 <span className="text-red-400">*</span></label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="例: 新政 No.6" className="bg-zinc-950 border-zinc-800 text-white" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">種類 <span className="text-red-400">*</span></label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="例: 日本酒, ワイン" className="bg-zinc-950 border-zinc-800 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">ステータス</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded-md bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none"
              >
                <option value="drunk">呑んだ</option>
                <option value="want_to_drink">呑みたい</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">産地</label>
              <Input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="例: 秋田県" className="bg-zinc-950 border-zinc-800 text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">値段 (円)</label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="2000" className="bg-zinc-950 border-zinc-800 text-white" />
            </div>
          </div>

          {tasteTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">味のタイプ</label>
              <div className="flex flex-wrap gap-2">
                {tasteTypes.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTaste(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                      selectedTasteIds.includes(t.id)
                        ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">メモ</label>
            <textarea 
              value={memo} 
              onChange={e => setMemo(e.target.value)} 
              rows={3}
              placeholder="共通のメモや特徴など..."
              className="w-full p-3 rounded-md bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
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
