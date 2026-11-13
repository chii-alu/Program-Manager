import React, { useEffect, useState } from 'react'

import SignIn from '../sign-in.frame'
import ResetPassword from '../reset-password.frame'
import Overview from '../overview.frame'
import Analytics from '../analytics.frame'
import Interventions from '../interventions.frame'
import Session from '../session.frame'
import Participants from '../participants.frame'
import Person from '../person-journey.frame'
import Feedbacks from '../feedbacks.frame'
import ChiiDatabase from '../chii-database.frame'
import ConsolidatedSheet from '../consolidated-sheet.frame'
import ImportSheet from '../import-sheet.frame'
import StaffAccess from '../staff-access.frame'
import DataExports from '../data-exports.frame'
import Applications from '../applications.frame'
import Reports from '../reports.frame'
import Ventures, { type VentureView } from '../ventures.frame'
import VentureForms from '../venture-forms.frame'
import PublicForm from '../public-form.frame'
import { resolveAccount } from '../shared/lib/auth'
import { roleMeta, sessions } from '../shared/data/mela'
import { templateFor } from '../shared/forms/templates'

const SIGN_IN = 'sign-in'
const RESET = 'reset-password'
const OVERVIEW = 'overview'
const ANALYTICS = 'analytics'
const INTERVENTIONS = 'interventions'
const SESSION = 'session'
const PARTICIPANTS = 'participants'
const PERSON = 'person-journey'
const FEEDBACKS = 'feedbacks'
const CHII_DB = 'chii-database'
const SHEET = 'consolidated-sheet'
const IMPORT = 'import-sheet'
const STAFF = 'staff-access'
const REPORTS = 'reports'
const VENTURES = 'ventures'
const DATA = 'data-exports'
const APPLICATIONS = 'applications'
const FORM = 'public-form'

export const args = {
  role: 'admin',
  signInFails: false,
}

const routes: Record<string, string> = {
  overview: OVERVIEW,
  analytics: ANALYTICS,
  interventions: INTERVENTIONS,
  participants: PARTICIPANTS,
  feedback: FEEDBACKS,
  'chii-db': CHII_DB,
  'db-participants': SHEET,
  'db-feedback': SHEET,
  'db-ventures': SHEET,
  import: IMPORT,
  staff: STAFF,
  data: DATA,
  applications: APPLICATIONS,
  reports: REPORTS,
  ventures: VENTURES,
  'ventures-analytics': VENTURES,
  'ventures-updates': VENTURES,
  'ventures-import': VENTURES,
}

const defaultPortal = (role: string) => (role === 'admin' ? 'admin' : role === 'pillar_lead' ? 'hent' : 'hemp')

type Props = Partial<typeof args> & { start?: string }

export default function MelaManager(props: Props) {
  const { role: roleControl, signInFails, start } = { ...args, ...props }
  const [role, setRole] = useState(roleControl)
  const [step, setStep] = useState(() => start ?? SIGN_IN)
  const [portal, setPortal] = useState(defaultPortal(roleControl))
  const [authState, setAuthState] = useState<'default' | 'error' | 'signing-in' | 'google' | 'callback'>('default')
  const [authEmail, setAuthEmail] = useState('')
  const [authError, setAuthError] = useState('')
  const [resetState, setResetState] = useState<'default' | 'sending' | 'sent'>('default')
  const [personId, setPersonId] = useState('CHII-000214')
  const [sessionId, setSessionId] = useState('s2')
  const [sheet, setSheet] = useState<'participants' | 'feedback' | 'ventures'>('participants')
  const [newSession, setNewSession] = useState(false)
  const [formKind, setFormKind] = useState<'application' | 'registration' | 'attendance' | 'feedback'>('feedback')
  const [ventureView, setVentureView] = useState<VentureView>('registry')

  // The role control re-renders in place: adopt it and its home portal.
  useEffect(() => {
    setRole(roleControl)
    setPortal(defaultPortal(roleControl))
  }, [roleControl])

  const effectivePortal = role !== 'admin' && portal === 'admin' ? defaultPortal(role) : portal

  const enter = (r: string, p: string) => {
    setRole(r)
    setPortal(r === 'admin' ? p : p === 'admin' ? defaultPortal(r) : p)
    setStep(OVERVIEW)
  }

  // Sign in → auth callback (verify, look up staff role) → the account's home portal.
  const signIn = (email: string, via: 'signing-in' | 'google') => {
    setAuthState(via)
    setAuthEmail(email)
    setTimeout(() => {
      if (signInFails && via === 'signing-in') {
        setAuthError('That email and password did not match a CHII staff account.')
        return setAuthState('error')
      }
      setAuthState('callback')
      const acct = resolveAccount(email)
      setTimeout(() => {
        setAuthState('default')
        enter(acct.role, acct.portal)
      }, 900)
    }, 600)
  }

  const navigate = (to: string) => {
    if (to.startsWith('person:')) {
      setPersonId(to.slice(7))
      return setStep(PERSON)
    }
    if (to.startsWith('session:')) {
      setSessionId(to.slice(8))
      return setStep(SESSION)
    }
    if (to === 'new-session') {
      setNewSession(true)
      return setStep(INTERVENTIONS)
    }
    if (to.startsWith('ventures')) setVentureView((to.split('-')[1] as VentureView) ?? 'registry')
    if (to === 'db-participants') setSheet('participants')
    if (to === 'db-feedback') setSheet('feedback')
    if (to === 'db-ventures') setSheet('ventures')
    if (routes[to]) setStep(routes[to])
  }

  const shared = {
    role,
    portal: effectivePortal,
    onNavigate: navigate,
    onPortalChange: (p: string) => setPortal(p),
    onSignOut: () => {
      setAuthState('default')
      setStep(SIGN_IN)
    },
  }
  const openPerson = (id: string) => {
    setPersonId(id)
    setStep(PERSON)
  }
  const openSession = (id: string) => {
    setSessionId(id)
    setStep(SESSION)
  }

  switch (step) {
    case RESET:
      return (
        <ResetPassword
          state={resetState}
          onBack={() => {
            setResetState('default')
            setStep(SIGN_IN)
          }}
          onSubmit={() => {
            setResetState('sending')
            setTimeout(() => setResetState('sent'), 700)
          }}
        />
      )
    case OVERVIEW:
      return <Overview {...shared} onOpenSession={openSession} />
    case ANALYTICS:
      return <Analytics {...shared} />
    case INTERVENTIONS:
      return <Interventions {...shared} newSession={newSession} onCloseNew={() => setNewSession(false)} onOpenSession={openSession} />
    case SESSION:
      return <Session {...shared} sessionId={sessionId} onBack={() => setStep(INTERVENTIONS)} onOpenPerson={openPerson} onOpenForm={(k) => (setFormKind(k), setStep(FORM))} />
    case PARTICIPANTS:
      return <Participants {...shared} onOpenPerson={openPerson} />
    case PERSON:
      return <Person {...shared} chiiId={personId} onBack={() => setStep(PARTICIPANTS)} />
    case FEEDBACKS:
      return <Feedbacks {...shared} onOpenPerson={openPerson} />
    case CHII_DB:
      return <ChiiDatabase {...shared} onOpenPerson={openPerson} />
    case SHEET:
      return <ConsolidatedSheet {...shared} sheet={sheet} onSheetChange={(s) => setSheet(s as 'participants' | 'feedback' | 'ventures')} />
    case IMPORT:
      return <ImportSheet {...shared} />
    case STAFF:
      return <StaffAccess {...shared} />
    case DATA:
      return <DataExports {...shared} />
    case REPORTS:
      return <Reports {...shared} />
    case VENTURES:
      return <Ventures {...shared} view={ventureView} />
    case APPLICATIONS:
      return <Applications {...shared} />
    case 'venture-register':
      return <VentureForms kind="register" />
    case 'venture-update':
      return <VentureForms kind="update" />
    case FORM:
      return <PublicForm preview kind={formKind} template={(() => { const se = sessions.find((x) => x.id === sessionId); return se ? templateFor(se.intervention, formKind, se.name) : null })()} onExitPreview={() => setStep(SESSION)} />
    default:
      return (
        <SignIn
          state={authState}
          email={authEmail}
          error={authError || undefined}
          onSignIn={(email) => signIn(email, 'signing-in')}
          onGoogle={() => signIn(roleMeta[roleControl as keyof typeof roleMeta].email, 'google')}
          onForgot={() => setStep(RESET)}
        />
      )
  }
}
