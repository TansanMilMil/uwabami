export interface User {
  id: number
  username: string
}

export interface Drink {
  id: number
  name: string
  category: string
  status: 'want_to_drink' | 'drunk'
  origin?: string | null
  price?: number | null
  memo?: string | null
  image_path?: string | null
  created_by: number
  taste_types: TasteType[]
  latest_memo?: string | null
  latest_star_rating?: number | null
  latest_drunk_date?: string | null
  latest_username?: string | null
}

export interface TasteType {
  id: number
  name: string
}

export interface DrinkLog {
  id: number
  drink_id: number
  user_id: number
  drunk_date: string
  star_rating: number
  memo?: string | null
  username?: string | null
}

const BASE = '/api'

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { credentials: 'include', ...init })
  if (res.status === 401) {
    window.dispatchEvent(new Event('unauthorized'))
    throw new UnauthorizedError()
  }
  return res
}

function jsonInit(method: string, data: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}

function assertOk(res: Response, message: string): void {
  if (!res.ok) throw new Error(message)
}

async function fetchJsonOr<T>(path: string, fallback: T): Promise<T> {
  const res = await authFetch(`${BASE}${path}`)
  if (!res.ok) return fallback
  return res.json()
}

// Auth
export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/login`, {
    credentials: 'include',
    ...jsonInit('POST', { username, password }),
  })
  if (res.status === 401) throw new UnauthorizedError()
  assertOk(res, 'ログインに失敗しました')
}

export async function logout(): Promise<void> {
  await authFetch(`${BASE}/auth/logout`, { method: 'POST' })
}

export async function checkAuth(): Promise<string | null> {
  try {
    const res = await authFetch(`${BASE}/auth/me`)
    if (!res.ok) return null
    const data = await res.json()
    return data.username as string
  } catch (e) {
    if (e instanceof UnauthorizedError) return null
    throw e
  }
}

// Drinks
export async function getDrinks(query?: string, status?: string, category?: string, sort?: string): Promise<Drink[]> {
  const params = new URLSearchParams()
  if (query) params.append('q', query)
  if (status) params.append('status', status)
  if (category) params.append('category', category)
  if (sort) params.append('sort', sort)
  const qs = params.toString()
  const path = qs ? `/drinks?${qs}` : '/drinks'
  return fetchJsonOr<Drink[]>(path, [])
}

export async function getDrinkCategories(): Promise<string[]> {
  return fetchJsonOr<string[]>('/drinks/categories', [])
}

export async function getDrinkOrigins(): Promise<string[]> {
  return fetchJsonOr<string[]>('/drinks/origins', [])
}

export async function getDrink(id: number): Promise<Drink> {
  const res = await authFetch(`${BASE}/drinks/${id}`)
  assertOk(res, 'お酒が見つかりません')
  return res.json()
}

export async function createDrink(data: Partial<Drink>): Promise<Drink> {
  const res = await authFetch(`${BASE}/drinks`, jsonInit('POST', data))
  assertOk(res, 'お酒の登録に失敗しました')
  return res.json()
}

export async function updateDrink(id: number, data: Partial<Drink>): Promise<Drink> {
  const res = await authFetch(`${BASE}/drinks/${id}`, jsonInit('PUT', data))
  assertOk(res, 'お酒の更新に失敗しました')
  return res.json()
}

export async function deleteDrink(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/drinks/${id}`, { method: 'DELETE' })
  assertOk(res, 'お酒の削除に失敗しました')
}

export async function uploadDrinkImage(id: number, file: File): Promise<{ image_path: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await authFetch(`${BASE}/drinks/${id}/image`, {
    method: 'POST',
    body: formData,
  })
  assertOk(res, '画像のアップロードに失敗しました')
  return res.json()
}

export async function deleteDrinkImage(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/drinks/${id}/image`, { method: 'DELETE' })
  assertOk(res, '画像の削除に失敗しました')
}

export interface DrinkSuggestResult {
  name: string | null
  category: string | null
  origin: string | null
  taste_type_ids: number[]
  memo: string | null
  price: number | null
}

export async function suggestDrinkInfo(name: string, image?: File | null): Promise<DrinkSuggestResult> {
  const formData = new FormData()
  if (name) formData.append('name', name)
  if (image) formData.append('image', image)
  const res = await authFetch(`${BASE}/drinks/suggest`, {
    method: 'POST',
    body: formData,
  })
  if (res.status === 429) {
    throw new Error('リクエストが多すぎます。しばらく待ってから再試行してください')
  }
  assertOk(res, 'AIサジェストの取得に失敗しました')
  return res.json()
}

// Logs
export async function getDrinkLogs(drinkId: number): Promise<DrinkLog[]> {
  return fetchJsonOr<DrinkLog[]>(`/drinks/${drinkId}/logs`, [])
}

export async function createDrinkLog(drinkId: number, data: Partial<DrinkLog>): Promise<DrinkLog> {
  const res = await authFetch(`${BASE}/drinks/${drinkId}/logs`, jsonInit('POST', data))
  assertOk(res, '記録の追加に失敗しました')
  return res.json()
}

export async function updateDrinkLog(logId: number, data: Partial<DrinkLog>): Promise<DrinkLog> {
  const res = await authFetch(`${BASE}/logs/${logId}`, jsonInit('PUT', data))
  assertOk(res, '記録の更新に失敗しました')
  return res.json()
}

export async function deleteDrinkLog(logId: number): Promise<void> {
  const res = await authFetch(`${BASE}/logs/${logId}`, { method: 'DELETE' })
  assertOk(res, '記録の削除に失敗しました')
}

// Taste Types
export async function getTasteTypes(): Promise<TasteType[]> {
  return fetchJsonOr<TasteType[]>('/taste-types', [])
}

export async function createTasteType(name: string): Promise<TasteType> {
  const res = await authFetch(`${BASE}/taste-types`, jsonInit('POST', { name }))
  assertOk(res, '味のタイプの登録に失敗しました')
  return res.json()
}

export interface StepCreate {
  step_number: number
  description: string
}

export interface Step extends StepCreate {
  id: number
  recipe_id: number
}

export interface IngredientCreate {
  group_name?: string | null
  sort_order?: number | null
  name: string
  quantity?: string | null
  unit?: string | null
  note?: string | null
}

export interface Ingredient extends IngredientCreate {
  id: number
  recipe_id: number
}

export interface RecipeCreate {
  name: string
  source_url?: string | null
  servings?: number | null
  ingredients: IngredientCreate[]
  steps: StepCreate[]
}

export interface RecipeUpdate extends RecipeCreate {}

export interface Recipe {
  id: number
  name: string
  source_url?: string | null
  servings?: number | null
  scraped_at?: string | null
  username?: string | null
  ingredient_names: string[]
  image_path?: string | null
}

export interface RecipeDetail extends Recipe {
  ingredients: Ingredient[]
  steps: Step[]
}

export interface CookedLogEntry {
  recipe_id: number
  recipe_name?: string | null
  image_path?: string | null
  count: number
  last_cooked_at: string
  latest_memo?: string | null
}

export interface CookedLogRawEntry {
  id: number
  cooked_at: string
  memo?: string | null
}

export interface SuggestResult {
  comment: string
  recipes: Recipe[]
}

export class DuplicateUrlError extends Error {
  constructor() {
    super('Duplicate URL')
    this.name = 'DuplicateUrlError'
  }
}

// Recipes
export async function searchRecipes(q: string = ''): Promise<Recipe[]> {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const qs = params.toString()
  const path = qs ? `/recipes?${qs}` : '/recipes'
  return fetchJsonOr<Recipe[]>(path, [])
}

export async function importRecipeFromUrl(url: string): Promise<RecipeDetail> {
  const res = await authFetch(`${BASE}/ai/recipes/from-url`, jsonInit('POST', { url }))
  if (res.status === 409) throw new DuplicateUrlError()
  assertOk(res, 'URLからのレシピ取得に失敗しました')
  return res.json()
}

export async function createRecipe(data: RecipeCreate): Promise<RecipeDetail> {
  const res = await authFetch(`${BASE}/recipes`, jsonInit('POST', data))
  assertOk(res, 'レシピの登録に失敗しました')
  return res.json()
}

export async function getRecipe(id: number): Promise<RecipeDetail> {
  const res = await authFetch(`${BASE}/recipes/${id}`)
  assertOk(res, 'レシピが見つかりません')
  return res.json()
}

export async function updateRecipe(id: number, data: RecipeUpdate): Promise<RecipeDetail> {
  const res = await authFetch(`${BASE}/recipes/${id}`, jsonInit('PUT', data))
  assertOk(res, 'レシピの更新に失敗しました')
  return res.json()
}

export async function deleteRecipe(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/recipes/${id}`, { method: 'DELETE' })
  assertOk(res, 'レシピの削除に失敗しました')
}

export async function recordRecipeViewed(id: number): Promise<void> {
  await authFetch(`${BASE}/recipes/${id}/viewed`, { method: 'POST' })
}

export async function uploadRecipeImage(id: number, file: File): Promise<{ image_path: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await authFetch(`${BASE}/recipes/${id}/image`, {
    method: 'POST',
    body: formData,
  })
  assertOk(res, '画像のアップロードに失敗しました')
  return res.json()
}

export async function deleteRecipeImage(id: number): Promise<void> {
  const res = await authFetch(`${BASE}/recipes/${id}/image`, { method: 'DELETE' })
  assertOk(res, '画像の削除に失敗しました')
}

export async function getRecipesByIds(ids: number[]): Promise<Recipe[]> {
  const promises = ids.map(id => getRecipe(id).catch(() => null))
  const results = await Promise.all(promises)
  return results.filter((r): r is RecipeDetail => r !== null)
}

// Bookmarks
export async function getRecipeBookmarks(): Promise<number[]> {
  return fetchJsonOr<number[]>('/bookmarks/recipes', [])
}
export async function addRecipeBookmark(recipeId: number): Promise<void> {
  const res = await authFetch(`${BASE}/bookmarks/recipes/${recipeId}`, { method: 'POST' })
  assertOk(res, 'ブックマークの追加に失敗しました')
}
export async function removeRecipeBookmark(recipeId: number): Promise<void> {
  const res = await authFetch(`${BASE}/bookmarks/recipes/${recipeId}`, { method: 'DELETE' })
  assertOk(res, 'ブックマークの削除に失敗しました')
}

export async function getIngredientBookmarks(): Promise<string[]> {
  return fetchJsonOr<string[]>('/bookmarks/ingredients', [])
}
export async function addIngredientBookmark(name: string): Promise<void> {
  const res = await authFetch(`${BASE}/bookmarks/ingredients`, jsonInit('POST', { name }))
  assertOk(res, 'ブックマークの追加に失敗しました')
}
export async function removeIngredientBookmark(name: string): Promise<void> {
  const res = await authFetch(`${BASE}/bookmarks/ingredients`, jsonInit('DELETE', { name }))
  assertOk(res, 'ブックマークの削除に失敗しました')
}

// Cooked Logs
export async function getCookedLogs(): Promise<CookedLogEntry[]> {
  return fetchJsonOr<CookedLogEntry[]>('/cooked-logs', [])
}
export async function getCookedLogForRecipe(recipeId: number): Promise<CookedLogEntry | null> {
  const res = await authFetch(`${BASE}/cooked-logs/${recipeId}`)
  if (!res.ok) return null
  return res.json()
}
export async function getCookedLogEntries(recipeId: number): Promise<CookedLogRawEntry[]> {
  return fetchJsonOr<CookedLogRawEntry[]>(`/cooked-logs/${recipeId}/entries`, [])
}
export async function addCookedLog(recipeId: number, memo: string): Promise<void> {
  const res = await authFetch(`${BASE}/cooked-logs/${recipeId}`, jsonInit('POST', { memo }))
  assertOk(res, '記録の追加に失敗しました')
}
export async function updateCookedLogEntry(recipeId: number, entryId: number, memo: string): Promise<void> {
  const res = await authFetch(`${BASE}/cooked-logs/${recipeId}/entries/${entryId}`, jsonInit('PUT', { memo }))
  assertOk(res, '記録の更新に失敗しました')
}
export async function deleteCookedLogEntry(recipeId: number, entryId: number): Promise<void> {
  const res = await authFetch(`${BASE}/cooked-logs/${recipeId}/entries/${entryId}`, { method: 'DELETE' })
  assertOk(res, '記録の削除に失敗しました')
}

// History
export async function getRecentViewedRecipes(): Promise<Recipe[]> {
  return fetchJsonOr<Recipe[]>('/history/recipes', [])
}
export async function getRecentViewedIngredients(): Promise<string[]> {
  return fetchJsonOr<string[]>('/history/ingredients', [])
}

// Suggest
export async function getIngredientSuggestions(): Promise<string[]> {
  return fetchJsonOr<string[]>('/ingredients/suggestions', [])
}
export async function suggestRecipes(query: string): Promise<SuggestResult> {
  const res = await authFetch(`${BASE}/ai/suggest`, jsonInit('POST', { query }))
  assertOk(res, '提案の取得に失敗しました')
  return res.json()
}
