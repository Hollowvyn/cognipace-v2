import { describe, expect, it } from 'vitest'

import {
  assertCanCallExtensionMethod,
  canCallExtensionMethod,
  isExtensionMethod,
} from './runtime-policy'

describe('runtime-policy', () => {
  it('allows popup shell data reads', () => {
    expect(canCallExtensionMethod('app.getShellData', 'popup')).toBe(true)
  })

  it('rejects unknown methods', () => {
    expect(isExtensionMethod('unknown.method')).toBe(false)
    expect(canCallExtensionMethod('unknown.method', 'popup')).toBe(false)
  })

  it('throws for unauthorized surfaces', () => {
    expect(() =>
      assertCanCallExtensionMethod('app.getShellData', 'background'),
    ).toThrow(/not allowed/)
  })
})
