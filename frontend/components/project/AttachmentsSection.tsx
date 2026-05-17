'use client';

import React, { useState } from 'react';
import { Project } from '@/lib/types';
import { projectAPI, uploadAPI } from '@/lib/api-service';
import { toast } from 'sonner';
import { useApp } from '@/contexts/useApp';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Paperclip, Plus, Trash2, Upload, Download,
  FileText, FileSpreadsheet, FileImage, File, Archive, Presentation,
} from 'lucide-react';

interface AttachmentsSectionProps {
  project: Project;
}

/** Map a filename to an attachment type */
function getAttachmentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(ext)) return 'document';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'spreadsheet';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'presentation';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'other';
}

/** Get the right icon component for a file type */
function getFileIcon(type: string) {
  switch (type) {
    case 'image':        return { Icon: FileImage, bg: 'bg-accent-soft', text: 'text-accent' };
    case 'pdf':          return { Icon: FileText, bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400' };
    case 'document':     return { Icon: FileText, bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400' };
    case 'spreadsheet':  return { Icon: FileSpreadsheet, bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400' };
    case 'presentation': return { Icon: Presentation, bg: 'bg-accent-soft', text: 'text-accent' };
    case 'archive':      return { Icon: Archive, bg: 'bg-surface-3', text: 'text-fg-3' };
    default:             return { Icon: File, bg: 'bg-surface-3', text: 'text-fg-3' };
  }
}

/** Format file size */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({ project }: AttachmentsSectionProps) {
  const { state, dispatch } = useApp();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleRemoveSelected = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length });

      try {
        const uploadResult = await uploadAPI.uploadFile(file, 'attachments');
        if (!uploadResult) {
          failCount++;
          continue;
        }

        const fileType = getAttachmentType(file.name);
        const result = await projectAPI.addAttachment(project.id, {
          filename: file.name,
          url: uploadResult.publicUrl,
          key: uploadResult.key,
          type: fileType,
          size: file.size,
        });

        if (result.success) {
          const savedAttachment = result.data.attachment;
          dispatch({
            type: 'ADD_ATTACHMENT',
            payload: {
              projectId: project.id,
              attachment: {
                id: savedAttachment.id,
                filename: savedAttachment.filename,
                type: (savedAttachment.type || fileType) as any,
                url: savedAttachment.url,
                uploadedAt: new Date(savedAttachment.uploadedAt || savedAttachment.createdAt || Date.now()),
              },
              userId: state.currentUser?.id || '',
            },
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        failCount++;
      }
    }

    if (successCount > 0) toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`);
    if (failCount > 0) toast.error(`${failCount} file${failCount > 1 ? 's' : ''} failed to upload`);

    setSelectedFiles([]);
    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      await projectAPI.removeAttachment(project.id, attachmentId);
      toast.success('Attachment removed');
    } catch (error) {
      console.error('Error removing attachment:', error);
      toast.error('Failed to remove attachment');
    }

    dispatch({
      type: 'REMOVE_ATTACHMENT',
      payload: {
        projectId: project.id,
        attachmentId,
        userId: state.currentUser?.id || '',
      },
    });
  };

  const handleDownloadAttachment = async (attachment: typeof project.attachments[0]) => {
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(attachment.url, '_blank');
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-3">
        {/* Upload area */}
        <div className="border border-dashed border-border rounded-xl p-5 space-y-3 bg-surface-2 transition-colors hover:border-accent-line">
          <Label className="text-sm font-medium text-fg-2">
            Upload Files
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.pptx,.ppt,.csv,.rtf,.zip,.rar,.7z,.odt,.ods,.odp,.md"
          />
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 rounded-lg text-fg-2 border-border hover:border-accent-line hover:text-accent transition-all duration-200"
            >
              <Upload className="w-4 h-4 mr-2" />
              {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected` : 'Choose Files'}
            </Button>
            {selectedFiles.length > 0 && (
              <Button
                onClick={handleUploadAll}
                disabled={isUploading}
                className="rounded-lg bg-accent hover:bg-accent/90 text-accent-fg transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-1" />
                {isUploading
                  ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
                  : `Upload ${selectedFiles.length}`}
              </Button>
            )}
          </div>

          {/* Selected files preview */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {selectedFiles.map((file, index) => {
                const fileType = getAttachmentType(file.name);
                const { Icon, bg, text } = getFileIcon(fileType);
                return (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface border border-border">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`p-1.5 rounded-lg ${bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${text}`} />
                      </div>
                      <span className="text-xs font-medium text-fg-2 truncate">{file.name}</span>
                      <span className="text-[10px] text-fg-4 whitespace-nowrap">{formatSize(file.size)}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveSelected(index)}
                      className="text-fg-4 hover:text-red-500 transition-colors ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload progress bar */}
          {isUploading && (
            <div className="space-y-1">
              <div className="w-full bg-surface-3 rounded-full h-1.5">
                <div
                  className="bg-accent h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-fg-3 text-center">
                Uploading {uploadProgress.current} of {uploadProgress.total}…
              </p>
            </div>
          )}
        </div>

        {/* Existing attachments */}
        {project.attachments.length === 0 ? (
          <div className="text-center py-8 text-fg-4">
            <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No attachments yet</p>
            <p className="text-xs mt-1">Upload documents, images, spreadsheets, and more</p>
          </div>
        ) : (
          <div className="space-y-2">
            {project.attachments.map((attachment) => {
              const { Icon, bg, text } = getFileIcon(attachment.type);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 border border-border rounded-xl bg-surface hover:bg-surface-2 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${bg}`}>
                      <Icon className={`w-4 h-4 ${text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{attachment.filename}</p>
                      <p className="text-xs text-fg-4">
                        {new Date(attachment.uploadedAt).toLocaleDateString()} at {new Date(attachment.uploadedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(attachment.url, '_blank')}
                      className="text-accent hover:text-accent hover:bg-accent-soft rounded-lg"
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadAttachment(attachment)}
                      className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
