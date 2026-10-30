import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Cpu, ExternalLink, Eye, Filter, Github, History, House, Info, Layers3, Linkedin,
  LoaderCircle, Mail, Phone, Plus, RefreshCw, RotateCcw, Search,
  Settings, ShieldCheck, Smartphone, Sparkles, Stethoscope, Trash2,
  Volume2, VolumeX, X, Zap,
  ClipboardCheck, PackageSearch, BrainCircuit,
} from 'lucide-react'
import { api } from './lib/api'
import type {
  CaseDetail, CaseStatus, DashboardSummary, Health,
  NextCheck, Priority, Recommendation, RepairCase, TestStatus,
} from './lib/types'

const navItems = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'cases', label: 'Repair Queue', icon: Layers3 },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { id: 'memory', label: 'Repair Memory', icon: History },
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
            <h2>Project Credits</h2>
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
              <span>Source Code · GitHub Repository</span>
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
          <span>SESSION SUSPENDED // WORKSPACE STANDBY</span>
        </div>
        <h2>Fixora Hardware OS Disengaged</h2>
        <p>
          Diagnostic matrix placed in safe standby mode. All repair logs and test data are stored safely.
          You can close this tab using <kbd>Cmd+W</kbd> / <kbd>Ctrl+W</kbd> or click Close Tab below:
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
            <span className="game-btn-label">Resume Session</span>
            <span className="game-btn-bracket">]</span>
          </button>
          <button
            className="game-btn game-btn-quit"
            onClick={handleForceClose}
          >
            <span className="game-btn-num">XX</span>
            <span className="game-btn-label">Close Tab</span>
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
          <span>OPTICAL CALIBRATION // 100% FOCUS</span>
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
            <h2>Fixora Lab Settings</h2>
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
              <h3>Visual FX & Animations</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Enable Animations & Circuit FX</span>
                <span className="settings-desc">Master toggle for background neon circuit traces, laser scanline, radar ripples, and button micro-interactions.</span>
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
                <span className="settings-label">Live Telemetry Oscilloscope</span>
                <span className="settings-desc">Display animated hardware frequency waveform & system telemetry in the HUD.</span>
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
                <span className="settings-label">High-Contrast Glass HUD</span>
                <span className="settings-desc">Enhances contrast and panel outlines for bright workshop lighting.</span>
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
                <RotateCcw size={13} /> Replay Optical Calibration Sequence
              </button>
            </div>
          </div>

          {/* Section 2: AI & Diagnostic Engine */}
          <div className="settings-section">
            <div className="settings-section-head">
              <Cpu size={16} />
              <h3>AI & Reasoning Engine</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Diagnostics Inference Model</span>
                <span className="settings-desc">Choose between live Gemma 4 reasoning API or offline heuristic rules.</span>
              </div>
              <select
                className="settings-select"
                value={settings.modelEngine}
                onChange={(e) => {
                  playUiSound('toggle', settings)
                  onUpdateSettings((prev) => ({ ...prev, modelEngine: e.target.value as 'gemma-4' | 'fallback-rules' }))
                }}
              >
                <option value="gemma-4">Gemma 4 (26B Reasoning Matrix)</option>
                <option value="fallback-rules">Rule-based Local Engine</option>
              </select>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Automatic AI Triage on Intake</span>
                <span className="settings-desc">Instantly evaluate fault probability and generate test matrix when a device is registered.</span>
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
                <span className="settings-label">Strict Safety Quarantine</span>
                <span className="settings-desc">Enforce mandatory pause on thermal runaway or punctured battery hazards.</span>
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
              <h3>Queue Safety & Handover</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Confirm Device Deletion</span>
                <span className="settings-desc">Require confirmation prompt before permanently deleting any repair record.</span>
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
                <span className="settings-label">Confirm Repair Completion</span>
                <span className="settings-desc">Require confirmation before setting a device as completed and archiving to memory.</span>
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
                <span className="settings-label">Auto-Archive Completed Repairs</span>
                <span className="settings-desc">Keep the repair queue focused by filtering completed devices into Repair Memory.</span>
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
              <h3>Hardware Audio Feedback</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">Synthesizer Audio Feedback</span>
                <span className="settings-desc">Play clean browser-synthesized audio clicks on button presses and toggles.</span>
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
      setLocalError('Add more detail about the reported symptoms.')
      return
    }
    await onCreate(form)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-repair-title">
        <div className="modal-head">
          <div>
            <h2 id="new-repair-title">Register device</h2>
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
              <textarea required minLength={5} rows={3} value={form.symptoms} onChange={(e) => setField('symptoms', e.target.value)} placeholder="What was observed?" />
            </label>
            <label className="span-two">Customer contact <span className="label-muted">(phone or email)</span>
              <input value={form.customer_contact} onChange={(e) => setField('customer_contact', e.target.value)} placeholder="+1 (555) 000-0000 or customer@example.com" />
            </label>
          </div>
          {localError && <div className="inline-error"><AlertCircle size={15} />{localError}</div>}
          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Register device
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
            <span>SYS.STATUS // ONLINE</span>
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
              <span>GEMMA 4 // REASONING MATRIX</span>
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
            Grounded diagnostic co-pilot for electronics repair & fault verification.
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
            <span className="game-btn-label">New Repair</span>
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
            <span className="game-btn-label">Quit Site</span>
            <span className="game-btn-bracket">]</span>
          </button>
        </nav>

        <div className="game-hud-bottom">
          <span className="hud-code-hint">
            HACK DAY AT MICROSOFT // GEMMA 4 REPAIR COPILOT
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
  const [selectedId, setSelectedId] = useState('')
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
    const [healthResult, casesResult, dashboardResult] = await Promise.allSettled([
      api.health(),
      api.cases(),
      api.dashboard(),
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
        customer_contact: form.customer_contact || undefined,
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
      })
      setShowNewRepair(false)
      setSelectedId(created.id)
      setActiveNav('diagnostics')
      setDiagnosticsTab('evidence')
      await refreshLists()
      flash('success', `${created.brand} ${created.model} (${created.id}) registered.`)

      // Automatic AI Triage if enabled in Settings
      if (settings.autoTriageOnCreate) {
        setGenerating(true)
        void api.recommendation(created.id)
          .then((rec) => {
            setRecommendation(rec)
            void loadDetail(created.id)
            flash('success', 'Automatic AI recommendation generated.')
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
      flash('success', `Device ${caseId} deleted.`)
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
    if (!selectedDetail) return
    setRecordingTest(true)
    try {
      await api.addTest(selectedDetail.id, testForm)
      setTestForm((current) => ({ ...current, observed_result: '', details: '' }))
      setRecommendation(null)
      await refreshLists()
      await loadDetail(selectedDetail.id)
      flash('success', 'Test result recorded.')
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      setRecordingTest(false)
    }
  }

  async function generateRecommendation() {
    if (!selectedDetail) return
    setGenerating(true)
    try {
      const result = await api.recommendation(selectedDetail.id)
      setRecommendation(result)
      await refreshLists()
      await loadDetail(selectedDetail.id)
      setRecommendation((current) => (current ? { ...current, similar_cases: result.similar_cases } : result))
      flash('success', result.provider === 'gemini_api' ? 'Gemma recommendation generated.' : 'Guidance generated using local rules.')
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
      flash('success', outcomeForm.status === 'completed' ? 'Case marked completed and moved to Repair Memory.' : 'Repair outcome saved.')
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
      flash('success', `Case ${caseId} moved to ${statusNames[status]}.`)
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
      const matchesStatus = caseStatusFilter === 'all' || item.status === caseStatusFilter
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

  const selected = selectedDetail
  const staleRecommendation = Boolean(
    recommendation &&
      selected?.tests.length &&
      recommendation.generated_at &&
      new Date(selected.tests[selected.tests.length - 1].performed_at) > new Date(recommendation.generated_at)
  )

  const aiActive = Boolean(health?.model_configured)

  function openCase(id: string, tab: NavId = 'diagnostics') {
    setSelectedId(id)
    setActiveNav(tab)
  }

  const isHome = activeNav === 'home'

  return (
    <div className={`app-shell ${isHome ? 'home-layout' : 'dock-layout'}`}>
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
              onNavigate={(tab) => {
                playUiSound('click', settings)
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
              recommendation={recommendation}
              health={health}
              stale={staleRecommendation}
              generating={generating}
              recordingTest={recordingTest}
              recordingOutcome={recordingOutcome}
              testForm={testForm}
              setTestForm={setTestForm}
              outcomeForm={outcomeForm}
              setOutcomeForm={setOutcomeForm}
              onSelect={(id) => setSelectedId(id)}
              onAddTest={addTest}
              onGenerate={generateRecommendation}
              onSaveOutcome={handleSaveOutcome}
              onDelete={promptDeleteDevice}
              onOpenCase={openCase}
              settings={settings}
            />
          </div>
        )}

        {!isHome && activeNav === 'memory' && (
          <div key="memory" className="page-transition-wrap memory-fullscreen-wrap">
            <MemoryPage
              cases={memoryCases}
              query={memoryQuery}
              setQuery={setMemoryQuery}
              onOpen={openCase}
              onDelete={promptDeleteDevice}
              settings={settings}
            />
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
                void refreshLists()
                  .then(() => flash('success', 'Refreshed.'))
                  .catch((error) => flash('error', errorMessage(error)))
              }}
              aria-label="Refresh app data"
            >
              <span className="dock-tooltip">Refresh</span>
              <div className="dock-icon-wrap">
                <RefreshCw size={20} strokeWidth={1.8} />
              </div>
            </button>
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
              aria-label="New repair"
            >
              <span className="dock-tooltip">New repair</span>
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
        title="Delete device?"
        message={`Are you sure you want to delete ${deleteModal.name} (${deleteModal.caseId})? This action cannot be undone.`}
        confirmText="Delete"
        confirmTone="danger"
        busy={busy}
        onConfirm={confirmDeleteDevice}
        onCancel={() => setDeleteModal({ isOpen: false, caseId: '', name: '' })}
      />

      <ConfirmModal
        isOpen={completeModal.isOpen}
        title="Mark device as completed?"
        message={`Marking ${completeModal.caseId} as completed will archive the device into Repair Memory and remove it from the active repair queue.`}
        confirmText="Mark completed"
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
  onNavigate: (tab: NavId) => void
  settings: AppSettings
  aiActive?: boolean
}) {
  const urgent = cases.filter(
    (item) => (item.priority === 'urgent' || item.priority === 'high') && item.status !== 'completed'
  )

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

      {/* Minimalist Floating Glass HUD Container in Negative Space */}
      <div className="overview-negative-hud">
        <div className="overview-hud-header">
          <div className="overview-telemetry-chip">
            <span className={`overview-telemetry-dot ${aiActive ? 'online' : ''}`} />
            <span>DIAGNOSTIC TELEMETRY // OVERVIEW</span>
          </div>
          <h1>Overview</h1>
        </div>

        {/* 2x2 Minimalist Glass Stat Cards */}
        <div className="overview-glass-stats-grid">
          <button
            className="overview-glass-card card-tone-blue"
            onClick={() => {
              playUiSound('click', settings)
              onNavigate('cases')
            }}
          >
            <div className="glass-card-top">
              <div className="glass-card-icon icon-blue">
                <Activity size={17} />
              </div>
              <span className="glass-card-arrow"><ArrowRight size={13} /></span>
            </div>
            <div className="glass-card-val">{dashboard?.active_repairs ?? 0}</div>
            <div className="glass-card-title">Active repairs</div>
            <div className="glass-card-detail">Across current queue</div>
          </button>

          <button
            className="overview-glass-card card-tone-green"
            onClick={() => {
              playUiSound('click', settings)
              onNavigate('cases')
            }}
          >
            <div className="glass-card-top">
              <div className="glass-card-icon icon-green">
                <ClipboardCheck size={17} />
              </div>
              <span className="glass-card-arrow"><ArrowRight size={13} /></span>
            </div>
            <div className="glass-card-val">{dashboard?.ready_for_testing ?? 0}</div>
            <div className="glass-card-title">Ready for testing</div>
            <div className="glass-card-detail">Final verification stage</div>
          </button>

          <button
            className="overview-glass-card card-tone-violet"
            onClick={() => {
              playUiSound('click', settings)
              onNavigate('memory')
            }}
          >
            <div className="glass-card-top">
              <div className="glass-card-icon icon-violet">
                <CheckCircle2 size={17} />
              </div>
              <span className="glass-card-arrow"><ArrowRight size={13} /></span>
            </div>
            <div className="glass-card-val">{dashboard?.completed_this_week ?? 0}</div>
            <div className="glass-card-title">Completed this week</div>
            <div className="glass-card-detail">Updated in the last 7 days</div>
          </button>

          <button
            className="overview-glass-card card-tone-amber"
            onClick={() => {
              playUiSound('click', settings)
              onNavigate('memory')
            }}
          >
            <div className="glass-card-top">
              <div className="glass-card-icon icon-amber">
                <History size={17} />
              </div>
              <span className="glass-card-arrow"><ArrowRight size={13} /></span>
            </div>
            <div className="glass-card-val">{dashboard?.saved_cases ?? 0}</div>
            <div className="glass-card-title">Repair memory</div>
            <div className="glass-card-detail">Cases with outcomes & history</div>
          </button>
        </div>

        {/* Minimalist Glass Attention Needed Card */}
        <section className="overview-glass-attention">
          <div className="glass-attention-head">
            <div className="glass-attention-title">
              <span className="attention-indicator">
                <AlertTriangle size={15} />
              </span>
              <h3>Attention needed</h3>
            </div>
            <span className={`attention-count-badge ${urgent.length > 0 ? 'badge-urgent' : 'badge-calm'}`}>
              {urgent.length} {urgent.length === 1 ? 'ISSUE' : 'ISSUES'}
            </span>
          </div>

          {urgent.length > 0 ? (
            <div className="glass-signal-list">
              {urgent.map((item) => (
                <button
                  key={item.id}
                  className="glass-signal-item"
                  onClick={() => {
                    playUiSound('click', settings)
                    onOpen(item.id, 'diagnostics')
                  }}
                >
                  <span className="signal-bar-accent" />
                  <div className="signal-item-copy">
                    <strong className="signal-item-title">{item.issue_title}</strong>
                    <span className="signal-item-meta">
                      {item.id} · {item.brand} {item.model} · {statusNames[item.status]}
                    </span>
                  </div>
                  <PriorityPill priority={item.priority} />
                  <ArrowRight size={14} className="signal-item-arrow" />
                </button>
              ))}
            </div>
          ) : (
            <div className="glass-calm-state">
              <div className="calm-icon-wrap">
                <CheckCircle2 size={16} />
              </div>
              <div className="calm-text-wrap">
                <strong>No urgent repairs in queue</strong>
                <small>All active devices operating on schedule.</small>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const OVERVIEW_TEST_POINTS = [
  {
    id: 'tp-soc',
    code: 'TP-102',
    label: 'SOC / CONTROLLER',
    status: '3.3V BUS NOMINAL',
    color: '#42d9ad',
    right: '34.7%',
    top: '52.8%',
    period: '1.8s',
  },
  {
    id: 'tp-vrm',
    code: 'TP-208',
    label: 'VRM / MOSFET RAIL',
    status: '1.15V STABLE',
    color: '#f59e0b',
    right: '17.6%',
    top: '60.4%',
    period: '2.4s',
  },
  {
    id: 'tp-dram',
    code: 'TP-314',
    label: 'LPDDR5 BUS CLOCK',
    status: '100MHz LOCKED',
    color: '#38bdf8',
    right: '23.8%',
    top: '34.0%',
    period: '1.4s',
  },
  {
    id: 'tp-pd',
    code: 'TP-409',
    label: 'TYPE-C POWER DELIVERY',
    status: '20V / 3.25A SINK',
    color: '#10b981',
    right: '11.9%',
    top: '76.4%',
    period: '2.1s',
  },
  {
    id: 'tp-gnd',
    code: 'TP-001',
    label: 'CHASSIS GROUND PAD',
    status: '0.00V REFERENCE',
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
          FAN: 3,420 RPM · 38°C
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
    status: 'OPTICAL FOCUS 100%',
    color: '#38bdf8',
    right: '15.0%',
    top: '57.3%',
    period: '2.0s',
  },
  {
    id: 'q-pmic',
    code: 'PMIC-1',
    label: 'POWER MANAGEMENT IC',
    status: 'VBAT: 3.82V CHARGING',
    color: '#42d9ad',
    right: '9.6%',
    top: '52.1%',
    period: '1.7s',
  },
  {
    id: 'q-ap',
    code: 'SOC-A16',
    label: 'APPLICATION PROCESSOR',
    status: 'LOGIC RAIL 1.10V OK',
    color: '#f59e0b',
    right: '5.5%',
    top: '56.4%',
    period: '2.3s',
  },
  {
    id: 'q-batt',
    code: 'BATT-0',
    label: 'LI-ION CELL TELEMETRY',
    status: 'HEALTH: 94% · 34°C',
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
        <span>OPTICAL RETICLE // 12MP DUAL OIS</span>
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
            <span>DIAGNOSTIC QUEUE // ACTIVE WORKSTATION</span>
          </div>
          <div className="queue-header-row">
            <div className="queue-title-wrap">
              <h1 className="queue-title">Repair queue</h1>
              <span className="queue-count-badge">
                {cases.length} {cases.length === 1 ? 'DEVICE' : 'DEVICES'}
              </span>
            </div>
            <button className="button button-primary queue-new-btn" onClick={onNew}>
              <Plus size={15} /> New repair
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
                placeholder="Search ID, brand, model, issue..."
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
                            title="Delete device"
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
              title="No devices in active queue"
              description="All active devices have been serviced or match none of the filters."
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
    status: 'PROJECTION 100% NOMINAL',
    color: '#38bdf8',
    right: '23.3%',
    top: '33.0%',
    period: '2.0s',
  },
  {
    id: 'd-wave',
    code: 'SIG-GEN',
    label: 'FREQUENCY ANALYZER',
    status: '142.5 MHz NOMINAL',
    color: '#2dd4bf',
    right: '6.2%',
    top: '18.2%',
    period: '1.6s',
  },
  {
    id: 'd-cam',
    code: 'CAM-ARRAY',
    label: 'TRIPLE OPTICAL SENSOR',
    status: 'OIS COIL CALIBRATED',
    color: '#38bdf8',
    right: '26.8%',
    top: '73.8%',
    period: '2.4s',
  },
  {
    id: 'd-soc',
    code: 'AP-SoC',
    label: 'LOGIC BOARD PROCESSOR',
    status: 'CORE VOLTAGE 1.10V OK',
    color: '#f59e0b',
    right: '16.0%',
    top: '69.4%',
    period: '1.8s',
  },
  {
    id: 'd-batt',
    code: 'BATT-TERM',
    label: 'BATTERY CHARGE RAIL',
    status: '3.85V NOMINAL · 32°C',
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
        <span>HOLO-HUD // EXPLODED ASSEMBLY VIEW</span>
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
        <span>142.5 MHz // RF NOMINAL</span>
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
  recordingOutcome,
  testForm,
  setTestForm,
  outcomeForm,
  setOutcomeForm,
  onSelect,
  onAddTest,
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
  recordingOutcome: boolean
  testForm: { test_name: string; result: TestStatus; observed_result: string; details: string }
  setTestForm: Dispatch<SetStateAction<{ test_name: string; result: TestStatus; observed_result: string; details: string }>>
  outcomeForm: { confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' }
  setOutcomeForm: Dispatch<SetStateAction<{ confirmed_fault: string; repair_action: string; outcome: string; status: 'testing' | 'completed' | 'in_repair' }>>
  onSelect: (id: string) => void
  onAddTest: (event: FormEvent<HTMLFormElement>) => void
  onGenerate: () => void
  onSaveOutcome: (event: FormEvent<HTMLFormElement>) => void
  onDelete: (id: string, brand: string, model: string) => void
  onOpenCase: (id: string, tab?: NavId) => void
  settings?: AppSettings
}) {
  const animated = settings?.animationsEnabled ?? true

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
            <span>OPTICAL DIAGNOSTIC LAB // MULTI-SPECTRAL TELEMETRY</span>
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
          <span className="sr-only">Select device</span>
          <select value={selected?.id || ''} onChange={(e) => onSelect(e.target.value)}>
            <option value="" disabled>Select device</option>
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
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>

      <div className="diagnostics-subnav">
        <button
          className={`diagnostics-tab-btn ${diagnosticsTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setDiagnosticsTab('evidence')}
        >
          <Activity size={15} />
          Evidence & Repair Outcome
        </button>
        <button
          className={`diagnostics-tab-btn ${diagnosticsTab === 'recommendation' ? 'active' : ''}`}
          onClick={() => setDiagnosticsTab('recommendation')}
        >
          <Sparkles size={15} />
          AI Recommendation
          {recommendation && <span className="tab-indicator-dot" />}
        </button>
      </div>

      {!selected ? (
        <div className="surface-card">
          <EmptyState
            icon={Stethoscope}
            title="Choose a device"
            description="Select an existing device from the dropdown above to view or enter diagnostic data."
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
                  </div>
                </div>
                <div className="case-symptoms">
                  <span className="meta-label">SYMPTOMS</span>
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

              <section className="surface-card evidence-card">
                <div className="section-card-head">
                  <div>
                    <h3>Diagnostic evidence</h3>
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
                              {test.result.replaceAll('_', ' ')}
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
                    <span>No test results yet. Record the first test below.</span>
                  </div>
                )}

                {selected.status === 'completed' ? (
                  <div className="read-only-note">
                    This case is completed. Reopen to record more tests.
                  </div>
                ) : (
                  <form className="add-test-form" onSubmit={onAddTest}>
                    <div className="form-section-label">ADD A TEST RESULT</div>
                    <div className="form-grid two-cols">
                      <label className="span-two">Test performed
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
                        <textarea required rows={2} value={testForm.observed_result} onChange={(e) => setTestForm((v) => ({ ...v, observed_result: e.target.value }))} placeholder="What was observed?" />
                      </label>
                      <label className="span-two">Notes <span className="label-muted">(optional)</span>
                        <input value={testForm.details} onChange={(e) => setTestForm((v) => ({ ...v, details: e.target.value }))} placeholder="Additional conditions or context" />
                      </label>
                    </div>
                    <div className="form-footer">
                      <button className="button button-dark" type="submit" disabled={recordingTest}>
                        {recordingTest ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} Save test
                      </button>
                    </div>
                  </form>
                )}
              </section>

              <section className="surface-card outcome-card">
                <div className="section-card-head">
                  <div>
                    <h3>Repair outcome</h3>
                  </div>
                </div>
                <form onSubmit={onSaveOutcome} className="outcome-form">
                  <label>Confirmed fault
                    <input required minLength={3} value={outcomeForm.confirmed_fault} onChange={(e) => setOutcomeForm((v) => ({ ...v, confirmed_fault: e.target.value }))} placeholder="Diagnosed fault" />
                  </label>
                  <label>Repair action taken
                    <textarea required minLength={3} rows={2} value={outcomeForm.repair_action} onChange={(e) => setOutcomeForm((v) => ({ ...v, repair_action: e.target.value }))} placeholder="What was repaired or replaced?" />
                  </label>
                  <label>Verification outcome
                    <textarea required minLength={3} rows={2} value={outcomeForm.outcome} onChange={(e) => setOutcomeForm((v) => ({ ...v, outcome: e.target.value }))} placeholder="Final verification result" />
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
                      {recordingOutcome ? <LoaderCircle size={15} className="spin" /> : <CheckCircle2 size={15} />} Save outcome
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {diagnosticsTab === 'recommendation' && (
            <div className="diagnostics-subpage-ai">
              <section className="surface-card ai-clean-copilot">
                <div className="ai-panel-header">
                  <div className="ai-panel-icon"><Sparkles size={18} /></div>
                  <div>
                    <h3>Diagnostic copilot</h3>
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
                      <><LoaderCircle size={15} className="spin" /> Reasoning…</>
                    ) : (
                      <><Sparkles size={15} /> {recommendation ? 'Regenerate recommendation' : 'Generate recommendation'}</>
                    )}
                  </button>
                </div>
              </section>

              {recommendation ? (
                <RecommendationView recommendation={recommendation} stale={stale} />
              ) : (
                <section className="surface-card waiting-panel-clean">
                  <BrainCircuit size={28} className="muted-icon" />
                  <h3>No recommendation generated yet</h3>
                  <p>Click "Generate recommendation" above to produce guided checks from entered evidence.</p>
                </section>
              )}

              {recommendation?.similar_cases && recommendation.similar_cases.length > 0 && (
                <section className="surface-card side-memory-card">
                  <div className="section-card-head">
                    <div>
                      <h3>Related repair memory</h3>
                    </div>
                  </div>
                  <div className="memory-matches-list">
                    {recommendation.similar_cases.map((item) => (
                      <button key={item.id} className="memory-match" onClick={() => onOpenCase(item.id, 'memory')}>
                        <span className="memory-match-icon"><History size={14} /></span>
                        <span>
                          <strong>{item.id} · {item.device}</strong>
                          <small>{item.issue_title}</small>
                          <em>Confirmed: {item.confirmed_fault}</em>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
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

function RecommendationView({ recommendation, stale }: { recommendation: Recommendation; stale: boolean }) {
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
          {isLive ? 'GEMMA 4' : 'LOCAL RULES'}
        </span>
      </div>

      {stale && (
        <div className="stale-banner">
          <AlertCircle size={14} /> New test evidence was added after this recommendation.
        </div>
      )}

      <p className="recommendation-summary">{content.summary}</p>

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
                  {titleCase(hypothesis.likelihood)}
                </span>
              </div>
              <ChevronDown size={14} />
            </button>
            {expandedHypothesis === index && (
              <div className="hypothesis-detail">
                <p>{hypothesis.reasoning}</p>
                {hypothesis.supporting_evidence.length > 0 && (
                  <div className="evidence-chips-group">
                    <span className="evidence-group-label">SUPPORTING</span>
                    {hypothesis.supporting_evidence.map((evidence, i) => (
                      <div className="evidence-chip positive" key={`${evidence}-${i}`}>
                        <Check size={12} /> {evidence}
                      </div>
                    ))}
                  </div>
                )}
                {hypothesis.contradicting_evidence.length > 0 && (
                  <div className="evidence-chips-group">
                    <span className="evidence-group-label">CONTRADICTING</span>
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
          <span className="evidence-group-label">REFERENCE NOTES</span>
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

const MEMORY_TEST_POINTS = [
  {
    id: 'm-tl-1',
    code: 'TIMELINE-01',
    label: 'SCREEN RETRIEVAL ARCHIVE',
    status: 'CASE #1041 · RESTORED',
    color: '#10b981',
    left: '57.7%',
    top: '10.2%',
    period: '2.2s',
  },
  {
    id: 'm-tl-2',
    code: 'TIMELINE-02',
    label: 'LOGIC BOARD DIAGNOSTIC',
    status: 'CASE #1038 · VERIFIED',
    color: '#f59e0b',
    left: '57.7%',
    top: '21.5%',
    period: '2.6s',
  },
  {
    id: 'm-tl-3',
    code: 'TIMELINE-03',
    label: 'ULTRABOOK BATTERY RECOVERY',
    status: 'CASE #1029 · COMPLETED',
    color: '#10b981',
    left: '57.7%',
    top: '33.0%',
    period: '2.0s',
  },
  {
    id: 'm-tl-4',
    code: 'TIMELINE-04',
    label: 'RF ANTENNA CALIBRATION',
    status: 'CASE #1015 · ARCHIVED',
    color: '#38bdf8',
    left: '57.7%',
    top: '44.7%',
    period: '2.4s',
  },
  {
    id: 'm-tl-5',
    code: 'TIMELINE-05',
    label: 'TABLET DIGITIZER FUSION',
    status: 'CASE #1008 · RESTORED',
    color: '#10b981',
    left: '57.7%',
    top: '56.3%',
    period: '2.8s',
  },
  {
    id: 'm-bp-1',
    code: 'HOLO-SCHEMATIC',
    label: 'EXPLODED CHASSIS BLUEPRINT',
    status: '60 FPS RECONSTRUCTION',
    color: '#38bdf8',
    left: '87.4%',
    top: '32.5%',
    period: '3.0s',
  },
  {
    id: 'm-bp-2',
    code: 'BUS-TELEMETRY',
    label: 'SMD VOLTAGE MAP BLUEPRINT',
    status: 'BUS TOPOLOGY NOMINAL',
    color: '#2dd4bf',
    left: '84.0%',
    top: '56.0%',
    period: '2.5s',
  },
  {
    id: 'm-book',
    code: 'BENCH-JOURNAL',
    label: 'ENGINEERING REPAIR LOG',
    status: 'FIELD SCHEMATICS & BENCH DATA',
    color: '#a78bfa',
    left: '77.1%',
    top: '74.4%',
    period: '3.2s',
  },
]

function MemoryCircuitMapOverlay({ animated }: { animated: boolean }) {
  return (
    <svg
      className="memory-circuit-svg"
      viewBox="0 0 1024 571"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="memPulseGrad" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor="#2dd4bf" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="memRailPulseGrad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Desk / wall printed cyan tracks */}
      <path className="m-circuit-base" d="M 0 24 L 95 24 L 144 42 L 210 42" />
      <path className="m-circuit-base" d="M 0 380 L 40 380 L 76 356 L 190 356" />
      <path className="m-circuit-base" d="M 0 545 L 80 545 L 128 530 L 240 530" />

      {/* Vertical Timeline Rail connecting the 5 history cards */}
      <line className="m-timeline-rail-base" x1="591" y1="40" x2="591" y2="340" />

      {/* Animated flowing pulses */}
      {animated && (
        <g className="m-pulses-group">
          <path className="m-circuit-pulse m-flow-1" d="M 0 24 L 95 24 L 144 42 L 210 42" />
          <path className="m-circuit-pulse m-flow-2" d="M 0 380 L 40 380 L 76 356 L 190 356" />
          <path className="m-circuit-pulse m-flow-3" d="M 0 545 L 80 545 L 128 530 L 240 530" />
          <line className="m-timeline-rail-pulse" x1="591" y1="40" x2="591" y2="340" />
        </g>
      )}

      {/* Junction pads at exact photo node positions */}
      <circle className="m-circuit-node" cx="144" cy="42" r="3.5" />
      <circle className="m-circuit-node" cx="76" cy="356" r="3.5" />
      <circle className="m-circuit-node" cx="128" cy="530" r="3.5" />
    </svg>
  )
}

function MemoryHoloOverlay({ animated }: { animated: boolean }) {
  return (
    <div className="memory-holo-anchor" aria-hidden="true">
      {animated && (
        <>
          <div className="holo-reticle-bracket tl" />
          <div className="holo-reticle-bracket tr" />
          <div className="holo-reticle-bracket bl" />
          <div className="holo-reticle-bracket br" />
          <div className="memory-holo-scanbeam" />
        </>
      )}
      <div className="memory-holo-tag">
        <span className="memory-tag-dot" />
        <span>NEURAL BLUEPRINT ARCHIVE // SCHEMATIC MEMORY</span>
      </div>
    </div>
  )
}

function MemoryPage({
  cases,
  query,
  setQuery,
  onOpen,
  onDelete,
  settings,
}: {
  cases: RepairCase[]
  query: string
  setQuery: (value: string) => void
  onOpen: (id: string, tab?: NavId) => void
  onDelete: (id: string, brand: string, model: string) => void
  settings?: AppSettings
}) {
  const animated = settings?.animationsEnabled ?? true

  return (
    <div className="memory-fullscreen-layout">
      {/* Pristine Repair Memory Background Layer */}
      <div className="memory-bg-layer" />

      {/* Atmospheric daylight wash for contrast */}
      <div className="memory-ambient-mask" aria-hidden="true" />

      {/* Wall & desk printed cyan tracks and timeline rail */}
      <MemoryCircuitMapOverlay animated={animated} />

      {/* Holographic blueprint scanbeam & reticle */}
      <MemoryHoloOverlay animated={animated} />

      {/* Optical laser scanner line */}
      {animated && <div className="memory-laser-scanner" aria-hidden="true" />}

      {/* Timeline & Workbench interactive telemetry probes */}
      <div className="memory-probes-layer" aria-hidden="true">
        {MEMORY_TEST_POINTS.map((tp) => (
          <div
            key={tp.id}
            className="memory-smd-probe"
            style={{ left: tp.left, top: tp.top }}
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

      {/* Minimalist 3D Floating Glass HUD Container in Negative Space (53% width) */}
      <div className="memory-negative-hud">
        <div className="memory-hud-header">
          <div className="memory-telemetry-chip">
            <span className="memory-telemetry-dot" />
            <span>HISTORICAL REPAIR ARCHIVE // NEURAL REPAIR MEMORY</span>
          </div>
          <div className="memory-header-row">
            <div className="memory-title-wrap">
              <h1 className="memory-title">Repair memory</h1>
              <span className="memory-count-badge">
                <History size={14} /> {cases.length} completed cases
              </span>
            </div>
          </div>
        </div>

        {/* 3D Glass Search & Filter Bar */}
        <div className="memory-search-card">
          <Search size={18} className="memory-search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search completed devices, confirmed faults, or outcomes..."
            className="memory-search-input"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear memory search"
              className="memory-search-clear"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* 3D Glass Memory Cards Container */}
        <div className="memory-cards-container">
          {cases.length ? (
            <div className="memory-cards-list">
              {cases.map((item) => (
                <div
                  className="memory-card-3d"
                  key={item.id}
                  onClick={() => onOpen(item.id, 'diagnostics')}
                >
                  <div className="memory-card-3d-sheen" />
                  <div className="memory-card-top">
                    <div className="memory-card-icon-chip">
                      <History size={18} />
                    </div>
                    <div className="memory-card-main">
                      <div className="memory-card-title-row">
                        <strong className="memory-card-title">{item.issue_title}</strong>
                        <span className="memory-card-id">{item.id}</span>
                      </div>
                      <div className="memory-device-meta">
                        <span>{item.brand} {item.model}</span>
                        <span className="meta-sep">·</span>
                        <span>{dateLabel(item.updated_at)}</span>
                      </div>
                      <div className="memory-fault-pill">
                        <CheckCircle2 size={14} />
                        <span>Confirmed: <strong>{item.confirmed_fault}</strong></span>
                      </div>
                      <p className="memory-action-desc">{item.repair_action}</p>
                    </div>

                    <div className="memory-card-outcome-pod">
                      <span className="outcome-pod-label">VERIFIED OUTCOME</span>
                      <p className="outcome-pod-text">{item.outcome || 'None'}</p>
                    </div>

                    <div className="memory-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="row-delete-btn"
                        title="Delete record"
                        onClick={() => onDelete(item.id, item.brand, item.model)}
                      >
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={18} className="memory-chevron-3d" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="surface-card memory-empty-card">
              <EmptyState
                icon={History}
                title="No completed repair records"
                description="Devices marked as completed with a confirmed fault appear here."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
