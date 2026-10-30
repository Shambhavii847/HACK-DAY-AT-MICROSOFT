import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight,
  BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Cpu, ExternalLink, Eye, Filter, Github, History, House, Info, Layers3, Linkedin,
  LoaderCircle, Mail, Phone, Plus, RefreshCw, RotateCcw, Search,
  Settings, ShieldCheck, Smartphone, Sparkles, Stethoscope, Trash2,
  Volume2, VolumeX, X, Zap, Printer,
  ClipboardCheck, PackageSearch, BrainCircuit,
} from 'lucide-react'
import { api } from './lib/api'
import type {
  CaseDetail, CaseStatus, ComponentRecord, ComponentTestStatus, DashboardSummary, Health, KnowledgeSource,
  ComponentCondition, ComponentInventoryRecord, InventoryComponentCandidate, NextCheck, Priority, Recommendation,
  RepairCase, ResaleStatus, ReuseStatus, SafetyAlert, SimilarRepair, TestResult, TestStatus, TimelineEvent,
} from './lib/types'

const navItems = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'cases', label: 'Repair Queue', icon: Layers3 },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { id: 'memory', label: 'Repair Memory', icon: History },
  { id: 'inventory', label: 'Parts Inventory', icon: PackageSearch },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
] as const

type NavId = typeof navItems[number]['id']
type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null

export interface AppSettings {
  animationsEnabled: boolean
  hardwareTelemetry: boolean
  highContrastHUD: boolean
  audioEffects: boolean
  modelEngine: 'gemma-4' | 'fallback-rules'
  autoTriageOnCreate: boolean
  strictSafety: boolean
  confirmDelete: boolean
  confirmComplete: boolean
  autoArchive: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  animationsEnabled: true,
  hardwareTelemetry: true,
  highContrastHUD: false,
  audioEffects: true,
  modelEngine: 'gemma-4',
  autoTriageOnCreate: true,
  strictSafety: true,
  confirmDelete: true,
  confirmComplete: true,
  autoArchive: true,
}

const SETTINGS_STORAGE_KEY = 'fixora_app_settings_v1'

function playUiSound(type: 'click' | 'toggle' | 'boot' | 'danger', settings: AppSettings) {
  if (!settings.audioEffects || !settings.animationsEnabled) return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    if (type === 'click') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(820, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.04)
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.04)
      osc.start()
      osc.stop(ctx.currentTime + 0.04)
    } else if (type === 'toggle') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(540, ctx.currentTime)
      osc.frequency.setValueAtTime(840, ctx.currentTime + 0.035)
      gain.gain.setValueAtTime(0.035, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06)
      osc.start()
      osc.stop(ctx.currentTime + 0.06)
    } else if (type === 'boot') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(340, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.18)
      gain.gain.setValueAtTime(0.045, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.22)
      osc.start()
      osc.stop(ctx.currentTime + 0.22)
    } else if (type === 'danger') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(280, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    }
  } catch {
    // Ignore audio permission or context restrictions
  }
}

const statusNames: Record<CaseStatus, string> = {
  new: 'New',
  diagnosing: 'Diagnosing',
  waiting_parts: 'Waiting for parts',
  in_repair: 'In repair',
  testing: 'Testing',
  completed: 'Completed',
  on_hold: 'On hold',
}

const priorityNames: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

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

interface TeamMember {
  name: string
  role: string
  isLead?: boolean
  email: string
  linkedin: string
  github: string
}

const teamMembers: TeamMember[] = [
  {
    name: 'Shambhavi',
    role: 'Team Leader',
    isLead: true,
    email: 'socialshambhavi847@gmail.com',
    linkedin: 'https://www.linkedin.com/in/shambhavi-sharma-16440a405?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    github: 'https://github.com/Shambhavii847',
  },
  {
    name: 'Tejaswi Gupta',
    role: 'Team Member',
    email: 'guptatejaswi651@gmail.com',
    linkedin: 'https://www.linkedin.com/in/tejaswi-gupta-4396233a6?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    github: 'https://github.com/guptatejaswi651-ship-it',
  },
  {
    name: 'Parth Singhal',
    role: 'Team Member',
    email: 'agarwal.parth2405@gmail.com',
    linkedin: 'https://www.linkedin.com/in/parth-singhal-120a00447?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    github: 'https://github.com/parthcodex-ux',
  },
  {
    name: 'Shaurya Taliyan',
    role: 'Team Member',
    email: 'taliyanshaurya@gmail.com',
    linkedin: 'https://www.linkedin.com/in/shaurya-taliyan?utm_source=share_via&utm_content=profile&utm_medium=member_android',
    github: 'https://github.com/shauryataliyan',
  },
]

const SOURCE_CODE_URL = 'https://github.com/Shambhavii847/HACK-DAY-AT-MICROSOFT'

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
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
  return (
    <span className={`status-pill status-${normalized}`}>
      <span className="status-dot" />
      {statusNames[status as CaseStatus] || titleCase(status)}
    </span>
  )
}

function PriorityPill({ priority }: { priority: string }) {
  return (
    <span className={`priority-pill priority-${priority}`}>
      {priority === 'urgent' && <AlertCircle size={12} />}
      {priorityNames[priority as Priority] || titleCase(priority)}
    </span>
  )
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof CircleHelp; title: string; description: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={22} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  confirmTone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  confirmTone?: 'primary' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!isOpen) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div className="modal-card confirm-modal-card" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onCancel} disabled={busy} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`button ${confirmTone === 'danger' ? 'button-danger' : 'button-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreditsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card credits-modal-card" role="dialog" aria-modal="true">
        <div className="modal-head credits-modal-head">
          <div>
            <span className="eyebrow">HACK DAY AT MICROSOFT</span>
              <h2>Project team</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="credits-modal-body">
          <div className="credits-team-grid">
            {teamMembers.map((member) => (
              <div key={member.name} className={`credit-member-card ${member.isLead ? 'lead-card' : ''}`}>
                <div className="member-card-header">
                  <div>
                    <span className={`member-role-tag ${member.isLead ? 'tag-lead' : ''}`}>
                      {member.role}
                    </span>
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="member-name-link"
                      title="Open LinkedIn"
                    >
                      {member.name}
                      <Linkedin size={13} className="member-li-icon" />
                    </a>
                  </div>
                </div>

                <div className="member-actions">
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="member-action-btn"
                    title="View GitHub"
                  >
                    <Github size={13} /> GitHub
                  </a>
                  <a
                    href={`mailto:${member.email}`}
                    className="member-action-btn"
                    title="Send Email"
                  >
                    <Mail size={13} /> Email
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="credits-source-box">
            <a
              href={SOURCE_CODE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="source-code-button"
            >
              <Github size={17} />
              <span>View source code on GitHub</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function StandbyModal({
  isOpen,
  onResume,
  settings,
}: {
  isOpen: boolean
  onResume: () => void
  settings: AppSettings
}) {
  if (!isOpen) return null

  const handleForceClose = () => {
    playUiSound('click', settings)
    try {
      window.close()
    } catch {}
    try {
      const win = window.open('', '_self')
      if (win) win.close()
    } catch {}
  }

  return (
    <div className="standby-overlay">
      <div className="standby-scanlines" />
      <div className="standby-card">
        <div className="standby-status-row">
          <span className="standby-blinker" />
          <span>SESSION PAUSED // WORKSPACE ON STANDBY</span>
        </div>
        <h2>Fixora session paused</h2>
        <p>
          The workspace is paused. Repair records and test results remain saved.
          Close this tab with <kbd>Cmd+W</kbd> / <kbd>Ctrl+W</kbd>, or select Close tab below:
        </p>
        <div className="standby-actions">
          <button
            className="game-btn game-btn-primary"
            onClick={() => {
              playUiSound('click', settings)
              onResume()
            }}
          >
            <span className="game-btn-num">&gt;&gt;</span>
            <span className="game-btn-label">Resume session</span>
            <span className="game-btn-bracket">]</span>
          </button>
          <button
            className="game-btn game-btn-quit"
            onClick={handleForceClose}
          >
            <span className="game-btn-num">XX</span>
            <span className="game-btn-label">Close tab</span>
            <span className="game-btn-bracket">]</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function LightDiagnosticAwakening({
  onComplete,
  enabled,
  settings,
}: {
  onComplete: () => void
  enabled: boolean
  settings: AppSettings
}) {
  useEffect(() => {
    if (!enabled) {
      onComplete()
      return
    }

    playUiSound('boot', settings)

    const timer = setTimeout(() => {
      onComplete()
    }, 1150)

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        onComplete()
      }
    }
    window.addEventListener('keydown', handleKey)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKey)
    }
  }, [enabled, onComplete, settings])

  if (!enabled) return null

  return (
    <div
      className="optical-awakening-overlay"
      onClick={onComplete}
      role="status"
      aria-live="polite"
    >
      {/* Light energy shockwave expanding outward across the entire screen */}
      <div className="shockwave-light-ring" />
      <div className="shockwave-light-ring ring-secondary" />

      {/* Optical scanning reticle centered on the SoC */}
      <div className="optical-reticle-wrap">
        <div className="reticle-ring-outer" />
        <div className="reticle-ring-inner" />
        <div className="reticle-crosshair-h" />
        <div className="reticle-crosshair-v" />
        <div className="reticle-laser-dot" />

        <div className="reticle-telemetry-tag">
          <Zap size={11} fill="currentColor" />
          <span>OPTICAL ALIGNMENT // REFERENCE VIEW</span>
        </div>
      </div>
    </div>
  )
}

function CircuitMapOverlay({ animated }: { animated: boolean }) {
  return (
    <svg
      className="negative-space-circuit-grid"
      viewBox="0 0 1600 900"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="traceGrad" x1="1" y1="0.5" x2="0" y2="0.5">
          <stop offset="0%" stopColor="#25b894" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#3cd7b2" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#5ae0c0" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="pulseGrad" x1="1" y1="0.5" x2="0" y2="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#43dfb9" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#1bb790" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Base Circuit Tracks extending from SoC across the entire negative space */}
      <path className="circuit-path-base" d="M 1197 437 L 1120 410 L 960 380 L 820 350 L 640 330 L 440 330 L 370 330" />
      <path className="circuit-path-base" d="M 1197 437 L 1110 435 L 940 435 L 780 410 L 590 395 L 430 395 L 370 395" />
      <path className="circuit-path-base" d="M 1197 437 L 1110 455 L 950 475 L 770 475 L 580 460 L 430 460 L 370 460" />
      <path className="circuit-path-base" d="M 1197 437 L 1130 475 L 980 525 L 820 540 L 620 525 L 440 525 L 370 525" />
      <path className="circuit-path-base" d="M 1197 437 L 1140 495 L 1000 580 L 840 600 L 640 590 L 440 590 L 370 590" />
      <path className="circuit-path-base" d="M 1197 437 L 1150 515 L 1020 640 L 860 670 L 650 655 L 440 655 L 370 655" />

      {/* Ambient Negative Space Branch Lines */}
      <path className="circuit-path-base" d="M 960 380 L 760 270 L 520 220 L 320 220 L 220 180 L 140 180" />
      <path className="circuit-path-base" d="M 640 330 L 510 260 L 340 260 L 240 290 L 160 290" />
      <path className="circuit-path-base" d="M 370 330 L 350 330 L 350 655 L 370 655" />
      <path className="circuit-path-base" d="M 1020 640 L 890 740 L 680 770 L 460 770 L 290 810 L 180 810" />

      {/* Active Glowing Pulses flowing along the tracks across negative space */}
      {animated && (
        <g className="active-pulses-group">
          <path className="circuit-pulse-stream pulse-flow-1" d="M 1197 437 L 1120 410 L 960 380 L 820 350 L 640 330 L 440 330 L 370 330" />
          <path className="circuit-pulse-stream pulse-flow-2" d="M 1197 437 L 1110 435 L 940 435 L 780 410 L 590 395 L 430 395 L 370 395" />
          <path className="circuit-pulse-stream pulse-flow-3" d="M 1197 437 L 1110 455 L 950 475 L 770 475 L 580 460 L 430 460 L 370 460" />
          <path className="circuit-pulse-stream pulse-flow-4" d="M 1197 437 L 1130 475 L 980 525 L 820 540 L 620 525 L 440 525 L 370 525" />
          <path className="circuit-pulse-stream pulse-flow-5" d="M 1197 437 L 1140 495 L 1000 580 L 840 600 L 640 590 L 440 590 L 370 590" />
          <path className="circuit-pulse-stream pulse-flow-6" d="M 1197 437 L 1150 515 L 1020 640 L 860 670 L 650 655 L 440 655 L 370 655" />
          <path className="circuit-pulse-stream pulse-flow-ambient1" d="M 960 380 L 760 270 L 520 220 L 320 220 L 220 180 L 140 180" />
          <path className="circuit-pulse-stream pulse-flow-ambient2" d="M 1020 640 L 890 740 L 680 770 L 460 770 L 290 810 L 180 810" />
        </g>
      )}

      {/* Terminal & Junction Nodes in Negative Space */}
      <circle className="circuit-terminal-node" cx="370" cy="330" r="3.5" />
      <circle className="circuit-terminal-node" cx="370" cy="395" r="3.5" />
      <circle className="circuit-terminal-node" cx="370" cy="460" r="3.5" />
      <circle className="circuit-terminal-node" cx="370" cy="525" r="3.5" />
      <circle className="circuit-terminal-node" cx="370" cy="590" r="3.5" />
      <circle className="circuit-terminal-node" cx="370" cy="655" r="3.5" />

      {/* Negative space test pads */}
      <circle className="circuit-test-pad pad-1" cx="640" cy="330" r="3" />
      <circle className="circuit-test-pad pad-2" cx="780" cy="410" r="3" />
      <circle className="circuit-test-pad pad-3" cx="580" cy="460" r="3" />
      <circle className="circuit-test-pad pad-4" cx="820" cy="540" r="3" />
      <circle className="circuit-test-pad pad-5" cx="320" cy="220" r="3" />
      <circle className="circuit-test-pad pad-6" cx="140" cy="180" r="3" />
      <circle className="circuit-test-pad pad-7" cx="160" cy="290" r="3" />
      <circle className="circuit-test-pad pad-8" cx="460" cy="770" r="3" />
      <circle className="circuit-test-pad pad-9" cx="180" cy="810" r="3" />
    </svg>
  )
}

function SettingsModal({
  isOpen,
  settings,
  onUpdateSettings,
  onReplayBoot,
  onClose,
}: {
  isOpen: boolean
  settings: AppSettings
  onUpdateSettings: (updater: (prev: AppSettings) => AppSettings) => void
  onReplayBoot: () => void
  onClose: () => void
}) {
  if (!isOpen) return null

  const toggle = (key: keyof AppSettings) => {
    playUiSound('toggle', settings)
    onUpdateSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const resetDefaults = () => {
    playUiSound('toggle', settings)
    onUpdateSettings(() => DEFAULT_SETTINGS)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card settings-modal-card" role="dialog" aria-modal="true">
        <div className="modal-head settings-modal-head">
          <div className="settings-head-title">
            <span className="eyebrow">SYSTEM CONFIGURATION</span>
            <h2>Settings</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="settings-modal-body">
          {/* Section 1: Visual & Motion */}
          <div className="settings-section">
            <div className="settings-section-head">
              <Sparkles size={16} />
              <h3>Visual effects and motion</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Animations and circuit effects</span>
                <span className="settings-desc">Show animated circuit traces, scan lines, ripples, and button interactions.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.animationsEnabled}
                  onChange={() => toggle('animationsEnabled')}
                />
                <span className="switch-slider" />
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Hardware telemetry display</span>
                <span className="settings-desc">Show the animated waveform and system telemetry in the interface.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.hardwareTelemetry}
                  onChange={() => toggle('hardwareTelemetry')}
                />
                <span className="switch-slider" />
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">High-contrast display</span>
                <span className="settings-desc">Increase panel contrast for bright workshop environments.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.highContrastHUD}
                  onChange={() => toggle('highContrastHUD')}
                />
                <span className="switch-slider" />
              </label>
            </div>

            <div className="settings-action-row">
              <button
                type="button"
                className="button button-ghost button-sm"
                onClick={() => {
                  playUiSound('click', settings)
                  onReplayBoot()
                }}
              >
                <RotateCcw size={13} /> Replay startup sequence
              </button>
            </div>
          </div>

          {/* Section 2: AI & Diagnostic Engine */}
          <div className="settings-section">
            <div className="settings-section-head">
              <Cpu size={16} />
              <h3>Diagnostic engine</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Recommendation source</span>
                <span className="settings-desc">Choose the Gemma API or local rule-based guidance.</span>
              </div>
              <select
                className="settings-select"
                value={settings.modelEngine}
                onChange={(e) => {
                  playUiSound('toggle', settings)
                  onUpdateSettings((prev) => ({ ...prev, modelEngine: e.target.value as 'gemma-4' | 'fallback-rules' }))
                }}
              >
                <option value="gemma-4">Gemma 4 API</option>
                <option value="fallback-rules">Local rules</option>
              </select>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Automatic triage on case creation</span>
                <span className="settings-desc">Prepare an initial assessment and suggested checks when a repair case is created.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.autoTriageOnCreate}
                  onChange={() => toggle('autoTriageOnCreate')}
                />
                <span className="switch-slider" />
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Strict safety mode</span>
                <span className="settings-desc">This preference is saved for future safety controls; it does not currently change safety checks.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.strictSafety}
                  onChange={() => toggle('strictSafety')}
                />
                <span className="switch-slider" />
              </label>
            </div>
          </div>

          {/* Section 3: Safety & Queue Prompts */}
          <div className="settings-section">
            <div className="settings-section-head">
              <ShieldCheck size={16} />
              <h3>Repair queue and handover</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Confirm repair case deletion</span>
                <span className="settings-desc">Ask for confirmation before permanently deleting a repair case.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.confirmDelete}
                  onChange={() => toggle('confirmDelete')}
                />
                <span className="switch-slider" />
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Confirm repair completion</span>
                <span className="settings-desc">Ask for confirmation before completing a case and moving it to Repair Memory.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.confirmComplete}
                  onChange={() => toggle('confirmComplete')}
                />
                <span className="switch-slider" />
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Archive completed repairs automatically</span>
                <span className="settings-desc">Move completed cases from the active queue to Repair Memory.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.autoArchive}
                  onChange={() => toggle('autoArchive')}
                />
                <span className="switch-slider" />
              </label>
            </div>
          </div>

          {/* Section 4: Audio Haptics */}
          <div className="settings-section">
            <div className="settings-section-head">
              {settings.audioEffects ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <h3>Audio feedback</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Interface sounds</span>
                <span className="settings-desc">Play subtle sounds when you use buttons and controls.</span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.audioEffects}
                  onChange={() => toggle('audioEffects')}
                />
                <span className="switch-slider" />
              </label>
            </div>
          </div>
        </div>

        <div className="modal-actions settings-modal-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={resetDefaults}
          >
            Restore Defaults
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              playUiSound('click', settings)
              onClose()
            }}
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  )
}

function NewRepairModal({
  onClose,
  onCreate,
  busy,
}: {
  onClose: () => void
  onCreate: (data: Record<string, string>) => Promise<void>
  busy: boolean
}) {
  const [form, setForm] = useState({
    device_category: 'Smartphone',
    brand: '',
    model: '',
    issue_title: '',
    symptoms: '',
    priority: 'normal',
    customer_contact: '',
    estimated_minutes: '30',
  })
  const [localError, setLocalError] = useState('')
  const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')
    if (form.symptoms.trim().length < 5) {
      setLocalError('Enter at least five characters describing the reported symptoms.')
      return
    }
    await onCreate(form)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-repair-title">
        <div className="modal-head">
          <div>
            <h2 id="new-repair-title">Create repair case</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <div className="form-grid two-cols">
            <label>Device category
              <select value={form.device_category} onChange={(e) => setField('device_category', e.target.value)}>
                <option>Smartphone</option>
                <option>Laptop</option>
                <option>Desktop</option>
                <option>Tablet</option>
                <option>Other electronics</option>
              </select>
            </label>
            <label>Priority
              <select value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label>Brand
              <input required maxLength={80} value={form.brand} onChange={(e) => setField('brand', e.target.value)} placeholder="e.g. Samsung" />
            </label>
            <label>Model
              <input required maxLength={100} value={form.model} onChange={(e) => setField('model', e.target.value)} placeholder="e.g. Galaxy A54" />
            </label>
            <label className="span-two">Reported issue
              <input required minLength={4} maxLength={160} value={form.issue_title} onChange={(e) => setField('issue_title', e.target.value)} placeholder="e.g. Charging disconnects intermittently" />
            </label>
            <label className="span-two">Reported symptoms
              <textarea required minLength={5} rows={3} value={form.symptoms} onChange={(e) => setField('symptoms', e.target.value)} placeholder="Describe the reported symptoms" />
            </label>
            <label className="span-two">Customer contact <span className="label-muted">(phone or email)</span>
              <input value={form.customer_contact} onChange={(e) => setField('customer_contact', e.target.value)} placeholder="+1 (555) 000-0000 or customer@example.com" />
            </label>
          </div>
          {localError && <div className="inline-error"><AlertCircle size={15} />{localError}</div>}
          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Create repair case
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Hero / Home Landing Page:
 * Uses the pristine high-resolution hardware component image as background with interactive glowing circuit animations.
 * Features video-game style minimalistic buttons in the open space.
 */
function HomePage({
  onNavigate,
  onNewRepair,
  onOpenCredits,
  onOpenSettings,
  onQuit,
  settings,
}: {
  onNavigate: (tab: NavId) => void
  onNewRepair: () => void
  onOpenCredits: () => void
  onOpenSettings: () => void
  onQuit: () => void
  settings: AppSettings
}) {
  return (
    <div className="home-hero-page">
      {/* Pristine Lossless 1679x937 PNG Hardware Background Layer */}
      <div className="home-bg-layer" />

      {/* SVG Circuit Traces & Active Light Pulses spanning across the negative space */}
      <CircuitMapOverlay animated={settings.animationsEnabled} />

      {/* Sweeping Optical Laser Scanner Line */}
      {settings.animationsEnabled && (
        <div className="scanline-laser-beam" aria-hidden="true" />
      )}

      {/* Animated Circuit Pulses aligned with image traces */}
      {settings.animationsEnabled && (
        <div className="circuit-fx-overlay" aria-hidden="true">
          {/* Concentric Radar Ping Ripples from SoC */}
          <div className="radar-ripple ripple-1" />
          <div className="radar-ripple ripple-2" />
          <div className="radar-ripple ripple-3" />

          {/* Core chip glow */}
          <div className="circuit-pulse-core" />

          {/* Diagnostic SMD LEDs blinking on PCB */}
          <div className="smd-led smd-led-1" />
          <div className="smd-led smd-led-2" />
          <div className="smd-led smd-led-3" />
          <div className="smd-led smd-led-4" />
        </div>
      )}

      {/* Left side: Minimalistic Video Game Menu UI */}
      <div className="game-hud-container">
        <div className="game-hud-top">
          <div className="game-hud-badge">
            <span className="hud-blinker" />
            <span>SYSTEM STATUS // READY</span>
          </div>
          {settings.hardwareTelemetry && (
            <div className="game-hud-telemetry">
              <div className="oscilloscope-mini" aria-hidden="true">
                <span className="telemetry-bar bar-1" />
                <span className="telemetry-bar bar-2" />
                <span className="telemetry-bar bar-3" />
                <span className="telemetry-bar bar-4" />
                <span className="telemetry-bar bar-5" />
              </div>
              <span>DIAGNOSTIC ENGINE // READY</span>
            </div>
          )}
        </div>

        <div className="game-title-wrap">
          <div className="game-title-eyebrow">
            <Zap size={14} className="hud-bolt" />
            <span>ELECTRONICS REPAIR INTELLIGENCE</span>
          </div>
          <h1 className="game-main-title">
            FIXORA<span className="game-title-dot">.AI</span>
          </h1>
          <p className="game-tagline">
            Evidence-based diagnostic support for electronics repair and fault verification.
          </p>
        </div>

        {/* Video Game Style Menu Buttons with Staggered Cascades */}
        <nav className="game-menu-stack" aria-label="Main system menu">
          <button
            className="game-btn game-btn-primary"
            style={{ '--btn-idx': 1 } as React.CSSProperties}
            onClick={() => {
              playUiSound('click', settings)
              onNewRepair()
            }}
          >
            <span className="game-btn-num">01</span>
            <span className="game-btn-label">Create repair case</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn"
            style={{ '--btn-idx': 2 } as React.CSSProperties}
            onClick={() => {
              playUiSound('click', settings)
              onNavigate('overview')
            }}
          >
            <span className="game-btn-num">02</span>
            <span className="game-btn-label">Overview</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn"
            style={{ '--btn-idx': 3 } as React.CSSProperties}
            onClick={() => {
              playUiSound('click', settings)
              onNavigate('cases')
            }}
          >
            <span className="game-btn-num">03</span>
            <span className="game-btn-label">Repair Queue</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn"
            style={{ '--btn-idx': 4 } as React.CSSProperties}
            onClick={() => {
              playUiSound('click', settings)
              onOpenSettings()
            }}
          >
            <span className="game-btn-num">04</span>
            <span className="game-btn-label">Settings</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn"
            style={{ '--btn-idx': 5 } as React.CSSProperties}
            onClick={() => {
              playUiSound('click', settings)
              onOpenCredits()
            }}
          >
            <span className="game-btn-num">05</span>
            <span className="game-btn-label">Credits</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn game-btn-quit"
            style={{ '--btn-idx': 6 } as React.CSSProperties}
            onClick={onQuit}
          >
            <span className="game-btn-num">06</span>
            <span className="game-btn-label">Close site</span>
            <span className="game-btn-bracket">]</span>
          </button>
        </nav>

        <div className="game-hud-bottom">
            <span className="hud-code-hint">
            HACK DAY AT MICROSOFT // REPAIR DIAGNOSTICS
          </span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  // Application Settings & Visual Preferences
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch (e) {
      console.warn('Failed reading settings from storage', e)
    }
    return DEFAULT_SETTINGS
  })
  const [showSettings, setShowSettings] = useState(false)
  const [isBooting, setIsBooting] = useState(() => {
    return !sessionStorage.getItem('fixora_booted_session')
  })

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch (e) {
      console.warn('Failed saving settings to storage', e)
    }

    const body = document.body
    if (!settings.animationsEnabled) {
      body.classList.add('no-animations')
    } else {
      body.classList.remove('no-animations')
    }

    if (settings.highContrastHUD) {
      body.classList.add('high-contrast-hud')
    } else {
      body.classList.remove('high-contrast-hud')
    }
  }, [settings])

  // Default to 'home' landing page
  const [activeNav, setActiveNav] = useState<NavId>('home')
  const [diagnosticsTab, setDiagnosticsTab] = useState<'evidence' | 'recommendation'>('evidence')
  const [cases, setCases] = useState<RepairCase[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeSource[]>([])
  const [knowledgeNotice, setKnowledgeNotice] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const [selectedDetail, setSelectedDetail] = useState<CaseDetail | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [query, setQuery] = useState('')
  const [caseStatusFilter, setCaseStatusFilter] = useState('all')
  const [casePriorityFilter, setCasePriorityFilter] = useState('all')
  const [memoryQuery, setMemoryQuery] = useState('')
  const [showNewRepair, setShowNewRepair] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showStandby, setShowStandby] = useState(false)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [recordingTest, setRecordingTest] = useState(false)
  const recordingTestRef = useRef(false)
  const [recordingComponent, setRecordingComponent] = useState(false)
  const recordingComponentRef = useRef(false)
  const [recordingComponentTest, setRecordingComponentTest] = useState<number | null>(null)
  const recordingComponentTestRef = useRef<number | null>(null)
  const [recordingOutcome, setRecordingOutcome] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  // Direct tab close handler with fallback to standby terminal
  function handleQuitSite() {
    playUiSound('click', settings)
    try {
      window.close()
    } catch (e) {
      console.warn('Direct close blocked:', e)
    }
    try {
      const win = window.open('', '_self')
      if (win) win.close()
    } catch (e) {
      console.warn('Self close blocked:', e)
    }
    // Modern browsers often block tab closure for non-script-opened tabs
    setTimeout(() => {
      setShowStandby(true)
    }, 120)
  }

  // Modals for confirmation
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; caseId: string; name: string }>({
    isOpen: false,
    caseId: '',
    name: '',
  })
  const [completeModal, setCompleteModal] = useState<{
    isOpen: boolean
    caseId: string
    action: () => Promise<void>
  }>({
    isOpen: false,
    caseId: '',
    action: async () => {},
  })

  const [testForm, setTestForm] = useState({
    test_name: testSuggestions[0],
    result: 'inconclusive' as TestStatus,
    observed_result: '',
    details: '',
  })
  const [outcomeForm, setOutcomeForm] = useState({
    confirmed_fault: '',
    repair_action: '',
    outcome: '',
    status: 'completed' as 'testing' | 'completed' | 'in_repair',
  })

  async function loadAll() {
    const [healthResult, casesResult, dashboardResult, knowledgeResult] = await Promise.allSettled([
      api.health(),
      api.cases(),
      api.dashboard(),
      api.knowledge(),
    ])
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value)
    if (casesResult.status === 'fulfilled') {
      setCases(casesResult.value)
      setSelectedId((current) =>
        current && casesResult.value.some((item) => item.id === current)
          ? current
          : casesResult.value.find((item) => item.status !== 'completed')?.id || casesResult.value[0]?.id || ''
      )
    }
    if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value)
    if (knowledgeResult.status === 'fulfilled') {
      setKnowledge(knowledgeResult.value.sources)
      setKnowledgeNotice(knowledgeResult.value.notice)
    }
    if (casesResult.status === 'rejected') {
      setNotice({ kind: 'error', text: errorMessage((casesResult as PromiseRejectedResult).reason) })
    }
  }

  async function refreshLists() {
    const [casesResult, dashboardResult, healthResult] = await Promise.all([
      api.cases(),
      api.dashboard(),
      api.health(),
    ])
    setCases(casesResult)
    setDashboard(dashboardResult)
    setHealth(healthResult)
  }

  async function loadDetail(id: string) {
    if (!id) {
      setSelectedDetail(null)
      setRecommendation(null)
      return
    }
    try {
      const detail = await api.caseDetail(id)
      if (selectedIdRef.current !== id) return
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

  async function createComponent(data: { component_name: string; model_part_number?: string }) {
    if (!selectedDetail || recordingComponentRef.current) return false
    const caseId = selectedDetail.id
    recordingComponentRef.current = true
    setRecordingComponent(true)
    try {
      const component = await api.createComponent(caseId, data)
      if (selectedIdRef.current === caseId) {
        setSelectedDetail((current) => current?.id === caseId
          ? { ...current, components: [...current.components, component] }
          : current)
      }
      flash('success', `${component.component_name} added. Health remains Unknown until test evidence is recorded.`)
      return true
    } catch (error) {
      flash('error', errorMessage(error))
      return false
    } finally {
      recordingComponentRef.current = false
      setRecordingComponent(false)
    }
  }

  async function recordComponentTest(componentId: number, data: {
    test_name: string; result: ComponentTestStatus; observed_result: string; details: string
  }) {
    if (!selectedDetail || recordingComponentTestRef.current !== null) return false
    const caseId = selectedDetail.id
    recordingComponentTestRef.current = componentId
    setRecordingComponentTest(componentId)
    try {
      const updatedComponent = await api.addComponentTest(caseId, componentId, data)
      if (selectedIdRef.current === caseId) {
        setSelectedDetail((current) => current?.id === caseId
          ? { ...current, components: current.components.map((component) => component.id === componentId ? updatedComponent : component) }
          : current)
      }
      flash('success', `Test evidence saved for ${updatedComponent.component_name}.`)
      return true
    } catch (error) {
      flash('error', errorMessage(error))
      return false
    } finally {
      recordingComponentTestRef.current = null
      setRecordingComponentTest(null)
    }
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
        customer_contact: form.customer_contact || undefined,
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      })
      setShowNewRepair(false)
      setSelectedId(created.id)
      setActiveNav('diagnostics')
      setDiagnosticsTab('evidence')
      await refreshLists()
      flash('success', `Repair case ${created.id} created for ${created.brand} ${created.model}.`)

      // Automatic AI Triage if enabled in Settings
      if (settings.autoTriageOnCreate) {
        setGenerating(true)
        void api.recommendation(created.id)
          .then((rec) => {
            if (selectedIdRef.current === created.id) setRecommendation(rec)
            void loadDetail(created.id)
            flash('success', rec.provider === 'gemini_api'
              ? 'Gemma recommendation generated.'
              : 'Recommendation generated using local rules.')
          })
          .catch((err) => console.warn('Auto triage error:', err))
          .finally(() => setGenerating(false))
      }
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function performDeleteDevice(caseId: string) {
    setBusy(true)
    try {
      await api.deleteCase(caseId)
      setDeleteModal({ isOpen: false, caseId: '', name: '' })
      flash('success', `Repair case ${caseId} deleted.`)
      await refreshLists()
      if (selectedId === caseId) {
        const remaining = cases.filter((c) => c.id !== caseId)
        setSelectedId(remaining[0]?.id || '')
      }
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  function promptDeleteDevice(caseId: string, brand: string, model: string) {
    playUiSound('click', settings)
    if (!settings.confirmDelete) {
      void performDeleteDevice(caseId)
      return
    }
    setDeleteModal({
      isOpen: true,
      caseId,
      name: `${brand} ${model}`.trim() || caseId,
    })
  }

  async function confirmDeleteDevice() {
    const { caseId } = deleteModal
    if (!caseId) return
    await performDeleteDevice(caseId)
  }

  async function addTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDetail || recordingTestRef.current) return
    const caseId = selectedDetail.id
    recordingTestRef.current = true
    setRecordingTest(true)
    try {
      const savedTest = await api.addTest(caseId, testForm)
      setSelectedDetail((current) => current?.id === caseId
        ? { ...current, tests: [...current.tests, savedTest].sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime()) }
        : current)
      setTestForm((current) => ({ ...current, observed_result: '', details: '' }))
      await refreshLists()
      if (selectedIdRef.current === caseId) await loadDetail(caseId)
      flash('success', 'Diagnostic test result saved.')
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      recordingTestRef.current = false
      setRecordingTest(false)
    }
  }

  async function generateRecommendation() {
    if (!selectedDetail) return
    const caseId = selectedDetail.id
    setGenerating(true)
    try {
      const result = await api.recommendation(caseId)
      await refreshLists()
      if (selectedIdRef.current === caseId) {
        setRecommendation(result)
        await loadDetail(caseId)
        setRecommendation((current) => current?.id === result.id ? { ...current, similar_cases: result.similar_cases } : current)
      }
      flash('success', result.provider === 'gemini_api' ? 'Gemma recommendation generated.' : 'Recommendation generated using local rules.')
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      setGenerating(false)
    }
  }

  async function executeSaveOutcome() {
    if (!selectedDetail) return
    setRecordingOutcome(true)
    try {
      await api.outcome(selectedDetail.id, outcomeForm)
      await refreshLists()
      await loadDetail(selectedDetail.id)
      flash('success', outcomeForm.status === 'completed' ? 'Repair case completed and moved to Repair Memory.' : 'Repair outcome saved.')
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      setRecordingOutcome(false)
    }
  }

  function handleSaveOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDetail) return
    playUiSound('click', settings)
    if (outcomeForm.status === 'completed' && settings.confirmComplete) {
      setCompleteModal({
        isOpen: true,
        caseId: selectedDetail.id,
        action: executeSaveOutcome,
      })
    } else {
      void executeSaveOutcome()
    }
  }

  async function executeUpdateStatus(caseId: string, status: CaseStatus) {
    try {
      await api.updateCase(caseId, { status })
      await refreshLists()
      if (selectedId === caseId) await loadDetail(caseId)
      flash('success', `Repair case ${caseId} moved to ${statusNames[status]}.`)
    } catch (error) {
      flash('error', errorMessage(error))
    }
  }

  function handleStatusChange(caseId: string, status: CaseStatus) {
    playUiSound('click', settings)
    if (status === 'completed' && settings.confirmComplete) {
      setCompleteModal({
        isOpen: true,
        caseId,
        action: () => executeUpdateStatus(caseId, status),
      })
    } else {
      void executeUpdateStatus(caseId, status)
    }
  }

  // Active queue cases (Filtered if autoArchive is enabled)
  const activeQueueCases = useMemo(
    () => (settings.autoArchive ? cases.filter((item) => item.status !== 'completed') : cases),
    [cases, settings.autoArchive]
  )

  const visibleQueueCases = useMemo(() => {
    return activeQueueCases.filter((item) => {
      const matchesQuery =
        !query ||
        `${item.id} ${item.brand} ${item.model} ${item.issue_title} ${item.symptoms} ${item.customer_contact || ''}`
          .toLowerCase()
          .includes(query.toLowerCase())
      const matchesStatus = caseStatusFilter === 'all'
        || item.status === caseStatusFilter
        || (caseStatusFilter === 'pending' && ['new', 'diagnosing', 'waiting_parts', 'on_hold'].includes(item.status))
        || (caseStatusFilter === 'in_progress' && ['in_repair', 'testing'].includes(item.status))
        || (caseStatusFilter === 'awaiting_diagnosis' && ['new', 'diagnosing'].includes(item.status))
        || (caseStatusFilter === 'evidence_to_review' && item.data_origin !== 'demo' && item.evidence_outdated)
      const matchesPriority = casePriorityFilter === 'all' || item.priority === casePriorityFilter
      return matchesQuery && matchesStatus && matchesPriority
    })
  }, [activeQueueCases, query, caseStatusFilter, casePriorityFilter])

  const memoryCases = useMemo(() => {
    const queryText = memoryQuery.toLowerCase().trim()
    return cases
      .filter(
        (item) =>
          item.status === 'completed' &&
          item.confirmed_fault &&
          (!queryText ||
            `${item.id} ${item.brand} ${item.model} ${item.issue_title} ${item.confirmed_fault} ${item.repair_action || ''} ${item.outcome || ''}`
              .toLowerCase()
              .includes(queryText))
      )
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [cases, memoryQuery])

  const selected = selectedDetail?.id === selectedId ? selectedDetail : null
  const visibleRecommendation = recommendation?.case_id === selected?.id ? recommendation : null
  const staleRecommendation = Boolean(
    visibleRecommendation && selected && selected.tests.some((test) => !visibleRecommendation.content.evidence_test_ids?.includes(test.id))
  )

  const aiActive = Boolean(health?.model_configured)

  function openCase(id: string, tab: NavId = 'diagnostics') {
    setSelectedId(id)
    setActiveNav(tab)
  }

  const isHome = activeNav === 'home'

  return (
    <div className={`app-shell ${isHome ? 'home-layout' : 'dock-layout'}`}>
      {/* Sleek minimal top strip - HIDDEN on HomePage */}
      {!isHome && (
        <header className="app-top-strip">
          <div className="app-brand" onClick={() => setActiveNav('home')}>
            <div className="brand-mark">
              <Zap size={18} fill="currentColor" strokeWidth={2.4} />
            </div>
            <span className="brand-name">fixora<span className="brand-ai">.ai</span></span>
          </div>

          <div className="top-strip-actions">
            <div className={`model-chip ${aiActive ? 'model-chip-online' : ''}`}>
              <span className={`connection-dot ${aiActive ? 'online' : ''}`} />
              {aiActive ? health?.model_name || 'Gemma 4' : 'Local rules fallback'}
            </div>
            <button
              className="topbar-icon"
              title="Open settings"
              onClick={() => {
                playUiSound('click', settings)
                setShowSettings(true)
              }}
            >
              <Settings size={15} />
            </button>
            <button
              className="topbar-icon"
              title="Refresh repair data"
              onClick={() => {
                playUiSound('click', settings)
                void refreshLists()
                  .then(() => flash('success', 'Repair data refreshed.'))
                  .catch((error) => flash('error', errorMessage(error)))
              }}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
      )}

      {notice && !isHome && (
        <div className={`notice-bar notice-${notice.kind}`} role="status">
          <span className="notice-mark">
            {notice.kind === 'success' ? <CheckCircle2 size={16} /> : notice.kind === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
          </span>
          <span>{notice.text}</span>
          <button className="notice-close" onClick={() => setNotice(null)} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Content Area with Quick Page Transitions */}
      <main className={isHome ? 'main-area-home' : 'main-area-full'}>
        {isHome && (
          <div key="home" className="page-transition-wrap">
            <HomePage
              onNavigate={(tab) => {
                playUiSound('click', settings)
                setActiveNav(tab)
              }}
              onNewRepair={() => {
                playUiSound('click', settings)
                setShowNewRepair(true)
              }}
              onOpenCredits={() => {
                playUiSound('click', settings)
                setShowCredits(true)
              }}
              onOpenSettings={() => {
                playUiSound('click', settings)
                setShowSettings(true)
              }}
              onQuit={handleQuitSite}
              settings={settings}
            />
          </div>
        )}

        {!isHome && activeNav === 'overview' && (
          <div key="overview" className="page-transition-wrap overview-fullscreen-wrap">
            <OverviewPage
              dashboard={dashboard}
              cases={cases}
              onOpen={openCase}
              onNavigate={(tab, filter) => {
                playUiSound('click', settings)
                if (filter) setCaseStatusFilter(filter)
                setActiveNav(tab)
              }}
              settings={settings}
              aiActive={aiActive}
            />
          </div>
        )}

        {!isHome && activeNav === 'cases' && (
          <div key="cases" className="page-transition-wrap queue-fullscreen-wrap">
            <CasesPage
              cases={visibleQueueCases}
              query={query}
              setQuery={setQuery}
              statusFilter={caseStatusFilter}
              setStatusFilter={setCaseStatusFilter}
              priorityFilter={casePriorityFilter}
              setPriorityFilter={setCasePriorityFilter}
              onNew={() => {
                playUiSound('click', settings)
                setShowNewRepair(true)
              }}
              onOpen={openCase}
              onStatus={handleStatusChange}
              onDelete={promptDeleteDevice}
              settings={settings}
            />
          </div>
        )}

        {!isHome && activeNav === 'diagnostics' && (
          <div key="diagnostics" className="page-transition-wrap diagnostics-fullscreen-wrap">
            <DiagnosticsPage
              selected={selected}
              cases={activeQueueCases.length ? activeQueueCases : cases}
              diagnosticsTab={diagnosticsTab}
              setDiagnosticsTab={setDiagnosticsTab}
              recommendation={visibleRecommendation}
              health={health}
              stale={staleRecommendation}
              generating={generating}
              recordingTest={recordingTest}
              recordingComponent={recordingComponent}
              recordingComponentTest={recordingComponentTest}
              recordingOutcome={recordingOutcome}
              testForm={testForm}
              setTestForm={setTestForm}
              outcomeForm={outcomeForm}
              setOutcomeForm={setOutcomeForm}
              onSelect={(id) => setSelectedId(id)}
              onAddTest={addTest}
              onAddComponent={createComponent}
              onAddComponentTest={recordComponentTest}
              onGenerate={generateRecommendation}
              onSaveOutcome={handleSaveOutcome}
              onDelete={promptDeleteDevice}
              onOpenCase={openCase}
              settings={settings}
            />
          </div>
        )}

        {!isHome && activeNav !== 'overview' && activeNav !== 'cases' && activeNav !== 'diagnostics' && (
          <div className="page-content">
            <div key={activeNav} className="page-transition-wrap">
              {activeNav === 'memory' && (
                <MemoryPage
                  cases={memoryCases}
                  query={memoryQuery}
                  setQuery={setMemoryQuery}
                  onOpen={openCase}
                  onDelete={promptDeleteDevice}
                />
              )}

              {activeNav === 'knowledge' && (
                <KnowledgePage sources={knowledge} notice={knowledgeNotice} />
              )}

              {activeNav === 'inventory' && <InventoryPage />}
            </div>
          </div>
        )}
      </main>

      {/* macOS Dock Navigation - HIDDEN on HomePage */}
      {!isHome && (
        <div className="mac-dock-container">
          <nav className="mac-dock glass-dock" role="navigation" aria-label="macOS dock navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeNav === item.id
              const count = item.id === 'cases' ? activeQueueCases.length : null
              return (
                <button
                  key={item.id}
                  className={`dock-item ${isActive ? 'dock-item-active' : ''}`}
                  onClick={() => {
                    playUiSound('click', settings)
                    setActiveNav(item.id)
                  }}
                  aria-label={item.label}
                >
                  <span className="dock-tooltip">{item.label}</span>
                  <div className="dock-icon-wrap">
                    <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
                    {count !== null && count > 0 && <span className="dock-badge">{count}</span>}
                  </div>
                  {isActive && <span className="dock-active-dot" />}
                </button>
              )
            })}
            <div className="dock-divider" />
            <button
              className="dock-item"
              onClick={() => {
                playUiSound('click', settings)
                setShowSettings(true)
              }}
              aria-label="Settings"
            >
              <span className="dock-tooltip">Settings</span>
              <div className="dock-icon-wrap">
                <Settings size={21} strokeWidth={1.8} />
              </div>
            </button>
            <button
              className="dock-item dock-item-action"
              onClick={() => {
                playUiSound('click', settings)
                setShowNewRepair(true)
              }}
              aria-label="Create repair case"
            >
              <span className="dock-tooltip">Create repair case</span>
              <div className="dock-icon-wrap">
                <Plus size={22} strokeWidth={2.5} />
              </div>
            </button>
          </nav>
        </div>
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        settings={settings}
        onUpdateSettings={setSettings}
        onReplayBoot={() => {
          setShowSettings(false)
          setActiveNav('home')
          setIsBooting(true)
        }}
        onClose={() => setShowSettings(false)}
      />

      {isHome && isBooting && (
        <LightDiagnosticAwakening
          enabled={settings.animationsEnabled}
          settings={settings}
          onComplete={() => {
            setIsBooting(false)
            sessionStorage.setItem('fixora_booted_session', 'true')
          }}
        />
      )}

      {showNewRepair && (
        <NewRepairModal onClose={() => setShowNewRepair(false)} onCreate={createRepair} busy={busy} />
      )}

      <CreditsModal isOpen={showCredits} onClose={() => setShowCredits(false)} />

      <StandbyModal isOpen={showStandby} onResume={() => setShowStandby(false)} settings={settings} />

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete repair case?"
        message={`Delete ${deleteModal.name} (${deleteModal.caseId})? This action cannot be undone.`}
        confirmText="Delete"
        confirmTone="danger"
        busy={busy}
        onConfirm={confirmDeleteDevice}
        onCancel={() => setDeleteModal({ isOpen: false, caseId: '', name: '' })}
      />

      <ConfirmModal
        isOpen={completeModal.isOpen}
        title="Complete repair case?"
        message={`Complete ${completeModal.caseId} and move it to Repair Memory? It will be removed from the active queue.`}
        confirmText="Complete repair case"
        confirmTone="primary"
        busy={recordingOutcome}
        onConfirm={async () => {
          const action = completeModal.action
          setCompleteModal({ isOpen: false, caseId: '', action: async () => {} })
          await action()
        }}
        onCancel={() => setCompleteModal({ isOpen: false, caseId: '', action: async () => {} })}
      />
    </div>
  )
}

function OverviewPage({
  dashboard,
  cases,
  onOpen,
  onNavigate,
  settings,
  aiActive,
}: {
  dashboard: DashboardSummary | null
  cases: RepairCase[]
  onOpen: (id: string, tab?: NavId) => void
  onNavigate: (tab: NavId, filter?: string) => void
  settings: AppSettings
  aiActive?: boolean
}) {
  const userCases = cases.filter((item) => item.data_origin !== 'demo')
  const urgent = userCases.filter(
    (item) => (item.priority === 'urgent' || item.priority === 'high') && item.status !== 'completed'
  )
  const activeCases = userCases.filter((item) => item.status !== 'completed')
  const recurringIssues = Object.values(userCases.reduce<Record<string, RepairCase[]>>((groups, item) => {
    const key = item.issue_title.trim().toLowerCase()
    groups[key] = [...(groups[key] || []), item]
    return groups
  }, {})).filter((group) => group.length > 1).sort((a, b) => b.length - a.length).slice(0, 2)
  const bottlenecks = activeCases.filter((item) => {
    const ageDays = (Date.now() - new Date(item.updated_at).getTime()) / 86400000
    return item.status === 'waiting_parts' || item.status === 'on_hold' || ageDays >= 3
  }).sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()).slice(0, 3)
  const suggested = [...activeCases].sort((a, b) => {
    const score = (item: RepairCase) => (item.priority === 'urgent' ? 4 : item.priority === 'high' ? 3 : item.priority === 'normal' ? 2 : 1) + Math.min(3, Math.max(0, (Date.now() - new Date(item.updated_at).getTime()) / 86400000 / 3))
    return score(b) - score(a)
  }).slice(0, 2)
  const recentActivity = [...userCases].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 4)
  const pendingActions = (dashboard?.pending_actions || []).filter((action) => userCases.some((item) => item.id === action.case_id))
  const value = (number: number | undefined) => dashboard ? number ?? 0 : '—'

  return (
    <div className="overview-fullscreen-layout">
      {/* Pristine Overview Hardware Background Layer */}
      <div className="overview-bg-layer" />

      {/* Atmospheric negative space soft daylight wash for contrast */}
      <div className="overview-ambient-mask" aria-hidden="true" />

      {/* Animated Circuit Streams spanning across negative space */}
      <OverviewCircuitMapOverlay animated={settings.animationsEnabled} />

      {/* Sweeping Optical Laser Scanner Line over Motherboard */}
      {settings.animationsEnabled && (
        <div className="overview-laser-scanner" aria-hidden="true" />
      )}

      {/* Hardware Cooling Fan Rotation & Convection Rings over Laptop Fan Hub */}
      <OverviewFanOverlay animated={settings.animationsEnabled} />

      {/* SMD Diagnostic Micro-LEDs on physical test points */}
      <div className="overview-probes-layer" aria-hidden="true">
        {OVERVIEW_TEST_POINTS.map((tp) => (
          <div
            key={tp.id}
            className="overview-smd-probe"
            style={{ right: tp.right, top: tp.top }}
          >
            <span
              className={`probe-led ${settings.animationsEnabled ? 'pulsing' : ''}`}
              style={{ backgroundColor: tp.color, boxShadow: `0 0 8px ${tp.color}` }}
            />
            {settings.animationsEnabled && (
              <span
                className="probe-ping"
                style={{ borderColor: tp.color, animationDuration: tp.period }}
              />
            )}
            <div className="probe-tooltip">
              <span className="probe-code">{tp.code}</span>
              <span className="probe-desc">{tp.label}</span>
              <span className="probe-val" style={{ color: tp.color }}>{tp.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="overview-bg-layer" aria-hidden="true" />
      <div className="overview-ambient-mask" aria-hidden="true" />
      <div className="overview-negative-hud">
        <header className="overview-hud-header">
          <div className="overview-telemetry-chip">
            <span className={`overview-telemetry-dot ${aiActive ? 'online' : ''}`} />
            <span>{aiActive ? 'REPAIR INTELLIGENCE ONLINE' : 'REPAIR INTELLIGENCE'}</span>
          </div>
          <h1>Repair overview</h1>
          <p className="overview-subtitle">Monitor repair cases, diagnostic evidence, and follow-up priorities.</p>
        </header>

        <div className="overview-glass-stats-grid">
          {[
            { title: 'Active repairs', detail: 'Across the current queue', count: value(dashboard?.active_repairs), icon: Activity, tone: 'blue', tab: 'cases' as NavId },
            { title: 'Ready for testing', detail: 'Awaiting final verification', count: value(dashboard?.ready_for_testing), icon: ClipboardCheck, tone: 'green', tab: 'cases' as NavId },
            { title: 'Completed this week', detail: 'Updated in the last 7 days', count: value(dashboard?.completed_this_week), icon: CheckCircle2, tone: 'violet', tab: 'memory' as NavId },
            { title: 'Repair memory', detail: 'Cases with confirmed outcomes', count: value(dashboard?.saved_cases), icon: History, tone: 'amber', tab: 'memory' as NavId },
          ].map(({ title, detail, count, icon: Icon, tone, tab }) => (
            <button key={title} className={`overview-glass-card card-tone-${tone}`} onClick={() => { playUiSound('click', settings); onNavigate(tab) }}>
              <div className="glass-card-top"><div className={`glass-card-icon icon-${tone}`}><Icon size={19} /></div><span className="glass-card-arrow"><ArrowRight size={15} /></span></div>
              <div className="glass-card-val">{count}</div><div className="glass-card-title">{title}</div><div className="glass-card-detail">{detail}</div>
            </button>
          ))}
        </div>

        <div className="overview-workload-strip" aria-label="Repair workload">
          {[
            { label: 'Total repairs', value: dashboard?.total_cases, filter: 'all' },
            { label: 'Pending', value: dashboard?.pending_repairs, filter: 'pending' },
            { label: 'In progress', value: dashboard?.in_progress, filter: 'in_progress' },
            { label: 'Completed', value: dashboard?.completed_repairs, filter: 'all', tab: 'memory' as NavId },
            { label: 'Awaiting diagnosis', value: dashboard?.awaiting_diagnosis, filter: 'awaiting_diagnosis' },
            { label: 'Evidence to review', value: dashboard?.evidence_to_review, filter: 'evidence_to_review' },
          ].map((item) => (
            <button key={item.label} className="workload-stat" onClick={() => onNavigate(item.tab || 'cases', item.filter)}>
              <strong>{item.value ?? '—'}</strong><span>{item.label}</span>
            </button>
          ))}
        </div>
        <p className="overview-data-note">Metrics and insights use user-entered repair records. Demo records are identified in the repair queue.</p>

        <section className="overview-glass-attention">
          <div className="glass-attention-head">
            <div className="glass-attention-title"><span className="attention-indicator"><AlertTriangle size={16} /></span><div><h3>Attention needed</h3><p className="overview-section-note">High and urgent active cases</p></div></div>
            <span className={`attention-count-badge ${urgent.length > 0 ? 'badge-urgent' : 'badge-calm'}`}>{urgent.length} {urgent.length === 1 ? 'CASE' : 'CASES'}</span>
          </div>
          {urgent.length > 0 ? <div className="glass-signal-list">
            {urgent.map((item) => (
              <article key={item.id} className="glass-signal-item">
                <span className="signal-bar-accent" />
                <div className="signal-item-copy">
                  <strong className="signal-item-title">{item.issue_title}</strong>
                  <span className="signal-item-meta">{item.id} · {item.brand} {item.model}</span>
                  <span className="signal-item-description">{item.symptoms}</span>
                </div>
                <div className="signal-item-state"><StatusPill status={item.status} /><PriorityPill priority={item.priority} /></div>
                <button className="overview-action-button" onClick={() => { playUiSound('click', settings); onOpen(item.id, 'diagnostics') }}>Open diagnostics <ArrowRight size={14} /></button>
              </article>
            ))}
          </div> : <div className="glass-calm-state"><div className="calm-icon-wrap"><CheckCircle2 size={17} /></div><div className="calm-text-wrap"><strong>No high- or urgent-priority repairs need attention</strong><small>Cases needing priority review will appear here.</small></div></div>}
          <div className="overview-pending-actions">
            <div className="overview-pending-heading"><h3>Pending actions</h3><span>{pendingActions.length}</span></div>
            {pendingActions.length ? pendingActions.map((action) => (
              <button className="overview-pending-row" key={`${action.case_id}-${action.title}`} onClick={() => onOpen(action.case_id, 'diagnostics')}>
                <span className="pending-action-icon"><AlertCircle size={14} /></span>
                <span><strong>{action.title} · {action.case_id}</strong><small>{action.detail}</small></span>
                <ChevronRight size={15} />
              </button>
            )) : <p className="overview-empty-copy">There are no follow-up actions for user-entered repair cases.</p>}
          </div>
        </section>

        <div className="overview-support-grid">
          <section className="overview-support-card">
            <div className="overview-support-heading"><span className="support-icon insight-icon"><BrainCircuit size={17} /></span><div><h2>AI Repair Insights</h2><p>Patterns and queue signals from saved repair records.</p></div></div>
            {userCases.length === 0 ? <p className="overview-empty-copy">Insights will appear when user-entered repair records are available.</p> : <div className="overview-insight-list">
              {recurringIssues.length > 0 && <div className="overview-insight"><span className="insight-mark">↻</span><div><strong>Recurring issue · {recurringIssues[0][0].issue_title}</strong><p>Appears in {recurringIssues[0].length} available cases. Review their test evidence for shared patterns.</p></div></div>}
              {bottlenecks.slice(0, 1).map((item) => <div className="overview-insight" key={`b-${item.id}`}><span className="insight-mark bottleneck-mark"><Clock3 size={15} /></span><div><strong>Waiting case · {item.id}</strong><p>{item.status === 'waiting_parts' ? 'Waiting for parts' : item.status === 'on_hold' ? 'On hold' : 'No update for at least 3 days'} · last updated {dateLabel(item.updated_at)}.</p></div></div>)}
              {suggested.length > 0 && <div className="overview-insight"><span className="insight-mark priority-mark"><Zap size={15} /></span><div><strong>Suggested priority · {suggested[0].id}</strong><p>{priorityNames[suggested[0].priority]} priority, {Math.max(0, Math.floor((Date.now() - new Date(suggested[0].updated_at).getTime()) / 86400000))} days since update. Review urgency and case evidence.</p></div></div>}
              {recurringIssues.length === 0 && bottlenecks.length === 0 && suggested.length === 0 && <p className="overview-empty-copy">No repeated issues or overdue cases are visible in the current records.</p>}
            </div>}
          </section>
          <section className="overview-support-card">
            <div className="overview-support-heading"><span className="support-icon activity-icon"><Activity size={17} /></span><div><h2>Recent Activity</h2><p>Recent updates from user-entered repair cases.</p></div></div>
            {recentActivity.length ? <div className="overview-activity-list">{recentActivity.map((item) => {
              const created = Math.abs(new Date(item.updated_at).getTime() - new Date(item.created_at).getTime()) < 1000
              return <button key={item.id} className="overview-activity-row" onClick={() => onOpen(item.id, 'diagnostics')}><span className="activity-dot" /><span className="activity-copy"><strong>{created ? 'Repair case created' : 'Repair case updated'} · {item.id}</strong><small>{item.brand} {item.model} · {statusNames[item.status]}</small></span><time>{dateTimeLabel(item.updated_at)}</time></button>
            })}</div> : <p className="overview-empty-copy">No repair activity is available yet.</p>}
          </section>
        </div>
      </div>
    </div>
  )
}

const OVERVIEW_TEST_POINTS = [
  {
    id: 'tp-soc',
    code: 'TP-102',
    label: 'SOC / CONTROLLER',
    status: 'REFERENCE POINT',
    color: '#42d9ad',
    right: '34.7%',
    top: '52.8%',
    period: '1.8s',
  },
  {
    id: 'tp-vrm',
    code: 'TP-208',
    label: 'VRM / MOSFET RAIL',
    status: 'REFERENCE POINT',
    color: '#f59e0b',
    right: '17.6%',
    top: '60.4%',
    period: '2.4s',
  },
  {
    id: 'tp-dram',
    code: 'TP-314',
    label: 'LPDDR5 BUS CLOCK',
    status: 'REFERENCE POINT',
    color: '#38bdf8',
    right: '23.8%',
    top: '34.0%',
    period: '1.4s',
  },
  {
    id: 'tp-pd',
    code: 'TP-409',
    label: 'TYPE-C POWER DELIVERY',
    status: 'REFERENCE POINT',
    color: '#10b981',
    right: '11.9%',
    top: '76.4%',
    period: '2.1s',
  },
  {
    id: 'tp-gnd',
    code: 'TP-001',
    label: 'CHASSIS GROUND PAD',
    status: 'REFERENCE POINT',
    color: '#6ee7b7',
    right: '87.2%',
    top: '89.2%',
    period: '3.0s',
  },
]

function OverviewCircuitMapOverlay({ animated }: { animated: boolean }) {
  return (
    <svg
      className="overview-circuit-svg"
      viewBox="0 0 1024 576"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ovPulseGrad" x1="1" y1="0.5" x2="0" y2="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#43dfb9" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#1bb790" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Base Circuit Tracks extending from motherboard chips across the negative space */}
      <path className="ov-circuit-base" d="M 669 304 L 580 304 L 520 220 L 460 220 L 380 220" />
      <path className="ov-circuit-base" d="M 669 304 L 560 340 L 490 340 L 440 370 L 380 370" />
      <path className="ov-circuit-base" d="M 844 348 L 740 400 L 610 440 L 490 440 L 410 440" />
      <path className="ov-circuit-base" d="M 780 196 L 680 150 L 540 150 L 430 150 L 360 150" />
      <path className="ov-circuit-base" d="M 410 440 L 320 480 L 220 480 L 131 514" />
      <path className="ov-circuit-base" d="M 220 480 L 130 430 L 59 430" />
      <path className="ov-circuit-base" d="M 460 220 L 440 220 L 440 370 L 460 370" />

      {/* Active Glowing Pulses flowing along tracks into the HUD */}
      {animated && (
        <g className="ov-pulses-group">
          <path className="ov-circuit-pulse ov-flow-1" d="M 669 304 L 580 304 L 520 220 L 460 220 L 380 220" />
          <path className="ov-circuit-pulse ov-flow-2" d="M 669 304 L 560 340 L 490 340 L 440 370 L 380 370" />
          <path className="ov-circuit-pulse ov-flow-3" d="M 844 348 L 740 400 L 610 440 L 490 440 L 410 440" />
          <path className="ov-circuit-pulse ov-flow-4" d="M 780 196 L 680 150 L 540 150 L 430 150 L 360 150" />
          <path className="ov-circuit-pulse ov-flow-5" d="M 410 440 L 320 480 L 220 480 L 131 514" />
          <path className="ov-circuit-pulse ov-flow-6" d="M 220 480 L 130 430 L 59 430" />
        </g>
      )}

      {/* Micro junction pads */}
      <circle className="ov-circuit-node" cx="669" cy="304" r="3" />
      <circle className="ov-circuit-node" cx="520" cy="220" r="3" />
      <circle className="ov-circuit-node" cx="440" cy="370" r="3" />
      <circle className="ov-circuit-node" cx="490" cy="440" r="3" />
      <circle className="ov-circuit-node" cx="131" cy="514" r="3.5" />
      <circle className="ov-circuit-node" cx="59" cy="430" r="3" />
    </svg>
  )
}

function OverviewFanOverlay({ animated }: { animated: boolean }) {
  return (
    <div className="overview-fan-anchor" aria-hidden="true">
      {animated && (
        <>
          <div className="overview-fan-ripple ov-ripple-1" />
          <div className="overview-fan-ripple ov-ripple-2" />
        </>
      )}
      <div className={`overview-fan-rotor ${animated ? 'spinning' : ''}`}>
        <span className="fan-blade fb-1" />
        <span className="fan-blade fb-2" />
        <span className="fan-blade fb-3" />
        <span className="fan-blade fb-4" />
        <span className="fan-blade fb-5" />
        <span className="fan-blade fb-6" />
      </div>
      <div className="overview-fan-hub">
        <span className={`fan-hub-led ${animated ? 'active' : ''}`} />
      </div>
      <div className="overview-fan-telemetry">
        <span className="fan-telemetry-pill">
          <span className="fan-telemetry-dot" />
          FAN ASSEMBLY REFERENCE
        </span>
      </div>
    </div>
  )
}

const QUEUE_TEST_POINTS = [
  {
    id: 'q-cam',
    code: 'CAM-01',
    label: 'IMAGE SENSOR / DUAL OIS',
    status: 'REFERENCE VIEW',
    color: '#38bdf8',
    right: '15.0%',
    top: '57.3%',
    period: '2.0s',
  },
  {
    id: 'q-pmic',
    code: 'PMIC-1',
    label: 'POWER MANAGEMENT IC',
    status: 'REFERENCE VIEW',
    color: '#42d9ad',
    right: '9.6%',
    top: '52.1%',
    period: '1.7s',
  },
  {
    id: 'q-ap',
    code: 'SOC-A16',
    label: 'APPLICATION PROCESSOR',
    status: 'REFERENCE VIEW',
    color: '#f59e0b',
    right: '5.5%',
    top: '56.4%',
    period: '2.3s',
  },
  {
    id: 'q-batt',
    code: 'BATT-0',
    label: 'LI-ION CELL TELEMETRY',
    status: 'REFERENCE VIEW',
    color: '#10b981',
    right: '4.5%',
    top: '68.1%',
    period: '1.9s',
  },
  {
    id: 'q-tray',
    code: 'TRAY-BIT',
    label: 'TORX / PENTALOBE ARRAY',
    status: 'TORX T2/T3/T4 STAGED',
    color: '#a78bfa',
    right: '13.7%',
    top: '30.9%',
    period: '2.8s',
  },
  {
    id: 'q-ground',
    code: 'GND-ESD',
    label: 'ESD WORK MAT DISSIPATION',
    status: '10^6 OHM SAFE',
    color: '#2dd4bf',
    right: '10.4%',
    top: '84.2%',
    period: '2.5s',
  },
]

function QueueCircuitMapOverlay({ animated }: { animated: boolean }) {
  return (
    <svg
      className="queue-circuit-svg"
      viewBox="0 0 1024 576"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="qPulseGrad" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Top-left circuit traces following physical desk markings */}
      <path className="q-circuit-base" d="M 0 70 L 60 70 L 90 90 L 120 50 L 170 0" />
      <path className="q-circuit-base" d="M 0 140 L 70 140 L 110 60 L 150 20 L 190 0" />

      {/* Bottom-left circuit traces flowing toward the queue HUD */}
      <path className="q-circuit-base" d="M 0 350 L 80 430 L 180 430 L 250 490 L 320 490" />
      <path className="q-circuit-base" d="M 0 410 L 60 470 L 140 470 L 200 520 L 280 520" />
      <path className="q-circuit-base" d="M 0 460 L 50 510 L 120 510 L 170 560 L 230 560" />
      <path className="q-circuit-base" d="M 320 490 L 420 490 L 480 440 L 540 440" />

      {/* Active Glowing Pulses */}
      {animated && (
        <g className="q-pulses-group">
          <path className="q-circuit-pulse q-flow-1" d="M 0 70 L 60 70 L 90 90 L 120 50 L 170 0" />
          <path className="q-circuit-pulse q-flow-2" d="M 0 140 L 70 140 L 110 60 L 150 20 L 190 0" />
          <path className="q-circuit-pulse q-flow-3" d="M 0 350 L 80 430 L 180 430 L 250 490 L 320 490" />
          <path className="q-circuit-pulse q-flow-4" d="M 0 410 L 60 470 L 140 470 L 200 520 L 280 520" />
          <path className="q-circuit-pulse q-flow-5" d="M 320 490 L 420 490 L 480 440 L 540 440" />
        </g>
      )}

      {/* Junction solder pads */}
      <circle className="q-circuit-node" cx="60" cy="70" r="3" />
      <circle className="q-circuit-node" cx="90" cy="90" r="3" />
      <circle className="q-circuit-node" cx="120" cy="50" r="3" />
      <circle className="q-circuit-node" cx="70" cy="140" r="3" />
      <circle className="q-circuit-node" cx="110" cy="60" r="3" />
      <circle className="q-circuit-node" cx="80" cy="430" r="3" />
      <circle className="q-circuit-node" cx="180" cy="430" r="3" />
      <circle className="q-circuit-node" cx="250" cy="490" r="3" />
      <circle className="q-circuit-node" cx="320" cy="490" r="3.5" />
      <circle className="q-circuit-node" cx="480" cy="440" r="3" />
      <circle className="q-circuit-node" cx="540" cy="440" r="3" />
    </svg>
  )
}

function QueueCameraFocusOverlay({ animated }: { animated: boolean }) {
  return (
    <div className="queue-camera-anchor" aria-hidden="true">
      {animated && (
        <>
          <div className="camera-focus-ring ring-1" />
          <div className="camera-focus-ring ring-2" />
        </>
      )}
      <div className={`camera-reticle-crosshair ${animated ? 'pulsing' : ''}`}>
        <span className="reticle-line h" />
        <span className="reticle-line v" />
        <span className="reticle-dot" />
      </div>
      <div className="camera-telemetry-tag">
        <span className="camera-telemetry-dot" />
        <span>CAMERA ASSEMBLY // REFERENCE VIEW</span>
      </div>
    </div>
  )
}

function CasesPage({
  cases,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  onNew,
  onOpen,
  onStatus,
  onDelete,
  settings,
}: {
  cases: RepairCase[]
  query: string
  setQuery: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  priorityFilter: string
  setPriorityFilter: (value: string) => void
  onNew: () => void
  onOpen: (id: string, tab?: NavId) => void
  onStatus: (id: string, status: CaseStatus) => void
  onDelete: (id: string, brand: string, model: string) => void
  settings: AppSettings
}) {
  const animated = settings?.animationsEnabled ?? true

  return (
    <div className="queue-fullscreen-layout">
      {/* Pristine Repair Queue Hardware Background Layer */}
      <div className="queue-bg-layer" />

      {/* Atmospheric negative space daylight wash for crystal-clear readability */}
      <div className="queue-ambient-mask" aria-hidden="true" />

      {/* Animated Circuit Streams aligned with printed desk markings */}
      <QueueCircuitMapOverlay animated={animated} />

      {/* Sweeping Optical Laser Scanner Line over Smartphone & Work Mat */}
      {animated && (
        <div className="queue-laser-scanner" aria-hidden="true" />
      )}

      {/* Smartphone Dual Camera Optical Focus Reticle */}
      <QueueCameraFocusOverlay animated={animated} />

      {/* SMD Diagnostic Micro-LEDs on physical board test points */}
      <div className="queue-probes-layer" aria-hidden="true">
        {QUEUE_TEST_POINTS.map((tp) => (
          <div
            key={tp.id}
            className="queue-smd-probe"
            style={{ right: tp.right, top: tp.top }}
          >
            <span
              className={`probe-led ${animated ? 'pulsing' : ''}`}
              style={{ backgroundColor: tp.color, boxShadow: `0 0 8px ${tp.color}` }}
            />
            {animated && (
              <span
                className="probe-ping"
                style={{ borderColor: tp.color, animationDuration: tp.period }}
              />
            )}
            <div className="probe-tooltip">
              <span className="probe-code">{tp.code}</span>
              <span className="probe-desc">{tp.label}</span>
              <span className="probe-val" style={{ color: tp.color }}>{tp.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Minimalist Floating Glass HUD Container in Negative Space */}
      <div className="queue-negative-hud">
        <div className="queue-hud-header">
          <div className="queue-telemetry-chip">
            <span className="queue-telemetry-dot" />
            <span>REPAIR QUEUE // ACTIVE CASES</span>
          </div>
          <div className="queue-header-row">
            <div className="queue-title-wrap">
              <h1 className="queue-title">Repair queue</h1>
              <span className="queue-count-badge">
                {cases.length} {cases.length === 1 ? 'DEVICE' : 'DEVICES'}
              </span>
            </div>
            <button className="button button-primary queue-new-btn" onClick={onNew}>
              <Plus size={15} /> Create repair case
            </button>
          </div>
        </div>

        {/* Translucent Glass Queue Card */}
        <div className="surface-card queue-card queue-glass-card">
          <div className="queue-toolbar">
            <div className="search-box">
              <Search size={15} />
              <input
                aria-label="Search repair queue"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by case ID, brand, model, or issue…"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="filter-controls">
              <label className="filter-select">
                <Filter size={14} />
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All active</option>
                  <option value="new">New</option>
                  <option value="diagnosing">Diagnosing</option>
                  <option value="waiting_parts">Waiting for parts</option>
                  <option value="in_repair">In repair</option>
                  <option value="testing">Testing</option>
                  <option value="on_hold">On hold</option>
                  <option value="pending">Pending repairs</option>
                  <option value="in_progress">In progress</option>
                  <option value="awaiting_diagnosis">Awaiting diagnosis</option>
                  <option value="evidence_to_review">Evidence to review</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="filter-select">
                <select
                  aria-label="Filter by priority"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>

          {cases.length ? (
            <div className="queue-table-wrap">
              <table className="data-table queue-table">
                <thead>
                  <tr>
                    <th>DEVICE</th>
                    <th>ISSUE</th>
                    <th>STATUS</th>
                    <th>PRIORITY</th>
                    <th>CUSTOMER CONTACT</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((item) => (
                    <tr key={item.id} className="clickable-row" onClick={() => onOpen(item.id)}>
                      <td>
                        <div className="repair-id-cell">
                          <div className="device-avatar">{deviceInitials(item.device_category)}</div>
                          <div>
                            <strong>{item.id}</strong>
                            <span>{item.brand} {item.model}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="issue-cell">
                          <strong>{item.issue_title}</strong>
                          <span className="issue-snippet">{item.symptoms}</span>
                        </div>
                      </td>
                      <td>
                        <div className="status-cell">
                          <StatusPill status={item.status} />
                          <select
                            className="status-edit-select"
                            aria-label={`Change status for ${item.id}`}
                            value={item.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onStatus(item.id, e.target.value as CaseStatus)}
                          >
                            <option value="new">New</option>
                            <option value="diagnosing">Diagnosing</option>
                            <option value="waiting_parts">Waiting for parts</option>
                            <option value="in_repair">In repair</option>
                            <option value="testing">Testing</option>
                            <option value="completed">Completed</option>
                            <option value="on_hold">On hold</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <PriorityPill priority={item.priority} />
                      </td>
                      <td>
                        <div className="contact-cell">
                          {item.customer_contact ? (
                            <span><Phone size={12} /> {item.customer_contact}</span>
                          ) : (
                            <span className="label-muted">—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="row-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="row-delete-btn"
                            title="Delete repair case"
                            onClick={() => onDelete(item.id, item.brand, item.model)}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            className="row-open-button"
                            aria-label={`Open ${item.id}`}
                            onClick={() => onOpen(item.id)}
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="No active repair cases"
              description="No active cases match the current filters."
            />
          )}
        </div>
      </div>
    </div>
  )
}

const DIAGNOSTICS_TEST_POINTS = [
  {
    id: 'd-holo',
    code: 'HOLO-01',
    label: 'EXPLODED ASSEMBLY HUD',
    status: 'REFERENCE VIEW',
    color: '#38bdf8',
    right: '23.3%',
    top: '33.0%',
    period: '2.0s',
  },
  {
    id: 'd-wave',
    code: 'SIG-GEN',
    label: 'FREQUENCY ANALYZER',
    status: 'SIGNAL REFERENCE',
    color: '#2dd4bf',
    right: '6.2%',
    top: '18.2%',
    period: '1.6s',
  },
  {
    id: 'd-cam',
    code: 'CAM-ARRAY',
    label: 'TRIPLE OPTICAL SENSOR',
    status: 'SENSOR REFERENCE',
    color: '#38bdf8',
    right: '26.8%',
    top: '73.8%',
    period: '2.4s',
  },
  {
    id: 'd-soc',
    code: 'AP-SoC',
    label: 'LOGIC BOARD PROCESSOR',
    status: 'BOARD REFERENCE',
    color: '#f59e0b',
    right: '16.0%',
    top: '69.4%',
    period: '1.8s',
  },
  {
    id: 'd-batt',
    code: 'BATT-TERM',
    label: 'BATTERY CHARGE RAIL',
    status: 'BATTERY REFERENCE',
    color: '#10b981',
    right: '8.0%',
    top: '75.0%',
    period: '2.2s',
  },
  {
    id: 'd-tool',
    code: 'PROBE-ESD',
    label: 'TORX T3 PRECISION DRIVER',
    status: 'MAGNETIC TIP ARMED',
    color: '#a78bfa',
    right: '19.9%',
    top: '85.1%',
    period: '2.8s',
  },
]

function DiagnosticsCircuitMapOverlay({ animated }: { animated: boolean }) {
  return (
    <svg
      className="diagnostics-circuit-svg"
      viewBox="0 0 1024 576"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="diagPulseGrad" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Desk printed cyan tracks */}
      <path className="d-circuit-base" d="M 0 42 L 50 42 L 90 80 L 140 42" />
      <path className="d-circuit-base" d="M 0 305 L 60 305 L 90 325 L 125 305" />
      <path className="d-circuit-base" d="M 0 545 L 310 545 L 430 495 L 495 495 L 586 434 L 680 434" />

      {/* Active Glowing Pulses */}
      {animated && (
        <g className="d-pulses-group">
          <path className="d-circuit-pulse d-flow-1" d="M 0 42 L 50 42 L 90 80 L 140 42" />
          <path className="d-circuit-pulse d-flow-2" d="M 0 305 L 60 305 L 90 325 L 125 305" />
          <path className="d-circuit-pulse d-flow-3" d="M 0 545 L 310 545 L 430 495 L 495 495 L 586 434 L 680 434" />
        </g>
      )}

      {/* Junction pads at exact photo node positions */}
      <circle className="d-circuit-node" cx="140" cy="42" r="3.5" />
      <circle className="d-circuit-node" cx="125" cy="305" r="3.5" />
      <circle className="d-circuit-node" cx="495" cy="495" r="3.5" />
      <circle className="d-circuit-node" cx="586" cy="434" r="3.5" />
    </svg>
  )
}

function DiagnosticsHoloOverlay({ animated }: { animated: boolean }) {
  return (
    <div className="diagnostics-holo-anchor" aria-hidden="true">
      {animated && (
        <>
          <div className="holo-reticle-bracket tl" />
          <div className="holo-reticle-bracket tr" />
          <div className="holo-reticle-bracket bl" />
          <div className="holo-reticle-bracket br" />
          <div className="holo-scanbeam" />
        </>
      )}
      <div className="holo-telemetry-tag">
        <span className="holo-tag-dot" />
        <span>COMPONENT VIEW // DIAGNOSTIC REFERENCE</span>
      </div>
    </div>
  )
}

function DiagnosticsWaveformOverlay({ animated }: { animated: boolean }) {
  return (
    <div className="diagnostics-waveform-anchor" aria-hidden="true">
      {animated && <div className="waveform-signal-pulse" />}
      <div className="waveform-telemetry-pill">
        <span className="waveform-dot" />
        <span>SIGNAL ANALYZER // REFERENCE</span>
      </div>
    </div>
  )
}

function DiagnosticsPage({
  selected,
  cases,
  diagnosticsTab,
  setDiagnosticsTab,
  recommendation,
  health,
  stale,
  generating,
  recordingTest,
  recordingComponent,
  recordingComponentTest,
  recordingOutcome,
  testForm,
  setTestForm,
  outcomeForm,
  setOutcomeForm,
  onSelect,
  onAddTest,
  onAddComponent,
  onAddComponentTest,
  onGenerate,
  onSaveOutcome,
  onDelete,
  onOpenCase,
  settings,
}: {
  selected: CaseDetail | null
  cases: RepairCase[]
  diagnosticsTab: 'evidence' | 'recommendation'
  setDiagnosticsTab: (tab: 'evidence' | 'recommendation') => void
  recommendation: Recommendation | null
  health: Health | null
  stale: boolean
  generating: boolean
  recordingTest: boolean
  recordingComponent: boolean
  recordingComponentTest: number | null
  recordingOutcome: boolean
  testForm: { test_name: string; result: TestStatus; observed_result: string; details: string }
  setTestForm: Dispatch<SetStateAction<{ test_name: string; result: TestStatus; observed_result: string; details: string }>>
  outcomeForm: { confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' }
  setOutcomeForm: Dispatch<SetStateAction<{ confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' }>>
  onSelect: (id: string) => void
  onAddTest: (event: FormEvent<HTMLFormElement>) => void
  onAddComponent: (data: { component_name: string; model_part_number?: string }) => Promise<boolean>
  onAddComponentTest: (componentId: number, data: { test_name: string; result: ComponentTestStatus; observed_result: string; details: string }) => Promise<boolean>
  onGenerate: () => void
  onSaveOutcome: (event: FormEvent<HTMLFormElement>) => void
  onDelete: (id: string, brand: string, model: string) => void
  onOpenCase: (id: string, tab?: NavId) => void
  settings?: AppSettings
}) {
  const animated = settings?.animationsEnabled ?? true
  const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(null)
  const reportPrintStarted = useRef(false)

  useEffect(() => {
    if (!reportGeneratedAt || reportPrintStarted.current) return
    reportPrintStarted.current = true
    window.print()
  }, [reportGeneratedAt])
  useEffect(() => {
    setReportGeneratedAt(null)
    reportPrintStarted.current = false
  }, [selected?.id])

  return (
    <div className="diagnostics-fullscreen-layout">
      {/* Pristine Diagnostics Hardware Background Layer */}
      <div className="diagnostics-bg-layer" />

      {/* Atmospheric daylight wash for contrast */}
      <div className="diagnostics-ambient-mask" aria-hidden="true" />

      {/* Desk printed cyan tracks with active light streams */}
      <DiagnosticsCircuitMapOverlay animated={animated} />

      {/* Holographic exploded view reticle and scanbeam */}
      <DiagnosticsHoloOverlay animated={animated} />

      {/* Frequency / Oscilloscope Waveform Monitor */}
      <DiagnosticsWaveformOverlay animated={animated} />

      {/* Optical Laser Scanner Line */}
      {animated && <div className="diagnostics-laser-scanner" aria-hidden="true" />}

      {/* SMD Diagnostic Micro-LEDs on physical board test points */}
      <div className="diagnostics-probes-layer" aria-hidden="true">
        {DIAGNOSTICS_TEST_POINTS.map((tp) => (
          <div
            key={tp.id}
            className="diagnostics-smd-probe"
            style={{ right: tp.right, top: tp.top }}
          >
            <span
              className={`probe-led ${animated ? 'pulsing' : ''}`}
              style={{ backgroundColor: tp.color, boxShadow: `0 0 8px ${tp.color}` }}
            />
            {animated && (
              <span
                className="probe-ping"
                style={{ borderColor: tp.color, animationDuration: tp.period }}
              />
            )}
            <div className="probe-tooltip">
              <span className="probe-code">{tp.code}</span>
              <span className="probe-desc">{tp.label}</span>
              <span className="probe-val" style={{ color: tp.color }}>{tp.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Minimalist Floating Glass HUD Container taking 70% width */}
      <div className="diagnostics-negative-hud">
        <div className="diagnostics-hud-header">
          <div className="diagnostics-telemetry-chip">
            <span className="diagnostics-telemetry-dot" />
            <span>DIAGNOSTICS // REPAIR CASE WORKSPACE</span>
          </div>
          <div className="diagnostics-header-row">
            <h1 className="diagnostics-title">Diagnostics</h1>
            {selected && (
              <span className="diagnostics-device-chip">
                {selected.id} · {selected.brand} {selected.model}
              </span>
            )}
          </div>
        </div>

      <div className="diagnostic-select-bar">
        <div className="select-case-mark"><Stethoscope size={16} /></div>
        <label className="case-picker">
          <span className="sr-only">Select a repair case</span>
          <select value={selected?.id || ''} onChange={(e) => onSelect(e.target.value)}>
            <option value="" disabled>Select a repair case</option>
            {cases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.brand} {item.model} — {item.issue_title}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        {selected && <StatusPill status={selected.status} />}
        {selected && (
          <button
            className="button button-ghost-danger button-sm"
            onClick={() => onDelete(selected.id, selected.brand, selected.model)}
          >
            <Trash2 size={14} /> Delete case
          </button>
        )}
      </div>

      <div className="diagnostics-subnav">
        <button
          className={`diagnostics-tab-btn ${diagnosticsTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setDiagnosticsTab('evidence')}
        >
          <Activity size={15} />
          Diagnostic evidence & outcome
        </button>
        <button
          className={`diagnostics-tab-btn ${diagnosticsTab === 'recommendation' ? 'active' : ''}`}
          onClick={() => setDiagnosticsTab('recommendation')}
        >
          <Sparkles size={15} />
          AI diagnostic recommendation
          {recommendation && <span className="tab-indicator-dot" />}
        </button>
      </div>

      {!selected ? (
        <div className="surface-card">
          <EmptyState
            icon={Stethoscope}
            title="Select a repair case"
            description="Choose a case above to review its symptoms, test evidence, and recommendations."
          />
        </div>
      ) : (
        <>
          {diagnosticsTab === 'evidence' && (
            <div className="diagnostics-subpage-evidence">
              <section className="surface-card case-overview-card">
                <div className="case-overview-top">
                  <div className="case-device-icon"><Smartphone size={20} /></div>
                  <div className="case-overview-id">
                    <div className="eyebrow-row">
                      <span className="eyebrow">{selected.id}</span>
                      <PriorityPill priority={selected.priority} />
                    </div>
                    <h2>{selected.issue_title}</h2>
                    <p>{selected.brand} {selected.model} · {selected.device_category}</p>
                  </div>
                  <div className="case-overview-status">
                    <StatusPill status={selected.status} />
                    <button className="button button-ghost button-sm report-action" onClick={() => { reportPrintStarted.current = false; setReportGeneratedAt(new Date().toISOString()) }}>
                      <Printer size={14} /> Generate repair report
                    </button>
                  </div>
                </div>
                <div className="case-symptoms">
                  <span className="meta-label">REPORTED SYMPTOMS</span>
                  <p>{selected.symptoms}</p>
                </div>
                <div className="case-overview-foot">
                  <span><Clock3 size={13} /> {dateLabel(selected.created_at)}</span>
                  {selected.customer_contact && (
                    <span><Phone size={13} /> {selected.customer_contact}</span>
                  )}
                  <span><Activity size={13} /> {selected.tests.length} tests</span>
                </div>
              </section>

              <ComponentHealthPanel
                key={selected.id}
                caseId={selected.id}
                components={selected.components}
                closed={selected.status === 'completed' || selected.status === 'on_hold'}
                recordingComponent={recordingComponent}
                recordingComponentTest={recordingComponentTest}
                onAddComponent={onAddComponent}
                onAddComponentTest={onAddComponentTest}
              />

              {selected.data_origin === 'demo' && <div className="demo-record-note">Demo record · The timeline and alerts below use sample data.</div>}
              <SafetyAlertsPanel alerts={selected.safety_alerts} />

              <section className="surface-card evidence-card">
                <div className="section-card-head">
                  <div>
                    <h3>Diagnostic test evidence</h3>
                  </div>
                  <span className="section-count">{selected.tests.length} RESULTS</span>
                </div>

                {selected.tests.length ? (
                  <div className="evidence-list">
                    {selected.tests.map((test) => (
                      <div className="evidence-item" key={test.id}>
                        <div className={`evidence-result-icon result-${test.result}`}>
                          {test.result === 'pass' ? <Check size={14} /> : test.result === 'fail' ? <X size={14} /> : <CircleHelp size={14} />}
                        </div>
                        <div className="evidence-copy">
                          <div className="evidence-heading">
                            <strong>{test.test_name}</strong>
                            <span className={`result-tag result-tag-${test.result}`}>
                              {titleCase(test.result.replaceAll('_', ' '))}
                            </span>
                          </div>
                          <p>{test.observed_result}</p>
                          {test.details && <small>{test.details}</small>}
                          <span className="evidence-time">{dateTimeLabel(test.performed_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inline-empty">
                    <CircleHelp size={16} />
                    <span>No diagnostic tests recorded yet. Add the first test below.</span>
                  </div>
                )}

                {selected.status === 'completed' ? (
                  <div className="read-only-note">
                    This case is completed. Reopen to record more tests.
                  </div>
                ) : (
                  <form className="add-test-form" onSubmit={onAddTest}>
                    <div className="form-section-label">RECORD A DIAGNOSTIC TEST</div>
                    <div className="form-grid two-cols">
                      <label className="span-two">Test
                        <select value={testForm.test_name} onChange={(e) => setTestForm((v) => ({ ...v, test_name: e.target.value }))}>
                          {testSuggestions.map((item) => <option key={item}>{item}</option>)}
                        </select>
                      </label>
                      <label>Result
                        <select value={testForm.result} onChange={(e) => setTestForm((v) => ({ ...v, result: e.target.value as TestStatus }))}>
                          {testOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label>Observation
                        <textarea required rows={2} value={testForm.observed_result} onChange={(e) => setTestForm((v) => ({ ...v, observed_result: e.target.value }))} placeholder="Describe the observed result" />
                      </label>
                      <label className="span-two">Notes <span className="label-muted">(optional)</span>
                        <input value={testForm.details} onChange={(e) => setTestForm((v) => ({ ...v, details: e.target.value }))} placeholder="Conditions or additional context" />
                      </label>
                    </div>
                    <div className="form-footer">
                      <button className="button button-dark" type="submit" disabled={recordingTest}>
                        {recordingTest ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} Save test result
                      </button>
                    </div>
                  </form>
                )}
              </section>

              <TimelineCard events={selected.timeline} isDemo={selected.data_origin === 'demo'} />
              <SimilarRepairMemory matches={selected.similar_cases} onOpen={(id) => onOpenCase(id, 'diagnostics')} />

              <section className="surface-card outcome-card">
                <div className="section-card-head">
                  <div>
                    <h3>Repair outcome</h3>
                  </div>
                </div>
                <form onSubmit={onSaveOutcome} className="outcome-form">
                  <label>Confirmed fault
                    <input required minLength={3} value={outcomeForm.confirmed_fault} onChange={(e) => setOutcomeForm((v) => ({ ...v, confirmed_fault: e.target.value }))} placeholder="Enter the confirmed fault" />
                  </label>
                  <label>Repair action taken
                    <textarea required minLength={3} rows={2} value={outcomeForm.repair_action} onChange={(e) => setOutcomeForm((v) => ({ ...v, repair_action: e.target.value }))} placeholder="Describe what was repaired or replaced" />
                  </label>
                  <label>Verification outcome
                    <textarea required minLength={3} rows={2} value={outcomeForm.outcome} onChange={(e) => setOutcomeForm((v) => ({ ...v, outcome: e.target.value }))} placeholder="Record the final verification result" />
                  </label>
                  <div className="outcome-actions">
                    <label className="outcome-status-label">Set status
                      <select value={outcomeForm.status} onChange={(e) => setOutcomeForm((v) => ({ ...v, status: e.target.value as 'testing' | 'completed' | 'in_repair' }))}>
                        <option value="testing">Testing</option>
                        <option value="in_repair">In repair</option>
                        <option value="completed">Completed</option>
                      </select>
                    </label>
                    <button className="button button-primary" type="submit" disabled={recordingOutcome}>
                      {recordingOutcome ? <LoaderCircle size={15} className="spin" /> : <CheckCircle2 size={15} />} Save repair outcome
                    </button>
                  </div>
                </form>
              </section>

              <RepairReportPrint
                detail={selected}
                recommendation={recommendation?.case_id === selected.id ? recommendation : null}
                alerts={selected.safety_alerts}
                generatedAt={reportGeneratedAt}
                stale={stale}
              />
            </div>
          )}

          {diagnosticsTab === 'recommendation' && (
            <div className="diagnostics-subpage-ai">
              <section className="surface-card ai-clean-copilot">
                <div className="ai-panel-header">
                  <div className="ai-panel-icon"><Sparkles size={18} /></div>
                  <div>
                    <h3>AI diagnostic recommendation</h3>
                    <p className="ai-model-tag">
                      {health?.model_configured ? `${health.model_name} (Gemini API)` : 'Local rule-based guidance'}
                    </p>
                  </div>
                  <button
                    className="button button-ai button-compact"
                    onClick={onGenerate}
                    disabled={generating || selected.status === 'completed'}
                  >
                      {generating ? (
                      <><LoaderCircle size={15} className="spin" /> Generating…</>
                    ) : (
                      <><Sparkles size={15} /> {recommendation ? 'Refresh recommendation' : 'Generate recommendation'}</>
                    )}
                  </button>
                </div>
              </section>

              {recommendation ? (
                <RecommendationView recommendation={recommendation} stale={stale} tests={selected.tests} />
              ) : (
                <section className="surface-card waiting-panel-clean">
                  <BrainCircuit size={28} className="muted-icon" />
                  <h3>No recommendation generated</h3>
                  <p>Generate a recommendation to review suggested checks based on this repair case and its saved diagnostic evidence.</p>
                </section>
              )}

            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}

function ComponentHealthPanel({
  caseId,
  components,
  closed,
  recordingComponent,
  recordingComponentTest,
  onAddComponent,
  onAddComponentTest,
}: {
  caseId: string
  components: ComponentRecord[]
  closed: boolean
  recordingComponent: boolean
  recordingComponentTest: number | null
  onAddComponent: (data: { component_name: string; model_part_number?: string }) => Promise<boolean>
  onAddComponentTest: (componentId: number, data: { test_name: string; result: ComponentTestStatus; observed_result: string; details: string }) => Promise<boolean>
}) {
  const [componentName, setComponentName] = useState('')
  const [partNumber, setPartNumber] = useState('')

  async function submitComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = componentName.trim()
    if (!name) return
    const saved = await onAddComponent({ component_name: name, model_part_number: partNumber.trim() || undefined })
    if (saved) {
      setComponentName('')
      setPartNumber('')
    }
  }

  return (
    <section className="surface-card component-health-panel">
      <div className="section-card-head">
        <div><h3>Component health status</h3><p>Health reflects the latest saved component test and its scope. Components without test evidence remain Unknown.</p></div>
        <span className="section-count">{components.length} COMPONENTS</span>
      </div>
      {components.length ? (
        <div className="component-health-list">
          {components.map((component) => (
            <ComponentHealthCard
              key={component.id}
              component={component}
              closed={closed}
              saving={recordingComponentTest === component.id}
              onAddTest={(data) => onAddComponentTest(component.id, data)}
            />
          ))}
        </div>
      ) : (
        <div className="inline-empty component-health-empty"><Cpu size={16} /><span>No components are recorded for this repair yet. New components remain Unknown until test evidence is saved.</span></div>
      )}
      {closed ? (
        <div className="read-only-note">This case is completed or on hold. Update its status before adding components or tests.</div>
      ) : (
        <form className="component-create-form" onSubmit={submitComponent}>
          <div className="form-section-label">ADD COMPONENT</div>
          <div className="component-create-grid">
            <label>Component name
              <input required maxLength={160} value={componentName} onChange={(event) => setComponentName(event.target.value)} placeholder="e.g. Charging port" />
            </label>
            <label>Model / part number <span className="label-muted">(optional)</span>
              <input maxLength={160} value={partNumber} onChange={(event) => setPartNumber(event.target.value)} placeholder="Enter the marked part number, if known" />
            </label>
          </div>
          <div className="form-footer">
            <button className="button button-dark" type="submit" disabled={recordingComponent || !componentName.trim()}>
              {recordingComponent ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} Add component
            </button>
          </div>
          <p className="component-health-note">Health status reflects the latest recorded component test. It does not guarantee performance beyond the test conditions.</p>
        </form>
      )}
      <span className="sr-only">Repair case {caseId}</span>
    </section>
  )
}

function ComponentHealthCard({ component, closed, saving, onAddTest }: {
  component: ComponentRecord
  closed: boolean
  saving: boolean
  onAddTest: (data: { test_name: string; result: ComponentTestStatus; observed_result: string; details: string }) => Promise<boolean>
}) {
  const [testName, setTestName] = useState('')
  const [result, setResult] = useState<ComponentTestStatus>('inconclusive')
  const [observation, setObservation] = useState('')
  const [details, setDetails] = useState('')

  async function submitTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!testName.trim() || !observation.trim()) return
    const saved = await onAddTest({ test_name: testName.trim(), result, observed_result: observation.trim(), details: details.trim() })
    if (saved) {
      setTestName('')
      setObservation('')
      setDetails('')
      setResult('inconclusive')
    }
  }

  const statusLabel: Record<ComponentRecord['health_status'], string> = {
    working: 'Working', faulty: 'Faulty', needs_testing: 'Needs testing', unknown: 'Unknown',
  }

  return (
    <article className="component-health-item">
      <div className="component-health-heading">
        <div className="component-health-icon"><Cpu size={16} /></div>
        <div className="component-health-title"><strong>{component.component_name}</strong><small>{component.model_part_number || 'Part number not recorded'}</small></div>
        <span className={`component-health-status status-${component.health_status}`}>{statusLabel[component.health_status]}</span>
      </div>
      {component.tests.length ? (
        <ol className="component-test-history">
          {component.tests.map((test) => (
            <li key={test.id}>
              <div className="component-test-heading"><strong>{test.test_name}</strong><span className={`result-tag result-tag-${test.result}`}>{titleCase(test.result.replaceAll('_', ' '))}</span></div>
              <p>{test.observed_result}</p>
              {test.details && <small>{test.details}</small>}
              <time>{dateTimeLabel(test.performed_at)}</time>
            </li>
          ))}
        </ol>
      ) : <p className="component-no-evidence">No component test evidence has been recorded. Health status: Unknown.</p>}
      {!closed && (
        <form className="component-test-form" onSubmit={submitTest}>
          <div className="form-section-label">RECORD COMPONENT TEST</div>
          <div className="component-test-grid">
            <label>Test performed
              <input required maxLength={180} value={testName} onChange={(event) => setTestName(event.target.value)} placeholder="Enter the component test" />
            </label>
            <label>Result
              <select value={result} onChange={(event) => setResult(event.target.value as ComponentTestStatus)}>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="inconclusive">Inconclusive</option>
                <option value="not_tested">Not tested</option>
              </select>
            </label>
            <label className="component-test-observation">Observation
              <textarea required maxLength={1500} rows={2} value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Describe the observed result" />
            </label>
            <label className="component-test-notes">Notes <span className="label-muted">(optional)</span>
              <input maxLength={1500} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Conditions or context" />
            </label>
          </div>
          <div className="form-footer">
            <button className="button button-dark" type="submit" disabled={saving || !testName.trim() || !observation.trim()}>
              {saving ? <LoaderCircle size={15} className="spin" /> : <ClipboardCheck size={15} />} Save component test
            </button>
          </div>
        </form>
      )}
    </article>
  )
}

function SafetyAlertsPanel({ alerts }: { alerts: SafetyAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <section className="surface-card safety-alert-panel" aria-label="Safety alerts">
      <div className="safety-alert-heading"><AlertTriangle size={17} /><div><h3>Safety alert</h3><p>Based on recorded symptoms or test notes</p></div></div>
      {alerts.map((alert) => (
        <article className="safety-alert-item" key={`${alert.title}-${alert.source}`}>
          <strong>{alert.title}</strong>
          <p>{alert.instruction}</p>
          <blockquote>{alert.source}: “{alert.evidence}”</blockquote>
          <small>{alert.disclaimer} · {dateTimeLabel(alert.recorded_at)}</small>
        </article>
      ))}
    </section>
  )
}

function TimelineCard({ events, isDemo }: { events: TimelineEvent[]; isDemo: boolean }) {
  return (
    <section className="surface-card repair-timeline-card">
      <div className="section-card-head"><div><h3>Repair timeline</h3><p>{isDemo ? 'Sample timeline from demo records.' : 'Timeline events appear only when supported by saved records.'}</p></div></div>
      {events.length ? (
        <ol className="repair-timeline-list">
          {events.map((event) => (
            <li className="repair-timeline-event" key={event.id}>
              <span className="timeline-event-dot" />
              <div><strong>{event.title}</strong><p>{event.description}</p>
                {event.details && <small>{Object.entries(event.details).map(([key, value]) => `${titleCase(key.replaceAll('_', ' '))}: ${value}`).join(' · ')}</small>}
                <time>{dateTimeLabel(event.happened_at)}</time>
              </div>
            </li>
          ))}
        </ol>
      ) : <div className="inline-empty">No timeline events are available for this repair case.</div>}
    </section>
  )
}

function SimilarRepairMemory({ matches, onOpen }: { matches: SimilarRepair[]; onOpen: (id: string) => void }) {
  return (
    <section className="surface-card similar-repair-card">
      <div className="section-card-head"><div><h3>Similar completed repairs</h3><p>Completed repairs with overlapping symptoms or test evidence.</p></div></div>
      {matches.length ? <div className="similar-repair-list">{matches.map((item) => (
        <article className="similar-repair-item" key={item.id}>
          <div className="similar-repair-head"><span className="previous-case-label">COMPLETED CASE</span><button onClick={() => onOpen(item.id)}>{item.id} · {item.device} <ChevronRight size={13} /></button></div>
          <strong>{item.issue_title}</strong>
          <p>{item.symptoms}</p>
          <ul className="similar-reasons">{item.match_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          {item.tests.length > 0 && <div className="similar-test-list"><strong>Recorded tests</strong>{item.tests.map((test, index) => <p key={`${item.id}-${index}`}>{test.test_name} · {titleCase(test.result.replaceAll('_', ' '))}: {test.observed_result}</p>)}</div>}
          <div className="similar-outcome"><span>Confirmed fault</span><p>{item.confirmed_fault}</p><span>Repair action</span><p>{item.repair_action || 'Not available'}</p><span>Recorded outcome</span><p>{item.outcome}</p></div>
          <small className="similar-disclaimer">{item.disclaimer}</small>
        </article>
      ))}</div> : <div className="inline-empty">No comparable completed repairs were found in the saved records.</div>}
    </section>
  )
}

function RepairReportPrint({ detail, recommendation, alerts, generatedAt, stale }: {
  detail: CaseDetail
  recommendation: Recommendation | null
  alerts: SafetyAlert[]
  generatedAt: string | null
  stale: boolean
}) {
  const unavailable = 'Not available in saved records'
  return (
    <article className="repair-report-print" aria-hidden={!generatedAt}>
      <header><strong>FIXORA AI</strong><span>Electronics Repair Report</span><small>Generated {generatedAt ? dateTimeLabel(generatedAt) : ''}</small></header>
      <h1>Repair report · {detail.id}</h1>
      <section><h2>Device</h2><p><b>Type:</b> {detail.device_category || unavailable}</p><p><b>Brand and model:</b> {[detail.brand, detail.model].filter(Boolean).join(' ') || unavailable}</p><p><b>Current status:</b> {statusNames[detail.status]}</p><p><b>Record origin:</b> {detail.data_origin === 'demo' ? 'Demo sample record' : 'User-entered repair record'}</p></section>
      <section><h2>Reported issue and symptoms</h2><p><b>Issue:</b> {detail.issue_title || unavailable}</p><p>{detail.symptoms || unavailable}</p></section>
      <section><h2>Diagnostic tests</h2>{detail.tests.length ? detail.tests.map((test) => <div className="report-test" key={test.id}><strong>{test.test_name} · {titleCase(test.result.replaceAll('_', ' '))}</strong><p>{test.observed_result || unavailable}</p>{test.details && <p><b>Notes:</b> {test.details}</p>}<small>{dateTimeLabel(test.performed_at)}</small></div>) : <p>{unavailable}</p>}</section>
      <section><h2>Recommendation</h2>{recommendation ? <><p><b>Source:</b> {recommendation.provider === 'gemini_api' ? `Gemma (${recommendation.model_name})` : 'Local rules'}</p><p><b>Generated:</b> {recommendation.generated_at ? dateTimeLabel(recommendation.generated_at) : unavailable}</p>{stale && <p><b>Evidence status:</b> Outdated; new saved evidence may not be included.</p>}<p><b>Saved tests considered:</b> {(recommendation.content.evidence_test_ids || []).map((id) => detail.tests.find((test) => test.id === id)).filter(Boolean).map((test) => `${test!.test_name} (${titleCase(test!.result.replaceAll('_', ' '))})`).join(', ') || 'No test results recorded'}</p><p>{recommendation.content.summary}</p><ul>{recommendation.content.next_checks.map((check, index) => <li key={`${check.name}-${index}`}><b>{check.name}:</b> {check.purpose} {check.instructions}</li>)}</ul></> : <p>{unavailable}</p>}</section>
      <section><h2>Recorded repair outcome</h2><p><b>Confirmed fault:</b> {detail.confirmed_fault || unavailable}</p><p><b>Repair action:</b> {detail.repair_action || unavailable}</p><p><b>Verification outcome:</b> {detail.outcome || unavailable}</p></section>
      <section><h2>Safety alerts</h2>{alerts.length ? alerts.map((alert) => <p key={alert.title}><b>{alert.title}:</b> {alert.instruction} Evidence: {alert.evidence}</p>) : <p>No safety alerts were identified in the saved case details.</p>}</section>
      <footer>Fixora AI · This report reflects information saved for this repair when it was generated.</footer>
    </article>
  )
}

function RecommendationView({ recommendation, stale, tests }: { recommendation: Recommendation; stale: boolean; tests: TestResult[] }) {
  const [expandedHypothesis, setExpandedHypothesis] = useState(0)
  const content = recommendation.content
  const isLive = recommendation.provider === 'gemini_api'

  return (
      <section className={`surface-card recommendation-card ${stale ? 'recommendation-stale' : ''}`}>
      <div className="recommendation-head">
        <div className="recommendation-head-icon"><Sparkles size={16} /></div>
        <div>
          <h3>Evidence review</h3>
        </div>
        <span className={`source-mode ${isLive ? 'source-mode-live' : 'source-mode-fallback'}`}>
          {isLive ? 'GEMMA 4' : 'Local rules'}
        </span>
      </div>

      {stale && (
        <div className="stale-banner">
          <AlertCircle size={14} /> New test evidence was saved after this recommendation was generated.
        </div>
      )}

      <p className="recommendation-summary">{content.summary}</p>

      <div className="missing-info-box">
        <div className="missing-info-heading">
          <ClipboardCheck size={14} />
          <strong>Evidence considered</strong>
        </div>
        {content.evidence_test_ids?.length ? (
          <ul>
            {content.evidence_test_ids.map((testId) => {
              const test = tests.find((item) => item.id === testId)
              if (!test) return <li key={testId}>Saved test {testId} was included; its details are unavailable in this view.</li>
              const isNew = content.new_evidence_test_ids?.includes(testId)
              return (
                <li key={testId}>
                  <strong>{test.test_name}</strong> · {titleCase(test.result.replaceAll('_', ' '))}
                  {isNew ? ' · Added since previous review' : ''}
                  {test.observed_result ? ` — ${test.observed_result}` : ''}
                  {test.details ? ` Notes: ${test.details}` : ''}
                  {' · '}{dateTimeLabel(test.performed_at)}
                </li>
              )
            })}
          </ul>
        ) : (
          <p>No diagnostic test results were included in this recommendation.</p>
        )}
      </div>

      <div className="hypothesis-section">
        <div className="recommendation-section-title">
          <h4>Possible explanations</h4>
        </div>
        {content.hypotheses.map((hypothesis, index) => (
          <div
            className={`hypothesis-item ${expandedHypothesis === index ? 'hypothesis-expanded' : ''}`}
            key={`${hypothesis.fault}-${index}`}
          >
            <button
              className="hypothesis-toggle"
              onClick={() => setExpandedHypothesis((cur) => (cur === index ? -1 : index))}
            >
              <div className={`hypothesis-index ${hypothesis.likelihood}`}>{index + 1}</div>
              <div className="hypothesis-title-wrap">
                <strong>{hypothesis.fault}</strong>
                <span className={`likelihood-label likelihood-${hypothesis.likelihood}`}>
                  Likelihood: {titleCase(hypothesis.likelihood)}
                </span>
              </div>
              <ChevronDown size={14} />
            </button>
            {expandedHypothesis === index && (
              <div className="hypothesis-detail">
                <p>{hypothesis.reasoning}</p>
                {hypothesis.supporting_evidence.length > 0 && (
                  <div className="evidence-chips-group">
                    <span className="evidence-group-label">SUPPORTING EVIDENCE</span>
                    {hypothesis.supporting_evidence.map((evidence, i) => (
                      <div className="evidence-chip positive" key={`${evidence}-${i}`}>
                        <Check size={12} /> {evidence}
                      </div>
                    ))}
                  </div>
                )}
                {hypothesis.contradicting_evidence.length > 0 && (
                  <div className="evidence-chips-group">
                    <span className="evidence-group-label">CONTRADICTING EVIDENCE</span>
                    {hypothesis.contradicting_evidence.map((evidence, i) => (
                      <div className="evidence-chip caution" key={`${evidence}-${i}`}>
                        <AlertCircle size={12} /> {evidence}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="next-checks-section">
        <div className="recommendation-section-title">
          <h4>Recommended next checks</h4>
        </div>
        {content.next_checks.map((check, index) => (
          <NextCheckCard check={check} index={index} key={`${check.name}-${index}`} />
        ))}
      </div>

      {content.missing_information.length > 0 && (
        <div className="missing-info-box">
          <div className="missing-info-heading">
            <CircleHelp size={14} />
            <strong>Missing information</strong>
          </div>
          <ul>
            {content.missing_information.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {recommendation.sources.length > 0 && (
        <div className="source-reference-section">
          <span className="evidence-group-label">REFERENCES</span>
          {recommendation.sources.map((source) => (
            <div className="source-reference" key={source.id}>
              <div>
                <strong>{source.title}</strong>
                <span>{source.id}</span>
              </div>
              {source.source_url && (
                <a href={source.source_url} target="_blank" rel="noreferrer" aria-label={`Open ${source.title}`}>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="recommendation-footer">
        <span>{dateTimeLabel(recommendation.generated_at)}</span>
        <span>{recommendation.model_name}</span>
      </div>
    </section>
  )
}

function NextCheckCard({ check, index }: { check: NextCheck; index: number }) {
  const [open, setOpen] = useState(index === 0)
  return (
    <div className={`next-check-item ${open ? 'next-check-open' : ''}`}>
      <button className="next-check-head" onClick={() => setOpen((v) => !v)}>
        <span className="next-check-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="next-check-main">
          <strong>{check.name}</strong>
          <small>{check.purpose}</small>
        </span>
        <span className={`safety-level safety-${check.safety_level}`}>
          {check.safety_level === 'professional_only' ? 'Pro only' : check.safety_level}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="next-check-body">
          <p>{check.instructions}</p>
          <div className="record-this">
            <ClipboardCheck size={13} />
            <span><strong>Record:</strong> {check.what_to_record}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function MemoryPage({
  cases,
  query,
  setQuery,
  onOpen,
  onDelete,
}: {
  cases: RepairCase[]
  query: string
  setQuery: (value: string) => void
  onOpen: (id: string, tab?: NavId) => void
  onDelete: (id: string, brand: string, model: string) => void
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Repair Memory</h1>
        </div>
        <div className="memory-count-pill">
          <History size={15} /> {cases.length} completed cases
        </div>
      </div>

      <section className="surface-card memory-table-card">
        <div className="search-box memory-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by device, confirmed fault, or outcome…"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear memory search">
              <X size={14} />
            </button>
          )}
        </div>

        {cases.length ? (
          <div className="memory-list">
            {cases.map((item) => (
              <div className="memory-record" key={item.id} onClick={() => onOpen(item.id, 'diagnostics')}>
                <div className="memory-record-icon"><History size={16} /></div>
                <div className="memory-record-main">
                  <div className="memory-record-title">
                    <strong>{item.issue_title}</strong>
                    <span className="memory-record-id">{item.id}</span>
                  </div>
                  <span className="memory-device-line">{item.brand} {item.model} · {dateLabel(item.updated_at)}</span>
                  <span className="memory-fault-line">
                    <CheckCircle2 size={13} /> Confirmed fault: {item.confirmed_fault}
                  </span>
                  <span className="memory-action-line">{item.repair_action}</span>
                </div>
                <div className="memory-record-outcome">
                  <span>OUTCOME</span>
                  <p>{item.outcome || 'No outcome recorded'}</p>
                </div>
                <div className="row-actions-cell" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="row-delete-btn"
                    title="Delete repair record"
                    onClick={() => onDelete(item.id, item.brand, item.model)}
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} className="memory-chevron" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="No completed repair cases"
            description="Completed cases with confirmed outcomes appear here."
          />
        )}
      </section>
    </>
  )
}

function InventoryPage() {
  const [inventory, setInventory] = useState<ComponentInventoryRecord[]>([])
  const [candidates, setCandidates] = useState<InventoryComponentCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [reuseFilter, setReuseFilter] = useState('all')
  const [resaleFilter, setResaleFilter] = useState('all')
  const [candidateId, setCandidateId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [condition, setCondition] = useState<ComponentCondition>('unknown')
  const [conditionNotes, setConditionNotes] = useState('')
  const [storageLocation, setStorageLocation] = useState('')

  async function loadInventory(showLoading = true): Promise<boolean> {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const [records, sources] = await Promise.all([api.inventory(), api.inventoryCandidates()])
      setInventory(records)
      setCandidates(sources)
      setCandidateId((current) => current && sources.some((item) => String(item.id) === current) ? current : String(sources[0]?.id || ''))
      return true
    } catch (loadError) {
      setError(errorMessage(loadError))
      return false
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => { void loadInventory() }, [])

  async function mutate(action: () => Promise<unknown>, successText: string): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      const refreshed = await loadInventory(false)
      setMessage(refreshed ? successText : `${successText} Refresh the inventory to confirm current quantities and review status.`)
      return true
    } catch (actionError) {
      setError(errorMessage(actionError))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!candidateId) return
    const saved = await mutate(() => api.createInventory(Number(candidateId), {
      quantity_available: Number(quantity),
      condition,
      condition_notes: conditionNotes.trim(),
      storage_location: storageLocation.trim() || undefined,
    }), 'Component added to inventory.')
    if (saved) {
      setConditionNotes('')
      setStorageLocation('')
      setQuantity('1')
    }
  }

  const visibleInventory = inventory.filter((item) => {
    const text = `${item.component_name} ${item.model_part_number || ''} ${item.case_id} ${item.source_device}`.toLowerCase()
    return text.includes(query.toLowerCase())
      && (reuseFilter === 'all' || item.reuse_status === reuseFilter)
      && (resaleFilter === 'all' || item.resale_status === resaleFilter)
  })

  return (
    <div className="inventory-page">
      <div className="page-heading inventory-page-heading">
        <div>
          <h1>Parts inventory</h1>
          <p className="page-subtitle">Track component stock, evidence-based reuse decisions, and resale reviews.</p>
        </div>
        <div className="inventory-total-pill"><PackageSearch size={16} /> {inventory.length} tracked components</div>
      </div>

      {message && <div className="inventory-feedback inventory-success" role="status"><CheckCircle2 size={16} />{message}<button onClick={() => setMessage('')} aria-label="Dismiss success message"><X size={14} /></button></div>}
      {error && <div className="inventory-feedback inventory-error" role="alert"><AlertCircle size={16} />{error}<button onClick={() => setError('')} aria-label="Dismiss error message"><X size={14} /></button></div>}

      <section className="surface-card inventory-intake-card">
        <div className="section-card-head"><div><h3>Add component to inventory</h3><p>Select a component recorded in Diagnostics to keep its test evidence and repair source linked.</p></div></div>
        {candidates.length ? (
          <form className="inventory-intake-form" onSubmit={addInventory}>
            <label>Recorded component
              <select required value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
                {candidates.map((item) => <option key={item.id} value={item.id}>{item.component_name}{item.model_part_number ? ` · ${item.model_part_number}` : ''} — {item.case_id} · {item.source_device} · {titleCase(item.health_status.replaceAll('_', ' '))}</option>)}
              </select>
            </label>
            <label>Available quantity
              <input required type="number" min="1" max="100000" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label>Physical condition
              <select value={condition} onChange={(event) => setCondition(event.target.value as ComponentCondition)}>
                <option value="unknown">Unknown / not assessed</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option>
              </select>
            </label>
            <label>Condition observation
              <input required minLength={3} maxLength={1500} value={conditionNotes} onChange={(event) => setConditionNotes(event.target.value)} placeholder="Describe the observed physical condition" />
            </label>
            <label className="inventory-location-field">Storage location <span className="label-muted">(optional)</span>
              <input maxLength={180} value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="Enter a shelf, bin, or location" />
            </label>
            <div className="inventory-intake-action"><button className="button button-dark" type="submit" disabled={busy || !candidateId || Number(quantity) < 1}>{busy ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} Add to inventory</button></div>
            <p className="inventory-policy-note">New inventory starts Under Review for reuse and resale. Missing test data does not imply approval.</p>
          </form>
        ) : (
          <div className="inline-empty inventory-candidate-empty"><PackageSearch size={16} /><span>No components are available to add. Record a component in Diagnostics first.</span></div>
        )}
      </section>

      <section className="surface-card inventory-list-card">
        <div className="inventory-toolbar">
          <label className="search-box inventory-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by component, part number, repair, or device" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</label>
          <label className="inventory-filter">Reuse <select value={reuseFilter} onChange={(event) => setReuseFilter(event.target.value)}><option value="all">All</option><option value="under_review">Under review</option><option value="available">Available</option><option value="not_eligible">Not eligible</option></select></label>
          <label className="inventory-filter">Resale <select value={resaleFilter} onChange={(event) => setResaleFilter(event.target.value)}><option value="all">All</option><option value="under_review">Under review</option><option value="approved_for_resale">Approved</option><option value="not_eligible">Not eligible</option></select></label>
          <button className="button button-ghost button-sm" onClick={() => void loadInventory()} disabled={loading}><RefreshCw size={14} /> Refresh inventory</button>
        </div>
        {loading ? (
          <div className="inventory-state"><LoaderCircle size={19} className="spin" /><span>Loading inventory…</span></div>
        ) : visibleInventory.length ? (
          <div className="inventory-record-list">
            {visibleInventory.map((item) => (
              <InventoryRecordCard key={item.id} item={item} busy={busy} onMutate={mutate} />
            ))}
          </div>
        ) : inventory.length ? (
          <EmptyState icon={Search} title="No matching components" description="Try another search term or change the review filters." />
        ) : (
          <EmptyState icon={PackageSearch} title="No components in inventory" description="Add a component recorded in Diagnostics. Its test status and repair source will be carried over from saved records." />
        )}
      </section>
    </div>
  )
}

function InventoryRecordCard({ item, busy, onMutate }: {
  item: ComponentInventoryRecord
  busy: boolean
  onMutate: (action: () => Promise<unknown>, successText: string) => Promise<boolean>
}) {
  const [condition, setCondition] = useState<ComponentCondition>(item.condition)
  const [conditionNotes, setConditionNotes] = useState(item.condition_notes)
  const [location, setLocation] = useState(item.storage_location || '')
  const [adjustment, setAdjustment] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [reuseReason, setReuseReason] = useState('')
  const [resaleReason, setResaleReason] = useState('')
  const [movementQuantity, setMovementQuantity] = useState('1')
  const [movementReason, setMovementReason] = useState('')
  const supportsReview = item.health_status === 'working'
    && ['new', 'like_new', 'good'].includes(item.condition)

  useEffect(() => {
    setCondition(item.condition)
    setConditionNotes(item.condition_notes)
    setLocation(item.storage_location || '')
  }, [item.condition, item.condition_notes, item.storage_location])

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onMutate(() => api.updateInventory(item.id, { condition, condition_notes: conditionNotes.trim(), storage_location: location.trim() || null }), 'Component details saved.')
  }

  async function stockChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const saved = await onMutate(() => api.adjustInventory(item.id, { quantity_delta: Number(adjustment), reason: adjustmentReason.trim() }), 'Inventory quantity updated.')
    if (saved) {
      setAdjustment('')
      setAdjustmentReason('')
    }
  }

  async function reviewReuse(status: ReuseStatus) {
    if (await onMutate(() => api.reviewReuse(item.id, { status, reason: reuseReason.trim() }), `Reuse review saved: ${titleCase(status.replaceAll('_', ' '))}.`)) setReuseReason('')
  }

  async function reviewResale(status: ResaleStatus) {
    if (await onMutate(() => api.reviewResale(item.id, { status, reason: resaleReason.trim() }), `Resale review saved: ${titleCase(status.replaceAll('_', ' '))}.`)) setResaleReason('')
  }

  async function moveStock(action: 'reserve' | 'release' | 'use') {
    const data = { quantity: Number(movementQuantity), reason: movementReason.trim() }
    const request = action === 'reserve' ? api.reserveInventory(item.id, data)
      : action === 'release' ? api.releaseInventory(item.id, data) : api.useInventory(item.id, data)
    const movementLabel = action === 'reserve' ? 'reserved' : action === 'release' ? 'released' : 'marked as used'
    if (await onMutate(() => request, `${quantityFormatter(data.quantity)} component${data.quantity === 1 ? '' : 's'} ${movementLabel}.`)) setMovementReason('')
  }

  return (
    <article className="inventory-record">
      <header className="inventory-record-head">
        <div className="inventory-component-mark"><Cpu size={17} /></div>
        <div className="inventory-record-title"><h3>{item.component_name}</h3><p>{item.model_part_number || 'No part number recorded'} · Case {item.case_id} · {item.source_device}</p></div>
        <span className={`component-health-status status-${item.health_status}`}>{titleCase(item.health_status.replaceAll('_', ' '))}</span>
      </header>

      <div className="inventory-facts">
        <div><span>AVAILABLE</span><strong>{item.quantity_available}</strong></div>
        <div><span>RESERVED</span><strong>{item.quantity_reserved}</strong></div>
        <div><span>USED</span><strong>{item.quantity_used}</strong></div>
        <div><span>PHYSICAL CONDITION</span><strong>{titleCase(item.condition.replaceAll('_', ' '))}</strong></div>
        <div><span>STORAGE LOCATION</span><strong>{item.storage_location || 'Not specified'}</strong></div>
      </div>

      <div className="inventory-evidence">
        <div className="inventory-evidence-heading"><strong>Latest component test</strong>{item.latest_test && <span className={`result-tag result-tag-${item.latest_test.result}`}>{titleCase(item.latest_test.result.replaceAll('_', ' '))}</span>}</div>
        {item.latest_test ? <><p>{item.latest_test.test_name}: {item.latest_test.observed_result}</p>{item.latest_test.details && <small>{item.latest_test.details}</small>}<time>{dateTimeLabel(item.latest_test.performed_at)}</time></> : <p>No component test evidence is recorded. Health status is Unknown.</p>}
      </div>

      <div className="inventory-review-grid">
        <section className="inventory-review-box">
          <div className="inventory-review-head"><h4>Reuse</h4><span className={`inventory-review-status review-${item.reuse_status}`}>{titleCase(item.reuse_status.replaceAll('_', ' '))}</span></div>
          {item.reuse_reason && <p className="inventory-review-reason">{item.reuse_reason}{item.reuse_reviewed_at ? ` · ${dateTimeLabel(item.reuse_reviewed_at)}` : ''}</p>}
          <p className="inventory-policy-note">Reuse approval requires a passing component test and a suitable recorded physical condition. Reservations and use are tracked below.</p>
          <label>Review reason <textarea required minLength={10} rows={2} value={reuseReason} onChange={(event) => setReuseReason(event.target.value)} placeholder="Describe the evidence and condition reviewed" /></label>
          <div className="inventory-review-actions"><button className="button button-primary button-sm" onClick={() => void reviewReuse('available')} disabled={busy || !supportsReview || reuseReason.trim().length < 10}>Approve reuse</button><button className="button button-ghost button-sm" onClick={() => void reviewReuse('not_eligible')} disabled={busy || reuseReason.trim().length < 10}>Not eligible</button></div>
        </section>
        <section className="inventory-review-box">
          <div className="inventory-review-head"><h4>Resale review</h4><span className={`inventory-review-status review-${item.resale_status}`}>{titleCase(item.resale_status.replaceAll('_', ' '))}</span></div>
          {item.resale_reason && <p className="inventory-review-reason">{item.resale_reason}{item.resale_reviewed_at ? ` · ${dateTimeLabel(item.resale_reviewed_at)}` : ''}</p>}
          <p className="inventory-policy-note">Approval requires current passing test evidence and a suitable recorded condition. This internal review does not verify safety, authenticity, compatibility, or full functionality, and does not list the part for sale.</p>
          <label>Review reason <textarea required minLength={10} rows={2} value={resaleReason} onChange={(event) => setResaleReason(event.target.value)} placeholder="Describe evidence, condition, and review decision" /></label>
          <div className="inventory-review-actions"><button className="button button-primary button-sm" onClick={() => void reviewResale('approved_for_resale')} disabled={busy || !supportsReview || item.quantity_available < 1 || resaleReason.trim().length < 10}>Approve for resale</button><button className="button button-ghost button-sm" onClick={() => void reviewResale('not_eligible')} disabled={busy || resaleReason.trim().length < 10}>Not eligible</button><button className="button button-ghost button-sm" onClick={() => void reviewResale('under_review')} disabled={busy || resaleReason.trim().length < 10}>Under review</button></div>
        </section>
      </div>

      <details className="inventory-management-details">
        <summary>Update condition, storage, and stock</summary>
        <div className="inventory-management-grid">
          <form onSubmit={saveDetails}>
            <h4>Physical condition and storage</h4>
            <label>Physical condition<select value={condition} onChange={(event) => setCondition(event.target.value as ComponentCondition)}><option value="unknown">Unknown / not assessed</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></label>
            <label>Condition observation<textarea required minLength={3} rows={2} value={conditionNotes} onChange={(event) => setConditionNotes(event.target.value)} /></label>
            <label>Storage location<input maxLength={180} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Enter a location (optional)" /></label>
            <button className="button button-dark button-sm" type="submit" disabled={busy || conditionNotes.trim().length < 3}>Save component details</button>
          </form>
          <form onSubmit={stockChange}>
            <h4>Adjust available quantity</h4>
            <p>Use a positive number to add stock or a negative number to remove it. Reserved quantities cannot be removed here.</p>
            <label>Quantity change<input required type="number" min="-100000" max="100000" step="1" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="e.g. 2 or -1" /></label>
            <label>Reason<input required minLength={3} maxLength={500} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Stock count or intake correction" /></label>
            <button className="button button-dark button-sm" type="submit" disabled={busy || !Number(adjustment) || adjustmentReason.trim().length < 3}>Save quantity change</button>
          </form>
          <div className="inventory-movement-form">
            <h4>Reserve, release, or use stock</h4>
            <label>Quantity<input required type="number" min="1" max="100000" value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)} /></label>
            <label>Reason<input required minLength={3} maxLength={500} value={movementReason} onChange={(event) => setMovementReason(event.target.value)} placeholder="Repair case or handling note" /></label>
            <div className="inventory-review-actions"><button className="button button-ghost button-sm" onClick={() => void moveStock('reserve')} disabled={busy || item.reuse_status !== 'available' || Number(movementQuantity) < 1 || movementReason.trim().length < 3}>Reserve</button><button className="button button-ghost button-sm" onClick={() => void moveStock('release')} disabled={busy || item.quantity_reserved < Number(movementQuantity) || Number(movementQuantity) < 1 || movementReason.trim().length < 3}>Release</button><button className="button button-ghost button-sm" onClick={() => void moveStock('use')} disabled={busy || item.quantity_reserved < Number(movementQuantity) || Number(movementQuantity) < 1 || movementReason.trim().length < 3}>Mark used</button></div>
          </div>
        </div>
      </details>

      {!!item.events.length && <details className="inventory-event-details"><summary>Stock activity ({item.events.length})</summary><ul>{item.events.map((event) => <li key={event.id}><strong>{titleCase(event.event_type.replaceAll('_', ' '))} · {event.quantity}</strong><span>{event.reason}</span><time>{dateTimeLabel(event.occurred_at)}</time></li>)}</ul></details>}
      <p className="inventory-record-timestamps">Created {dateTimeLabel(item.created_at)} · Updated {dateTimeLabel(item.updated_at)}</p>
    </article>
  )
}

function quantityFormatter(value: number) {
  return new Intl.NumberFormat().format(value)
}

function KnowledgePage({ sources, notice }: { sources: KnowledgeSource[]; notice?: string }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Knowledge base</h1>
          {notice && <p className="page-subtitle">{notice}</p>}
        </div>
      </div>

      <div className="knowledge-grid">
        {sources.map((source, index) => (
          <article className="surface-card knowledge-card" key={source.id}>
            <div className="knowledge-card-head">
              <span className={`knowledge-source-icon source-icon-${index % 4}`}>
                <BookOpen size={16} />
              </span>
              <span className="source-id">{source.id}</span>
            </div>
            <h3>{source.title}</h3>
            <p className="knowledge-scope">{source.scope}</p>
            <div className="knowledge-content">{source.content}</div>
            {source.source_url && (
              <a className="knowledge-external-link" href={source.source_url} target="_blank" rel="noreferrer">
                Source reference <ExternalLink size={12} />
              </a>
            )}
          </article>
        ))}
      </div>
    </>
  )
}
