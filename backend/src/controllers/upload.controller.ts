import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generatePresignedUploadUrl, getPublicUrl, deleteFromR2 } from '../utils/r2';

// Allowed mime types
const ALLOWED_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp', 'image/x-icon',
  // Documents
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/markdown', 'application/rtf',
  // Spreadsheets
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'application/vnd.oasis.opendocument.spreadsheet',
  // Presentations
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/gzip', 'application/x-tar',
  // Other docs
  'application/vnd.oasis.opendocument.text',
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * POST /api/upload/presign
 * Body: { filename: string, contentType: string, fileSize: number, folder?: string }
 * Returns a presigned PUT URL + the final public CDN URL the client should store after upload.
 */
export async function getPresignedUrl(req: Request, res: Response): Promise<void> {
  try {
    const { filename, contentType, fileSize, folder = 'uploads' } = req.body;

    if (!filename || !contentType || !fileSize) {
      res.status(400).json({ success: false, message: 'filename, contentType and fileSize are required' });
      return;
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      res.status(400).json({ success: false, message: `Unsupported file type: ${contentType}` });
      return;
    }

    if (fileSize > MAX_FILE_SIZE) {
      res.status(400).json({ success: false, message: 'File too large. Max size is 25 MB' });
      return;
    }

    // Build a unique key: folder/uuid.ext
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin';
    const key = `${folder}/${uuidv4()}.${ext}`;

    const uploadUrl = await generatePresignedUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);

    res.status(200).json({
      success: true,
      uploadUrl,   // PUT to this URL with the file as body
      publicUrl,   // Store this URL in DB after successful upload
      key,
    });
  } catch (err) {
    console.error('Presign error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate upload URL' });
  }
}

/**
 * DELETE /api/upload
 * Body: { key: string }
 * Deletes an object from R2 (e.g. when replacing a project image).
 */
export async function deleteUpload(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.body;

    if (!key) {
      res.status(400).json({ success: false, message: 'key is required' });
      return;
    }

    // Verify the caller has access — the key must belong to an attachment on a project they're assigned to,
    // or be a project cover image. Allow PM/TL/PRODUCTION roles to delete any file.
    if (req.user && !['PM', 'TL', 'PRODUCTION'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions to delete files' });
      return;
    }

    await deleteFromR2(key);
    res.status(200).json({ success: true, message: 'File deleted' });
  } catch (err) {
    console.error('Delete upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
}
