import { useState, useEffect } from 'react'
import { X, Loader2, ImagePlus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drink, createDrink, updateDrink, uploadDrinkImage, getTasteTypes, TasteType, getDrinkCategories, getDrinkOrigins, suggestDrinkInfo, DrinkSuggestResult } from '../api'
import { toast } from 'sonner'

interface Props {
  drink?: Drink
  initialStatus?: 'drunk' | 'want_to_drink'
  onClose: () => void
  onSaved: (drink: Drink) => void
}

export default function DrinkModal({ drink, initialStatus, onClose, onSaved }: Props) {
  const [name, setName] = useState(drink?.name || '')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(drink?.category ? drink.category.split(',').map(c => c.trim()).filter(c => c) : [])
  const [status, setStatus] = useState<'drunk' | 'want_to_drink'>(drink?.status || initialStatus || 'drunk')
  const [origin, setOrigin] = useState(drink?.origin || '')
  const [price, setPrice] = useState(drink?.price?.toString() || '')
  const [memo, setMemo] = useState(drink?.memo || '')
  const [selectedTasteIds, setSelectedTasteIds] = useState<number[]>(drink?.taste_types?.map(t => t.id) || [])
  
  const [tasteTypes, setTasteTypes] = useState<TasteType[]>([])
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [categories, setCategories] = useState<string[]>([])
  const [isNewCategory, setIsNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [origins, setOrigins] = useState<string[]>([])
  const [isNewOrigin, setIsNewOrigin] = useState(false)
  const [newOriginName, setNewOriginName] = useState('')

  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<DrinkSuggestResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  useEffect(() => {
    getTasteTypes().then(setTasteTypes).catch(console.error)
  }, [])

  useEffect(() => {
    getDrinkCategories().then(cats => {
      setCategories(cats)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    getDrinkOrigins().then(setOrigins).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || selectedCategories.length === 0) {
      toast.error('名前と種類は必須です')
      return
    }
    setLoading(true)
    try {
      const payload = {
        name,
        category: selectedCategories.join(','),
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
        if (imageFile) {
          try {
            await uploadDrinkImage(res.id, imageFile)
          } catch (err) {
            toast.error('画像のアップロードに失敗しました')
          }
        }
        toast.success('登録しました')
      }
      onSaved(res)
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleAiSuggest = async () => {
    if (!name.trim()) {
      toast.error('先に名前を入力してください')
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await suggestDrinkInfo(name.trim())
      setAiSuggestion(result)
    } catch (e: any) {
      const message = e.message || 'AIサジェストの取得に失敗しました'
      setAiError(message)
      toast.error(message)
    } finally {
      setAiLoading(false)
    }
  }

  const applySuggestedCategory = () => {
    const c = aiSuggestion?.category?.trim()
    if (!c) return
    if (!categories.includes(c)) setCategories(prev => [...prev, c])
    if (!selectedCategories.includes(c)) setSelectedCategories(prev => [...prev, c])
  }

  const applySuggestedOrigin = () => {
    const o = aiSuggestion?.origin?.trim()
    if (!o) return
    if (!origins.includes(o)) setOrigins(prev => [...prev, o])
    setOrigin(o)
  }

  const applySuggestedTasteTypes = () => {
    const ids = aiSuggestion?.taste_type_ids ?? []
    if (ids.length === 0) return
    setSelectedTasteIds(prev => Array.from(new Set([...prev, ...ids])))
  }

  const applySuggestedMemo = () => {
    if (!aiSuggestion?.memo) return
    setMemo(aiSuggestion.memo)
  }

  const applySuggestedPrice = () => {
    if (aiSuggestion?.price == null) return
    setPrice(String(aiSuggestion.price))
  }

  const toggleTaste = (id: number) => {
    if (selectedTasteIds.includes(id)) {
      setSelectedTasteIds(selectedTasteIds.filter(x => x !== id))
    } else {
      setSelectedTasteIds([...selectedTasteIds, id])
    }
  }

  const toggleCategory = (c: string) => {
    if (selectedCategories.includes(c)) {
      setSelectedCategories(selectedCategories.filter(x => x !== c))
    } else {
      setSelectedCategories([...selectedCategories, c])
    }
  }

  const addNewCategory = () => {
    const c = newCategoryName.trim()
    if (c && !selectedCategories.includes(c)) {
      setSelectedCategories([...selectedCategories, c])
      if (!categories.includes(c)) {
        setCategories([...categories, c])
      }
    }
    setNewCategoryName('')
    setIsNewCategory(false)
  }

  const toggleOrigin = (o: string) => {
    if (origin === o) {
      setOrigin('')
    } else {
      setOrigin(o)
    }
  }

  const addNewOrigin = () => {
    const o = newOriginName.trim()
    if (o) {
      setOrigin(o)
      if (!origins.includes(o)) {
        setOrigins([...origins, o])
      }
    }
    setNewOriginName('')
    setIsNewOrigin(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{drink ? 'お酒を編集' : '新しいお酒を登録'}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-zinc-400">名前 <span className="text-red-400">*</span></label>
              <button
                type="button"
                onClick={handleAiSuggest}
                disabled={aiLoading || !name.trim()}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AIでサジェスト
              </button>
            </div>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="例: 新政 No.6" className="bg-zinc-950 border-zinc-800 text-white" />
          </div>

          {(aiSuggestion || aiError) && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
              <p className="text-xs text-zinc-500">ウェブ検索を元にした参考情報です。内容は必ずご確認ください。</p>
              {aiError && <p className="text-sm text-red-400">{aiError}</p>}
              {aiSuggestion && (
                <div className="space-y-2.5">
                  {aiSuggestion.category && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-300 truncate">種類: {aiSuggestion.category}</span>
                      <button type="button" onClick={applySuggestedCategory} className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-amber-500/50 text-amber-400 hover:bg-amber-600/20 transition-colors">反映</button>
                    </div>
                  )}
                  {aiSuggestion.origin && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-300 truncate">産地: {aiSuggestion.origin}</span>
                      <button type="button" onClick={applySuggestedOrigin} className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-amber-500/50 text-amber-400 hover:bg-amber-600/20 transition-colors">反映</button>
                    </div>
                  )}
                  {aiSuggestion.taste_type_ids.length > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-300 truncate">
                        味のタイプ: {aiSuggestion.taste_type_ids.map(id => tasteTypes.find(t => t.id === id)?.name).filter(Boolean).join('、')}
                      </span>
                      <button type="button" onClick={applySuggestedTasteTypes} className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-amber-500/50 text-amber-400 hover:bg-amber-600/20 transition-colors">反映</button>
                    </div>
                  )}
                  {aiSuggestion.price != null && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-300 truncate">想定価格: {aiSuggestion.price.toLocaleString()}円</span>
                      <button type="button" onClick={applySuggestedPrice} className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-amber-500/50 text-amber-400 hover:bg-amber-600/20 transition-colors">反映</button>
                    </div>
                  )}
                  {aiSuggestion.memo && (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm text-zinc-300">メモ: {aiSuggestion.memo}</span>
                      <button type="button" onClick={applySuggestedMemo} className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-amber-500/50 text-amber-400 hover:bg-amber-600/20 transition-colors">反映</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!drink && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">画像</label>
              {imagePreview ? (
                <div className="relative w-full max-w-[160px]">
                  <img src={imagePreview} alt="プレビュー" className="w-full h-auto rounded-lg border border-zinc-800" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null) }}
                    className="absolute top-1 right-1 bg-red-600/80 p-1 rounded-full text-white hover:bg-red-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div>
                  <input type="file" id="new-drink-image" className="hidden" accept="image/*" onChange={handleImageSelect} />
                  <label htmlFor="new-drink-image" className="cursor-pointer inline-flex items-center gap-2 text-sm bg-zinc-950 hover:bg-zinc-800 text-zinc-300 py-2 px-3 rounded-md transition-colors border border-zinc-800">
                    <ImagePlus className="h-4 w-4" />
                    画像を選択
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">種類 <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-2 mb-2">
              {categories.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                    selectedCategories.includes(c)
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {isNewCategory ? (
              <div className="flex gap-2 mt-2">
                <Input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="例: 日本酒"
                  className="bg-zinc-950 border-zinc-800 text-white flex-1"
                />
                <button type="button" onClick={addNewCategory} className="shrink-0 px-3 rounded-md border border-zinc-800 hover:bg-zinc-800 text-white text-sm transition-colors">追加</button>
                <button type="button" onClick={() => { setIsNewCategory(false); setNewCategoryName(''); }} className="shrink-0 px-3 rounded-md border border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-sm transition-colors">キャンセル</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsNewCategory(true)}
                className="text-sm text-zinc-400 hover:text-white px-2 py-1 rounded-md border border-zinc-800 hover:bg-zinc-800 transition-colors"
              >
                ＋ 新しい種類を追加
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">値段 (円)</label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="2000" className="bg-zinc-950 border-zinc-800 text-white" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">産地</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {origins.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleOrigin(o)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                    origin === o
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            {isNewOrigin ? (
              <div className="flex gap-2 mt-2">
                <Input
                  value={newOriginName}
                  onChange={e => setNewOriginName(e.target.value)}
                  placeholder="例: 秋田県"
                  className="bg-zinc-950 border-zinc-800 text-white flex-1"
                />
                <button type="button" onClick={addNewOrigin} className="shrink-0 px-3 rounded-md border border-zinc-800 hover:bg-zinc-800 text-white text-sm transition-colors">追加</button>
                <button type="button" onClick={() => { setIsNewOrigin(false); setNewOriginName(''); }} className="shrink-0 px-3 rounded-md border border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-sm transition-colors">キャンセル</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsNewOrigin(true)}
                className="text-sm text-zinc-400 hover:text-white px-2 py-1 rounded-md border border-zinc-800 hover:bg-zinc-800 transition-colors"
              >
                ＋ 新しい産地を追加
              </button>
            )}
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
