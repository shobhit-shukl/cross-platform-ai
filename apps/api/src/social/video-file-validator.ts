import { open } from 'fs/promises';

export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

interface DetectedFormat {
  mimeType: string;
  extension: string;
}

/**
 * Sniffs the first bytes of a file to identify its real container format, rather than
 * trusting the client-supplied Content-Type/extension (which are trivial to spoof).
 * Covers the video formats CrossPost AI accepts for upload.
 */
export function detectVideoFormat(buffer: Buffer): DetectedFormat | null {
  // ISO base media (MP4/MOV/M4V): "ftyp" box at byte offset 4.
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).trim().toLowerCase();
    if (brand.startsWith('qt')) {
      return { mimeType: 'video/quicktime', extension: 'mov' };
    }
    return { mimeType: 'video/mp4', extension: 'mp4' };
  }

  // WebM/Matroska: EBML header.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { mimeType: 'video/webm', extension: 'webm' };
  }

  // AVI: RIFF....AVI  container.
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 11) === 'AVI'
  ) {
    return { mimeType: 'video/x-msvideo', extension: 'avi' };
  }

  return null;
}

export type VideoValidationResult = { ok: true; mimeType: string } | { ok: false; reason: string };

export async function validateVideoFile(
  filePath: string,
  declaredSizeBytes: number,
): Promise<VideoValidationResult> {
  if (declaredSizeBytes <= 0) {
    return { ok: false, reason: 'The uploaded file is empty' };
  }
  if (declaredSizeBytes > MAX_VIDEO_SIZE_BYTES) {
    return { ok: false, reason: `Video exceeds the ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)}MB limit` };
  }

  // Only the first 32 bytes are needed to identify any of the supported containers.
  const handle = await open(filePath, 'r');
  let header: Buffer;
  try {
    const buf = Buffer.alloc(32);
    const { bytesRead } = await handle.read(buf, 0, 32, 0);
    header = buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }

  const format = detectVideoFormat(header);
  if (!format) {
    return {
      ok: false,
      reason: 'Unrecognized video format. Supported formats: MP4, MOV, WebM, AVI.',
    };
  }

  return { ok: true, mimeType: format.mimeType };
}
