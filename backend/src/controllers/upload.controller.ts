import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generatePresignedUploadUrl, getPublicUrl, deleteFromR2 } from '../utils/r2';

// Allowed image mime types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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
      res.status(400).json({ success: false, message: 'File too large. Max size is 10 MB' });
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

    await deleteFromR2(key);
    res.status(200).json({ success: true, message: 'File deleted' });
  } catch (err) {
    console.error('Delete upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete file' });
  }
}
