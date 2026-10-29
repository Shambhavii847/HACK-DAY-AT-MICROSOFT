import type { CaseDetail, DashboardSummary, Health, KnowledgeSource, RepairCase, Recommendation, TestResult, TestStatus } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
  } catch {
    throw new Error(`Cannot reach the Fixora backend at ${API_BASE}. Start the backend and try again.`)
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
    priority: string; assigned_to: string; customer_reference?: string; estimated_minutes?: number | null; estimate_cost?: number | null
  }) => request<RepairCase>('/api/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (id: string, data: { status?: string; priority?: string; assigned_to?: string }) => request<RepairCase>(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addTest: (id: string, data: { test_name: string; result: TestStatus; observed_result: string; details: string }) => request<TestResult>(`/api/cases/${id}/tests`, { method: 'POST', body: JSON.stringify(data) }),
  recommendation: (id: string) => request<Recommendation>(`/api/cases/${id}/recommendation`, { method: 'POST' }),
  outcome: (id: string, data: { confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' }) => request<RepairCase>(`/api/cases/${id}/outcome`, { method: 'POST', body: JSON.stringify(data) }),
}
