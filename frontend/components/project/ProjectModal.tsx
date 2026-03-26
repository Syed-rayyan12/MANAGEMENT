
'use client';
import { API_BASE_URL, projectAPI, uploadAPI } from '@/lib/api-service';
import { toast } from 'sonner';

import React, { useState } from 'react';
import { Project } from '@/lib/types';
import { useApp } from '@/contexts/useApp';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Dialog,
  DialogContent,
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
import { X, AlertCircle, MessageSquare, Paperclip, Check, Trash2, Upload, Image as ImageIcon, Activity } from 'lucide-react';
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
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(project.name);
  const [editingDesc, setEditingDesc] = useState(project.description);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCoverPhotoModal, setShowCoverPhotoModal] = useState(false);
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);
  const coverPhotoInputRef = React.useRef<HTMLInputElement>(null);

  const allUsers = getAllUsers();

  const handleSaveName = async () => {
    if (editingTitle.trim()) {
      dispatch({
        type: 'UPDATE_NAME',
        payload: {
          projectId: project.id,
          name: editingTitle,
          userId: project.pm,
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
        userId: project.pm,
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
        userId: project.pm,
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

  const handleAddMember = async (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    if (project.labels.some(l => l.name === user.name)) {
      toast.info(`${user.name} is already a member`);
      return;
    }
    try {
      const result = await projectAPI.addLabel(project.id, user.name, '#ff6600');
      if (result.success) {
        const savedLabel = result.data.label || result.data;
        const newLabel = { id: savedLabel.id || `label_${Date.now()}`, name: user.name, color: '#ff6600' };
        dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, labels: [...project.labels, newLabel], updatedAt: new Date() } });
        toast.success(`${user.name} added as member`);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member');
    }
  };

  const handleRemoveMember = async (labelId: string) => {
    try {
      await projectAPI.removeLabel(project.id, labelId);
    } catch (error) {
      console.error('Error removing member:', error);
    }
    dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, labels: project.labels.filter(l => l.id !== labelId), updatedAt: new Date() } });
  };

  const handleUpdateStatus = async (newStatus: string) => {
    dispatch({
      type: 'UPDATE_PROJECT_STATUS',
      payload: {
        projectId: project.id,
        newStatus: newStatus as Project['status'],
        userId: project.pm,
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
        body: JSON.stringify({ status: newStatus })
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    dispatch({
      type: 'UPDATE_PRIORITY',
      payload: {
        projectId: project.id,
        priority: newPriority as Project['priority'],
        userId: project.pm,
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

  const handleDeleteProject = async () => {
    try {
      await projectAPI.delete(project.id);
      toast.success('Project deleted');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }

    dispatch({
      type: 'DELETE_PROJECT',
      payload: {
        projectId: project.id,
        userId: project.pm,
      },
    });
    onClose();
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
            userId: project.pm,
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
        userId: project.pm,
      },
    });
    setShowCoverPhotoModal(false);
  };

  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'completed';

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden p-0">

        {/* Left-Right Layout */}
        <div className="flex h-full">

          {/* Left Sidebar */}
          <div className="w-96 border-r dark:border-orange-500/30 flex flex-col">
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
                <div className="w-full h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
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
                    className="text-xl font-bold cursor-pointer hover:text-indigo-600 dark:text-orange-400 dark:hover:text-orange-300"
                    onClick={() => setEditingName(true)}
                  >
                    {project.name}
                  </h2>
                )}
              </div>

              {/* Status */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 dark:text-orange-400">Status</Label>
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
                <Label className="text-xs font-semibold text-gray-600 dark:text-orange-400">Priority</Label>
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
                  <div className="mt-1 px-3 py-2 rounded-md border border-gray-200 dark:border-[#2d3548] text-sm dark:text-orange-400">
                    {PRIORITY_STYLES[project.priority]?.label || project.priority}
                  </div>
                )}
              </div>

              {/* Due Date */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 dark:text-orange-400">Due Date</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="date"
                    value={project.dueDate ? format(new Date(project.dueDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => handleUpdateDueDate(e.target.value)}
                    className="flex-1"
                  />
                  {isOverdue && (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                </div>
              </div>

              {/* Project Manager */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 dark:text-orange-400 mb-2 block">Project Manager</Label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-[#1a1f2e] rounded-lg border dark:border-orange-500/30">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={getUserAvatar(project.pm)} alt={getUserName(project.pm)} />
                    <AvatarFallback>{getUserName(project.pm)[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium dark:text-orange-400">{getUserName(project.pm)}</span>
                </div>
              </div>

              {/* Members */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 dark:text-orange-400 mb-2 block">Members</Label>
                {/* Current members list */}
                <div className="space-y-1.5 mb-2">
                  {project.labels.map((label) => {
                    const memberUser = allUsers.find(u => u.name === label.name);
                    const mAvatar = memberUser ? getUserAvatar(memberUser.id) : undefined;
                    return (
                      <div key={label.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#232938] rounded-lg border dark:border-[#2d3548]">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={mAvatar} alt={label.name} />
                            <AvatarFallback className="text-[9px] bg-orange-500 text-white">{label.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium dark:text-orange-400">{label.name}</span>
                          {memberUser?.role && (
                            <span className={`text-[9px] px-1 py-0.5 rounded font-bold text-white ${
                              memberUser.role === 'PM' ? 'bg-blue-500' :
                              memberUser.role === 'TL' ? 'bg-green-500' :
                              memberUser.role === 'EXECUTIVE' ? 'bg-purple-500' : 'bg-gray-500'
                            }`}>{memberUser.role}</span>
                          )}
                        </div>
                        {!isReadOnly && (
                          <button onClick={() => handleRemoveMember(label.id)} className="text-gray-400 hover:text-red-400 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {project.labels.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-1">No members assigned</p>
                  )}
                </div>
                {/* Add member dropdown */}
                {!isReadOnly && (
                  <Select onValueChange={(val) => handleAddMember(val)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Add member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers
                        .filter(u => !project.labels.some(l => l.name === u.name))
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center gap-2">
                              <span>{user.name}</span>
                              <span className="text-[10px] text-gray-400">({user.role})</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold dark:text-orange-400">Project Details</DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details" className='text-white '>Details</TabsTrigger>
                  <TabsTrigger value="comments" className='text-white'>
                    <MessageSquare className="w-4 h-4 mr-2 text-white" />
                    Comments ({project.comments.length})
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className='text-white'>
                    <Paperclip className="w-4 h-4 mr-2 text-white" />
                    Files ({project.attachments.length})
                  </TabsTrigger>
                  <TabsTrigger value="activity" className='text-white'>
                    <Activity className="w-4 h-4 mr-2 text-white" />
                    Activity
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-6 mt-6">
                  {/* Description */}
                  <div>
                    <Label className="text-sm font-semibold dark:text-orange-400">Description</Label>
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
                        className="mt-2 p-3 border dark:border-orange-500/30 rounded-lg bg-gray-50 dark:bg-[#1a1f2e] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#232938] min-h-24 whitespace-pre-wrap text-sm dark:text-orange-400"
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
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
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
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Project
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
