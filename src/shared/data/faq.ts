export type Faq = { id: string; q: string; a: string; keywords: string[]; to?: { label: string; key: string } }

/** Answers drawn from the platform overview. Matched by keyword, not by exact wording. */
export const faqs: Faq[] = [
  { id: 'chii-id', q: 'What is a CHII ID?', a: 'One identifier per person, in the format CHII-000001. It is created the first time someone is seen and matched by email, student ID or phone, so the same person keeps it across every intervention and pillar.', keywords: ['chii', 'id', 'identifier', 'unique', 'duplicate', 'match', 'person'], to: { label: 'Open CHII Participants', key: 'participants' } },
  { id: 'deid', q: 'Why does my file say “de-identified”?', a: 'Names, email, phone, student ID and standing are restricted columns. If your role can’t see them, they are removed from the file and the file name ends in “ - de-identified”.', keywords: ['deidentified', 'de-identified', 'restricted', 'name', 'email', 'missing', 'column', 'hidden', 'privacy'] },
  { id: 'export', q: 'How do I download or export a sheet?', a: 'Use Export or Download on any table. Choose Excel, CSV, PDF or JSON, and either the rows on screen (filters applied) or the whole sheet. Every export is written to the export log.', keywords: ['export', 'download', 'excel', 'csv', 'pdf', 'json', 'xlsx', 'file', 'sheet'], to: { label: 'Open consolidated sheets', key: 'db-participants' } },
  { id: 'log', q: 'Who can see the export log?', a: 'Every export records who, what, when, the filters, the row count and whether restricted columns were included. Staff can add entries; only MELA admins can read the log, and entries can’t be changed or deleted.', keywords: ['log', 'audit', 'who', 'exported', 'export_log', 'history'], to: { label: 'Open Data & exports', key: 'data' } },
  { id: 'import', q: 'How do I import a spreadsheet?', a: 'Go to Import a sheet, pick the intervention and upload an .xlsx or .csv. Check the suggested column mapping (it’s remembered next time), review the dry run, then commit. Each import is recorded as a batch.', keywords: ['import', 'upload', 'spreadsheet', 'excel', 'csv', 'mapping', 'columns', 'dry', 'run', 'batch'], to: { label: 'Open Import a sheet', key: 'import' } },
  { id: 'consent', q: 'Why were rows rejected for consent?', a: 'Registrations need consent to be “yes”. Rows with “no” or a blank consent answer are rejected in the dry run and never imported.', keywords: ['consent', 'rejected', 'reject', 'gdpr', 'permission', 'agree'] },
  { id: 'closed', q: 'Why does a form say it is not accepting responses?', a: 'Public forms only work while they are open. Draft and closed forms show “This form is not accepting responses”. Open it from the session’s Forms tab.', keywords: ['form', 'closed', 'draft', 'accepting', 'responses', 'link', 'qr', 'public', 'open'], to: { label: 'Open Interventions', key: 'interventions' } },
  { id: 'complete', q: 'When does someone count as having completed a session?', a: 'When they attend at least the completion threshold, which is 75% of the session’s dates by default. You can change it per session in Details.', keywords: ['complete', 'completion', 'threshold', 'attendance', '75', 'finished', 'dates'] },
  { id: 'feedback-once', q: 'Why can’t a participant submit feedback?', a: 'Feedback needs an attendance record for that session, and each person can respond only once per session.', keywords: ['feedback', 'submit', 'once', 'twice', 'attendance', 'blocked', 'cannot'] },
  { id: 'roles', q: 'What can each role see?', a: 'MELA admins see everything across pillars, including identity. Pillar leads and staff read and write their own pillar, and see names only for people linked to it. Reviewers see and score assigned applications by CHII ID.', keywords: ['role', 'roles', 'permission', 'access', 'admin', 'lead', 'staff', 'reviewer', 'see', 'pillar'] },
  { id: 'no-role', q: 'A colleague sees “No staff role”. What now?', a: 'They must sign in once so their account exists, then an admin adds them on Staff access with a role and pillar(s).', keywords: ['no', 'role', 'staff', 'access', 'add', 'colleague', 'new', 'user', 'invite', 'account'], to: { label: 'Open Staff access', key: 'staff' } },
  { id: 'anon', q: 'How do I anonymise a person?', a: 'MELA admins can anonymise from the person’s page on request. Identity fields are erased; the CHII ID, attendance and scores stay so aggregate counts don’t change.', keywords: ['anonymise', 'anonymize', 'delete', 'erase', 'remove', 'gdpr', 'request', 'person'] },
  { id: 'walkin', q: 'How do I add a walk-in to attendance?', a: 'Open the session’s Attendance tab and choose Walk-in. Enter their name and email, student ID or phone; they are matched to a CHII ID or get a new one.', keywords: ['walk', 'walkin', 'walk-in', 'attendance', 'check', 'checkin', 'add'] },
  { id: 'selective', q: 'What’s the difference between open and selective?', a: 'Open interventions take registrations from anyone with the link. Selective ones take applications that reviewers score before people are selected.', keywords: ['open', 'selective', 'application', 'registration', 'apply', 'select', 'difference'] },
  { id: 'time', q: 'What does the date filter in the top bar change?', a: 'It sets the period for the whole platform: analytics, charts and dated tables like feedback and exports all follow it. It is remembered across pages.', keywords: ['date', 'time', 'period', 'filter', 'range', 'days', 'month', 'year'] },
  { id: 'install', q: 'Can I install the app on my phone?', a: 'Yes. Choose Install app from your profile menu, or on iPhone use Share → Add to Home Screen. It opens full screen like a native app.', keywords: ['install', 'app', 'phone', 'mobile', 'pwa', 'home', 'screen', 'offline'] },
  { id: 'filters', q: 'How do I filter or sort a table?', a: 'Click any column heading to sort it, pick the values to keep, or set a min–max for numbers. Active filters show as chips above the rows; remove one or Clear all. On a phone, use the sliders button next to search.', keywords: ['filter', 'sort', 'column', 'table', 'search', 'chip', 'clear', 'order', 'hide'] },
  { id: 'charts', q: 'Can I filter the analytics by clicking a chart?', a: 'Yes. On Analytics, click a bar in NPS by intervention, a slice of Gender, or an Age bar to filter the rest of the page. Pillar chips show or hide a pillar, and the toggles switch between area, bar and line.', keywords: ['chart', 'graph', 'analytics', 'click', 'cross', 'filter', 'nps', 'gender', 'age', 'bar', 'line', 'area'], to: { label: 'Open Analytics', key: 'analytics' } },
  { id: 'notifications', q: 'What triggers a notification?', a: 'Finished imports, downloads, new sessions, staff changes and live session alerts such as new registrations. Click one to jump to it, or mark all read from the bell.', keywords: ['notification', 'notifications', 'bell', 'alert', 'unread', 'toast', 'message'] },
  { id: 'password', q: 'I can’t sign in. What should I check?', a: 'Use your ALU or CHII staff email and a password of at least 8 characters. If you use Google, choose Continue with Google instead. Forgot password? sends a reset link valid for 30 minutes.', keywords: ['sign', 'login', 'log', 'password', 'reset', 'forgot', 'google', 'email', 'cannot', 'locked'] },
  { id: 'sidebar', q: 'Can I make the sidebar narrower?', a: 'Drag its right edge to resize it, drag it far left to collapse it to icons, or double-click the edge to reset. The width is remembered.', keywords: ['sidebar', 'menu', 'resize', 'narrow', 'wide', 'collapse', 'width', 'nav'] },
  { id: 'dark', q: 'How do I switch to dark mode?', a: 'Use the moon button in the top bar, the theme item in your profile menu, or the toggle in More on mobile.', keywords: ['dark', 'theme', 'light', 'mode', 'night'] },
]

const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/(ing|ed|es|s)$/, '')

export function searchFaqs(query: string): Faq[] {
  const words = query.split(/\s+/).map(stem).filter((w) => w.length > 1)
  if (!words.length) return []
  return faqs
    .map((f) => {
      const keys = f.keywords.map(stem)
      const title = f.q.split(/\s+/).map(stem)
      const score = words.reduce((n, w) => n + (keys.some((k) => k === w || (w.length > 3 && k.startsWith(w))) ? 3 : 0) + (title.includes(w) ? 1 : 0), 0)
      return { f, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.f)
}
