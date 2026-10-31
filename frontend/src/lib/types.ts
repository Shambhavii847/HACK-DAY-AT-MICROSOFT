export type CaseStatus = 'new' | 'diagnosing' | 'waiting_parts' | 'in_repair' | 'testing' | 'completed' | 'on_hold'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type TestStatus = 'pass' | 'fail' | 'inconclusive' | 'not_tested' | 'not_applicable'

export interface RepairCase {
  id: string
  device_category: string
  brand: string
  model: string
  issue_title: string
  symptoms: string
  priority: Priority
  status: CaseStatus
  customer_contact: string | null
  confirmed_fault: string | null
  repair_action: string | null
  outcome: string | null
  estimate_cost: number | null
  estimated_minutes: number | null
  data_origin: 'demo' | 'user_entered' | string
  created_at: string
  updated_at: string
  test_count: number
  tracked_components_count?: number
  latest_recommendation_provider: string | null
}

export interface TestResult {
  id: number
  case_id: string
  test_name: string
  result: TestStatus
  observed_result: string
  details: string
  performed_at: string
}

export interface Hypothesis {
  fault: string
  likelihood: 'possible' | 'plausible' | 'less_likely'
  supporting_evidence: string[]
  contradicting_evidence: string[]
  reasoning: string
}

export interface NextCheck {
  name: string
  purpose: string
  instructions: string
  what_to_record: string
  safety_level: 'routine' | 'caution' | 'professional_only'
}

export interface KnowledgeSource {
  id: string
  title: string
  kind: string
  scope: string
  source_url?: string | null
  review_note: string
  content: string
}

export interface Recommendation {
  id: number | null
  case_id: string
  provider: 'gemini_api' | 'rule_based_fallback' | string
  model_name: string
  generated_at: string | null
  content: {
    summary: string
    hypotheses: Hypothesis[]
    next_checks: NextCheck[]
    missing_information: string[]
    safety_notes: string[]
    source_ids: string[]
    limitations: string[]
  }
  sources: Array<{ id: string; title: string; kind: string; source_url?: string | null; review_note: string }>
  similar_cases?: Array<{
    id: string
    device: string
    issue_title: string
    confirmed_fault: string
    repair_action: string | null
    outcome: string | null
    data_origin: string
    match_note: string
  }>
}

export interface CaseDetail extends RepairCase {
  tests: TestResult[]
  components?: Component[]
  latest_recommendation: Recommendation | null
}

export interface DashboardSummary {
  active_repairs: number
  ready_for_testing: number
  completed_this_week: number
  saved_cases: number
  needs_attention: number
  recent_cases: RepairCase[]
}

export interface Health {
  status: string
  app_name: string
  model_name: string
  model_configured: boolean
  inference_mode: 'gemini_api' | 'rule_based_fallback'
  note: string
}

export type ComponentHealthStatus = 'working' | 'faulty' | 'needs_testing' | 'unknown'
export type ComponentReuseStatus = 'eligible' | 'reserved' | 'consumed' | 'ineligible'
export type ComponentResaleStatus = 'under_review' | 'approved' | 'not_eligible'

export interface Component {
  id: string
  name: string
  part_number: string
  category: string
  quantity: number
  reserved_quantity: number
  used_quantity: number
  condition: string
  location: string | null
  case_id: string | null
  source_device: string | null
  health_status: ComponentHealthStatus
  test_evidence: string | null
  tested_at: string | null
  reuse_status: ComponentReuseStatus
  reuse_notes: string | null
  is_reuse_eligible: boolean
  resale_status: ComponentResaleStatus
  resale_decision: string | null
  resale_reason: string | null
  resale_condition: string | null
  resale_price: number | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
  case_info?: {
    id: string
    brand: string
    model: string
    status: string
    issue_title: string
  } | null
}

export interface ComponentSummary {
  total_components: number
  total_quantity: number
  working_count: number
  needs_testing_count: number
  faulty_count: number
  reuse_eligible_count: number
  reserved_count: number
  resale_approved_count: number
  resale_under_review_count: number
}

export interface ComponentCreate {
  name: string
  part_number?: string
  category?: string
  quantity?: number
  condition?: string
  location?: string | null
  case_id?: string | null
  source_device?: string | null
  health_status?: ComponentHealthStatus
  test_evidence?: string | null
}

export interface ComponentUpdate {
  name?: string
  part_number?: string
  category?: string
  quantity?: number
  condition?: string
  location?: string | null
  case_id?: string | null
  source_device?: string | null
  health_status?: ComponentHealthStatus
  test_evidence?: string | null
}

export interface ComponentReuseAction {
  action: 'reserve' | 'use' | 'release'
  quantity: number
  case_id?: string | null
  notes?: string | null
}

export interface ComponentResaleReview {
  resale_status: ComponentResaleStatus
  review_reason: string
  review_condition?: string | null
  resale_price?: number | null
  reviewed_by?: string | null
}
