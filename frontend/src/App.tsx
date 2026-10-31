import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Cpu, ExternalLink, Eye, Filter, Github, History, House, Info, Layers3, Linkedin,
  LoaderCircle, Mail, Phone, Plus, RefreshCw, RotateCcw, Search,
  Settings, ShieldCheck, Smartphone, Sparkles, Stethoscope, Trash2,
  Volume2, VolumeX, X, Zap,
  Laptop, Tablet, Headphones, SlidersHorizontal,
  ClipboardCheck, PackageSearch, BrainCircuit,
  Play, Pause, Square, Languages, Radio,
  Box, DollarSign, Wrench, ShieldAlert, Tag,
} from 'lucide-react'
import { api } from './lib/api'
import type {
  CaseDetail, CaseStatus, DashboardSummary, Health,
  NextCheck, Priority, Recommendation, RepairCase, TestStatus,
  Component, ComponentSummary, ComponentHealthStatus,
  ComponentResaleStatus,
} from './lib/types'

import { translations, tContent } from './lib/i18n'
import type { DiagnosticLanguage, I18nCatalog } from './lib/i18n'

const navItems = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'cases', label: 'Repair Queue', icon: Layers3 },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { id: 'components', label: 'Components', icon: PackageSearch },
  { id: 'memory', label: 'Repair Memory', icon: History },
] as const

type NavId = typeof navItems[number]['id']
type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null

export type { DiagnosticLanguage }

export interface AppSettings {
  animationsEnabled: boolean
  hardwareTelemetry: boolean
  highContrastHUD: boolean
  audioEffects: boolean
  modelEngine: 'flash-turbo' | 'gemini-flash' | 'gemma-4' | 'fallback-rules'
  aiAcceleration: boolean
  language: DiagnosticLanguage
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
  aiAcceleration: true,
  language: 'en',
  autoTriageOnCreate: true,
  strictSafety: true,
  confirmDelete: true,
  confirmComplete: true,
  autoArchive: true,
}

const SETTINGS_STORAGE_KEY = 'revix_app_settings_v1'

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

function dateLabel(value: string | null | undefined, lang: DiagnosticLanguage = 'en') {
  if (!value) return translations[lang]?.telemetry.notRecorded || 'Not recorded'
  const date = new Date(value)
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN'
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

function dateTimeLabel(value: string | null | undefined, lang: DiagnosticLanguage = 'en') {
  if (!value) return translations[lang]?.telemetry.notRecorded || 'Not recorded'
  const date = new Date(value)
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN'
  return `${date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
}

function deviceInitials(category: string) {
  if (category.toLowerCase().includes('laptop')) return 'LT'
  if (category.toLowerCase().includes('desktop')) return 'PC'
  return 'PH'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function StatusPill({ status, lang = 'en' }: { status: string; lang?: DiagnosticLanguage }) {
  const normalized = status.replaceAll('_', '-')
  const label = translations[lang]?.statuses[status] || statusNames[status as CaseStatus] || titleCase(status)
  return (
    <span className={`status-pill status-${normalized}`}>
      <span className="status-dot" />
      {label}
    </span>
  )
}

function PriorityPill({ priority, lang = 'en' }: { priority: string; lang?: DiagnosticLanguage }) {
  const label = translations[lang]?.priorities[priority] || priorityNames[priority as Priority] || titleCase(priority)
  return (
    <span className={`priority-pill priority-${priority}`}>
      {priority === 'urgent' && <AlertCircle size={12} />}
      {label}
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
  cancelText = 'Cancel',
  confirmTone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  cancelText?: string
  confirmTone?: 'primary' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!isOpen) return null
  const modalContent = (
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
            {cancelText}
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

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return modalContent
}

function CreditsModal({ isOpen, onClose, t }: { isOpen: boolean; onClose: () => void; t?: I18nCatalog }) {
  if (!isOpen) return null
  const modalContent = (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card credits-modal-card" role="dialog" aria-modal="true">
        <div className="modal-head credits-modal-head">
          <div>
            <span className="eyebrow">{t?.creditsModal.eyebrow || 'HACK DAY AT MICROSOFT'}</span>
            <h2>{t?.creditsModal.title || 'Project Credits'}</h2>
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
                      {member.isLead ? (t?.creditsModal.teamLeader || 'Team Leader') : (t?.creditsModal.engineer || 'Team Member')}
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

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return modalContent
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

  const tStandby = translations[settings.language]?.standby || translations.en.standby

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
          <span>{tStandby.status}</span>
        </div>
        <h2>{tStandby.title}</h2>
        <p>{tStandby.desc}</p>
        <div className="standby-actions">
          <button
            className="game-btn game-btn-primary"
            onClick={() => {
              playUiSound('click', settings)
              onResume()
            }}
          >
            <span className="game-btn-num">&gt;&gt;</span>
            <span className="game-btn-label">{tStandby.resume}</span>
            <span className="game-btn-bracket">]</span>
          </button>
          <button
            className="game-btn game-btn-quit"
            onClick={handleForceClose}
          >
            <span className="game-btn-num">XX</span>
            <span className="game-btn-label">{tStandby.closeTab}</span>
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
          <span>{translations[settings.language]?.awakening.tag || 'OPTICAL CALIBRATION // 100% FOCUS'}</span>
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

function getCategoryIcon(cat: string) {
  const c = (cat || '').toLowerCase()
  if (c.includes('laptop') || c.includes('macbook') || c.includes('computer')) return Laptop
  if (c.includes('tablet') || c.includes('ipad')) return Tablet
  if (c.includes('audio') || c.includes('headphone') || c.includes('earbud')) return Headphones
  return Smartphone
}

function SettingsModal({
  isOpen,
  settings,
  onUpdateSettings,
  onReplayBoot,
  onClose,
  t,
}: {
  isOpen: boolean
  settings: AppSettings
  onUpdateSettings: (updater: (prev: AppSettings) => AppSettings) => void
  onReplayBoot: () => void
  onClose: () => void
  t: I18nCatalog
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

  const modalContent = (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card settings-modal-card" role="dialog" aria-modal="true">
        <div className="modal-head settings-modal-head">
          <div className="settings-head-title">
            <span className="eyebrow">{t.settingsModal.eyebrow}</span>
            <h2>{t.settingsModal.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="settings-modal-body">
          {/* Section 1: Language & Voice Dialect */}
          <div className="settings-section settings-section-highlight">
            <div className="settings-section-head">
              <Languages size={17} />
              <div>
                <h3>{t.settingsModal.langLabel}</h3>
                <span className="settings-section-desc">{t.settingsModal.langDesc}</span>
              </div>
            </div>

            <div className="settings-lang-segmented-bar">
              <button
                type="button"
                className={`lang-segment-btn ${settings.language === 'en' ? 'active' : ''}`}
                onClick={() => {
                  playUiSound('toggle', settings)
                  onUpdateSettings((prev) => ({ ...prev, language: 'en' }))
                }}
              >
                <span className="segment-code">EN</span>
                <span className="segment-title">{t.settingsModal.optEn}</span>
              </button>
              <button
                type="button"
                className={`lang-segment-btn ${settings.language === 'hi' ? 'active' : ''}`}
                onClick={() => {
                  playUiSound('toggle', settings)
                  onUpdateSettings((prev) => ({ ...prev, language: 'hi' }))
                }}
              >
                <span className="segment-code">हिन्दी</span>
                <span className="segment-title">{t.settingsModal.optHi}</span>
              </button>
              <button
                type="button"
                className={`lang-segment-btn ${settings.language === 'hi-Latn' ? 'active' : ''}`}
                onClick={() => {
                  playUiSound('toggle', settings)
                  onUpdateSettings((prev) => ({ ...prev, language: 'hi-Latn' }))
                }}
              >
                <span className="segment-code">Hinglish</span>
                <span className="segment-title">{t.settingsModal.optHiLatn}</span>
              </button>
            </div>
          </div>

          {/* Section 2: AI & Diagnostic Engine */}
          <div className="settings-section">
            <div className="settings-section-head">
              <Cpu size={17} />
              <div>
                <h3>{t.settingsModal.secEngine}</h3>
                <span className="settings-section-desc">{t.settingsModal.engineDesc}</span>
              </div>
            </div>

            <div className="settings-engine-grid">
              {[
                { id: 'flash-turbo' as const, name: t.settingsModal.engineFlashTurbo, badge: 'FASTEST ~1.2s', desc: 'Ultra-low latency streaming for rapid bench triage' },
                { id: 'gemini-flash' as const, name: t.settingsModal.engineFlash, badge: 'BALANCED', desc: 'High diagnostic depth & precision reasoning' },
                { id: 'gemma-4' as const, name: t.settingsModal.engineGemma, badge: 'BENCH MODEL', desc: 'Open architecture with auto turbo acceleration' },
                { id: 'fallback-rules' as const, name: t.settingsModal.engineRules, badge: 'OFFLINE RULES', desc: 'Deterministic hardware schematics & rail checklists' },
              ].map((engine) => {
                const isSelected = settings.modelEngine === engine.id
                return (
                  <button
                    key={engine.id}
                    type="button"
                    className={`settings-engine-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      playUiSound('toggle', settings)
                      onUpdateSettings((prev) => ({ ...prev, modelEngine: engine.id }))
                    }}
                  >
                    <div className="engine-card-header">
                      <span className="engine-card-name">{engine.name}</span>
                      <span className="engine-card-badge">{engine.badge}</span>
                    </div>
                    <p className="engine-card-desc">{engine.desc}</p>
                    {isSelected && <span className="engine-active-dot" />}
                  </button>
                )
              })}
            </div>

            {/* Gemma 4 Turbo Acceleration Toggle */}
            <div className="settings-row" style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--glass-border)' }}>
              <div className="settings-text">
                <span className="settings-label">{t.settingsModal.accelLabel}</span>
                <span className="settings-desc">
                  {settings.aiAcceleration ? t.settingsModal.accelOn : t.settingsModal.accelOff} — {t.settingsModal.accelDesc}
                </span>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  className="switch-input"
                  checked={settings.aiAcceleration}
                  onChange={() => toggle('aiAcceleration')}
                />
                <span className="switch-slider" />
              </label>
            </div>
          </div>

          {/* Section 3: Visual & Motion Telemetry */}
          <div className="settings-section">
            <div className="settings-section-head">
              <Sparkles size={17} />
              <h3>{t.settingsModal.secDisplay}</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">{t.settingsModal.animLabel}</span>
                <span className="settings-desc">{t.settingsModal.animDesc}</span>
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
                <span className="settings-label">{t.settingsModal.oscLabel}</span>
                <span className="settings-desc">{t.settingsModal.oscDesc}</span>
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
                <span className="settings-label">{t.settingsModal.contrastLabel}</span>
                <span className="settings-desc">{t.settingsModal.contrastDesc}</span>
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
                <RotateCcw size={13} /> {t.settingsModal.replayCalibration}
              </button>
            </div>
          </div>

          {/* Section 4: Workshop Workflow & Safety Guardrails */}
          <div className="settings-section">
            <div className="settings-section-head">
              <ShieldCheck size={17} />
              <h3>{t.settingsModal.secWorkflow}</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">{t.settingsModal.autoTriageLabel}</span>
                <span className="settings-desc">{t.settingsModal.autoTriageDesc}</span>
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
                <span className="settings-label">{t.settingsModal.safetyLabel}</span>
                <span className="settings-desc">{t.settingsModal.safetyDesc}</span>
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

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">{t.settingsModal.confirmDeleteLabel}</span>
                <span className="settings-desc">{t.settingsModal.confirmDeleteDesc}</span>
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
                <span className="settings-label">{t.settingsModal.confirmCompleteLabel}</span>
                <span className="settings-desc">{t.settingsModal.confirmCompleteDesc}</span>
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
                <span className="settings-label">{t.settingsModal.autoArchiveLabel}</span>
                <span className="settings-desc">{t.settingsModal.autoArchiveDesc}</span>
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

          {/* Section 5: Audio Haptics */}
          <div className="settings-section">
            <div className="settings-section-head">
              {settings.audioEffects ? <Volume2 size={17} /> : <VolumeX size={17} />}
              <h3>{t.settingsModal.secAudio}</h3>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <span className="settings-label">{t.settingsModal.audioLabel}</span>
                <span className="settings-desc">{t.settingsModal.audioDesc}</span>
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
            {t.settingsModal.resetBtn}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              playUiSound('click', settings)
              onClose()
            }}
          >
            {t.settingsModal.closeBtn}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return modalContent
}

function DeviceSelectionModal({
  isOpen,
  cases,
  selectedId,
  onSelect,
  onClose,
  t,
  settings,
}: {
  isOpen: boolean
  cases: RepairCase[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
  t: I18nCatalog
  settings?: AppSettings
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  if (!isOpen) return null

  const filtered = cases.filter((c) => {
    if (categoryFilter !== 'all' && c.device_category.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false
    }
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.id.toLowerCase().includes(q) ||
      c.brand.toLowerCase().includes(q) ||
      c.model.toLowerCase().includes(q) ||
      c.issue_title.toLowerCase().includes(q) ||
      c.symptoms.toLowerCase().includes(q)
    )
  })

  const rawCategories = Array.from(new Set(cases.map((c) => c.device_category).filter(Boolean)))
  const categories = ['all', ...rawCategories]

  const modalContent = (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card device-selection-card" role="dialog" aria-modal="true">
        <div className="modal-head device-modal-head">
          <div className="device-modal-title-wrap">
            <span className="eyebrow">{t.diagnostics.telemetry}</span>
            <h2>{t.diagnostics.deviceModalTitle}</h2>
            <p className="device-modal-sub">{t.diagnostics.deviceModalSub}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="device-modal-toolbar">
          <div className="device-search-wrap">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="device-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.diagnostics.deviceModalSearch}
              autoFocus
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch('')}>
                <X size={13} />
              </button>
            )}
          </div>

          <div className="device-category-pills">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-pill ${categoryFilter.toLowerCase() === cat.toLowerCase() ? 'active' : ''}`}
                onClick={() => {
                  if (settings) playUiSound('toggle', settings)
                  setCategoryFilter(cat)
                }}
              >
                {cat === 'all' ? t.cases.allStatuses || 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="device-modal-grid">
          {filtered.length === 0 ? (
            <div className="device-modal-empty">
              <Stethoscope size={36} className="empty-icon" />
              <h4>{t.diagnostics.deviceModalNoResults}</h4>
              <p>{t.cases.emptyDesc}</p>
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = item.id === selectedId
              const CategoryIcon = getCategoryIcon(item.device_category)
              return (
                <div
                  key={item.id}
                  className={`device-card-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    if (settings) playUiSound('click', settings)
                    onSelect(item.id)
                    onClose()
                  }}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (settings) playUiSound('click', settings)
                      onSelect(item.id)
                      onClose()
                    }
                  }}
                >
                  <div className="device-card-top">
                    <div className="device-card-identity">
                      <div className="device-cat-icon">
                        <CategoryIcon size={18} />
                      </div>
                      <div>
                        <span className="device-case-id">{item.id}</span>
                        <h4 className="device-brand-model">{item.brand} {item.model}</h4>
                      </div>
                    </div>
                    <div className="device-card-badges">
                      <PriorityPill priority={item.priority} lang={settings?.language} />
                      <StatusPill status={item.status} lang={settings?.language} />
                    </div>
                  </div>

                  <div className="device-card-issue">
                    <span className="issue-label">{t.diagnostics.symptoms}:</span>
                    <p className="issue-text">{tContent(item.issue_title, settings?.language)}</p>
                  </div>

                  <div className="device-card-footer">
                    <span className="device-test-count">
                      <Activity size={12} /> {item.test_count || 0} {t.diagnostics.tests}
                    </span>
                    {isSelected ? (
                      <span className="device-selected-indicator">
                        <Check size={13} /> {t.diagnostics.deviceModalActive}
                      </span>
                    ) : (
                      <span className="device-select-action">
                        {t.diagnostics.selectDevice} <ArrowRight size={12} />
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return modalContent
}

function NewRepairModal({
  onClose,
  onCreate,
  busy,
  t,
  settings,
}: {
  onClose: () => void
  onCreate: (data: Record<string, string>) => Promise<void>
  busy: boolean
  t?: I18nCatalog
  settings?: AppSettings
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
    suspected_component: '',
  })
  const [localError, setLocalError] = useState('')
  const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')
    if (form.symptoms.trim().length < 5) {
      setLocalError(t?.intake.errorSymptomsShort || 'Add more detail about the reported symptoms.')
      return
    }
    await onCreate(form)
  }

  const categoryOptions = [
    { id: 'Smartphone', label: t?.intake.categories.Smartphone || 'Smartphone', icon: Smartphone },
    { id: 'Laptop', label: t?.intake.categories.Laptop || 'Laptop', icon: Laptop },
    { id: 'Desktop', label: t?.intake.categories.Desktop || 'Desktop', icon: Cpu },
    { id: 'Tablet', label: t?.intake.categories.Tablet || 'Tablet', icon: Tablet },
    { id: 'Other electronics', label: t?.intake.categories['Other electronics'] || 'Other', icon: Zap },
  ]

  const priorityOptions = [
    { id: 'low', label: t?.priorities.low || 'Low', cls: 'pri-low' },
    { id: 'normal', label: t?.priorities.normal || 'Normal', cls: 'pri-normal' },
    { id: 'high', label: t?.priorities.high || 'High', cls: 'pri-high' },
    { id: 'urgent', label: t?.priorities.urgent || 'Urgent', cls: 'pri-urgent' },
  ]

  const diagnosticPresets = [
    {
      label: '⚡ No Power / Dead 5V Rail',
      issue: 'Device does not turn on / dead 5V rail',
      symptoms: 'Zero current draw on USB bench meter (0.00A). Board remains cold; short circuit or open fuse suspected on main power rail.',
      part: 'Primary PMIC / Charging IC',
    },
    {
      label: '🔌 Intermittent Port Drop',
      issue: 'Charging disconnects intermittently',
      symptoms: 'Charging negotiation drops when cable angle shifts. Port pin wear and CC line diode drop verification needed.',
      part: 'USB-C Charging Sub-Board',
    },
    {
      label: '🖥️ Dark Screen / Backlight Fault',
      issue: 'Display dark / backlight circuit fault',
      symptoms: 'Device vibrates and boots with audio chime but display panel stays dark. Backlight boost circuit or flex check required.',
      part: 'AMOLED / LCD Display Flex',
    },
    {
      label: '🔋 Battery Heat / Swelling',
      issue: 'Excessive warmth while charging',
      symptoms: 'Unusual heat concentrated around battery cell during charge. Swelling check and internal impedance verification required.',
      part: 'Lithium-Ion Battery Cell',
    },
    {
      label: '❄️ System Freeze / Logic Board Hang',
      issue: 'Hangs on boot / logic board stall',
      symptoms: 'Device powers on but hangs at initial splash or desktop; keyboard and cursor unresponsive. Secondary voltage rail drop suspected.',
      part: 'Logic Board / NAND Controller',
    },
  ]

  const modalContent = (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-card intake-modal-card" role="dialog" aria-modal="true" aria-labelledby="new-repair-title">
        <div className="modal-head intake-modal-head">
          <div className="intake-head-title">
            <span className="eyebrow">
              <span className="live-status-dot" />
              INTAKE TERMINAL // BENCH CASE REGISTRATION
            </span>
            <h2 id="new-repair-title">{t?.intake.title || 'New Repair Case Registration'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form intake-modal-form" onSubmit={submit}>
          {/* Step 1: Device Category Selection Cards */}
          <div className="intake-section">
            <label className="intake-section-label">{t?.intake.category || 'Device Category'}</label>
            <div className="intake-category-grid">
              {categoryOptions.map((cat) => {
                const Icon = cat.icon
                const isSelected = form.device_category === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`intake-cat-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      playUiSound('toggle', settings || DEFAULT_SETTINGS)
                      setField('device_category', cat.id)
                    }}
                  >
                    <Icon size={18} />
                    <span>{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step 2: One-Click Quick Presets */}
          <div className="intake-presets-box">
            <span className="intake-presets-title">
              <Sparkles size={13} />
              {t?.intake.quickPresets || 'Diagnostic Presets'}:
            </span>
            <div className="intake-presets-list">
              {diagnosticPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="intake-preset-pill"
                  onClick={() => {
                    playUiSound('click', settings || DEFAULT_SETTINGS)
                    setField('issue_title', preset.issue)
                    setField('symptoms', preset.symptoms)
                    if (preset.part && !form.suspected_component) {
                      setField('suspected_component', preset.part)
                    }
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Hardware Specifications */}
          <div className="form-grid two-cols">
            <label>
              {t?.intake.brand || 'Hardware Brand'} *
              <input
                required
                maxLength={80}
                value={form.brand}
                onChange={(e) => setField('brand', e.target.value)}
                placeholder={t?.intake.brandPlaceholder || 'e.g. Samsung, Apple, Lenovo'}
              />
            </label>
            <label>
              {t?.intake.model || 'Model / Revision'} *
              <input
                required
                maxLength={100}
                value={form.model}
                onChange={(e) => setField('model', e.target.value)}
                placeholder={t?.intake.modelPlaceholder || 'e.g. Galaxy A54, MacBook Air M2'}
              />
            </label>
          </div>

          {/* Step 4: Reported Issue & Detailed Symptoms */}
          <div className="form-grid">
            <label>
              {t?.intake.issueTitle || 'Reported Issue Summary'} *
              <input
                required
                minLength={4}
                maxLength={160}
                value={form.issue_title}
                onChange={(e) => setField('issue_title', e.target.value)}
                placeholder={t?.intake.issuePlaceholder || 'e.g. Charging disconnects intermittently'}
              />
            </label>

            <label>
              {t?.intake.symptoms || 'Detailed Observations / Telemetry'} *
              <textarea
                required
                minLength={5}
                rows={3}
                value={form.symptoms}
                onChange={(e) => setField('symptoms', e.target.value)}
                placeholder={t?.intake.symptomsPlaceholder || 'What was observed during intake? Include rail voltages or physical signs if noted.'}
              />
            </label>
          </div>

          {/* Step 5: Phase 1 Component Health Tracker Integration */}
          <div className="intake-component-seed-box">
            <label>
              <Cpu size={14} />
              {t?.intake.suspectedPart || 'Suspected Component (Phase 1 Tracker)'}
              <span className="label-muted">· Auto-initializes component health tracking</span>
            </label>
            <input
              value={form.suspected_component}
              onChange={(e) => setField('suspected_component', e.target.value)}
              placeholder="e.g. USB-C Charging Sub-Board, Battery Pack, Display Module, Power PMIC..."
            />
          </div>

          {/* Step 6: Priority & Customer Contact */}
          <div className="form-grid two-cols">
            <div>
              <label className="intake-sublabel">{t?.intake.priority || 'Priority Level'}</label>
              <div className="intake-priority-bar">
                {priorityOptions.map((pri) => (
                  <button
                    key={pri.id}
                    type="button"
                    className={`intake-pri-btn ${pri.cls} ${form.priority === pri.id ? 'active' : ''}`}
                    onClick={() => {
                      playUiSound('toggle', settings || DEFAULT_SETTINGS)
                      setField('priority', pri.id)
                    }}
                  >
                    <span>{pri.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <label>
              {t?.intake.customerContact || 'Customer Contact'} <span className="label-muted">{t?.intake.contactHint || '(phone or email)'}</span>
              <input
                value={form.customer_contact}
                onChange={(e) => setField('customer_contact', e.target.value)}
                placeholder={t?.intake.contactPlaceholder || '+91 98765 43210 or user@example.com'}
              />
            </label>
          </div>

          {localError && (
            <div className="inline-error">
              <AlertCircle size={15} />
              {localError}
            </div>
          )}

          <div className="modal-actions intake-modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>
              {t?.intake.cancel || 'Cancel'}
            </button>
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
              <span>{busy ? (t?.intake.creating || 'Registering…') : (t?.intake.register || 'Register Device')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }
  return modalContent
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
  t,
}: {
  onNavigate: (tab: NavId) => void
  onNewRepair: () => void
  onOpenCredits: () => void
  onOpenSettings: () => void
  onQuit: () => void
  settings: AppSettings
  t: I18nCatalog
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
            <span>{t.home.status}</span>
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
              <span>{t.home.matrix}</span>
            </div>
          )}
        </div>

        <div className="game-title-wrap">
          <div className="game-title-eyebrow">
            <Zap size={14} className="hud-bolt" />
            <span>{t.home.eyebrow}</span>
          </div>
          <h1 className="game-main-title">
            REVIX<span className="game-title-dot">.AI</span>
          </h1>
          <p className="game-tagline">
            {t.home.tagline}
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
            <span className="game-btn-label">{t.home.menuNew}</span>
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
            <span className="game-btn-label">{t.home.menuOverview}</span>
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
            <span className="game-btn-label">{t.home.menuQueue}</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn"
            style={{ '--btn-idx': 4 } as React.CSSProperties}
            onClick={() => {
              playUiSound('click', settings)
              onNavigate('components')
            }}
          >
            <span className="game-btn-num">04</span>
            <span className="game-btn-label">{t.home.menuComponents}</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn"
            style={{ '--btn-idx': 5 } as React.CSSProperties}
            onClick={() => {
              playUiSound('click', settings)
              onOpenSettings()
            }}
          >
            <span className="game-btn-num">05</span>
            <span className="game-btn-label">{t.home.menuSettings}</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn"
            style={{ '--btn-idx': 6 } as React.CSSProperties}
            onClick={() => {
              playUiSound('click', settings)
              onOpenCredits()
            }}
          >
            <span className="game-btn-num">06</span>
            <span className="game-btn-label">{t.home.menuCredits}</span>
            <span className="game-btn-bracket">]</span>
          </button>

          <button
            className="game-btn game-btn-quit"
            style={{ '--btn-idx': 7 } as React.CSSProperties}
            onClick={onQuit}
          >
            <span className="game-btn-num">07</span>
            <span className="game-btn-label">{t.home.menuQuit}</span>
            <span className="game-btn-bracket">]</span>
          </button>
        </nav>

        <div className="game-hud-bottom">
          <span className="hud-code-hint">
            {t.home.footerHint}
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
    return !sessionStorage.getItem('revix_booted_session')
  })

  // Reactive whole-application internationalization catalog
  const t: I18nCatalog = translations[settings.language] || translations.en

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
  const [diagnosticsTab, setDiagnosticsTab] = useState<'evidence' | 'components' | 'recommendation'>('evidence')
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
        suspected_component: form.suspected_component || undefined,
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
        void api.recommendation(created.id, settings.modelEngine, settings.language, settings.aiAcceleration)
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
    const startTime = performance.now()
    try {
      const result = await api.recommendation(selectedDetail.id, settings.modelEngine, settings.language, settings.aiAcceleration)
      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1)
      setRecommendation(result)
      await Promise.all([
        refreshLists(),
        loadDetail(selectedDetail.id),
      ])
      setRecommendation((current) => (current ? { ...current, similar_cases: result.similar_cases } : result))
      const engineLabel =
        result.provider === 'rule_based_fallback'
          ? 'Local rules'
          : result.model_name.includes('flash')
          ? 'Turbo Flash'
          : 'Gemma 4'
      const langLabel =
        settings.language === 'hi'
          ? ' · हिन्दी'
          : settings.language === 'hi-Latn'
          ? ' · Hinglish'
          : ''
      flash('success', `Diagnostic generated in ${elapsedSec}s via ${engineLabel}${langLabel}.`)
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
              t={t}
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
              t={t}
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
              t={t}
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
              onReloadDetail={async () => {
                if (selectedId) await loadDetail(selectedId)
              }}
              onNavigateComponents={() => setActiveNav('components')}
              settings={settings}
              onUpdateSettings={setSettings}
              flash={flash}
              t={t}
            />
          </div>
        )}

        {!isHome && activeNav === 'components' && (
          <div key="components" className="page-transition-wrap components-fullscreen-wrap">
            <ComponentsPage
              settings={settings}
              t={t}
              onNavigateCase={(caseId) => {
                openCase(caseId)
              }}
              flash={flash}
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
              t={t}
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
              const tooltipLabel = t.nav[item.id] || item.label
              return (
                <button
                  key={item.id}
                  className={`dock-item ${isActive ? 'dock-item-active' : ''}`}
                  onClick={() => {
                    playUiSound('click', settings)
                    setActiveNav(item.id)
                  }}
                  aria-label={tooltipLabel}
                >
                  <span className="dock-tooltip">{tooltipLabel}</span>
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
                  .then(() => flash('success', t.telemetry.refreshed))
                  .catch((error) => flash('error', errorMessage(error)))
              }}
              aria-label={t.telemetry.refreshed}
            >
              <span className="dock-tooltip">{settings.language === 'hi' ? 'ताज़ा करें' : settings.language === 'hi-Latn' ? 'Refresh karein' : 'Refresh'}</span>
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
              aria-label={t.nav.settings}
            >
              <span className="dock-tooltip">{t.nav.settings}</span>
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
              aria-label={t.nav.newRepair}
            >
              <span className="dock-tooltip">{t.nav.newRepair}</span>
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
        t={t}
      />

      {isHome && isBooting && (
        <LightDiagnosticAwakening
          enabled={settings.animationsEnabled}
          settings={settings}
          onComplete={() => {
            setIsBooting(false)
            sessionStorage.setItem('revix_booted_session', 'true')
          }}
        />
      )}

      {showNewRepair && (
        <NewRepairModal onClose={() => setShowNewRepair(false)} onCreate={createRepair} busy={busy} t={t} settings={settings} />
      )}

      <CreditsModal isOpen={showCredits} onClose={() => setShowCredits(false)} t={t} />

      <StandbyModal isOpen={showStandby} onResume={() => setShowStandby(false)} settings={settings} />

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title={t.deleteModal.title}
        message={`${t.deleteModal.desc} (${deleteModal.name} - ${deleteModal.caseId})`}
        confirmText={t.deleteModal.confirm}
        cancelText={t.deleteModal.cancel}
        confirmTone="danger"
        busy={busy}
        onConfirm={confirmDeleteDevice}
        onCancel={() => setDeleteModal({ isOpen: false, caseId: '', name: '' })}
      />

      <ConfirmModal
        isOpen={completeModal.isOpen}
        title={t.deleteModal.confirmCompleteTitle}
        message={`${completeModal.caseId}: ${t.deleteModal.confirmCompleteMsg}`}
        confirmText={t.deleteModal.confirmCompleteBtn}
        cancelText={t.deleteModal.cancel}
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
  t,
}: {
  dashboard: DashboardSummary | null
  cases: RepairCase[]
  onOpen: (id: string, tab?: NavId) => void
  onNavigate: (tab: NavId) => void
  settings: AppSettings
  aiActive?: boolean
  t: I18nCatalog
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
      <OverviewFanOverlay animated={settings.animationsEnabled} lang={settings.language} />

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
              <span className="probe-desc">{tContent(tp.label, settings.language)}</span>
              <span className="probe-val" style={{ color: tp.color }}>{tContent(tp.status, settings.language)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Minimalist Floating Glass HUD Container in Negative Space */}
      <div className="overview-negative-hud">
        <div className="overview-hud-header">
          <div className="overview-telemetry-chip">
            <span className={`overview-telemetry-dot ${aiActive ? 'online' : ''}`} />
            <span>{t.overview.telemetry}</span>
          </div>
          <h1>{t.overview.title}</h1>
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
            <div className="glass-card-title">{t.overview.activeRepairs}</div>
            <div className="glass-card-detail">{t.overview.activeRepairsDesc}</div>
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
            <div className="glass-card-title">{t.overview.readyForTesting}</div>
            <div className="glass-card-detail">{t.overview.readyForTestingDesc}</div>
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
            <div className="glass-card-title">{t.overview.savedPrecedents}</div>
            <div className="glass-card-detail">{t.overview.savedPrecedentsDesc}</div>
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
            <div className="glass-card-title">{t.nav.memory}</div>
            <div className="glass-card-detail">{t.overview.savedPrecedentsDesc}</div>
          </button>
        </div>

        {/* Minimalist Glass Attention Needed Card */}
        <section className="overview-glass-attention">
          <div className="glass-attention-head">
            <div className="glass-attention-title">
              <span className="attention-indicator">
                <AlertTriangle size={15} />
              </span>
              <h3>{t.overview.needsAttention}</h3>
            </div>
            <span className={`attention-count-badge ${urgent.length > 0 ? 'badge-urgent' : 'badge-calm'}`}>
              {urgent.length} {urgent.length === 1 ? t.overview.issuesSingular : t.overview.issuesPlural}
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
                    <strong className="signal-item-title">{tContent(item.issue_title, settings.language)}</strong>
                    <span className="signal-item-meta">
                      {item.id} · {item.brand} {item.model} · {translations[settings.language]?.statuses[item.status] || statusNames[item.status]}
                    </span>
                  </div>
                  <PriorityPill priority={item.priority} lang={settings.language} />
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
                <strong>{t.overview.noUrgentTitle}</strong>
                <small>{t.overview.noUrgentDesc}</small>
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

function OverviewFanOverlay({ animated, lang = 'en' }: { animated: boolean; lang?: DiagnosticLanguage }) {
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
          {translations[lang]?.telemetry.fan || 'FAN: 3,420 RPM · 38°C'}
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

function QueueCameraFocusOverlay({ animated, lang = 'en' }: { animated: boolean; lang?: DiagnosticLanguage }) {
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
        <span>{translations[lang]?.telemetry.cameraReticle || 'OPTICAL RETICLE // 12MP DUAL OIS'}</span>
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
  t,
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
  t: I18nCatalog
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
      <QueueCameraFocusOverlay animated={animated} lang={settings.language} />

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
              <span className="probe-desc">{tContent(tp.label, settings.language)}</span>
              <span className="probe-val" style={{ color: tp.color }}>{tContent(tp.status, settings.language)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Minimalist Floating Glass HUD Container in Negative Space */}
      <div className="queue-negative-hud">
        <div className="queue-hud-header">
          <div className="queue-telemetry-chip">
            <span className="queue-telemetry-dot" />
            <span>{t.cases.telemetry}</span>
          </div>
          <div className="queue-header-row">
            <div className="queue-title-wrap">
              <h1 className="queue-title">{t.cases.title}</h1>
              <span className="queue-count-badge">
                {cases.length} {cases.length === 1 ? t.cases.devicesSingular : t.cases.devicesPlural}
              </span>
            </div>
            <button className="button button-primary queue-new-btn" onClick={onNew}>
              <Plus size={15} /> {t.nav.newRepair}
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
                placeholder={t.cases.searchPlaceholder}
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
                  <option value="all">{t.cases.allStatuses}</option>
                  <option value="new">{t.statuses.new}</option>
                  <option value="diagnosing">{t.statuses.diagnosing}</option>
                  <option value="waiting_parts">{t.statuses.waiting_parts}</option>
                  <option value="in_repair">{t.statuses.in_repair}</option>
                  <option value="testing">{t.statuses.testing}</option>
                  <option value="on_hold">{t.statuses.on_hold}</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="filter-select">
                <select
                  aria-label="Filter by priority"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">{t.cases.allPriorities}</option>
                  <option value="urgent">{t.priorities.urgent}</option>
                  <option value="high">{t.priorities.high}</option>
                  <option value="normal">{t.priorities.normal}</option>
                  <option value="low">{t.priorities.low}</option>
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
                    <th>{t.cases.colDevice}</th>
                    <th>{t.cases.colIssue}</th>
                    <th>{t.cases.colStatus}</th>
                    <th>{t.cases.colPriority}</th>
                    <th>{t.cases.customerContactCol}</th>
                    <th style={{ textAlign: 'right' }}>{t.cases.colActions}</th>
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
                            <span>{item.brand} {item.model} · {tContent(item.device_category, settings.language)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="issue-cell">
                          <strong>{tContent(item.issue_title, settings.language)}</strong>
                          <span className="issue-snippet">{tContent(item.symptoms, settings.language)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="status-cell">
                          <StatusPill status={item.status} lang={settings.language} />
                          <select
                            className="status-edit-select"
                            aria-label={`Change status for ${item.id}`}
                            value={item.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onStatus(item.id, e.target.value as CaseStatus)}
                          >
                            <option value="new">{t.statuses.new}</option>
                            <option value="diagnosing">{t.statuses.diagnosing}</option>
                            <option value="waiting_parts">{t.statuses.waiting_parts}</option>
                            <option value="in_repair">{t.statuses.in_repair}</option>
                            <option value="testing">{t.statuses.testing}</option>
                            <option value="completed">{t.statuses.completed}</option>
                            <option value="on_hold">{t.statuses.on_hold}</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <PriorityPill priority={item.priority} lang={settings.language} />
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
              title={t.cases.emptyTitle}
              description={t.cases.emptyDesc}
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

function DiagnosticsHoloOverlay({ animated, lang = 'en' }: { animated: boolean; lang?: DiagnosticLanguage }) {
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
        <span>{translations[lang]?.telemetry.holoReticle || 'HOLO-HUD // EXPLODED ASSEMBLY VIEW'}</span>
      </div>
    </div>
  )
}

function DiagnosticsWaveformOverlay({ animated, lang = 'en' }: { animated: boolean; lang?: DiagnosticLanguage }) {
  return (
    <div className="diagnostics-waveform-anchor" aria-hidden="true">
      {animated && <div className="waveform-signal-pulse" />}
      <div className="waveform-telemetry-pill">
        <span className="waveform-dot" />
        <span>{translations[lang]?.telemetry.waveform || '142.5 MHz // RF NOMINAL'}</span>
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
  onReloadDetail,
  onNavigateComponents,
  settings,
  onUpdateSettings,
  flash,
  t,
}: {
  selected: CaseDetail | null
  cases: RepairCase[]
  diagnosticsTab: 'evidence' | 'components' | 'recommendation'
  setDiagnosticsTab: (tab: 'evidence' | 'components' | 'recommendation') => void
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
  onReloadDetail?: () => Promise<void>
  onNavigateComponents?: () => void
  settings?: AppSettings
  onUpdateSettings?: Dispatch<SetStateAction<AppSettings>>
  flash?: (type: 'success' | 'error' | 'info', message: string) => void
  t: I18nCatalog
}) {
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false)
  const [updatingComponent, setUpdatingComponent] = useState<Component | null>(null)
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
      <DiagnosticsHoloOverlay animated={animated} lang={settings?.language} />

      {/* Frequency / Oscilloscope Waveform Monitor */}
      <DiagnosticsWaveformOverlay animated={animated} lang={settings?.language} />

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
              <span className="probe-desc">{tContent(tp.label, settings?.language)}</span>
              <span className="probe-val" style={{ color: tp.color }}>{tContent(tp.status, settings?.language)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Minimalist Floating Glass HUD Container taking 70% width */}
      <div className="diagnostics-negative-hud">
        <div className="diagnostics-hud-header">
          <div className="diagnostics-telemetry-chip">
            <span className="diagnostics-telemetry-dot" />
            <span>{t.diagnostics.telemetry}</span>
          </div>
          <div className="diagnostics-header-row">
            <h1 className="diagnostics-title">{t.diagnostics.title}</h1>
            {selected && (
              <span className="diagnostics-device-chip">
                {selected.id} · {selected.brand} {selected.model}
              </span>
            )}
          </div>
        </div>

      <div className="diagnostic-select-bar">
        <div className="select-case-mark"><Stethoscope size={16} /></div>
        <button
          type="button"
          className="diagnostic-select-card-trigger"
          onClick={() => {
            if (settings) playUiSound('click', settings)
            setShowDeviceModal(true)
          }}
          title={t.diagnostics.selectDevice}
        >
          <div className="trigger-device-info">
            {selected ? (
              <span className="trigger-device-summary">
                <span className="trigger-case-badge">{selected.id}</span>
                <span className="trigger-device-name">{selected.brand} {selected.model}</span>
                <span className="trigger-device-sep">—</span>
                <span className="trigger-device-issue">{tContent(selected.issue_title, settings?.language)}</span>
              </span>
            ) : (
              <span className="trigger-device-empty">{t.diagnostics.selectDevice}</span>
            )}
          </div>
          <span className="trigger-action-pill">
            <SlidersHorizontal size={13} />
            <span>{selected ? t.diagnostics.changeDevice : t.diagnostics.selectDevice}</span>
            <ChevronRight size={13} />
          </span>
        </button>
        {selected && <StatusPill status={selected.status} lang={settings?.language} />}
        {selected && (
          <button
            className="button button-ghost-danger button-sm"
            onClick={() => onDelete(selected.id, selected.brand, selected.model)}
            title={t.diagnostics.delete}
          >
            <Trash2 size={14} /> <span className="hide-on-mobile">{t.diagnostics.delete}</span>
          </button>
        )}
      </div>

      <DeviceSelectionModal
        isOpen={showDeviceModal}
        cases={cases}
        selectedId={selected?.id || null}
        onSelect={(id) => {
          onSelect(id)
          setShowDeviceModal(false)
        }}
        onClose={() => setShowDeviceModal(false)}
        t={t}
        settings={settings}
      />

      <div className="diagnostics-subnav">
        <button
          className={`diagnostics-tab-btn ${diagnosticsTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setDiagnosticsTab('evidence')}
        >
          <Activity size={15} />
          {t.diagnostics.tabEvidence}
        </button>
        <button
          className={`diagnostics-tab-btn ${diagnosticsTab === 'components' ? 'active' : ''}`}
          onClick={() => setDiagnosticsTab('components')}
        >
          <Cpu size={15} />
          {t.diagnostics.tabComponents}
          {selected?.components && selected.components.length > 0 && (
            <span className="tab-count-badge">{selected.components.length}</span>
          )}
        </button>
        <button
          className={`diagnostics-tab-btn ${diagnosticsTab === 'recommendation' ? 'active' : ''}`}
          onClick={() => setDiagnosticsTab('recommendation')}
        >
          <Sparkles size={15} />
          {t.diagnostics.tabRecommendation}
          {recommendation && <span className="tab-indicator-dot" />}
        </button>
      </div>

      {!selected ? (
        <div className="surface-card">
          <EmptyState
            icon={Stethoscope}
            title={t.diagnostics.chooseDeviceTitle}
            description={t.diagnostics.chooseDeviceDesc}
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
                      <PriorityPill priority={selected.priority} lang={settings?.language} />
                    </div>
                    <h2>{tContent(selected.issue_title, settings?.language)}</h2>
                    <p>{selected.brand} {selected.model} · {tContent(selected.device_category, settings?.language)}</p>
                  </div>
                  <div className="case-overview-status">
                    <StatusPill status={selected.status} lang={settings?.language} />
                  </div>
                </div>
                <div className="case-symptoms">
                  <span className="meta-label">{t.diagnostics.symptoms}</span>
                  <p>{tContent(selected.symptoms, settings?.language)}</p>
                </div>
                <div className="case-overview-foot">
                  <span><Clock3 size={13} /> {dateLabel(selected.created_at, settings?.language)}</span>
                  {selected.customer_contact && (
                    <span><Phone size={13} /> {selected.customer_contact}</span>
                  )}
                  <span><Activity size={13} /> {selected.tests.length} {t.diagnostics.tests}</span>
                </div>

                {selected.components && selected.components.length > 0 ? (
                  <div
                    className="case-components-quick-strip"
                    onClick={() => {
                      if (settings) playUiSound('click', settings)
                      setDiagnosticsTab('components')
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="strip-left">
                      <Cpu size={14} className="strip-icon" />
                      <span className="strip-label">{t.diagnostics.tabComponents}:</span>
                      <div className="strip-badges">
                        {selected.components.filter(c => c.health_status === 'working').length > 0 && (
                          <span className="badge-pill badge-health badge-health-working">
                            {selected.components.filter(c => c.health_status === 'working').length} {t.components.healthStatuses.working}
                          </span>
                        )}
                        {selected.components.filter(c => c.health_status === 'needs_testing').length > 0 && (
                          <span className="badge-pill badge-health badge-health-needs_testing">
                            {selected.components.filter(c => c.health_status === 'needs_testing').length} {t.components.healthStatuses.needs_testing}
                          </span>
                        )}
                        {selected.components.filter(c => c.health_status === 'faulty').length > 0 && (
                          <span className="badge-pill badge-health badge-health-faulty">
                            {selected.components.filter(c => c.health_status === 'faulty').length} {t.components.healthStatuses.faulty}
                          </span>
                        )}
                        {selected.components.filter(c => c.health_status === 'unknown').length > 0 && (
                          <span className="badge-pill badge-health badge-health-unknown">
                            {selected.components.filter(c => c.health_status === 'unknown').length} {t.components.healthStatuses.unknown}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="strip-action">
                      <span>View Health</span>
                      <ChevronRight size={13} />
                    </span>
                  </div>
                ) : (
                  <div
                    className="case-components-quick-strip empty"
                    onClick={() => {
                      if (settings) playUiSound('click', settings)
                      setDiagnosticsTab('components')
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="strip-left">
                      <Cpu size={14} className="strip-icon" />
                      <span className="strip-label">Track electronic components for multimeter verification</span>
                    </div>
                    <span className="strip-action">
                      <span>+ Track</span>
                      <ChevronRight size={13} />
                    </span>
                  </div>
                )}
              </section>

              <section className="surface-card evidence-card">
                <div className="section-card-head">
                  <div>
                    <h3>{t.diagnostics.diagnosticEvidence}</h3>
                  </div>
                  <span className="section-count">{selected.tests.length} {t.diagnostics.resultsCount}</span>
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
                            <strong>{tContent(test.test_name, settings?.language)}</strong>
                            <span className={`result-tag result-tag-${test.result}`}>
                              {translations[settings?.language || 'en']?.diagnostics.testResults[test.result] || test.result.replaceAll('_', ' ')}
                            </span>
                          </div>
                          <p>{tContent(test.observed_result, settings?.language)}</p>
                          {test.details && <small>{tContent(test.details, settings?.language)}</small>}
                          <span className="evidence-time">{dateTimeLabel(test.performed_at, settings?.language)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inline-empty">
                    <CircleHelp size={16} />
                    <span>{t.diagnostics.noTests}</span>
                  </div>
                )}

                {selected.status === 'completed' ? (
                  <div className="read-only-note">
                    {t.diagnostics.completedReadOnly}
                  </div>
                ) : (
                  <form className="add-test-form" onSubmit={onAddTest}>
                    <div className="form-section-label">{t.diagnostics.addTestLabel}</div>
                    <div className="form-grid two-cols">
                      <label className="span-two">{t.diagnostics.testPerformed}
                        <input
                          type="text"
                          list="diagnostic-test-suggestions"
                          className="test-name-input"
                          value={testForm.test_name}
                          onChange={(e) => setTestForm((v) => ({ ...v, test_name: e.target.value }))}
                          placeholder={t.diagnostics.testPerformedPlaceholder}
                          required
                        />
                        <datalist id="diagnostic-test-suggestions">
                          {testSuggestions.map((item) => (
                            <option key={item} value={item}>
                              {tContent(item, settings?.language)}
                            </option>
                          ))}
                        </datalist>
                      </label>
                      <label>{t.diagnostics.resultLabel}
                        <select value={testForm.result} onChange={(e) => setTestForm((v) => ({ ...v, result: e.target.value as TestStatus }))}>
                          {t.testOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label>{t.diagnostics.observation}
                        <textarea required rows={2} value={testForm.observed_result} onChange={(e) => setTestForm((v) => ({ ...v, observed_result: e.target.value }))} placeholder={t.diagnostics.observationPlaceholder} />
                      </label>
                      <label className="span-two">{t.diagnostics.notes} <span className="label-muted">{t.diagnostics.optional}</span>
                        <input value={testForm.details} onChange={(e) => setTestForm((v) => ({ ...v, details: e.target.value }))} placeholder={t.diagnostics.notesPlaceholder} />
                      </label>
                    </div>
                    <div className="form-footer">
                      <button className="button button-dark" type="submit" disabled={recordingTest}>
                        {recordingTest ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} {recordingTest ? t.diagnostics.saving : t.diagnostics.saveTest}
                      </button>
                    </div>
                  </form>
                )}
              </section>

              <section className="surface-card outcome-card">
                <div className="section-card-head">
                  <div>
                    <h3>{t.diagnostics.repairOutcome}</h3>
                  </div>
                </div>
                <form onSubmit={onSaveOutcome} className="outcome-form">
                  <label>{t.diagnostics.confirmedFault}
                    <input required minLength={3} value={outcomeForm.confirmed_fault} onChange={(e) => setOutcomeForm((v) => ({ ...v, confirmed_fault: e.target.value }))} placeholder={t.diagnostics.confirmedFaultPlaceholder} />
                  </label>
                  <label>{t.diagnostics.repairAction}
                    <textarea required minLength={3} rows={2} value={outcomeForm.repair_action} onChange={(e) => setOutcomeForm((v) => ({ ...v, repair_action: e.target.value }))} placeholder={t.diagnostics.repairActionPlaceholder} />
                  </label>
                  <label>{t.diagnostics.verificationOutcome}
                    <textarea required minLength={3} rows={2} value={outcomeForm.outcome} onChange={(e) => setOutcomeForm((v) => ({ ...v, outcome: e.target.value }))} placeholder={t.diagnostics.verificationOutcomePlaceholder} />
                  </label>
                  <div className="outcome-actions">
                    <label className="outcome-status-label">{t.diagnostics.setStatus}
                      <select value={outcomeForm.status} onChange={(e) => setOutcomeForm((v) => ({ ...v, status: e.target.value as 'testing' | 'completed' | 'in_repair' }))}>
                        <option value="testing">{t.statuses.testing || 'Testing'}</option>
                        <option value="in_repair">{t.statuses.in_repair || 'In repair'}</option>
                        <option value="completed">{t.statuses.completed || 'Completed'}</option>
                      </select>
                    </label>
                    <button className="button button-primary" type="submit" disabled={recordingOutcome}>
                      {recordingOutcome ? <LoaderCircle size={15} className="spin" /> : <CheckCircle2 size={15} />} {t.diagnostics.saveOutcome}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {diagnosticsTab === 'components' && (
            <div className="diagnostics-subpage-components">
              <section className="surface-card component-health-card">
                <div className="component-health-header">
                  <div className="comp-header-info">
                    <div className="comp-header-icon"><Cpu size={18} /></div>
                    <div>
                      <h3>{t.diagnostics.componentHealthTitle}</h3>
                      <p className="comp-header-sub">{t.diagnostics.componentHealthDesc}</p>
                    </div>
                  </div>
                  <div className="comp-header-actions">
                    <button
                      className="button button-primary button-compact"
                      onClick={() => {
                        if (settings) playUiSound('click', settings)
                        setIsTrackModalOpen(true)
                      }}
                      disabled={selected.status === 'completed'}
                    >
                      <Plus size={15} /> {t.diagnostics.trackComponent}
                    </button>
                  </div>
                </div>

                {/* KPI bar for case components */}
                <div className="case-components-stat-grid">
                  <div className="case-comp-stat-pill">
                    <span className="stat-label">Total Tracked</span>
                    <span className="stat-val">{(selected.components || []).length}</span>
                  </div>
                  <div className="case-comp-stat-pill working">
                    <span className="stat-label">{t.components.healthStatuses.working}</span>
                    <span className="stat-val">{(selected.components || []).filter((c) => c.health_status === 'working').length}</span>
                  </div>
                  <div className="case-comp-stat-pill needs-testing">
                    <span className="stat-label">{t.components.healthStatuses.needs_testing}</span>
                    <span className="stat-val">{(selected.components || []).filter((c) => c.health_status === 'needs_testing').length}</span>
                  </div>
                  <div className="case-comp-stat-pill faulty">
                    <span className="stat-label">{t.components.healthStatuses.faulty}</span>
                    <span className="stat-val">{(selected.components || []).filter((c) => c.health_status === 'faulty').length}</span>
                  </div>
                </div>

                {/* Rule notice alert */}
                <div className="evidence-rule-callout">
                  <ShieldCheck size={16} />
                  <span>{t.diagnostics.testEvidenceRequired}</span>
                </div>

                {/* Component list */}
                {(!selected.components || selected.components.length === 0) ? (
                  <div className="case-components-empty">
                    <Cpu size={32} />
                    <h4>No electronic components tracked yet</h4>
                    <p>Track suspected or tested ICs, rails, displays, or connectors for {selected.brand} {selected.model} to record multimeter evidence.</p>
                    {selected.status !== 'completed' && (
                      <button
                        className="button button-dark"
                        onClick={() => {
                          if (settings) playUiSound('click', settings)
                          setIsTrackModalOpen(true)
                        }}
                      >
                        <Plus size={15} /> {t.diagnostics.trackComponent}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="case-components-list">
                    {selected.components.map((comp) => (
                      <div key={comp.id} className="case-component-card">
                        <div className="case-comp-top">
                          <div className="case-comp-meta">
                            <div className="case-comp-tags">
                              <span className="case-comp-id">{comp.id}</span>
                              {comp.part_number && <span className="case-comp-pn">· {comp.part_number}</span>}
                              <span className="case-comp-cat">{tContent(comp.category, settings?.language)}</span>
                              <span className={`case-comp-cond cond-${comp.condition.toLowerCase()}`}>
                                {comp.condition}
                              </span>
                            </div>
                            <h4 className="case-comp-name">{tContent(comp.name, settings?.language)}</h4>
                          </div>
                          <div className="case-comp-health-badge-wrap">
                            <span className={`badge-pill badge-health badge-health-${comp.health_status}`}>
                              {t.components.healthStatuses[comp.health_status] || comp.health_status}
                            </span>
                          </div>
                        </div>

                        <div className="case-comp-evidence-section">
                          <div className="evidence-header">
                            <span className="meta-label">MULTIMETER / TEST OBSERVATIONS</span>
                            {comp.tested_at && (
                              <span className="evidence-timestamp">
                                <Clock3 size={11} /> {dateTimeLabel(comp.tested_at, settings?.language)}
                              </span>
                            )}
                          </div>
                          {comp.test_evidence ? (
                            <div className="evidence-box has-evidence">
                              <Zap size={14} className="evidence-icon" />
                              <p className="evidence-text">{tContent(comp.test_evidence, settings?.language)}</p>
                            </div>
                          ) : (
                            <div className="evidence-box empty-evidence">
                              <AlertCircle size={14} className="evidence-warn-icon" />
                              <span className="evidence-empty-text">No multimeter evidence recorded yet. Health status is unverified.</span>
                            </div>
                          )}
                        </div>

                        <div className="case-comp-foot">
                          <div className="case-comp-reuse-hints">
                            <span className={`micro-status-chip reuse-${comp.reuse_status}`}>
                              Reuse: {t.components.reuseStatuses[comp.reuse_status] || comp.reuse_status}
                            </span>
                            <span className={`micro-status-chip resale-${comp.resale_status}`}>
                              Resale: {t.components.resaleStatuses[comp.resale_status] || comp.resale_status}
                            </span>
                          </div>

                          <div className="case-comp-actions">
                            {selected.status !== 'completed' && (
                              <button
                                className="button button-secondary button-sm"
                                onClick={() => {
                                  if (settings) playUiSound('click', settings)
                                  setUpdatingComponent(comp)
                                }}
                              >
                                <Wrench size={13} /> {t.diagnostics.updateHealth}
                              </button>
                            )}
                            {onNavigateComponents && (
                              <button
                                className="button button-ghost button-sm"
                                onClick={() => {
                                  if (settings) playUiSound('click', settings)
                                  onNavigateComponents()
                                }}
                                title="View in Warehouse Inventory"
                              >
                                <ExternalLink size={13} /> Warehouse
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {diagnosticsTab === 'recommendation' && (
            <div className="diagnostics-subpage-ai">
              <section className="surface-card ai-clean-copilot">
                <div className="ai-panel-header">
                  <div className="ai-panel-icon"><Sparkles size={18} /></div>
                  <div className="ai-panel-titles">
                    <h3>{t.diagnostics.copilotTitle}</h3>
                    <div className="ai-model-row">
                      <p className="ai-model-tag">
                        {settings?.modelEngine === 'fallback-rules'
                          ? 'Local rule-based guidance'
                          : health?.model_configured
                          ? `${settings?.modelEngine === 'flash-turbo' ? 'Gemini 3.1 Flash Lite' : settings?.modelEngine === 'gemini-flash' ? 'Gemini 3.5 Flash' : 'Gemma 4 26B'} (Gemini API)`
                          : 'Local rule-based guidance'}
                      </p>
                      <span className={`copilot-speed-chip ${settings?.modelEngine ?? 'flash-turbo'}`}>
                        {settings?.modelEngine === 'flash-turbo' && '⚡ Turbo (~1-2s)'}
                        {settings?.modelEngine === 'gemini-flash' && '⚡ Flash (~3-5s)'}
                        {settings?.modelEngine === 'gemma-4' && '🧠 Gemma (~40s)'}
                        {settings?.modelEngine === 'fallback-rules' && '⚙️ Local rules'}
                      </span>
                      <div className="copilot-lang-pill-group" role="group" aria-label="Diagnostic Language">
                        <button
                          type="button"
                          className={`lang-pill ${settings?.language === 'en' ? 'active' : ''}`}
                          onClick={() => {
                            if (settings) playUiSound('toggle', settings)
                            onUpdateSettings?.((prev) => ({ ...prev, language: 'en' }))
                          }}
                          title="Switch to English"
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          className={`lang-pill ${settings?.language === 'hi' ? 'active' : ''}`}
                          onClick={() => {
                            if (settings) playUiSound('toggle', settings)
                            onUpdateSettings?.((prev) => ({ ...prev, language: 'hi' }))
                          }}
                          title="Switch to Proper Hindi (हिन्दी)"
                        >
                          हिन्दी
                        </button>
                        <button
                          type="button"
                          className={`lang-pill ${settings?.language === 'hi-Latn' ? 'active' : ''}`}
                          onClick={() => {
                            if (settings) playUiSound('toggle', settings)
                            onUpdateSettings?.((prev) => ({ ...prev, language: 'hi-Latn' }))
                          }}
                          title="Switch to Hinglish (Latin Script)"
                        >
                          Hinglish
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    className="button button-ai button-compact"
                    onClick={onGenerate}
                    disabled={generating || selected.status === 'completed'}
                  >
                    {generating ? (
                      <><LoaderCircle size={15} className="spin" /> {t.diagnostics.generatingBtn}</>
                    ) : (
                      <><Sparkles size={15} /> {recommendation ? t.diagnostics.regenerateBtn : t.diagnostics.generateBtn}</>
                    )}
                  </button>
                </div>
              </section>

              {recommendation ? (
                <RecommendationView
                  recommendation={recommendation}
                  stale={stale}
                  caseDetail={selected}
                  settings={settings}
                  flash={flash}
                  t={t}
                />
              ) : (
                <section className="surface-card waiting-panel-clean">
                  <BrainCircuit size={28} className="muted-icon" />
                  <h3>{t.diagnostics.noRecTitle}</h3>
                  <p>{t.diagnostics.noRecDesc}</p>
                </section>
              )}

              {recommendation?.similar_cases && recommendation.similar_cases.length > 0 && (
                <section className="surface-card side-memory-card">
                  <div className="section-card-head">
                    <div>
                      <h3>{t.diagnostics.relatedMemory}</h3>
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

      {isTrackModalOpen && selected && (
        <TrackCaseComponentModal
          isOpen={isTrackModalOpen}
          caseId={selected.id}
          caseDevice={`${selected.brand} ${selected.model}`}
          onClose={() => setIsTrackModalOpen(false)}
          onSuccess={async () => {
            if (onReloadDetail) await onReloadDetail()
            flash?.('success', 'Component health logged and added to device diagnostics.')
          }}
          t={t}
        />
      )}

      {updatingComponent && (
        <UpdateCaseComponentHealthModal
          component={updatingComponent}
          onClose={() => setUpdatingComponent(null)}
          onSuccess={async () => {
            if (onReloadDetail) await onReloadDetail()
            flash?.('success', 'Component health evidence updated.')
          }}
          t={t}
        />
      )}
    </div>
  )
}

type VoiceLanguage = 'en' | 'hi'

function VoiceBriefingPlayer({
  recommendation,
  caseDetail,
  language,
  flash,
  t,
}: {
  recommendation: Recommendation
  caseDetail: CaseDetail | null
  language: DiagnosticLanguage
  flash?: (type: 'success' | 'error' | 'info', message: string) => void
  t: I18nCatalog
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle')
  // Strictly enforce Hindi or English voice output
  const [voiceLang, setVoiceLang] = useState<VoiceLanguage>(() => (language === 'hi' || language === 'hi-Latn' ? 'hi' : 'en'))
  const [cachedBriefings, setCachedBriefings] = useState<Record<string, string>>({})
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0)
  const [showTranscript, setShowTranscript] = useState(false)
  const [copied, setCopied] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    // Sync default voice language whenever app language changes
    setVoiceLang(language === 'hi' || language === 'hi-Latn' ? 'hi' : 'en')
  }, [language])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices()
      if (v && v.length > 0) setVoices(v)
    }

    updateVoices()
    window.speechSynthesis.onvoiceschanged = updateVoices

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [caseDetail?.id])

  function getFallbackBriefingText(lang: VoiceLanguage): string {
    const brand = caseDetail?.brand || 'Device'
    const model = caseDetail?.model || ''
    const issue = caseDetail?.issue_title || ''
    const summary = recommendation.content.summary || ''
    const hypotheses = recommendation.content.hypotheses || []
    const nextChecks = recommendation.content.next_checks || []
    const safety = recommendation.content.safety_notes?.[0] || ''

    if (lang === 'hi') {
      let text = `नमस्कार तकनीशियन, Revix वर्कशॉप डायग्नोस्टिक ब्रीफिंग। केस संख्या ${caseDetail?.id || ''}, डिवाइस ${brand} ${model}। रिपोर्ट की गई समस्या: ${issue}। `
      if (summary) text += `डायग्नोस्टिक सारांश: ${summary} `
      if (hypotheses.length > 0) {
        text += `मुख्य संदिग्ध कारण ${hypotheses[0].fault} है, क्योंकि ${hypotheses[0].reasoning} `
      }
      if (nextChecks.length > 0) {
        text += `प्राथमिक बेंच जांच ${nextChecks[0].name} है: ${nextChecks[0].instructions} `
      }
      if (safety) {
        text += `सुरक्षा निर्देश: ${safety} `
      } else {
        text += `कृपया परीक्षण के दौरान ESD सुरक्षा और बेंच पावर सप्लाई का करंट लिमिटर सेट रखें।`
      }
      return text
    }

    let text = `Revix workshop diagnostic briefing for case ${caseDetail?.id || ''}, ${brand} ${model}. Reported hardware symptom: ${issue}. `
    if (summary) text += `Diagnostic summary: ${summary} `
    if (hypotheses.length > 0) {
      text += `Primary hardware hypothesis is ${hypotheses[0].fault}. Engineering rationale: ${hypotheses[0].reasoning} `
    }
    if (nextChecks.length > 0) {
      text += `Priority bench check is ${nextChecks[0].name}: ${nextChecks[0].instructions} `
    }
    if (safety) {
      text += `Bench safety advisory: ${safety} `
    } else {
      text += `Maintain ESD grounding and set power supply current limits prior to probing.`
    }
    return text
  }

  const activeText = cachedBriefings[voiceLang] || getFallbackBriefingText(voiceLang)

  function findVoiceForLanguage(lang: VoiceLanguage): SpeechSynthesisVoice | null {
    const pool = voices.length > 0
      ? voices
      : typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis.getVoices()
      : []
    if (!pool || pool.length === 0) return null

    if (lang === 'hi') {
      return (
        pool.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('hi') || v.name.toLowerCase().includes('hindi')) ||
        pool.find((v) => v.lang.toLowerCase().includes('in')) ||
        null
      )
    }
    return (
      pool.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en-in')) ||
      pool.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en')) ||
      null
    )
  }

  function startSpeech(textToSpeak: string, lang: VoiceLanguage, speed: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setStatus('idle')
      flash?.('info', 'Web Speech API is not supported in this browser. You can read the script transcript below.')
      setShowTranscript(true)
      return
    }

    window.speechSynthesis.cancel()

    // Break into natural sentences to prevent Chrome/Safari speech synthesis timeout on full technical briefings
    const chunks = textToSpeak.match(/[^.!?।\n]+[.!?।\n]+/g) || [textToSpeak]
    let chunkIndex = 0

    function speakNextChunk() {
      if (chunkIndex >= chunks.length) {
        setStatus('idle')
        return
      }

      const chunkText = chunks[chunkIndex].trim()
      if (!chunkText) {
        chunkIndex++
        speakNextChunk()
        return
      }

      const utterance = new SpeechSynthesisUtterance(chunkText)
      utterance.rate = speed
      utterance.pitch = 1.0
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US'

      const matchedVoice = findVoiceForLanguage(lang)
      if (matchedVoice) {
        utterance.voice = matchedVoice
      }

      utterance.onstart = () => {
        setStatus('playing')
      }

      utterance.onend = () => {
        chunkIndex++
        speakNextChunk()
      }

      utterance.onerror = (e) => {
        if (e.error !== 'canceled') {
          setStatus('idle')
        }
      }

      window.speechSynthesis.speak(utterance)
    }

    speakNextChunk()
  }

  async function handlePlay() {
    if (!caseDetail) return

    if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
      return
    }

    if (cachedBriefings[voiceLang]) {
      startSpeech(cachedBriefings[voiceLang], voiceLang, playbackSpeed)
      return
    }

    setStatus('loading')
    try {
      const resp = await api.voiceBriefing(caseDetail.id, voiceLang)
      const text = resp.briefing_text || getFallbackBriefingText(voiceLang)
      setCachedBriefings((prev) => ({ ...prev, [voiceLang]: text }))
      startSpeech(text, voiceLang, playbackSpeed)
    } catch {
      const fallback = getFallbackBriefingText(voiceLang)
      setCachedBriefings((prev) => ({ ...prev, [voiceLang]: fallback }))
      startSpeech(fallback, voiceLang, playbackSpeed)
    }
  }

  function handlePause() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause()
      setStatus('paused')
    }
  }

  function handleResume() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume()
      setStatus('playing')
    }
  }

  function handleStop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setStatus('idle')
    }
  }

  function handleSpeedChange(newSpeed: number) {
    setPlaybackSpeed(newSpeed)
    if (status === 'playing') {
      startSpeech(activeText, voiceLang, newSpeed)
    }
  }

  async function handleVoiceLanguageSelect(newLang: VoiceLanguage) {
    if (newLang === voiceLang) return
    setVoiceLang(newLang)

    if (status === 'playing' || status === 'paused') {
      window.speechSynthesis.cancel()
      setStatus('loading')

      let textToPlay = cachedBriefings[newLang]
      if (!textToPlay && caseDetail) {
        try {
          const resp = await api.voiceBriefing(caseDetail.id, newLang)
          textToPlay = resp.briefing_text
        } catch {
          textToPlay = getFallbackBriefingText(newLang)
        }
      } else if (!textToPlay) {
        textToPlay = getFallbackBriefingText(newLang)
      }

      setCachedBriefings((prev) => ({ ...prev, [newLang]: textToPlay }))
      startSpeech(textToPlay, newLang, playbackSpeed)
    }
  }

  function handleCopyTranscript() {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(activeText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={`voice-briefing-hud ${status === 'playing' ? 'is-playing' : ''}`}>
      <div className="voice-briefing-header">
        <div className="voice-title-col">
          <div className="voice-badge-row">
            <span className={`voice-status-indicator ${status}`} />
            <span className="voice-hud-label">{t.voice.hudLabel}</span>
            <span className="voice-lang-chip">
              {voiceLang === 'hi' ? '🇮🇳 हिन्दी (Devanagari)' : '🌐 English'}
            </span>
          </div>
          <p className="voice-briefing-sub">
            {voiceLang === 'hi'
              ? 'ऑटोमैटिक वॉयस असिस्टेंट द्वारा डायग्नोस्टिक सारांश का वाचन'
              : t.voice.sub}
          </p>
        </div>

        {/* Visual Equalizer Waves */}
        <div className={`voice-visualizer ${status === 'playing' ? 'active' : ''}`} aria-hidden="true">
          <span className="eq-bar bar-1" />
          <span className="eq-bar bar-2" />
          <span className="eq-bar bar-3" />
          <span className="eq-bar bar-4" />
          <span className="eq-bar bar-5" />
          <span className="eq-bar bar-6" />
          <span className="eq-bar bar-7" />
          <span className="eq-bar bar-8" />
        </div>
      </div>

      {/* Controls Row */}
      <div className="voice-controls-bar">
        <div className="voice-actions-left">
          {status === 'loading' ? (
            <button className="voice-btn voice-btn-primary" disabled>
              <LoaderCircle size={15} className="spin" />
              <span>{t.voice.synthesizing}</span>
            </button>
          ) : status === 'playing' ? (
            <>
              <button className="voice-btn voice-btn-pause" onClick={handlePause}>
                <Pause size={14} />
                <span>{t.voice.pause}</span>
              </button>
              <button className="voice-btn voice-btn-stop" onClick={handleStop}>
                <Square size={14} />
                <span>{t.voice.stop}</span>
              </button>
            </>
          ) : status === 'paused' ? (
            <>
              <button className="voice-btn voice-btn-primary" onClick={handleResume}>
                <Play size={14} />
                <span>{t.voice.resume}</span>
              </button>
              <button className="voice-btn voice-btn-stop" onClick={handleStop}>
                <Square size={14} />
                <span>{t.voice.stop}</span>
              </button>
            </>
          ) : (
            <button className="voice-btn voice-btn-primary" onClick={handlePlay}>
              <Volume2 size={15} />
              <span>
                {voiceLang === 'hi' ? t.voice.listenHi : t.voice.listenEn}
              </span>
            </button>
          )}

          {/* Voice Language Selector: Strictly Hindi & English only */}
          <div className="voice-lang-selector" title="Switch voice language">
            <Languages size={13} className="lang-icon" />
            <button
              type="button"
              className={`voice-lang-btn ${voiceLang === 'en' ? 'active' : ''}`}
              onClick={() => handleVoiceLanguageSelect('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`voice-lang-btn ${voiceLang === 'hi' ? 'active' : ''}`}
              onClick={() => handleVoiceLanguageSelect('hi')}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* Speed controls & Transcript toggle */}
        <div className="voice-actions-right">
          <div className="voice-speed-pill-group">
            <span className="speed-label">{t.voice.speed}</span>
            {[0.9, 1.0, 1.2].map((spd) => (
              <button
                key={spd}
                type="button"
                className={`speed-btn ${playbackSpeed === spd ? 'active' : ''}`}
                onClick={() => handleSpeedChange(spd)}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`voice-btn-transcript ${showTranscript ? 'active' : ''}`}
            onClick={() => setShowTranscript((v) => !v)}
          >
            <Radio size={13} />
            <span>{showTranscript ? t.voice.hideTranscript : t.voice.transcript}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Transcript Ticker Box */}
      {showTranscript && (
        <div className="voice-transcript-box">
          <div className="transcript-head">
            <div className="transcript-tags">
              <span>{t.telemetry.spokenNarrative}</span>
              <span className="transcript-lang">{voiceLang.toUpperCase()}</span>
            </div>
            <button
              type="button"
              className="transcript-copy-btn"
              onClick={handleCopyTranscript}
              title="Copy narrative text"
            >
              {copied ? t.voice.copied : t.voice.copy}
            </button>
          </div>
          <p className="transcript-body">{activeText}</p>
        </div>
      )}
    </div>
  )
}

function RecommendationView({
  recommendation,
  stale,
  caseDetail,
  settings,
  flash,
  t,
}: {
  recommendation: Recommendation
  stale: boolean
  caseDetail?: CaseDetail | null
  settings?: AppSettings
  flash?: (type: 'success' | 'error' | 'info', message: string) => void
  t: I18nCatalog
}) {
  const [expandedHypothesis, setExpandedHypothesis] = useState(0)
  const content = recommendation.content
  const isLive = recommendation.provider === 'gemini_api'
  const modelBadge = isLive
    ? (recommendation.model_name
        ? recommendation.model_name.toUpperCase().replace('-IT', '').replace('GEMINI-', 'GEMINI ')
        : 'GEMINI API')
    : t.diagnostics.localRulesBadge

  return (
    <section className={`surface-card recommendation-card ${stale ? 'recommendation-stale' : ''}`}>
      <div className="recommendation-head">
        <div className="recommendation-head-icon"><Sparkles size={16} /></div>
        <div>
          <h3>{t.diagnostics.evidenceReview}</h3>
        </div>
        <span className={`source-mode ${isLive ? 'source-mode-live' : 'source-mode-fallback'}`}>
          {modelBadge}
        </span>
      </div>

      {stale && (
        <div className="stale-banner">
          <AlertCircle size={14} /> {t.diagnostics.staleEvidenceBanner}
        </div>
      )}

      {/* AI Voice Diagnostic Briefing HUD Player */}
      <VoiceBriefingPlayer
        recommendation={recommendation}
        caseDetail={caseDetail ?? null}
        language={settings?.language ?? 'en'}
        flash={flash}
        t={t}
      />

      <p className="recommendation-summary">{tContent(content.summary, settings?.language)}</p>

      <div className="hypothesis-section">
        <div className="recommendation-section-title">
          <h4>{t.diagnostics.possibleExplanations}</h4>
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
                <strong>{tContent(hypothesis.fault, settings?.language)}</strong>
                <span className={`likelihood-label likelihood-${hypothesis.likelihood}`}>
                  {translations[settings?.language || 'en']?.diagnostics.likelihoods[hypothesis.likelihood] || titleCase(hypothesis.likelihood)}
                </span>
              </div>
              <ChevronDown size={14} />
            </button>
            {expandedHypothesis === index && (
              <div className="hypothesis-detail">
                <p>{tContent(hypothesis.reasoning, settings?.language)}</p>
                {hypothesis.supporting_evidence.length > 0 && (
                  <div className="evidence-chips-group">
                    <span className="evidence-group-label">{t.diagnostics.supporting}</span>
                    {hypothesis.supporting_evidence.map((evidence, i) => (
                      <div className="evidence-chip positive" key={`${evidence}-${i}`}>
                        <Check size={12} /> {tContent(evidence, settings?.language)}
                      </div>
                    ))}
                  </div>
                )}
                {hypothesis.contradicting_evidence.length > 0 && (
                  <div className="evidence-chips-group">
                    <span className="evidence-group-label">{t.diagnostics.contradicting}</span>
                    {hypothesis.contradicting_evidence.map((evidence, i) => (
                      <div className="evidence-chip caution" key={`${evidence}-${i}`}>
                        <AlertCircle size={12} /> {tContent(evidence, settings?.language)}
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
          <h4>{t.diagnostics.safeNextChecks}</h4>
        </div>
        {content.next_checks.map((check, index) => (
          <NextCheckCard check={check} index={index} key={`${check.name}-${index}`} lang={settings?.language} t={t} />
        ))}
      </div>

      {content.missing_information.length > 0 && (
        <div className="missing-info-box">
          <div className="missing-info-heading">
            <CircleHelp size={14} />
            <strong>{t.diagnostics.missingInfoTitle}</strong>
          </div>
          <ul>
            {content.missing_information.map((item, index) => (
              <li key={`${item}-${index}`}>{tContent(item, settings?.language)}</li>
            ))}
          </ul>
        </div>
      )}

      {recommendation.sources.length > 0 && (
        <div className="source-reference-section">
          <span className="evidence-group-label">{t.diagnostics.sourcesUsed}</span>
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
        <span>{dateTimeLabel(recommendation.generated_at, settings?.language)}</span>
        <span>{recommendation.model_name}</span>
      </div>
    </section>
  )
}

function NextCheckCard({
  check,
  index,
  lang = 'en',
  t,
}: {
  check: NextCheck
  index: number
  lang?: DiagnosticLanguage
  t?: I18nCatalog
}) {
  const [open, setOpen] = useState(index === 0)
  const proLabel = t?.diagnostics.proOnly || 'Pro only'
  const recordLabel = t?.diagnostics.recordLabel || 'Record:'
  return (
    <div className={`next-check-item ${open ? 'next-check-open' : ''}`}>
      <button className="next-check-head" onClick={() => setOpen((v) => !v)}>
        <span className="next-check-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="next-check-main">
          <strong>{tContent(check.name, lang)}</strong>
          <small>{tContent(check.purpose, lang)}</small>
        </span>
        <span className={`safety-level safety-${check.safety_level}`}>
          {check.safety_level === 'professional_only' ? proLabel : check.safety_level}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="next-check-body">
          <p>{tContent(check.instructions, lang)}</p>
          <div className="record-this">
            <ClipboardCheck size={13} />
            <span><strong>{recordLabel}</strong> {tContent(check.what_to_record, lang)}</span>
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

function MemoryHoloOverlay({ animated, lang = 'en' }: { animated: boolean; lang?: DiagnosticLanguage }) {
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
        <span>{translations[lang]?.telemetry.memoryHolo || 'NEURAL BLUEPRINT ARCHIVE // SCHEMATIC MEMORY'}</span>
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
  t,
}: {
  cases: RepairCase[]
  query: string
  setQuery: (value: string) => void
  onOpen: (id: string, tab?: NavId) => void
  onDelete: (id: string, brand: string, model: string) => void
  settings?: AppSettings
  t: I18nCatalog
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
      <MemoryHoloOverlay animated={animated} lang={settings?.language} />

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
              <span className="probe-desc">{tContent(tp.label, settings?.language)}</span>
              <span className="probe-val" style={{ color: tp.color }}>{tContent(tp.status, settings?.language)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Minimalist 3D Floating Glass HUD Container in Negative Space (53% width) */}
      <div className="memory-negative-hud">
        <div className="memory-hud-header">
          <div className="memory-telemetry-chip">
            <span className="memory-telemetry-dot" />
            <span>{t.memory.telemetry}</span>
          </div>
          <div className="memory-header-row">
            <div className="memory-title-wrap">
              <h1 className="memory-title">{t.memory.title}</h1>
              <span className="memory-count-badge">
                <History size={14} /> {cases.length} {t.memory.matchesCount}
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
            placeholder={t.memory.searchPlaceholder}
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
                        <strong className="memory-card-title">{tContent(item.issue_title, settings?.language)}</strong>
                        <span className="memory-card-id">{item.id}</span>
                      </div>
                      <div className="memory-device-meta">
                        <span>{item.brand} {item.model}</span>
                        <span className="meta-sep">·</span>
                        <span>{dateLabel(item.updated_at, settings?.language)}</span>
                      </div>
                      <div className="memory-fault-pill">
                        <CheckCircle2 size={14} />
                        <span>{t.memory.confirmedLabel} <strong>{tContent(item.confirmed_fault, settings?.language)}</strong></span>
                      </div>
                      <p className="memory-action-desc">{tContent(item.repair_action, settings?.language)}</p>
                    </div>

                    <div className="memory-card-outcome-pod">
                      <span className="outcome-pod-label">{t.memory.verifiedOutcomeLabel}</span>
                      <p className="outcome-pod-text">{tContent(item.outcome || t.memory.none, settings?.language)}</p>
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
                title={t.memory.emptyTitle}
                description={t.memory.emptyDesc}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   PHASE 2: REUSE & RESALE MANAGER — COMPONENTS PAGE & MODALS
   ========================================================================= */

function ComponentsPage({
  settings,
  t,
  onNavigateCase,
  flash,
}: {
  settings?: AppSettings
  t: I18nCatalog
  onNavigateCase?: (caseId: string) => void
  flash: (kind: 'success' | 'error' | 'info', text: string) => void
}) {
  const [components, setComponents] = useState<Component[]>([])
  const [summary, setSummary] = useState<ComponentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [healthFilter, setHealthFilter] = useState('all')
  const [resaleFilter, setResaleFilter] = useState('all')
  const [reuseEligibleOnly, setReuseEligibleOnly] = useState(false)

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [editingComponent, setEditingComponent] = useState<Component | null>(null)
  const [reuseModal, setReuseModal] = useState<{
    component: Component
    action: 'reserve' | 'use' | 'release'
  } | null>(null)
  const [resaleModal, setResaleModal] = useState<Component | null>(null)
  const [deleteModal, setDeleteModal] = useState<Component | null>(null)

  const animated = settings?.animationsEnabled ?? true

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [comps, sum] = await Promise.all([
        api.components({
          q: searchQuery,
          category: categoryFilter,
          health_status: healthFilter,
          resale_status: resaleFilter,
          reuse_eligible_only: reuseEligibleOnly,
        }),
        api.componentSummary(),
      ])
      setComponents(comps)
      setSummary(sum)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [categoryFilter, healthFilter, resaleFilter, reuseEligibleOnly])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    void loadData()
  }

  return (
    <div className="components-fullscreen-layout">
      {/* Background ambient lighting */}
      <div className="memory-bg-layer" />
      <div className="memory-ambient-mask" aria-hidden="true" />
      <MemoryCircuitMapOverlay animated={animated} />

      <div className="components-negative-hud">
        {/* Header HUD Bar */}
        <div className="components-hud-header">
          <div className="components-header-left">
            <div className="memory-telemetry-chip">
              <span className="memory-telemetry-dot" />
              <span>{t.components.telemetry}</span>
            </div>
            <div className="components-title-row">
              <h1 className="components-title">{t.components.title}</h1>
              <span className="components-count-badge">
                <Box size={14} /> {components.length} {t.components.title.split(' ')[0]}
              </span>
            </div>
          </div>
          <button
            className="button button-primary components-register-btn"
            onClick={() => {
              playUiSound('click', settings || DEFAULT_SETTINGS)
              setIsRegisterOpen(true)
            }}
          >
            <Plus size={16} />
            <span>{t.components.registerBtn}</span>
          </button>
        </div>

        {/* Top KPI Statistics Summary Cards */}
        {summary && (
          <div className="component-stat-grid">
            <div className="component-stat-card">
              <div className="stat-card-icon stat-icon-blue">
                <Box size={18} />
              </div>
              <div className="stat-card-meta">
                <span className="stat-card-label">{t.components.totalComponents}</span>
                <span className="stat-card-num">{summary.total_components}</span>
                <span className="stat-card-sub">({summary.total_quantity} units in stock)</span>
              </div>
            </div>

            <div className="component-stat-card">
              <div className="stat-card-icon stat-icon-emerald">
                <ShieldCheck size={18} />
              </div>
              <div className="stat-card-meta">
                <span className="stat-card-label">{t.components.reusableStock}</span>
                <span className="stat-card-num">{summary.reuse_eligible_count}</span>
                <span className="stat-card-sub">{t.components.reusableStockDesc.slice(0, 32)}...</span>
              </div>
            </div>

            <div className="component-stat-card">
              <div className="stat-card-icon stat-icon-amber">
                <Wrench size={18} />
              </div>
              <div className="stat-card-meta">
                <span className="stat-card-label">{t.components.reservedBench}</span>
                <span className="stat-card-num">{summary.reserved_count}</span>
                <span className="stat-card-sub">{t.components.reservedBenchDesc.slice(0, 32)}...</span>
              </div>
            </div>

            <div className="component-stat-card">
              <div className="stat-card-icon stat-icon-violet">
                <DollarSign size={18} />
              </div>
              <div className="stat-card-meta">
                <span className="stat-card-label">{t.components.approvedResale}</span>
                <span className="stat-card-num">{summary.resale_approved_count}</span>
                <span className="stat-card-sub">
                  ({summary.resale_under_review_count} {t.components.resaleStatuses.under_review})
                </span>
              </div>
            </div>

            <div className="component-stat-card">
              <div className="stat-card-icon stat-icon-rose">
                <AlertCircle size={18} />
              </div>
              <div className="stat-card-meta">
                <span className="stat-card-label">{t.components.needsTesting}</span>
                <span className="stat-card-num">{summary.needs_testing_count}</span>
                <span className="stat-card-sub">{t.components.needsTestingDesc.slice(0, 32)}...</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="components-toolbar-card">
          <form className="components-search-wrap" onSubmit={handleSearchSubmit}>
            <Search size={16} className="components-search-icon" />
            <input
              type="text"
              className="components-search-input"
              placeholder={t.components.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="components-clear-btn"
                onClick={() => {
                  setSearchQuery('')
                  void api.components({
                    q: '',
                    category: categoryFilter,
                    health_status: healthFilter,
                    resale_status: resaleFilter,
                    reuse_eligible_only: reuseEligibleOnly,
                  }).then(setComponents)
                }}
              >
                <X size={14} />
              </button>
            )}
          </form>

          <div className="components-filter-pills">
            {/* Category Filter */}
            <select
              className="components-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">{t.components.allCategories}</option>
              <option value="screen">{t.components.categories.screen}</option>
              <option value="battery">{t.components.categories.battery}</option>
              <option value="mother_board">{t.components.categories.mother_board}</option>
              <option value="charging_port">{t.components.categories.charging_port}</option>
              <option value="camera">{t.components.categories.camera}</option>
              <option value="audio">{t.components.categories.audio}</option>
              <option value="sensor">{t.components.categories.sensor}</option>
              <option value="other">{t.components.categories.other}</option>
            </select>

            {/* Health Filter */}
            <select
              className="components-filter-select"
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
            >
              <option value="all">{t.components.allHealth}</option>
              <option value="working">{t.components.healthStatuses.working}</option>
              <option value="needs_testing">{t.components.healthStatuses.needs_testing}</option>
              <option value="faulty">{t.components.healthStatuses.faulty}</option>
              <option value="unknown">{t.components.healthStatuses.unknown}</option>
            </select>

            {/* Resale Filter */}
            <select
              className="components-filter-select"
              value={resaleFilter}
              onChange={(e) => setResaleFilter(e.target.value)}
            >
              <option value="all">{t.components.allResale}</option>
              <option value="approved">{t.components.resaleStatuses.approved}</option>
              <option value="under_review">{t.components.resaleStatuses.under_review}</option>
              <option value="not_eligible">{t.components.resaleStatuses.not_eligible}</option>
            </select>

            {/* Reusable Toggle */}
            <label className="components-reuse-toggle-label">
              <input
                type="checkbox"
                checked={reuseEligibleOnly}
                onChange={(e) => setReuseEligibleOnly(e.target.checked)}
              />
              <span>{t.components.reuseEligibleOnly}</span>
            </label>
          </div>
        </div>

        {/* Content Body: Loading, Error, Empty or Grid */}
        {loading ? (
          <div className="components-loading-card">
            <LoaderCircle size={28} className="spinning" />
            <p>Scanning bench component registry...</p>
          </div>
        ) : error ? (
          <div className="components-error-card">
            <AlertTriangle size={24} />
            <p>{error}</p>
            <button className="button button-secondary" onClick={() => void loadData()}>
              Retry
            </button>
          </div>
        ) : components.length === 0 ? (
          <div className="surface-card components-empty-card">
            <EmptyState
              icon={PackageSearch}
              title={t.components.emptyTitle}
              description={t.components.emptyDesc}
            />
          </div>
        ) : (
          <div className="components-grid">
            {components.map((comp) => {
              const availableQty = Math.max(0, comp.quantity - comp.reserved_quantity - comp.used_quantity)
              return (
                <div key={comp.id} className="component-card">
                  <div className="component-card-top">
                    <div className="component-header-meta">
                      <div className="component-id-chip">
                        <Tag size={12} />
                        <span>{comp.id}</span>
                        <span className="component-part-num">· {comp.part_number}</span>
                      </div>
                      <div className="component-badges-row">
                        {/* Health Badge */}
                        <span className={`badge-pill badge-health badge-health-${comp.health_status}`}>
                          {t.components.healthStatuses[comp.health_status] || comp.health_status}
                        </span>
                        {/* Resale Badge */}
                        <span className={`badge-pill badge-resale badge-resale-${comp.resale_status}`}>
                          {t.components.resaleStatuses[comp.resale_status] || comp.resale_status}
                        </span>
                      </div>
                    </div>

                    <h3 className="component-card-title">{tContent(comp.name, settings?.language)}</h3>

                    <div className="component-info-meta">
                      <span className="component-category-tag">
                        {tContent(comp.category, settings?.language)}
                      </span>
                      {comp.location && (
                        <span className="component-location-tag">
                          📍 {comp.location}
                        </span>
                      )}
                      <span className="component-condition-tag">
                        ✨ {comp.condition}
                      </span>
                    </div>

                    {/* Source Device / Case association */}
                    {(comp.source_device || comp.case_id) && (
                      <div className="component-source-link">
                        <span className="source-label">{t.components.sourceDeviceLabel}:</span>
                        <span className="source-name">
                          {comp.source_device || ''}
                          {comp.case_id && (
                            <button
                              type="button"
                              className="source-case-btn"
                              onClick={() => onNavigateCase && onNavigateCase(comp.case_id!)}
                            >
                              ({comp.case_id})
                            </button>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stock Quantities Bar */}
                  <div className="component-stock-bar">
                    <div className="stock-pod stock-pod-available">
                      <span className="stock-num">{availableQty}</span>
                      <span className="stock-label">{t.components.stockAvailable}</span>
                    </div>
                    <div className="stock-pod stock-pod-reserved">
                      <span className="stock-num">{comp.reserved_quantity}</span>
                      <span className="stock-label">{t.components.stockReserved}</span>
                    </div>
                    <div className="stock-pod stock-pod-used">
                      <span className="stock-num">{comp.used_quantity}</span>
                      <span className="stock-label">{t.components.stockUsed}</span>
                    </div>
                    <div className="stock-pod stock-pod-total">
                      <span className="stock-num">{comp.quantity}</span>
                      <span className="stock-label">Total</span>
                    </div>
                  </div>

                  {/* Test Evidence Section */}
                  <div className="component-evidence-section">
                    <div className="evidence-header">
                      <span className="evidence-title">{t.components.evidenceLabel}:</span>
                      {comp.tested_at && (
                        <span className="evidence-date">
                          {new Date(comp.tested_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="evidence-text">
                      {comp.test_evidence
                        ? tContent(comp.test_evidence, settings?.language)
                        : t.components.noEvidence}
                    </p>
                  </div>

                  {/* Reuse Availability Status Banner */}
                  <div className="component-reuse-banner">
                    {comp.is_reuse_eligible ? (
                      <div className="reuse-status-badge reuse-eligible">
                        <CheckCircle2 size={14} />
                        <span>
                          {availableQty > 0
                            ? t.components.reuseStatuses.available
                            : comp.reserved_quantity > 0
                            ? t.components.reuseStatuses.reserved
                            : t.components.reuseStatuses.depleted}
                        </span>
                      </div>
                    ) : (
                      <div className="reuse-status-badge reuse-ineligible">
                        <AlertCircle size={14} />
                        <span>
                          Ineligible for Reuse (
                          {comp.health_status !== 'working'
                            ? t.components.healthStatuses[comp.health_status]
                            : comp.condition === 'Damaged'
                            ? 'Damaged'
                            : 'Needs Test Evidence'}
                          )
                        </span>
                      </div>
                    )}
                    {comp.reuse_notes && (
                      <p className="reuse-notes-snippet">{comp.reuse_notes}</p>
                    )}
                  </div>

                  {/* Resale Review Summary (if reviewed or priced) */}
                  {comp.resale_status === 'approved' && (
                    <div className="component-resale-banner">
                      <div className="resale-approved-row">
                        <DollarSign size={14} />
                        <strong>
                          {comp.resale_price ? `$${comp.resale_price.toFixed(2)}` : 'Approved Resale'}
                        </strong>
                        {comp.resale_condition && <span>· {comp.resale_condition}</span>}
                      </div>
                      {comp.resale_reason && (
                        <p className="resale-reason-text">"{comp.resale_reason}"</p>
                      )}
                    </div>
                  )}

                  {/* Card Bottom Actions */}
                  <div className="component-card-actions">
                    <div className="action-group-reuse">
                      {/* Reserve Button */}
                      <button
                        className="button-pill button-pill-reserve"
                        disabled={!comp.is_reuse_eligible || availableQty <= 0}
                        title={
                          !comp.is_reuse_eligible
                            ? 'Must be verified working with recorded test evidence before reservation'
                            : availableQty <= 0
                            ? 'No available units left to reserve'
                            : 'Reserve stock for a repair case'
                        }
                        onClick={() => {
                          playUiSound('click', settings || DEFAULT_SETTINGS)
                          setReuseModal({ component: comp, action: 'reserve' })
                        }}
                      >
                        <Wrench size={13} />
                        <span>{t.components.btnReserve}</span>
                      </button>

                      {/* Use Button */}
                      <button
                        className="button-pill button-pill-use"
                        disabled={availableQty <= 0 && comp.reserved_quantity <= 0}
                        title="Mark units as consumed/installed in repair"
                        onClick={() => {
                          playUiSound('click', settings || DEFAULT_SETTINGS)
                          setReuseModal({ component: comp, action: 'use' })
                        }}
                      >
                        <Check size={13} />
                        <span>{t.components.btnUse}</span>
                      </button>

                      {/* Release Button */}
                      {comp.reserved_quantity > 0 && (
                        <button
                          className="button-pill button-pill-release"
                          title="Release reserved units back to available pool"
                          onClick={() => {
                            playUiSound('click', settings || DEFAULT_SETTINGS)
                            setReuseModal({ component: comp, action: 'release' })
                          }}
                        >
                          <RotateCcw size={13} />
                          <span>{t.components.btnRelease}</span>
                        </button>
                      )}
                    </div>

                    <div className="action-group-resale">
                      <button
                        className="button-pill button-pill-review"
                        onClick={() => {
                          playUiSound('click', settings || DEFAULT_SETTINGS)
                          setResaleModal(comp)
                        }}
                      >
                        <DollarSign size={13} />
                        <span>{t.components.btnReviewResale}</span>
                      </button>

                      <button
                        className="icon-button-sm"
                        title={t.components.btnEdit}
                        onClick={() => {
                          playUiSound('click', settings || DEFAULT_SETTINGS)
                          setEditingComponent(comp)
                        }}
                      >
                        <Settings size={14} />
                      </button>

                      <button
                        className="icon-button-sm delete-btn-sm"
                        title={t.components.btnDelete}
                        onClick={() => {
                          playUiSound('click', settings || DEFAULT_SETTINGS)
                          setDeleteModal(comp)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals rendered via React Portal into document.body for perfect centering */}
      {isRegisterOpen && (
        <ComponentRegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={() => {
            void loadData()
            flash('success', 'Component registered successfully.')
          }}
          t={t}
        />
      )}

      {editingComponent && (
        <ComponentEditModal
          component={editingComponent}
          onClose={() => setEditingComponent(null)}
          onSuccess={() => {
            void loadData()
            flash('success', 'Component updated successfully.')
          }}
          t={t}
        />
      )}

      {reuseModal && (
        <ComponentReuseModal
          component={reuseModal.component}
          action={reuseModal.action}
          onClose={() => setReuseModal(null)}
          onSuccess={() => {
            void loadData()
            flash('success', `Reuse ${reuseModal.action} recorded.`)
          }}
          t={t}
        />
      )}

      {resaleModal && (
        <ComponentResaleReviewModal
          component={resaleModal}
          onClose={() => setResaleModal(null)}
          onSuccess={() => {
            void loadData()
            flash('success', 'Resale review decision updated.')
          }}
          t={t}
        />
      )}

      {deleteModal && (
        <ComponentDeleteModal
          component={deleteModal}
          onClose={() => setDeleteModal(null)}
          onSuccess={() => {
            void loadData()
            flash('success', 'Component deleted.')
          }}
          t={t}
        />
      )}
    </div>
  )
}

/* =========================================================================
   PHASE 1: COMPONENT HEALTH TRACKER MODALS (DIAGNOSTICS)
   ========================================================================= */

const COMMON_COMPONENT_NAMES = [
  'Primary PMIC / Charging IC',
  'USB-C Port / Daughterboard',
  'OLED / Digitizer Assembly',
  'Battery Pack (Li-Ion / Li-Po)',
  'Main Logic Board (MLB)',
  'Sub-board / Interposer Flex',
  'Primary Camera Module',
  'Front Facing Camera Module',
  'Audio Codec / Loudspeaker',
  'Display Backlight Driver',
  'Taptic Engine / Vibration Motor',
  '5V / 3.3V Step-Down Buck Converter',
]

const MULTIMETER_PRESETS = [
  'Diode mode to GND: 0.425V (Normal reference)',
  'Direct short to GND: 0.002V on VDD_MAIN rail',
  'Excessive current draw: 1.85A at 4.2V injected',
  'Impedance to GND: 86kΩ (Within OEM range)',
  'No voltage drop: 0.00V / Open line on VBUS 5.0V',
  'Capacitor bank hot spot detected under thermal imaging',
]

function TrackCaseComponentModal({
  isOpen,
  caseId,
  caseDevice,
  onClose,
  onSuccess,
  t,
}: {
  isOpen: boolean
  caseId: string
  caseDevice: string
  onClose: () => void
  onSuccess: () => Promise<void> | void
  t: I18nCatalog
}) {
  const [name, setName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [category, setCategory] = useState('mother_board')
  const [condition, setCondition] = useState('Good')
  const [healthStatus, setHealthStatus] = useState<ComponentHealthStatus>('needs_testing')
  const [testEvidence, setTestEvidence] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Component name is required.')
      return
    }
    // Phase 1 Requirement: working or faulty must have actual test evidence recorded
    if ((healthStatus === 'working' || healthStatus === 'faulty') && !testEvidence.trim()) {
      setError(t.diagnostics.testEvidenceRequired || 'Working or Faulty status requires actual observed multimeter readings or test evidence.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await api.addCaseComponent(caseId, {
        name: name.trim(),
        part_number: partNumber.trim() || undefined,
        category,
        quantity: 1,
        condition,
        source_device: caseDevice,
        case_id: caseId,
        health_status: healthStatus,
        test_evidence: testEvidence.trim() || null,
      })
      onClose()
      await onSuccess()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card component-form-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">DIAGNOSTICS // TRACK COMPONENT HEALTH</span>
            <h2>{t.diagnostics.trackComponent} — {caseId}</h2>
            <p className="modal-subhead">{caseDevice}</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body-form">
          {error && (
            <div className="form-error-banner">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-grid-2">
            <div className="field-group">
              <label>Component Name *</label>
              <input
                type="text"
                list="case-component-name-suggestions"
                placeholder="e.g. Primary PMIC / Charging IC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <datalist id="case-component-name-suggestions">
                {COMMON_COMPONENT_NAMES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field-group">
              <label>Part # / Model</label>
              <input
                type="text"
                placeholder="e.g. BQ25601 / PM8150"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="field-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="mother_board">{t.components.categories.mother_board}</option>
                <option value="battery">{t.components.categories.battery}</option>
                <option value="screen">{t.components.categories.screen}</option>
                <option value="charging_port">{t.components.categories.charging_port}</option>
                <option value="camera">{t.components.categories.camera}</option>
                <option value="audio">{t.components.categories.audio}</option>
                <option value="sensor">{t.components.categories.sensor}</option>
                <option value="other">{t.components.categories.other}</option>
              </select>
            </div>
            <div className="field-group">
              <label>Physical Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="Good">{t.components.conditions.Good}</option>
                <option value="LikeNew">{t.components.conditions.LikeNew}</option>
                <option value="Fair">{t.components.conditions.Fair}</option>
                <option value="Damaged">{t.components.conditions.Damaged}</option>
              </select>
            </div>
            <div className="field-group">
              <label>Health Status</label>
              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value as ComponentHealthStatus)}
              >
                <option value="needs_testing">{t.components.healthStatuses.needs_testing}</option>
                <option value="working">{t.components.healthStatuses.working}</option>
                <option value="faulty">{t.components.healthStatuses.faulty}</option>
                <option value="unknown">{t.components.healthStatuses.unknown}</option>
              </select>
            </div>
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label>Multimeter / Test Evidence {(healthStatus === 'working' || healthStatus === 'faulty') && <span className="label-req">* (Required)</span>}</label>
              <span className="field-hint">Diode drop, rail voltage, impedance</span>
            </div>
            <textarea
              rows={3}
              placeholder="Record actual test evidence: e.g. Diode mode to GND: 0.425V, 5.0V VBUS rail verified stable under 1.2A load..."
              value={testEvidence}
              onChange={(e) => setTestEvidence(e.target.value)}
              required={healthStatus === 'working' || healthStatus === 'faulty'}
            />
            <div className="quick-presets-box">
              <span className="presets-label">Quick multimeter presets:</span>
              <div className="presets-pills">
                {MULTIMETER_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setTestEvidence((prev) => (prev ? `${prev}; ${preset}` : preset))
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-actions-row">
            <button type="button" className="button button-secondary" onClick={onClose}>
              {t.components.cancelBtn}
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Tracking...' : t.diagnostics.trackComponent}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

function UpdateCaseComponentHealthModal({
  component,
  onClose,
  onSuccess,
  t,
}: {
  component: Component
  onClose: () => void
  onSuccess: () => Promise<void> | void
  t: I18nCatalog
}) {
  const [healthStatus, setHealthStatus] = useState<ComponentHealthStatus>(component.health_status)
  const [condition, setCondition] = useState(component.condition)
  const [testEvidence, setTestEvidence] = useState(component.test_evidence || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // Phase 1 Requirement: working or faulty must have actual test evidence recorded
    if ((healthStatus === 'working' || healthStatus === 'faulty') && !testEvidence.trim()) {
      setError(t.diagnostics.testEvidenceRequired || 'Working or Faulty status requires actual observed multimeter readings or test evidence.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await api.updateComponent(component.id, {
        health_status: healthStatus,
        condition,
        test_evidence: testEvidence.trim() || null,
      })
      onClose()
      await onSuccess()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card component-form-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">UPDATE COMPONENT HEALTH // {component.id}</span>
            <h2>{component.name}</h2>
            {component.part_number && <p className="modal-subhead">Part #: {component.part_number}</p>}
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body-form">
          {error && (
            <div className="form-error-banner">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-grid-2">
            <div className="field-group">
              <label>Health Status</label>
              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value as ComponentHealthStatus)}
              >
                <option value="needs_testing">{t.components.healthStatuses.needs_testing}</option>
                <option value="working">{t.components.healthStatuses.working}</option>
                <option value="faulty">{t.components.healthStatuses.faulty}</option>
                <option value="unknown">{t.components.healthStatuses.unknown}</option>
              </select>
            </div>
            <div className="field-group">
              <label>Physical Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="Good">{t.components.conditions.Good}</option>
                <option value="LikeNew">{t.components.conditions.LikeNew}</option>
                <option value="Fair">{t.components.conditions.Fair}</option>
                <option value="Damaged">{t.components.conditions.Damaged}</option>
              </select>
            </div>
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label>Multimeter / Test Evidence {(healthStatus === 'working' || healthStatus === 'faulty') && <span className="label-req">* (Required)</span>}</label>
              <span className="field-hint">Diode drop, rail voltage, impedance</span>
            </div>
            <textarea
              rows={4}
              placeholder="Record actual test findings: diode mode voltage drop, rail resistance, thermal scan results..."
              value={testEvidence}
              onChange={(e) => setTestEvidence(e.target.value)}
              required={healthStatus === 'working' || healthStatus === 'faulty'}
            />
            <div className="quick-presets-box">
              <span className="presets-label">Quick multimeter presets:</span>
              <div className="presets-pills">
                {MULTIMETER_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      setTestEvidence((prev) => (prev ? `${prev}; ${preset}` : preset))
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-actions-row">
            <button type="button" className="button button-secondary" onClick={onClose}>
              {t.components.cancelBtn}
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Health Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* =========================================================================
   SUB-MODALS: REGISTER, EDIT, REUSE, RESALE-REVIEW, DELETE
   ========================================================================= */

function ComponentRegisterModal({
  isOpen,
  onClose,
  onSuccess,
  t,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  t: I18nCatalog
}) {
  const [name, setName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [category, setCategory] = useState('other')
  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState('Good')
  const [location, setLocation] = useState('')
  const [sourceDevice, setSourceDevice] = useState('')
  const [caseId, setCaseId] = useState('')
  const [healthStatus, setHealthStatus] = useState<ComponentHealthStatus>('needs_testing')
  const [testEvidence, setTestEvidence] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Component name is required.')
      return
    }
    if ((healthStatus === 'working' || healthStatus === 'faulty') && !testEvidence.trim()) {
      setError(t.diagnostics.testEvidenceRequired || 'Working or Faulty status requires actual observed multimeter readings or test evidence.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.createComponent({
        name: name.trim(),
        part_number: partNumber.trim() || undefined,
        category,
        quantity: Math.max(1, Number(quantity) || 1),
        condition,
        location: location.trim() || null,
        source_device: sourceDevice.trim() || null,
        case_id: caseId.trim() || null,
        health_status: healthStatus,
        test_evidence: testEvidence.trim() || null,
      })
      onClose()
      onSuccess()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card component-form-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">COMPONENT INVENTORY // INTAKE</span>
            <h2>{t.components.registerModalTitle}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body-form">
          {error && (
            <div className="form-error-banner">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-grid-2">
            <div className="field-group">
              <label>Component Name *</label>
              <input
                type="text"
                placeholder="e.g. Super AMOLED 120Hz Display Module"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field-group">
              <label>Part # / Model</label>
              <input
                type="text"
                placeholder="e.g. GH82-31234A"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="field-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="screen">{t.components.categories.screen}</option>
                <option value="battery">{t.components.categories.battery}</option>
                <option value="mother_board">{t.components.categories.mother_board}</option>
                <option value="charging_port">{t.components.categories.charging_port}</option>
                <option value="camera">{t.components.categories.camera}</option>
                <option value="audio">{t.components.categories.audio}</option>
                <option value="sensor">{t.components.categories.sensor}</option>
                <option value="other">{t.components.categories.other}</option>
              </select>
            </div>
            <div className="field-group">
              <label>Initial Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </div>
            <div className="field-group">
              <label>Physical Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="LikeNew">{t.components.conditions.LikeNew}</option>
                <option value="Good">{t.components.conditions.Good}</option>
                <option value="Fair">{t.components.conditions.Fair}</option>
                <option value="Damaged">{t.components.conditions.Damaged}</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="field-group">
              <label>Storage Location</label>
              <input
                type="text"
                placeholder="e.g. Shelf 4, Bin C-12"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>Source Device / Donor Board</label>
              <input
                type="text"
                placeholder="e.g. OnePlus Nord CE 3 Donor"
                value={sourceDevice}
                onChange={(e) => setSourceDevice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="field-group">
              <label>Associated Case ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. FX-1048"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>Initial Health Status</label>
              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value as ComponentHealthStatus)}
              >
                <option value="needs_testing">{t.components.healthStatuses.needs_testing}</option>
                <option value="working">{t.components.healthStatuses.working}</option>
                <option value="faulty">{t.components.healthStatuses.faulty}</option>
                <option value="unknown">{t.components.healthStatuses.unknown}</option>
              </select>
            </div>
          </div>

          <div className="field-group">
            <label>Multimeter / Diagnostic Test Evidence</label>
            <textarea
              rows={3}
              placeholder="Record exact test findings: diode drop, rail impedance, touch digitizer pass rate, thermal readings..."
              value={testEvidence}
              onChange={(e) => setTestEvidence(e.target.value)}
            />
          </div>

          <div className="modal-actions-row">
            <button type="button" className="button button-secondary" onClick={onClose}>
              {t.components.cancelBtn}
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Registering...' : t.components.registerBtn}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

function ComponentEditModal({
  component,
  onClose,
  onSuccess,
  t,
}: {
  component: Component
  onClose: () => void
  onSuccess: () => void
  t: I18nCatalog
}) {
  const [name, setName] = useState(component.name)
  const [partNumber, setPartNumber] = useState(component.part_number)
  const [category, setCategory] = useState(component.category)
  const [quantity, setQuantity] = useState(component.quantity)
  const [condition, setCondition] = useState(component.condition)
  const [location, setLocation] = useState(component.location || '')
  const [sourceDevice, setSourceDevice] = useState(component.source_device || '')
  const [caseId, setCaseId] = useState(component.case_id || '')
  const [healthStatus, setHealthStatus] = useState<ComponentHealthStatus>(component.health_status)
  const [testEvidence, setTestEvidence] = useState(component.test_evidence || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if ((healthStatus === 'working' || healthStatus === 'faulty') && !testEvidence.trim()) {
      setError(t.diagnostics.testEvidenceRequired || 'Working or Faulty status requires actual observed multimeter readings or test evidence.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.updateComponent(component.id, {
        name: name.trim(),
        part_number: partNumber.trim(),
        category,
        quantity: Math.max(component.reserved_quantity + component.used_quantity, Number(quantity)),
        condition,
        location: location.trim() || null,
        source_device: sourceDevice.trim() || null,
        case_id: caseId.trim() || null,
        health_status: healthStatus,
        test_evidence: testEvidence.trim() || null,
      })
      onClose()
      onSuccess()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card component-form-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">{component.id} // EDIT COMPONENT</span>
            <h2>{t.components.editModalTitle}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body-form">
          {error && (
            <div className="form-error-banner">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-grid-2">
            <div className="field-group">
              <label>Component Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field-group">
              <label>Part Number</label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="field-group">
              <label>Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>Total Quantity (Min: {component.reserved_quantity + component.used_quantity})</label>
              <input
                type="number"
                min={component.reserved_quantity + component.used_quantity}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </div>
            <div className="field-group">
              <label>Physical Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}>
                <option value="LikeNew">{t.components.conditions.LikeNew}</option>
                <option value="Good">{t.components.conditions.Good}</option>
                <option value="Fair">{t.components.conditions.Fair}</option>
                <option value="Damaged">{t.components.conditions.Damaged}</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="field-group">
              <label>Storage Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>Health Status</label>
              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value as ComponentHealthStatus)}
              >
                <option value="working">{t.components.healthStatuses.working}</option>
                <option value="needs_testing">{t.components.healthStatuses.needs_testing}</option>
                <option value="faulty">{t.components.healthStatuses.faulty}</option>
                <option value="unknown">{t.components.healthStatuses.unknown}</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="field-group">
              <label>Source Device</label>
              <input
                type="text"
                value={sourceDevice}
                onChange={(e) => setSourceDevice(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>Associated Case ID</label>
              <input
                type="text"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
              />
            </div>
          </div>

          <div className="field-group">
            <label>Multimeter / Diagnostic Test Evidence</label>
            <textarea
              rows={3}
              value={testEvidence}
              onChange={(e) => setTestEvidence(e.target.value)}
            />
          </div>

          <div className="modal-actions-row">
            <button type="button" className="button button-secondary" onClick={onClose}>
              {t.components.cancelBtn}
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Saving...' : t.components.saveChangesBtn}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

function ComponentReuseModal({
  component,
  action,
  onClose,
  onSuccess,
  t,
}: {
  component: Component
  action: 'reserve' | 'use' | 'release'
  onClose: () => void
  onSuccess: () => void
  t: I18nCatalog
}) {
  const availableQty = Math.max(0, component.quantity - component.reserved_quantity - component.used_quantity)
  const maxAllowed =
    action === 'reserve'
      ? availableQty
      : action === 'release'
      ? component.reserved_quantity
      : availableQty + component.reserved_quantity

  const [quantity, setQuantity] = useState(1)
  const [caseId, setCaseId] = useState(component.case_id || '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (quantity < 1 || quantity > maxAllowed) {
      setError(`Quantity must be between 1 and ${maxAllowed}.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.reuseComponent(component.id, {
        action,
        quantity,
        case_id: caseId.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
      onSuccess()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const actionTitles = {
    reserve: t.components.confirmReserveBtn,
    use: t.components.confirmUseBtn,
    release: t.components.confirmReleaseBtn,
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card component-reuse-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">REUSE ACTION // {action.toUpperCase()}</span>
            <h2>{t.components.reserveModalTitle}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body-form">
          {error && (
            <div className="form-error-banner">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="component-modal-info-box">
            <strong>{component.name}</strong>
            <span>Part: {component.part_number} · Available: {availableQty} · Reserved: {component.reserved_quantity}</span>
          </div>

          <div className="form-grid-2">
            <div className="field-group">
              <label>{t.components.reserveQtyLabel} (Max: {maxAllowed})</label>
              <input
                type="number"
                min="1"
                max={maxAllowed}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </div>
            <div className="field-group">
              <label>{t.components.reserveCaseLabel}</label>
              <input
                type="text"
                placeholder="e.g. FX-1048"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
              />
            </div>
          </div>

          <div className="field-group">
            <label>{t.components.reserveNotesLabel}</label>
            <input
              type="text"
              placeholder="e.g. Bench test replacement for charging rail fault"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions-row">
            <button type="button" className="button button-secondary" onClick={onClose}>
              {t.components.cancelBtn}
            </button>
            <button type="submit" className="button button-primary" disabled={submitting || maxAllowed <= 0}>
              {submitting ? 'Processing...' : actionTitles[action]}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

function ComponentResaleReviewModal({
  component,
  onClose,
  onSuccess,
  t,
}: {
  component: Component
  onClose: () => void
  onSuccess: () => void
  t: I18nCatalog
}) {
  const isEligibleForApproval =
    component.health_status === 'working' &&
    component.condition !== 'Damaged' &&
    Boolean(component.test_evidence && component.test_evidence.trim().length > 0)

  const [decision, setDecision] = useState<ComponentResaleStatus>(
    component.resale_status === 'approved' ? 'approved' : 'under_review'
  )
  const [reason, setReason] = useState(component.resale_reason || '')
  const [condition, setCondition] = useState(component.resale_condition || '')
  const [price, setPrice] = useState(component.resale_price ? String(component.resale_price) : '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('A review rationale or justification note is required.')
      return
    }
    if (decision === 'approved' && !isEligibleForApproval) {
      setError('Cannot approve: component must be verified working with test evidence and not damaged.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await api.reviewComponentResale(component.id, {
        resale_status: decision,
        review_reason: reason.trim(),
        review_condition: condition.trim() || null,
        resale_price: price ? Number(price) : null,
        reviewed_by: 'Lead Hardware Tech',
      })
      onClose()
      onSuccess()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card component-resale-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">QUALITY ASSURANCE // RESALE WORKFLOW</span>
            <h2>{t.components.reviewModalTitle}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body-form">
          {error && (
            <div className="form-error-banner">
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Strict Safety Safeguard Banner */}
          {!isEligibleForApproval && (
            <div className="safety-safeguard-alert">
              <ShieldAlert size={18} />
              <div>
                <strong>Safety & Quality Invariant:</strong>
                <p>
                  Untested, faulty, or damaged components cannot be approved for resale. Current component health is{' '}
                  <code>{component.health_status}</code> with condition <code>{component.condition}</code>.
                  Resale approval requires verified working test evidence.
                </p>
              </div>
            </div>
          )}

          <div className="component-modal-info-box">
            <strong>{component.name}</strong>
            <span>Part: {component.part_number} · Health: {component.health_status} · Evidence: {component.test_evidence ? 'Recorded' : 'None'}</span>
          </div>

          <div className="field-group">
            <label>{t.components.resaleDecisionLabel}</label>
            <div className="resale-decision-segmented">
              <label className={`resale-seg-label ${decision === 'under_review' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="resale_decision"
                  value="under_review"
                  checked={decision === 'under_review'}
                  onChange={() => setDecision('under_review')}
                />
                <span>{t.components.resaleStatuses.under_review}</span>
              </label>

              <label
                className={`resale-seg-label ${decision === 'approved' ? 'active' : ''} ${!isEligibleForApproval ? 'disabled' : ''}`}
                title={!isEligibleForApproval ? 'Locked: component must be working and tested' : ''}
              >
                <input
                  type="radio"
                  name="resale_decision"
                  value="approved"
                  disabled={!isEligibleForApproval}
                  checked={decision === 'approved'}
                  onChange={() => setDecision('approved')}
                />
                <span>{t.components.resaleStatuses.approved}</span>
              </label>

              <label className={`resale-seg-label ${decision === 'not_eligible' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="resale_decision"
                  value="not_eligible"
                  checked={decision === 'not_eligible'}
                  onChange={() => setDecision('not_eligible')}
                />
                <span>{t.components.resaleStatuses.not_eligible}</span>
              </label>
            </div>
          </div>

          <div className="field-group">
            <label>{t.components.resaleReasonLabel} *</label>
            <textarea
              rows={3}
              placeholder="e.g. Verified 100% digitizer pass rate on bench fixture. Optical path clean with zero dead pixels."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="field-group">
              <label>{t.components.resaleConditionLabel}</label>
              <input
                type="text"
                placeholder="e.g. A-Grade OEM pull"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>{t.components.resalePriceLabel}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 65.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions-row">
            <button type="button" className="button button-secondary" onClick={onClose}>
              {t.components.cancelBtn}
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={submitting || (decision === 'approved' && !isEligibleForApproval)}
            >
              {submitting ? 'Submitting...' : t.components.submitReviewBtn}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

function ComponentDeleteModal({
  component,
  onClose,
  onSuccess,
  t,
}: {
  component: Component
  onClose: () => void
  onSuccess: () => void
  t: I18nCatalog
}) {
  const [submitting, setSubmitting] = useState(false)

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      await api.deleteComponent(component.id)
      onClose()
      onSuccess()
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card modal-delete-card" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div className="modal-title-wrap">
            <span className="eyebrow">DANGER ZONE</span>
            <h2>Delete Electronic Component?</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p>
            Permanently remove <strong>{component.name} ({component.id})</strong> from the inventory?
            This will wipe recorded test evidence and stock counts.
          </p>
        </div>
        <div className="modal-actions-row">
          <button type="button" className="button button-secondary" onClick={onClose}>
            {t.components.cancelBtn}
          </button>
          <button
            type="button"
            className="button button-danger"
            onClick={() => void handleDelete()}
            disabled={submitting}
          >
            {submitting ? 'Deleting...' : t.components.btnDelete}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
