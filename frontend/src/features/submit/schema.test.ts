import { describe, expect, it } from 'vitest'
import { MSG, textProblem, titleProblem } from './schema'

describe('titleProblem', () => {
  it.each([
    ['', MSG.titleRequired],
    ['ab', MSG.titleTooShort],
    ['a'.repeat(201), MSG.titleTooLong],
    ['Line one\nline two', MSG.titleSingleLine],
    ['Bad\u0000title', MSG.titleSingleLine],
    ['!!! --- ???', MSG.titleNoAlnum],
    ['a'.repeat(61), MSG.titleLongWord],
  ])('rejects %j', (title, message) => {
    expect(titleProblem(title)).toBe(message)
  })

  it.each(['Q3 vendor contract', 'Résumé für Q3', '契約書 第2版', '🚀 Launch plan', 'x'.repeat(60)])('accepts %j', (title) => {
    expect(titleProblem(title)).toBeNull()
  })
})

describe('textProblem', () => {
  it.each([
    ['', MSG.contentRequired],
    ['Too short', MSG.textTooShort],
    ['a '.repeat(25_001).trim() + 'b', MSG.textTooLong],
    ['Hello\u0007world, how are you', MSG.textControl],
    ['!!!!!!!!!!!! ??????', MSG.textNoAlnum],
    ['Intro ' + 'A'.repeat(501), MSG.textLongWord],
  ])('rejects %j', (text, message) => {
    expect(textProblem(text)).toBe(message)
  })

  it('accepts tabs, newlines and a long-ish URL', () => {
    expect(textProblem('Line one\n\tIndented\r\nSee https://example.com/' + 'p'.repeat(400))).toBeNull()
  })
})
