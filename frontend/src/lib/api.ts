import type {
  CaseDetail, DashboardSummary, Health, KnowledgeSource, RepairCase, Recommendation, TestResult, TestStatus,
  Component, ComponentSummary, ComponentCreate, ComponentUpdate, ComponentReuseAction, ComponentResaleReview,
} from './types'

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://127.0.0.1:8000')
).replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
  } catch {
    throw new Error(`Cannot reach the Revix backend at ${API_BASE}. Start the backend and try again.`)
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json() as { detail?: string }
      if (body.detail) message = body.detail
    } catch { /* response body was not JSON */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<Health>('/api/health'),
  dashboard: () => request<DashboardSummary>('/api/dashboard'),
  cases: (q = '') => request<RepairCase[]>(`/api/cases${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  caseDetail: (id: string) => request<CaseDetail>(`/api/cases/${encodeURIComponent(id)}`),
  knowledge: () => request<{ sources: KnowledgeSource[]; notice: string }>('/api/knowledge'),
  createCase: (data: {
    device_category: string; brand: string; model: string; issue_title: string; symptoms: string;
    priority: string; customer_contact?: string; estimated_minutes?: number | null; estimate_cost?: number | null;
    suspected_component?: string;
  }) => request<RepairCase>('/api/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (id: string, data: { status?: string; priority?: string; customer_contact?: string }) => request<RepairCase>(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCase: (id: string) => request<{ ok: boolean; deleted: string }>(`/api/cases/${id}`, { method: 'DELETE' }),
  addTest: (id: string, data: { test_name: string; result: TestStatus; observed_result: string; details: string }) => request<TestResult>(`/api/cases/${id}/tests`, { method: 'POST', body: JSON.stringify(data) }),
  caseComponents: (caseId: string) => request<Component[]>(`/api/cases/${encodeURIComponent(caseId)}/components`),
  addCaseComponent: (caseId: string, data: ComponentCreate) => request<Component>(`/api/cases/${encodeURIComponent(caseId)}/components`, { method: 'POST', body: JSON.stringify(data) }),
  recommendation: (id: string, engine?: string, language?: string, allowAcceleration?: boolean) => {
    const params = new URLSearchParams()
    if (engine) params.append('engine', engine)
    if (language) params.append('language', language)
    if (allowAcceleration !== undefined) params.append('allow_acceleration', String(allowAcceleration))
    const qs = params.toString() ? `?${params.toString()}` : ''
    return request<Recommendation>(`/api/cases/${encodeURIComponent(id)}/recommendation${qs}`, { method: 'POST' })
  },
  voiceBriefing: (id: string, language?: string) => {
    const qs = language ? `?language=${encodeURIComponent(language)}` : ''
    return request<{ case_id: string; language: string; briefing_text: string }>(
      `/api/cases/${encodeURIComponent(id)}/voice-briefing${qs}`,
      { method: 'POST' },
    )
  },
  outcome: (id: string, data: { confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' }) => request<RepairCase>(`/api/cases/${id}/outcome`, { method: 'POST', body: JSON.stringify(data) }),

  // Component Inventory, Reuse & Resale Manager
  components: (filters?: {
    q?: string
    category?: string
    health_status?: string
    reuse_status?: string
    resale_status?: string
    reuse_eligible_only?: boolean
    case_id?: string
  }) => {
    const params = new URLSearchParams()
    if (filters?.q) params.append('q', filters.q)
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category)
    if (filters?.health_status && filters.health_status !== 'all') params.append('health_status', filters.health_status)
    if (filters?.reuse_status && filters.reuse_status !== 'all') params.append('reuse_status', filters.reuse_status)
    if (filters?.resale_status && filters.resale_status !== 'all') params.append('resale_status', filters.resale_status)
    if (filters?.reuse_eligible_only) params.append('reuse_eligible_only', 'true')
    if (filters?.case_id) params.append('case_id', filters.case_id)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return request<Component[]>(`/api/components${qs}`)
  },
  componentSummary: () => request<ComponentSummary>('/api/components/summary'),
  componentDetail: (id: string) => request<Component>(`/api/components/${encodeURIComponent(id)}`),
  createComponent: (data: ComponentCreate) => request<Component>('/api/components', { method: 'POST', body: JSON.stringify(data) }),
  updateComponent: (id: string, data: ComponentUpdate) => request<Component>(`/api/components/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteComponent: (id: string) => request<{ ok: boolean; deleted: string }>(`/api/components/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  reuseComponent: (id: string, data: ComponentReuseAction) => request<Component>(`/api/components/${encodeURIComponent(id)}/reuse`, { method: 'POST', body: JSON.stringify(data) }),
  reviewComponentResale: (id: string, data: ComponentResaleReview) => request<Component>(`/api/components/${encodeURIComponent(id)}/resale-review`, { method: 'POST', body: JSON.stringify(data) }),
}
