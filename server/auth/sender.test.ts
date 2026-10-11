import { describe, expect, it } from 'vitest'
import { brandedSender } from './verification.ts'

describe('brandedSender', () => {
  it('replaces an old display name with MediaShell', () => {
    expect(brandedSender('Media Deck <codes@example.com>')).toEqual({
      name: 'MediaShell',
      address: 'codes@example.com',
    })
  })

  it('names a bare address MediaShell', () => {
    expect(brandedSender(' codes@example.com ')).toEqual({
      name: 'MediaShell',
      address: 'codes@example.com',
    })
  })
})
