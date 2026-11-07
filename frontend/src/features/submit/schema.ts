import { z } from 'zod'

export const MAX_TITLE = 200
export const MAX_TEXT = 50_000
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.md']

export const MSG = {
  titleRequired: 'Title is required.',
  titleTooLong: `Title must be at most ${MAX_TITLE} characters.`,
  contentRequired: 'Provide a file or text.',
  textTooLong: 'Text must be at most 50,000 characters.',
  fileEmpty: 'File is empty.',
  fileTooLarge: 'File must be at most 5 MB.',
  fileType: 'Unsupported file type. Allowed: PDF, PNG, JPEG, TXT, MD.',
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
    const title = values.title.trim()
    if (!title) ctx.addIssue({ code: 'custom', path: ['title'], message: MSG.titleRequired })
    else if (title.length > MAX_TITLE) ctx.addIssue({ code: 'custom', path: ['title'], message: MSG.titleTooLong })
    if (values.mode === 'text') {
      const text = values.text.trim()
      if (!text) ctx.addIssue({ code: 'custom', path: ['text'], message: MSG.contentRequired })
      else if (text.length > MAX_TEXT) ctx.addIssue({ code: 'custom', path: ['text'], message: MSG.textTooLong })
    } else if (!values.file) {
      ctx.addIssue({ code: 'custom', path: ['file'], message: MSG.contentRequired })
    } else {
      const problem = checkFile(values.file)
      if (problem) ctx.addIssue({ code: 'custom', path: ['file'], message: problem })
    }
  })

export type SubmitValues = z.infer<typeof submitSchema>
