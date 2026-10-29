import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Cpu, FileCheck2, Filter, HardDrive, History, House, Info, Layers3, Lightbulb, LoaderCircle,
  LockKeyhole, Menu, Plus, Search, ShieldCheck, Smartphone, Sparkles, Stethoscope, Wrench, X,
  Zap, ClipboardCheck, PackageSearch, BrainCircuit, CircleDot, ExternalLink, RefreshCw,
} from 'lucide-react'
import { api } from './lib/api'
import type { CaseDetail, CaseStatus, DashboardSummary, Health, KnowledgeSource, NextCheck, Priority, Recommendation, RepairCase, TestStatus } from './lib/types'

const navItems = [
  { id: 'overview', label: 'Overview', icon: House, group: 'WORKSPACE' },
  { id: 'cases', label: 'Repair queue', icon: Layers3, group: 'WORKSPACE' },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope, group: 'WORKSPACE' },
  { id: 'memory', label: 'Repair memory', icon: History, group: 'INTELLIGENCE' },
  { id: 'knowledge', label: 'Knowledge base', icon: BookOpen, group: 'INTELLIGENCE' },
] as const

type NavId = typeof navItems[number]['id']
type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null

const statusNames: Record<CaseStatus, string> = {
  new: 'New', diagnosing: 'Diagnosing', waiting_parts: 'Waiting for parts', in_repair: 'In repair', testing: 'Testing', completed: 'Completed', on_hold: 'On hold',
}
const priorityNames: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }
const testOptions: Array<{ value: TestStatus; label: string }> = [
  { value: 'pass', label: 'Pass / changed as expected' },
  { value: 'fail', label: 'Fail / issue persists' },
  { value: 'inconclusive', label: 'Inconclusive' },
  { value: 'not_tested', label: 'Not tested yet' },
  { value: 'not_applicable', label: 'Not applicable' },
]
const testSuggestions = [
  'Known-good compatible cable',
  'Known-good compatible power adapter',
  'External visual inspection (device powered off)',
  'Known-good power outlet',
  'Charging behavior after restart',
  'Battery / temperature safety screening',
]

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function dateLabel(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
function currentDateHeading() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()
}
function dateTimeLabel(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'FX'
}
function deviceInitials(category: string) {
  if (category.toLowerCase().includes('laptop')) return 'LT'
  if (category.toLowerCase().includes('desktop')) return 'PC'
  return 'PH'
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.replaceAll('_', '-')
  return <span className={`status-pill status-${normalized}`}><span className="status-dot" />{statusNames[status as CaseStatus] || titleCase(status)}</span>
}
function PriorityPill({ priority }: { priority: string }) {
  return <span className={`priority-pill priority-${priority}`}>{priority === 'urgent' && <AlertCircle size={12} />}{priorityNames[priority as Priority] || titleCase(priority)}</span>
}
function OriginBadge({ origin }: { origin: string }) {
  return origin === 'demo' ? <span className="origin-badge"><CircleDot size={11} /> Sample</span> : null
}
function EmptyState({ icon: Icon, title, description }: { icon: typeof CircleHelp; title: string; description: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><h3>{title}</h3><p>{description}</p></div>
}

function NewRepairModal({ onClose, onCreate, busy }: { onClose: () => void; onCreate: (data: Record<string, string>) => Promise<void>; busy: boolean }) {
  const [form, setForm] = useState({ device_category: 'Smartphone', brand: '', model: '', issue_title: '', symptoms: '', priority: 'normal', assigned_to: '', customer_reference: '', estimated_minutes: '30' })
  const [localError, setLocalError] = useState('')
  const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')
    if (form.symptoms.trim().length < 5) {
      setLocalError('Add a little more detail about the reported symptoms.')
      return
    }
    await onCreate(form)
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-repair-title">
      <div className="modal-head"><div><span className="eyebrow">WORK ORDER</span><h2 id="new-repair-title">Register a repair</h2><p>Capture what the customer reported. Diagnosis comes next.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid two-cols">
          <label>Device category<select value={form.device_category} onChange={(e) => setField('device_category', e.target.value)}><option>Smartphone</option><option>Laptop</option><option>Desktop</option><option>Tablet</option><option>Other electronics</option></select></label>
          <label>Priority<select value={form.priority} onChange={(e) => setField('priority', e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
          <label>Brand<input required maxLength={80} value={form.brand} onChange={(e) => setField('brand', e.target.value)} placeholder="e.g. Samsung" /></label>
          <label>Model<input required maxLength={100} value={form.model} onChange={(e) => setField('model', e.target.value)} placeholder="e.g. Galaxy A54" /></label>
          <label className="span-two">Reported issue<input required minLength={4} maxLength={160} value={form.issue_title} onChange={(e) => setField('issue_title', e.target.value)} placeholder="e.g. Charging disconnects intermittently" /></label>
          <label className="span-two">Reported symptoms<textarea required minLength={5} rows={3} value={form.symptoms} onChange={(e) => setField('symptoms', e.target.value)} placeholder="What did the customer observe? What has not been checked yet?" /></label>
          <label>Assigned technician<input value={form.assigned_to} onChange={(e) => setField('assigned_to', e.target.value)} placeholder="Unassigned" /></label>
          <label>Customer reference <span className="label-muted">(optional)</span><input value={form.customer_reference} onChange={(e) => setField('customer_reference', e.target.value)} placeholder="Job card / reference only" /></label>
        </div>
        {localError && <div className="inline-error"><AlertCircle size={15} />{localError}</div>}
        <div className="privacy-note"><ShieldCheck size={15} /><span>Use a job reference instead of sensitive customer details. Fixora stores only the information entered here.</span></div>
        <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Create repair case</button></div>
      </form>
    </div>
  </div>
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavId>('overview')
  const [cases, setCases] = useState<RepairCase[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeSource[]>([])
  const [knowledgeNotice, setKnowledgeNotice] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedDetail, setSelectedDetail] = useState<CaseDetail | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [query, setQuery] = useState('')
  const [caseStatusFilter, setCaseStatusFilter] = useState('all')
  const [casePriorityFilter, setCasePriorityFilter] = useState('all')
  const [memoryQuery, setMemoryQuery] = useState('')
  const [showNewRepair, setShowNewRepair] = useState(false)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [recordingTest, setRecordingTest] = useState(false)
  const [recordingOutcome, setRecordingOutcome] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [testForm, setTestForm] = useState({ test_name: testSuggestions[0], result: 'inconclusive' as TestStatus, observed_result: '', details: '' })
  const [outcomeForm, setOutcomeForm] = useState({ confirmed_fault: '', repair_action: '', outcome: '', status: 'completed' as 'testing' | 'completed' | 'in_repair' })

  async function loadAll() {
    const [healthResult, casesResult, dashboardResult, knowledgeResult] = await Promise.allSettled([api.health(), api.cases(), api.dashboard(), api.knowledge()])
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value)
    if (casesResult.status === 'fulfilled') {
      setCases(casesResult.value)
      setSelectedId((current) => current && casesResult.value.some((item) => item.id === current) ? current : (casesResult.value.find((item) => item.id === 'FX-1048')?.id || casesResult.value[0]?.id || ''))
    }
    if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value)
    if (knowledgeResult.status === 'fulfilled') {
      setKnowledge(knowledgeResult.value.sources)
      setKnowledgeNotice(knowledgeResult.value.notice)
    }
    const failures = [healthResult, casesResult, dashboardResult, knowledgeResult].filter((result) => result.status === 'rejected')
    if (failures.length && casesResult.status === 'rejected') setNotice({ kind: 'error', text: errorMessage((casesResult as PromiseRejectedResult).reason) })
  }

  async function refreshLists() {
    const [casesResult, dashboardResult, healthResult] = await Promise.all([api.cases(), api.dashboard(), api.health()])
    setCases(casesResult)
    setDashboard(dashboardResult)
    setHealth(healthResult)
  }

  async function loadDetail(id: string) {
    if (!id) { setSelectedDetail(null); setRecommendation(null); return }
    try {
      const detail = await api.caseDetail(id)
      setSelectedDetail(detail)
      setRecommendation(detail.latest_recommendation)
      setOutcomeForm({
        confirmed_fault: detail.confirmed_fault || '',
        repair_action: detail.repair_action || '',
        outcome: detail.outcome || '',
        status: detail.status === 'testing' || detail.status === 'in_repair' ? detail.status : 'completed',
      })
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) })
    }
  }

  useEffect(() => { void loadAll() }, [])
  useEffect(() => { void loadDetail(selectedId) }, [selectedId])

  function flash(kind: 'success' | 'error' | 'info', text: string) {
    setNotice({ kind, text })
  }

  async function createRepair(form: Record<string, string>) {
    setBusy(true)
    try {
      const created = await api.createCase({
        device_category: form.device_category,
        brand: form.brand,
        model: form.model,
        issue_title: form.issue_title,
        symptoms: form.symptoms,
        priority: form.priority,
        assigned_to: form.assigned_to || 'Unassigned',
        customer_reference: form.customer_reference || undefined,
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      })
      setShowNewRepair(false)
      setSelectedId(created.id)
      setActiveNav('diagnostics')
      await refreshLists()
      flash('success', `${created.id} created. Next, record the diagnostic evidence.`)
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function addTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDetail) return
    setRecordingTest(true)
    try {
      await api.addTest(selectedDetail.id, testForm)
      setTestForm((current) => ({ ...current, observed_result: '', details: '' }))
      setRecommendation(null)
      await refreshLists()
      await loadDetail(selectedDetail.id)
      flash('success', 'Test result saved to the repair record.')
    } catch (error) {
      flash('error', errorMessage(error))
    } finally { setRecordingTest(false) }
  }

  async function generateRecommendation() {
    if (!selectedDetail) return
    setGenerating(true)
    try {
      const result = await api.recommendation(selectedDetail.id)
      setRecommendation(result)
      await refreshLists()
      await loadDetail(selectedDetail.id)
      // loadDetail retrieves the same persisted recommendation; retain the similar-case matches from this response.
      setRecommendation((current) => current ? { ...current, similar_cases: result.similar_cases } : result)
      flash('success', result.provider === 'gemini_api' ? 'Gemma recommendation generated and saved.' : 'Guidance generated using the clearly labelled local fallback.')
    } catch (error) {
      flash('error', errorMessage(error))
    } finally { setGenerating(false) }
  }

  async function saveOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDetail) return
    setRecordingOutcome(true)
    try {
      await api.outcome(selectedDetail.id, outcomeForm)
      await refreshLists()
      await loadDetail(selectedDetail.id)
      flash('success', 'Technician-confirmed outcome saved to repair memory.')
    } catch (error) {
      flash('error', errorMessage(error))
    } finally { setRecordingOutcome(false) }
  }

  async function updateStatus(caseId: string, status: CaseStatus) {
    try {
      await api.updateCase(caseId, { status })
      await refreshLists()
      if (selectedId === caseId) await loadDetail(caseId)
      flash('success', `Case ${caseId} moved to ${statusNames[status]}.`)
    } catch (error) { flash('error', errorMessage(error)) }
  }

  const visibleCases = useMemo(() => cases.filter((item) => {
    const matchesQuery = !query || `${item.id} ${item.brand} ${item.model} ${item.issue_title} ${item.symptoms} ${item.confirmed_fault || ''}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = caseStatusFilter === 'all' || item.status === caseStatusFilter
    const matchesPriority = casePriorityFilter === 'all' || item.priority === casePriorityFilter
    return matchesQuery && matchesStatus && matchesPriority
  }), [cases, query, caseStatusFilter, casePriorityFilter])

  const memoryCases = useMemo(() => cases.filter((item) => {
    const queryText = memoryQuery.toLowerCase().trim()
    return item.status === 'completed' && item.confirmed_fault && (!queryText || `${item.id} ${item.brand} ${item.model} ${item.issue_title} ${item.confirmed_fault} ${item.repair_action || ''} ${item.outcome || ''}`.toLowerCase().includes(queryText))
  }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()), [cases, memoryQuery])

  const selected = selectedDetail
  const staleRecommendation = Boolean(recommendation && selected?.tests.length && recommendation.generated_at && new Date(selected.tests[selected.tests.length - 1].performed_at) > new Date(recommendation.generated_at))
  const currentTitle = navItems.find((item) => item.id === activeNav)?.label || 'Overview'
  const aiActive = Boolean(health?.model_configured)

  function openCase(id: string, tab: NavId = 'diagnostics') {
    setSelectedId(id)
    setActiveNav(tab)
    setMobileMenuOpen(false)
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Zap size={20} fill="currentColor" strokeWidth={2.4} /></div><div className="brand-copy"><span>fixora<span className="brand-ai">.ai</span></span><small>REPAIR INTELLIGENCE</small></div><button className="mobile-close icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={17} /></button></div>
      <div className="workspace-switcher"><div className="workspace-avatar"><Wrench size={16} /></div><div className="workspace-meta"><strong>Workshop One</strong><span>Repair workspace</span></div><ChevronDown size={15} className="muted-icon" /></div>
      {['WORKSPACE', 'INTELLIGENCE'].map((group) => <div className="nav-group" key={group}><p className="nav-group-label">{group}</p>{navItems.filter((item) => item.group === group).map((item) => {
        const Icon = item.icon
        return <button key={item.id} className={`nav-link ${activeNav === item.id ? 'active' : ''}`} onClick={() => { setActiveNav(item.id); setMobileMenuOpen(false) }}><Icon size={18} strokeWidth={activeNav === item.id ? 2.2 : 1.8} /><span>{item.label}</span>{item.id === 'cases' && dashboard?.needs_attention ? <span className="nav-count">{dashboard.needs_attention}</span> : null}</button>
      })}</div>)}
      <div className="sidebar-bottom">
        <div className="sidebar-ai-card"><div className="ai-orb"><Sparkles size={16} /></div><div><strong>Repair intelligence</strong><span>{aiActive ? 'Gemma API key configured' : 'Demo guidance active'}</span></div><span className={`connection-dot ${aiActive ? 'online' : ''}`} /></div>
        <div className="profile-row"><div className="profile-avatar">FX</div><div className="profile-meta"><strong>Workshop team</strong><span>Local workspace</span></div><button className="small-icon-button" onClick={() => setActiveNav('knowledge')} aria-label="Knowledge and settings"><CircleHelp size={16} /></button></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{currentTitle}</strong></div></div><div className="topbar-actions"><div className={`model-chip ${aiActive ? 'model-chip-online' : ''}`}><span className={`connection-dot ${aiActive ? 'online' : ''}`} />{aiActive ? 'Gemma configured' : 'Fallback mode'}</div><button className="topbar-icon" title="Refresh app data" onClick={() => { void refreshLists().then(() => flash('success', 'Workspace refreshed.')).catch((error) => flash('error', errorMessage(error))) }}><RefreshCw size={16} /></button><div className="topbar-avatar">WT</div></div></header>
      {notice && <div className={`notice-bar notice-${notice.kind}`} role="status"><span className="notice-mark">{notice.kind === 'success' ? <CheckCircle2 size={16} /> : notice.kind === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}</span><span>{notice.text}</span><button className="notice-close" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
      {health && !health.model_configured && <div className="fallback-banner"><Info size={15} /><span><strong>Demo guidance active.</strong> Add <code>GEMINI_API_KEY</code> to the backend <code>.env</code> file to enable {health.model_name}. Until then, recommendations come from explicit local rules—not an LLM.</span></div>}
      <div className="page-content">
        {activeNav === 'overview' && <OverviewPage dashboard={dashboard} cases={cases} health={health} onNew={() => setShowNewRepair(true)} onOpen={openCase} onNavigate={setActiveNav} />}
        {activeNav === 'cases' && <CasesPage cases={visibleCases} query={query} setQuery={setQuery} statusFilter={caseStatusFilter} setStatusFilter={setCaseStatusFilter} priorityFilter={casePriorityFilter} setPriorityFilter={setCasePriorityFilter} onNew={() => setShowNewRepair(true)} onOpen={openCase} onStatus={updateStatus} />}
        {activeNav === 'diagnostics' && <DiagnosticsPage selected={selected} cases={cases} recommendation={recommendation} health={health} stale={staleRecommendation} generating={generating} recordingTest={recordingTest} recordingOutcome={recordingOutcome} testForm={testForm} setTestForm={setTestForm} outcomeForm={outcomeForm} setOutcomeForm={setOutcomeForm} onSelect={(id) => setSelectedId(id)} onAddTest={addTest} onGenerate={generateRecommendation} onSaveOutcome={saveOutcome} onNew={() => setShowNewRepair(true)} onOpenCase={openCase} />}
        {activeNav === 'memory' && <MemoryPage cases={memoryCases} query={memoryQuery} setQuery={setMemoryQuery} onOpen={openCase} />}
        {activeNav === 'knowledge' && <KnowledgePage sources={knowledge} notice={knowledgeNotice} />}
      </div>
      <footer className="app-footer"><span><span className="footer-mark"><Zap size={10} fill="currentColor" /></span> Fixora AI <span className="footer-divider">/</span> Evidence-led repair workflow</span><span><LockKeyhole size={12} /> Local prototype · {health?.model_configured ? health.model_name : 'Gemma API not configured'}</span></footer>
    </main>
    {showNewRepair && <NewRepairModal onClose={() => setShowNewRepair(false)} onCreate={createRepair} busy={busy} />}
  </div>
}

function OverviewPage({ dashboard, cases, health, onNew, onOpen, onNavigate }: {
  dashboard: DashboardSummary | null; cases: RepairCase[]; health: Health | null; onNew: () => void; onOpen: (id: string, tab?: NavId) => void; onNavigate: (tab: NavId) => void
}) {
  const recentCases = dashboard?.recent_cases || cases.slice(0, 6)
  const urgent = cases.filter((item) => item.priority === 'urgent' && item.status !== 'completed')
  return <>
    <div className="page-heading heading-overview"><div><div className="eyebrow-row"><span className="eyebrow">{currentDateHeading()}</span><span className="eyebrow-divider" /><span className="eyebrow-muted">WORKSHOP PULSE</span></div><h1>Good morning, team <span className="heading-sparkle">✳</span></h1><p className="page-subtitle">A clearer view of every repair, from the first symptom to the final check.</p></div><button className="button button-primary" onClick={onNew}><Plus size={17} /> New repair <span className="shortcut">N</span></button></div>
    <section className="hero-panel"><div className="hero-copy"><div className="hero-pill"><Sparkles size={13} /> REPAIR INTELLIGENCE, NOT GUESSWORK</div><h2>Make every diagnostic<br /><span>step count.</span></h2><p>Connect real test results to the next useful check, then save what worked for the next repair.</p><button className="button button-light" onClick={() => onNavigate('diagnostics')}>Open diagnostics <ArrowRight size={16} /></button><div className="hero-trust"><ShieldCheck size={14} /><span>Technician-confirmed outcomes. AI-assisted decisions.</span></div></div><div className="hero-graphic" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="graphic-center"><div className="graphic-icon"><Cpu size={33} /></div><span>FIXORA CORE</span></div><div className="floating-node node-a"><Activity size={16} /><span>Evidence</span></div><div className="floating-node node-b"><BrainCircuit size={17} /><span>Reasoning</span></div><div className="floating-node node-c"><CheckCircle2 size={16} /><span>Outcome</span></div><div className="graphic-line line-a" /><div className="graphic-line line-b" /></div></section>
    <div className="stats-grid">
      <StatCard icon={Wrench} label="Active repairs" value={dashboard?.active_repairs ?? '—'} detail="Across current queue" tone="blue" trend={null} onClick={() => onNavigate('cases')} />
      <StatCard icon={ClipboardCheck} label="Ready for testing" value={dashboard?.ready_for_testing ?? '—'} detail="Final verification stage" tone="green" trend={null} onClick={() => onNavigate('cases')} />
      <StatCard icon={CheckCircle2} label="Completed this week" value={dashboard?.completed_this_week ?? '—'} detail="Updated in the last 7 days" tone="violet" trend={null} onClick={() => onNavigate('memory')} />
      <StatCard icon={History} label="Repair memory" value={dashboard?.saved_cases ?? '—'} detail="Cases with outcomes & history" tone="amber" trend={null} onClick={() => onNavigate('memory')} />
    </div>
    <div className="dashboard-columns"><section className="surface-card recent-card"><div className="section-card-head"><div><h3>Latest repair activity</h3><p>Keep a pulse on the workshop queue.</p></div><button className="text-action" onClick={() => onNavigate('cases')}>View all <ArrowRight size={14} /></button></div>{recentCases.length ? <div className="recent-table-wrap"><table className="data-table"><thead><tr><th>REPAIR</th><th>ISSUE</th><th>STATUS</th><th>PRIORITY</th><th>UPDATED</th><th /></tr></thead><tbody>{recentCases.slice(0, 6).map((item) => <tr key={item.id} onClick={() => onOpen(item.id)} className="clickable-row"><td><div className="repair-id-cell"><div className="device-avatar">{deviceInitials(item.device_category)}</div><div><strong>{item.id}</strong><span>{item.brand} {item.model}</span></div></div></td><td><div className="issue-cell"><strong>{item.issue_title}</strong>{item.data_origin === 'demo' && <OriginBadge origin={item.data_origin} />}</div></td><td><StatusPill status={item.status} /></td><td><PriorityPill priority={item.priority} /></td><td className="date-cell">{dateLabel(item.updated_at)}</td><td><ChevronRight size={15} className="row-chevron" /></td></tr>)}</tbody></table></div> : <EmptyState icon={Wrench} title="No repairs yet" description="Register your first repair to start building useful case history." />}<div className="table-mobile-list">{recentCases.slice(0, 6).map((item) => <button key={item.id} className="mobile-case-row" onClick={() => onOpen(item.id)}><div className="device-avatar">{deviceInitials(item.device_category)}</div><div className="mobile-case-copy"><strong>{item.id} · {item.issue_title}</strong><span>{item.brand} {item.model} · {titleCase(item.status)}</span></div><ChevronRight size={15} /></button>)}</div></section>
      <aside className="right-column"><section className="surface-card signal-card"><div className="section-card-head"><div><h3>Attention needed</h3><p>Prioritize what needs a closer look.</p></div><span className="attention-icon"><AlertTriangle size={17} /></span></div>{urgent.length ? <div className="signal-list">{urgent.slice(0, 3).map((item) => <button key={item.id} className="signal-item" onClick={() => onOpen(item.id)}><span className="signal-bar" /><span className="signal-copy"><strong>{item.issue_title}</strong><small>{item.id} · {item.brand} {item.model}</small></span><ArrowUpRight size={15} /></button>)}</div> : <div className="calm-state"><CheckCircle2 size={17} /><span>No urgent repairs in the queue.</span></div>}<button className="subtle-link" onClick={() => onNavigate('cases')}>Review repair queue <ArrowRight size={14} /></button></section><section className="surface-card ai-status-card"><div className="ai-status-top"><div className="ai-mini-mark"><Sparkles size={16} /></div><span className={`mini-status ${health?.model_configured ? 'mini-status-live' : 'mini-status-demo'}`}><span className="connection-dot" />{health?.model_configured ? 'KEY CONFIGURED' : 'DEMO MODE'}</span></div><h3>Gemma diagnostic support</h3><p>{health?.model_configured ? `Recommendations are routed to ${health.model_name}.` : 'Add a Gemini API key to enable model-powered analysis. Local safety-first rules remain available.'}</p><div className="ai-status-divider" /><div className="ai-status-foot"><span><LockKeyhole size={13} /> API key stays server-side</span><button className="text-action" onClick={() => onNavigate('knowledge')}>Details <ArrowRight size={13} /></button></div></section></aside></div>
    <div className="bottom-tip"><div className="tip-icon"><Lightbulb size={17} /></div><div><strong>Good records make better recommendations.</strong><span>Record what was actually tested, keep unknowns explicit, and confirm the final fault before closing a case.</span></div><button onClick={() => onNavigate('diagnostics')}>Try diagnostics <ArrowRight size={14} /></button></div>
  </>
}

function StatCard({ icon: Icon, label, value, detail, tone, trend, onClick }: { icon: typeof Activity; label: string; value: string | number; detail: string; tone: string; trend: string | null; onClick: () => void }) {
  return <button className="stat-card" onClick={onClick}><div className="stat-card-top"><div className={`stat-icon stat-icon-${tone}`}><Icon size={18} /></div>{trend && <span className="stat-trend"><ArrowUpRight size={13} />{trend}</span>}</div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div className="stat-detail">{detail}<ArrowDownRight size={13} /></div></button>
}

function CasesPage({ cases, query, setQuery, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, onNew, onOpen, onStatus }: {
  cases: RepairCase[]; query: string; setQuery: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; priorityFilter: string; setPriorityFilter: (value: string) => void; onNew: () => void; onOpen: (id: string, tab?: NavId) => void; onStatus: (id: string, status: CaseStatus) => void
}) {
  return <><div className="page-heading"><div><span className="eyebrow">WORKSPACE / OPERATIONS</span><h1>Repair queue</h1><p className="page-subtitle">Every open job, with a clear next step and a traceable record.</p></div><button className="button button-primary" onClick={onNew}><Plus size={16} /> New repair</button></div><div className="queue-summary"><div className="queue-summary-cell"><span className="queue-summary-icon"><Layers3 size={15} /></span><div><strong>{cases.length}</strong><span>Matching cases</span></div></div><div className="queue-summary-cell"><span className="queue-summary-icon queue-summary-green"><CheckCircle2 size={15} /></span><div><strong>{cases.filter((item) => item.status === 'testing').length}</strong><span>In testing</span></div></div><div className="queue-summary-cell"><span className="queue-summary-icon queue-summary-red"><AlertTriangle size={15} /></span><div><strong>{cases.filter((item) => ['high', 'urgent'].includes(item.priority) && item.status !== 'completed').length}</strong><span>High priority</span></div></div></div><div className="surface-card queue-card"><div className="queue-toolbar"><div className="search-box"><Search size={16} /><input aria-label="Search repair queue" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, device, issue, fault..." />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</div><div className="filter-controls"><label className="filter-select"><Filter size={14} /><select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="new">New</option><option value="diagnosing">Diagnosing</option><option value="waiting_parts">Waiting for parts</option><option value="in_repair">In repair</option><option value="testing">Testing</option><option value="completed">Completed</option><option value="on_hold">On hold</option></select><ChevronDown size={14} /></label><label className="filter-select"><select aria-label="Filter by priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><ChevronDown size={14} /></label></div></div>{cases.length ? <div className="queue-table-wrap"><table className="data-table queue-table"><thead><tr><th>REPAIR ID / DEVICE</th><th>ISSUE</th><th>STATUS</th><th>PRIORITY</th><th>TECHNICIAN</th><th>LAST UPDATE</th><th /></tr></thead><tbody>{cases.map((item) => <tr key={item.id} className="clickable-row" onClick={() => onOpen(item.id)}><td><div className="repair-id-cell"><div className="device-avatar">{deviceInitials(item.device_category)}</div><div><strong>{item.id} <OriginBadge origin={item.data_origin} /></strong><span>{item.brand} {item.model}</span></div></div></td><td><div className="issue-cell"><strong>{item.issue_title}</strong><span className="issue-snippet">{item.symptoms}</span></div></td><td><div className="status-cell"><StatusPill status={item.status} /><select className="status-edit-select" aria-label={`Change status for ${item.id}`} value={item.status} onClick={(e) => e.stopPropagation()} onChange={(e) => onStatus(item.id, e.target.value as CaseStatus)}><option value="new">New</option><option value="diagnosing">Diagnosing</option><option value="waiting_parts">Waiting for parts</option><option value="in_repair">In repair</option><option value="testing">Testing</option><option value="completed">Completed</option><option value="on_hold">On hold</option></select></div></td><td><PriorityPill priority={item.priority} /></td><td><div className="tech-cell"><span className="tech-avatar">{initials(item.assigned_to)}</span>{item.assigned_to}</div></td><td className="date-cell">{dateTimeLabel(item.updated_at)}</td><td><button className="row-open-button" aria-label={`Open ${item.id}`} onClick={(e) => { e.stopPropagation(); onOpen(item.id) }}><ChevronRight size={16} /></button></td></tr>)}</tbody></table></div> : <EmptyState icon={PackageSearch} title="No matching repairs" description="Try a different search or clear the selected filters." />}<div className="queue-footer"><span>Showing {cases.length} repair {cases.length === 1 ? 'record' : 'records'}</span><span><span className="sample-key" /> Sample records are fictional demonstrations</span></div></div><div className="queue-note"><Info size={15} /><span>Repair statuses describe workflow progress. A generated hypothesis is not a confirmed fault; only close cases after documenting the technician's actual findings.</span></div></>
}

function DiagnosticsPage({ selected, cases, recommendation, health, stale, generating, recordingTest, recordingOutcome, testForm, setTestForm, outcomeForm, setOutcomeForm, onSelect, onAddTest, onGenerate, onSaveOutcome, onNew, onOpenCase }: {
  selected: CaseDetail | null; cases: RepairCase[]; recommendation: Recommendation | null; health: Health | null; stale: boolean; generating: boolean; recordingTest: boolean; recordingOutcome: boolean;
  testForm: { test_name: string; result: TestStatus; observed_result: string; details: string };
  setTestForm: Dispatch<SetStateAction<{ test_name: string; result: TestStatus; observed_result: string; details: string }>>;
  outcomeForm: { confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' };
  setOutcomeForm: Dispatch<SetStateAction<{ confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' }>>;
  onSelect: (id: string) => void; onAddTest: (event: FormEvent<HTMLFormElement>) => void; onGenerate: () => void; onSaveOutcome: (event: FormEvent<HTMLFormElement>) => void; onNew: () => void; onOpenCase: (id: string, tab?: NavId) => void
}) {
  return <><div className="page-heading"><div><span className="eyebrow">INTELLIGENCE / DIAGNOSTIC WORKSPACE</span><h1>Diagnostics</h1><p className="page-subtitle">Build recommendations from observations—not assumptions.</p></div><button className="button button-primary" onClick={onNew}><Plus size={16} /> New repair</button></div>
    <div className="diagnostic-select-bar"><div className="select-case-mark"><Stethoscope size={17} /></div><div className="select-case-copy"><strong>Working repair</strong><span>Choose the case to inspect and record evidence.</span></div><label className="case-picker"><span className="sr-only">Select repair case</span><select value={selected?.id || ''} onChange={(e) => onSelect(e.target.value)}><option value="" disabled>Select a repair case</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.brand} {item.model} — {item.issue_title}</option>)}</select><ChevronDown size={15} /></label>{selected && <StatusPill status={selected.status} />}</div>
    {!selected ? <div className="surface-card"><EmptyState icon={Stethoscope} title="Choose a repair to begin" description="Select an existing case or register a new repair to start recording diagnostic evidence." /><div className="empty-actions"><button className="button button-primary" onClick={onNew}><Plus size={16} /> Register repair</button></div></div> : <div className="diagnostics-layout"><div className="diagnostic-main-column"><section className="surface-card case-overview-card"><div className="case-overview-top"><div className="case-device-icon"><Smartphone size={22} /></div><div className="case-overview-id"><div className="eyebrow-row"><span className="eyebrow">{selected.id}</span><OriginBadge origin={selected.data_origin} /><PriorityPill priority={selected.priority} /></div><h2>{selected.issue_title}</h2><p>{selected.brand} {selected.model} <span className="bullet-separator">·</span> {selected.device_category}</p></div><div className="case-overview-status"><span className="meta-label">WORKFLOW STATUS</span><StatusPill status={selected.status} /></div></div><div className="case-symptoms"><span className="meta-label">REPORTED SYMPTOMS</span><p>{selected.symptoms}</p></div><div className="case-overview-foot"><span><Clock3 size={14} /> Opened {dateLabel(selected.created_at)}</span><span><Wrench size={14} /> {selected.assigned_to || 'Unassigned'}</span><span><Activity size={14} /> {selected.tests.length} test {selected.tests.length === 1 ? 'result' : 'results'} recorded</span></div></section>
      <section className="surface-card evidence-card"><div className="section-card-head"><div><div className="card-title-inline"><span className="step-number">01</span><h3>Diagnostic evidence</h3></div><p>Record only what was actually checked.</p></div><span className="section-count">{selected.tests.length.toString().padStart(2, '0')} RESULTS</span></div>{selected.tests.length ? <div className="evidence-list">{selected.tests.map((test) => <div className="evidence-item" key={test.id}><div className={`evidence-result-icon result-${test.result}`}>{test.result === 'pass' ? <Check size={15} /> : test.result === 'fail' ? <X size={15} /> : test.result === 'not_tested' ? <Clock3 size={15} /> : <CircleDot size={15} />}</div><div className="evidence-copy"><div className="evidence-heading"><strong>{test.test_name}</strong><span className={`result-tag result-tag-${test.result}`}>{test.result.replaceAll('_', ' ')}</span></div><p>{test.observed_result}</p>{test.details && <small>{test.details}</small>}<span className="evidence-time">Recorded {dateTimeLabel(test.performed_at)}</span></div></div>)}</div> : <div className="inline-empty"><CircleHelp size={17} /><span>No test results yet. Add the first observation below.</span></div>}
        {selected.status === 'completed' || selected.status === 'on_hold' ? <div className="read-only-note"><LockKeyhole size={14} /> This case is {selected.status === 'completed' ? 'completed' : 'on hold'}. Reopen the case from the Repair queue before adding tests.</div> : <form className="add-test-form" onSubmit={onAddTest}><div className="form-section-label">ADD A TEST RESULT</div><div className="form-grid two-cols"><label className="span-two">Test performed<select value={testForm.test_name} onChange={(e) => setTestForm((v) => ({ ...v, test_name: e.target.value }))}>{testSuggestions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Result<select value={testForm.result} onChange={(e) => setTestForm((v) => ({ ...v, result: e.target.value as TestStatus }))}>{testOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Observation<textarea required rows={2} value={testForm.observed_result} onChange={(e) => setTestForm((v) => ({ ...v, observed_result: e.target.value }))} placeholder="What did you observe? Write 'not tested' if it was not performed." /></label><label className="span-two">Additional notes <span className="label-muted">(optional)</span><input value={testForm.details} onChange={(e) => setTestForm((v) => ({ ...v, details: e.target.value }))} placeholder="Conditions, tools used, or context" /></label></div><div className="form-footer"><span><Info size={13} /> Unknown is not the same as failed.</span><button className="button button-dark" type="submit" disabled={recordingTest}>{recordingTest ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} Save observation</button></div></form>}</section>
      <section className="surface-card outcome-card"><div className="section-card-head"><div><div className="card-title-inline"><span className="step-number step-number-dark">03</span><h3>Confirm repair outcome</h3></div><p>Only a technician can confirm the fault.</p></div><span className="section-count">TECHNICIAN INPUT</span></div><form onSubmit={onSaveOutcome} className="outcome-form"><label>Confirmed fault<input required minLength={3} value={outcomeForm.confirmed_fault} onChange={(e) => setOutcomeForm((v) => ({ ...v, confirmed_fault: e.target.value }))} placeholder="Enter the fault confirmed during diagnosis" /></label><label>Repair action taken<textarea required minLength={3} rows={2} value={outcomeForm.repair_action} onChange={(e) => setOutcomeForm((v) => ({ ...v, repair_action: e.target.value }))} placeholder="What was repaired, replaced, or adjusted?" /></label><label>Verification and outcome<textarea required minLength={3} rows={2} value={outcomeForm.outcome} onChange={(e) => setOutcomeForm((v) => ({ ...v, outcome: e.target.value }))} placeholder="What verification was performed and what happened?" /></label><div className="outcome-actions"><label className="outcome-status-label">Set status<select value={outcomeForm.status} onChange={(e) => setOutcomeForm((v) => ({ ...v, status: e.target.value as 'testing' | 'completed' | 'in_repair' }))}><option value="testing">Testing</option><option value="in_repair">In repair</option><option value="completed">Completed</option></select></label><button className="button button-primary" type="submit" disabled={recordingOutcome}>{recordingOutcome ? <LoaderCircle size={15} className="spin" /> : <CheckCircle2 size={15} />} Save outcome</button></div><p className="form-microcopy"><ShieldCheck size={13} /> Saving an outcome creates a searchable repair precedent. Sample cases remain marked as fictional.</p></form></section></div>
    <aside className="diagnostic-side-column"><section className="ai-panel"><div className="ai-panel-header"><div className="ai-panel-icon"><Sparkles size={18} /></div><div><span className="eyebrow">FIXORA INTELLIGENCE</span><h3>Diagnostic copilot</h3></div><span className={`ai-panel-live ${health?.model_configured ? 'ai-panel-live-on' : ''}`}><span className="connection-dot" />{health?.model_configured ? 'KEY SET' : 'RULES'}</span></div><p className="ai-panel-description">Turn entered evidence into the next useful check, with uncertainty made explicit.</p><div className="ai-model-row"><div className="model-symbol"><BrainCircuit size={16} /></div><div><strong>{health?.model_configured ? health.model_name : 'Local rule-based guidance'}</strong><span>{health?.model_configured ? 'Gemma 4 via Gemini API' : 'No API key configured'}</span></div><span className="model-lock"><LockKeyhole size={13} /></span></div><button className="button button-ai" onClick={onGenerate} disabled={generating || selected.status === 'completed'}>{generating ? <><LoaderCircle size={16} className="spin" /> Reasoning over evidence…</> : <><Sparkles size={16} /> {recommendation ? 'Regenerate recommendation' : 'Generate recommendation'} <ArrowRight size={15} /></>}</button>{selected.status === 'completed' && <p className="ai-disabled-note">Reopen this completed case before generating another recommendation.</p>}<div className="ai-panel-foot"><span><ShieldCheck size={13} /> No diagnosis is auto-confirmed</span><span>Step 02 / 03</span></div></section>
      {recommendation ? <RecommendationView recommendation={recommendation} stale={stale} /> : <section className="surface-card waiting-panel"><div className="waiting-illustration"><div className="waiting-circle circle-outer" /><div className="waiting-circle circle-mid" /><div className="waiting-core"><BrainCircuit size={22} /></div><span className="waiting-dot waiting-dot-1" /><span className="waiting-dot waiting-dot-2" /></div><h3>Your recommendation will appear here</h3><p>Record one or more observations, then generate guidance to review possible explanations, missing evidence, and the next check.</p><div className="waiting-mini-steps"><div><span>1</span> Record evidence</div><div><span>2</span> Review guidance</div><div><span>3</span> Confirm outcome</div></div></section>}
      {recommendation?.similar_cases && recommendation.similar_cases.length > 0 && <section className="surface-card side-memory-card"><div className="section-card-head"><div><h3>Related repair memory</h3><p>Keyword matches, not diagnostic proof.</p></div><History size={17} className="muted-icon" /></div>{recommendation.similar_cases.slice(0, 2).map((item) => <button className="memory-match" key={item.id} onClick={() => onOpenCase(item.id, 'memory')}><span className="memory-match-icon"><History size={15} /></span><span><strong>{item.id} · {item.device}</strong><small>{item.issue_title}</small><em>Confirmed: {item.confirmed_fault}</em></span><ChevronRight size={15} /></button>)}</section>}
      <section className="safety-card"><div className="safety-card-icon"><ShieldCheck size={17} /></div><div><strong>Safety before speed</strong><p>If there is swelling, smoke, unusual heat, odor, liquid ingress, or exposed wiring, stop routine tests and escalate to a qualified technician.</p><span>FIXORA SAFETY BASELINE · FX-SAFE-001</span></div></section>
    </aside></div>}
  </>
}

function RecommendationView({ recommendation, stale }: { recommendation: Recommendation; stale: boolean }) {
  const [expandedHypothesis, setExpandedHypothesis] = useState(0)
  const content = recommendation.content
  const isLive = recommendation.provider === 'gemini_api'
  return <section className={`surface-card recommendation-card ${stale ? 'recommendation-stale' : ''}`}><div className="recommendation-head"><div className="recommendation-head-icon"><Sparkles size={16} /></div><div><span className="eyebrow">RECOMMENDATION</span><h3>Evidence review</h3></div><span className={`source-mode ${isLive ? 'source-mode-live' : 'source-mode-fallback'}`}>{isLive ? 'GEMMA 4' : 'LOCAL RULES'}</span></div>{stale && <div className="stale-banner"><AlertCircle size={14} /> New test evidence was added after this recommendation. Regenerate before using it.</div>}<p className="recommendation-summary">{content.summary}</p><div className="confidence-legend"><span><span className="legend-dot legend-plausible" /> Plausible</span><span><span className="legend-dot legend-possible" /> Possible</span><span className="legend-note">Labels are qualitative, not probabilities.</span></div><div className="hypothesis-section"><div className="recommendation-section-title"><span>01</span><h4>Possible explanations</h4></div>{content.hypotheses.map((hypothesis, index) => <div className={`hypothesis-item ${expandedHypothesis === index ? 'hypothesis-expanded' : ''}`} key={`${hypothesis.fault}-${index}`}><button className="hypothesis-toggle" onClick={() => setExpandedHypothesis((current) => current === index ? -1 : index)}><div className={`hypothesis-index ${hypothesis.likelihood}`}>{index + 1}</div><div className="hypothesis-title-wrap"><strong>{hypothesis.fault}</strong><span className={`likelihood-label likelihood-${hypothesis.likelihood}`}>{titleCase(hypothesis.likelihood)}</span></div><ChevronDown size={15} /></button>{expandedHypothesis === index && <div className="hypothesis-detail"><p>{hypothesis.reasoning}</p>{hypothesis.supporting_evidence.length > 0 && <div className="evidence-chips-group"><span className="evidence-group-label">SUPPORTING OBSERVATIONS</span>{hypothesis.supporting_evidence.map((evidence, i) => <div className="evidence-chip positive" key={`${evidence}-${i}`}><Check size={12} />{evidence}</div>)}</div>}{hypothesis.contradicting_evidence.length > 0 && <div className="evidence-chips-group"><span className="evidence-group-label">CONTRADICTING OBSERVATIONS</span>{hypothesis.contradicting_evidence.map((evidence, i) => <div className="evidence-chip caution" key={`${evidence}-${i}`}><AlertCircle size={12} />{evidence}</div>)}</div>}</div>}</div>)}</div><div className="next-checks-section"><div className="recommendation-section-title"><span>02</span><h4>Recommended next checks</h4></div>{content.next_checks.map((check, index) => <NextCheckCard check={check} index={index} key={`${check.name}-${index}`} />)}</div>{content.missing_information.length > 0 && <div className="missing-info-box"><div className="missing-info-heading"><CircleHelp size={15} /><strong>Evidence still missing</strong></div><ul>{content.missing_information.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}{content.safety_notes.length > 0 && <div className="recommendation-safety"><ShieldCheck size={15} /><div><strong>Safety and interpretation</strong>{content.safety_notes.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div></div>}{recommendation.sources.length > 0 && <div className="source-reference-section"><span className="evidence-group-label">REFERENCE NOTES USED</span>{recommendation.sources.map((source) => <div className="source-reference" key={source.id}><div><strong>{source.title}</strong><span>{source.id} · {source.kind}</span><p>{source.review_note}</p></div>{source.source_url && <a href={source.source_url} target="_blank" rel="noreferrer" aria-label={`Open ${source.title}`}><ExternalLink size={14} /></a>}</div>)}</div>}{content.limitations.length > 0 && <details className="limitation-details"><summary><Info size={14} /> Model and method limitations</summary><ul>{content.limitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></details>}<div className="recommendation-footer"><span><Clock3 size={12} /> Generated {dateTimeLabel(recommendation.generated_at)}</span><span>{recommendation.model_name}</span></div></section>
}

function NextCheckCard({ check, index }: { check: NextCheck; index: number }) {
  const [open, setOpen] = useState(index === 0)
  return <div className={`next-check-item ${open ? 'next-check-open' : ''}`}><button className="next-check-head" onClick={() => setOpen((value) => !value)}><span className="next-check-number">{String(index + 1).padStart(2, '0')}</span><span className="next-check-main"><strong>{check.name}</strong><small>{check.purpose}</small></span><span className={`safety-level safety-${check.safety_level}`}>{check.safety_level === 'professional_only' ? 'Pro only' : check.safety_level}</span><ChevronDown size={14} /></button>{open && <div className="next-check-body"><p>{check.instructions}</p><div className="record-this"><ClipboardCheck size={13} /><span><strong>Record:</strong> {check.what_to_record}</span></div></div>}</div>
}

function MemoryPage({ cases, query, setQuery, onOpen }: { cases: RepairCase[]; query: string; setQuery: (value: string) => void; onOpen: (id: string, tab?: NavId) => void }) {
  return <><div className="page-heading"><div><span className="eyebrow">INTELLIGENCE / LEARN FROM OUTCOMES</span><h1>Repair memory</h1><p className="page-subtitle">A searchable history of cases with technician-confirmed outcomes.</p></div><div className="memory-count-pill"><History size={15} /> {cases.length} outcome records</div></div><div className="memory-hero"><div className="memory-hero-icon"><History size={23} /></div><div><h2>Keep what worked. Verify every match.</h2><p>Historical cases can inform the next check, but a similar symptom never proves the same fault.</p></div><div className="memory-hero-stat"><strong>{cases.filter((item) => item.data_origin !== 'demo').length}</strong><span>Real records entered</span></div></div><section className="surface-card memory-table-card"><div className="section-card-head"><div><h3>Confirmed repair history</h3><p>Search by device, symptom, fault, or repair action.</p></div><span className="section-count">SEARCHABLE CASES</span></div><div className="search-box memory-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the workshop's repair memory..." />{query && <button onClick={() => setQuery('')} aria-label="Clear memory search"><X size={14} /></button>}</div>{cases.length ? <div className="memory-list">{cases.map((item) => <button className="memory-record" key={item.id} onClick={() => onOpen(item.id, 'diagnostics')}><div className="memory-record-icon"><HardDrive size={18} /></div><div className="memory-record-main"><div className="memory-record-title"><strong>{item.issue_title}</strong><OriginBadge origin={item.data_origin} /><span className="memory-record-id">{item.id}</span></div><span className="memory-device-line">{item.brand} {item.model} · {dateLabel(item.updated_at)}</span><span className="memory-fault-line"><CheckCircle2 size={13} /> Confirmed fault: {item.confirmed_fault}</span><span className="memory-action-line">{item.repair_action || 'No repair action recorded'}</span></div><div className="memory-record-outcome"><span>RECORDED OUTCOME</span><p>{item.outcome || 'Outcome not recorded'}</p></div><ChevronRight size={17} className="memory-chevron" /></button>)}</div> : <EmptyState icon={History} title="No matching repair history" description="Completed cases with a confirmed fault will appear here. Use the search bar or save an outcome in Diagnostics." />}<div className="memory-disclaimer"><Info size={14} /><span>Similarity is a retrieval aid, not a calibrated score. Always compare model, conditions, and test results; do not infer technician error from a repeated issue.</span></div></section></>
}

function KnowledgePage({ sources, notice }: { sources: KnowledgeSource[]; notice: string }) {
  return <><div className="page-heading"><div><span className="eyebrow">INTELLIGENCE / SOURCES & SAFETY</span><h1>Knowledge base</h1><p className="page-subtitle">The reviewed notes available to the recommendation engine.</p></div><div className="knowledge-pill"><BookOpen size={15} /> {sources.length} reference notes</div></div><div className="knowledge-callout"><div className="knowledge-callout-icon"><ShieldCheck size={20} /></div><div><strong>Transparent by design</strong><p>{notice || 'Recommendations only cite reference notes included in the app.'} The current starter set is generic prototype guidance, not manufacturer-specific service documentation. Add reviewed documentation before relying on it for a real device.</p></div></div><div className="knowledge-grid">{sources.map((source, index) => <article className="surface-card knowledge-card" key={source.id}><div className="knowledge-card-head"><div className={`knowledge-source-icon source-icon-${index % 4}`}>{index === 0 ? <Zap size={18} /> : index === 1 ? <ShieldCheck size={18} /> : index === 2 ? <FileCheck2 size={18} /> : <History size={18} />}</div><span className="source-id">{source.id}</span></div><span className="knowledge-kind">{source.kind}</span><h3>{source.title}</h3><p className="knowledge-scope">{source.scope}</p><div className="knowledge-content">{source.content}</div><div className="knowledge-card-foot"><Info size={13} /><span>{source.review_note}</span></div>{source.source_url && <a className="knowledge-external-link" href={source.source_url} target="_blank" rel="noreferrer">Open source <ExternalLink size={13} /></a>}</article>)}</div><div className="knowledge-bottom-note"><LockKeyhole size={15} /><span>Model outputs are schema-validated; only known source IDs are accepted. The model cannot create a new trusted source by inventing a URL.</span></div></>
}
