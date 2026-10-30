export type CaseStatus = 'new' | 'diagnosing' | 'waiting_parts' | 'in_repair' | 'testing' | 'completed' | 'on_hold'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type TestStatus = 'pass' | 'fail' | 'inconclusive' | 'not_tested' | 'not_applicable'
export type ComponentHealthStatus = 'working' | 'faulty' | 'needs_testing' | 'unknown'
export type ComponentTestStatus = 'pass' | 'fail' | 'inconclusive' | 'not_tested'
export type ComponentCondition = 'new' | 'like_new' | 'good' | 'fair' | 'damaged' | 'unknown'
export type ReuseStatus = 'under_review' | 'available' | 'not_eligible'
export type ResaleStatus = 'under_review' | 'approved_for_resale' | 'not_eligible'

export interface ComponentTestEvidence {
  id: number
  component_id: number
  test_name: string
  result: ComponentTestStatus
  observed_result: string
  details: string
  performed_at: string
}

export interface ComponentRecord {
  id: number
  case_id: string
  component_name: string
  model_part_number: string | null
  health_status: ComponentHealthStatus
  tests: ComponentTestEvidence[]
  created_at: string
  updated_at: string
}

export interface InventoryComponentCandidate extends Omit<ComponentRecord, 'tests' | 'created_at' | 'updated_at'> {
  latest_test: ComponentTestEvidence | null
  source_device: string
}

export interface ComponentInventoryEvent {
  id: number
  event_type: string
  quantity: number
  reason: string
  occurred_at: string
}

export interface ComponentInventoryRecord {
  id: number
  component_id: number
  case_id: string
  component_name: string
  model_part_number: string | null
  source_device: string
  health_status: ComponentHealthStatus
  latest_test: ComponentTestEvidence | null
  quantity_available: number
  quantity_reserved: number
  quantity_used: number
  condition: ComponentCondition
  condition_notes: string
  condition_assessed_at: string
  storage_location: string | null
  reuse_status: ReuseStatus
  reuse_reason: string
  reuse_reviewed_at: string | null
  resale_status: ResaleStatus
  resale_reason: string
  resale_reviewed_at: string | null
  events: ComponentInventoryEvent[]
  created_at: string
  updated_at: string
}

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
  latest_recommendation_provider: string | null
  evidence_outdated: boolean
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

export interface TimelineEvent {
  id: string
  event_type: string
  title: string
  description: string
  happened_at: string
  details?: Record<string, string>
}

export interface SafetyAlert {
  title: string
  severity: 'caution' | 'urgent' | string
  instruction: string
  evidence: string
  source: string
  recorded_at: string
  disclaimer: string
}

export interface SimilarRepair {
  id: string
  device_category: string
  device: string
  issue_title: string
  symptoms: string
  status: CaseStatus
  confirmed_fault: string
  repair_action: string | null
  outcome: string
  tests: Array<{ test_name: string; result: TestStatus; observed_result: string; performed_at: string }>
  data_origin: string
  match_reasons: string[]
  disclaimer: string
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
    evidence_test_ids?: number[]
    new_evidence_test_ids?: number[]
    previous_recommendation_id?: number | null
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
  components: ComponentRecord[]
  latest_recommendation: Recommendation | null
  timeline: TimelineEvent[]
  safety_alerts: SafetyAlert[]
  similar_cases: SimilarRepair[]
}

export interface DashboardSummary {
  total_cases: number
  pending_repairs: number
  in_progress: number
  completed_repairs: number
  awaiting_diagnosis: number
  evidence_to_review: number
  active_repairs: number
  ready_for_testing: number
  completed_this_week: number
  saved_cases: number
  needs_attention: number
  recent_cases: RepairCase[]
  pending_actions: Array<{
    case_id: string
    title: string
    detail: string
    status: CaseStatus
    priority: Priority
    updated_at: string
  }>
}

export interface Health {
  status: string
  app_name: string
  model_name: string
  model_configured: boolean
  inference_mode: 'gemini_api' | 'rule_based_fallback'
  note: string
}
