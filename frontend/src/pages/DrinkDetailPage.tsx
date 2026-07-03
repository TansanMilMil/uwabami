import { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, MapPin, Tag, Wine, Plus, Calendar, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getDrink, getDrinkLogs, deleteDrink, deleteDrinkLog, Drink, DrinkLog } from '../api'
import { UserContext } from '../contexts/UserContext'
import DrinkModal from '../components/DrinkModal'
import DrinkLogModal from '../components/DrinkLogModal'
import { toast } from 'sonner'

export default function DrinkDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUsername = useContext(UserContext)
  
  const [drink, setDrink] = useState<Drink | null>(null)
  const [logs, setLogs] = useState<DrinkLog[]>([])
  const [loading, setLoading] = useState(true)
  
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [editingLog, setEditingLog] = useState<DrinkLog | undefined>(undefined)

  const loadData = async () => {
    if (!id) return
    try {
      const [d, l] = await Promise.all([
        getDrink(Number(id)),
        getDrinkLogs(Number(id))
      ])
      setDrink(d)
      setLogs(l)
    } catch (e) {
      toast.error('お酒情報の取得に失敗しました')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleDeleteDrink = async () => {
    if (!id || !window.confirm('本当にこのお酒を削除しますか？')) return
    try {
      await deleteDrink(Number(id))
      toast.success('削除しました')
      navigate('/')
    } catch (e) {
      toast.error('削除に失敗しました')
    }
  }

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('この記録を削除しますか？')) return
    try {
      await deleteDrinkLog(logId)
      toast.success('記録を削除しました')
      loadData()
    } catch (e) {
      toast.error('削除に失敗しました')
    }
  }

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-8 w-24 bg-zinc-800 rounded" />
      <div className="h-48 bg-zinc-900/50 rounded-2xl border border-zinc-800" />
      <div className="h-64 bg-zinc-900/50 rounded-2xl border border-zinc-800" />
    </div>
  }

  if (!drink) return null

  // In a real app, we would verify `drink.created_by` matches current user ID. 
  // Since we only have username in Context, we assume if username exists, they might be the owner. 
  // Adjust this based on backend exact implementation. For now, allow edit if logged in.
  const canEdit = !!currentUsername

  return (
    <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      <button 
        onClick={() => navigate('/')} 
        className="flex items-center text-sm font-medium text-zinc-400 hover:text-white transition-colors w-fit group"
      >
        <ArrowLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-1" />
        一覧に戻る
      </button>

      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 shadow-xl p-6 sm:p-10 backdrop-blur-sm">
        <div className="absolute top-0 right-0 p-32 bg-amber-500/5 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Badge variant="outline" className="bg-zinc-950 border-amber-600/30 text-amber-500 px-3 py-1 text-sm">
                {drink.category}
              </Badge>
              <Badge variant="secondary" className={`${drink.status === 'drunk' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'} border`}>
                {drink.status === 'drunk' ? '呑んだ' : '呑みたい'}
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              {drink.name}
            </h1>
          </div>
          
          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)} className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800">
                <Edit2 className="h-4 w-4 mr-2" />
                編集
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteDrink} className="border-zinc-700 bg-zinc-900 hover:bg-red-950 hover:text-red-400 hover:border-red-900">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {drink.origin && (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500 flex items-center gap-1"><MapPin className="h-4 w-4" /> 産地</span>
              <span className="text-zinc-200 font-medium">{drink.origin}</span>
            </div>
          )}
          {drink.price && (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500 flex items-center gap-1"><Tag className="h-4 w-4" /> 値段</span>
              <span className="text-zinc-200 font-medium">¥{drink.price.toLocaleString()}</span>
            </div>
          )}
        </div>

        {drink.taste_types && drink.taste_types.length > 0 && (
          <div className="mb-6">
            <span className="text-sm text-zinc-500 mb-2 block">味のタイプ</span>
            <div className="flex flex-wrap gap-2">
              {drink.taste_types.map(t => (
                <span key={t.id} className="px-3 py-1 rounded-full text-sm font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 shadow-sm">
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {drink.memo && (
          <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
            <span className="text-xs text-zinc-500 mb-1 block uppercase tracking-wider font-semibold">Memo</span>
            <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed text-sm">{drink.memo}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wine className="h-6 w-6 text-zinc-400" />
            呑んだ記録
          </h2>
          {canEdit && (
            <Button onClick={() => { setEditingLog(undefined); setShowLogModal(true); }} className="bg-amber-600 hover:bg-amber-700 text-white rounded-full pl-3 pr-4 shadow-lg shadow-amber-900/20">
              <Plus className="h-4 w-4 mr-1.5" />
              記録を追加
            </Button>
          )}
        </div>

        {logs.length > 0 ? (
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-medium bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800 shadow-inner">
                      <Calendar className="h-4 w-4 text-zinc-500" />
                      {log.drunk_date}
                    </div>
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < log.star_rating ? 'fill-amber-500' : 'text-zinc-700'}`} />
                      ))}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingLog(log); setShowLogModal(true); }} className="text-zinc-500 hover:text-white transition-colors p-1"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => handleDeleteLog(log.id)} className="text-zinc-500 hover:text-red-400 transition-colors p-1"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                {log.memo && <p className="text-zinc-400 text-sm whitespace-pre-wrap">{log.memo}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-zinc-900/20 border border-zinc-800/50 rounded-2xl border-dashed">
            <p className="text-zinc-500 mb-2">まだ記録がありません</p>
          </div>
        )}
      </div>

      {showEditModal && (
        <DrinkModal
          drink={drink}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => { setShowEditModal(false); setDrink(updated); }}
        />
      )}

      {showLogModal && (
        <DrinkLogModal
          drinkId={Number(id)}
          log={editingLog}
          onClose={() => setShowLogModal(false)}
          onSaved={() => { setShowLogModal(false); loadData(); }}
        />
      )}
    </div>
  )
}
