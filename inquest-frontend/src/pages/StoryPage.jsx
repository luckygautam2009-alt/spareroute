import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import {
  Scale,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  ChevronDown,
  MessageSquare,
  Cpu,
  Share2,
  Activity,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  CreditCard,
  Zap,
  ShoppingBag,
  Ticket,
  BookOpen,
  Search,
  ScanLine,
  Lock,
  Download,
  Check,
  RotateCcw,
  FileText,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  CornerDownRight,
  ShieldAlert,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

// ── Sample Complaints for Step 1 ──────────────────────────────────────────────
const SAMPLE_COMPLAINTS = {
  hinglish: {
    label: 'Hinglish (Colloquial)',
    tag: 'Real User Sample',
    text: 'bhai payment 2 baar kat gyi order #456 ke liye, please refund karo urgently',
    customer: 'Ravi Sharma',
    customerId: 'CUST001',
    orderId: 'ORDER456',
  },
  english: {
    label: 'English (Formal)',
    tag: 'Direct Ticket',
    text: 'I was charged twice on my card for order #456. One transaction failed on screen but amount was debited.',
    customer: 'Priya Mehta',
    customerId: 'CUST002',
    orderId: 'ORDER456',
  },
  hindi: {
    label: 'Hindi (Devanagari)',
    tag: 'Regional Language',
    text: 'ऑर्डर #456 के लिए मेरे खाते से दो बार पैसे कट गए हैं, कृपया तुरंत रिफंड करें',
    customer: 'Amit Patel',
    customerId: 'CUST003',
    orderId: 'ORDER456',
  },
};

// ── Decision Paths for Step 5 ────────────────────────────────────────────────
const DECISION_PATHS = [
  {
    id: 'AUTO_RESOLVE',
    title: 'AUTO_RESOLVE',
    badge: 'Autonomous Action',
    color: 'verified',
    border: 'border-verified',
    bg: 'bg-verified-dim',
    text: 'text-verified',
    icon: CheckCircle2,
    rule: 'High Confidence (≥85%) + Matching Institutional Policy + Safe Category',
    example: 'Confirmed duplicate payment (gateway captured, local timeout). Refund initiated in 1.4s with 0 human intervention.',
    resolution: 'Refund TXN_RF9921 initiated automatically. Customer notified via WhatsApp/SMS.',
  },
  {
    id: 'CUSTOMER_CONFIRM',
    title: 'CUSTOMER_CONFIRM',
    badge: 'Customer Choice',
    color: 'amber',
    border: 'border-amber',
    bg: 'bg-amber-dim',
    text: 'text-amber',
    icon: AlertTriangle,
    rule: 'Moderate Confidence (70–84%) OR Category requiring user election',
    example: 'Return initiated for clothing size mismatch. Policy allows replacement OR store wallet credit with 10% bonus.',
    resolution: 'One-click interactive poll sent to customer before executing warehouse pickup.',
  },
  {
    id: 'HUMAN_ESCALATION',
    title: 'HUMAN_ESCALATION',
    badge: 'Secure Agent Review',
    color: 'alert',
    border: 'border-alert',
    bg: 'bg-alert-dim',
    text: 'text-alert',
    icon: UserCheck,
    rule: 'Low Confidence (<70%), Security/Fraud claims, or Uncorroborated Damage claims',
    example: 'Customer claims package arrived opened with gold jewelry missing, but courier weight scan matches dispatch.',
    resolution: 'Escalated to Fraud Investigation Queue. Requires biometric / ID verified agent authorization.',
  },
];

export default function StoryPage({ onNavigateHome }) {
  const { theme, toggleTheme } = useTheme();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // Step 1: Typing state
  const [activeLang, setActiveLang] = useState('hinglish');
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  // Step 5: Active decision tab
  const [activeDecision, setActiveDecision] = useState('AUTO_RESOLVE');

  // Step 6: Admin verification simulation
  const [scanState, setScanState] = useState('idle'); // idle | scanning | verified

  // Typing animation effect for Step 1
  useEffect(() => {
    setTypedText('');
    setIsTyping(true);
    const fullText = SAMPLE_COMPLAINTS[activeLang].text;
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(fullText.slice(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 28);
    return () => clearInterval(interval);
  }, [activeLang]);

  // Handle simulate scan in Step 6
  function handleSimulateScan() {
    setScanState('scanning');
    setTimeout(() => {
      setScanState('verified');
    }, 2200);
  }

  function handleResetScan() {
    setScanState('idle');
  }

  return (
    <div className="min-h-screen bg-ink text-paper selection:bg-amber/30 transition-colors duration-200 overflow-x-hidden font-sans">
      {/* ── Scroll Progress Bar ── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-amber z-50 origin-left"
        style={{ scaleX }}
      />

      {/* ── Top Navigation Bar ── */}
      <header
        className="sticky top-0 z-40 border-b border-border backdrop-blur-md transition-colors"
        style={{ background: 'var(--header-glass)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 sm:h-20 flex items-center justify-between">
          {/* Logo */}
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-3.5 group cursor-pointer text-left"
            title="Return to INQUEST Live App"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-dim border border-amber/40 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform overflow-hidden p-1.5">
              <img src="/favicon.png" alt="INQUEST Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-paper">
                INQUEST
              </span>
              <span className="text-border-strong text-base select-none">/</span>
              <span className="text-xs sm:text-sm text-paper-dim font-semibold flex items-center gap-1.5">
                Pipeline Explainer
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-verified animate-pulse" />
              </span>
            </div>
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ink-light hover:bg-ink-lighter border border-border-strong text-paper text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.98]"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-light" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Back to Live App Button */}
            <button
              type="button"
              onClick={onNavigateHome}
              className="flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl bg-amber hover:bg-amber-light text-ink font-bold text-xs sm:text-sm transition-all duration-150 cursor-pointer shadow-xs hover:shadow-sm active:scale-[0.98]"
            >
              <span>Launch App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative border-b border-border bg-gradient-to-b from-ink-light/80 to-ink py-20 sm:py-28 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber/10 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-1/2 right-10 w-72 h-72 bg-verified/10 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-dim border border-amber/30 text-amber text-xs font-bold uppercase tracking-wider mb-6 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber animate-spin-slow" />
            <span>Autonomous AI Complaint Investigation Engine</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-4xl sm:text-6xl text-paper font-bold tracking-tight leading-[1.12] mb-6 max-w-4xl mx-auto"
          >
            Every customer complaint is investigated with connected evidence{' '}
            <span className="text-amber">before a verdict.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-xl text-paper-dim max-w-3xl mx-auto leading-relaxed mb-10"
          >
            Customer service bots usually guess based on sentiment or stall with generic macros.
            <strong className="text-paper"> INQUEST</strong> parses messy Hinglish and colloquial complaints,
            reconstructs a verifiable multi-source evidence chain across databases and payment gateways,
            and issues definitive, audit-grade resolutions.
          </motion.p>

          {/* Quick Metrics Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-12"
          >
            <div className="p-3.5 rounded-xl bg-ink-light border border-border shadow-xs flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-verified-dim flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-verified" />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">Core Principle</p>
                <p className="text-sm font-bold text-paper">100% Evidence-Driven</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-ink-light border border-border shadow-xs flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-amber-dim flex items-center justify-center shrink-0">
                <Cpu className="w-5 h-5 text-amber" />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">Natural Language</p>
                <p className="text-sm font-bold text-paper">Hinglish & Hindi Native</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-ink-light border border-border shadow-xs flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-info-dim flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">Human Handoff</p>
                <p className="text-sm font-bold text-paper">Institutional ID Guarded</p>
              </div>
            </div>
          </motion.div>

          {/* Scroll down indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col items-center gap-2 text-xs text-muted font-semibold"
          >
            <span>Scroll to see how the pipeline operates</span>
            <ChevronDown className="w-4 h-4 text-amber animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ── STEP 1: Complaint Intake ── */}
      <section className="py-20 sm:py-28 border-b border-border relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left description */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-5 space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-dim border border-amber/30 text-amber text-xs font-bold uppercase tracking-wider">
                Step 01
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-paper">
                Multilingual Complaint Intake
              </h2>
              <p className="text-paper-dim text-sm sm:text-base leading-relaxed">
                Real users never speak in structured forms. They code-switch between English, Hindi,
                and colloquial slang like <span className="font-mono text-amber">"bhai payment 2 baar kat gyi"</span>.
              </p>
              <p className="text-muted text-xs sm:text-sm leading-relaxed">
                INQUEST captures the authentic voice of the customer without forcing them into rigid dropdown categories.
              </p>

              {/* Language selection pills */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2.5">
                  Try Sample Intake Language:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SAMPLE_COMPLAINTS).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveLang(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        activeLang === key
                          ? 'bg-amber text-ink shadow-xs font-bold'
                          : 'bg-ink-light hover:bg-ink-lighter text-paper-dim border border-border'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Right Mock UI */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7"
            >
              <div className="rounded-2xl border border-border bg-ink-light shadow-xl overflow-hidden">
                {/* Console header */}
                <div className="px-5 py-3.5 border-b border-border bg-ink-lighter flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-alert/80" />
                    <span className="w-3 h-3 rounded-full bg-amber/80" />
                    <span className="w-3 h-3 rounded-full bg-verified/80" />
                    <span className="text-muted font-mono ml-2">intake://session-8842</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-verified-dim text-verified font-bold text-[11px] border border-verified/30">
                    Live Channel
                  </span>
                </div>

                {/* Customer card info */}
                <div className="p-5 border-b border-border bg-ink-inset flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber/20 border border-amber/40 flex items-center justify-center font-bold text-amber">
                      {SAMPLE_COMPLAINTS[activeLang].customer.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-paper">
                        {SAMPLE_COMPLAINTS[activeLang].customer}
                      </h4>
                      <p className="text-xs text-muted font-mono">
                        ID: {SAMPLE_COMPLAINTS[activeLang].customerId} • Active Order: #
                        {SAMPLE_COMPLAINTS[activeLang].orderId.replace('ORDER', '')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted font-medium bg-ink-light px-2.5 py-1 rounded-md border border-border">
                    {SAMPLE_COMPLAINTS[activeLang].tag}
                  </span>
                </div>

                {/* Typing text area mock */}
                <div className="p-5 sm:p-6 space-y-4">
                  <label className="block text-xs font-semibold text-paper-dim">
                    Customer Complaint Input:
                  </label>
                  <div className="min-h-24 p-4 rounded-xl bg-ink-inset border border-border-strong font-mono text-sm sm:text-base text-paper leading-relaxed relative">
                    <span>{typedText}</span>
                    <span
                      className={`inline-block w-2 h-4 bg-amber ml-1 align-middle ${
                        isTyping ? 'animate-pulse' : 'opacity-0'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <MessageSquare className="w-3.5 h-3.5 text-amber" />
                      <span>Natural Language Stream Active</span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber text-ink text-xs font-bold shadow-xs">
                      <span>Injesting Complaint</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STEP 2: Semantic Understanding (Gemini) ── */}
      <section className="py-20 sm:py-28 border-b border-border bg-gradient-to-b from-ink-light/40 to-ink relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-dim border border-amber/30 text-amber text-xs font-bold uppercase tracking-wider mb-4"
            >
              Step 02
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-paper mb-4"
            >
              Semantic Extraction via Gemini
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-paper-dim text-sm sm:text-base leading-relaxed"
            >
              Google Gemini parses the unstructured text, extracting core entities, technical intent,
              sentiment, and target order references — even when written in informal Hinglish.
            </motion.p>
          </div>

          {/* Staggered Extracted Parameters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Primary Intent Card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="p-5 rounded-2xl bg-ink-light border border-border-strong hover:border-amber/40 transition-all shadow-md relative group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Primary Intent
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-verified-dim text-verified border border-verified/30">
                  99.4% Match
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-dim border border-amber/30 flex items-center justify-center text-amber">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-paper">payment/billing</h3>
                  <p className="text-xs text-muted">Financial transaction category</p>
                </div>
              </div>
              <p className="text-xs text-paper-dim mt-3 pt-3 border-t border-border">
                Mapped from: <span className="font-mono text-amber">"payment 2 baar kat gyi"</span>
              </p>
            </motion.div>

            {/* Sub-Intent Card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="p-5 rounded-2xl bg-ink-light border border-border-strong hover:border-amber/40 transition-all shadow-md relative group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Sub-Intent
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-verified-dim text-verified border border-verified/30">
                  Exact Match
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-dim border border-amber/30 flex items-center justify-center text-amber">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-paper font-mono">duplicate_payment</h3>
                  <p className="text-xs text-muted">Double charge pattern</p>
                </div>
              </div>
              <p className="text-xs text-paper-dim mt-3 pt-3 border-t border-border">
                Extracted: Multi-capture attempt on single cart checkout
              </p>
            </motion.div>

            {/* Referenced Order ID */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: 0.19 }}
              className="p-5 rounded-2xl bg-ink-light border border-border-strong hover:border-amber/40 transition-all shadow-md relative group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Entity Extraction
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-info-dim text-info border border-info/30">
                  DB Linked
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-info-dim border border-info/30 flex items-center justify-center text-info">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-paper font-mono">ORDER456</h3>
                  <p className="text-xs text-muted">Normalizes "order #456" prefix</p>
                </div>
              </div>
              <p className="text-xs text-paper-dim mt-3 pt-3 border-t border-border">
                Bound directly to Customer <span className="font-mono text-paper font-semibold">CUST001</span> profile
              </p>
            </motion.div>

            {/* Urgency Score */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: 0.26 }}
              className="p-5 rounded-2xl bg-ink-light border border-border-strong hover:border-amber/40 transition-all shadow-md relative group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Urgency Metric
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-dim text-amber border border-amber/30">
                  Priority 3/3
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-dim border border-amber/30 flex items-center justify-center text-amber">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-paper">HIGH</h3>
                  <p className="text-xs text-muted">Customer indicated "urgently"</p>
                </div>
              </div>
              <p className="text-xs text-paper-dim mt-3 pt-3 border-t border-border">
                SLA: Target autonomous turnaround &lt; 2.5 seconds
              </p>
            </motion.div>

            {/* Sentiment (Explicitly not used for verdict) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: 0.33 }}
              className="p-5 rounded-2xl bg-ink-light border border-border-strong hover:border-amber/40 transition-all shadow-md relative group md:col-span-2 lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Customer Sentiment Analysis
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-alert-dim text-alert border border-alert/30">
                  frustrated / negative
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-alert-dim border border-alert/30 flex items-center justify-center text-alert shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-paper">Sentiment Detected: Distressed Customer</h3>
                    <p className="text-xs text-muted">
                      Tone is recorded for empathetic communication styling only.
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-ink-inset border border-amber/30 text-amber text-xs font-bold shrink-0">
                  ⚠️ NOT USED FOR FINAL VERDICT
                </div>
              </div>
              <p className="text-xs text-muted mt-3 pt-3 border-t border-border leading-relaxed">
                <strong className="text-paper-dim">Security & Fair-Play Guarantee:</strong> INQUEST records customer sentiment to personalize support tone, but strictly isolates it from the verdict logic. Angry tone does not grant unauthorized refunds, and calm tone does not delay legitimate claims.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STEP 3: Evidence Investigation ── */}
      <section className="py-20 sm:py-28 border-b border-border relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Narrative */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-5 space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-dim border border-amber/30 text-amber text-xs font-bold uppercase tracking-wider">
                Step 03
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-paper">
                Cross-System Evidence Chain
              </h2>
              <p className="text-paper-dim text-sm sm:text-base leading-relaxed">
                Rather than trusting the customer's text or blindly generating an AI response,
                INQUEST cross-checks 5 distinct institutional data stores simultaneously:
              </p>
              <ul className="space-y-2.5 text-xs sm:text-sm text-muted">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-verified" />
                  <span><strong>Payment Gateway Logs:</strong> Razorpay / Stripe capture confirmation</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber" />
                  <span><strong>Local Database Ledger:</strong> Internal order status & webhook timestamps</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-info" />
                  <span><strong>Support History:</strong> Past ticket logs & repeat grievance patterns</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-verified" />
                  <span><strong>Refund Vault:</strong> Proof that zero refunds have been disbursed yet</span>
                </li>
              </ul>
            </motion.div>

            {/* Right Evidence Nodes Mockup (matching EvidenceGraph.jsx) */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7"
            >
              <div className="rounded-2xl border border-border bg-ink-light p-6 shadow-xl space-y-3.5 relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-amber" />
                    <span className="text-xs font-bold text-paper uppercase tracking-wider">
                      Connected Evidence Graph
                    </span>
                  </div>
                  <span className="text-xs text-muted font-mono">5 Sources Verified</span>
                </div>

                {/* Node 1: Complaint */}
                <div className="p-3.5 rounded-xl bg-ink-inset border border-border border-l-4 border-l-info flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-info-dim text-info flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-paper">User Complaint Intake</p>
                      <p className="text-[11px] text-muted">bhai payment 2 baar kat gyi order #456</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-info-dim text-info">
                    found
                  </span>
                </div>

                {/* Connector Arrow */}
                <div className="flex justify-center -my-1 text-muted">
                  <CornerDownRight className="w-4 h-4" />
                </div>

                {/* Node 2: Payment Mismatch (FLAGGED) */}
                <div className="p-3.5 rounded-xl bg-ink-inset border border-amber/50 border-l-4 border-l-amber shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-dim text-amber flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber flex items-center gap-1.5">
                        Payment Discrepancy Found
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber text-ink font-bold">
                          MISMATCH
                        </span>
                      </p>
                      <p className="text-[11px] text-paper-dim">
                        Gateway: <span className="text-verified font-bold">CAPTURED (tx_9921)</span> vs Local DB:{' '}
                        <span className="text-alert font-bold">FAILED (timeout)</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-dim text-amber">
                    flagged
                  </span>
                </div>

                {/* Connector Arrow */}
                <div className="flex justify-center -my-1 text-muted">
                  <CornerDownRight className="w-4 h-4" />
                </div>

                {/* Node 3: Order Record */}
                <div className="p-3.5 rounded-xl bg-ink-inset border border-border border-l-4 border-l-verified flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-verified-dim text-verified flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-paper">Order ORDER456</p>
                      <p className="text-[11px] text-muted">Value: ₹2,499 • Delivery Confirmed</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-verified-dim text-verified">
                    verified
                  </span>
                </div>

                {/* Connector Arrow */}
                <div className="flex justify-center -my-1 text-muted">
                  <CornerDownRight className="w-4 h-4" />
                </div>

                {/* Node 4: Policy Match */}
                <div className="p-3.5 rounded-xl bg-ink-inset border border-border border-l-4 border-l-amber flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-dim text-amber flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-paper">Corporate Policy POL-PAY-01</p>
                      <p className="text-[11px] text-muted">Auto-refund on verified duplicate gateway capture</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-dim text-amber">
                    matched
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STEP 4: Root Cause + Confidence Score ── */}
      <section className="py-20 sm:py-28 border-b border-border bg-gradient-to-b from-ink-light/40 to-ink relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-dim border border-amber/30 text-amber text-xs font-bold uppercase tracking-wider mb-4"
            >
              Step 04
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-paper mb-4"
            >
              Root Cause & Confidence Synthesis
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-paper-dim text-sm sm:text-base leading-relaxed"
            >
              The system synthesizes a single, mathematically verified root cause from the corroborating
              evidence. Zero hallucinations. Only verified transactional records.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Confidence Meter Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-4 p-8 rounded-2xl bg-ink-light border border-border shadow-lg flex flex-col items-center justify-center text-center relative overflow-hidden"
            >
              <div className="w-36 h-36 rounded-full border-8 border-ink-lighter border-t-verified border-r-verified flex flex-col items-center justify-center relative mb-4 shadow-inner">
                <span className="text-4xl font-display font-extrabold text-verified">94%</span>
                <span className="text-[11px] text-muted font-bold tracking-wider">CONFIDENCE</span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-verified-dim text-verified border border-verified/30 mb-2">
                Threshold Passed (≥85%)
              </span>
              <p className="text-xs text-muted max-w-xs">
                Derived from 3 congruent data sources, 0 contradictions, and matching gateway hash.
              </p>
            </motion.div>

            {/* Synthesized Explanation Box */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-8 p-6 sm:p-8 rounded-2xl bg-ink-light border border-border shadow-lg flex flex-col justify-between space-y-6"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber uppercase tracking-wider mb-2">
                  <Search className="w-4 h-4" />
                  <span>Synthesized Root Cause Finding</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-display font-bold text-paper leading-snug mb-3">
                  "Payment PAY123 succeeded at the gateway but was recorded as failed locally, causing a duplicate charge — 94% confidence."
                </h3>
                <p className="text-paper-dim text-xs sm:text-sm leading-relaxed">
                  Razorpay webhook callback experienced an unhandled network timeout at 14:22:15 IST, leaving the order in 'PENDING_PAYMENT'. The customer re-submitted, generating a second valid charge (PAY124).
                </p>
              </div>

              {/* Data Verification Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
                <div className="p-3 rounded-xl bg-ink-inset border border-border text-center">
                  <p className="text-lg font-bold text-verified font-mono">3</p>
                  <p className="text-[11px] text-muted font-medium">Corroborating Records</p>
                </div>
                <div className="p-3 rounded-xl bg-ink-inset border border-border text-center">
                  <p className="text-lg font-bold text-verified font-mono">0</p>
                  <p className="text-[11px] text-muted font-medium">Contradicting Facts</p>
                </div>
                <div className="p-3 rounded-xl bg-ink-inset border border-border text-center">
                  <p className="text-lg font-bold text-amber font-mono">1.4s</p>
                  <p className="text-[11px] text-muted font-medium">Turnaround Latency</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STEP 5: Decision Fork (Evidence-Based NOT Sentiment-Based) ── */}
      <section className="py-20 sm:py-28 border-b border-border relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-dim border border-amber/30 text-amber text-xs font-bold uppercase tracking-wider mb-4"
            >
              Step 05
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-paper mb-4"
            >
              Deterministic 3-Way Decision Fork
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-paper-dim text-sm sm:text-base leading-relaxed"
            >
              INQUEST maps verified evidence into exactly three deterministic outcomes.
            </motion.p>

            {/* Core Differentiator Banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mt-6 p-4 rounded-xl bg-amber-dim border-2 border-amber/40 text-left sm:text-center max-w-2xl mx-auto shadow-sm"
            >
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber uppercase tracking-wider mb-1">
                <Scale className="w-4 h-4 text-amber" />
                <span>Key Product Differentiator: Not Sentiment-Based</span>
              </div>
              <p className="text-xs text-paper-dim leading-relaxed">
                Whether a customer writes in calm polite English or all-caps angry slang, INQUEST decides
                <strong> solely on database & gateway proof</strong>. An angry customer with no evidence will never
                receive an automated refund, while a calm customer with valid proof is resolved immediately.
              </p>
            </motion.div>
          </div>

          {/* Decision Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DECISION_PATHS.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = activeDecision === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  onClick={() => setActiveDecision(item.id)}
                  className={`p-6 rounded-2xl bg-ink-light border-2 transition-all cursor-pointer shadow-md flex flex-col justify-between ${
                    isSelected
                      ? `${item.border} shadow-lg scale-102`
                      : 'border-border hover:border-border-strong opacity-80 hover:opacity-100'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center ${item.text}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${item.bg} ${item.text}`}>
                        {item.badge}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-paper mb-2">{item.title}</h3>
                    <p className="text-xs text-muted font-medium mb-3">{item.rule}</p>
                    <p className="text-xs text-paper-dim leading-relaxed p-3 rounded-lg bg-ink-inset border border-border">
                      {item.example}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-[11px] text-muted font-medium">Automatic System Action:</p>
                    <p className={`text-xs font-bold mt-1 ${item.text}`}>{item.resolution}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── STEP 6: Human Handoff + Admin Security Verification ── */}
      <section className="py-20 sm:py-28 border-b border-border bg-gradient-to-b from-ink-light/40 to-ink relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Narrative */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-5 space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-dim border border-amber/30 text-amber text-xs font-bold uppercase tracking-wider">
                Step 06
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-paper">
                Secure Human Handoff & ID Verification
              </h2>
              <p className="text-paper-dim text-sm sm:text-base leading-relaxed">
                When a complex case is escalated (e.g. suspected fraud or missing high-value goods),
                INQUEST doesn't dump raw unverified tickets onto agents.
              </p>
              <p className="text-muted text-xs sm:text-sm leading-relaxed">
                To access privileged case data and disburse high-value refunds, support admins must
                verify their identity using a live institutional ID scan authenticated via Gemini Vision.
              </p>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSimulateScan}
                  disabled={scanState === 'scanning'}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber hover:bg-amber-light text-ink font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>{scanState === 'verified' ? 'Re-scan ID Simulation' : 'Simulate Live ID Card Scan'}</span>
                </button>
                {scanState === 'verified' && (
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="text-xs text-muted hover:text-paper cursor-pointer text-left"
                  >
                    Reset simulation
                  </button>
                )}
              </div>
            </motion.div>

            {/* Right Interactive ID Scanner Mockup */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7"
            >
              <div className="rounded-2xl border border-border bg-ink-light p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber" />
                    <span className="text-xs font-bold text-paper uppercase tracking-wider">
                      Privileged Admin Authentication
                    </span>
                  </div>
                  <span className="text-xs text-muted font-mono">Fail-Closed Verification</span>
                </div>

                {/* Viewfinder Mockup */}
                <div className="relative rounded-xl overflow-hidden border border-border bg-ink-inset aspect-video flex items-center justify-center shadow-inner">
                  {/* Idle State */}
                  {scanState === 'idle' && (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-ink-lighter border border-border mx-auto flex items-center justify-center text-muted">
                        <Lock className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-paper">Privileged Audit View Locked</p>
                      <p className="text-xs text-muted max-w-xs mx-auto">
                        Click 'Simulate Live ID Card Scan' on the left to test optical verification.
                      </p>
                    </div>
                  )}

                  {/* Scanning State */}
                  {scanState === 'scanning' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink-inset">
                      {/* Corner brackets */}
                      <div className="relative w-[75%] h-[70%] border border-amber/30 rounded-lg flex items-center justify-center">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-amber" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-amber" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-amber" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-amber" />

                        {/* Animated scanline */}
                        <div className="absolute left-0 right-0 h-1 bg-amber shadow-[0_0_12px_2px_rgba(217,119,6,0.8)] scanline" />

                        <div className="text-center space-y-2">
                          <p className="text-xs font-bold text-amber tracking-wider uppercase animate-pulse">
                            Scanning Institutional ID...
                          </p>
                          <p className="text-[11px] text-muted">Evaluating NIET reference template</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Verified State */}
                  {scanState === 'verified' && (
                    <div className="absolute inset-0 bg-ink/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
                      <div className="w-14 h-14 rounded-full bg-verified-dim border border-verified flex items-center justify-center text-verified pop-in shadow-lg">
                        <Check className="w-8 h-8 stroke-[3]" />
                      </div>
                      <h4 className="text-base font-bold text-verified">
                        NIET Institutional ID Verified
                      </h4>
                      <p className="text-xs text-paper-dim font-mono">
                        Agent: Yash Gautam (0251CSML079) • Access Granted
                      </p>

                      <div className="pt-2 flex items-center gap-3">
                        <span className="px-3 py-1 rounded-md bg-ink-lighter text-xs text-paper font-semibold border border-border flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber" /> Full Dossier Unlocked
                        </span>
                        <span className="px-3 py-1 rounded-md bg-ink-lighter text-xs text-paper font-semibold border border-border flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5 text-verified" /> Audit Report Ready
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                  <span>Protected by Gemini Vision AI OCR + Biometric Reference Match</span>
                  <span className="font-mono text-amber">SHA-256 Audit Trail</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Closing Summary & CTA Section ── */}
      <section className="py-24 sm:py-32 relative text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-verified-dim border border-verified/30 text-verified text-xs font-bold uppercase tracking-wider"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready for Autonomous Operations</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-paper leading-tight"
          >
            Zero guesswork. Zero sentiment bias. <br className="hidden sm:inline" />
            <span className="text-amber">Real, verifiable evidence.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-paper-dim text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed"
          >
            Experience the live autonomous intake pipeline yourself. Test duplicate payments,
            delivery queries, Hindi Devanagari phrases, or security disputes with dynamic data stores.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-amber hover:bg-amber-light text-ink font-bold text-base transition-all cursor-pointer shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Try It Yourself — Open Live Demo</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-ink-light hover:bg-ink-lighter border border-border-strong text-paper font-semibold text-sm transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              Back to Top
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display font-bold text-paper">
            <img src="/favicon.png" alt="INQUEST" className="w-4 h-4 object-contain" />
            <span>INQUEST RootCause AI</span>
          </div>
          <p>© 2026 INQUEST. All complaints investigated with verifiable database truth.</p>
        </div>
      </footer>
    </div>
  );
}
