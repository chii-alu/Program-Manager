import React, { useState } from 'react'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { AuthLayout } from '../shared/components/AuthLayout'
import { validateEmail } from '../shared/lib/auth'

export const args = {
  state: 'default',
  email: 'amara.okafor@chii.alu.edu',
}

export const argTypes = {
  state: { control: 'radio', options: ['default', 'sending', 'sent'] },
  email: { control: 'text' },
}

type Props = Partial<typeof args> & { onBack?: () => void; onSubmit?: () => void }

export default function ResetPassword(props: Props) {
  const { state, email: initialEmail, onBack, onSubmit } = { ...args, ...props }
  const [email, setEmail] = useState(initialEmail)
  const [tried, setTried] = useState(false)
  const err = tried ? validateEmail(email) : null

  return (
    <AuthLayout>
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 flex w-fit items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </button>

      {state === 'sent' ? (
        <div className="mt-8">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-good-bg text-good">
            <MailCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-5 font-display text-[30px] font-bold leading-tight text-brand">Check your inbox</h1>
          <p className="mt-2 text-[15px] leading-6 text-muted">
            If <span className="font-medium text-ink">{email}</span> belongs to a staff account, a reset link is on its way.
            The link expires in 30 minutes.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-8 h-11 w-full rounded-lg bg-brand text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-brand-hover"
          >
            Return to sign in
          </button>
          <p className="mt-4 text-center text-sm text-muted">
            No email after a few minutes?{' '}
            <button type="button" onClick={onSubmit} className="font-medium text-brand-600 hover:underline">
              Send again
            </button>
          </p>
        </div>
      ) : (
        <form
          className="mt-8 flex flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            setTried(true)
            if (!validateEmail(email)) onSubmit?.()
          }}
          noValidate
        >
          <h1 className="font-display text-[30px] font-bold leading-tight text-brand sm:text-[36px]">Reset password</h1>
          <p className="mt-2 text-[15px] leading-6 text-muted">
            Enter your staff email and we'll send a link to choose a new password.
          </p>
          <label htmlFor="reset-email" className="mt-7 text-[13px] font-medium text-body">
            Email address
          </label>
          <input
            id="reset-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!err}
            className={`mt-1.5 h-11 min-w-0 rounded-lg border bg-surface px-3.5 text-[15px] text-ink outline-none focus:ring-3 ${err ? 'border-bad/60 focus:ring-bad/15' : 'border-line-strong focus:border-brand-600 focus:ring-brand-100'}`}
          />
          {err && <p className="pt-1.5 text-xs text-bad">{err}</p>}
          <button
            type="submit"
            disabled={state === 'sending'}
            className="mt-6 flex h-11 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-brand-hover disabled:opacity-70"
          >
            {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
            {state === 'sending' ? 'Sending link…' : 'Send reset link'}
          </button>
          <p className="mt-6 text-sm leading-6 text-muted">
            Signed in with Google? Reset your password from your Google account instead.
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
