import type { CaseDetail, ComponentCondition, ComponentInventoryRecord, ComponentRecord, ComponentTestStatus, DashboardSummary, Health, InventoryComponentCandidate, KnowledgeSource, RepairCase, Recommendation, ResaleStatus, ReuseStatus, TestResult, TestStatus } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
  } catch {
    throw new Error(`Unable to connect to the Fixora backend at ${API_BASE}. Check that it is running, then try again.`)
  }
  if (!response.ok) {
    let message = `The request failed with status ${response.status}.`
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
    priority: string; customer_contact?: string; estimated_minutes?: number | null; estimate_cost?: number | null
  }) => request<RepairCase>('/api/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (id: string, data: { status?: string; priority?: string; customer_contact?: string }) => request<RepairCase>(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCase: (id: string) => request<{ ok: boolean; deleted: string }>(`/api/cases/${id}`, { method: 'DELETE' }),
  addTest: (id: string, data: { test_name: string; result: TestStatus; observed_result: string; details: string }) => request<TestResult>(`/api/cases/${id}/tests`, { method: 'POST', body: JSON.stringify(data) }),
  createComponent: (caseId: string, data: { component_name: string; model_part_number?: string }) => request<ComponentRecord>(`/api/cases/${encodeURIComponent(caseId)}/components`, { method: 'POST', body: JSON.stringify(data) }),
  addComponentTest: (caseId: string, componentId: number, data: { test_name: string; result: ComponentTestStatus; observed_result: string; details: string }) => request<ComponentRecord>(`/api/cases/${encodeURIComponent(caseId)}/components/${componentId}/tests`, { method: 'POST', body: JSON.stringify(data) }),
  inventory: () => request<ComponentInventoryRecord[]>('/api/inventory'),
  inventoryCandidates: () => request<InventoryComponentCandidate[]>('/api/components/available-for-inventory'),
  createInventory: (componentId: number, data: { quantity_available: number; condition: ComponentCondition; condition_notes: string; storage_location?: string }) => request<ComponentInventoryRecord>(`/api/components/${componentId}/inventory`, { method: 'POST', body: JSON.stringify(data) }),
  updateInventory: (id: number, data: { condition?: ComponentCondition; condition_notes?: string; storage_location?: string | null }) => request<ComponentInventoryRecord>(`/api/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adjustInventory: (id: number, data: { quantity_delta: number; reason: string }) => request<ComponentInventoryRecord>(`/api/inventory/${id}/stock-adjustments`, { method: 'POST', body: JSON.stringify(data) }),
  reviewReuse: (id: number, data: { status: ReuseStatus; reason: string }) => request<ComponentInventoryRecord>(`/api/inventory/${id}/reuse-review`, { method: 'POST', body: JSON.stringify(data) }),
  reviewResale: (id: number, data: { status: ResaleStatus; reason: string }) => request<ComponentInventoryRecord>(`/api/inventory/${id}/resale-review`, { method: 'POST', body: JSON.stringify(data) }),
  reserveInventory: (id: number, data: { quantity: number; reason: string }) => request<ComponentInventoryRecord>(`/api/inventory/${id}/reservations`, { method: 'POST', body: JSON.stringify(data) }),
  releaseInventory: (id: number, data: { quantity: number; reason: string }) => request<ComponentInventoryRecord>(`/api/inventory/${id}/reservations/release`, { method: 'POST', body: JSON.stringify(data) }),
  useInventory: (id: number, data: { quantity: number; reason: string }) => request<ComponentInventoryRecord>(`/api/inventory/${id}/reservations/use`, { method: 'POST', body: JSON.stringify(data) }),
  recommendation: (id: string) => request<Recommendation>(`/api/cases/${id}/recommendation`, { method: 'POST' }),
  outcome: (id: string, data: { confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' }) => request<RepairCase>(`/api/cases/${id}/outcome`, { method: 'POST', body: JSON.stringify(data) }),
}
