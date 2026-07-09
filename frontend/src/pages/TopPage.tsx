import { useState, useEffect, useContext } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { Plus, Search, Wine, Beer, MapPin, Tag, MessageSquare, Star, Calendar, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDrinks, getDrinkCategories, Drink } from '../api'
import { UserContext } from '../contexts/UserContext'
import DrinkModal from '../components/DrinkModal'
import DrinkDetailModal from '../components/DrinkDetailModal'

export default function TopPage() {
  const currentUsername = useContext(UserContext)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'drunk' | 'want_to_drink'>(
    searchParams.get('status') === 'want_to_drink' ? 'want_to_drink' : 'drunk'
  )
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [categories, setCategories] = useState<string[]>([])
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedDrinkId, setSelectedDrinkId] = useState<number | null>(null)

  const loadDrinks = async () => {
    setLoading(true)
    try {
      const data = await getDrinks(search, activeTab, category)
      setDrinks(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getDrinkCategories().then(setCategories).catch(console.error)
  }, [])

  useEffect(() => {
    if ((location.state as { resetSearch?: boolean } | null)?.resetSearch) {
      setActiveTab('drunk')
      setSearch('')
      setCategory('')
    }
  }, [location.state])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDrinks()
      const params: Record<string, string> = {}
      if (search) params.q = search
      if (category) params.category = category
      if (activeTab !== 'drunk') params.status = activeTab
      setSearchParams(params)
    }, 300)
    return () => clearTimeout(timer)
  }, [activeTab, search, category])

  const handleSaved = (drink: Drink) => {
    setShowModal(false)
    loadDrinks()
    setSelectedDrinkId(drink.id)
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
        <div className="flex w-full sm:w-auto gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="お酒の名前で検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-zinc-950/50 border-zinc-700 focus-visible:ring-amber-500/50"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-10 px-3 rounded-md bg-zinc-950/50 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none shrink-0"
          >
            <option value="">すべての種類</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {!loading && drinks.length > 0 && (
        <p className="text-sm text-zinc-400">{drinks.length}件のお酒が見つかりました</p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : drinks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {drinks.map(drink => (
            <div
              key={drink.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDrinkId(drink.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedDrinkId(drink.id)
                }
              }}
              className="cursor-pointer"
            >
              <Card className="h-[250px] border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 transition-all duration-300 hover:shadow-xl hover:shadow-amber-900/10 hover:-translate-y-1 group overflow-hidden flex flex-row">
                {drink.image_path ? (
                  <div className="w-28 sm:w-32 shrink-0 overflow-hidden">
                    <img src={`/uploads/${drink.image_path}`} alt={drink.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="w-2 shrink-0 bg-zinc-800" />
                )}
                <CardContent className="p-5 flex flex-col flex-grow min-w-0">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg text-zinc-100 group-hover:text-amber-400 transition-colors">
                      {drink.name}
                    </h3>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {drink.category.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                        <Badge key={c} variant="outline" className="bg-zinc-950 border-zinc-700 text-zinc-300 whitespace-nowrap">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {drink.origin && (
                    <div className="flex items-center gap-1.5 text-sm text-zinc-400 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="truncate">{drink.origin}</span>
                    </div>
                  )}

                  {drink.latest_memo && (
                    <div className="mb-2">
                      {(drink.latest_star_rating != null || drink.latest_drunk_date || drink.latest_username) && (
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {drink.latest_star_rating != null && (
                            <div className="flex text-amber-500">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`h-3.5 w-3.5 ${i < drink.latest_star_rating! ? 'fill-amber-500' : 'text-zinc-700'}`} />
                              ))}
                            </div>
                          )}
                          {drink.latest_drunk_date && (
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <Calendar className="h-3 w-3" />
                              {drink.latest_drunk_date}
                            </div>
                          )}
                          {drink.latest_username && (
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <User className="h-3 w-3" />
                              {drink.latest_username}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-start gap-1.5 text-sm text-zinc-400">
                        <MessageSquare className="h-3.5 w-3.5 text-zinc-500 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{drink.latest_memo}</span>
                      </div>
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
            </div>
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

      {selectedDrinkId != null && (
        <DrinkDetailModal
          drinkId={selectedDrinkId}
          onClose={() => setSelectedDrinkId(null)}
          onChanged={loadDrinks}
        />
      )}
    </div>
  )
}
