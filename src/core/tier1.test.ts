import { describe, expect, it } from 'vitest'
import { rankActions } from './predict'
import { sampleWorkspace } from './sample'
import { parseRanking, rankPrompt } from './tier1'

const ws = sampleWorkspace()
const actions = rankActions(ws, {})
const id = (n: number) => actions[n - 1].id

describe('rankPrompt', () => {
  it('lists every label with its number', () => {
    const prompt = rankPrompt(ws, actions)
    actions.forEach((a, i) => expect(prompt).toContain(`${i + 1}. ${a.label}`))
    expect(prompt).not.toContain('Call for help')
  })
})

describe('parseRanking', () => {
  it('maps numbers to IDs in order', () => {
    expect(parseRanking('3, 1, 2', actions)).toEqual([id(3), id(1), id(2)])
  })
  it('ignores text around the numbers', () => {
    expect(parseRanking('The best are: 2 and then 1.', actions)).toEqual([id(2), id(1)])
  })
  it('drops numbers out of range', () => {
    expect(parseRanking(`0, 1, ${actions.length + 1}, 99`, actions)).toEqual([id(1)])
  })
  it('drops duplicates', () => {
    expect(parseRanking('2, 2, 1, 2', actions)).toEqual([id(2), id(1)])
  })
  it('returns an empty list for empty output', () => {
    expect(parseRanking('', actions)).toEqual([])
  })
})
