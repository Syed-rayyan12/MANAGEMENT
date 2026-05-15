
'use client';
import { API_BASE_URL, projectAPI, uploadAPI, assignmentAPI } from '@/lib/api-service';
import { toast } from 'sonner';

import React, { useState } from 'react';
import { Project, ProjectAssignment } from '@/lib/types';
import { useApp } from '@/contexts/useApp';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { X, AlertCircle, MessageSquare, Paperclip, Check, Trash2, Upload, Image as ImageIcon, Activity, Loader2 } from 'lucide-react';
import { PRIORITY_STYLES, KANBAN_COLUMNS } from '@/lib/constants';
import { format } from 'date-fns';

import { CommentsSection } from './CommentsSection';
import { ChecklistSection } from './ChecklistSection';
import { AttachmentsSection } from './AttachmentsSection';
import { ActivitySection } from './ActivitySection';

interface ProjectModalProps {
  project: Project;
  onClose: () => void;
}

export function ProjectModal({ project, onClose }: ProjectModalProps) {
  const { state, dispatch, getUserName, getAllUsers, getUserAvatar } = useApp();
  const { canDeleteProject, canChangePriority, isReadOnly } = usePermissions();

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
  const coverPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const [submittingChange, setSubmittingChange] = useState(false);

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

      // Update backend
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

    // Update backend
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

    // Update backend
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

    // Update backend
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

    // Update backend
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

  const handleChangeType = async (changeType: string) => {
    if (!changeType || changeType === 'NONE') return;
    setSubmittingChange(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ changeType }),
      });
      if (response.ok) {
        dispatch({
          type: 'UPDATE_PROJECT',
          payload: {
            ...project,
            minorChanges: changeType === 'MINOR' ? (project.minorChanges || 0) + 1 : (project.minorChanges || 0),
            majorChanges: changeType === 'MAJOR' ? (project.majorChanges || 0) + 1 : (project.majorChanges || 0),
          },
        });
        toast.success(`${changeType === 'MINOR' ? 'Minor' : 'Major'} change recorded`);
      } else {
        toast.error('Failed to record change');
      }
    } catch (error) {
      console.error('Error recording change:', error);
      toast.error('Failed to record change');
    } finally {
      setSubmittingChange(false);
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
        // Upload to R2 CDN
        const uploadResult = await uploadAPI.uploadFile(coverPhotoFile, 'covers');
        if (!uploadResult) {
          toast.dismiss(loadingToast);
          toast.error('Cover photo upload failed');
          return;
        }

        const imageUrl = uploadResult.publicUrl;

        // Update backend
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

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] overflow-hidden p-0 gap-0 flex flex-col rounded-2xl backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-white/10 ring-1 ring-[#e05c29]/10 shadow-2xl">
        <DialogDescription className="sr-only">Project details and management</DialogDescription>

        {/* Left-Right Layout */}
        <div className="flex flex-1 min-h-0">

          {/* Left Sidebar */}
          <div className="w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-h-0">
            {/* Cover Photo Section */}
            <div className="relative group flex-shrink-0">
              {project.image ? (
                <>
                  <img
                    src={project.image}
                    alt={project.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowCoverPhotoModal(true)}
                      className="bg-white/90 hover:bg-white"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Change Cover
                    </Button>
                  </div>
                </>
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-[#e05c29]/20 via-orange-400/10 to-amber-400/5 flex items-center justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowCoverPhotoModal(true)}
                    className="bg-white/90 hover:bg-white"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Add Cover
                  </Button>
                </div>
              )}
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Project Title */}
              <div>
                {editingName ? (
                  <div className="space-y-2">
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="font-bold"
                      autoFocus

                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveName}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <h2
                    className="text-xl font-semibold cursor-pointer hover:text-[#e05c29] text-zinc-900 dark:text-zinc-100"
                    onClick={() => setEditingName(true)}
                  >
                    {project.name}
                  </h2>
                )}
              </div>

              {/* Status */}
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Status</Label>
                <Select value={project.status} onValueChange={handleUpdateStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_COLUMNS.map((col) => (
                      <SelectItem key={col.status} value={col.status}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Priority</Label>
                {canChangePriority ? (
                  <Select value={project.priority} onValueChange={handleUpdatePriority}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_STYLES).map(([key, style]) => (
                        <SelectItem key={key} value={key}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-100">
                    {PRIORITY_STYLES[project.priority]?.label || project.priority}
                  </div>
                )}
              </div>

              {/* Record Change */}
              {!isReadOnly && (
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Record Change</Label>
                  <Select onValueChange={handleChangeType} disabled={submittingChange} value="">
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={submittingChange ? 'Saving...' : 'None'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MINOR">Minor Change</SelectItem>
                      <SelectItem value="MAJOR">Major Change</SelectItem>
                    </SelectContent>
                  </Select>
                  {((project.minorChanges || 0) > 0 || (project.majorChanges || 0) > 0) && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Minor: {project.minorChanges || 0} | Major: {project.majorChanges || 0}
                    </p>
                  )}
                </div>
              )}

              {/* Due Date */}
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Due Date</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="date"
                    value={project.dueDate ? format(new Date(project.dueDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleUpdateDueDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    disabled={isCompleted}
                    className="flex-1"
                  />
                  {isOverdue && (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
                {isCompleted && (
                  <p className="text-xs text-zinc-400 mt-1">Due date is locked for completed projects</p>
                )}
              </div>

              {/* Primary Member */}
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-2 block">Primary Member</Label>
                {(() => {
                  const primaryAssignment = project.assignments[0];
                  return (
                    <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={primaryAssignment?.user?.avatar || undefined} alt={primaryAssignment?.user?.name} />
                        <AvatarFallback>{primaryAssignment?.user?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{primaryAssignment?.user?.name || 'Unassigned'}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Members */}
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-2 block">Members</Label>
                {/* Current assignments list */}
                <div className="space-y-0 mb-2 max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
                  {project.assignments.map((assignment: ProjectAssignment) => (
                    <div key={assignment.id} className="flex items-center justify-between py-2 px-3 last:border-0">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={assignment.user?.avatar || undefined} />
                          <AvatarFallback className="text-xs bg-orange-500 text-white">{assignment.user?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{assignment.user?.name}</p>
                          <div className="flex items-center gap-1.5">
                            {assignment.user?.specialization && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                {assignment.user?.specialization?.replace(/_/g, ' ')}
                              </span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              {assignment.role === 'PRIMARY' ? 'Primary' : 'Collaborator'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStatus(assignment)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            assignment.status === 'DONE'
                              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                              : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                          }`}
                        >
                          {assignment.status === 'DONE' ? '✓ Done' : '● Active'}
                        </button>
                        {!isReadOnly && (
                          <button onClick={() => handleRemoveAssignment(assignment.id)} className="p-1 text-zinc-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {project.assignments.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-3 px-3">No members assigned</p>
                  )}
                </div>
                {/* Add member button */}
                {!isReadOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-1 text-xs"
                    onClick={() => setShowMemberModal(true)}
                  >
                    + Add Member
                  </Button>
                )}
              </div>

              {/* Delete Button */}
              {canDeleteProject && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Project
                </Button>
              )}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Project Details</DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="comments">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Comments ({project.comments.length})
                  </TabsTrigger>
                  <TabsTrigger value="attachments">
                    <Paperclip className="w-4 h-4 mr-2" />
                    Files ({project.attachments.length})
                  </TabsTrigger>
                  <TabsTrigger value="activity">
                    <Activity className="w-4 h-4 mr-2" />
                    Activity
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-6 mt-6">
                  {/* Description */}
                  <div>
                    <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</Label>
                    {editingDescription ? (
                      <div className="space-y-2 mt-2">
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
                      <div
                        onClick={() => setEditingDescription(true)}
                        className="mt-2 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-24 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 transition-all duration-200"
                      >
                        {project.description || 'Click to add description...'}
                      </div>
                    )}
                  </div>

                  {/* Checklist */}
                  <ChecklistSection project={project} />
                </TabsContent>

                {/* Comments Tab */}
                <TabsContent value="comments">
                  <CommentsSection project={project} />
                </TabsContent>

                {/* Attachments Tab */}
                <TabsContent value="attachments">
                  <AttachmentsSection project={project} />
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity">
                  <ActivitySection project={project} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

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
                <img
                  src={project.image}
                  alt="Current cover"
                  className="w-full h-48 object-cover rounded-lg border"
                />
                <Button
                  variant="destructive"
                  onClick={handleRemoveCoverPhoto}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Cover Photo
                </Button>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <Label className="dark:text-orange-400">
                {project.image ? 'Change Cover Photo' : 'Upload Cover Photo'}
              </Label>
              <input
                ref={coverPhotoInputRef}
                type="file"
                onChange={handleCoverPhotoSelect}
                className="hidden"
                accept="image/*"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => coverPhotoInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {coverPhotoFile ? coverPhotoFile.name : 'Choose Image'}
              </Button>

              {coverPhotoFile && (
                <div className="space-y-3">
                  <div className="relative w-full h-48 rounded-lg border overflow-hidden">
                    <img
                      src={URL.createObjectURL(coverPhotoFile)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpdateCoverPhoto}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 text-white shadow-[0_4px_20px_rgba(224,92,41,0.35)]"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Save Cover Photo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCoverPhotoFile(null);
                        if (coverPhotoInputRef.current) {
                          coverPhotoInputRef.current.value = '';
                        }
                      }}
                    >
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

            {/* Current assignments */}
            {project.assignments.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Current Members ({project.assignments.length})</p>
                <div className="flex flex-wrap gap-2">
                  {project.assignments.map((assignment: ProjectAssignment) => (
                    <div key={assignment.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={assignment.user?.avatar || undefined} alt={assignment.user?.name} />
                        <AvatarFallback className="text-[8px] bg-orange-500 text-white">{assignment.user?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-orange-400 font-medium">{assignment.user?.name}</span>
                      <span className="text-[10px] text-gray-400">({assignment.role === 'PRIMARY' ? 'Primary' : 'Collab'})</span>
                      <button onClick={() => handleRemoveAssignment(assignment.id)} className="text-gray-400 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredUsers.map((user: any) => {
                const isAlreadyMember = project.assignments.some((a: ProjectAssignment) => a.userId === user.id);
                return (
                  <div
                    key={user.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isAlreadyMember
                        ? 'border-green-500/30 bg-green-500/5 opacity-60 cursor-default'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500'
                    }`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.name}</p>
                        {isAlreadyMember && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">Added</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                    {!isAlreadyMember && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAddMember(user.id, 'PRIMARY')}
                          className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-600 hover:bg-orange-500/30"
                        >
                          Primary
                        </button>
                        <button
                          onClick={() => handleAddMember(user.id, 'COLLABORATOR')}
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 hover:bg-blue-500/30"
                        >
                          Collab
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">No users found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Delete Confirmation */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-[#1a1f2e] rounded-lg p-6 max-w-md mx-4 space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <Trash2 className="w-6 h-6" />
            <h3 className="text-lg font-bold dark:text-red-400">Delete Project</h3>
          </div>
          <p className="text-gray-600 dark:text-orange-400">
            Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
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
