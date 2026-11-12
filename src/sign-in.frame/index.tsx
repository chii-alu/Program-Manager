import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowRight, Check, ChevronUp, Eye, EyeOff, FlaskConical, Loader2 } from 'lucide-react'
import { AuthLayout } from '../shared/components/AuthLayout'
import { GoogleIcon } from '../shared/components/Brand'
import { Popover } from '../shared/components/Popover'
import { DEMO_PASSWORD, demoAccounts, portalName, resolveAccount, validateEmail, validatePassword } from '../shared/lib/auth'

export const args = {
  state: 'default',
  email: '',
  error: 'That email and password did not match a CHII staff account.',
  showDemo: true,
}

type Props = Partial<typeof args> & {
  onSignIn?: (email: string, password: string) => void
  onGoogle?: () => void
  onForgot?: () => void
}

const ease = [0.23, 1, 0.32, 1] as const

export default function SignIn(props: Props) {
  const { state, email: initialEmail, error, showDemo, onSignIn, onGoogle, onForgot } = { ...args, ...props }
  const reduce = useReducedMotion()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitted, setSubmitted] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const busy = state === 'signing-in' || state === 'google' || state === 'callback'

  useEffect(() => setEmail(initialEmail), [initialEmail])

  const emailErr = validateEmail(email)
  const passErr = validatePassword(password)
  const showEmailErr = (touched.email || submitted) && emailErr
  const showPassErr = (touched.password || submitted) && passErr

  const submit = (e?: React.FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault()
    const em = override?.email ?? email
    const pw = override?.password ?? password
    setSubmitted(true)
    if (validateEmail(em)) return emailRef.current?.focus()
    if (validatePassword(pw)) return passRef.current?.focus()
    onSignIn?.(em.trim(), pw)
  }

  if (state === 'callback') return <AuthLayout><Callback email={email || demoAccounts[0].email} /></AuthLayout>

  return (
    <AuthLayout>
      <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease }} className="flex flex-col">
        <h1 className="font-display text-[28px] font-bold leading-tight text-brand sm:text-[34px]">Welcome back</h1>
        <p className="mt-1.5 text-[15px] leading-6 text-muted">Sign in to the CHII Programme Manager.</p>

        <AnimatePresence initial={false}>
          {state === 'error' && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex gap-2.5 rounded-lg border border-bad/15 bg-bad-bg px-3.5 py-2.5 text-sm text-bad">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          disabled={busy}
          onClick={onGoogle}
          className="mt-5 flex h-11 items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface text-sm font-semibold text-ink transition-colors duration-150 ease-out hover:bg-canvas disabled:opacity-60 [@media(max-height:640px)]:mt-3"
        >
          {state === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          {state === 'google' ? 'Connecting to Google…' : 'Continue with Google'}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-faint [@media(max-height:640px)]:my-3">
          <span className="h-px flex-1 bg-line" />
          or with email
          <span className="h-px flex-1 bg-line" />
        </div>

        <form noValidate onSubmit={submit} className="flex flex-col">
          <label className="text-[13px] font-medium text-body" htmlFor="email">
            Email address
          </label>
          <input
            ref={emailRef}
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="you@chii.alu.edu"
            aria-invalid={!!showEmailErr}
            aria-describedby={showEmailErr ? 'email-err' : undefined}
            className={`mt-1.5 h-11 min-w-0 rounded-lg border bg-surface px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-faint focus:ring-3 ${
              showEmailErr ? 'border-bad/60 focus:border-bad focus:ring-bad/15' : 'border-line-strong focus:border-brand-600 focus:ring-brand-100'
            }`}
          />
          <FieldError id="email-err" msg={showEmailErr || null} />

          <label className="mt-3 text-[13px] font-medium text-body" htmlFor="password">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              ref={passRef}
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              aria-invalid={!!showPassErr}
              aria-describedby={showPassErr ? 'pass-err' : undefined}
              className={`h-11 w-full rounded-lg border bg-surface pl-3.5 pr-11 text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:ring-3 ${
                showPassErr ? 'border-bad/60 focus:border-bad focus:ring-bad/15' : 'border-line-strong focus:border-brand-600 focus:ring-brand-100'
              }`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError id="pass-err" msg={showPassErr || null} />

          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="flex min-w-0 items-center gap-2 text-sm text-body">
              <input type="checkbox" defaultChecked className="h-4 w-4 shrink-0 rounded border-line-strong accent-brand" />
              <span className="truncate">Keep me signed in</span>
            </label>
            <button type="button" onClick={onForgot} className="shrink-0 text-[13px] font-medium text-brand-600 hover:underline">
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex h-11 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-brand-hover active:scale-[0.98] disabled:opacity-70 [@media(max-height:640px)]:mt-4"
          >
            {state === 'signing-in' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {showDemo && (
          <div className="mt-4">
            <Popover
              side="top"
              align="stretch"
              width="w-full"
              trigger={({ toggle, open }) => (
                <button
                  type="button"
                  disabled={busy}
                  onClick={toggle}
                  aria-expanded={open}
                  className="flex h-10 w-full items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 text-sm text-body transition-colors duration-150 ease-out hover:bg-canvas disabled:opacity-60"
                >
                  <FlaskConical className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1 truncate text-left font-medium">Try a demo account</span>
                  <ChevronUp className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ease-out ${open ? '' : 'rotate-180'}`} />
                </button>
              )}
            >
              {(close) => (
                <div className="p-1.5">
                  <div className="px-2 pb-1.5 pt-1 text-[11px] text-muted">Fills the form and signs in. Password {DEMO_PASSWORD}</div>
                  <ul>
                    {demoAccounts.map((d) => (
                      <li key={d.email}>
                        <button
                          type="button"
                          onClick={() => {
                            close()
                            setEmail(d.email)
                            setPassword(DEMO_PASSWORD)
                            submit(undefined, { email: d.email, password: DEMO_PASSWORD })
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-canvas"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-600">{d.initials}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{d.label}</span>
                            <span className="block truncate text-xs text-muted">
                              {d.name} · {d.scope}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Popover>
          </div>
        )}
      </motion.div>
    </AuthLayout>
  )
}

function FieldError({ id, msg }: { id: string; msg: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {msg && (
        <motion.p
          id={id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.16, ease }}
          className="overflow-hidden text-xs text-bad"
        >
          <span className="block pt-1.5">{msg}</span>
        </motion.p>
      )}
    </AnimatePresence>
  )
}

/** The auth callback: verify, look up the staff role, then open the right portal. */
function Callback({ email }: { email: string }) {
  const acct = resolveAccount(email)
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = [setTimeout(() => setStep(1), 260), setTimeout(() => setStep(2), 560)]
    return () => t.forEach(clearTimeout)
  }, [])
  const steps = [
    'Credentials verified',
    acct.role === 'none' ? 'No staff role on this account' : `Role found · ${{ admin: 'MELA admin', pillar_lead: 'Pillar lead', pillar_staff: 'Pillar staff', reviewer: 'Reviewer', none: '' }[acct.role]}`,
    acct.role === 'none' ? 'Opening a limited view' : `Opening the ${portalName[acct.portal]}`,
  ]
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease }} aria-live="polite">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
        {acct.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)}
      </span>
      <h1 className="mt-5 font-display text-[28px] font-bold leading-tight text-brand sm:text-[32px]">Signing you in</h1>
      <p className="mt-1.5 truncate text-[15px] text-muted">{acct.email}</p>
      <ol className="mt-7 space-y-3.5">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 text-sm transition-colors duration-150 ease-out ${i <= step ? 'text-ink' : 'text-faint'}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${i < step ? 'bg-good-bg text-good' : i === step ? 'bg-brand-50 text-brand-600' : 'bg-canvas'}`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </span>
            <span className="truncate">{s}</span>
          </li>
        ))}
      </ol>
    </motion.div>
  )
}
