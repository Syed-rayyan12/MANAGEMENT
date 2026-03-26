'use client';

import React, { useState } from 'react';
import { Project } from '@/lib/types';
import { projectAPI, uploadAPI } from '@/lib/api-service';
import { toast } from 'sonner';
import { useApp } from '@/contexts/useApp';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Paperclip, Plus, Trash2, Upload, Download } from 'lucide-react';

interface AttachmentsSectionProps {
  project: Project;
}

export function AttachmentsSection({ project }: AttachmentsSectionProps) {
  const { dispatch } = useApp();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAddAttachment = async () => {
    if (selectedFile) {
      const loadingToast = toast.loading('Uploading file...');
      try {
        const uploadResult = await uploadAPI.uploadFile(selectedFile, 'attachments');
        if (!uploadResult) {
          toast.dismiss(loadingToast);
          toast.error('File upload failed');
          return;
        }

        const result = await projectAPI.addAttachment(project.id, {
          filename: selectedFile.name,
          url: uploadResult.publicUrl,
          key: uploadResult.key,
          type: selectedFile.type.includes('pdf') ? 'pdf' : 'image',
          size: selectedFile.size,
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
                type: savedAttachment.type?.includes('pdf') ? 'pdf' : 'image',
                url: savedAttachment.url,
                uploadedAt: new Date(savedAttachment.createdAt),
              },
              userId: project.pm,
            },
          });
          toast.dismiss(loadingToast);
          toast.success('File uploaded successfully');
        }
      } catch (error) {
        console.error('Error uploading attachment:', error);
        toast.dismiss(loadingToast);
        toast.error('Failed to upload file');
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
        userId: project.pm,
      },
    });
  };

  const handleDownloadAttachment = (attachment: typeof project.attachments[0]) => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-3">
        <div className="border dark:border-orange-500/30 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-[#1a1f2e]">
          <Label className="dark:text-orange-400">Upload File</Label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls"
          />
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {selectedFile ? selectedFile.name : 'Choose File'}
            </Button>
            {selectedFile && (
              <Button onClick={handleAddAttachment} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            )}
          </div>
          {selectedFile && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span>Selected: {selectedFile.name}</span>
              <span>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

        {project.attachments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No attachments yet</p>
            <p className="text-xs mt-1">Upload images, PDFs, or documents</p>
          </div>
        ) : (
          <div className="space-y-2">
            {project.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border dark:border-orange-500/30 rounded-lg bg-white dark:bg-[#1a1f2e] hover:bg-gray-50 dark:hover:bg-[#232938] transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded ${
                    attachment.type === 'pdf' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    <Paperclip className={`w-4 h-4 ${
                      attachment.type === 'pdf' ? 'text-red-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-orange-400 truncate">{attachment.filename}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(attachment.uploadedAt).toLocaleDateString()} at {new Date(attachment.uploadedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(attachment.url, '_blank')}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadAttachment(attachment)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
