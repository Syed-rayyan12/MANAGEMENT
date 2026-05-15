'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Project } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useApp } from '@/contexts/useApp';
import { PRIORITY_STYLES, DEFAULT_KANBAN_COLUMNS } from '@/lib/constants';
import { API_BASE_URL, assignmentAPI } from '@/lib/api-service';
import { toast } from 'sonner';
import { Calendar, MessageSquare, Paperclip, Clock, X, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
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
  const { state, getUserName, getUserAvatar, getAllUsers, dispatch } = useApp();
  const { isReadOnly, canChangePriority } = usePermissions();
  const [showTagModal, setShowTagModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditName, setQuickEditName] = useState(project.name);

  const allUsers = getAllUsers();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'completed';
  const isDueSoon = project.dueDate && !isOverdue && project.status !== 'completed' &&
    (new Date(project.dueDate).getTime() - new Date().getTime()) < 3 * 24 * 60 * 60 * 1000;
  const checklistTotal = project.checklist.length;
  const checklistDone = project.checklist.filter(i => i.completed).length;
  const priorityStyle = PRIORITY_STYLES[project.priority];

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

  const handleAddMember = async (userId: string, role: string = 'PRIMARY') => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    if (project.assignments.some(a => a.userId === userId)) {
      toast.info(`${user.name} is already assigned`);
      setShowTagModal(false);
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

    setShowTagModal(false);
    setSearchQuery('');
  };

  const handleRemoveMember = async (e: React.MouseEvent, assignmentId: string) => {
    e.stopPropagation();
    try {
      await assignmentAPI.remove(project.id, assignmentId);
    } catch (error) {
      console.error('Error removing member:', error);
    }
    const updatedProject = {
      ...project,
      assignments: project.assignments.filter(a => a.id !== assignmentId),
      updatedAt: new Date(),
    };
    dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
  };

  // ── Quick-Edit handlers ──
  const handleQuickSaveName = async () => {
    if (!quickEditName.trim() || quickEditName === project.name) {
      setQuickEditOpen(false);
      return;
    }
    dispatch({
      type: 'UPDATE_NAME',
      payload: { projectId: project.id, name: quickEditName.trim(), userId: state.currentUser?.id || '' },
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
    setQuickEditOpen(false);
  };

  const handleQuickPriority = async (newPri: string) => {
    dispatch({
      type: 'UPDATE_PRIORITY',
      payload: { projectId: project.id, priority: newPri as Project['priority'], userId: state.currentUser?.id || '' },
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
    setQuickEditOpen(false);
  };

  const handleQuickStatus = async (newStatus: string) => {
    dispatch({
      type: 'UPDATE_PROJECT_STATUS',
      payload: { projectId: project.id, newStatus: newStatus as Project['status'], userId: state.currentUser?.id || '' },
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
    setQuickEditOpen(false);
  };

  const filteredUsers = allUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Priority dot color (small colored circle instead of full badge)
  const priorityDotColor: Record<string, string> = {
    low: 'bg-zinc-400',
    medium: 'bg-amber-500',
    high: 'bg-[#e05c29]',
    critical: 'bg-red-500',
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group/card relative bg-white dark:bg-zinc-900/90 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-200 rounded-lg overflow-hidden w-full"
    >
      {/* Clickable Content Area */}
      <div onClick={handleClick} className="p-3 space-y-2.5">
        {/* Cover Image */}
        {project.image && (
          <img
            src={project.image}
            alt={project.name}
            className="w-full h-36 object-cover rounded-md -mt-0.5"
          />
        )}

        {/* Title */}
        <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-100 line-clamp-2 leading-snug">
          {project.name}
        </h4>

        {/* Member Avatars */}
        {project.assignments.length > 0 && (
          <div className="flex -space-x-1.5">
            {project.assignments.slice(0, 4).map((assignment) => {
              const memberAvatar = assignment.user?.avatar ? getUserAvatar(assignment.userId) : undefined;
              return (
                <div key={assignment.id} className="relative group/member">
                  <Avatar className="w-6 h-6 border-2 border-white dark:border-zinc-900 ring-0">
                    <AvatarImage src={memberAvatar} alt={assignment.user?.name} />
                    <AvatarFallback className="text-[8px] bg-orange-500 text-white font-bold">
                      {getInitials(assignment.user?.name || '')}
                    </AvatarFallback>
                  </Avatar>
                  {assignment.status === 'DONE' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border border-white dark:border-zinc-900 flex items-center justify-center">
                      <CheckCircle2 className="w-2 h-2 text-white" />
                    </div>
                  )}
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/member:flex items-center z-40 pointer-events-none">
                    <span className="bg-zinc-900 dark:bg-zinc-700 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                      {assignment.user?.name}
                    </span>
                  </div>
                </div>
              );
            })}
            {project.assignments.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                <span className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400">+{project.assignments.length - 4}</span>
              </div>
            )}
          </div>
        )}

        {/* Compact Footer: priority dot + due date + meta icons */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 pt-0.5">
          {/* Priority dot + label */}
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${priorityDotColor[project.priority] || 'bg-zinc-400'}`} />
            <span className={`font-medium ${priorityStyle.color}`}>{priorityStyle.label}</span>
          </span>

          {/* Separator */}
          {project.dueDate && <span className="text-zinc-300 dark:text-zinc-700">|</span>}

          {/* Due date */}
          {isOverdue && (
            <span className="flex items-center gap-0.5 text-red-500 font-medium">
              <Clock className="w-3 h-3" />
              Overdue
            </span>
          )}
          {isDueSoon && (
            <span className="flex items-center gap-0.5 text-amber-500 font-medium">
              <AlertTriangle className="w-3 h-3" />
              Due Soon
            </span>
          )}
          {project.dueDate && !isOverdue && !isDueSoon && (
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}

          {/* Spacer */}
          <span className="flex-1" />

          {/* Meta icons */}
          {project.comments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="w-3 h-3" />
              {project.comments.length}
            </span>
          )}
          {project.attachments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="w-3 h-3" />
              {project.attachments.length}
            </span>
          )}
        </div>

        {/* Checklist Progress (only if checklist exists) */}
        {checklistTotal > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all ${checklistDone === checklistTotal ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${(checklistDone / checklistTotal) * 100}%` }}
              />
            </div>
            <span className={`font-medium ${checklistDone === checklistTotal ? 'text-green-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
              {checklistDone}/{checklistTotal}
            </span>
          </div>
        )}
      </div>

      {/* Quick-Edit Popover (pencil button visible on hover) */}
      {!isReadOnly && (
        <Popover open={quickEditOpen} onOpenChange={(open) => {
          setQuickEditOpen(open);
          if (open) setQuickEditName(project.name);
        }}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 z-20 opacity-0 group-hover/card:opacity-100 transition-opacity w-6 h-6 rounded-md bg-white/90 dark:bg-zinc-800/90 hover:bg-orange-500 hover:text-white flex items-center justify-center shadow-sm backdrop-blur-sm"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="right"
            sideOffset={8}
            className="w-56 p-3 space-y-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Quick Edit</p>

            {/* Name */}
            <div>
              <label className="text-[10px] text-zinc-400 uppercase">Name</label>
              <input
                className="w-full mt-0.5 px-2 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                value={quickEditName}
                onChange={(e) => setQuickEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickSaveName()}
                autoFocus
              />
            </div>

            {/* Priority */}
            {canChangePriority && (
              <div>
                <label className="text-[10px] text-zinc-400 uppercase">Priority</label>
                <div className="flex gap-1 mt-1">
                  {Object.entries(PRIORITY_STYLES).map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => handleQuickPriority(key)}
                      className={`flex-1 text-[10px] py-1 rounded-md font-medium transition-colors ${
                        project.priority === key
                          ? 'bg-orange-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-orange-500/20'
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
              <label className="text-[10px] text-zinc-400 uppercase">Move to</label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {DEFAULT_KANBAN_COLUMNS.map((col) => (
                  <button
                    key={col.status}
                    onClick={() => handleQuickStatus(col.status)}
                    className={`text-[10px] py-1 rounded-md font-medium transition-colors ${
                      project.status === col.status
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-orange-500/20'
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleQuickSaveName}
              className="w-full py-1.5 text-xs font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
            >
              Save
            </button>
          </PopoverContent>
        </Popover>
      )}

      {/* Add Member Modal (kept as Dialog — opened from project modal, not card surface) */}
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

            {project.assignments.length > 0 && (
              <div>
                <p className="text-xs text-zinc-400 mb-2">Current Members ({project.assignments.length})</p>
                <div className="flex flex-wrap gap-2">
                  {project.assignments.map((assignment) => {
                    const mAvatar = assignment.user?.avatar ? getUserAvatar(assignment.userId) : undefined;
                    return (
                      <div key={assignment.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={mAvatar} alt={assignment.user?.name} />
                          <AvatarFallback className="text-[8px] bg-orange-500 text-white">{getInitials(assignment.user?.name || '')}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-orange-400 font-medium">{assignment.user?.name}</span>
                        <span className="text-[10px] text-zinc-400">({assignment.role === 'PRIMARY' ? 'Primary' : 'Collab'})</span>
                        <button onClick={(e) => handleRemoveMember(e, assignment.id)} className="text-zinc-400 hover:text-red-400">
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
                const isAlreadyMember = project.assignments.some(a => a.userId === user.id);
                return (
                  <div
                    key={user.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isAlreadyMember
                        ? 'border-green-500/30 bg-green-500/5 opacity-60 cursor-default'
                        : 'border-zinc-200 dark:border-zinc-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500'
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
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                    </div>
                    {!isAlreadyMember && (
                      <div className="flex gap-1">
                        <button onClick={() => handleAddMember(user.id, 'PRIMARY')}
                          className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-600 hover:bg-orange-500/30">
                          Primary
                        </button>
                        <button onClick={() => handleAddMember(user.id, 'COLLABORATOR')}
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 hover:bg-blue-500/30">
                          Collab
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-4">No users found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
