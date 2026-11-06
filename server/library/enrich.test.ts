import { describe, expect, it, vi } from 'vitest'
import { convertImdbCsv } from '../../src/lib/external-import.ts'
import { registerAccount, testApp } from '../test-utils.ts'

const CSV = [
  'Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres',
  'tt0816692,9,2024-05-02,Interstellar (stub),https://www.imdb.com/title/tt0816692/,Movie,8.7,169,2014,"Adventure, Drama"',
].join('\n')

describe('import from other services', () => {
  it('imports converted entries and replaces the stubs with catalog records in the background', async () => {
    const t = testApp()
    await registerAccount(t, {
      name: 'Ира',
      email: 'ira@example.com',
      password: 'correct horse 42',
    })
    const file = convertImdbCsv(CSV)
    const res = await t.request('POST', '/api/me/import', {
      format: 'mediashelf',
      version: 4,
      entries: file.entries,
    })
    expect(res.body).toEqual({ imported: 1, skipped: 0 })

    const entry = (await t.request('GET', '/api/library/movie-tt0816692')).body.entry
    expect(entry).toMatchObject({ status: 'completed', rating: 9 })

    // The stub came from the file; the fake catalog's record replaces it shortly after.
    await vi.waitFor(() => {
      const row = t.db
        .prepare('SELECT verified, data FROM titles WHERE id = ?')
        .get('movie-tt0816692') as { verified: number; data: string }
      expect(row.verified).toBe(1)
      expect(JSON.parse(row.data).names.original).toBe('Interstellar')
    })
  })
})
