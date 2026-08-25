/** Git workspace changes view, opened from the conversation's compact view switcher. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ConvViewProps } from '@isomoes/dsh-web-ui/client/ui-conversation/client'
import type { InjectFace, PropsLocale } from '@isomoes/dsh-web-ui/client/ui-slots'
import { IconRefreshOutline16 } from '@isomoes/dsh-web-ui/client/ui-primitives'
import type { WorkspaceChange, WorkspaceChanges } from '../workspace-changes.ts'
import css from './WorkspaceChangesView.module.css'

export interface WorkspaceChangesViewInjected {
  loadChanges: (signal: AbortSignal) => Promise<WorkspaceChanges>
}

type PatchLineKind = 'add' | 'del' | 'hunk' | 'meta' | 'plain'

interface WordSegment {
  readonly text: string
  readonly changed: boolean
}

interface PatchLine {
  readonly text: string
  readonly kind: PatchLineKind
  segments?: readonly WordSegment[]
}

function lineKind(line: string): PatchLineKind {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'del'
  return 'plain'
}

function tokens(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+/gu) ?? []
}

function appendSegment(target: WordSegment[], text: string, changed: boolean): void {
  if (text === '') return
  const previous = target.at(-1)
  if (previous?.changed === changed) target[target.length - 1] = { text: previous.text + text, changed }
  else target.push({ text, changed })
}

/** Mark token-level edits for one removed/added line pair. */
function wordDiff(before: string, after: string): readonly [readonly WordSegment[], readonly WordSegment[]] {
  const left = tokens(before)
  const right = tokens(after)
  if (left.length * right.length > 40_000) {
    return [[{ text: before, changed: true }], [{ text: after, changed: true }]]
  }
  const width = right.length + 1
  const table = new Uint16Array((left.length + 1) * width)
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i * width + j] = left[i] === right[j]
        ? (table[(i + 1) * width + j + 1] ?? 0) + 1
        : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0)
    }
  }
  const removed: WordSegment[] = []
  const added: WordSegment[] = []
  let i = 0
  let j = 0
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      appendSegment(removed, left[i] ?? '', false)
      appendSegment(added, right[j] ?? '', false)
      i++
      j++
    } else if (j < right.length && (i >= left.length || (table[i * width + j + 1] ?? 0) >= (table[(i + 1) * width + j] ?? 0))) {
      appendSegment(added, right[j] ?? '', true)
      j++
    } else {
      appendSegment(removed, left[i] ?? '', true)
      i++
    }
  }
  return [removed, added]
}

const MAX_RENDERED_PATCH_LINES = 2_000
const AUTO_EXPAND_PATCH_BYTES = 64 * 1024

interface ParsedPatch {
  readonly lines: PatchLine[]
  readonly truncated: boolean
}

function patchLines(patch: string): ParsedPatch {
  const result: PatchLine[] = []
  let offset = 0
  let truncated = false
  // Parse only the visible prefix. String.split() would allocate an entry for
  // every line in a huge patch before React gets a chance to collapse it.
  while (offset < patch.length) {
    const newline = patch.indexOf('\n', offset)
    const end = newline === -1 ? patch.length : newline
    const text = patch.slice(offset, end)
    offset = newline === -1 ? patch.length : newline + 1
    if (text.startsWith('diff --git') || text.startsWith('index ')
      || text.startsWith('--- ') || text.startsWith('+++ ')) continue
    if (result.length >= MAX_RENDERED_PATCH_LINES) {
      truncated = true
      break
    }
    result.push({ text, kind: lineKind(text) })
  }
  for (let index = 0; index < result.length;) {
    if (result[index]?.kind !== 'del') {
      index++
      continue
    }
    const removedStart = index
    while (result[index]?.kind === 'del') index++
    const addedStart = index
    while (result[index]?.kind === 'add') index++
    const pairs = Math.min(addedStart - removedStart, index - addedStart)
    for (let offset = 0; offset < pairs; offset++) {
      const removed = result[removedStart + offset]
      const added = result[addedStart + offset]
      if (removed === undefined || added === undefined) continue
      const [removedSegments, addedSegments] = wordDiff(removed.text.slice(1), added.text.slice(1))
      removed.segments = removedSegments
      added.segments = addedSegments
    }
  }
  return { lines: result, truncated }
}

const LINE_CLASS: Record<PatchLineKind, string | undefined> = {
  add: css.add,
  del: css.del,
  hunk: css.hunk,
  meta: css.meta,
  plain: undefined,
}

function ChangeFile({
  change, label, noTextDiff, truncatedText,
}: { change: WorkspaceChange; label: string; noTextDiff: string; truncatedText: string }) {
  const [open, setOpen] = useState(() => change.patchTruncated !== true && change.patch.length <= AUTO_EXPAND_PATCH_BYTES)
  const parsed = useMemo(() => open ? patchLines(change.patch) : null, [change.patch, open])
  const lines = parsed?.lines ?? []
  return (
    <details className={css.file} open={open} onToggle={event => { setOpen(event.currentTarget.open) }}>
      <summary className={css.fileHeader}>
        <span className={css.path} title={change.path}>
          {change.previousPath === undefined ? change.path : `${change.previousPath} → ${change.path}`}
        </span>
        <span className={css.status} data-status={change.status}>{label}</span>
      </summary>
      <div className={css.patch} role="region" aria-label={change.path}>
        {lines.length === 0
          ? <div className={css.noPatch}>{noTextDiff}</div>
          : lines.map((line, index) => (
              <div key={index} className={`${css.line}${LINE_CLASS[line.kind] === undefined ? '' : ` ${LINE_CLASS[line.kind]}`}`}>
                {line.segments === undefined
                  ? line.text || ' '
                  : <><span>{line.kind === 'add' ? '+' : '-'}</span>{line.segments.map((segment, segmentIndex) => (
                      <span key={segmentIndex} className={segment.changed ? css.wordChanged : undefined}>{segment.text}</span>
                    ))}</>}
              </div>
            ))}
        {(change.patchTruncated === true || parsed?.truncated === true) && (
          <div className={css.fileTruncated}>{truncatedText}</div>
        )}
      </div>
    </details>
  )
}

export function WorkspaceChangesView({
  loadChanges, t,
}: ConvViewProps & InjectFace<WorkspaceChangesViewInjected> & PropsLocale<'workspace'>) {
  const [changes, setChanges] = useState<WorkspaceChanges | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => { setRevision(value => value + 1) }, [])

  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    setError(null)
    void loadChanges(abort.signal).then(
      value => {
        if (!abort.signal.aborted) setChanges(value)
      },
      (reason: unknown) => {
        if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
      },
    ).finally(() => {
      if (!abort.signal.aborted) setLoading(false)
    })
    return () => { abort.abort() }
  }, [loadChanges, revision])

  const count = changes?.files.length ?? 0
  return (
    <section className={css.root} data-conversation-composer-overlay="">
      <div className={css.toolbar}>
        <div className={css.heading}>
          <strong>{t('changes.title')}</strong>
          {!loading && changes?.repository === true && <span className={css.count}>{t('changes.count', { n: count })}</span>}
        </div>
        <button
          type="button"
          className={css.refresh}
          title={t('changes.refresh')}
          aria-label={t('changes.refresh')}
          disabled={loading}
          onClick={refresh}
        >
          <IconRefreshOutline16 size={16} />
        </button>
      </div>
      <div className={css.scroller}>
        <div className={css.content}>
          {loading && changes === null && <div className={css.state}>{t('changes.loading')}</div>}
          {error !== null && <div className={`${css.state} ${css.error}`}>{error}</div>}
          {!loading && error === null && changes?.repository === false && <div className={css.state}>{t('changes.notRepository')}</div>}
          {!loading && error === null && changes?.repository === true && changes.files.length === 0 && (
            <div className={css.state}>{t('changes.empty')}</div>
          )}
          {changes?.repository === true && changes.files.map(change => (
            <ChangeFile
              key={`${change.previousPath ?? ''}\0${change.path}`}
              change={change}
              label={t(`changes.status.${change.status}`)}
              noTextDiff={t('changes.noTextDiff')}
              truncatedText={t('changes.fileTruncated')}
            />
          ))}
          {changes?.truncated === true && <div className={css.truncated}>{t('changes.truncated')}</div>}
        </div>
      </div>
    </section>
  )
}
