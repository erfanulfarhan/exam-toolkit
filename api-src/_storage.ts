import { S3Client } from '@aws-sdk/client-s3'

/**
 * Object storage for the paper library.
 *
 * S3-compatible rather than provider-specific, so the same code runs against
 * Cloudflare R2 or Backblaze B2 with nothing but the endpoint changed. Files are
 * read and written through these functions rather than presigned URLs, which
 * keeps the bucket private and means there is no CORS policy to configure.
 */

export const BUCKET = process.env.S3_BUCKET || ''

export function configured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    BUCKET,
  )
}

export function client(): S3Client {
  return new S3Client({
    // R2 ignores the region but the SDK insists on one being present.
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,
    // R2 and B2 both address buckets by path, not by subdomain.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  })
}

/**
 * Keys are `<level>/<subject>/…/<filename>`.
 *
 * The subject is the second segment rather than the file's immediate parent,
 * because archives commonly nest a session folder underneath it, as in
 * IAL/Physics/2010 june/6PH05_01_que_20100629.pdf.
 */
export function splitKey(key: string) {
  const parts = key.split('/').filter(Boolean)
  const name = parts[parts.length - 1] || key
  if (parts.length >= 3) return { level: parts[0], subject: parts[1], name }
  if (parts.length === 2) return { level: '', subject: parts[0], name }
  return { level: '', subject: 'Papers', name }
}

/** Reject anything that would climb out of the bucket prefix. */
export function safeKey(key: unknown): string | null {
  if (typeof key !== 'string' || !key) return null
  if (key.includes('..') || key.startsWith('/')) return null
  if (!/\.pdf$/i.test(key)) return null
  return key
}
