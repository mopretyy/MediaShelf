import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { CollectionDetail, CollectionSummary } from '@shared/types.ts'
import { api, get, query } from './api'
import { useUser } from './queries'

export const collectionsKey = ['collections'] as const

/** Lists, details and profiles all show collections: refresh them together after a change. */
function refresh(client: QueryClient) {
  void client.invalidateQueries({ queryKey: collectionsKey })
  void client.invalidateQueries({ queryKey: ['profile'] })
}

/** The signed-in user's collections; with a title, which of them hold it. */
export function useCollections(titleId?: string) {
  const user = useUser()
  return useQuery({
    queryKey: [...collectionsKey, 'mine', user?.id ?? null, titleId ?? null] as const,
    queryFn: ({ signal }) =>
      get<{ collections: CollectionSummary[] }>(`/collections${query({ titleId })}`, signal).then(
        (data) => data.collections,
      ),
    enabled: Boolean(user),
    staleTime: 60_000,
  })
}

export function useCollection(id: string | undefined) {
  const user = useUser()
  return useQuery({
    queryKey: [...collectionsKey, 'one', id] as const,
    queryFn: ({ signal }) =>
      get<{ collection: CollectionDetail }>(`/collections/${id}`, signal).then(
        (data) => data.collection,
      ),
    enabled: Boolean(user && id),
    staleTime: 30_000,
    retry: (count, error) => count < 1 && (error as { status?: number }).status !== 404,
  })
}

export function useCreateCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      api<{ collection: CollectionSummary }>('POST', '/collections', input).then(
        (data) => data.collection,
      ),
    onSuccess: () => refresh(client),
  })
}

export function useUpdateCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string
      name?: string
      description?: string
      coverTitleId?: string | null
    }) =>
      api<{ collection: CollectionSummary }>('PATCH', `/collections/${id}`, input).then(
        (data) => data.collection,
      ),
    onSuccess: () => refresh(client),
  })
}

export function useDeleteCollection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api('DELETE', `/collections/${id}`),
    onSuccess: () => refresh(client),
  })
}

/** Puts a title into a collection or takes it out. */
export function useCollectionItem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, titleId, inside }: { id: string; titleId: string; inside: boolean }) =>
      (inside
        ? api<{ collection: CollectionSummary }>('POST', `/collections/${id}/items`, { titleId })
        : api<{ collection: CollectionSummary }>(
            'DELETE',
            `/collections/${id}/items/${encodeURIComponent(titleId)}`,
          )
      ).then((data) => data.collection),
    onSuccess: () => refresh(client),
  })
}
