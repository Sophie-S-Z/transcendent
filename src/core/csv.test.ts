import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('quotes cells and stops formulas', () => {
    expect(toCsv(['time', 'label'], [['t', '=SUM("a")']])).toBe(`time,label\n"t","'=SUM(""a"")"`)
  })
})
