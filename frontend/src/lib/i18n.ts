export type DiagnosticLanguage = 'en' | 'hi' | 'hi-Latn'

export interface I18nCatalog {
  nav: {
    home: string
    overview: string
    cases: string
    diagnostics: string
    components: string
    memory: string
    settings: string
    credits: string
    newRepair: string
    quit: string
  }
  home: {
    status: string
    matrix: string
    eyebrow: string
    tagline: string
    menuNew: string
    menuOverview: string
    menuQueue: string
    menuComponents: string
    menuSettings: string
    menuCredits: string
    menuQuit: string
    footerHint: string
  }
  overview: {
    title: string
    telemetry: string
    activeRepairs: string
    activeRepairsDesc: string
    needsAttention: string
    needsAttentionDesc: string
    readyForTesting: string
    readyForTestingDesc: string
    savedPrecedents: string
    savedPrecedentsDesc: string
    quickActions: string
    newIntake: string
    openQueue: string
    diagnostics: string
    recentCases: string
    viewDetails: string
    noRecent: string
    issuesSingular: string
    issuesPlural: string
    noUrgentTitle: string
    noUrgentDesc: string
  }
  cases: {
    title: string
    telemetry: string
    allStatuses: string
    allPriorities: string
    searchPlaceholder: string
    colId: string
    colDevice: string
    colIssue: string
    colPriority: string
    colStatus: string
    colUpdated: string
    colActions: string
    openCase: string
    emptyTitle: string
    emptyDesc: string
    activeQueue: string
    devicesSingular: string
    devicesPlural: string
    customerContactCol: string
  }
  diagnostics: {
    title: string
    telemetry: string
    selectDevice: string
    delete: string
    tabEvidence: string
    tabComponents: string
    tabRecommendation: string
    componentHealthTitle: string
    componentHealthDesc: string
    trackComponent: string
    updateHealth: string
    testEvidenceRequired: string
    chooseDeviceTitle: string
    chooseDeviceDesc: string
    symptoms: string
    tests: string
    diagnosticEvidence: string
    resultsCount: string
    noTests: string
    addTestLabel: string
    testPerformed: string
    testPerformedPlaceholder: string
    changeDevice: string
    deviceModalTitle: string
    deviceModalSub: string
    deviceModalSearch: string
    deviceModalNoResults: string
    deviceModalActive: string
    resultLabel: string
    observation: string
    observationPlaceholder: string
    notes: string
    notesPlaceholder: string
    optional: string
    saveTest: string
    saving: string
    repairOutcome: string
    confirmedFault: string
    confirmedFaultPlaceholder: string
    repairAction: string
    repairActionPlaceholder: string
    verificationOutcome: string
    verificationOutcomePlaceholder: string
    setStatus: string
    saveOutcome: string
    copilotTitle: string
    generateBtn: string
    regenerateBtn: string
    generatingBtn: string
    noRecTitle: string
    noRecDesc: string
    evidenceReview: string
    possibleExplanations: string
    supporting: string
    contradicting: string
    safeNextChecks: string
    safetyAlerts: string
    limitations: string
    sourcesUsed: string
    relatedMemory: string
    completedReadOnly: string
    staleEvidenceBanner: string
    missingInfoTitle: string
    recordLabel: string
    proOnly: string
    localRulesBadge: string
    testResults: Record<string, string>
    likelihoods: Record<string, string>
  }
  voice: {
    hudLabel: string
    sub: string
    listenEn: string
    listenHi: string
    pause: string
    resume: string
    stop: string
    synthesizing: string
    speed: string
    transcript: string
    hideTranscript: string
    copy: string
    copied: string
  }
  memory: {
    title: string
    telemetry: string
    searchPlaceholder: string
    emptyTitle: string
    emptyDesc: string
    matchesCount: string
    verifiedOutcomeLabel: string
    confirmedLabel: string
    none: string
  }
  intake: {
    title: string
    category: string
    brand: string
    model: string
    issueTitle: string
    symptoms: string
    priority: string
    customerContact: string
    cancel: string
    register: string
    creating: string
    categories: Record<string, string>
    errorSymptomsShort: string
    brandPlaceholder: string
    modelPlaceholder: string
    issuePlaceholder: string
    symptomsPlaceholder: string
    contactPlaceholder: string
    contactHint: string
    quickPresets: string
    estMinutes: string
    suspectedPart: string
  }
  settingsModal: {
    title: string
    subtitle: string
    eyebrow: string
    secDisplay: string
    animLabel: string
    animDesc: string
    oscLabel: string
    oscDesc: string
    contrastLabel: string
    contrastDesc: string
    replayCalibration: string
    secEngine: string
    engineLabel: string
    engineDesc: string
    engineFlashTurbo: string
    engineFlash: string
    engineGemma: string
    engineRules: string
    accelLabel: string
    accelDesc: string
    accelOn: string
    accelOff: string
    langLabel: string
    langDesc: string
    optEn: string
    optHi: string
    optHiLatn: string
    secWorkflow: string
    autoTriageLabel: string
    autoTriageDesc: string
    safetyLabel: string
    safetyDesc: string
    confirmDeleteLabel: string
    confirmDeleteDesc: string
    confirmCompleteLabel: string
    confirmCompleteDesc: string
    autoArchiveLabel: string
    autoArchiveDesc: string
    secAudio: string
    audioLabel: string
    audioDesc: string
    resetBtn: string
    closeBtn: string
  }
  creditsModal: {
    title: string
    subtitle: string
    eyebrow: string
    teamLeader: string
    engineer: string
    close: string
  }
  deleteModal: {
    title: string
    desc: string
    cancel: string
    confirm: string
    confirmCompleteTitle: string
    confirmCompleteMsg: string
    confirmCompleteBtn: string
  }
  standby: {
    status: string
    title: string
    desc: string
    resume: string
    closeTab: string
  }
  awakening: {
    tag: string
  }
  telemetry: {
    fan: string
    cameraReticle: string
    holoReticle: string
    waveform: string
    memoryHolo: string
    spokenNarrative: string
    notRecorded: string
    refreshed: string
  }
  components: {
    title: string
    telemetry: string
    totalComponents: string
    totalComponentsDesc: string
    reusableStock: string
    reusableStockDesc: string
    reservedBench: string
    reservedBenchDesc: string
    approvedResale: string
    approvedResaleDesc: string
    needsTesting: string
    needsTestingDesc: string
    searchPlaceholder: string
    allCategories: string
    allHealth: string
    allResale: string
    reuseEligibleOnly: string
    registerBtn: string
    emptyTitle: string
    emptyDesc: string
    stockAvailable: string
    stockReserved: string
    stockUsed: string
    testedOn: string
    evidenceLabel: string
    noEvidence: string
    sourceDeviceLabel: string
    locationLabel: string
    partNumberLabel: string
    btnReserve: string
    btnUse: string
    btnRelease: string
    btnReviewResale: string
    btnEdit: string
    btnDelete: string
    registerModalTitle: string
    registerModalSub: string
    editModalTitle: string
    reserveModalTitle: string
    reserveModalSub: string
    reviewModalTitle: string
    reviewModalSub: string
    reviewModalWarning: string
    reserveQtyLabel: string
    reserveCaseLabel: string
    reserveNotesLabel: string
    resaleDecisionLabel: string
    resaleReasonLabel: string
    resaleConditionLabel: string
    resalePriceLabel: string
    confirmReserveBtn: string
    confirmUseBtn: string
    confirmReleaseBtn: string
    submitReviewBtn: string
    saveChangesBtn: string
    cancelBtn: string
    healthStatuses: Record<string, string>
    resaleStatuses: Record<string, string>
    reuseStatuses: Record<string, string>
    categories: Record<string, string>
    conditions: Record<string, string>
  }

  statuses: Record<string, string>
  priorities: Record<string, string>
  testOptions: Array<{ value: string; label: string }>
}

export const translations: Record<DiagnosticLanguage, I18nCatalog> = {
  en: {
    nav: {
      home: 'Home',
      overview: 'Overview',
      cases: 'Repair Queue',
      components: 'Components',
      diagnostics: 'Diagnostics',
      memory: 'Repair Memory',
      settings: 'Settings',
      credits: 'Credits',
      newRepair: 'New Repair',
      quit: 'Quit Site',
    },
    home: {
      status: 'SYS.STATUS // ONLINE',
      matrix: 'REVIX AI // REASONING MATRIX',
      eyebrow: 'ELECTRONICS REPAIR INTELLIGENCE',
      tagline: 'Grounded diagnostic co-pilot for electronics repair & fault verification.',
      menuNew: 'New Repair',
      menuOverview: 'Overview',
      menuQueue: 'Repair Queue',
      menuComponents: 'Components',
      menuSettings: 'Settings',
      menuCredits: 'Credits',
      menuQuit: 'Quit Site',
      footerHint: 'HACK DAY AT MICROSOFT // REVIX AI COPILOT',
    },
    overview: {
      title: 'Workshop Overview',
      telemetry: 'SYSTEM OVERVIEW // LIVE TELEMETRY',
      activeRepairs: 'Active Repairs',
      activeRepairsDesc: 'Devices currently in intake, diagnosis, or bench repair.',
      needsAttention: 'Needs Attention',
      needsAttentionDesc: 'High or urgent priority cases that are still open.',
      readyForTesting: 'Ready for Testing',
      readyForTestingDesc: 'Repairs awaiting final verification before completion.',
      savedPrecedents: 'Saved Precedents',
      savedPrecedentsDesc: 'Completed cases with confirmed faults and verification outcomes.',
      quickActions: 'Quick Actions',
      newIntake: 'New Intake',
      openQueue: 'Open Repair Queue',
      diagnostics: 'Launch Diagnostics',
      recentCases: 'Recent Repair Activity',
      viewDetails: 'View Details',
      noRecent: 'No recent repair activity recorded yet.',
      issuesSingular: 'ISSUE',
      issuesPlural: 'ISSUES',
      noUrgentTitle: 'No urgent repairs in queue',
      noUrgentDesc: 'All active devices operating on schedule.',
    },
    cases: {
      title: 'Repair Queue',
      telemetry: 'WORKBENCH PIPELINE // QUEUE DISPATCH',
      allStatuses: 'All statuses',
      allPriorities: 'All priorities',
      searchPlaceholder: 'Search cases by device, brand, model, issue, or fault...',
      colId: 'CASE ID',
      colDevice: 'DEVICE / MODEL',
      colIssue: 'REPORTED ISSUE',
      colPriority: 'PRIORITY',
      colStatus: 'STATUS',
      colUpdated: 'LAST UPDATED',
      colActions: 'ACTIONS',
      openCase: 'Diagnose',
      emptyTitle: 'No repair cases found',
      emptyDesc: 'Try adjusting your search query or status filter, or create a new repair intake.',
      activeQueue: 'ACTIVE QUEUE',
      devicesSingular: 'DEVICE',
      devicesPlural: 'DEVICES',
      customerContactCol: 'CUSTOMER CONTACT',
    },
    diagnostics: {
      title: 'Diagnostics',
      telemetry: 'OPTICAL DIAGNOSTIC LAB // MULTI-SPECTRAL TELEMETRY',
      selectDevice: 'Select device',
      delete: 'Delete',
      tabEvidence: 'Evidence & Repair Outcome',
      tabComponents: 'Component Health',
      tabRecommendation: 'AI Recommendation',
      componentHealthTitle: 'Component Health Tracker',
      componentHealthDesc: 'Track individual electronic components and recorded test observations. Status must be based on actual recorded evidence.',
      trackComponent: 'Track Component',
      updateHealth: 'Update Health / Log Test',
      testEvidenceRequired: 'Working or Faulty status requires actual observed multimeter readings or test evidence.',
      chooseDeviceTitle: 'Choose a device',
      chooseDeviceDesc: 'Select an existing device from the dropdown above to view or enter diagnostic data.',
      symptoms: 'SYMPTOMS',
      tests: 'tests',
      diagnosticEvidence: 'Diagnostic evidence',
      resultsCount: 'RESULTS',
      noTests: 'No test results yet. Record the first test below.',
      addTestLabel: 'ADD A TEST RESULT',
      testPerformed: 'Test performed',
      testPerformedPlaceholder: 'Type any bench test (e.g. PPBUS_G3H Rail Voltage, Thermal Camera Scan)...',
      changeDevice: 'Change Device',
      deviceModalTitle: 'Select Device for Diagnostics',
      deviceModalSub: 'Choose an active workbench repair case to inspect, record test telemetry, or generate AI recommendations.',
      deviceModalSearch: 'Search cases by ID, brand, model, issue, or symptoms...',
      deviceModalNoResults: 'No devices found matching your search.',
      deviceModalActive: 'CURRENTLY SELECTED',
      resultLabel: 'Result',
      observation: 'Observation',
      observationPlaceholder: 'What was observed during testing?',
      notes: 'Notes',
      notesPlaceholder: 'Additional conditions or context',
      optional: '(optional)',
      saveTest: 'Save test',
      saving: 'Saving…',
      repairOutcome: 'Repair outcome',
      confirmedFault: 'Confirmed fault',
      confirmedFaultPlaceholder: 'Diagnosed specific fault',
      repairAction: 'Repair action taken',
      repairActionPlaceholder: 'What component was repaired or replaced?',
      verificationOutcome: 'Verification outcome',
      verificationOutcomePlaceholder: 'Final verification result after repair',
      setStatus: 'Set status',
      saveOutcome: 'Save outcome',
      copilotTitle: 'Diagnostic copilot',
      generateBtn: 'Generate recommendation',
      regenerateBtn: 'Regenerate recommendation',
      generatingBtn: 'Generating…',
      noRecTitle: 'No recommendation generated yet',
      noRecDesc: 'Click "Generate recommendation" above to produce guided checks from entered evidence.',
      evidenceReview: 'Evidence review',
      possibleExplanations: 'Possible explanations',
      supporting: 'SUPPORTING',
      contradicting: 'CONTRADICTING',
      safeNextChecks: 'Safe next checks',
      safetyAlerts: 'Safety guidance & notes',
      limitations: 'Limitations & scope',
      sourcesUsed: 'Sources referenced',
      relatedMemory: 'Related repair memory',
      completedReadOnly: 'This case is completed. Reopen to record more tests.',
      staleEvidenceBanner: 'New test evidence was added after this recommendation.',
      missingInfoTitle: 'Missing information',
      recordLabel: 'Record:',
      proOnly: 'Pro only',
      localRulesBadge: 'LOCAL RULES',
      testResults: {
        pass: 'Pass / changed as expected',
        fail: 'Fail / issue persists',
        inconclusive: 'Inconclusive',
        not_tested: 'Not tested yet',
        not_applicable: 'Not applicable',
      },
      likelihoods: {
        probable: 'Probable',
        plausible: 'Plausible',
        possible: 'Possible',
        unlikely: 'Unlikely',
        less_likely: 'Less likely',
      },
    },
    voice: {
      hudLabel: 'AI DIAGNOSTIC AUDIO BRIEFING',
      sub: 'Spoken technical executive summary for workshop technicians',
      listenEn: 'Listen English',
      listenHi: 'Listen Hindi',
      pause: 'Pause',
      resume: 'Resume',
      stop: 'Stop',
      synthesizing: 'Synthesizing Voice…',
      speed: 'Speed:',
      transcript: 'Transcript',
      hideTranscript: 'Hide Script',
      copy: 'Copy Script',
      copied: 'Copied!',
    },
    memory: {
      title: 'Repair Memory',
      telemetry: 'PRECEDENT RETRIEVAL // HISTORICAL OUTCOMES',
      searchPlaceholder: 'Search past completed repairs by device, fault, or action...',
      emptyTitle: 'No past repair records found',
      emptyDesc: 'Completed repairs with confirmed faults will automatically appear here as precedents.',
      matchesCount: 'PRECEDENTS',
      verifiedOutcomeLabel: 'VERIFIED OUTCOME',
      confirmedLabel: 'Confirmed:',
      none: 'None',
    },
    intake: {
      title: 'New Repair Case Intake',
      category: 'Device category',
      brand: 'Brand',
      model: 'Model',
      issueTitle: 'Reported issue title',
      symptoms: 'Detailed symptoms',
      priority: 'Priority level',
      customerContact: 'Customer contact / identifier (optional)',
      cancel: 'Cancel',
      register: 'Register Device',
      creating: 'Registering…',
      categories: {
        Smartphone: 'Smartphone',
        Laptop: 'Laptop',
        Desktop: 'Desktop',
        Tablet: 'Tablet',
        'Other electronics': 'Other electronics',
      },
      errorSymptomsShort: 'Add more detail about the reported symptoms.',
      brandPlaceholder: 'e.g. Samsung',
      modelPlaceholder: 'e.g. Galaxy A54',
      issuePlaceholder: 'e.g. Charging disconnects intermittently',
      symptomsPlaceholder: 'What was observed during intake?',
      contactPlaceholder: '+1 (555) 000-0000 or customer@example.com',
      contactHint: '(phone or email)',
      quickPresets: 'Diagnostic Presets',
      estMinutes: 'Est. Bench Time',
      suspectedPart: 'Suspected Faulty Component (Optional)',
    },
    settingsModal: {
      title: 'System Preferences',
      subtitle: 'Configure display telemetry, diagnostic engine, language and workflow safeguards.',
      eyebrow: 'SYSTEM CONFIGURATION',
      secDisplay: 'Display & Audio Feedback',
      animLabel: 'Holographic & Circuit Animations',
      animDesc: 'Enable circuit traces, sweeping optical lasers, and neon HUD visual pulses.',
      oscLabel: 'Live Telemetry Oscilloscope',
      oscDesc: 'Display animated hardware frequency waveform & system telemetry in the HUD.',
      contrastLabel: 'High-Contrast HUD',
      contrastDesc: 'Maximizes line crispness and background opacity for bright workshop lighting.',
      replayCalibration: 'Replay Optical Calibration Sequence',
      secEngine: 'AI & Reasoning Engine',
      engineLabel: 'Diagnostics Inference Engine',
      engineDesc: 'Choose between low-latency Flash Turbo (~1-2s), balanced Flash, deep Gemma reasoning, or instant offline rules.',
      engineFlashTurbo: '⚡ Gemini Flash Turbo (~1-2s · Recommended)',
      engineFlash: '⚡ Gemini 3.5 Flash (~3-5s · Balanced)',
      engineGemma: '🧠 Gemma 4 26B (~35-45s · Extended Reasoning)',
      engineRules: '⚙️ Rule-based Local Engine (Instant offline)',
      accelLabel: 'Gemma 4 Turbo Acceleration',
      accelDesc: 'Allow Gemini Turbo fallback for fast diagnostics, or enforce strict Gemma 4 only.',
      accelOn: 'Enabled (Gemini Turbo Fallback)',
      accelOff: 'Strict (Gemma 4 Only · No Fallback)',
      langLabel: 'Language / भाषा (Whole Project)',
      langDesc: 'Changes the language of the entire application and AI recommendations.',
      optEn: 'English (Default · Technical Global)',
      optHi: 'हिन्दी (Proper Hindi · देवनागरी)',
      optHiLatn: 'Hinglish (Hindi in Latin script · Romanized)',
      secWorkflow: 'Workflow Preferences',
      autoTriageLabel: 'Automatic AI Triage on Intake',
      autoTriageDesc: 'Instantly evaluate fault probability and generate test matrix when a device is registered.',
      safetyLabel: 'Strict Safety Quarantine',
      safetyDesc: 'Enforces mandatory stop-and-escalate flags for thermal runaway, swollen cells, or chemical odors.',
      confirmDeleteLabel: 'Confirm Device Deletions',
      confirmDeleteDesc: 'Require technician confirmation modal before permanently deleting a repair case.',
      confirmCompleteLabel: 'Confirm Repair Completion',
      confirmCompleteDesc: 'Require confirmation before setting a device as completed and archiving to memory.',
      autoArchiveLabel: 'Auto-Archive Completed Repairs',
      autoArchiveDesc: 'Keep the repair queue focused by filtering completed devices into Repair Memory.',
      secAudio: 'Mechanical Audio Feedback',
      audioLabel: 'Mechanical Audio Feedback',
      audioDesc: 'Synthesize tactile retro clicks and alerts on user interaction.',
      resetBtn: 'Reset Defaults',
      closeBtn: 'Close',
    },
    creditsModal: {
      title: 'Revix AI Engineering Team',
      subtitle: 'Built with passion for precision electronics repair intelligence.',
      eyebrow: 'HACK DAY AT MICROSOFT',
      teamLeader: 'Team Leader',
      engineer: 'Team Member',
      close: 'Close',
    },
    deleteModal: {
      title: 'Delete Repair Case?',
      desc: 'This will permanently remove the case and all associated test results from the database.',
      cancel: 'Keep Case',
      confirm: 'Delete Permanently',
      confirmCompleteTitle: 'Mark device as completed?',
      confirmCompleteMsg: 'Marking this case as completed will archive the device into Repair Memory and remove it from the active repair queue.',
      confirmCompleteBtn: 'Mark completed',
    },
    standby: {
      status: 'SESSION SUSPENDED // WORKSPACE STANDBY',
      title: 'Revix Hardware OS Disengaged',
      desc: 'Diagnostic matrix placed in safe standby mode. All repair logs and test data are stored safely. You can close this tab using Cmd+W / Ctrl+W or click Close Tab below:',
      resume: 'Resume Session',
      closeTab: 'Close Tab',
    },
    awakening: {
      tag: 'OPTICAL CALIBRATION // 100% FOCUS',
    },
    telemetry: {
      fan: 'FAN: 3,420 RPM · 38°C',
      cameraReticle: 'OPTICAL RETICLE // 12MP DUAL OIS',
      holoReticle: 'HOLO-HUD // EXPLODED ASSEMBLY VIEW',
      waveform: '142.5 MHz // RF NOMINAL',
      memoryHolo: 'NEURAL BLUEPRINT ARCHIVE // SCHEMATIC MEMORY',
      spokenNarrative: 'SYS.TTS // SPOKEN NARRATIVE',
      notRecorded: 'Not recorded',
      refreshed: 'Refreshed.',
    },
    components: {
      title: 'Reuse & Resale Inventory',
      telemetry: 'COMPONENT HARVEST & RECOVERY MATRIX // BENCH TELEMETRY',
      totalComponents: 'Total Components',
      totalComponentsDesc: 'Registered electronic parts harvested or stocked on bench.',
      reusableStock: 'Reusable Stock',
      reusableStockDesc: 'Verified working components eligible for future repair work.',
      reservedBench: 'Reserved for Bench',
      reservedBenchDesc: 'Allocated parts locked for active repair cases.',
      approvedResale: 'Approved for Resale',
      approvedResaleDesc: 'Strictly tested components reviewed and cleared for secondary sale.',
      needsTesting: 'Needs Testing',
      needsTestingDesc: 'Harvested parts awaiting multimeter or diagnostic verification.',
      searchPlaceholder: 'Search by part name, part #, model, or case ID...',
      allCategories: 'All Categories',
      allHealth: 'All Health Statuses',
      allResale: 'All Resale Statuses',
      reuseEligibleOnly: 'Verified Reusable Only',
      registerBtn: 'Register Component',
      emptyTitle: 'No components found',
      emptyDesc: 'Adjust your search filters or harvest and register a new electronic part.',
      stockAvailable: 'Available',
      stockReserved: 'Reserved',
      stockUsed: 'Used',
      testedOn: 'Tested on',
      evidenceLabel: 'Test Evidence',
      noEvidence: 'No test evidence recorded yet.',
      sourceDeviceLabel: 'Source Device',
      locationLabel: 'Bin Location',
      partNumberLabel: 'Part #',
      btnReserve: 'Reserve',
      btnUse: 'Mark Used',
      btnRelease: 'Release',
      btnReviewResale: 'Resale Review',
      btnEdit: 'Edit',
      btnDelete: 'Delete',
      registerModalTitle: 'Register Electronic Component',
      registerModalSub: 'Log component harvest from salvage donor or warehouse stock.',
      editModalTitle: 'Edit Component Details',
      reserveModalTitle: 'Reuse Inventory Action',
      reserveModalSub: 'Allocate stock to an active repair case or update bench usage.',
      reviewModalTitle: 'Secondary Resale Review',
      reviewModalSub: 'Verify physical condition and test evidence before approving secondary market resale.',
      reviewModalWarning: 'Safety Invariant: Components lacking working test evidence or showing physical damage cannot be approved for resale.',
      reserveQtyLabel: 'Quantity',
      reserveCaseLabel: 'Target Repair Case ID',
      reserveNotesLabel: 'Bench Notes / Purpose',
      resaleDecisionLabel: 'Review Decision',
      resaleReasonLabel: 'Review Rationale & Justification',
      resaleConditionLabel: 'Cosmetic / Physical Verification',
      resalePriceLabel: 'Target Resale Price ($)',
      confirmReserveBtn: 'Confirm Reservation',
      confirmUseBtn: 'Confirm Usage',
      confirmReleaseBtn: 'Release Reservation',
      submitReviewBtn: 'Submit Resale Review',
      saveChangesBtn: 'Save Changes',
      cancelBtn: 'Cancel',
      healthStatuses: {
        working: 'Working / Verified',
        faulty: 'Faulty / Defective',
        needs_testing: 'Needs Testing',
        unknown: 'Unknown',
      },
      resaleStatuses: {
        under_review: 'Under Review',
        approved: 'Approved for Resale',
        not_eligible: 'Not Eligible',
      },
      reuseStatuses: {
        available: 'Available for Reuse',
        partially_reserved: 'Partially Reserved',
        reserved: 'Fully Reserved',
        depleted: 'Depleted',
      },
      categories: {
        screen: 'Screen / Display',
        battery: 'Battery / Power Cell',
        mother_board: 'Logic Board / Motherboard',
        camera: 'Camera Module',
        charging_port: 'Charging Sub-board',
        audio: 'Speaker / Earpiece',
        sensor: 'Sensors & Haptics',
        other: 'Other Hardware',
      },
      conditions: {
        LikeNew: 'Like New / Pristine',
        Good: 'Good / Light Wear',
        Fair: 'Fair / Usable Wear',
        Damaged: 'Damaged / Burned / Swollen',
      },
    },
    statuses: {
      new: 'New',
      diagnosing: 'Diagnosing',
      waiting_parts: 'Waiting for parts',
      in_repair: 'In repair',
      testing: 'Testing',
      completed: 'Completed',
      on_hold: 'On hold',
    },
    priorities: {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
    },
    testOptions: [
      { value: 'pass', label: 'Pass / changed as expected' },
      { value: 'fail', label: 'Fail / issue persists' },
      { value: 'inconclusive', label: 'Inconclusive' },
      { value: 'not_tested', label: 'Not tested yet' },
      { value: 'not_applicable', label: 'Not applicable' },
    ],
  },

  hi: {
    nav: {
      home: 'होम',
      overview: 'अवलोकन',
      cases: 'रिपेयर कतार',
      components: 'पुर्जे / पार्ट्स',
      diagnostics: 'डायग्नोस्टिक्स',
      memory: 'रिपेयर मेमोरी',
      settings: 'सेटिंग्स',
      credits: 'क्रेडिट्स',
      newRepair: 'नया रिपेयर',
      quit: 'साइट बंद करें',
    },
    home: {
      status: 'सिस्टम स्थिति // ऑनलाइन',
      matrix: 'रेविक्स एआई // रीज़निंग मैट्रिक्स',
      eyebrow: 'इलेक्ट्रॉनिक्स रिपेयर इंटेलिजेंस',
      tagline: 'इलेक्ट्रॉनिक्स मरम्मत और खराबी सत्यापन के लिए सटीक डायग्नोस्टिक सह-पायलट।',
      menuNew: 'नया रिपेयर',
      menuOverview: 'अवलोकन',
      menuQueue: 'रिपेयर कतार',
      menuComponents: 'पुर्जे / पार्ट्स',
      menuSettings: 'सेटिंग्स',
      menuCredits: 'क्रेडिट्स',
      menuQuit: 'साइट बंद करें',
      footerHint: 'माइक्रोसॉफ्ट हैक डे // रेविक्स एआई कोपायलट',
    },
    overview: {
      title: 'वर्कशॉप अवलोकन',
      telemetry: 'सिस्टम अवलोकन // लाइव टेलीमेट्री',
      activeRepairs: 'सक्रिय रिपेयर',
      activeRepairsDesc: 'वर्तमान में इनटेक, डायग्नोसिस या मरम्मत में चल रहे उपकरण।',
      needsAttention: 'ध्यान देने योग्य',
      needsAttentionDesc: 'उच्च या तत्काल प्राथमिकता वाले खुले मामले।',
      readyForTesting: 'परीक्षण के लिए तैयार',
      readyForTestingDesc: 'पूर्ण होने से पहले अंतिम सत्यापन की प्रतीक्षा कर रहे मामले।',
      savedPrecedents: 'सहेजे गए केस',
      savedPrecedentsDesc: 'पुष्टि किए गए दोषों और परिणामों के साथ पूर्ण मामले।',
      quickActions: 'त्वरित क्रियाएं',
      newIntake: 'नया उपकरण जोड़ें',
      openQueue: 'रिपेयर कतार खोलें',
      diagnostics: 'डायग्नोस्टिक्स शुरू करें',
      recentCases: 'हाल की रिपेयर गतिविधि',
      viewDetails: 'विवरण देखें',
      noRecent: 'अभी तक कोई हालिया रिपेयर गतिविधि दर्ज नहीं है।',
      issuesSingular: 'समस्या',
      issuesPlural: 'समस्याएं',
      noUrgentTitle: 'कतार में कोई जरूरी मामला नहीं है',
      noUrgentDesc: 'सभी सक्रिय उपकरण सामान्य स्थिति में हैं।',
    },
    cases: {
      title: 'रिपेयर कतार',
      telemetry: 'वर्कबेंच पाइपलाइन // कतार प्रेषण',
      allStatuses: 'सभी स्थितियां',
      allPriorities: 'सभी प्राथमिकताएं',
      searchPlaceholder: 'उपकरण, ब्रांड, मॉडल या समस्या से खोजें...',
      colId: 'केस आईडी',
      colDevice: 'उपकरण / मॉडल',
      colIssue: 'दर्ज समस्या',
      colPriority: 'प्राथमिकता',
      colStatus: 'स्थिति',
      colUpdated: 'अंतिम अपडेट',
      colActions: 'कार्रवाई',
      openCase: 'जांचें',
      emptyTitle: 'कोई रिपेयर केस नहीं मिला',
      emptyDesc: 'अपनी खोज या फ़िल्टर बदलें, या नया रिपेयर दर्ज करें।',
      activeQueue: 'सक्रिय कतार',
      devicesSingular: 'उपकरण',
      devicesPlural: 'उपकरण',
      customerContactCol: 'ग्राहक संपर्क',
    },
    diagnostics: {
      title: 'डायग्नोस्टिक्स',
      telemetry: 'ऑप्टिकल डायग्नोस्टिक लैब // मल्टी-स्पेक्ट्रल टेलीमेट्री',
      selectDevice: 'उपकरण चुनें',
      delete: 'हटाएं',
      tabEvidence: 'साक्ष्य और रिपेयर परिणाम',
      tabComponents: 'घटक स्वास्थ्य',
      tabRecommendation: 'एआई सिफारिश',
      componentHealthTitle: 'घटक स्वास्थ्य ट्रैकर',
      componentHealthDesc: 'व्यक्तिगत इलेक्ट्रॉनिक घटकों और मल्टीमीटर परीक्षण अवलोकनों को ट्रैक करें। स्थिति वास्तविक साक्ष्य पर आधारित होनी चाहिए।',
      trackComponent: 'नया घटक ट्रैक करें',
      updateHealth: 'स्वास्थ्य / परीक्षण दर्ज करें',
      testEvidenceRequired: 'कार्यरत या खराब स्थिति के लिए वास्तविक मल्टीमीटर साक्ष्य आवश्यक है।',
      chooseDeviceTitle: 'एक उपकरण चुनें',
      chooseDeviceDesc: 'डायग्नोस्टिक डेटा देखने या दर्ज करने के लिए ऊपर ड्रॉपडाउन से उपकरण चुनें।',
      symptoms: 'लक्षण',
      tests: 'परीक्षण',
      diagnosticEvidence: 'डायग्नोस्टिक साक्ष्य',
      resultsCount: 'परिणाम',
      noTests: 'अभी कोई परीक्षण परिणाम नहीं है। नीचे पहला परीक्षण दर्ज करें।',
      addTestLabel: 'परीक्षण परिणाम जोड़ें',
      testPerformed: 'किया गया परीक्षण',
      testPerformedPlaceholder: 'कोई भी बेंच टेस्ट टाइप करें (जैसे PPBUS_G3H रेल वोल्टेज, थर्मल कैमरा स्कैन)...',
      changeDevice: 'उपकरण बदलें',
      deviceModalTitle: 'डायग्नोस्टिक्स के लिए उपकरण चुनें',
      deviceModalSub: 'निरीक्षण करने, परीक्षण टेलीमेट्री दर्ज करने, या एआई सिफारिश उत्पन्न करने के लिए वर्कबेंच केस चुनें।',
      deviceModalSearch: 'केस आईडी, ब्रांड, मॉडल या समस्या से खोजें...',
      deviceModalNoResults: 'आपकी खोज से मेल खाता कोई उपकरण नहीं मिला।',
      deviceModalActive: 'वर्तमान में चयनित',
      resultLabel: 'परिणाम',
      observation: 'अवलोकन / क्या देखा गया',
      observationPlaceholder: 'परीक्षण के दौरान क्या देखा गया?',
      notes: 'अतिरिक्त टिप्पणियाँ',
      notesPlaceholder: 'अतिरिक्त शर्तें या संदर्भ',
      optional: '(वैकल्पिक)',
      saveTest: 'परीक्षण सहेजें',
      saving: 'सहेज रहे हैं…',
      repairOutcome: 'मरम्मत परिणाम',
      confirmedFault: 'पुष्टि की गई खराबी',
      confirmedFaultPlaceholder: 'पहचाना गया दोष / खराबी',
      repairAction: 'की गई मरम्मत कार्रवाई',
      repairActionPlaceholder: 'कौन सा पुर्जा ठीक या बदला गया?',
      verificationOutcome: 'सत्यापन परिणाम',
      verificationOutcomePlaceholder: 'मरम्मत के बाद अंतिम जांच का परिणाम',
      setStatus: 'स्थिति सेट करें',
      saveOutcome: 'परिणाम सहेजें',
      copilotTitle: 'डायग्नोस्टिक कोपायलट',
      generateBtn: 'सिफारिश उत्पन्न करें',
      regenerateBtn: 'पुनः सिफारिश उत्पन्न करें',
      generatingBtn: 'तैयार कर रहे हैं…',
      noRecTitle: 'अभी कोई सिफारिश उत्पन्न नहीं हुई है',
      noRecDesc: 'दर्ज साक्ष्य से निर्देशित जांच उत्पन्न करने के लिए ऊपर "सिफारिश उत्पन्न करें" पर क्लिक करें।',
      evidenceReview: 'साक्ष्य समीक्षा',
      possibleExplanations: 'संभावित कारण और परिकल्पनाएं',
      supporting: 'समर्थक साक्ष्य',
      contradicting: 'विरोधाभासी साक्ष्य',
      safeNextChecks: 'सुरक्षित अगले परीक्षण',
      safetyAlerts: 'सुरक्षा निर्देश और चेतावनियाँ',
      limitations: 'सीमाएं और दायरा',
      sourcesUsed: 'संदर्भित स्रोत',
      relatedMemory: 'संबंधित रिपेयर मेमोरी',
      completedReadOnly: 'यह मामला पूर्ण हो चुका है। और परीक्षण दर्ज करने के लिए इसे पुनः खोलें।',
      staleEvidenceBanner: 'इस सिफारिश के बाद नए परीक्षण साक्ष्य जोड़े गए।',
      missingInfoTitle: 'अतिरिक्त जानकारी आवश्यक',
      recordLabel: 'दर्ज करें:',
      proOnly: 'केवल विशेषज्ञ',
      localRulesBadge: 'स्थानीय नियम',
      testResults: {
        pass: 'पास / सामान्य व्यवहार',
        fail: 'फेल / समस्या बनी रही',
        inconclusive: 'अनिर्णायक',
        not_tested: 'अभी परीक्षण नहीं हुआ',
        not_applicable: 'लागू नहीं',
      },
      likelihoods: {
        probable: 'अत्यधिक संभावित',
        plausible: 'संभावित',
        possible: 'संभावित',
        unlikely: 'कम संभावित',
        less_likely: 'कम संभावित',
      },
    },
    voice: {
      hudLabel: 'एआई डायग्नोस्टिक ऑडियो ब्रीफिंग',
      sub: 'कार्यशाला तकनीशियनों के लिए हिंदी में डायग्नोस्टिक ऑडियो सारांश',
      listenEn: 'अंग्रेज़ी में सुनें',
      listenHi: 'हिन्दी में सुनें',
      pause: 'रोकें',
      resume: 'जारी रखें',
      stop: 'बंद करें',
      synthesizing: 'आवाज़ तैयार हो रही है…',
      speed: 'गति:',
      transcript: 'स्क्रिप्ट देखें',
      hideTranscript: 'स्क्रिप्ट छिपाएं',
      copy: 'कॉपी करें',
      copied: 'कॉपी हो गया!',
    },
    memory: {
      title: 'रिपेयर मेमोरी',
      telemetry: 'ऐतिहासिक केस पुनर्प्राप्ति // सत्यापित परिणाम',
      searchPlaceholder: 'पुराने केस, खराबी या समाधान से खोजें...',
      emptyTitle: 'कोई पुराना रिकॉर्ड नहीं मिला',
      emptyDesc: 'पुष्टि की गई खराबी वाले पूरे मामले मिसाल के रूप में यहां दिखाई देंगे।',
      matchesCount: 'मिसालें',
      verifiedOutcomeLabel: 'सत्यापित परिणाम',
      confirmedLabel: 'पुष्टि की गई:',
      none: 'कोई नहीं',
    },
    intake: {
      title: 'नया रिपेयर केस पंजीकरण',
      category: 'उपकरण श्रेणी',
      brand: 'ब्रांड',
      model: 'मॉडल',
      issueTitle: 'समस्या का संक्षिप्त विवरण',
      symptoms: 'विस्तृत लक्षण',
      priority: 'प्राथमिकता स्तर',
      customerContact: 'ग्राहक संपर्क / पहचान (वैकल्पिक)',
      cancel: 'रद्द करें',
      register: 'उपकरण पंजीकृत करें',
      creating: 'पंजीकृत कर रहे हैं…',
      categories: {
        Smartphone: 'स्मार्टफ़ोन',
        Laptop: 'लैपटॉप',
        Desktop: 'डेस्कटॉप',
        Tablet: 'टैबलेट',
        'Other electronics': 'अन्य इलेक्ट्रॉनिक्स',
      },
      errorSymptomsShort: 'कृपया लक्षणों का थोड़ा और विवरण दर्ज करें।',
      brandPlaceholder: 'जैसे सैमसंग',
      modelPlaceholder: 'जैसे गैलेक्सी A54',
      issuePlaceholder: 'जैसे चार्जिंग बीच-बीच में कट जाती है',
      symptomsPlaceholder: 'इनटेक के दौरान क्या लक्षण देखे गए?',
      contactPlaceholder: '+91 98765 43210 या customer@example.com',
      contactHint: '(फ़ोन या ईमेल)',
      quickPresets: 'त्वरित डायग्नोस्टिक प्रीसेट',
      estMinutes: 'अनुमानित बेंच समय',
      suspectedPart: 'संभावित खराब पुर्जा (वैकल्पिक)',
    },
    settingsModal: {
      title: 'सिस्टम प्राथमिकताएं',
      subtitle: 'डिस्प्ले, डायग्नोस्टिक इंजन, भाषा और वर्कफ़्लो सुरक्षा को कॉन्फ़िगर करें।',
      eyebrow: 'सिस्टम कॉन्फ़िगरेशन',
      secDisplay: 'डिस्प्ले और ऑडियो प्रतिक्रिया',
      animLabel: 'होलोग्राफिक और सर्किट एनिमेशन',
      animDesc: 'सर्किट ट्रेस, लेज़र स्कैनर और नियॉन पल्स प्रभाव सक्रिय करें।',
      oscLabel: 'लाइव टेलीमेट्री ऑसिलोस्कोप',
      oscDesc: 'HUD में गतिशील हार्डवेयर फ़्रीक्वेंसी वेवफ़ॉर्म और लाइव सिस्टम टेलीमेट्री दिखाएं।',
      contrastLabel: 'उच्च-कंट्रास्ट HUD',
      contrastDesc: 'तेज़ रोशनी वाली वर्कशॉप के लिए अधिक स्पष्टता और कंट्रास्ट।',
      replayCalibration: 'ऑप्टिकल कैलिब्रेशन सीक्वेंस दोबारा चलाएं',
      secEngine: 'एआई और रीज़निंग इंजन',
      engineLabel: 'डायग्नोस्टिक्स इन्फेरेंस इंजन',
      engineDesc: 'लो-लेटेंसी फ्लैश टर्बो (~1-2s), संतुलित फ्लैश, गेम्मा 4 या ऑफलाइन नियमों में से चुनें।',
      engineFlashTurbo: '⚡ जेमिनी फ्लैश टर्बो (~1-2s · अनुशंसित)',
      engineFlash: '⚡ जेमिनी 3.5 फ्लैश (~3-5s · संतुलित)',
      engineGemma: '🧠 गेम्मा 4 26B (~35-45s · गहन रीज़निंग)',
      engineRules: '⚙️ नियम-आधारित स्थानीय इंजन (त्वरित ऑफलाइन)',
      accelLabel: 'गेम्मा 4 टर्बो गतिवर्धन (Acceleration)',
      accelDesc: 'तेज़ डायग्नोस्टिक्स के लिए जेमिनी टर्बो फ़ॉलबैक की अनुमति दें, या केवल गेम्मा 4 पर टिके रहें।',
      accelOn: 'सक्रिय (जेमिनी टर्बो फ़ॉलबैक सक्षम)',
      accelOff: 'सख्त (केवल गेम्मा 4 · कोई फ़ॉलबैक नहीं)',
      langLabel: 'भाषा / Language (पूरा प्रोजेक्ट)',
      langDesc: 'पूरे एप्लिकेशन इंटरफ़ेस और एआई सिफारिशों की भाषा बदलता है।',
      optEn: 'English (अंग्रेज़ी · Technical Global)',
      optHi: 'हिन्दी (Proper Hindi · देवनागरी)',
      optHiLatn: 'Hinglish (रोमनाइज़्ड हिन्दी)',
      secWorkflow: 'वर्कफ़्लो प्राथमिकताएं',
      autoTriageLabel: 'पंजीकरण पर स्वचालित एआई ट्राइएज',
      autoTriageDesc: 'उपकरण दर्ज होते ही स्वचालित रूप से संभावित खराबी और परीक्षण सुझाएं।',
      safetyLabel: 'सख्त सुरक्षा संगरोध',
      safetyDesc: 'अत्यधिक गर्मी, फूली बैटरी या गंध वाले मामलों को तुरंत सुरक्षा होल्ड पर रखें।',
      confirmDeleteLabel: 'डिवाइस हटाने से पहले पुष्टि करें',
      confirmDeleteDesc: 'केस स्थायी रूप से हटाने से पहले पुष्टिकरण संवाद दिखाएं।',
      confirmCompleteLabel: 'रिपेयर पूर्णता की पुष्टि करें',
      confirmCompleteDesc: 'केस को पूर्ण चिह्नित करने और मेमोरी में संग्रहीत करने से पहले पुष्टिकरण मांगें।',
      autoArchiveLabel: 'पूर्ण रिपेयर स्वचालित रूप से संग्रहीत करें',
      autoArchiveDesc: 'पूर्ण हो चुके उपकरणों को सीधे मेमोरी में भेजकर कतार को साफ़ रखें।',
      secAudio: 'मैकेनिकल ऑडियो प्रभाव',
      audioLabel: 'मैकेनिकल ऑडियो प्रभाव',
      audioDesc: 'क्लिक और अलर्ट पर रेट्रो ध्वनियाँ बजाएं।',
      resetBtn: 'डिफ़ॉल्ट रीसेट करें',
      closeBtn: 'बंद करें',
    },
    creditsModal: {
      title: 'रेविक्स एआई इंजीनियरिंग टीम',
      subtitle: 'सटीक इलेक्ट्रॉनिक्स रिपेयर इंटेलिजेंस के लिए समर्पित टीम।',
      eyebrow: 'माइक्रोसॉफ्ट हैक डे',
      teamLeader: 'टीम लीडर',
      engineer: 'इंजीनियरिंग एवं सिस्टम्स',
      close: 'बंद करें',
    },
    deleteModal: {
      title: 'क्या आप यह केस हटाना चाहते हैं?',
      desc: 'यह केस और इसके सभी परीक्षण परिणाम डेटाबेस से हमेशा के लिए हटा दिए जाएंगे।',
      cancel: 'केस रखें',
      confirm: 'स्थायी रूप से हटाएं',
      confirmCompleteTitle: 'मरम्मत पूर्ण चिह्नित करें?',
      confirmCompleteMsg: 'इस केस को पूर्ण चिह्नित करने से उपकरण रिपेयर मेमोरी में सहेज दिया जाएगा और सक्रिय कतार से हट जाएगा।',
      confirmCompleteBtn: 'पूर्ण चिह्नित करें',
    },
    standby: {
      status: 'सत्र निलंबित // वर्कस्पेस स्टैंडबाय',
      title: 'रेविक्स हार्डवेयर ओएस स्टैंडबाय',
      desc: 'डायग्नोस्टिक मैट्रिक्स को सुरक्षित स्टैंडबाय मोड में रखा गया है। सभी रिपेयर लॉग और टेस्ट डेटा सुरक्षित हैं। आप Cmd+W / Ctrl+W से इस टैब को बंद कर सकते हैं या नीचे क्लिक करें:',
      resume: 'सत्र पुनः शुरू करें',
      closeTab: 'टैब बंद करें',
    },
    awakening: {
      tag: 'ऑप्टिकल अंशांकन // 100% फोकस',
    },
    telemetry: {
      fan: 'पंखा: 3,420 आरपीएम · 38°C',
      cameraReticle: 'ऑप्टिकल रेटिकल // 12MP डुअल OIS',
      holoReticle: 'होलो-HUD // असेंबली एक्सप्लोडेड व्यू',
      waveform: '142.5 मेगाहर्ट्ज़ // आरएफ सामान्य',
      memoryHolo: 'न्यूरल ब्लूप्रिंट संग्रह // स्कीमेटिक मेमोरी',
      spokenNarrative: 'सिस्टम वॉयस // मौखिक विवरण',
      notRecorded: 'दर्ज नहीं',
      refreshed: 'डेटा ताज़ा किया गया।',
    },
    components: {
      title: 'पुर्जे पुनः उपयोग और पुनर्विक्रय इन्वेंटरी',
      telemetry: 'घटक संचयन एवं पुनर्प्राप्ति मैट्रिक्स // बेंच टेलीमेट्री',
      totalComponents: 'कुल पुर्जे',
      totalComponentsDesc: 'बेंच पर पंजीकृत इलेक्ट्रॉनिक पुर्जे या स्क्रैप से निकाले गए पार्ट्स।',
      reusableStock: 'पुनः उपयोग योग्य स्टॉक',
      reusableStockDesc: 'सत्यापित चालू पुर्जे जो भविष्य की मरम्मत में उपयोग के योग्य हैं।',
      reservedBench: 'बेंच के लिए आरक्षित',
      reservedBenchDesc: 'सक्रिय रिपेयर केस के लिए लॉक किए गए पुर्जे।',
      approvedResale: 'पुनर्विक्रय स्वीकृत',
      approvedResaleDesc: 'सख्त परीक्षण और समीक्षा के बाद द्वितीयक बिक्री के लिए स्वीकृत पुर्जे।',
      needsTesting: 'परीक्षण आवश्यक',
      needsTestingDesc: 'निकाले गए पुर्जे जिनका मल्टीमीटर या डायग्नोस्टिक परीक्षण बाकी है।',
      searchPlaceholder: 'पुर्जे का नाम, पार्ट नंबर, मॉडल या केस आईडी से खोजें...',
      allCategories: 'सभी श्रेणियां',
      allHealth: 'सभी स्वास्थ्य स्थितियां',
      allResale: 'सभी पुनर्विक्रय स्थितियां',
      reuseEligibleOnly: 'केवल सत्यापित पुनः उपयोग योग्य',
      registerBtn: 'नया पुर्जा दर्ज करें',
      emptyTitle: 'कोई पुर्जा नहीं मिला',
      emptyDesc: 'अपनी खोज या फ़िल्टर बदलें, या एक नया इलेक्ट्रॉनिक पुर्जा पंजीकृत करें।',
      stockAvailable: 'उपलब्ध',
      stockReserved: 'आरक्षित',
      stockUsed: 'उपयोग हुआ',
      testedOn: 'परीक्षण तिथि',
      evidenceLabel: 'परीक्षण साक्ष्य',
      noEvidence: 'अभी तक कोई परीक्षण साक्ष्य दर्ज नहीं है।',
      sourceDeviceLabel: 'स्रोत उपकरण',
      locationLabel: 'स्टोरेज बिन / स्थान',
      partNumberLabel: 'पार्ट नं.',
      btnReserve: 'आरक्षित करें',
      btnUse: 'उपयोग चिह्नित करें',
      btnRelease: 'आरक्षण हटाएं',
      btnReviewResale: 'पुनर्विक्रय समीक्षा',
      btnEdit: 'संपादित करें',
      btnDelete: 'हटाएं',
      registerModalTitle: 'इलेक्ट्रॉनिक पुर्जा पंजीकृत करें',
      registerModalSub: 'दान किए गए स्क्रैप उपकरण या स्टॉक से निकाले गए पुर्जे को दर्ज करें।',
      editModalTitle: 'पुर्जे का विवरण संपादित करें',
      reserveModalTitle: 'पुनः उपयोग इन्वेंटरी कार्रवाई',
      reserveModalSub: 'सक्रिय रिपेयर केस के लिए स्टॉक आवंटित करें या बेंच उपयोग अपडेट करें।',
      reviewModalTitle: 'द्वितीयक पुनर्विक्रय समीक्षा',
      reviewModalSub: 'द्वितीयक बाज़ार में पुनर्विक्रय की अनुमति देने से पहले भौतिक स्थिति और परीक्षण साक्ष्य की पुष्टि करें।',
      reviewModalWarning: 'सुरक्षा नियम: बिना परीक्षण साक्ष्य या क्षतिग्रस्त पुर्जों को पुनर्विक्रय के लिए स्वीकृत नहीं किया जा सकता।',
      reserveQtyLabel: 'मात्रा',
      reserveCaseLabel: 'लक्षित रिपेयर केस आईडी',
      reserveNotesLabel: 'बेंच नोट्स / उद्देश्य',
      resaleDecisionLabel: 'समीक्षा निर्णय',
      resaleReasonLabel: 'समीक्षा का औचित्य / कारण',
      resaleConditionLabel: 'भौतिक / दिखावट सत्यापन',
      resalePriceLabel: 'लक्षित पुनर्विक्रय मूल्य (₹ / $)',
      confirmReserveBtn: 'आरक्षण की पुष्टि करें',
      confirmUseBtn: 'उपयोग की पुष्टि करें',
      confirmReleaseBtn: 'आरक्षण मुक्त करें',
      submitReviewBtn: 'समीक्षा सबमिट करें',
      saveChangesBtn: 'बदलाव सहेजें',
      cancelBtn: 'रद्द करें',
      healthStatuses: {
        working: 'कार्यरत / सत्यापित (Working)',
        faulty: 'खराब / दोषपूर्ण (Faulty)',
        needs_testing: 'परीक्षण आवश्यक (Needs Testing)',
        unknown: 'अज्ञात (Unknown)',
      },
      resaleStatuses: {
        under_review: 'समीक्षाधीन (Under Review)',
        approved: 'पुनर्विक्रय स्वीकृत (Approved)',
        not_eligible: 'योग्य नहीं (Not Eligible)',
      },
      reuseStatuses: {
        available: 'पुनः उपयोग के लिए उपलब्ध',
        partially_reserved: 'आंशिक रूप से आरक्षित',
        reserved: 'पूर्णतः आरक्षित',
        depleted: 'समाप्त / खत्म',
      },
      categories: {
        screen: 'स्क्रीन / डिस्प्ले',
        battery: 'बैटरी / पावर सेल',
        mother_board: 'लॉजिक बोर्ड / मदरबोर्ड',
        camera: 'कैमरा मॉड्यूल',
        charging_port: 'चार्जिंग सब-बोर्ड',
        audio: 'स्पीकर / ईयरपीस',
        sensor: 'सेंसर और हैप्टिक्स',
        other: 'अन्य हार्डवेयर',
      },
      conditions: {
        LikeNew: 'बिल्कुल नया जैसा (Like New)',
        Good: 'अच्छी स्थिति (Good)',
        Fair: 'सामान्य स्थिति (Fair)',
        Damaged: 'क्षतिग्रस्त / जला हुआ (Damaged)',
      },
    },
    statuses: {
      new: 'नया',
      diagnosing: 'जांच जारी',
      waiting_parts: 'पुर्जों की प्रतीक्षा',
      in_repair: 'मरम्मत में',
      testing: 'परीक्षण जारी',
      completed: 'पूर्ण',
      on_hold: 'होल्ड पर',
    },
    priorities: {
      low: 'कम',
      normal: 'सामान्य',
      high: 'उच्च',
      urgent: 'अति आवश्यक',
    },
    testOptions: [
      { value: 'pass', label: 'पास / सामान्य व्यवहार' },
      { value: 'fail', label: 'फेल / समस्या बनी रही' },
      { value: 'inconclusive', label: 'अनिर्णायक' },
      { value: 'not_tested', label: 'अभी परीक्षण नहीं हुआ' },
      { value: 'not_applicable', label: 'लागू नहीं' },
    ],
  },

  'hi-Latn': {
    nav: {
      home: 'Mukhya Page',
      overview: 'Workshop Ka Haal',
      cases: 'Repairs Ki Kataar',
      components: 'Purze (Components)',
      diagnostics: 'Jaanch Padtal',
      memory: 'Purane Cases (Memory)',
      settings: 'Settings',
      credits: 'Team Parichay',
      newRepair: 'Naya Case Layein',
      quit: 'Site Band Karein',
    },
    home: {
      status: 'SYS.STATUS // ONLINE',
      matrix: 'REVIX AI // REASONING MATRIX',
      eyebrow: 'ELECTRONICS REPAIR BUDDHIMATTA',
      tagline: 'Electronics repair aur kharabi ki jaanch ke liye zameeni diagnostic co-pilot.',
      menuNew: 'Naya Case Layein',
      menuOverview: 'Workshop Ka Haal',
      menuQueue: 'Repairs Ki Kataar',
      menuComponents: 'Purze (Components)',
      menuSettings: 'Settings',
      menuCredits: 'Team Parichay',
      menuQuit: 'Site Band Karein',
      footerHint: 'MICROSOFT HACK DAY // REVIX AI COPILOT',
    },
    overview: {
      title: 'Workshop Ka Haal',
      telemetry: 'SYSTEM JAIZA // LIVE TELEMETRY',
      activeRepairs: 'Chalu Repairs',
      activeRepairsDesc: 'Intake, jaanch ya workbench par chal rahe devices.',
      needsAttention: 'Dhyan Dene Layak',
      needsAttentionDesc: 'Zaroori ya urgent priority wale khule cases.',
      readyForTesting: 'Testing Ke Liye Taiyar',
      readyForTestingDesc: 'Khatam hone se pehle aakhri jaanch ke intezar wale cases.',
      savedPrecedents: 'Sambhale Gaye Cases',
      savedPrecedentsDesc: 'Pakki kharabi aur nateeje ke sath poore huye purane cases.',
      quickActions: 'Jaldi Kaam (Quick Actions)',
      newIntake: 'Naya Case Layein',
      openQueue: 'Kataar Kholein',
      diagnostics: 'Jaanch Padtal Shuru Karein',
      recentCases: 'Haal Hi Ke Repairs',
      viewDetails: 'Poora Dekhein',
      noRecent: 'Abhi tak koi haal hi ka repair record nahi hua hai.',
      issuesSingular: 'MASLA',
      issuesPlural: 'MASLE',
      noUrgentTitle: 'Kataar mein koi urgent repair nahi hai',
      noUrgentDesc: 'Sabhi active devices normal schedule par chal rahe hain.',
    },
    cases: {
      title: 'Repairs Ki Kataar',
      telemetry: 'WORKBENCH PIPELINE // KATAAR DISPATCH',
      allStatuses: 'Sabhi sthitiyan (Statuses)',
      allPriorities: 'Sabhi tarjeeh (Priorities)',
      searchPlaceholder: 'Device, brand, model, samasya ya kharabi se khojein...',
      colId: 'CASE ID',
      colDevice: 'UPKARAN / MODEL',
      colIssue: 'DARJ SAMASYA',
      colPriority: 'TARJEEH (PRIORITY)',
      colStatus: 'STHITI (STATUS)',
      colUpdated: 'AAKHRI BADLAV',
      colActions: 'KADAM (ACTIONS)',
      openCase: 'Jaanch Karein',
      emptyTitle: 'Koi repair case nahi mila',
      emptyDesc: 'Apni khoj ya filter badlein, ya naya repair case darj karein.',
      activeQueue: 'CHALU KATAAR',
      devicesSingular: 'DEVICE',
      devicesPlural: 'DEVICES',
      customerContactCol: 'GRAHAK KA SAMPARK',
    },
    diagnostics: {
      title: 'Jaanch Padtal (Diagnostics)',
      telemetry: 'OPTICAL DIAGNOSTIC LAB // MULTI-SPECTRAL TELEMETRY',
      selectDevice: 'Device chunein',
      delete: 'Hataiye',
      tabEvidence: 'Saboot Aur Repair Ka Asar',
      tabComponents: 'Component Health',
      tabRecommendation: 'AI Ki Salah',
      componentHealthTitle: 'Component Health Tracker',
      componentHealthDesc: 'Har ek electronic part aur testing observations track karein. Status pakke saboot par aadharit hona chahiye.',
      trackComponent: 'Naya Component Track Karein',
      updateHealth: 'Health Update / Log Test',
      testEvidenceRequired: 'Working ya faulty status ke liye multimeter saboot zaroori hai.',
      chooseDeviceTitle: 'Ek device chunein',
      chooseDeviceDesc: 'Diagnostic data dekhne ya likhne ke liye upar menu se device select karein.',
      symptoms: 'LAKSHAN (SYMPTOMS)',
      tests: 'jaanchein',
      diagnosticEvidence: 'Jaanch Ke Saboot',
      resultsCount: 'NATIIJE',
      noTests: 'Abhi koi test results nahi hain. Pehla test niche darj karein.',
      addTestLabel: 'NAYA TEST RESULT JODEIN',
      testPerformed: 'Kiya gaya test',
      testPerformedPlaceholder: 'Koi bhi bench test type karein (e.g. PPBUS_G3H Rail Voltage, Thermal Camera Scan)...',
      changeDevice: 'Device Badlein',
      deviceModalTitle: 'Diagnostics Ke Liye Device Chunein',
      deviceModalSub: 'Inspect karne, test results likhne, ya AI salah lene ke liye workbench case select karein.',
      deviceModalSearch: 'Case ID, brand, model ya dikkat se search karein...',
      deviceModalNoResults: 'Aapki search se match karta koi device nahi mila.',
      deviceModalActive: 'CURRENTLY SELECTED',
      resultLabel: 'Nateeja',
      observation: 'Kya dekha gaya (Observation)',
      observationPlaceholder: 'Testing ke dauran kya observe hua?',
      notes: 'Khas baatein (Notes)',
      notesPlaceholder: 'Zaroori conditions ya context',
      optional: '(marzi hai)',
      saveTest: 'Test Save Karein',
      saving: 'Save ho raha hai…',
      repairOutcome: 'Repair ka aakhri nateeja',
      confirmedFault: 'Pakki kharabi (Confirmed Fault)',
      confirmedFaultPlaceholder: 'Pehchani gayi asali kharabi',
      repairAction: 'Kiya gaya kaam (Repair Action)',
      repairActionPlaceholder: 'Kaunsa purza theek ya badla gaya?',
      verificationOutcome: 'Jaanch ka aakhri nateeja',
      verificationOutcomePlaceholder: 'Repair ke baad aakhri verification ka result',
      setStatus: 'Status set karein',
      saveOutcome: 'Nateeja Save Karein',
      copilotTitle: 'Diagnostic Copilot',
      generateBtn: 'AI Salah Banayein',
      regenerateBtn: 'Dobara Salah Banayein',
      generatingBtn: 'Salah ban rahi hai…',
      noRecTitle: 'Abhi koi salah generate nahi hui',
      noRecDesc: 'Darj saboot se jaanch ke nirdesh paane ke liye upar button click karein.',
      evidenceReview: 'Saboot Ki Padtal',
      possibleExplanations: 'Mumkin Wajah Aur Hypotheses',
      supporting: 'SAMARTHAN MEIN',
      contradicting: 'KHILAF / ULTE',
      safeNextChecks: 'Surakshit Agle Kadam',
      safetyAlerts: 'Suraksha Hidayatein Aur Alerts',
      limitations: 'Dayra Aur Seemayein',
      sourcesUsed: 'Hawala Diye Gaye Sources',
      relatedMemory: 'Milti Julti Purani Yaadein (Memory)',
      completedReadOnly: 'Yeh case complete ho chuka hai. Aur tests darj karne ke liye ise dobara kholein.',
      staleEvidenceBanner: 'Is recommendation ke baad naye test evidence jode gaye.',
      missingInfoTitle: 'Bachi Hui Jankari',
      recordLabel: 'Record karein:',
      proOnly: 'Keval Pro',
      localRulesBadge: 'LOCAL NIYAM',
      testResults: {
        pass: 'Pass / Sahi chala',
        fail: 'Fail / Samasya bani rahi',
        inconclusive: 'Saaf Nahi (Inconclusive)',
        not_tested: 'Abhi test nahi kiya',
        not_applicable: 'Laagu nahi hota',
      },
      likelihoods: {
        probable: 'Ziada Mumkin',
        plausible: 'Mumkin',
        possible: 'Mumkin',
        unlikely: 'Kam Mumkin',
        less_likely: 'Kam Mumkin',
      },
    },
    voice: {
      hudLabel: 'AI DIAGNOSTIC AUDIO BRIEFING',
      sub: 'Workshop technicians ke liye Hindi aur English mein bolta hua summary',
      listenEn: 'English Mein Sunein',
      listenHi: 'Hindi Mein Sunein',
      pause: 'Rokein',
      resume: 'Chalu Karein',
      stop: 'Band Karein',
      synthesizing: 'Awaaz ban rahi hai…',
      speed: 'Raftaar:',
      transcript: 'Likha Hua Dekhein',
      hideTranscript: 'Likha Hua Chhupayein',
      copy: 'Copy Karein',
      copied: 'Copy Ho Gaya!',
    },
    memory: {
      title: 'Purane Cases (Memory)',
      telemetry: 'PURANE CASES KI KHOJ // SATEEK NATIIJE',
      searchPlaceholder: 'Past completed repairs, kharabi ya action se khojein...',
      emptyTitle: 'Koi purana record nahi mila',
      emptyDesc: 'Pakki kharabi wale completed repairs yahan misaal bankar dikhenge.',
      matchesCount: 'MISAALEIN',
      verifiedOutcomeLabel: 'SATYAPIT NATIIJA (VERIFIED)',
      confirmedLabel: 'Pakki Kharabi:',
      none: 'Koi nahi',
    },
    intake: {
      title: 'Naya Repair Case Darj Karein',
      category: 'Device category',
      brand: 'Brand ka naam',
      model: 'Model',
      issueTitle: 'Reported issue ka title',
      symptoms: 'Bariki se lakshan (Symptoms)',
      priority: 'Tarjeeh ka level (Priority)',
      customerContact: 'Grahak ka phone ya email (agar ho)',
      cancel: 'Radd Karein',
      register: 'Device Darj Karein',
      creating: 'Darj ho raha hai…',
      categories: {
        Smartphone: 'Smartphone',
        Laptop: 'Laptop',
        Desktop: 'Desktop',
        Tablet: 'Tablet',
        'Other electronics': 'Doosre Electronics',
      },
      errorSymptomsShort: 'Kripya symptoms ka thoda aur detail darj karein.',
      brandPlaceholder: 'Jaise Samsung',
      modelPlaceholder: 'Jaise Galaxy A54',
      issuePlaceholder: 'Jaise Charging beech beech mein disconnect hoti hai',
      symptomsPlaceholder: 'Intake ke waqt kya lakshan dekhe gaye?',
      contactPlaceholder: '+91 98765 43210 ya customer@example.com',
      contactHint: '(phone ya email)',
      quickPresets: 'Jaldi Presets (Templates)',
      estMinutes: 'Andazan Bench Time',
      suspectedPart: 'Kharab Hone Ka Shak Wala Purza (Optional)',
    },
    settingsModal: {
      title: 'System Preferences',
      subtitle: 'Display telemetry, diagnostic engine, language aur workflow safeguards configure karein.',
      eyebrow: 'SYSTEM CONFIGURATION',
      secDisplay: 'Display Aur Audio Feedback',
      animLabel: 'Holographic & Circuit Animations',
      animDesc: 'Circuit traces, optical laser sweep aur neon HUD pulses on karein.',
      oscLabel: 'Live Telemetry Oscilloscope',
      oscDesc: 'HUD mein moving hardware frequency waveform aur live telemetry dikhayein.',
      contrastLabel: 'High-Contrast HUD',
      contrastDesc: 'Chamakdar workshop lighting ke liye crispness aur contrast maximize karein.',
      replayCalibration: 'Optical Calibration Sequence Dobara Chalayein',
      secEngine: 'AI Aur Reasoning Engine',
      engineLabel: 'Diagnostics Inference Engine',
      engineDesc: 'Low-latency Flash Turbo (~1-2s), balanced Flash, deep Gemma ya offline local rules chunein.',
      engineFlashTurbo: '⚡ Gemini Flash Turbo (~1-2s · Recommended)',
      engineFlash: '⚡ Gemini 3.5 Flash (~3-5s · Balanced)',
      engineGemma: '🧠 Gemma 4 26B (~35-45s · Extended Reasoning)',
      engineRules: '⚙️ Local Rule Engine (Instant offline)',
      accelLabel: 'Gemma 4 Turbo Acceleration',
      accelDesc: 'Tez diagnostics ke liye Gemini Turbo fallback allow karein, ya strictly sirf Gemma 4 use karein.',
      accelOn: 'Chalu (Gemini Turbo Fallback Allowed)',
      accelOff: 'Strict (Sirf Gemma 4 · No Fallback)',
      langLabel: 'Language / Bhasha (Poora Project)',
      langDesc: 'Pure application interface aur AI recommendations ki language badalta hai.',
      optEn: 'English (Angrezi · Technical Global)',
      optHi: 'हिन्दी (Proper Hindi · देवनागरी)',
      optHiLatn: 'Hinglish (Hindi in Latin script · Romanized)',
      secWorkflow: 'Workflow Preferences',
      autoTriageLabel: 'Intake par Automatic AI Triage',
      autoTriageDesc: 'Device register hote hi automatically fault probability aur test checklist banayein.',
      safetyLabel: 'Strict Safety Quarantine',
      safetyDesc: 'Tez garmi, swollen battery ya smell wale cases ko turant safety hold par daalein.',
      confirmDeleteLabel: 'Device Mitane Se Pehle Confirm Karein',
      confirmDeleteDesc: 'Case permanently delete karne se pehle confirmation maangein.',
      confirmCompleteLabel: 'Repair Poora Hone Ki Confirmation',
      confirmCompleteDesc: 'Device complete mark karke memory mein bhejne se pehle confirmation lein.',
      autoArchiveLabel: 'Completed Cases Auto-Archive Karein',
      autoArchiveDesc: 'Completed devices ko seedhe memory mein bhej kar queue ko focused rakhein.',
      secAudio: 'Mechanical Audio Effects',
      audioLabel: 'Mechanical Audio Feedback',
      audioDesc: 'Har click aur alert par tactile retro awaaz bajayein.',
      resetBtn: 'Defaults Reset Karein',
      closeBtn: 'Band Karein',
    },
    creditsModal: {
      title: 'Revix AI Engineering Team',
      subtitle: 'Precision electronics repair intelligence ke liye dedicated team.',
      eyebrow: 'MICROSOFT HACK DAY',
      teamLeader: 'Team Leader',
      engineer: 'Team Member',
      close: 'Band Karein',
    },
    deleteModal: {
      title: 'Repair Case Delete Karein?',
      desc: 'Yeh case aur iske sabhi test results database se hamesha ke liye mita diye jayenge.',
      cancel: 'Case Rakhna Hai',
      confirm: 'Hamesha Ke Liye Mitayein',
      confirmCompleteTitle: 'Repair complete mark karein?',
      confirmCompleteMsg: 'Is case ko complete mark karne par device Repair Memory mein archive ho jayegi aur active queue se hat jayegi.',
      confirmCompleteBtn: 'Complete Mark Karein',
    },
    standby: {
      status: 'SESSION RUKA HUA // WORKSPACE STANDBY',
      title: 'Revix Hardware OS Standby',
      desc: 'Diagnostic matrix ko safe standby mode mein daal diya gaya hai. Sabhi repair logs aur test data surakshit hain. Aap Cmd+W / Ctrl+W se ye tab band kar sakte hain ya niche click karein:',
      resume: 'Session Dobara Shuru Karein',
      closeTab: 'Tab Band Karein',
    },
    awakening: {
      tag: 'OPTICAL CALIBRATION // 100% FOCUS',
    },
    telemetry: {
      fan: 'FAN: 3,420 RPM · 38°C',
      cameraReticle: 'OPTICAL RETICLE // 12MP DUAL OIS',
      holoReticle: 'HOLO-HUD // EXPLODED ASSEMBLY VIEW',
      waveform: '142.5 MHz // RF NORMAL',
      memoryHolo: 'NEURAL BLUEPRINT ARCHIVE // SCHEMATIC MEMORY',
      spokenNarrative: 'SYS.TTS // BOLTA HUA VIVARAN',
      notRecorded: 'Record nahi hua',
      refreshed: 'Data refresh ho gaya.',
    },
    components: {
      title: 'Purze Reuse Aur Resale Inventory',
      telemetry: 'COMPONENT HARVEST & RECOVERY MATRIX // BENCH TELEMETRY',
      totalComponents: 'Kul Purze (Components)',
      totalComponentsDesc: 'Bench par darj electronic parts ya salvage se nikale gaye tukde.',
      reusableStock: 'Reuse Ke Layak Stock',
      reusableStockDesc: 'Sahi chalne wale purze jo aage ki repair mein istemal ho sakte hain.',
      reservedBench: 'Bench Ke Liye Reserved',
      reservedBenchDesc: 'Kisi chalu case ke liye lock kiye gaye purze.',
      approvedResale: 'Resale Ke Liye Manzoor',
      approvedResaleDesc: 'Strict checking aur evidence ke baad resale ke liye pass kiye gaye purze.',
      needsTesting: 'Testing Baaki Hai',
      needsTestingDesc: 'Nikale gaye parts jinki multimeter ya bench testing abhi bachi hai.',
      searchPlaceholder: 'Part name, part number, model ya case ID se search karein...',
      allCategories: 'Sabhi Categories',
      allHealth: 'Sabhi Health Status',
      allResale: 'Sabhi Resale Status',
      reuseEligibleOnly: 'Sirf Sahi Verified Reusable',
      registerBtn: 'Naya Purza Darj Karein',
      emptyTitle: 'Koi purza nahi mila',
      emptyDesc: 'Apni khoj ya filters badlein, ya naya electronic purza register karein.',
      stockAvailable: 'Available',
      stockReserved: 'Reserved',
      stockUsed: 'Used',
      testedOn: 'Test ki date',
      evidenceLabel: 'Test Ka Saboot',
      noEvidence: 'Abhi koi test evidence darj nahi hai.',
      sourceDeviceLabel: 'Kahan Se Nikala (Source)',
      locationLabel: 'Storage Bin / Jagah',
      partNumberLabel: 'Part Number',
      btnReserve: 'Reserve Karein',
      btnUse: 'Used Mark Karein',
      btnRelease: 'Reserve Hatayein',
      btnReviewResale: 'Resale Review',
      btnEdit: 'Badlein (Edit)',
      btnDelete: 'Mitayein',
      registerModalTitle: 'Electronic Purza Register Karein',
      registerModalSub: 'Donor phone/laptop ya warehouse stock se nikala gaya component darj karein.',
      editModalTitle: 'Purze Ki Jankari Badlein',
      reserveModalTitle: 'Reuse Inventory Action',
      reserveModalSub: 'Chalu case ke liye stock reserve karein ya repair mein use mark karein.',
      reviewModalTitle: 'Secondary Resale Review',
      reviewModalSub: 'Resale manzoor karne se pehle physical halat aur testing saboot verify karein.',
      reviewModalWarning: 'Suraksha Niyam: Bina test saboot ya damaged purzon ko resale ke liye approve nahi kiya ja sakta.',
      reserveQtyLabel: 'Kitni Ginti (Qty)',
      reserveCaseLabel: 'Repair Case ID',
      reserveNotesLabel: 'Bench Notes / Wajah',
      resaleDecisionLabel: 'Review Ka Faisla',
      resaleReasonLabel: 'Faisle Ki Wajah / Rationale',
      resaleConditionLabel: 'Dikhawat / Physical Halat',
      resalePriceLabel: 'Resale Price ($ / ₹)',
      confirmReserveBtn: 'Reserve Pakka Karein',
      confirmUseBtn: 'Use Mark Karein',
      confirmReleaseBtn: 'Reservation Hatayein',
      submitReviewBtn: 'Review Submit Karein',
      saveChangesBtn: 'Changes Save Karein',
      cancelBtn: 'Radd Karein',
      healthStatuses: {
        working: 'Sahi Chalu (Working)',
        faulty: 'Kharab (Faulty)',
        needs_testing: 'Testing Baaki (Needs Testing)',
        unknown: 'Pata Nahi (Unknown)',
      },
      resaleStatuses: {
        under_review: 'Jaanch Ke Tehat (Under Review)',
        approved: 'Resale Manzoor (Approved)',
        not_eligible: 'Manzoor Nahi (Not Eligible)',
      },
      reuseStatuses: {
        available: 'Reuse Ke Liye Available',
        partially_reserved: 'Thoda Reserved',
        reserved: 'Poora Reserved',
        depleted: 'Khatam Ho Gaya',
      },
      categories: {
        screen: 'Display / Screen',
        battery: 'Battery / Cell',
        mother_board: 'Logic Board / Motherboard',
        camera: 'Camera Module',
        charging_port: 'Charging Sub-board',
        audio: 'Speaker / Earpiece',
        sensor: 'Sensors Aur Haptics',
        other: 'Doosre Purze',
      },
      conditions: {
        LikeNew: 'Naye Jaisa (Like New)',
        Good: 'Achhi Halat (Good)',
        Fair: 'Chalne Layak (Fair)',
        Damaged: 'Damaged / Jala Hua',
      },
    },
    statuses: {
      new: 'Naya',
      diagnosing: 'Jaanch Jaari',
      waiting_parts: 'Purzon Ka Intezar',
      in_repair: 'Repair Mein',
      testing: 'Testing Jaari',
      completed: 'Poora Hua',
      on_hold: 'Ruka Hua (On Hold)',
    },
    priorities: {
      low: 'Dheemi',
      normal: 'Aam',
      high: 'Zaroori',
      urgent: 'Turant',
    },
    testOptions: [
      { value: 'pass', label: 'Pass / Sahi chala' },
      { value: 'fail', label: 'Fail / Samasya bani rahi' },
      { value: 'inconclusive', label: 'Saaf Nahi (Inconclusive)' },
      { value: 'not_tested', label: 'Abhi test nahi kiya' },
      { value: 'not_applicable', label: 'Laagu nahi hota' },
    ],
  },
}

/**
 * Complete bidirectional dictionary for seed & dynamic content translations.
 * Translates case titles, symptoms, faults, actions, outcomes, tests, and hardware telemetry.
 */
export const CONTENT_TRANSLATIONS: Record<string, Record<Exclude<DiagnosticLanguage, 'en'>, string>> = {
  // --- Case Issue Titles ---
  'Charging disconnects intermittently': {
    hi: 'चार्जिंग बीच-बीच में कट जाती है',
    'hi-Latn': 'Charging beech beech mein disconnect hoti hai',
  },
  'No charging indicator with original cable': {
    hi: 'मूल केबल के साथ कोई चार्जिंग संकेत नहीं',
    'hi-Latn': 'Original cable se charging indicator nahi aata',
  },
  'Charging is slower than expected': {
    hi: 'चार्जिंग उम्मीद से काफी धीमी है',
    'hi-Latn': 'Charging umeed se kafi dheemi hai',
  },
  'Charging stops after a few minutes': {
    hi: 'कुछ मिनटों के बाद चार्जिंग बंद हो जाती है',
    'hi-Latn': 'Kuch minute baad charging band ho jaati hai',
  },
  'Device gets warm during charging': {
    hi: 'चार्जिंग के दौरान उपकरण असामान्य गर्म होता है',
    'hi-Latn': 'Charging ke dauran device asamanya garam hota hai',
  },

  // --- Device Categories ---
  Smartphone: {
    hi: 'स्मार्टफ़ोन',
    'hi-Latn': 'Smartphone',
  },
  Laptop: {
    hi: 'लैपटॉप',
    'hi-Latn': 'Laptop',
  },
  Desktop: {
    hi: 'डेस्कटॉप',
    'hi-Latn': 'Desktop',
  },
  Tablet: {
    hi: 'टैबलेट',
    'hi-Latn': 'Tablet',
  },
  'Other electronics': {
    hi: 'अन्य इलेक्ट्रॉनिक्स',
    'hi-Latn': 'Doosre Electronics',
  },

  // --- Seed Symptoms ---
  'Charging drops when the cable shifts slightly. The customer reports no recent drop or liquid exposure. This is a fictional demo case.': {
    hi: 'केबल को थोड़ा हिलाने पर चार्जिंग बंद हो जाती है। ग्राहक ने हाल ही में गिरने या पानी में भीगने की कोई सूचना नहीं दी है। यह डेमो केस है।',
    'hi-Latn': 'Cable thoda hilne par charging chhoot jaati hai. Grahak ke mutabiq phone gira ya geela nahi hua. Yeh demo case hai.',
  },
  "No charging indicator was reported with the customer's cable. A known-good cable was tried during this fictional demo and charging began.": {
    hi: 'ग्राहक की केबल से चार्जिंग संकेत नहीं मिला। डेमो के दौरान जांची गई अच्छी केबल लगाई गई और चार्जिंग शुरू हो गई।',
    'hi-Latn': 'Grahak ki cable se charging indicator nahi aaya. Jaanchi hui doosri cable lagane par charging shuru ho gayi.',
  },
  'Customer reports charging is slower than usual. Device-specific supported charging rate has not been verified. Fictional demo case.': {
    hi: 'ग्राहक की रिपोर्ट है कि चार्जिंग सामान्य से धीमी है। समर्थित चार्जिंग गति अभी सत्यापित नहीं हुई है। यह डेमो केस है।',
    'hi-Latn': 'Grahak ki shikayat hai ki charging aam se dheemi hai. Phone ki sahi charging speed abhi verify nahi hui hai.',
  },
  'The device reportedly begins charging and later stops. Cable, adapter, temperature, and port condition have not all been isolated. Fictional demo case.': {
    hi: 'उपकरण में चार्जिंग शुरू होती है और कुछ देर बाद रुक जाती है। केबल, एडेप्टर, तापमान और पोर्ट की स्थिति अभी पूरी तरह जांची नहीं गई है।',
    'hi-Latn': 'Device mein charging shuru hokar ruk jaati hai. Cable, adapter, temperature aur port abhi alag se check nahi hue.',
  },
  'Customer reports unusual warmth while charging. Stop-and-escalate guidance should take precedence over further routine tests. Fictional demo case.': {
    hi: 'ग्राहक ने चार्जिंग के दौरान असामान्य गर्मी की सूचना दी है। नियमित परीक्षणों से पहले सुरक्षा होल्ड और जांच जरूरी है।',
    'hi-Latn': 'Grahak ne charging ke waqt asamanya garmi ki shikayat ki hai. Aam testing se pehle suraksha jaanch zaroori hai.',
  },

  // --- Confirmed Faults ---
  'Original cable appears faulty in this demo scenario': {
    hi: 'मूल केबल खराब पाई गई',
    'hi-Latn': 'Original cable kharab paayi gayi',
  },
  'External cable issue suspected and confirmed by technician in this fictional scenario': {
    hi: 'बाहरी केबल की खराबी तकनीशियन द्वारा सत्यापित की गई',
    'hi-Latn': 'Technician ne bahari cable ki kharabi verify ki',
  },

  // --- Repair Actions ---
  'Tested using a compatible known-good cable; replacement approval still required.': {
    hi: 'संगत अच्छी केबल से परीक्षण किया गया; बदलने के लिए ग्राहक की मंजूरी प्रतीक्षित है।',
    'hi-Latn': 'Sahi chalne wali cable se test kiya; badalne ke liye grahak ki manzuri baaki hai.',
  },
  "Compared with a known-good compatible cable and replaced the customer's damaged cable after approval.": {
    hi: 'सत्यापित अच्छी केबल से मिलान किया और मंजूरी के बाद ग्राहक की खराब केबल बदली गई।',
    'hi-Latn': 'Achhi cable se compare kiya aur manzuri ke baad grahak ki kharab cable badli.',
  },

  // --- Repair Outcomes ---
  'Charging indicator appeared during the observed check; final customer handover is pending.': {
    hi: 'जांच के दौरान चार्जिंग संकेत दिखाई दिया; ग्राहक को अंतिम सुपुर्दगी लंबित है।',
    'hi-Latn': 'Check ke dauran charging indicator dikha; grahak ko hand-over hona baaki hai.',
  },
  'Charging behavior improved during the recorded observation; longer-term outcome was not measured.': {
    hi: 'अवलोकन के दौरान चार्जिंग व्यवहार में सुधार हुआ; दीर्घकालिक परिणाम दर्ज नहीं किया गया।',
    'hi-Latn': 'Observation ke dauran charging mein sudhaar dekha gaya; lambe samay ka record nahi hai.',
  },
  None: {
    hi: 'कोई नहीं',
    'hi-Latn': 'Koi nahi',
  },
  'VERIFIED OUTCOME': {
    hi: 'सत्यापित परिणाम',
    'hi-Latn': 'SATYAPIT NATIIJA',
  },
  'Confirmed:': {
    hi: 'पुष्टि की गई:',
    'hi-Latn': 'Pakki Kharabi:',
  },

  // --- Test Names & Suggestions ---
  'Known-good compatible cable and adapter': {
    hi: 'प्रमाणित संगत केबल और एडेप्टर',
    'hi-Latn': 'Pehle se jaanchi hui cable aur adapter',
  },
  'External visual inspection (device powered off)': {
    hi: 'बाहरी दृश्य निरीक्षण (उपकरण बंद रखकर)',
    'hi-Latn': 'Bahari physical jaanch (device switch off karke)',
  },
  'Known-good compatible cable': {
    hi: 'प्रमाणित संगत केबल',
    'hi-Latn': 'Pehle se jaanchi hui compatible cable',
  },
  'Known-good compatible power adapter': {
    hi: 'प्रमाणित संगत पावर एडेप्टर',
    'hi-Latn': 'Pehle se jaancha hua compatible power adapter',
  },
  'Known-good power outlet': {
    hi: 'प्रमाणित सही पावर सॉकेट',
    'hi-Latn': 'Sahi power socket ki jaanch',
  },
  'Charging behavior after restart': {
    hi: 'रीस्टार्ट के बाद चार्जिंग व्यवहार',
    'hi-Latn': 'Restart ke baad charging ka bartaav',
  },
  'Battery / temperature safety screening': {
    hi: 'बैटरी / तापमान सुरक्षा जांच',
    'hi-Latn': 'Battery aur temperature safety screening',
  },
  'Initial safety screening': {
    hi: 'प्रारंभिक सुरक्षा जांच',
    'hi-Latn': 'Shuruati suraksha screening',
  },
  'Compare compatible known-good cable': {
    hi: 'प्रमाणित संगत केबल से तुलना',
    'hi-Latn': 'Sahi chalne wali cable se tulna',
  },
  'Known-good compatible adapter': {
    hi: 'प्रमाणित संगत एडेप्टर',
    'hi-Latn': 'Pehle se jaancha hua adapter',
  },

  // --- Test Observations & Details ---
  'Symptom still appears with the alternate cable/adapter set in this fictional demo.': {
    hi: 'वैकल्पिक केबल/एडेप्टर सेट के साथ भी वही समस्या बनी रही।',
    'hi-Latn': 'Doosre cable/adapter ke sath bhi same samasya bani rahi.',
  },
  'Keep the observation separate from the fault hypothesis.': {
    hi: 'अवलोकन को खराबी की परिकल्पना से अलग रखें।',
    'hi-Latn': 'Dekhe gaye nateeje ko kharabi ke andaze se alag rakhein.',
  },
  'No obvious debris or external damage seen under normal lighting.': {
    hi: 'सामान्य रोशनी में कोई स्पष्ट कचरा या बाहरी क्षति नहीं दिखी।',
    'hi-Latn': 'Aam roshni mein koi kachra ya bahari nuksan nahi dikha.',
  },
  'A normal visual check cannot establish the internal condition of the connector.': {
    hi: 'सामान्य दृश्य जांच से कनेक्टर की आंतरिक स्थिति तय नहीं हो सकती।',
    'hi-Latn': 'Aam bahari jaanch se connector ke andar ka haal pata nahi chalta.',
  },
  'Charging indicator appeared with the known-good cable.': {
    hi: 'प्रमाणित केबल के साथ चार्जिंग संकेत दिखाई दिया।',
    'hi-Latn': 'Jaanchi hui cable lagane par charging indicator aa gaya.',
  },
  'Single-variable comparison in the demo scenario.': {
    hi: 'डेमो परिदृश्य में एकल-चर तुलना।',
    'hi-Latn': 'Ek variable badal kar ki gayi tulna.',
  },
  'Adapter operated normally with another compatible device in this fictional scenario.': {
    hi: 'एडेप्टर ने दूसरे संगत उपकरण के साथ सामान्य रूप से काम किया।',
    'hi-Latn': 'Adapter ne doosre phone ke sath bilkul theek kaam kiya.',
  },
  'Demo observation only.': {
    hi: 'केवल डेमो अवलोकन।',
    'hi-Latn': 'Sirf demo observation.',
  },
  'Charging behavior improved after swapping the cable in this fictional scenario.': {
    hi: 'केबल बदलने के बाद चार्जिंग व्यवहार में सुधार हुआ।',
    'hi-Latn': 'Cable badalne ke baad charging theek chalne lagi.',
  },
  'Outcome entered for demonstration; not a real repair record.': {
    hi: 'प्रदर्शन के लिए दर्ज परिणाम; वास्तविक मरम्मत रिकॉर्ड नहीं।',
    'hi-Latn': 'Demo ke liye darj kiya gaya result; asli repair nahi.',
  },
  'Customer reports unusual warmth; technician has placed the case on hold.': {
    hi: 'ग्राहक ने असामान्य गर्मी की सूचना दी; तकनीशियन ने केस होल्ड पर रखा है।',
    'hi-Latn': 'Grahak ne tez garmi ki shikayat ki; technician ne case hold par daala.',
  },
  'Do not continue routine charging tests until assessed by a qualified technician.': {
    hi: 'योग्य तकनीशियन द्वारा मूल्यांकन होने तक नियमित चार्जिंग परीक्षण न करें।',
    'hi-Latn': 'Expert technician ki jaanch tak routine charging tests na karein.',
  },

  // --- Hardware Telemetry & Test Points ---
  'FAN: 3,420 RPM · 38°C': {
    hi: 'पंखा: 3,420 आरपीएम · 38°C',
    'hi-Latn': 'FAN: 3,420 RPM · 38°C',
  },
  'OPTICAL RETICLE // 12MP DUAL OIS': {
    hi: 'ऑप्टिकल रेटिकल // 12MP डुअल OIS',
    'hi-Latn': 'OPTICAL RETICLE // 12MP DUAL OIS',
  },
  'HOLO-HUD // EXPLODED ASSEMBLY VIEW': {
    hi: 'होलो-HUD // असेंबली एक्सप्लोडेड व्यू',
    'hi-Latn': 'HOLO-HUD // ALAG-ALAG PURZE VIEW',
  },
  '142.5 MHz // RF NOMINAL': {
    hi: '142.5 मेगाहर्ट्ज़ // आरएफ सामान्य',
    'hi-Latn': '142.5 MHz // RF NORMAL',
  },
  'NEURAL BLUEPRINT ARCHIVE // SCHEMATIC MEMORY': {
    hi: 'न्यूरल ब्लूप्रिंट संग्रह // स्कीमेटिक मेमोरी',
    'hi-Latn': 'NEURAL BLUEPRINT ARCHIVE // SCHEMATIC MEMORY',
  },
  'OPTICAL CALIBRATION // 100% FOCUS': {
    hi: 'ऑप्टिकल अंशांकन // 100% फोकस',
    'hi-Latn': 'OPTICAL CALIBRATION // 100% FOCUS',
  },
  'SOC / CONTROLLER': {
    hi: 'एसओसी / नियंत्रक',
    'hi-Latn': 'SOC / CONTROLLER',
  },
  '3.3V BUS NOMINAL': {
    hi: '3.3V बस सामान्य',
    'hi-Latn': '3.3V BUS NORMAL',
  },
  'VRM / MOSFET RAIL': {
    hi: 'वीआरएम / मॉसफेट रेल',
    'hi-Latn': 'VRM / MOSFET RAIL',
  },
  '1.15V STABLE': {
    hi: '1.15V स्थिर',
    'hi-Latn': '1.15V STABLE',
  },
  'LPDDR5 BUS CLOCK': {
    hi: 'LPDDR5 बस क्लॉक',
    'hi-Latn': 'LPDDR5 BUS CLOCK',
  },
  '100MHz LOCKED': {
    hi: '100MHz लॉक',
    'hi-Latn': '100MHz LOCKED',
  },
  'TYPE-C POWER DELIVERY': {
    hi: 'टाइप-सी पावर डिलीवरी',
    'hi-Latn': 'TYPE-C POWER SUPPLY',
  },
  '20V / 3.25A SINK': {
    hi: '20V / 3.25A सिंक',
    'hi-Latn': '20V / 3.25A SINK',
  },
  'CHASSIS GROUND PAD': {
    hi: 'चेसिस ग्राउंड पैड',
    'hi-Latn': 'CHASSIS GROUND PAD',
  },
  '0.00V REFERENCE': {
    hi: '0.00V संदर्भ',
    'hi-Latn': '0.00V REFERENCE',
  },
  'IMAGE SENSOR / DUAL OIS': {
    hi: 'इमेज सेंसर / डुअल OIS',
    'hi-Latn': 'IMAGE SENSOR / DUAL OIS',
  },
  'OPTICAL FOCUS 100%': {
    hi: 'ऑप्टिकल फोकस 100%',
    'hi-Latn': 'OPTICAL FOCUS 100%',
  },
  'POWER MANAGEMENT IC': {
    hi: 'पावर मैनेजमेंट आईसी',
    'hi-Latn': 'POWER MANAGEMENT IC',
  },
  'VBAT: 3.82V CHARGING': {
    hi: 'VBAT: 3.82V चार्जिंग',
    'hi-Latn': 'VBAT: 3.82V CHARGING',
  },
  'APPLICATION PROCESSOR': {
    hi: 'एप्लिकेशन प्रोसेसर',
    'hi-Latn': 'APPLICATION PROCESSOR',
  },
  'LOGIC RAIL 1.10V OK': {
    hi: 'लॉजिक रेल 1.10V ठीक',
    'hi-Latn': 'LOGIC RAIL 1.10V THEEK',
  },
  'LI-ION CELL TELEMETRY': {
    hi: 'ली-आयन सेल टेलीमेट्री',
    'hi-Latn': 'LI-ION CELL TELEMETRY',
  },
  'HEALTH: 94% · 34°C': {
    hi: 'स्वास्थ्य: 94% · 34°C',
    'hi-Latn': 'SEHAT: 94% · 34°C',
  },
  'TORX / PENTALOBE ARRAY': {
    hi: 'टॉर्क़्स / पेंटालोब टूल सेट',
    'hi-Latn': 'TORX / PENTALOBE TOOL SET',
  },
  'TORX T2/T3/T4 STAGED': {
    hi: 'टॉर्क़्स T2/T3/T4 तैयार',
    'hi-Latn': 'TORX T2/T3/T4 TAIYAR',
  },
  'ESD WORK MAT DISSIPATION': {
    hi: 'ईएसडी वर्क मैट सुरक्षा',
    'hi-Latn': 'ESD WORK MAT SURAKSHA',
  },
  '10^6 OHM SAFE': {
    hi: '10^6 ओम सुरक्षित',
    'hi-Latn': '10^6 OHM SAFE',
  },
  'EXPLODED ASSEMBLY HUD': {
    hi: 'असेंबली एक्सप्लोडेड HUD',
    'hi-Latn': 'ALAG-ALAG PURZE HUD',
  },
  'PROJECTION 100% NOMINAL': {
    hi: 'प्रोजेक्शन 100% सामान्य',
    'hi-Latn': 'PROJECTION 100% NORMAL',
  },
  'FREQUENCY ANALYZER': {
    hi: 'फ़्रीक्वेंसी एनालाइज़र',
    'hi-Latn': 'FREQUENCY ANALYZER',
  },
  '142.5 MHz NOMINAL': {
    hi: '142.5 मेगाहर्ट्ज़ सामान्य',
    'hi-Latn': '142.5 MHz NORMAL',
  },
  'TRIPLE OPTICAL SENSOR': {
    hi: 'ट्रिपल ऑप्टिकल सेंसर',
    'hi-Latn': 'TRIPLE OPTICAL SENSOR',
  },
  'OIS COIL CALIBRATED': {
    hi: 'OIS कॉइल कैलिब्रेटेड',
    'hi-Latn': 'OIS COIL CALIBRATED',
  },
  'LOGIC BOARD PROCESSOR': {
    hi: 'लॉजिक बोर्ड प्रोसेसर',
    'hi-Latn': 'LOGIC BOARD PROCESSOR',
  },
  'CORE VOLTAGE 1.10V OK': {
    hi: 'कोर वोल्टेज 1.10V ठीक',
    'hi-Latn': 'CORE VOLTAGE 1.10V THEEK',
  },
  'BATTERY CHARGE RAIL': {
    hi: 'बैटरी चार्ज रेल',
    'hi-Latn': 'BATTERY CHARGE RAIL',
  },
  '3.85V NOMINAL · 32°C': {
    hi: '3.85V सामान्य · 32°C',
    'hi-Latn': '3.85V NORMAL · 32°C',
  },
  'TORX T3 PRECISION DRIVER': {
    hi: 'टॉर्क़्स T3 प्रिसिजन ड्राइवर',
    'hi-Latn': 'TORX T3 PRECISION DRIVER',
  },
  'MAGNETIC TIP ARMED': {
    hi: 'मैग्नेटिक टिप तैयार',
    'hi-Latn': 'MAGNETIC TIP TAIYAR',
  },
  'SCREEN RETRIEVAL ARCHIVE': {
    hi: 'स्क्रीन पुनर्प्राप्ति संग्रह',
    'hi-Latn': 'SCREEN ARCHIVE RECORD',
  },
  'CASE #1041 · RESTORED': {
    hi: 'केस #1041 · बहाल',
    'hi-Latn': 'CASE #1041 · RESTORE HUA',
  },
  'LOGIC BOARD DIAGNOSTIC': {
    hi: 'लॉजिक बोर्ड डायग्नोस्टिक',
    'hi-Latn': 'LOGIC BOARD JAANCH',
  },
  'CASE #1038 · VERIFIED': {
    hi: 'केस #1038 · सत्यापित',
    'hi-Latn': 'CASE #1038 · VERIFY HUA',
  },
  'ULTRABOOK BATTERY RECOVERY': {
    hi: 'अल्ट्राबुक बैटरी रिकवरी',
    'hi-Latn': 'ULTRABOOK BATTERY THEEK HUI',
  },
  'CASE #1029 · COMPLETED': {
    hi: 'केस #1029 · पूर्ण',
    'hi-Latn': 'CASE #1029 · POORA HUA',
  },
  'RF ANTENNA CALIBRATION': {
    hi: 'आरएफ एंटीना कैलिब्रेशन',
    'hi-Latn': 'RF ANTENNA CALIBRATION',
  },
  'CASE #1015 · ARCHIVED': {
    hi: 'केस #1015 · संग्रहीत',
    'hi-Latn': 'CASE #1015 · ARCHIVE HUA',
  },
  'TABLET DIGITIZER FUSION': {
    hi: 'टैबलेट डिजिटाइज़र फ़्यूज़न',
    'hi-Latn': 'TABLET TOUCH GLASS JOD',
  },
  'CASE #1008 · RESTORED': {
    hi: 'केस #1008 · बहाल',
    'hi-Latn': 'CASE #1008 · RESTORE HUA',
  },
  'EXPLODED CHASSIS BLUEPRINT': {
    hi: 'एक्सप्लोडेड चेसिस ब्लूप्रिंट',
    'hi-Latn': 'CHASSIS BLUEPRINT NAKSHA',
  },
  '60 FPS RECONSTRUCTION': {
    hi: '60 FPS पुनर्निर्माण',
    'hi-Latn': '60 FPS RECONSTRUCTION',
  },
  'SMD VOLTAGE MAP BLUEPRINT': {
    hi: 'एसएमडी वोल्टेज मैप ब्लूप्रिंट',
    'hi-Latn': 'SMD VOLTAGE NAKSHA',
  },
  'BUS TOPOLOGY NOMINAL': {
    hi: 'बस टोपोलॉजी सामान्य',
    'hi-Latn': 'BUS TOPOLOGY NORMAL',
  },
  'ENGINEERING REPAIR LOG': {
    hi: 'इंजीनियरिंग रिपेयर लॉग',
    'hi-Latn': 'ENGINEERING REPAIR DIARY',
  },
  'FIELD SCHEMATICS & BENCH DATA': {
    hi: 'फ़ील्ड स्कीमेटिक्स और बेंच डेटा',
    'hi-Latn': 'CIRCUIT NAKSHE AUR BENCH DATA',
  },
}

/**
 * Universal content translation function.
 * Translates any seed or runtime text to the requested language.
 */
export function tContent(text: string | null | undefined, lang: DiagnosticLanguage = 'en'): string {
  if (!text) return ''
  if (lang === 'en') return text
  const exact = CONTENT_TRANSLATIONS[text]?.[lang]
  if (exact) return exact
  const trimmed = text.trim()
  const trimmedMatch = CONTENT_TRANSLATIONS[trimmed]?.[lang]
  if (trimmedMatch) return trimmedMatch
  return text
}
