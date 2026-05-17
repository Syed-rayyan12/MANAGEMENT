'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Project } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useApp } from '@/contexts/useApp';
import { PRIORITY_STYLES } from '@/lib/constants';
import { API_BASE_URL, assignmentAPI } from '@/lib/api-service';
import { toast } from 'sonner';
import { Calendar, MessageSquare, Paperclip, X, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { PriorityBars } from '@/components/shared/PriorityBars';
import { AvatarStack } from '@/components/shared/AvatarStack';

interface ProjectCardProps {
  project: Project;
  onCardClick: (projectId: string) => void;
  boardColumns?: { status: string; label: string; color: string; phase?: string }[];
}

export function ProjectCard({ project, onCardClick, boardColumns = [] }: ProjectCardProps) {
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

  const currentPhase = boardColumns.find(col => col.status === project.status)?.phase;
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && currentPhase !== 'DONE';
  const checklistTotal = project.checklist.length;
  const checklistDone = project.checklist.filter(i => i.completed).length;

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

  const handleQuickDueDate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newDate = e.target.value ? new Date(e.target.value) : null;
    const updatedProject = { ...project, dueDate: newDate, updatedAt: new Date() };
    dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dueDate: e.target.value || null }),
      });
    } catch {
      toast.error('Failed to update due date');
    }
  };

  const canEditDueDate = !isReadOnly;

  const filteredUsers = allUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build avatar stack data
  const assignedUsers = project.assignments.map(a => ({
    id: a.userId,
    name: a.user?.name || 'Unknown',
    avatar: a.user?.avatar ? getUserAvatar(a.userId) : undefined,
  }));

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group/card relative bg-surface border-border cursor-grab active:cursor-grabbing transition-colors duration-[120ms] rounded-[9px] overflow-hidden w-full hover:border-line-strong ${
        isOverdue ? 'border-status-red/40' : ''
      }`}
    >
      {/* Cover image */}
      {project.image && (
        <div onClick={handleClick} className="w-full h-[100px] overflow-hidden">
          <img src={project.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Clickable Content */}
      <div onClick={handleClick} className="p-[10px] space-y-2">
        {/* Top row: ID + Priority bars */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-card-id text-fg-3">
            {project.id?.slice(0, 8)}
          </span>
          <PriorityBars priority={project.priority} />
        </div>

        {/* Title */}
        <h4 className="text-card-title text-foreground line-clamp-2 leading-snug">
          {project.name}
        </h4>

        {/* Labels */}
        {project.labels && project.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.labels.map((label: any, i: number) => (
              <span
                key={i}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${label.color}18`,
                  color: label.color,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {/* Checklist progress bar */}
        {checklistTotal > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-surface-3 rounded-full h-[3px]">
              <div
                className="h-[3px] rounded-full transition-all bg-accent"
                style={{ width: `${(checklistDone / checklistTotal) * 100}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-fg-3">
              {checklistDone}/{checklistTotal}
            </span>
          </div>
        )}

        {/* Footer: due date + meta + avatars */}
        <div className="flex items-center gap-2 text-[11px] text-fg-3 pt-0.5">
          {/* Due date */}
          {canEditDueDate ? (
            <label
              className={`flex items-center gap-0.5 font-mono cursor-pointer hover:text-accent transition-colors relative z-10 ${isOverdue ? 'text-status-red font-semibold' : ''}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Calendar className="w-3 h-3" />
              <span>{project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Set date'}</span>
              <input
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                value={project.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : ''}
                onChange={handleQuickDueDate}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </label>
          ) : project.dueDate ? (
            <span className={`flex items-center gap-0.5 font-mono ${isOverdue ? 'text-status-red font-semibold' : ''}`}>
              <Calendar className="w-3 h-3" />
              {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          ) : null}

          {/* Comments */}
          {project.comments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="w-3 h-3" />
              {project.comments.length}
            </span>
          )}

          {/* Attachments */}
          {project.attachments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="w-3 h-3" />
              {project.attachments.length}
            </span>
          )}

          <span className="flex-1" />

          {/* Avatar stack */}
          {assignedUsers.length > 0 && (
            <AvatarStack users={assignedUsers} max={3} size={20} />
          )}
        </div>
      </div>

      {/* Quick-Edit Popover */}
      {!isReadOnly && (
        <Popover open={quickEditOpen} onOpenChange={(open) => {
          setQuickEditOpen(open);
          if (open) setQuickEditName(project.name);
        }}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 z-20 opacity-0 group-hover/card:opacity-100 w-6 h-6 transition-opacity duration-[120ms] rounded-md bg-surface/90 hover:bg-accent hover:text-accent-fg text-fg-3 flex items-center justify-center backdrop-blur-sm"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="right"
            sideOffset={8}
            className="w-56 p-3 space-y-2.5 bg-surface border border-border shadow-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-kicker uppercase text-fg-4 tracking-widest">Quick Edit</p>

            {/* Name */}
            <div>
              <label className="text-kicker uppercase text-fg-4">Name</label>
              <input
                className="w-full mt-0.5 px-2 py-1.5 text-[13px] rounded-md border border-border bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
                value={quickEditName}
                onChange={(e) => setQuickEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickSaveName()}
                autoFocus
              />
            </div>

            {/* Priority */}
            {canChangePriority && (
              <div>
                <label className="text-kicker uppercase text-fg-4">Priority</label>
                <div className="flex gap-1 mt-1">
                  {Object.entries(PRIORITY_STYLES).map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => handleQuickPriority(key)}
                      className={`flex-1 text-[10px] py-1 rounded-md font-medium transition-colors duration-[120ms] ${
                        project.priority === key
                          ? 'bg-accent text-accent-fg'
                          : 'bg-surface-2 text-fg-3 hover:bg-surface-3'
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
              <label className="text-kicker uppercase text-fg-4">Move to</label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {boardColumns.map((col) => (
                  <button
                    key={col.status}
                    onClick={() => handleQuickStatus(col.status)}
                    className={`text-[10px] py-1 rounded-md font-medium transition-colors duration-[120ms] ${
                      project.status === col.status
                        ? 'bg-accent text-accent-fg'
                        : 'bg-surface-2 text-fg-3 hover:bg-surface-3'
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
              className="w-full py-1.5 text-[12px] font-medium rounded-md bg-accent text-accent-fg hover:brightness-105 transition-all duration-[120ms]"
            >
              Save
            </button>
          </PopoverContent>
        </Popover>
      )}

      {/* Add Member Dialog */}
      <Dialog open={showTagModal} onOpenChange={setShowTagModal}>
        <DialogContent className="bg-surface border border-border" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Member</DialogTitle>
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
                <p className="text-[11px] text-fg-3 mb-2">Current Members ({project.assignments.length})</p>
                <div className="flex flex-wrap gap-2">
                  {project.assignments.map((assignment) => {
                    const mAvatar = assignment.user?.avatar ? getUserAvatar(assignment.userId) : undefined;
                    return (
                      <div key={assignment.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent-soft border border-accent-line">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={mAvatar} alt={assignment.user?.name} />
                          <AvatarFallback className="text-[8px] bg-accent text-accent-fg">{getInitials(assignment.user?.name || '')}</AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] text-accent font-medium">{assignment.user?.name}</span>
                        <span className="text-[10px] text-fg-3">({assignment.role === 'PRIMARY' ? 'Primary' : 'Collab'})</span>
                        <button onClick={(e) => handleRemoveMember(e, assignment.id)} className="text-fg-4 hover:text-status-red">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {filteredUsers.map((user) => {
                const isAlreadyMember = project.assignments.some(a => a.userId === user.id);
                return (
                  <div
                    key={user.id}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-md border transition-colors duration-[120ms] ${
                      isAlreadyMember
                        ? 'border-status-green/30 bg-status-green-soft opacity-60 cursor-default'
                        : 'border-border hover:bg-surface-2 hover:border-line-strong'
                    }`}
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="text-[10px]">{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-foreground">{user.name}</p>
                        {isAlreadyMember && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-green-soft text-status-green font-medium">Added</span>
                        )}
                      </div>
                      <p className="text-[11px] text-fg-3">{user.email}</p>
                    </div>
                    {!isAlreadyMember && (
                      <div className="flex gap-1">
                        <button onClick={() => handleAddMember(user.id, 'PRIMARY')}
                          className="text-[10px] px-2 py-0.5 rounded bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg transition-colors duration-[120ms]">
                          Primary
                        </button>
                        <button onClick={() => handleAddMember(user.id, 'COLLABORATOR')}
                          className="text-[10px] px-2 py-0.5 rounded bg-status-blue-soft text-status-blue hover:bg-status-blue hover:text-white transition-colors duration-[120ms]">
                          Collab
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-center text-fg-3 py-4 text-[13px]">No users found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
