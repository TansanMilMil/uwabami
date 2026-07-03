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
  created_by: number
  taste_types: TasteType[]
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
export async function getDrinks(query?: string, status?: string): Promise<Drink[]> {
  const params = new URLSearchParams()
  if (query) params.append('q', query)
  if (status) params.append('status', status)
  const qs = params.toString()
  const path = qs ? `/drinks?${qs}` : '/drinks'
  return fetchJsonOr<Drink[]>(path, [])
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
