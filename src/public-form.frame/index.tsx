import React, { useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, FileText, Lock, Upload, X } from 'lucide-react'
import { ChiiMark } from '../shared/components/Brand'
import { SIE_APPLICATION, checkAnswers, isAsked, wordCount, type Answers, type FormTemplate, type Question } from '../shared/forms/templates'
import { COUNTRIES } from '../shared/ventures/lists'

export const args = {
  kind: 'feedback',
  state: 'open',
  preview: false,
}

type Props = Partial<typeof args> & { onExitPreview?: () => void; template?: FormTemplate }

const titles = {
  registration: { title: 'Register for SIE Cohort 4', sub: 'Student Immersion Experience · HEMP · 3 Nov – 15 Dec' },
  attendance: { title: 'Check in', sub: 'SIE Cohort 4 · Monday 10 November' },
  feedback: { title: 'How was SIE Cohort 4?', sub: 'Takes about 2 minutes. Your answers shape the next cohort.' },
  application: { title: SIE_APPLICATION.title, sub: SIE_APPLICATION.intro },
}

export default function PublicForm(props: Props) {
  const { kind, state: initialState, preview, onExitPreview, template = SIE_APPLICATION } = { ...args, ...props }
  const [state, setState] = useState(initialState)
  const [sat, setSat] = useState<number | null>(null)
  const [nps, setNps] = useState<number | null>(null)
  const [consent, setConsent] = useState(false)
  const t = kind === 'application' ? { title: template.title, sub: template.intro } : titles[kind as keyof typeof titles]
  const [answers, setAnswers] = useState<Answers>({})
  const [files, setFiles] = useState<Record<string, { name: string; size: number } | undefined>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tried, setTried] = useState(false)

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      {preview && (
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-brand px-4 py-2.5 text-sm text-white">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Preview · responses aren't saved</span>
          <button type="button" onClick={onExitPreview} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to session
          </button>
        </div>
      )}
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:py-10">
        <ChiiMark height="h-8" />
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
          {state === 'closed' ? (
            <div className="px-6 py-14 text-center">
              <Lock className="mx-auto h-8 w-8 text-faint" />
              <h1 className="mt-4 text-lg font-semibold">This form is not accepting responses</h1>
              <p className="mt-1.5 text-sm text-muted">It may have closed, or not opened yet. Contact the CHII team if you think this is a mistake.</p>
            </div>
          ) : state === 'submitted' ? (
            <div className="px-6 py-14 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-good" />
              <h1 className="mt-4 text-lg font-semibold">{kind === 'attendance' ? 'You’re checked in' : 'Thank you!'}</h1>
              <p className="mt-1.5 text-sm text-muted">
                {kind === 'attendance' ? 'Enjoy the session. We’ve recorded your attendance for today.' : 'Your response was received. You can close this page.'}
              </p>
              <p className="mt-4 inline-flex rounded-lg bg-canvas px-3 py-1.5 font-mono text-xs text-muted">Your CHII ID: CHII-000231</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!consent) return
                if (kind === 'application') {
                  const problems = checkAnswers(template, answers, files)
                  setErrors(problems)
                  setTried(true)
                  if (Object.keys(problems).length) {
                    document.getElementById(`q-${Object.keys(problems)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    return
                  }
                }
                setState('submitted')
              }}
            >
              <div className="border-b border-line px-5 py-5 sm:px-6">
                <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
                <p className="mt-1 text-sm text-muted">{t.sub}</p>
              </div>
              <div className="space-y-5 px-5 py-5 sm:px-6">
                {kind === 'application' && (
                  <ApplicationFields
                    template={template}
                    answers={answers}
                    files={files}
                    errors={tried ? checkAnswers(template, answers, files) : errors}
                    onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
                    onFile={(id, f) => setFiles((x) => ({ ...x, [id]: f }))}
                  />
                )}
                {kind !== 'application' && (
                  <Q label="Email address" hint="We use it to match you to your CHII ID">
                    <input type="email" required defaultValue={preview ? 'w.kamau@alustudent.com' : ''} placeholder="you@alustudent.com" className={input} />
                  </Q>
                )}

                {kind === 'registration' && (
                  <>
                    <Q label="Full name">
                      <input required className={input} />
                    </Q>
                    <div className="grid grid-cols-2 gap-3">
                      <Q label="Gender">
                        <select className={input}>
                          <option>Female</option>
                          <option>Male</option>
                          <option>Prefer not to say</option>
                        </select>
                      </Q>
                      <Q label="Age">
                        <input type="number" min={15} max={60} className={input} />
                      </Q>
                    </div>
                    <Q label="Country">
                      <input className={input} placeholder="e.g. Rwanda" />
                    </Q>
                    <Q label="Why do you want to join?">
                      <textarea rows={4} className={`${input} h-auto py-2.5`} />
                    </Q>
                  </>
                )}

                {kind === 'feedback' && (
                  <>
                    <Q label="Overall, how satisfied were you?">
                      <div className="grid grid-cols-5 gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" onClick={() => setSat(n)} className={scale(sat === n)}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
                        <span>Not at all</span>
                        <span>Very</span>
                      </div>
                    </Q>
                    <Q label="How likely are you to recommend it to a friend?">
                      <div className="grid grid-cols-11 gap-1">
                        {Array.from({ length: 11 }, (_, n) => (
                          <button key={n} type="button" onClick={() => setNps(n)} className={`${scale(nps === n)} h-10 px-0 text-xs`}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
                        <span>Not likely</span>
                        <span>Very likely</span>
                      </div>
                    </Q>
                    <Q label="What should we change next time?">
                      <textarea rows={3} className={`${input} h-auto py-2.5`} />
                    </Q>
                  </>
                )}

                <label className="flex items-start gap-3 rounded-lg bg-canvas px-3 py-3 text-sm leading-6 text-body">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brand" />
                  I agree that CHII at African Leadership University may store and use my answers to run and evaluate its programmes.
                </label>
              </div>
              <div className="border-t border-line px-5 py-4 sm:px-6">
                <button
                  type="submit"
                  disabled={!consent}
                  className="h-12 w-full rounded-lg bg-brand text-[15px] font-semibold text-white transition-colors duration-150 ease-out hover:bg-brand-hover disabled:opacity-50"
                >
                  {kind === 'attendance' ? 'Check me in' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-faint">© 2026 CHII · African Leadership University</p>
      </div>
    </div>
  )
}

const input = 'h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100'
const scale = (on: boolean) =>
  `h-11 rounded-lg border text-sm font-semibold tabular-nums transition-colors duration-150 ease-out ${on ? 'border-brand-600 bg-brand text-white' : 'border-line-strong bg-surface text-body hover:bg-canvas'}`

function Q({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-ink">{label}</div>
      {hint && <div className="-mt-1 mb-1.5 text-xs text-muted">{hint}</div>}
      {children}
    </div>
  )
}

/* ---------- Application forms, drawn from a template ---------- */

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name)

function ApplicationFields({
  template,
  answers,
  files,
  errors,
  onAnswer,
  onFile,
}: {
  template: FormTemplate
  answers: Answers
  files: Record<string, { name: string; size: number } | undefined>
  errors: Record<string, string>
  onAnswer: (id: string, v: string | string[]) => void
  onFile: (id: string, f: { name: string; size: number } | undefined) => void
}) {
  const asked = template.questions.filter((q) => isAsked(q, answers))
  const missing = Object.keys(errors).length
  return (
    <>
      {missing > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad-bg px-3 py-2.5 text-sm text-bad">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {missing === 1 ? 'One answer needs' : `${missing} answers need`} attention before you can submit.
        </p>
      )}
      <datalist id="country-list">
        {COUNTRY_NAMES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {asked.map((q, i) => (
        <div key={q.id} id={`q-${q.id}`} className="scroll-mt-20">
          <div className="mb-1.5 text-sm font-medium text-ink">
            <span className="mr-1 text-faint tabular-nums">{i + 1}.</span>
            {q.label}
            {q.required && <span className="text-bad"> *</span>}
          </div>
          {q.help && q.type !== 'file' && <div className="-mt-1 mb-2 whitespace-pre-line text-xs leading-5 text-muted">{q.help}</div>}
          <Field q={q} value={answers[q.id]} file={files[q.id]} invalid={!!errors[q.id]} onAnswer={(v) => onAnswer(q.id, v)} onFile={(f) => onFile(q.id, f)} />
          {q.warnIf && answers[q.id] === q.warnIf.equals && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-warn-bg px-2.5 py-2 text-xs text-warn">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {q.warnIf.message}
            </p>
          )}
          {errors[q.id] && <p className="mt-1.5 text-xs font-medium text-bad">{errors[q.id]}</p>}
        </div>
      ))}
    </>
  )
}

function Field({
  q,
  value,
  file,
  invalid,
  onAnswer,
  onFile,
}: {
  q: Question
  value: string | string[] | undefined
  file?: { name: string; size: number }
  invalid: boolean
  onAnswer: (v: string | string[]) => void
  onFile: (f: { name: string; size: number } | undefined) => void
}) {
  const cls = `${input} ${invalid ? 'border-bad' : ''}`
  const str = typeof value === 'string' ? value : ''
  switch (q.type) {
    case 'email':
      return <input type="email" autoComplete="email" value={str} onChange={(e) => onAnswer(e.target.value)} placeholder="you@alustudent.com" className={cls} aria-invalid={invalid} />
    case 'text':
      return <input value={str} autoComplete={q.id === 'full_name' ? 'name' : undefined} onChange={(e) => onAnswer(e.target.value)} className={cls} aria-invalid={invalid} />
    case 'year':
      return <input type="number" inputMode="numeric" min={q.range?.[0]} max={q.range?.[1]} placeholder="e.g. 2003" value={str} onChange={(e) => onAnswer(e.target.value)} className={`${cls} max-w-[160px]`} aria-invalid={invalid} />
    case 'country':
      return <input list="country-list" value={str} onChange={(e) => onAnswer(e.target.value)} placeholder="Start typing a country" className={cls} aria-invalid={invalid} />
    case 'select':
      return (
        <select value={str} onChange={(e) => onAnswer(e.target.value)} className={cls} aria-invalid={invalid}>
          <option value="">Choose…</option>
          {q.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )
    case 'radio':
      return (
        <div role="radiogroup" aria-label={q.label} className="grid gap-1.5">
          {q.options!.map((o) => (
            <label key={o} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2 text-[15px] ${str === o ? 'border-brand-600 bg-brand-50 text-ink' : 'border-line-strong text-body hover:bg-canvas'}`}>
              <input type="radio" name={q.id} checked={str === o} onChange={() => onAnswer(o)} className="h-4 w-4 accent-brand" />
              {o}
            </label>
          ))}
        </div>
      )
    case 'checkboxes': {
      const picked = Array.isArray(value) ? value : []
      return (
        <div className="grid gap-1.5">
          {q.options!.map((o) => {
            const on = picked.includes(o)
            return (
              <label key={o} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2 text-[15px] ${on ? 'border-brand-600 bg-brand-50 text-ink' : 'border-line-strong text-body hover:bg-canvas'}`}>
                <input type="checkbox" checked={on} onChange={() => onAnswer(on ? picked.filter((x) => x !== o) : [...picked, o])} className="h-4 w-4 accent-brand" />
                {o}
              </label>
            )
          })}
          {q.minSelect && <span className="text-xs text-muted">{picked.length} selected · at least {q.minSelect}</span>}
        </div>
      )
    }
    case 'textarea': {
      const n = wordCount(str)
      const ok = !q.words || (n >= q.words[0] && n <= q.words[1])
      return (
        <>
          <textarea rows={q.words ? 7 : 3} value={str} onChange={(e) => onAnswer(e.target.value)} className={`${cls} h-auto py-2.5 leading-6`} aria-invalid={invalid} />
          {q.words && (
            <div className={`mt-1 text-right text-xs tabular-nums ${!str ? 'text-faint' : ok ? 'text-good' : 'text-warn'}`}>
              {n} words · {q.words[0]}–{q.words[1]}
            </div>
          )}
        </>
      )
    }
    case 'file':
      return file ? (
        <div className="flex items-center gap-3 rounded-lg border border-line-strong px-3.5 py-2.5">
          <FileText className="h-5 w-5 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{file.name}</span>
            <span className="block text-xs text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          </span>
          <button type="button" onClick={() => onFile(undefined)} aria-label="Remove file" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className={`flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-4 text-center text-sm ${invalid ? 'border-bad' : 'border-line-strong'} hover:bg-canvas`}>
          <Upload className="h-5 w-5 text-brand-600" />
          <span className="font-medium text-ink">Choose a file</span>
          <span className="text-xs text-muted">{q.help}</span>
          <input type="file" accept={q.accept} className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile({ name: f.name, size: f.size })
          }} />
        </label>
      )
  }
}
