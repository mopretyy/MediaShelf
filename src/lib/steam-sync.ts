import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from './api'
import { keys, useUser } from './queries'

interface SyncResult {
  synced: boolean
  imported?: number
  updated?: number
  resumed?: number
  paused?: number
}

/**
 * Keeps a linked Steam library fresh without a button: asks the server once per app load and
 * the server decides whether the last sync is old enough. Failures stay silent.
 */
export function useSteamAutoSync() {
  const user = useUser()
  const client = useQueryClient()
  const userId = user?.id
  const steamId = user?.preferences.steamId
  const started = useRef<string | null>(null)
  useEffect(() => {
    if (!userId || !steamId || started.current === userId) return
    started.current = userId
    api<SyncResult>('POST', '/me/steam/sync')
      .then((result) => {
        const changed =
          (result.imported ?? 0) +
          (result.updated ?? 0) +
          (result.resumed ?? 0) +
          (result.paused ?? 0)
        if (!result.synced || changed === 0) return
        for (const queryKey of [keys.library, keys.stats, keys.activity])
          void client.invalidateQueries({ queryKey })
      })
      .catch(() => undefined)
  }, [userId, steamId, client])
}
