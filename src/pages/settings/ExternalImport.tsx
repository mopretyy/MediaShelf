import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, FileUp } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import type { LibraryEntry } from '@shared/types.ts'
import { useErrorMessage } from '@/components/library-actions'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { api, get } from '@/lib/api'
import { convertExternal, toImportPayload } from '@/lib/external-import'
import { keys } from '@/lib/queries'
import { cn } from '@/lib/cn'

/** Mirrors the server's body limit for /me/import (the converted JSON is what gets sent). */
const MAX_FILE_BYTES = 25 * 1024 * 1024

/** Text of an export file; MyAnimeList ships its XML gzipped. */
async function readText(file: File) {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  if (head[0] === 0x1f && head[1] === 0x8b && 'DecompressionStream' in window)
    return new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text()
  return file.text()
}

/** Settings → Data: lists from MyAnimeList, Shikimori and IMDb, through the regular import. */
export function ExternalImportButton() {
  const { t } = useI18n()
  const client = useQueryClient()
  const message = useErrorMessage()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again still fires `change`.
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_BYTES) return void toast.error(t('errors.PAYLOAD_TOO_LARGE'))
    setBusy(true)
    try {
      const converted = convertExternal(await readText(file))
      if (!converted) return void toast.error(t('externalImport.unknownFile'))
      if (!converted.entries.length) return void toast(t('externalImport.nothing'))
      // Fresh, not cached: entries already in the library are never overwritten.
      const { entries } = await get<{ entries: LibraryEntry[] }>('/library')
      const { payload, existing } = toImportPayload(
        converted,
        new Set(entries.map((entry) => entry.titleId)),
      )
      const result = payload.entries.length
        ? await api<{ imported: number; skipped: number }>('POST', '/me/import', payload)
        : { imported: 0, skipped: 0 }
      toast(t('externalImport.done', { imported: result.imported }), {
        description: t('externalImport.doneDetails', {
          existing,
          skipped: converted.skipped + result.skipped,
        }),
        duration: 8000,
      })
      const refresh = () => {
        for (const queryKey of [keys.library, keys.stats, keys.activity, ['marks'], ['airing']])
          void client.invalidateQueries({ queryKey })
      }
      refresh()
      // The server fills in names and artwork in the background; pick them up as they land.
      if (result.imported) for (const delay of [15_000, 45_000, 120_000]) setTimeout(refresh, delay)
    } catch (error) {
      toast.error(message(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xml,.gz,.csv,text/xml,text/csv,application/xml,application/gzip"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onFile(event)}
      />
      <Button variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
        <FileUp />
        {t('externalImport.action')}
      </Button>
    </>
  )
}

/** Short how-to under the row, folded by default. */
export function ExternalImportHelp() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded-sm text-sm text-fg-2 hover:text-fg pointer-coarse:-my-2.5 pointer-coarse:min-h-10"
      >
        {t('externalImport.howTo')}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul className="mt-2 grid gap-1.5 text-sm text-fg-2">
          <li>{t('externalImport.malHow')}</li>
          <li>{t('externalImport.shikimoriHow')}</li>
          <li>{t('externalImport.imdbHow')}</li>
        </ul>
      ) : null}
    </div>
  )
}
