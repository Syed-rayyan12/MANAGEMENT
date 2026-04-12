'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Project } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useApp } from '@/contexts/useApp';
import { PRIORITY_STYLES, DEFAULT_KANBAN_COLUMNS } from '@/lib/constants';
import { API_BASE_URL, projectAPI } from '@/lib/api-service';
import { toast } from 'sonner';
import { Calendar, MessageSquare, Paperclip, Clock, Plus, X, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';

interface ProjectCardProps {
  project: Project;
  onCardClick: (projectId: string) => void;
}

export function ProjectCard({ project, onCardClick }: ProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });
  const { getUserName, getUserAvatar, getAllUsers, dispatch } = useApp();
  const { isReadOnly, canChangePriority } = usePermissions();
  const [showTagModal, setShowTagModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [quickEditName, setQuickEditName] = useState(project.name);
  const quickEditRef = useRef<HTMLDivElement>(null);

  const allUsers = getAllUsers();

  // Team-scoped users: prefer users in the same team, but fall back to all users
  const teamUsers = React.useMemo(() => {
    if (!project.teamId) return allUsers;
    const scoped = allUsers.filter((u: any) => u.teams?.some((t: any) => t.id === project.teamId));
    // Fall back to all users if team filtering returns empty
    return scoped.length > 0 ? scoped : allUsers;
  }, [allUsers, project.teamId]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const pmName = getUserName(project.pm);
  const pmAvatar = getUserAvatar(project.pm);
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'completed';
  const isDueSoon = project.dueDate && !isOverdue && project.status !== 'completed' &&
    (new Date(project.dueDate).getTime() - new Date().getTime()) < 3 * 24 * 60 * 60 * 1000;
  const checklistTotal = project.checklist.length;
  const checklistDone = project.checklist.filter(i => i.completed).length;

  const priorityStyle = PRIORITY_STYLES[project.priority];

  // Get initials from label name
  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      onCardClick(project.id);
    }
  };

  const handleAddTag = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTagModal(true);
  };

  const handleAddMember = async (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    // Check if already a member
    if (project.labels.some(l => l.name === user.name)) {
      toast.info(`${user.name} is already a member`);
      setShowTagModal(false);
      setSearchQuery('');
      return;
    }

    try {
      const result = await projectAPI.addLabel(project.id, user.name, '#ff6600');
      if (result.success) {
        const savedLabel = result.data.label || result.data;
        const newLabel = {
          id: savedLabel.id || `label_${Date.now()}`,
          name: user.name,
          color: '#ff6600'
        };

        const updatedProject = {
          ...project,
          labels: [...project.labels, newLabel],
          updatedAt: new Date()
        };

        dispatch({
          type: 'UPDATE_PROJECT',
          payload: updatedProject
        });
        toast.success(`${user.name} added as member`);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member');
    }

    setShowTagModal(false);
    setSearchQuery('');
  };

  const handleRemoveMember = async (e: React.MouseEvent, labelId: string) => {
    e.stopPropagation();
    
    try {
      await projectAPI.removeLabel(project.id, labelId);
    } catch (error) {
      console.error('Error removing member:', error);
    }

    const updatedProject = {
      ...project,
      labels: project.labels.filter(l => l.id !== labelId),
      updatedAt: new Date()
    };

    dispatch({
      type: 'UPDATE_PROJECT',
      payload: updatedProject
    });
  };

  // ── Quick-Edit handlers ──
  const handleQuickEditToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickEditName(project.name);
    setShowQuickEdit(true);
  };

  const handleQuickSaveName = async () => {
    if (!quickEditName.trim() || quickEditName === project.name) {
      setShowQuickEdit(false);
      return;
    }
    dispatch({
      type: 'UPDATE_NAME',
      payload: { projectId: project.id, name: quickEditName.trim(), userId: project.pm },
    });
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: quickEditName.trim() }),
      });
      toast.success('Name updated');
    } catch {
      toast.error('Failed to save name');
    }
    setShowQuickEdit(false);
  };

  const handleQuickPriority = async (newPri: string) => {
    dispatch({
      type: 'UPDATE_PRIORITY',
      payload: { projectId: project.id, priority: newPri as Project['priority'], userId: project.pm },
    });
    const priorityMap: Record<string, string> = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL' };
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priority: priorityMap[newPri] }),
      });
    } catch {
      toast.error('Failed to update priority');
    }
    setShowQuickEdit(false);
  };

  const handleQuickStatus = async (newStatus: string) => {
    dispatch({
      type: 'UPDATE_PROJECT_STATUS',
      payload: { projectId: project.id, newStatus: newStatus as Project['status'], userId: project.pm },
    });
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
    setShowQuickEdit(false);
  };

  // Close quick-edit on outside click or Escape key
  useEffect(() => {
    if (!showQuickEdit) return;
    const handleClick = (e: MouseEvent) => {
      if (quickEditRef.current && !quickEditRef.current.contains(e.target as Node)) {
        setShowQuickEdit(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowQuickEdit(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showQuickEdit]);

  const filteredUsers = teamUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group/card relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-2 border-l-[#e05c29] cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4 space-y-3 rounded-xl overflow-hidden w-full"
    >
      {/* Quick-Edit pencil button (visible on hover) */}
      {!isReadOnly && !showQuickEdit && (
        <button
          onClick={handleQuickEditToggle}
          className="absolute top-2 right-2 z-20 opacity-0 group-hover/card:opacity-100 transition-opacity w-7 h-7 rounded-md bg-gray-200 dark:bg-[#2d3548] hover:bg-orange-500 dark:hover:bg-orange-500 flex items-center justify-center shadow"
        >
          <Pencil className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 hover:text-white" />
        </button>
      )}

      {/* Quick-Edit Overlay */}
      {showQuickEdit && (
        <div
          ref={quickEditRef}
          className="absolute inset-0 z-30 bg-white dark:bg-zinc-900 rounded-xl border-2 border-[#e05c29] p-3 space-y-3 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Quick Edit</span>
            <button onClick={() => setShowQuickEdit(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase">Name</label>
            <input
              className="w-full mt-0.5 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-[#2d3548] bg-transparent dark:text-white focus:outline-none focus:border-orange-500"
              value={quickEditName}
              onChange={(e) => setQuickEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickSaveName()}
              autoFocus
            />
          </div>

          {/* Priority (only if allowed) */}
          {canChangePriority && (
            <div>
              <label className="text-[10px] text-gray-400 uppercase">Priority</label>
              <div className="flex gap-1.5 mt-1">
                {Object.entries(PRIORITY_STYLES).map(([key, style]) => (
                  <button
                    key={key}
                    onClick={() => handleQuickPriority(key)}
                    className={`flex-1 text-[11px] py-1.5 rounded font-medium transition-colors ${
                      project.priority === key
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-[#2d3548] text-gray-600 dark:text-gray-300 hover:bg-orange-500/20'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase">Move to</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {DEFAULT_KANBAN_COLUMNS.map((col) => (
                <button
                  key={col.status}
                  onClick={() => handleQuickStatus(col.status)}
                  className={`text-[11px] py-1.5 rounded font-medium transition-colors ${
                    project.status === col.status
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-[#2d3548] text-gray-600 dark:text-gray-300 hover:bg-orange-500/20'
                  }`}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save Name Button */}
          <button
            onClick={handleQuickSaveName}
            className="w-full py-1.5 text-sm font-medium rounded bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            Save
          </button>
          <p className="text-[10px] text-center text-gray-400">Press Esc or click outside to close</p>
        </div>
      )}

      {/* Drag Handle - separate from click area */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing -mx-4 -mt-4 px-4 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800"
      >
        <div className="flex items-center justify-center">
          <div className="w-8 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full"></div>
        </div>
      </div>

      {/* Clickable Content Area */}
      <div onClick={handleClick} className="space-y-3">
        {/* Image */}
        {project.image && (
          <img
            src={project.image}
            alt={project.name}
            className="w-full h-40 object-cover rounded-lg"
          />
        )}

        {/* Title */}
        <div>
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">{project.name}</h4>
        </div>

        {/* Members */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Stacked member avatars */}
          {project.labels.length > 0 && (
            <div className="flex -space-x-1.5">
              {project.labels.slice(0, 5).map((label) => {
                const memberUser = allUsers.find(u => u.name === label.name);
                const memberAvatar = memberUser ? getUserAvatar(memberUser.id) : undefined;
                return (
                  <div key={label.id} className="relative group/member">
                    <Avatar className="w-6 h-6 border-2 border-white dark:border-[#1a1f2e] cursor-pointer">
                      <AvatarImage src={memberAvatar} alt={label.name} />
                      <AvatarFallback className="text-[8px] bg-orange-500 text-white font-bold">
                        {getInitials(label.name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Tooltip + remove on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/member:flex flex-col items-center z-40">
                      <span className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                        {label.name}
                      </span>
                      {!isReadOnly && (
                        <button
                          onClick={(e) => handleRemoveMember(e, label.id)}
                          className="mt-0.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded hover:bg-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {project.labels.length > 5 && (
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#2d3548] border-2 border-white dark:border-[#1a1f2e] flex items-center justify-center">
                  <span className="text-[9px] font-bold text-gray-600 dark:text-gray-300">+{project.labels.length - 5}</span>
                </div>
              )}
            </div>
          )}
          {!isReadOnly && (
            <button
              onClick={handleAddTag}
              className="w-6 h-6 rounded-full bg-orange-500/20 hover:bg-orange-500/30 flex items-center justify-center transition-colors border border-dashed border-orange-500/40"
              title="Add member"
            >
              <Plus className="w-3 h-3 text-orange-500" />
            </button>
          )}
        </div>



        {/* Latest Comment */}
        {project.comments.length > 0 && (
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-2 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-1 mb-1">
              <MessageSquare className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Latest comment:</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
              {project.comments[project.comments.length - 1].content}
            </p>
          </div>
        )}

        {/* Priority & Due Date */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityStyle.color} ${priorityStyle.bgColor}`}>
            {priorityStyle.label}
          </span>
          {isOverdue && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded border border-red-200 dark:border-red-500/30 animate-pulse">
              <Clock className="w-3 h-3" />
              Overdue
            </span>
          )}
          {isDueSoon && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded border border-amber-200 dark:border-amber-500/30">
              <AlertTriangle className="w-3 h-3" />
              Due Soon
            </span>
          )}
          {project.dueDate && !isOverdue && !isDueSoon && (
            <span className="flex items-center gap-1 text-gray-600 dark:text-orange-400">
              <Calendar className="w-3 h-3" />
              {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Checklist Progress (if any items) */}
        {checklistTotal > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className={`w-3.5 h-3.5 ${checklistDone === checklistTotal ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`} />
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${checklistDone === checklistTotal ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0}%` }}
              />
            </div>
            <span className={`font-medium ${checklistDone === checklistTotal ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
              {checklistDone}/{checklistTotal}
            </span>
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-3">
            {project.comments.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {project.comments.length}
              </span>
            )}
            {project.attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {project.attachments.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <Dialog open={showTagModal} onOpenChange={setShowTagModal}>
        <DialogContent className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Add Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />

            {/* Current members */}
            {project.labels.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Current Members ({project.labels.length})</p>
                <div className="flex flex-wrap gap-2">
                  {project.labels.map((label) => {
                    const memberUser = allUsers.find(u => u.name === label.name);
                    const mAvatar = memberUser ? getUserAvatar(memberUser.id) : undefined;
                    return (
                      <div key={label.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={mAvatar} alt={label.name} />
                          <AvatarFallback className="text-[8px] bg-orange-500 text-white">{getInitials(label.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-orange-400 font-medium">{label.name}</span>
                        <button onClick={(e) => handleRemoveMember(e, label.id)} className="text-gray-400 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredUsers.map((user) => {
                const isAlreadyMember = project.labels.some(l => l.name === user.name);
                return (
                  <button
                    key={user.id}
                    onClick={() => !isAlreadyMember && handleAddMember(user.id)}
                    disabled={isAlreadyMember}
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white ${
                          user.role === 'PM' ? 'bg-blue-500' :
                          user.role === 'TL' ? 'bg-green-500' :
                          user.role === 'EXECUTIVE' ? 'bg-purple-500' : 'bg-gray-500'
                        }`}>
                          {user.role}
                        </span>
                        {isAlreadyMember && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">Added</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                  </button>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">No users found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
