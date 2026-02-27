'use client';

import React, { useState } from 'react';
import { Project } from '@/lib/types';
import { useApp } from '@/contexts/useApp';
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
import { X, Calendar, AlertCircle, MessageSquare, Paperclip, Plus, Check, Trash2, Upload, Download, Edit, AtSign, Image as ImageIcon } from 'lucide-react';
import { PRIORITY_STYLES, LABEL_COLORS, KANBAN_COLUMNS } from '@/lib/constants';
import { format } from 'date-fns';

interface ProjectModalProps {
  project: Project;
  onClose: () => void;
}

export function ProjectModal({ project, onClose }: ProjectModalProps) {
  const { state, dispatch, getUserName, getAllUsers, getUserAvatar } = useApp();
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(project.name);
  const [editingDesc, setEditingDesc] = useState(project.description);
  const [newComment, setNewComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const commentInputRef = React.useRef<HTMLTextAreaElement>(null);
  const [showCoverPhotoModal, setShowCoverPhotoModal] = useState(false);
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);
  const coverPhotoInputRef = React.useRef<HTMLInputElement>(null);

  const allUsers = getAllUsers();
  const developers = allUsers.filter((u) => u.id.startsWith('dev'));

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
        await fetch(`http://localhost:3000/api/projects/${project.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: editingTitle })
        });
      } catch (error) {
        console.error('Error updating project name:', error);
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
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
      await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ description: editingDesc })
      });
    } catch (error) {
      console.error('Error updating project description:', error);
    }

    setEditingDescription(false);
  };

  const handleAddComment = () => {
    if (newComment.trim() && state.currentUser) {
      const comment = {
        id: Math.random().toString(36),
        userId: state.currentUser.id,
        content: newComment,
        timestamp: new Date(),
      };
      
      dispatch({
        type: 'ADD_COMMENT',
        payload: {
          projectId: project.id,
          comment,
          userId: state.currentUser.id,
        },
      });

      // Extract mentioned users and create notifications
      const mentionedUserIds = extractMentionedUsers(newComment);
      mentionedUserIds.forEach((userId) => {
        const mentionedUser = allUsers.find(u => u.id === userId);
        if (mentionedUser && state.currentUser) {
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: Math.random().toString(36),
              userId: userId,
              type: 'comment',
              projectId: project.id,
              read: false,
              timestamp: new Date(),
              message: `${state.currentUser.name} mentioned you in ${project.name}: "${newComment.substring(0, 50)}${newComment.length > 50 ? '...' : ''}"`,
            },
          });
        }
      });

      // Create notification for PM if not mentioned
      if (!mentionedUserIds.includes(project.pm) && project.pm !== state.currentUser.id) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Math.random().toString(36),
            userId: project.pm,
            type: 'comment',
            projectId: project.id,
            read: false,
            timestamp: new Date(),
            message: `${state.currentUser.name} commented on ${project.name}: "${newComment.substring(0, 50)}${newComment.length > 50 ? '...' : ''}"`,
          },
        });
      }
      
      setNewComment('');
    }
  };

  const handleUpdateComment = (commentId: string) => {
    if (editCommentContent.trim() && state.currentUser) {
      dispatch({
        type: 'UPDATE_COMMENT',
        payload: {
          projectId: project.id,
          commentId,
          content: editCommentContent,
          userId: state.currentUser.id,
        },
      });

      // Extract mentioned users and create notifications
      const mentionedUserIds = extractMentionedUsers(editCommentContent);
      mentionedUserIds.forEach((userId) => {
        const mentionedUser = allUsers.find(u => u.id === userId);
        if (mentionedUser && state.currentUser) {
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: Math.random().toString(36),
              userId: userId,
              type: 'comment',
              projectId: project.id,
              read: false,
              timestamp: new Date(),
              message: `${state.currentUser.name} mentioned you in ${project.name}`,
            },
          });
        }
      });

      setEditingCommentId(null);
      setEditCommentContent('');
    }
  };

  const extractMentionedUsers = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const matches = text.match(mentionRegex);
    if (!matches) return [];
    
    const userIds: string[] = [];
    matches.forEach((match) => {
      const username = match.substring(1);
      const user = allUsers.find(u => u.name.toLowerCase().replace(/\s+/g, '') === username.toLowerCase());
      if (user) {
        userIds.push(user.id);
      }
    });
    return userIds;
  };

  const handleCommentChange = (value: string, isNewComment: boolean = true) => {
    if (isNewComment) {
      setNewComment(value);
    } else {
      setEditCommentContent(value);
    }

    // Check for @ mention
    const textarea = commentInputRef.current;
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionSearchQuery(textAfterAt.toLowerCase());
        setMentionPosition(lastAtIndex);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const handleSelectMention = (user: typeof allUsers[0], isNewComment: boolean = true) => {
    const currentText = isNewComment ? newComment : editCommentContent;
    const beforeMention = currentText.substring(0, mentionPosition);
    const afterMention = currentText.substring(mentionPosition + mentionSearchQuery.length + 1);
    const username = user.name.replace(/\s+/g, '');
    const newText = `${beforeMention}@${username} ${afterMention}`;
    
    if (isNewComment) {
      setNewComment(newText);
    } else {
      setEditCommentContent(newText);
    }
    setShowMentionDropdown(false);
  };

  const renderCommentWithMentions = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        const user = allUsers.find(u => u.name.toLowerCase().replace(/\s+/g, '') === username.toLowerCase());
        if (user) {
          return (
            <span key={index} className="text-indigo-600 font-semibold bg-indigo-50 px-1 rounded">
              @{user.name}
            </span>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
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
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
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

  const handleUpdateDeveloper = async (devId: string) => {
    dispatch({
      type: 'UPDATE_DEVELOPER',
      payload: {
        projectId: project.id,
        developerId: devId === 'none' ? null : devId,
        userId: project.pm,
      },
    });

    // Update backend
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ developerId: devId === 'none' ? null : devId })
      });
    } catch (error) {
      console.error('Error updating developer:', error);
    }
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
      const statusMap: Record<string, string> = {
        'Todo': 'TODO',
        'in-progress': 'IN_PROGRESS',
        'Completed': 'COMPLETED',
        'Revisons': 'REVISIONS'
      };
      await fetch(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: statusMap[newStatus] })
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
      await fetch(`http://localhost:3000/api/projects/${project.id}`, {
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

  const handleDeleteProject = () => {
    dispatch({
      type: 'DELETE_PROJECT',
      payload: {
        projectId: project.id,
        userId: project.pm,
      },
    });
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAddAttachment = () => {
    if (selectedFile) {
      // Create a blob URL for the file
      const fileUrl = URL.createObjectURL(selectedFile);
      
      dispatch({
        type: 'ADD_ATTACHMENT',
        payload: {
          projectId: project.id,
          attachment: {
            id: Math.random().toString(36),
            filename: selectedFile.name,
            type: selectedFile.type.includes('pdf') ? 'pdf' : 'image',
            url: fileUrl,
            uploadedAt: new Date(),
          },
          userId: project.pm,
        },
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
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

  const handleCoverPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setCoverPhotoFile(file);
    }
  };

  const handleUpdateCoverPhoto = () => {
    if (coverPhotoFile) {
      const imageUrl = URL.createObjectURL(coverPhotoFile);
      dispatch({
        type: 'UPDATE_IMAGE',
        payload: {
          projectId: project.id,
          image: imageUrl,
          userId: project.pm,
        },
      });
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

  const priorityStyle = PRIORITY_STYLES[project.priority];
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'Completed';

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

              {/* Developer */}
              <div>
                <Label className="text-xs font-semibold text-gray-600 dark:text-orange-400 mb-2 block">Developer</Label>
                <Select 
                  value={project.developer || 'none'} 
                  onValueChange={handleUpdateDeveloper}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select developer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Developer</SelectItem>
                    {developers.map((dev) => (
                      <SelectItem key={dev.id} value={dev.id}>
                        <div className="flex items-center gap-2">
                          <span>{dev.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {project.developer && (
                  <div className="flex items-center gap-2 p-2 mt-2 bg-gray-50 dark:bg-[#1a1f2e] rounded-lg border dark:border-orange-500/30">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={getUserAvatar(project.developer)} alt={getUserName(project.developer)} />
                      <AvatarFallback>{getUserName(project.developer)[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium dark:text-orange-400">{getUserName(project.developer)}</span>
                  </div>
                )}
              </div>

              {/* Delete Button */}
              <Button 
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </Button>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold dark:text-orange-400">Project Details</DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details" className='text-white '>Details</TabsTrigger>
                  <TabsTrigger value="comments" className='text-white'>
                    <MessageSquare className="w-4 h-4 mr-2 text-white" />
                    Comments ({project.comments.length})
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className='text-white'>
                    <Paperclip className="w-4 h-4 mr-2 text-white" />
                    Attachments ({project.attachments.length})
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
                </TabsContent>

                {/* Comments Tab */}
                <TabsContent value="comments" className="space-y-4 mt-4">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {project.comments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No comments yet</p>
                        <p className="text-xs mt-1">Start a conversation about this project</p>
                      </div>
                    ) : (
                      project.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 p-3 border dark:border-orange-500/30 rounded-lg bg-gray-50 dark:bg-[#1a1f2e]">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={getUserAvatar(comment.userId)} alt={getUserName(comment.userId)} />
                            <AvatarFallback>{getUserName(comment.userId)[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm dark:text-orange-400">{getUserName(comment.userId)}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(comment.timestamp).toLocaleDateString()} at {new Date(comment.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="space-y-2">
                                <div className="relative">
                                  <Textarea
                                    ref={commentInputRef}
                                    value={editCommentContent}
                                    onChange={(e) => handleCommentChange(e.target.value, false)}
                                    className="min-h-20"
                                    placeholder="Type @ to mention someone"
                                  />
                                  {showMentionDropdown && (
                                    <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-[#1a1f2e] border dark:border-orange-500/30 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50">
                                      {allUsers
                                        .filter(u => u.name.toLowerCase().includes(mentionSearchQuery))
                                        .map(user => (
                                          <button
                                            key={user.id}
                                            onClick={() => handleSelectMention(user, false)}
                                            className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-[#232938] transition-colors text-left"
                                          >
                                            <Avatar className="w-6 h-6">
                                              <AvatarImage src={user.avatar} />
                                              <AvatarFallback>{user.name[0]}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                              <p className="text-sm font-medium dark:text-orange-400">{user.name}</p>
                                              <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                                            </div>
                                          </button>
                                        ))
                                      }
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleUpdateComment(comment.id)}>Save</Button>
                                  <Button size="sm" variant="outline" onClick={() => {
                                    setEditingCommentId(null);
                                    setEditCommentContent('');
                                  }}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-gray-700 dark:text-orange-400">{renderCommentWithMentions(comment.content)}</p>
                                {state.currentUser?.id === comment.userId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditCommentContent(comment.content);
                                    }}
                                    className="mt-2 h-7 text-xs"
                                  >
                                    <Edit className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="relative">
                      <Textarea
                        ref={commentInputRef}
                        placeholder="Add a comment... (Type @ to mention someone)"
                        value={newComment}
                        onChange={(e) => handleCommentChange(e.target.value, true)}
                        className="min-h-20"
                      />
                      {showMentionDropdown && (
                        <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-[#1a1f2e] border dark:border-orange-500/30 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50">
                          {allUsers
                            .filter(u => u.name.toLowerCase().includes(mentionSearchQuery))
                            .map(user => (
                              <button
                                key={user.id}
                                onClick={() => handleSelectMention(user, true)}
                                className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-[#232938] transition-colors text-left"
                              >
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={user.avatar} />
                                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium dark:text-orange-400">{user.name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                                </div>
                              </button>
                            ))
                          }
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <AtSign className="w-3 h-3" />
                        Type @ to mention team members
                      </p>
                      <Button onClick={handleAddComment} className="bg-orange-500 hover:bg-orange-600 text-white">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Post Comment
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Attachments Tab */}
                <TabsContent value="attachments" className="space-y-4 mt-4">
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
