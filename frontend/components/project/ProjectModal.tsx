
'use client';
import { API_BASE_URL, projectAPI, uploadAPI, assignmentAPI } from '@/lib/api-service';
import { toast } from 'sonner';

import React, { useState, useEffect } from 'react';
import { Project, ProjectAssignment } from '@/lib/types';
import { useApp } from '@/contexts/useApp';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, AlertCircle, MessageSquare, Paperclip, Check, Trash2, Upload, Image as ImageIcon, Activity, Loader2, Copy } from 'lucide-react';
import { PRIORITY_STYLES, KANBAN_COLUMNS } from '@/lib/constants';
import { format } from 'date-fns';
import { linkifyText } from '@/lib/utils';

import { CommentsSection } from './CommentsSection';
import { ChecklistSection } from './ChecklistSection';
import { AttachmentsSection } from './AttachmentsSection';
import { ActivitySection } from './ActivitySection';

interface ProjectModalProps {
  project: Project;
  onClose: () => void;
}

export function ProjectModal({ project, onClose }: ProjectModalProps) {
  const { state, dispatch, getUserName, getAllUsers } = useApp();
  const { canDeleteProject, canChangePriority, isReadOnly } = usePermissions();
  const isMobile = useIsMobile();

  // Guard: if project is somehow null/undefined during unmount, bail out
  if (!project) return null;
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(project.name);
  const [editingDesc, setEditingDesc] = useState(project.description);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCoverPhotoModal, setShowCoverPhotoModal] = useState(false);
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const coverPhotoInputRef = React.useRef<HTMLInputElement>(null);
  // Fetch full project details (comments, attachments, activities) on modal open
  useEffect(() => {
    let cancelled = false;
    setLoadingDetails(true);
    const fetchDetails = async () => {
      try {
        const result = await projectAPI.getById(project.id);
        if (!cancelled && result.success) {
          const p = result.data.project;
          dispatch({
            type: 'MERGE_PROJECT_DETAILS',
            payload: {
              ...project,
              comments: (p.comments || []).map((c: any) => ({
                id: c.id,
                userId: c.userId,
                content: c.content,
                timestamp: new Date(c.createdAt || c.timestamp),
              })),
              attachments: (p.attachments || []).map((a: any) => ({
                id: a.id,
                filename: a.filename,
                type: a.type,
                url: a.url,
                uploadedAt: new Date(a.uploadedAt),
              })),
              activityLog: (p.activities || p.activityLog || []).map((al: any) => ({
                id: al.id,
                userId: al.userId,
                action: al.action,
                timestamp: new Date(al.createdAt || al.timestamp),
                details: al.details,
              })),
            },
          });
        }
      } catch (error) {
        console.error('Error fetching project details:', error);
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    };
    fetchDetails();
    return () => { cancelled = true; };
  }, [project.id]);

  const allUsers = getAllUsers();

  const filteredUsers = allUsers.filter((user: any) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveName = async () => {
    if (editingTitle.trim()) {
      dispatch({
        type: 'UPDATE_NAME',
        payload: {
          projectId: project.id,
          name: editingTitle,
          userId: state.currentUser?.id || '',
        },
      });

      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/projects/${project.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: editingTitle })
        });
        toast.success('Project name updated');
      } catch (error) {
        console.error('Error updating project name:', error);
        toast.error('Failed to update project name');
      }
    }
    setEditingName(false);
  };

  const handleSaveDescription = async () => {
    dispatch({
      type: 'UPDATE_DESCRIPTION',
      payload: {
        projectId: project.id,
        description: editingDesc,
        userId: state.currentUser?.id || '',
      },
    });

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ description: editingDesc })
      });
      toast.success('Description updated');
    } catch (error) {
      console.error('Error updating project description:', error);
      toast.error('Failed to update description');
    }

    setEditingDescription(false);
  };

  const handleUpdateDueDate = async (dateString: string) => {
    const date = dateString ? new Date(dateString) : null;
    dispatch({
      type: 'UPDATE_DUE_DATE',
      payload: {
        projectId: project.id,
        dueDate: date,
        userId: state.currentUser?.id || '',
      },
    });

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dueDate: dateString || null })
      });
    } catch (error) {
      console.error('Error updating due date:', error);
    }
  };

  const handleAddMember = async (userId: string, role: string = 'PRIMARY') => {
    const user = allUsers.find((u: any) => u.id === userId);
    if (!user) return;

    if (project.assignments.some((a: ProjectAssignment) => a.userId === userId)) {
      toast.info(`${user.name} is already assigned`);
      setShowMemberModal(false);
      setSearchQuery('');
      return;
    }

    try {
      const result = await assignmentAPI.add(project.id, userId, role);
      if (result.success) {
        const newAssignment = result.data.assignment;
        const updatedProject = {
          ...project,
          assignments: [...project.assignments, newAssignment],
          updatedAt: new Date(),
        };
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
        toast.success(`${user.name} added as ${role.toLowerCase()}`);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member');
    }

    setShowMemberModal(false);
    setSearchQuery('');
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await assignmentAPI.remove(project.id, assignmentId);
      const updatedProject = {
        ...project,
        assignments: project.assignments.filter((a: ProjectAssignment) => a.id !== assignmentId),
        updatedAt: new Date(),
      };
      dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleToggleStatus = async (assignment: ProjectAssignment) => {
    const newStatus = assignment.status === 'ACTIVE' ? 'DONE' : 'ACTIVE';
    try {
      const result = await assignmentAPI.update(project.id, assignment.id, { status: newStatus });
      if (result.success) {
        const updatedAssignments = project.assignments.map((a: ProjectAssignment) =>
          a.id === assignment.id
            ? { ...a, status: newStatus as any, completedAt: newStatus === 'DONE' ? new Date().toISOString() : null }
            : a
        );
        dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, assignments: updatedAssignments, updatedAt: new Date() } });
        toast.success(newStatus === 'DONE' ? 'Marked as done' : 'Marked as active');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    dispatch({
      type: 'UPDATE_PROJECT_STATUS',
      payload: {
        projectId: project.id,
        newStatus: newStatus as Project['status'],
        userId: state.currentUser?.id || '',
      },
    });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        toast.success(`Status updated to "${newStatus.replace(/-/g, ' ')}"`);
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    dispatch({
      type: 'UPDATE_PRIORITY',
      payload: {
        projectId: project.id,
        priority: newPriority as Project['priority'],
        userId: state.currentUser?.id || '',
      },
    });

    try {
      const token = localStorage.getItem('token');
      const priorityMap: Record<string, string> = {
        'low': 'LOW',
        'medium': 'MEDIUM',
        'high': 'HIGH',
        'critical': 'CRITICAL'
      };
      await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ priority: priorityMap[newPriority] })
      });
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      await projectAPI.delete(project.id);
      toast.success('Project deleted');
      dispatch({
        type: 'DELETE_PROJECT',
        payload: {
          projectId: project.id,
          userId: state.currentUser?.id || '',
        },
      });
      onClose();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
      setDeleting(false);
    }
  };

  const handleCoverPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setCoverPhotoFile(file);
    }
  };

  const handleUpdateCoverPhoto = async () => {
    if (coverPhotoFile) {
      const loadingToast = toast.loading('Uploading cover photo...');
      try {
        const uploadResult = await uploadAPI.uploadFile(coverPhotoFile, 'covers');
        if (!uploadResult) {
          toast.dismiss(loadingToast);
          toast.error('Cover photo upload failed');
          return;
        }

        const imageUrl = uploadResult.publicUrl;

        await fetch(`${API_BASE_URL}/projects/${project.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ image: imageUrl })
        });

        dispatch({
          type: 'UPDATE_IMAGE',
          payload: {
            projectId: project.id,
            image: imageUrl,
            userId: state.currentUser?.id || '',
          },
        });
        toast.dismiss(loadingToast);
        toast.success('Cover photo updated');
      } catch (error) {
        console.error('Error uploading cover photo:', error);
        toast.dismiss(loadingToast);
        toast.error('Failed to upload cover photo');
      }

      setCoverPhotoFile(null);
      setShowCoverPhotoModal(false);
      if (coverPhotoInputRef.current) {
        coverPhotoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveCoverPhoto = () => {
    dispatch({
      type: 'UPDATE_IMAGE',
      payload: {
        projectId: project.id,
        image: null,
        userId: state.currentUser?.id || '',
      },
    });
    setShowCoverPhotoModal(false);
  };

  const isCompleted = project.status.includes('completed') || project.status.includes('done');
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && !isCompleted;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  };

  return (
    <>
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="right" className={`${isMobile ? 'w-full !max-w-full h-full' : '!w-[80vw] !max-w-[1200px] !h-[calc(100vh-24px)] !top-3 !right-3 !bottom-3 rounded-xl'} overflow-hidden p-0 gap-0 flex flex-col bg-background border border-border shadow-[0_25px_60px_-12px_rgba(0,0,0,0.4)]`}>
        <DialogDescription className="sr-only">Project details and management</DialogDescription>

        {isMobile ? (
          <>
            {/* Mobile: Sticky Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <button onClick={onClose} className="p-1">
                <X className="w-5 h-5 text-fg-3" />
              </button>
              <h2 className="flex-1 text-sm font-semibold text-foreground truncate mx-3">
                {project.name}
              </h2>
              {canDeleteProject && (
                <button onClick={() => setShowDeleteConfirm(true)} className="p-1">
                  <Trash2 className="w-5 h-5 text-fg-4" />
                </button>
              )}
            </div>

            {/* Mobile: Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {project.image && (
                <img src={project.image} alt={project.name} className="w-full h-48 object-cover" />
              )}

              <div className="p-4 space-y-5">
                {/* Title */}
                {editingName ? (
                  <div className="space-y-2">
                    <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="text-lg font-bold" autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveName}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-xl font-bold text-foreground" onClick={() => setEditingName(true)}>
                    {project.name}
                  </h2>
                )}

                {/* Status & Priority */}
                <div className="flex flex-wrap gap-2">
                  <Select value={project.status} onValueChange={handleUpdateStatus}>
                    <SelectTrigger className="w-auto h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KANBAN_COLUMNS.map((col) => (
                        <SelectItem key={col.status} value={col.status}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] px-2 py-1 rounded bg-surface-2 text-fg-2 font-medium">
                    {PRIORITY_STYLES[project.priority]?.label || project.priority}
                  </span>
                  {isOverdue && <span className="text-[11px] px-2 py-1 rounded bg-red-500/15 text-red-500 font-medium">Overdue</span>}
                </div>

                {/* Due Date */}
                <div>
                  <Label className="text-xs text-fg-3">Due Date</Label>
                  <Input
                    type="date"
                    value={project.dueDate ? format(new Date(project.dueDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleUpdateDueDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="mt-1"
                  />
                </div>

                {/* Description */}
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} className="min-h-24" autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveDescription}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingDescription(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setEditingDescription(true)} className="p-3 border border-border rounded-lg bg-surface-2 min-h-16 whitespace-pre-wrap text-sm text-fg-2 cursor-pointer">
                    {project.description || 'Tap to add description...'}
                  </div>
                )}

                {/* Members */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-fg-3">Team</Label>
                    {!isReadOnly && (
                      <button onClick={() => setShowMemberModal(true)} className="text-[11px] text-accent font-medium">+ Add</button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {project.assignments.map((assignment: ProjectAssignment) => (
                      <div key={assignment.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-surface">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={assignment.user?.avatar || undefined} />
                          <AvatarFallback className="text-[9px]">{assignment.user?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-[12.5px] font-medium text-foreground flex-1">{assignment.user?.name}</span>
                        <span className="text-[10px] text-fg-3">{assignment.role === 'PRIMARY' ? 'Lead' : 'Collab'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <ChecklistSection project={project} />
                <AttachmentsSection project={project} />
                <CommentsSection project={project} />
              </div>
            </div>
          </>
        ) : (
          /* === DESKTOP LAYOUT — matches design handoff === */
          <div className="flex flex-col flex-1 min-h-0">
            {/* Header strip */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-surface flex-shrink-0">
              <button onClick={onClose} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium text-fg-3 hover:bg-surface-2 transition-colors">
                <X className="w-3.5 h-3.5" /> Close
              </button>
              <div className="w-px h-4 bg-border" />
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-[12.5px]">
                {project.board && (
                  <>
                    <span className="text-fg-2 font-medium">{project.board.name}</span>
                    <span className="text-fg-4">/</span>
                  </>
                )}
                <span className="font-mono text-fg-3">{project.id.slice(0, 8)}</span>
              </div>
              <span className="flex-1" />
              <button onClick={handleCopyLink} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium text-fg-3 border border-border hover:bg-surface-2 transition-colors">
                <Copy className="w-3.5 h-3.5" /> Copy link
              </button>
              {canDeleteProject && (
                <button onClick={() => setShowDeleteConfirm(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium text-red-500 border border-border hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>

            {/* Cover banner */}
            {project.image ? (
              <div className="relative w-full h-[160px] flex-shrink-0 group/banner">
                <img src={project.image} alt="" className="w-full h-full object-cover" />
                {!isReadOnly && (
                  <button
                    onClick={() => setShowCoverPhotoModal(true)}
                    className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-black/60 text-white backdrop-blur-sm opacity-0 group-hover/banner:opacity-100 transition-opacity"
                  >
                    Change cover
                  </button>
                )}
              </div>
            ) : !isReadOnly ? (
              <button
                onClick={() => setShowCoverPhotoModal(true)}
                className="w-full py-2 text-[12px] text-fg-4 hover:text-fg-2 hover:bg-surface-2 transition-colors flex-shrink-0 flex items-center justify-center gap-1.5 border-b border-border"
              >
                <ImageIcon className="w-3.5 h-3.5" /> Add cover
              </button>
            ) : null}

            {/* Body: 2-col — Main (left) + Side (right) */}
            <div className="flex-1 overflow-auto p-6">
              <div className="flex gap-6">
                {/* MAIN CONTENT (left, wider) */}
                <div className="flex-1 min-w-0 space-y-6">
                  {/* Status row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={project.status} onValueChange={handleUpdateStatus}>
                      <SelectTrigger className="w-auto h-7 text-[12px] font-medium gap-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KANBAN_COLUMNS.map((col) => (
                          <SelectItem key={col.status} value={col.status}>{col.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-[11px] px-2 py-1 rounded bg-surface-2 text-fg-2 font-medium">
                      {PRIORITY_STYLES[project.priority]?.label || project.priority}
                    </span>
                    {isOverdue && (
                      <span className="text-[11px] px-2 py-1 rounded bg-red-500/15 text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  {editingName ? (
                    <div className="space-y-2">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="text-2xl font-semibold border-none px-0 focus-visible:ring-0"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveName}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <h2
                      className="text-[24px] font-semibold text-foreground tracking-[-0.02em] leading-tight cursor-pointer hover:text-accent transition-colors"
                      onClick={() => !isReadOnly && setEditingName(true)}
                    >
                      {project.name}
                    </h2>
                  )}

                  {/* Description */}
                  {editingDescription ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingDesc}
                        onChange={(e) => setEditingDesc(e.target.value)}
                        className="min-h-32"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveDescription}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingDescription(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p
                        onClick={() => !isReadOnly && setEditingDescription(true)}
                        className={`text-[14px] text-fg-2 leading-relaxed cursor-pointer whitespace-pre-wrap ${!descExpanded ? 'line-clamp-4' : ''}`}
                      >
                        {project.description ? linkifyText(project.description) : 'Click to add description...'}
                      </p>
                      {project.description && (project.description.length > 200 || project.description.split('\n').length > 4) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDescExpanded(!descExpanded); }}
                          className="text-[12px] text-accent hover:underline mt-1.5 font-medium"
                        >
                          {descExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Checklist / Attachments / Comments */}
                  {loadingDetails ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="space-y-2">
                        <div className="h-4 w-24 bg-surface-3 rounded" />
                        <div className="h-3 w-full bg-surface-3 rounded" />
                        <div className="h-3 w-3/4 bg-surface-3 rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-28 bg-surface-3 rounded" />
                        <div className="h-16 w-full bg-surface-3 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-24 bg-surface-3 rounded" />
                        <div className="h-20 w-full bg-surface-3 rounded-lg" />
                        <div className="h-20 w-full bg-surface-3 rounded-lg" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <ChecklistSection project={project} />
                      <div className={`relative ${!attachmentsExpanded && project.attachments?.length > 3 ? 'max-h-[180px] overflow-hidden' : ''}`}>
                        <AttachmentsSection project={project} />
                        {!attachmentsExpanded && project.attachments && project.attachments.length > 3 && (
                          <div className="absolute bottom-0 left-0 right-0 pt-8 bg-gradient-to-t from-background to-transparent flex justify-center pb-1">
                            <button onClick={() => setAttachmentsExpanded(true)} className="text-[12px] text-accent hover:underline font-medium">
                              Show all ({project.attachments.length} files)
                            </button>
                          </div>
                        )}
                        {attachmentsExpanded && project.attachments && project.attachments.length > 3 && (
                          <button onClick={() => setAttachmentsExpanded(false)} className="text-[12px] text-accent hover:underline font-medium mt-1">
                            Show less
                          </button>
                        )}
                      </div>
                      <CommentsSection project={project} />
                    </>
                  )}
                </div>

                {/* SIDEBAR (right, narrower) */}
                <div className="w-[260px] xl:w-[300px] flex-shrink-0 space-y-3">
                  {/* Properties card */}
                  <div className="rounded-lg border border-border bg-surface p-3.5">
                    <div className="text-kicker uppercase text-fg-4 tracking-widest mb-3">Properties</div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-fg-3">Status</span>
                        <Select value={project.status} onValueChange={handleUpdateStatus}>
                          <SelectTrigger className="w-auto h-6 text-[11px] font-medium border-none bg-surface-2 px-2 gap-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {KANBAN_COLUMNS.map((col) => (
                              <SelectItem key={col.status} value={col.status}>{col.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-fg-3">Priority</span>
                        {canChangePriority ? (
                          <Select value={project.priority} onValueChange={handleUpdatePriority}>
                            <SelectTrigger className="w-auto h-6 text-[11px] font-medium border-none bg-surface-2 px-2 gap-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(PRIORITY_STYLES).map(([key, style]) => (
                                <SelectItem key={key} value={key}>{style.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-[12px] font-medium text-fg-2">
                            {PRIORITY_STYLES[project.priority]?.label || project.priority}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-fg-3">Workspace</span>
                        <span className="text-[12px] font-medium text-fg-2">
                          {project.board?.name || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-fg-3">Due</span>
                        <div className="flex items-center gap-1.5">
                          {isReadOnly ? (
                            <span className="text-[12px] font-mono font-medium text-fg-2">
                              {project.dueDate ? format(new Date(project.dueDate), 'MMM d, yyyy') : '—'}
                            </span>
                          ) : (
                            <input
                              type="date"
                              value={project.dueDate ? format(new Date(project.dueDate), 'yyyy-MM-dd') : ''}
                              onChange={(e) => handleUpdateDueDate(e.target.value)}
                              className="text-[12px] font-mono font-medium bg-surface-2 border border-border rounded px-1.5 py-0.5 text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-accent"
                            />
                          )}
                          {isOverdue && <AlertCircle className="w-3 h-3 text-red-500" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team card */}
                  <div className="rounded-lg border border-border bg-surface p-3.5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-kicker uppercase text-fg-4 tracking-widest">Team</span>
                      {!isReadOnly && (
                        <button onClick={() => setShowMemberModal(true)} className="w-5 h-5 rounded flex items-center justify-center text-fg-3 hover:bg-surface-2">
                          <span className="text-sm leading-none">+</span>
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {project.assignments.map((assignment: ProjectAssignment, i: number) => (
                        <div key={assignment.id} className="flex items-center gap-2.5 py-1.5">
                          <span className="w-6 h-6 rounded-full bg-accent-soft text-accent text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                            {assignment.user?.name?.[0]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12.5px] font-medium text-foreground truncate">{assignment.user?.name}</div>
                            <div className="text-[10.5px] text-fg-3">{assignment.role === 'PRIMARY' ? 'Lead' : 'Collaborator'}</div>
                          </div>
                          <button
                            onClick={() => handleToggleStatus(assignment)}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              assignment.status === 'DONE'
                                ? 'bg-green-500/15 text-green-600'
                                : 'bg-accent-soft text-accent'
                            }`}
                          >
                            {assignment.status === 'DONE' ? 'done' : 'active'}
                          </button>
                          {!isReadOnly && (
                            <button onClick={() => handleRemoveAssignment(assignment.id)} className="text-fg-4 hover:text-red-500 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {project.assignments.length === 0 && (
                        <p className="text-[11px] text-fg-4 py-2">No members assigned</p>
                      )}
                    </div>
                  </div>

                  {/* Activity card */}
                  <div className="rounded-lg border border-border bg-surface p-3.5">
                    <div className="text-kicker uppercase text-fg-4 tracking-widest mb-3">Activity</div>
                    {loadingDetails ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-3 w-full bg-surface-3 rounded" />
                        <div className="h-3 w-2/3 bg-surface-3 rounded" />
                        <div className="h-3 w-4/5 bg-surface-3 rounded" />
                      </div>
                    ) : (
                      <div className="max-h-[180px] overflow-hidden relative">
                        <ActivitySection project={project} compact />
                        {project.activityLog && project.activityLog.length > 4 && (
                          <div className="absolute bottom-0 left-0 right-0 pt-6 bg-gradient-to-t from-surface to-transparent" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

    {/* Cover Photo Modal */}
    {showCoverPhotoModal && (
      <Dialog open={showCoverPhotoModal} onOpenChange={setShowCoverPhotoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Cover Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {project.image && (
              <div className="space-y-3">
                <img src={project.image} alt="Current cover" className="w-full h-48 object-cover rounded-lg border" />
                <Button variant="destructive" onClick={handleRemoveCoverPhoto} className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" /> Remove Cover Photo
                </Button>
              </div>
            )}
            <div className="border-t pt-4 space-y-3">
              <Label>{project.image ? 'Change Cover Photo' : 'Upload Cover Photo'}</Label>
              <input ref={coverPhotoInputRef} type="file" onChange={handleCoverPhotoSelect} className="hidden" accept="image/*" />
              <Button type="button" variant="outline" onClick={() => coverPhotoInputRef.current?.click()} className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                {coverPhotoFile ? coverPhotoFile.name : 'Choose Image'}
              </Button>
              {coverPhotoFile && (
                <div className="space-y-3">
                  <div className="relative w-full h-48 rounded-lg border overflow-hidden">
                    <img src={URL.createObjectURL(coverPhotoFile)} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateCoverPhoto} className="flex-1 bg-accent text-white hover:brightness-105">
                      <Check className="w-4 h-4 mr-2" /> Save Cover Photo
                    </Button>
                    <Button variant="outline" onClick={() => { setCoverPhotoFile(null); if (coverPhotoInputRef.current) coverPhotoInputRef.current.value = ''; }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Add Member Modal */}
    {showMemberModal && (
      <Dialog open={showMemberModal} onOpenChange={(open) => { setShowMemberModal(open); if (!open) setSearchQuery(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
              autoFocus
            />
            {project.assignments.length > 0 && (
              <div>
                <p className="text-xs text-fg-3 mb-2">Current Members ({project.assignments.length})</p>
                <div className="flex flex-wrap gap-2">
                  {project.assignments.map((assignment: ProjectAssignment) => (
                    <div key={assignment.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent-soft border border-accent-line">
                      <span className="w-5 h-5 rounded-full bg-accent text-white text-[8px] font-bold flex items-center justify-center">
                        {assignment.user?.name?.[0]}
                      </span>
                      <span className="text-xs text-accent font-medium">{assignment.user?.name}</span>
                      <span className="text-[10px] text-fg-3">({assignment.role === 'PRIMARY' ? 'Lead' : 'Collab'})</span>
                      <button onClick={() => handleRemoveAssignment(assignment.id)} className="text-fg-4 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredUsers.map((user: any) => {
                const isAlreadyMember = project.assignments.some((a: ProjectAssignment) => a.userId === user.id);
                return (
                  <div
                    key={user.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isAlreadyMember
                        ? 'border-green-500/30 bg-green-500/5 opacity-60'
                        : 'border-border hover:bg-surface-2 hover:border-line-strong'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-full bg-accent-soft text-accent text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                      {user.name[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        {isAlreadyMember && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 font-medium">Added</span>
                        )}
                      </div>
                      <p className="text-xs text-fg-3">{user.email}</p>
                    </div>
                    {!isAlreadyMember && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleAddMember(user.id, 'PRIMARY')}
                          className="text-[10px] px-2 py-1 rounded bg-accent-soft text-accent hover:bg-accent hover:text-white transition-colors font-medium"
                        >
                          Lead
                        </button>
                        <button
                          onClick={() => handleAddMember(user.id, 'COLLABORATOR')}
                          className="text-[10px] px-2 py-1 rounded bg-blue-500/15 text-blue-600 hover:bg-blue-500/30 transition-colors font-medium"
                        >
                          Collab
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-center text-fg-3 py-4">No users found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Delete Confirmation */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
        <div className="bg-surface rounded-lg border border-border p-6 max-w-md mx-4 space-y-4 shadow-3">
          <div className="flex items-center gap-3 text-red-500">
            <Trash2 className="w-6 h-6" />
            <h3 className="text-lg font-semibold text-foreground">Delete Project</h3>
          </div>
          <p className="text-[13px] text-fg-2">
            Are you sure you want to delete <strong className="text-foreground">{project.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button onClick={handleDeleteProject} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                'Delete Project'
              )}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
