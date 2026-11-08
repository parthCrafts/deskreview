import { z } from 'zod'
import { hasControlChars, hasLetterOrNumber, hasLineBreak, longestWord } from '@/lib/validation'

export const MIN_TITLE = 3
export const MAX_TITLE = 200
export const MAX_TITLE_WORD = 60
export const MIN_TEXT = 10
export const MAX_TEXT = 50_000
export const MAX_TEXT_WORD = 500
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.md']

export const MSG = {
  titleRequired: 'Title is required.',
  titleTooShort: `Title must be at least ${MIN_TITLE} characters.`,
  titleTooLong: `Title must be at most ${MAX_TITLE} characters.`,
  titleSingleLine: 'Title must be a single line without special control characters.',
  titleNoAlnum: 'Title must include at least one letter or number.',
  titleLongWord: `Title has a word longer than ${MAX_TITLE_WORD} characters. Add spaces.`,
  contentRequired: 'Provide a file or text.',
  textTooShort: `Text must be at least ${MIN_TEXT} characters so a reviewer has something to read.`,
  textTooLong: 'Text must be at most 50,000 characters.',
  textControl: 'Text contains control characters. Paste it as plain text.',
  textNoAlnum: 'Text must include letters or numbers.',
  textLongWord: `Text has an unbroken run longer than ${MAX_TEXT_WORD} characters. Is it pasted data rather than a document?`,
  fileEmpty: 'File is empty.',
  fileTooLarge: 'File must be at most 5 MB.',
  fileType: 'Unsupported file type. Allowed: PDF, PNG, JPEG, TXT, MD.',
}

/** The first rule a trimmed title breaks, or null. Mirrors the server. */
export function titleProblem(title: string): string | null {
  if (!title) return MSG.titleRequired
  if (title.length > MAX_TITLE) return MSG.titleTooLong
  if (title.length < MIN_TITLE) return MSG.titleTooShort
  if (hasLineBreak(title) || hasControlChars(title)) return MSG.titleSingleLine
  if (!hasLetterOrNumber(title)) return MSG.titleNoAlnum
  if (longestWord(title) > MAX_TITLE_WORD) return MSG.titleLongWord
  return null
}

/** The first rule trimmed document text breaks, or null. Mirrors the server. */
export function textProblem(text: string): string | null {
  if (!text) return MSG.contentRequired
  if (text.length > MAX_TEXT) return MSG.textTooLong
  if (text.length < MIN_TEXT) return MSG.textTooShort
  if (hasControlChars(text)) return MSG.textControl
  if (!hasLetterOrNumber(text)) return MSG.textNoAlnum
  if (longestWord(text) > MAX_TEXT_WORD) return MSG.textLongWord
  return null
}

/** Client-side file checks mirroring the server; returns an error message or null. */
export function checkFile(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) return MSG.fileType
  if (file.size === 0) return MSG.fileEmpty
  if (file.size > MAX_FILE_BYTES) return MSG.fileTooLarge
  return null
}

export const submitSchema = z
  .object({
    title: z.string(),
    mode: z.enum(['file', 'text']),
    text: z.string(),
    file: z.instanceof(File).nullable(),
  })
  .superRefine((values, ctx) => {
    const title = titleProblem(values.title.trim())
    if (title) ctx.addIssue({ code: 'custom', path: ['title'], message: title })
    if (values.mode === 'text') {
      const text = textProblem(values.text.trim())
      if (text) ctx.addIssue({ code: 'custom', path: ['text'], message: text })
    } else if (!values.file) {
      ctx.addIssue({ code: 'custom', path: ['file'], message: MSG.contentRequired })
    } else {
      const problem = checkFile(values.file)
      if (problem) ctx.addIssue({ code: 'custom', path: ['file'], message: problem })
    }
  })

export type SubmitValues = z.infer<typeof submitSchema>
