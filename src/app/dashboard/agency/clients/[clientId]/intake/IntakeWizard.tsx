"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PRIMARY_OBJECTIVES,
  VISUAL_STYLES,
  DOMAIN_STATUSES,
  BUDGET_RANGES,
  COMM_CHANNELS,
  type IntakeAnswers,
  type IntakeStatus,
} from "@/lib/agency/onboarding-schema";
import { saveIntakeAction } from "./actions";

// ─── Display labels for the enum values (kept next to the wizard UI) ──────────
const OBJECTIVE_LABELS: Record<(typeof PRIMARY_OBJECTIVES)[number], string> = {
  generate_leads: "Generate leads",
  sell_products: "Sell products online",
  brand_awareness: "Build brand awareness",
  provide_information: "Inform / educate",
  bookings_appointments: "Bookings & appointments",
  other: "Something else",
};
const VISUAL_LABELS: Record<(typeof VISUAL_STYLES)[number], string> = {
  professional: "Professional",
  minimalist: "Minimalist",
  creative: "Creative",
  luxury: "Luxury",
  high_tech: "High-tech",
  playful: "Playful",
};
const DOMAIN_LABELS: Record<(typeof DOMAIN_STATUSES)[number], string> = {
  client_owns: "Client already owns it",
  needs_setup: "Needs to be registered",
  transfer: "Needs transfer to us",
  unsure: "Not sure yet",
};
const BUDGET_LABELS: Record<(typeof BUDGET_RANGES)[number], string> = {
  under_5k: "Under $5k",
  "5k_15k": "$5k – $15k",
  "15k_50k": "$15k – $50k",
  over_50k: "Over $50k",
  undecided: "Undecided",
};
const COMM_LABELS: Record<(typeof COMM_CHANNELS)[number], string> = {
  email: "Email",
  slack: "Slack",
  phone: "Phone",
  video_call: "Video calls",
  project_tool: "Project tool (Asana, etc.)",
};

const FEATURE_SUGGESTIONS = [
  "Contact form",
  "Blog",
  "E-commerce / cart",
  "Online booking",
  "Member login",
  "Live chat",
  "Newsletter signup",
  "Multi-language",
  "Search",
  "Payments",
];
const JURISDICTION_SUGGESTIONS = [
  "United States",
  "California",
  "European Union",
  "United Kingdom",
  "Canada",
  "Australia",
];
const DATA_SUGGESTIONS = [
  "Names",
  "Emails",
  "Phone numbers",
  "Addresses",
  "Payment info",
  "Health data",
  "Location",
  "Cookies / analytics",
];

type StepId = "business" | "goals" | "branding" | "technical" | "logistics" | "compliance" | "review";

const STEPS: { id: StepId; label: string; icon: string; blurb: string }[] = [
  { id: "business", label: "Business", icon: "🏢", blurb: "Who the client is" },
  { id: "goals", label: "Goals", icon: "🎯", blurb: "What success looks like" },
  { id: "branding", label: "Branding", icon: "🎨", blurb: "Look, feel & assets" },
  { id: "technical", label: "Technical", icon: "⚙️", blurb: "Features & platform" },
  { id: "logistics", label: "Logistics", icon: "🗓️", blurb: "Timeline & approvals" },
  { id: "compliance", label: "Compliance", icon: "🛡️", blurb: "Data & jurisdictions" },
  { id: "review", label: "Review", icon: "✅", blurb: "Confirm & submit" },
];

function emptyAnswers(): IntakeAnswers {
  return {
    business: { legalName: "", industry: "", targetAudience: "", usp: "" },
    goals: { primaryObjective: "generate_leads", painPoints: "", successDefinition: "" },
    branding: { hasBrandAssets: false, brandNotes: "", visualStyle: "professional", inspirationLinks: [] },
    technical: { features: [], contentOwner: "", domainStatus: "unsure", integrations: "" },
    logistics: {
      targetLaunch: "",
      budgetRange: "undecided",
      dayToDayContact: "",
      finalApprover: "",
      commChannel: "email",
      reviewTurnaround: "",
    },
    compliance: { jurisdictions: [], dataCollected: [], trackers: "", hasPrivacyPolicy: false },
  };
}

interface Props {
  clientId: string;
  clientName: string;
  clientWebsite: string | null;
  initialAnswers: IntakeAnswers | null;
  initialStatus: IntakeStatus;
  initialUpdatedAt: string | null;
}

export function IntakeWizard({
  clientId,
  clientName,
  clientWebsite,
  initialAnswers,
  initialStatus,
  initialUpdatedAt,
}: Props) {
  const [answers, setAnswers] = useState<IntakeAnswers>(initialAnswers ?? emptyAnswers());
  const [stepIdx, setStepIdx] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(initialUpdatedAt);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(initialStatus === "submitted");

  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Blocks a late draft save from downgrading an intake the user is submitting.
  const submittingRef = useRef(false);
  // Tracks the in-flight draft save so submit can wait for it to land first.
  const inFlightSave = useRef<Promise<void> | null>(null);

  const step = STEPS[stepIdx];

  // Debounced autosave whenever answers change (draft only).
  useEffect(() => {
    if (!dirty.current || done) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (submittingRef.current) return;
      setSaveState("saving");
      const p = (async () => {
        try {
          const res = await saveIntakeAction(clientId, answers, false);
          if (res.ok) {
            setSaveState("saved");
            setSavedAt(res.updatedAt);
          } else {
            setSaveState("error");
          }
        } catch {
          setSaveState("error");
        }
      })();
      inFlightSave.current = p;
      void p.finally(() => {
        if (inFlightSave.current === p) inFlightSave.current = null;
      });
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, clientId, done]);

  const patch = useCallback(<K extends keyof IntakeAnswers>(section: K, value: Partial<IntakeAnswers[K]>) => {
    dirty.current = true;
    setAnswers((prev) => ({ ...prev, [section]: { ...prev[section], ...value } }));
  }, []);

  const completion = useMemo(() => computeCompletion(answers), [answers]);

  const goNext = useCallback(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goPrev = useCallback(() => setStepIdx((i) => Math.max(i - 1, 0)), []);

  const handleSubmit = useCallback(async () => {
    // Stop autosave and let any in-flight draft write land before submitting,
    // so a late draft save can't downgrade the just-submitted record.
    submittingRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (inFlightSave.current) {
      try {
        await inFlightSave.current;
      } catch {
        /* draft save failure is surfaced separately; submit still proceeds */
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await saveIntakeAction(clientId, answers, true);
      if (res.ok) {
        setSavedAt(res.updatedAt);
        setDone(true);
      } else {
        setSubmitError(res.error);
        submittingRef.current = false;
      }
    } catch {
      setSubmitError("Network error — please try again.");
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [answers, clientId]);

  if (done) {
    return (
      <IntakeDone
        clientName={clientName}
        clientWebsite={clientWebsite}
        onReopen={() => {
          submittingRef.current = false;
          setDone(false);
        }}
      />
    );
  }

  return (
    <div>
      {/* Heading */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">Onboarding intake</p>
        <h1 className="mt-1 text-2xl font-bold text-white">{clientName}</h1>
        <p className="mt-1 text-sm text-gray-400">
          Capture everything needed to kick off {clientName}&apos;s project — this pre-fills their compliance scan and
          generated documents.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Progress rail */}
        <nav className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-center justify-between lg:block">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="ml-3 shrink-0 text-xs font-medium text-gray-400 lg:mt-2 lg:block lg:ml-0">
              {completion}% complete
            </span>
          </div>
          <ol className="hidden gap-1 lg:flex lg:flex-col">
            {STEPS.map((s, i) => {
              const state = i === stepIdx ? "active" : i < stepIdx ? "done" : "todo";
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStepIdx(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                      state === "active"
                        ? "bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/40"
                        : "hover:bg-gray-800/60"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${
                        state === "done"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : state === "active"
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {state === "done" ? "✓" : s.icon}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-medium ${state === "todo" ? "text-gray-400" : "text-white"}`}
                      >
                        {s.label}
                      </span>
                      <span className="block truncate text-xs text-gray-500">{s.blurb}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step content */}
        <div>
          <div
            key={step.id}
            className="animate-[fadeIn_0.25s_ease] rounded-2xl border border-gray-800 bg-gray-900/60 p-6 sm:p-8"
          >
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800 text-xl">
                {step.icon}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-white">{step.label}</h2>
                <p className="text-sm text-gray-500">{step.blurb}</p>
              </div>
            </div>

            {step.id === "business" && <StepBusiness answers={answers} patch={patch} />}
            {step.id === "goals" && <StepGoals answers={answers} patch={patch} />}
            {step.id === "branding" && <StepBranding answers={answers} patch={patch} />}
            {step.id === "technical" && <StepTechnical answers={answers} patch={patch} />}
            {step.id === "logistics" && <StepLogistics answers={answers} patch={patch} />}
            {step.id === "compliance" && <StepCompliance answers={answers} patch={patch} />}
            {step.id === "review" && <StepReview answers={answers} onJump={setStepIdx} />}
          </div>

          {/* Footer nav */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {saveState === "saving" && <span className="text-gray-400">Saving…</span>}
              {saveState === "saved" && <span className="text-emerald-400">Draft saved ✓</span>}
              {saveState === "error" && <span className="text-red-400">Couldn&apos;t save draft</span>}
              {saveState === "idle" && savedAt && <span>Last saved {relativeTime(savedAt)}</span>}
            </div>
            <div className="flex items-center gap-3">
              {stepIdx > 0 && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800"
                >
                  Back
                </button>
              )}
              {step.id !== "review" ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit intake"}
                </button>
              )}
            </div>
          </div>
          {submitError && <p className="mt-3 text-right text-sm text-red-400">{submitError}</p>}
        </div>
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ─── Shared field primitives ──────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-200">{label}</span>
      {hint && <span className="mb-2 block text-xs text-gray-500">{hint}</span>}
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white placeholder-gray-600 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[88px] resize-y`} />;
}

function RadioCards<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
              active
                ? "border-indigo-500 bg-indigo-500/15 text-white"
                : "border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-600"
            }`}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

function ChipMultiSelect({
  values,
  suggestions,
  placeholder,
  onChange,
}: {
  values: string[];
  suggestions: string[];
  placeholder: string;
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    const t = v.trim();
    if (t && !values.includes(t) && values.length < 20) onChange([...values, t]);
    setDraft("");
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));
  const available = suggestions.filter((s) => !values.includes(s));

  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs text-indigo-200"
            >
              {v}
              <button type="button" onClick={() => remove(v)} className="text-indigo-300 hover:text-white">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={placeholder}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          className="shrink-0 rounded-lg border border-gray-700 px-3 text-sm text-gray-300 hover:bg-gray-800"
        >
          Add
        </button>
      </div>
      {available.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {available.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-indigo-500 hover:text-indigo-300"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-left transition-colors hover:border-gray-600"
    >
      <span>
        <span className="block text-sm font-medium text-gray-200">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-indigo-500" : "bg-gray-700"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

type StepProps = {
  answers: IntakeAnswers;
  patch: <K extends keyof IntakeAnswers>(section: K, value: Partial<IntakeAnswers[K]>) => void;
};

function StepBusiness({ answers, patch }: StepProps) {
  const b = answers.business;
  return (
    <div className="space-y-5">
      <Field label="Legal / business name">
        <TextInput
          value={b.legalName}
          onChange={(e) => patch("business", { legalName: e.target.value })}
          placeholder="Acme Roofing LLC"
        />
      </Field>
      <Field label="Industry">
        <TextInput
          value={b.industry}
          onChange={(e) => patch("business", { industry: e.target.value })}
          placeholder="Home services, SaaS, retail…"
        />
      </Field>
      <Field label="Target audience" hint="Who are their customers?">
        <TextArea
          value={b.targetAudience}
          onChange={(e) => patch("business", { targetAudience: e.target.value })}
          placeholder="Homeowners in the Southeast US aged 35–65…"
        />
      </Field>
      <Field label="What makes them unique?" hint="Their competitive edge / positioning">
        <TextArea
          value={b.usp}
          onChange={(e) => patch("business", { usp: e.target.value })}
          placeholder="Only local roofer with a 25-year workmanship warranty…"
        />
      </Field>
    </div>
  );
}

function StepGoals({ answers, patch }: StepProps) {
  const g = answers.goals;
  return (
    <div className="space-y-5">
      <Field label="Primary objective for the website">
        <RadioCards
          value={g.primaryObjective}
          options={PRIMARY_OBJECTIVES}
          labels={OBJECTIVE_LABELS}
          onChange={(v) => patch("goals", { primaryObjective: v })}
        />
      </Field>
      <Field label="Pain points" hint="What isn't working today?">
        <TextArea
          value={g.painPoints}
          onChange={(e) => patch("goals", { painPoints: e.target.value })}
          placeholder="Old site is slow, doesn't rank, no way to book online…"
        />
      </Field>
      <Field label="Definition of success" hint="How will they measure it in 6–12 months?">
        <TextArea
          value={g.successDefinition}
          onChange={(e) => patch("goals", { successDefinition: e.target.value })}
          placeholder="Double inbound leads, rank top-3 for 'roofing <city>'…"
        />
      </Field>
    </div>
  );
}

function StepBranding({ answers, patch }: StepProps) {
  const br = answers.branding;
  return (
    <div className="space-y-5">
      <Toggle
        checked={br.hasBrandAssets}
        label="Client has existing brand assets"
        hint="Logo, colors, fonts, style guide"
        onChange={(v) => patch("branding", { hasBrandAssets: v })}
      />
      <Field label="Preferred visual style">
        <RadioCards
          value={br.visualStyle}
          options={VISUAL_STYLES}
          labels={VISUAL_LABELS}
          onChange={(v) => patch("branding", { visualStyle: v })}
        />
      </Field>
      <Field label="Brand notes" hint="Colors, tone, do's and don'ts">
        <TextArea
          value={br.brandNotes}
          onChange={(e) => patch("branding", { brandNotes: e.target.value })}
          placeholder="Navy + gold, confident but friendly tone, avoid stock-photo look…"
        />
      </Field>
      <Field label="Inspiration links" hint="Sites they love — press Enter to add">
        <ChipMultiSelect
          values={br.inspirationLinks}
          suggestions={[]}
          placeholder="https://example.com"
          onChange={(v) => patch("branding", { inspirationLinks: v })}
        />
      </Field>
    </div>
  );
}

function StepTechnical({ answers, patch }: StepProps) {
  const t = answers.technical;
  return (
    <div className="space-y-5">
      <Field label="Required features" hint="Pick suggestions or add your own">
        <ChipMultiSelect
          values={t.features}
          suggestions={FEATURE_SUGGESTIONS}
          placeholder="Add a feature…"
          onChange={(v) => patch("technical", { features: v })}
        />
      </Field>
      <Field label="Who provides the content?">
        <TextInput
          value={t.contentOwner}
          onChange={(e) => patch("technical", { contentOwner: e.target.value })}
          placeholder="Client provides copy; we handle design"
        />
      </Field>
      <Field label="Domain status">
        <RadioCards
          value={t.domainStatus}
          options={DOMAIN_STATUSES}
          labels={DOMAIN_LABELS}
          onChange={(v) => patch("technical", { domainStatus: v })}
        />
      </Field>
      <Field label="Integrations needed" hint="CRMs, payment, email, booking, analytics…">
        <TextArea
          value={t.integrations}
          onChange={(e) => patch("technical", { integrations: e.target.value })}
          placeholder="Stripe, HubSpot, Mailchimp, Calendly…"
        />
      </Field>
    </div>
  );
}

function StepLogistics({ answers, patch }: StepProps) {
  const l = answers.logistics;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Target launch">
          <TextInput
            value={l.targetLaunch}
            onChange={(e) => patch("logistics", { targetLaunch: e.target.value })}
            placeholder="e.g. Q3, or 2026-09-01"
          />
        </Field>
        <Field label="Review turnaround" hint="How fast can they give feedback?">
          <TextInput
            value={l.reviewTurnaround}
            onChange={(e) => patch("logistics", { reviewTurnaround: e.target.value })}
            placeholder="2 business days"
          />
        </Field>
      </div>
      <Field label="Budget range">
        <RadioCards
          value={l.budgetRange}
          options={BUDGET_RANGES}
          labels={BUDGET_LABELS}
          onChange={(v) => patch("logistics", { budgetRange: v })}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Day-to-day contact">
          <TextInput
            value={l.dayToDayContact}
            onChange={(e) => patch("logistics", { dayToDayContact: e.target.value })}
            placeholder="Name & email"
          />
        </Field>
        <Field label="Final approver" hint="Who signs off on deliverables?">
          <TextInput
            value={l.finalApprover}
            onChange={(e) => patch("logistics", { finalApprover: e.target.value })}
            placeholder="Name & role"
          />
        </Field>
      </div>
      <Field label="Preferred communication channel">
        <RadioCards
          value={l.commChannel}
          options={COMM_CHANNELS}
          labels={COMM_LABELS}
          onChange={(v) => patch("logistics", { commChannel: v })}
        />
      </Field>
    </div>
  );
}

function StepCompliance({ answers, patch }: StepProps) {
  const c = answers.compliance;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-200/80">
        This section feeds the compliance scan and the documents Comply-Quick generates. It is informational only and
        not legal advice.
      </div>
      <Field label="Jurisdictions served" hint="Where are the client's users?">
        <ChipMultiSelect
          values={c.jurisdictions}
          suggestions={JURISDICTION_SUGGESTIONS}
          placeholder="Add a region…"
          onChange={(v) => patch("compliance", { jurisdictions: v })}
        />
      </Field>
      <Field label="Personal data collected">
        <ChipMultiSelect
          values={c.dataCollected}
          suggestions={DATA_SUGGESTIONS}
          placeholder="Add a data type…"
          onChange={(v) => patch("compliance", { dataCollected: v })}
        />
      </Field>
      <Field label="Known trackers / pixels" hint="GA4, Meta Pixel, ad platforms…">
        <TextArea
          value={c.trackers}
          onChange={(e) => patch("compliance", { trackers: e.target.value })}
          placeholder="Google Analytics, Meta Pixel, Google Ads…"
        />
      </Field>
      <Toggle
        checked={c.hasPrivacyPolicy}
        label="Client already has a privacy policy"
        onChange={(v) => patch("compliance", { hasPrivacyPolicy: v })}
      />
    </div>
  );
}

function StepReview({ answers, onJump }: { answers: IntakeAnswers; onJump: (i: number) => void }) {
  const rows: { step: number; label: string; value: string }[] = [
    { step: 0, label: "Business", value: answers.business.legalName || "—" },
    { step: 0, label: "Industry", value: answers.business.industry || "—" },
    { step: 1, label: "Objective", value: OBJECTIVE_LABELS[answers.goals.primaryObjective] },
    { step: 2, label: "Visual style", value: VISUAL_LABELS[answers.branding.visualStyle] },
    { step: 3, label: "Features", value: answers.technical.features.join(", ") || "—" },
    { step: 3, label: "Domain", value: DOMAIN_LABELS[answers.technical.domainStatus] },
    { step: 4, label: "Budget", value: BUDGET_LABELS[answers.logistics.budgetRange] },
    { step: 4, label: "Target launch", value: answers.logistics.targetLaunch || "—" },
    { step: 5, label: "Jurisdictions", value: answers.compliance.jurisdictions.join(", ") || "—" },
    { step: 5, label: "Data collected", value: answers.compliance.dataCollected.join(", ") || "—" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Review the intake before submitting. Click any row to jump back and edit.</p>
      <dl className="divide-y divide-gray-800 rounded-xl border border-gray-800">
        {rows.map((r, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onJump(r.step)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-800/50"
          >
            <dt className="text-sm text-gray-500">{r.label}</dt>
            <dd className="truncate text-sm text-gray-200">{r.value}</dd>
          </button>
        ))}
      </dl>
    </div>
  );
}

function IntakeDone({
  clientName,
  clientWebsite,
  onReopen,
}: {
  clientName: string;
  clientWebsite: string | null;
  onReopen: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-gray-800 bg-gray-900/60 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl">
        🎉
      </div>
      <h1 className="text-xl font-bold text-white">Intake submitted for {clientName}</h1>
      <p className="mt-2 text-sm text-gray-400">
        The onboarding brief is saved. You can run a compliance scan to pre-fill their findings and generate documents.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {clientWebsite && (
          <Link
            href={`/dashboard/home?url=${encodeURIComponent(clientWebsite)}`}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            Run compliance scan →
          </Link>
        )}
        <Link
          href="/dashboard/agency"
          className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800"
        >
          Back to portal
        </Link>
      </div>
      <button
        type="button"
        onClick={onReopen}
        className="mt-5 text-xs text-gray-500 transition-colors hover:text-gray-300"
      >
        Edit intake again
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCompletion(a: IntakeAnswers): number {
  const checks = [
    a.business.legalName,
    a.business.industry,
    a.business.targetAudience,
    a.goals.painPoints,
    a.goals.successDefinition,
    a.branding.brandNotes,
    a.technical.features.length > 0 ? "x" : "",
    a.technical.contentOwner,
    a.logistics.targetLaunch,
    a.logistics.dayToDayContact,
    a.compliance.jurisdictions.length > 0 ? "x" : "",
    a.compliance.dataCollected.length > 0 ? "x" : "",
  ];
  const filled = checks.filter((v) => typeof v === "string" && v.trim().length > 0).length;
  return Math.round((filled / checks.length) * 100);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}
