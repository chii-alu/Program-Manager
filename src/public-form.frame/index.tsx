import React, { useState } from 'react'
import { ArrowLeft, CheckCircle2, Eye, Lock } from 'lucide-react'
import { ChiiMark } from '../shared/components/Brand'

export const args = {
  kind: 'feedback',
  state: 'open',
  preview: false,
}

type Props = Partial<typeof args> & { onExitPreview?: () => void }

const titles = {
  registration: { title: 'Register for SIE Cohort 4', sub: 'Student Immersion Experience · HEMP · 3 Nov – 15 Dec' },
  attendance: { title: 'Check in', sub: 'SIE Cohort 4 · Monday 10 November' },
  feedback: { title: 'How was SIE Cohort 4?', sub: 'Takes about 2 minutes. Your answers shape the next cohort.' },
}

export default function PublicForm(props: Props) {
  const { kind, state: initialState, preview, onExitPreview } = { ...args, ...props }
  const [state, setState] = useState(initialState)
  const [sat, setSat] = useState<number | null>(null)
  const [nps, setNps] = useState<number | null>(null)
  const [consent, setConsent] = useState(false)
  const t = titles[kind as keyof typeof titles]

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
                if (consent) setState('submitted')
              }}
            >
              <div className="border-b border-line px-5 py-5 sm:px-6">
                <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
                <p className="mt-1 text-sm text-muted">{t.sub}</p>
              </div>
              <div className="space-y-5 px-5 py-5 sm:px-6">
                <Q label="Email address" hint="We use it to match you to your CHII ID">
                  <input type="email" required defaultValue={preview ? 'w.kamau@alustudent.com' : ''} placeholder="you@alustudent.com" className={input} />
                </Q>

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
