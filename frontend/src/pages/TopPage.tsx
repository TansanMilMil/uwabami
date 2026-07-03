import { useState, useEffect, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Wine, Beer, MapPin, Tag } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDrinks, Drink } from '../api'
import { UserContext } from '../contexts/UserContext'
import DrinkModal from '../components/DrinkModal'

export default function TopPage() {
  const navigate = useNavigate()
  const currentUsername = useContext(UserContext)
  const [activeTab, setActiveTab] = useState<'drunk' | 'want_to_drink'>('drunk')
  const [search, setSearch] = useState('')
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const loadDrinks = async () => {
    setLoading(true)
    try {
      const data = await getDrinks(search, activeTab)
      setDrinks(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDrinks()
    }, 300)
    return () => clearTimeout(timer)
  }, [activeTab, search])

  const handleSaved = (drink: Drink) => {
    setShowModal(false)
    navigate(`/drinks/${drink.id}`)
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Wine className="h-8 w-8 text-amber-500" />
          My Cellar
        </h1>
        {currentUsername && (
          <Button
            onClick={() => setShowModal(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            新しいお酒を登録
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/50 p-2 rounded-xl border border-zinc-800 backdrop-blur-md">
        <div className="flex w-full sm:w-auto p-1 bg-zinc-950 rounded-lg">
          <button
            onClick={() => setActiveTab('drunk')}
            className={`flex-1 sm:w-32 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'drunk'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            呑んだ
          </button>
          <button
            onClick={() => setActiveTab('want_to_drink')}
            className={`flex-1 sm:w-32 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'want_to_drink'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            呑みたい
          </button>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="お酒の名前で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-zinc-950/50 border-zinc-700 focus-visible:ring-amber-500/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : drinks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drinks.map(drink => (
            <Link key={drink.id} to={`/drinks/${drink.id}`}>
              <Card className="h-full border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 transition-all duration-300 hover:shadow-xl hover:shadow-amber-900/10 hover:-translate-y-1 group overflow-hidden flex flex-col">
                {drink.image_path ? (
                  <div className="w-full h-32 overflow-hidden">
                    <img src={`/uploads/${drink.image_path}`} alt={drink.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="w-full h-2 bg-zinc-800" />
                )}
                <CardContent className="p-5 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1" title={drink.name}>
                      {drink.name}
                    </h3>
                    <Badge variant="outline" className="bg-zinc-950 border-zinc-700 text-zinc-300 whitespace-nowrap">
                      {drink.category}
                    </Badge>
                  </div>
                  
                  {drink.origin && (
                    <div className="flex items-center gap-1.5 text-sm text-zinc-400 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="truncate">{drink.origin}</span>
                    </div>
                  )}

                  <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                    {drink.taste_types?.map(t => (
                      <span key={t.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                        <Tag className="h-3 w-3 mr-1 opacity-50" />
                        {t.name}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-4">
          <Beer className="h-16 w-16 opacity-20" />
          <p>見つかりませんでした</p>
        </div>
      )}

      {showModal && (
        <DrinkModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
          initialStatus={activeTab}
        />
      )}
    </div>
  )
}
