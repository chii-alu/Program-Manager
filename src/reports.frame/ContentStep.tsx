/**
 * Wizard step 4: Content (REPORT-TOOL-SPEC §3 step 4, §4).
 *
 * A canvas of sections and live-rendered blocks, reordered by drag (or keyboard) with dnd-kit,
 * and a side panel holding either the block library or the selected block's settings.
 * Template sections marked required can't be removed; locked ones can't be changed at all.
 */
import React, { useMemo, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bold,
  Braces,
  Copy,
  Eye,
  GripVertical,
  Heading3,
  Italic,
  LayoutGrid,
  List,
  ListOrdered,
  Lock,
  PencilLine,
  Plus,
  Quote,
  Table2,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { PillarTag } from '../shared/components/ui'
import { Popover } from '../shared/components/Popover'
import { LIBRARY, OVERRIDE_PRESETS, PLACEHOLDERS, TEXT_ROLES, blockContext, blockId, blockTitle, defaultContent, newBlock, sectionId, type LibraryItem } from '../shared/reports/blocks'
import { INDICATORS, indicatorByCode } from '../shared/reports/indicators'
import { DIMENSIONS, scopeOptions } from '../shared/reports/metrics'
import { canUseVentures } from '../shared/ventures/store'
import { BlockView } from '../shared/reports/render/BlockView'
import { ReportDocument } from '../shared/reports/render/ReportDocument'
import type { BlockKind, BlockSettings, ChartKind, Dimension, Report, ReportBlock, ReportSection, TableKind, TextRole, Viewer } from '../shared/reports/types'
import { Field, inputCls } from './parts'

type Content = { sections: ReportSection[]; blocks: ReportBlock[] }

export function ensureContent(r: Pick<Report, 'templateId' | 'sections' | 'blocks'>): Content {
  return r.sections && r.blocks ? { sections: r.sections, blocks: r.blocks } : defaultContent(r.templateId)
}

export function ContentStep({ report, viewer, readOnly, onChange }: { report: Report; viewer: Viewer; readOnly?: boolean; onChange: (c: Content) => void }) {
  const { sections, blocks } = ensureContent(report)
  const [mode, setMode] = useState<'edit' | 'preview'>(readOnly ? 'preview' : 'edit')
  const [selected, setSelected] = useState<string | null>(null)
  const [target, setTarget] = useState<string>(sections[sections.length - 1]?.id ?? '')
  const sel = blocks.find((b) => b.id === selected) ?? null
  const fullReport: Report = { ...report, sections, blocks }

  const update = (c: Partial<Content>) => onChange({ sections, blocks, ...c })
  const sectionOf = (b: ReportBlock) => sections.find((s) => s.id === b.sectionId)
  const isLocked = (b: ReportBlock) => !!sectionOf(b)?.locked

  /* Block operations */
  const patchBlock = (id: string, patch: Partial<ReportBlock>) => update({ blocks: blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  const patchSettings = (id: string, patch: Partial<BlockSettings>) => update({ blocks: blocks.map((b) => (b.id === id ? { ...b, settings: { ...b.settings, ...patch } } : b)) })
  const addBlock = (item: LibraryItem) => {
    const sec = sections.find((s) => s.id === target && !s.locked) ?? sections.find((s) => !s.locked)
    if (!sec) return
    const b = newBlock(item, sec.id)
    // Insert after the section's last block, so it appears where the author is looking.
    const lastIdx = blocks.map((x) => x.sectionId).lastIndexOf(sec.id)
    const next = [...blocks]
    next.splice(lastIdx + 1, 0, b)
    update({ blocks: next })
    setSelected(b.id)
  }
  const duplicate = (b: ReportBlock) => {
    const copy = { ...structuredClone(b), id: blockId() }
    const i = blocks.findIndex((x) => x.id === b.id)
    update({ blocks: [...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)] })
    setSelected(copy.id)
  }
  const remove = (b: ReportBlock) => {
    update({ blocks: blocks.filter((x) => x.id !== b.id) })
    setSelected(null)
  }

  /* Section operations */
  const addSection = () => {
    const s: ReportSection = { id: sectionId(), title: 'New section' }
    update({ sections: [...sections, s] })
    setTarget(s.id)
    setSelected(null)
  }
  const moveSection = (i: number, dir: -1 | 1) => update({ sections: arrayMove(sections, i, i + dir) })
  const removeSection = (s: ReportSection) => {
    update({ sections: sections.filter((x) => x.id !== s.id), blocks: blocks.filter((b) => b.sectionId !== s.id) })
    setSelected(null)
  }

  /* Drag to reorder, within a section */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = blocks.findIndex((b) => b.id === e.active.id)
    const to = blocks.findIndex((b) => b.id === e.over!.id)
    if (blocks[from]?.sectionId !== blocks[to]?.sectionId || isLocked(blocks[from])) return
    update({ blocks: arrayMove(blocks, from, to) })
  }

  return (
    <div className="space-y-4">
      {/* Mode switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-soft)]">
          {(
            [
              ['edit', 'Edit content', PencilLine],
              ['preview', 'Preview document', Eye],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              disabled={m === 'edit' && readOnly}
              onClick={() => setMode(m)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors disabled:opacity-40 ${mode === m ? 'bg-brand text-white' : 'text-body hover:bg-canvas'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {sections.length} sections · {blocks.length} blocks · numbers are live for {report.period.label}
        </p>
      </div>

      {mode === 'preview' ? (
        <div className="rounded-[var(--radius-card)] bg-canvas py-6">
          <ReportDocument report={fullReport} viewer={viewer} />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Canvas */}
          <div className="min-w-0 space-y-5" onClick={() => setSelected(null)}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              {sections.map((s, si) => {
                const list = blocks.filter((b) => b.sectionId === s.id)
                return (
                  <section
                    key={s.id}
                    onClick={(e) => (e.stopPropagation(), setTarget(s.id), setSelected(null))}
                    className={`rounded-[var(--radius-card)] border bg-surface shadow-[var(--shadow-soft)] ${target === s.id && !sel ? 'border-brand-600/60' : 'border-[color:var(--card-border)]'}`}
                  >
                    <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                      <span className="font-display text-base text-brand-600">{si + 1}</span>
                      <input
                        value={s.title}
                        disabled={s.locked}
                        aria-label="Section heading"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => update({ sections: sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })}
                        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-display text-[17px] font-semibold text-ink outline-none hover:border-line focus:border-brand-600 disabled:hover:border-transparent"
                      />
                      {s.required && <Badge tone="brand">Required</Badge>}
                      {s.locked && (
                        <Badge tone="muted">
                          <Lock className="h-3 w-3" /> Locked
                        </Badge>
                      )}
                      <span className="ml-auto flex items-center gap-0.5">
                        <IconBtn label="Move section up" disabled={si === 0} onClick={() => moveSection(si, -1)} icon={ArrowUp} />
                        <IconBtn label="Move section down" disabled={si === sections.length - 1} onClick={() => moveSection(si, 1)} icon={ArrowDown} />
                        <IconBtn
                          label={s.required ? 'Required by the template' : 'Remove section'}
                          disabled={s.required || s.locked}
                          onClick={() => removeSection(s)}
                          icon={Trash2}
                          danger
                        />
                      </span>
                    </header>
                    <div className="p-4">
                      <SortableContext items={list.map((b) => b.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-4 gap-3">
                          {list.map((b) => (
                            <SortableBlock
                              key={b.id}
                              sectionTitle={s.title}
                              block={b}
                              report={fullReport}
                              viewer={viewer}
                              locked={!!s.locked}
                              selected={selected === b.id}
                              onSelect={() => (setSelected(b.id), setTarget(s.id))}
                              onDuplicate={() => duplicate(b)}
                              onRemove={() => remove(b)}
                              onHtml={(html) => patchSettings(b.id, { html })}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      {!s.locked && (
                        <button
                          type="button"
                          onClick={(e) => (e.stopPropagation(), setTarget(s.id), setSelected(null))}
                          className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-xs font-semibold transition-colors ${target === s.id && !sel ? 'border-brand-600 bg-brand-50/50 text-brand dark:bg-brand-50 dark:text-brand-600' : 'border-line-strong text-muted hover:bg-canvas'}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {target === s.id && !sel ? 'Pick a block from the library on the right' : 'Add a block here'}
                        </button>
                      )}
                    </div>
                  </section>
                )
              })}
            </DndContext>
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), addSection())}
              className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface py-3.5 text-sm font-semibold text-body hover:bg-canvas"
            >
              <Plus className="h-4 w-4" /> Add a section
            </button>
          </div>

          {/* Side panel */}
          <aside className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:self-start xl:overflow-y-auto">
            {sel ? (
              <BlockSettingsPanel
                block={sel}
                report={fullReport}
                viewer={viewer}
                sections={sections}
                locked={isLocked(sel)}
                onClose={() => setSelected(null)}
                onSettings={(p) => patchSettings(sel.id, p)}
                onBlock={(p) => patchBlock(sel.id, p)}
              />
            ) : (
              <LibraryPanel sections={sections} target={target} onTarget={setTarget} onAdd={addBlock} audiencePublic={report.audience === 'public'} />
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

/* ---------- A block on the canvas ---------- */

function SortableBlock({
  sectionTitle,
  block,
  report,
  viewer,
  locked,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
  onHtml,
}: {
  sectionTitle: string
  block: ReportBlock
  report: Report
  viewer: Viewer
  locked: boolean
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onRemove: () => void
  onHtml: (html: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: locked })
  const wide = block.type !== 'kpi'
  const ctx = blockContext(report, block.settings)
  const Icon = block.type === 'kpi' ? LayoutGrid : block.type === 'chart' ? BarChart3 : block.type === 'table' ? Table2 : Type
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={(e) => (e.stopPropagation(), onSelect())}
      className={`group relative min-w-0 rounded-lg border bg-surface transition-[box-shadow,border-color] ${wide ? 'col-span-4' : 'col-span-2 lg:col-span-1'} ${
        selected ? 'border-brand ring-2 ring-brand/25' : 'border-transparent hover:border-line'
      } ${isDragging ? 'z-10 shadow-xl' : ''}`}
    >
      <div className={`flex items-center gap-1 px-2 pt-1.5 text-[11px] ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'} transition-opacity`}>
        {!locked && (
          <button type="button" {...attributes} {...listeners} aria-label={`Drag to reorder: ${blockTitle(block)}`} className="grid h-6 w-6 cursor-grab place-items-center rounded text-faint hover:bg-canvas hover:text-ink active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <Icon className="h-3.5 w-3.5 text-muted" />
        <span className="min-w-0 flex-1 truncate font-semibold text-muted">{blockTitle(block)}</span>
        {ctx.overridden && <Badge tone="brand">Override</Badge>}
        {!locked && (
          <>
            <IconBtn label="Duplicate block" onClick={(e) => (e?.stopPropagation(), onDuplicate())} icon={Copy} small />
            <IconBtn label="Remove block" onClick={(e) => (e?.stopPropagation(), onRemove())} icon={Trash2} small danger />
          </>
        )}
      </div>
      <div className="px-3 pb-3 pt-1">
        {block.type === 'text' && selected && !locked ? (
          <TextEditor html={block.settings.html ?? ''} onChange={onHtml} heading={TEXT_ROLES[block.settings.textRole ?? 'free'].label} showHeading={TEXT_ROLES[block.settings.textRole ?? 'free'].label !== sectionTitle} />
        ) : (
          <>
            {block.type === 'text' && TEXT_ROLES[block.settings.textRole ?? 'free'].label !== sectionTitle && (
              <h3 className="mb-1.5 font-display text-[15px] font-semibold text-ink">{TEXT_ROLES[block.settings.textRole ?? 'free'].label}</h3>
            )}
            <BlockView block={block} report={report} viewer={viewer} />
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- Rich text with live placeholders (TipTap) ---------- */

function TextEditor({ html, onChange, heading, showHeading }: { html: string; onChange: (html: string) => void; heading: string; showHeading: boolean }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3] } })],
    content: html,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: { attributes: { 'aria-label': `${heading} text` } },
  })
  if (!editor) return null
  const tool = (label: string, Icon: React.ComponentType<{ className?: string }>, run: () => void, active: boolean) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`grid h-7 w-7 place-items-center rounded ${active ? 'bg-brand text-white' : 'text-body hover:bg-canvas'}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
  return (
    <div onClick={(e) => e.stopPropagation()}>
      {showHeading && <h3 className="mb-1.5 font-display text-[15px] font-semibold text-ink">{heading}</h3>}
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-line bg-canvas px-1.5 py-1">
        {tool('Bold', Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {tool('Italic', Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {tool('Subheading', Heading3, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading'))}
        {tool('Bulleted list', List, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {tool('Numbered list', ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {tool('Quote', Quote, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
        <span className="mx-1 h-4 w-px bg-line" />
        <Popover
          align="left"
          width="w-64"
          trigger={({ toggle }) => (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={toggle} className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-semibold text-brand hover:bg-surface dark:text-brand-600">
              <Braces className="h-3.5 w-3.5" /> Insert number
            </button>
          )}
        >
          {(close) => (
            <div className="max-h-72 overflow-y-auto p-1">
              <p className="px-2 pb-1 pt-1.5 text-[11px] text-muted">Filled live from the report’s scope and period, and frozen when it’s finalised.</p>
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (editor.chain().focus().insertContent(`{{${p.token}}}`).run(), close())}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
                >
                  <span className="text-body">{p.label}</span>
                  <code className="text-[10.5px] text-faint">{`{{${p.token}}}`}</code>
                </button>
              ))}
            </div>
          )}
        </Popover>
      </div>
      <div className="report-prose rounded-b-md border border-line bg-surface px-3 py-2.5 focus-within:border-brand-600">
        <EditorContent editor={editor} />
      </div>
      <p className="mt-1.5 text-[11px] text-muted">Tokens like {'{{nps}}'} show their live value when the block isn’t being edited.</p>
    </div>
  )
}

/* ---------- Side panel: library ---------- */

function LibraryPanel({ sections, target, onTarget, onAdd, audiencePublic }: { sections: ReportSection[]; target: string; onTarget: (id: string) => void; onAdd: (i: LibraryItem) => void; audiencePublic: boolean }) {
  const groups = ['Headline numbers', 'Charts', 'Tables', 'Text'] as const
  const editable = sections.filter((s) => !s.locked)
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
      <div className="rounded-t-[calc(var(--radius-card)_-_1px)] bg-brand px-4 py-3 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.04em]">Block library</p>
        <p className="mt-0.5 text-[11px] text-white/70">Click a block to add it. Every number comes from the metrics layer.</p>
      </div>
      <div className="border-b border-line p-3">
        <Field label="Add to section">
          <select className={`${inputCls} h-9`} value={editable.some((s) => s.id === target) ? target : editable[0]?.id} onChange={(e) => onTarget(e.target.value)}>
            {editable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="space-y-3 p-3">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">{g}</p>
            <div className="space-y-1">
              {LIBRARY.filter((i) => i.group === g).map((i) => (
                <button key={i.key} type="button" disabled={!editable.length} onClick={() => onAdd(i)} className="flex w-full items-start gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left hover:border-line hover:bg-canvas disabled:opacity-40">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-50 text-brand dark:text-brand-600">
                    {i.type === 'kpi' ? <LayoutGrid className="h-3.5 w-3.5" /> : i.type === 'chart' ? <BarChart3 className="h-3.5 w-3.5" /> : i.type === 'table' ? <Table2 className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{i.label}</span>
                    <span className="block text-[11px] leading-4 text-muted">{i.body}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {audiencePublic && <p className="rounded-md bg-warn-bg px-2.5 py-2 text-[11px] text-warn">Public report: disability and humanitarian breakdowns are hidden unless a MELA admin turns them on.</p>}
      </div>
    </section>
  )
}

/* ---------- Side panel: block settings ---------- */

const CHART_KINDS: [ChartKind, string][] = [
  ['bar', 'Bar chart'],
  ['donut', 'Donut'],
  ['trend', 'Trend over time'],
  ['funnel', 'Funnel'],
  ['feedback_items', 'Feedback ratings'],
]
const TABLE_KINDS: [TableKind, string][] = [
  ['intervention_summary', 'Intervention summary'],
  ['cohort_summary', 'Cohort summary'],
  ['breakdown', 'Breakdown table'],
]

function BlockSettingsPanel({
  block,
  report,
  viewer,
  sections,
  locked,
  onClose,
  onSettings,
  onBlock,
}: {
  block: ReportBlock
  report: Report
  viewer: Viewer
  sections: ReportSection[]
  locked: boolean
  onClose: () => void
  onSettings: (p: Partial<BlockSettings>) => void
  onBlock: (p: Partial<ReportBlock>) => void
}) {
  const s = block.settings
  const ind = s.metric ? indicatorByCode.get(s.metric) : undefined
  const needsMetric = block.type === 'kpi' || (block.type === 'chart' && ['bar', 'donut', 'trend'].includes(s.chart ?? '')) || (block.type === 'table' && s.table === 'breakdown')
  const needsBreakdown = (block.type === 'chart' && ['bar', 'donut', 'trend'].includes(s.chart ?? '')) || (block.type === 'table' && s.table === 'breakdown')
  const rankable = (block.type === 'chart' && s.chart === 'bar') || (block.type === 'table' && s.table === 'breakdown')
  const isPublic = report.audience === 'public' && !(viewer.role === 'admin' && viewer.allowSensitive)

  // Donuts show shares, so only additive (count-of-people) metrics make sense there.
  // Venture metrics: only for people with Venture Registry access, in reports that include HENT,
  // and not on trend charts (ventures are "as of" a date, not month by month).
  const ventures = canUseVentures({ role: viewer.role, pillars: viewer.pillars }) && report.scope.pillars.includes('HENT') && s.chart !== 'trend'
  const metrics = INDICATORS.filter((i) => (block.type === 'chart' && s.chart === 'donut' ? i.additive : true)).filter((i) => i.source !== 'registry' || ventures || i.code === s.metric)
  const dims: Dimension[] = s.chart === 'trend' ? ['month', 'quarter'] : (ind?.breakdowns ?? []).filter((d) => !(s.chart === 'donut' && (d === 'month' || d === 'quarter')))
  const opts = useMemo(() => scopeOptions(viewer), [viewer])
  const narrowable = opts.interventions.filter((i) => report.scope.pillars.includes(i.pillar) && (!report.scope.interventions.length || report.scope.interventions.includes(i.name)))
  const ov = s.overrideInterventions ?? []

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-2 rounded-t-[calc(var(--radius-card)_-_1px)] bg-brand px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.04em]">Block settings</p>
          <p className="mt-0.5 truncate text-[11px] text-white/75">{blockTitle(block)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close settings" className="grid h-7 w-7 place-items-center rounded-md text-white/80 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
      {locked && (
        <p className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2.5 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" /> This section is locked by the template.
        </p>
      )}
      <fieldset disabled={locked} className="space-y-4 p-4">
        {block.type === 'chart' && (
          <Field label="Chart">
            <select className={`${inputCls} h-9`} value={s.chart} onChange={(e) => onSettings(chartDefaults(e.target.value as ChartKind, s))}>
              {CHART_KINDS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}
        {block.type === 'table' && (
          <Field label="Table">
            <select className={`${inputCls} h-9`} value={s.table} onChange={(e) => onSettings({ table: e.target.value as TableKind, ...(e.target.value === 'breakdown' && !s.metric ? { metric: 'reach.unique_people', breakdown: 'age_group' } : {}) })}>
              {TABLE_KINDS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}
        {block.type === 'text' && (
          <Field label="Section type" hint="Edit the words in the canvas. Use “Insert number” for live values.">
            <select className={`${inputCls} h-9`} value={s.textRole ?? 'free'} onChange={(e) => onSettings({ textRole: e.target.value as TextRole })}>
              {(Object.keys(TEXT_ROLES) as TextRole[]).map((r) => (
                <option key={r} value={r}>
                  {TEXT_ROLES[r].label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {needsMetric && (
          <Field label="Metric" hint={ind?.definition}>
            <select
              className={`${inputCls} h-9`}
              value={s.metric}
              onChange={(e) => {
                const next = indicatorByCode.get(e.target.value)!
                // Keep the breakdown if the new metric allows it; otherwise pick its first allowed one.
                const keep = !s.breakdown || next.breakdowns.includes(s.breakdown) || s.chart === 'trend'
                onSettings({ metric: next.code, ...(keep ? {} : { breakdown: next.breakdowns.find((d) => d !== 'month' && d !== 'quarter') }) })
              }}
            >
              {(['Reach', 'Intake', 'Participation', 'Feedback', 'Outcomes', 'Ventures'] as const).filter((g) => metrics.some((i) => i.group === g)).map((g) => (
                <optgroup key={g} label={g}>
                  {metrics
                    .filter((i) => i.group === g)
                    .map((i) => (
                      <option key={i.code} value={i.code}>
                        {i.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
        )}

        {needsBreakdown && (
          <Field label={s.chart === 'trend' ? 'Time unit' : 'Break down by'}>
            <select className={`${inputCls} h-9`} value={s.breakdown} onChange={(e) => onSettings({ breakdown: e.target.value as Dimension })}>
              {dims.map((d) => (
                <option key={d} value={d} disabled={isPublic && DIMENSIONS[d].sensitive}>
                  {DIMENSIONS[d].label}
                  {isPublic && DIMENSIONS[d].sensitive ? ' (hidden in Public reports)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        {rankable && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort">
              <select className={`${inputCls} h-9`} value={s.sort ?? 'value_desc'} onChange={(e) => onSettings({ sort: e.target.value as BlockSettings['sort'] })}>
                <option value="value_desc">Largest first</option>
                <option value="value_asc">Smallest first</option>
                <option value="label">A → Z</option>
              </select>
            </Field>
            <Field label="Show">
              <select className={`${inputCls} h-9`} value={s.topN ?? ''} onChange={(e) => onSettings({ topN: e.target.value ? Number(e.target.value) : null })}>
                <option value="">All rows</option>
                {[3, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {block.type === 'kpi' && (
          <>
            <Check label={`Compare with ${report.comparison === 'none' ? 'nothing (set a comparison in step 2)' : report.comparison === 'previous' ? 'the previous period' : 'the same period last year'}`} on={!!s.showComparison} disabled={report.comparison === 'none'} onChange={(v) => onSettings({ showComparison: v })} />
            <Field label="Target" hint={ind ? `Optional, in ${ind.unit === 'rate' ? '% (0–100)' : ind.unit === 'nps' ? 'NPS points' : ind.unit === 'amount' ? 'US dollars' : ind.unit === 'score' ? 'points out of 5' : 'people'}.` : undefined}>
              <input type="number" className={`${inputCls} h-9`} value={s.target ?? ''} placeholder="No target" onChange={(e) => onSettings({ target: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
          </>
        )}

        {block.type !== 'text' && (
          <div className="space-y-3 rounded-lg border border-line p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Override for this block</p>
            <Field label="Period">
              <select className={`${inputCls} h-9`} value={s.overridePreset ?? ''} onChange={(e) => onSettings({ overridePreset: (e.target.value || null) as BlockSettings['overridePreset'] })}>
                <option value="">Same as the report ({report.period.label})</option>
                {OVERRIDE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Narrow to interventions" hint={ov.length ? undefined : 'All interventions in the report’s scope.'}>
              <div className="flex flex-wrap gap-1.5">
                {narrowable.map((i) => {
                  const on = ov.includes(i.name)
                  return (
                    <button
                      key={i.name}
                      type="button"
                      onClick={() => onSettings({ overrideInterventions: on ? ov.filter((x) => x !== i.name) : [...ov, i.name] })}
                      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${on ? 'border-brand bg-brand text-white' : 'border-line text-body hover:bg-canvas'}`}
                    >
                      {i.name}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        )}

        <Field label="Caption" hint="Shown under the block. Overrides are added to it automatically.">
          <textarea className={`${inputCls} h-20 py-2`} value={block.caption} onChange={(e) => onBlock({ caption: e.target.value })} placeholder="e.g. Source: attendance records" />
        </Field>

        <Field label="Section">
          <select className={`${inputCls} h-9`} value={block.sectionId} onChange={(e) => onBlock({ sectionId: e.target.value })}>
            {sections
              .filter((x) => !x.locked || x.id === block.sectionId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
          </select>
        </Field>

        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          Scope: {report.scope.pillars.map((p) => <PillarTag key={p} pillar={p} />)} · {report.audience === 'internal' ? 'counts under 5 hidden' : 'counts under 10 hidden'}
        </p>
      </fieldset>
    </section>
  )
}

function chartDefaults(chart: ChartKind, s: BlockSettings): Partial<BlockSettings> {
  if (chart === 'trend') return { chart, metric: s.metric && indicatorByCode.get(s.metric)?.source !== 'registry' ? s.metric : 'reach.unique_people', breakdown: 'month' }
  if (chart === 'donut') {
    const m = s.metric && indicatorByCode.get(s.metric)?.additive ? s.metric : 'reach.unique_people'
    return { chart, metric: m, breakdown: s.breakdown && s.breakdown !== 'month' && s.breakdown !== 'quarter' ? s.breakdown : 'gender' }
  }
  if (chart === 'bar') return { chart, metric: s.metric ?? 'reach.unique_people', breakdown: s.breakdown && s.breakdown !== 'month' && s.breakdown !== 'quarter' ? s.breakdown : 'intervention', sort: s.sort ?? 'value_desc' }
  return { chart }
}

/* ---------- Small pieces ---------- */

function Badge({ tone, children }: { tone: 'brand' | 'muted'; children: React.ReactNode }) {
  return <span className={`inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold uppercase tracking-wide ${tone === 'brand' ? 'bg-brand-50 text-brand dark:text-brand-600' : 'bg-canvas text-muted'}`}>{children}</span>
}

function IconBtn({ label, onClick, icon: Icon, disabled, danger, small }: { label: string; onClick: (e?: React.MouseEvent) => void; icon: React.ComponentType<{ className?: string }>; disabled?: boolean; danger?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => (e.stopPropagation(), onClick(e))}
      className={`grid place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${small ? 'h-6 w-6' : 'h-8 w-8'} ${danger ? 'text-muted hover:bg-bad-bg hover:text-bad' : 'text-muted hover:bg-canvas hover:text-ink'}`}
    >
      <Icon className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </button>
  )
}

function Check({ label, on, onChange, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2.5 text-[13px] text-ink ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" className="accent-brand" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export type { Content, BlockKind }
