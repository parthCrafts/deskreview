/** Text rules shared by forms; they mirror backend/apps/documents/validation.py. */

// Control characters other than tab, newline and carriage return (NUL, backspace, ESC, ...).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const LINE_BREAK = /[\t\r\n]/
const ALNUM = /[\p{L}\p{N}]/u

/** Whether the text contains control characters (tab and newlines are fine). */
export function hasControlChars(text: string): boolean {
  return CONTROL.test(text)
}

/** Whether the text contains a tab or a line break. */
export function hasLineBreak(text: string): boolean {
  return LINE_BREAK.test(text)
}

/** Whether the text has at least one letter or number, in any script. */
export function hasLetterOrNumber(text: string): boolean {
  return ALNUM.test(text)
}

/** Length of the longest run of non-space characters. */
export function longestWord(text: string): number {
  return text.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0)
}
