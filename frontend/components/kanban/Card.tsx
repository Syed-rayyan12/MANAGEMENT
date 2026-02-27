'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Project } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useApp } from '@/contexts/useApp';
import { PRIORITY_STYLES } from '@/lib/constants';
import { Calendar, MessageSquare, Paperclip, Clock, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ProjectCardProps {
  project: Project;
  onCardClick: (projectId: string) => void;
}

export function ProjectCard({ project, onCardClick }: ProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });
  const { getUserName, getUserAvatar, getAllUsers, dispatch } = useApp();
  const [showTagModal, setShowTagModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const allUsers = getAllUsers();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const pmName = getUserName(project.pm);
  const pmAvatar = getUserAvatar(project.pm);
  const devName = project.developer ? getUserName(project.developer) : null;
  const devAvatar = project.developer ? getUserAvatar(project.developer) : undefined;
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'Completed';

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

  const handleTagUser = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    // If user is a developer, assign them to the project
    if (user.id.startsWith('dev')) {
      // Update developer in backend
      const token = localStorage.getItem('token');
      // Use shared API_BASE_URL
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { API_BASE_URL } = require('@/lib/api-service');
      fetch(`${API_BASE_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ developerId: userId })
      }).catch(error => {
        console.error('Error updating developer:', error);
      });

      // Update local state
      dispatch({
        type: 'UPDATE_DEVELOPER',
        payload: {
          projectId: project.id,
          developerId: userId,
          userId: project.pm
        }
      });

      setShowTagModal(false);
      setSearchQuery('');
      return;
    }

    // Otherwise, add as label
    const newLabel = {
      id: `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

    setShowTagModal(false);
    setSearchQuery('');
  };

  const handleRemoveTag = (e: React.MouseEvent, labelId: string) => {
    e.stopPropagation();
    
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

  const filteredUsers = allUsers.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-[#1a1f2e] dark:border-[#2d3548] cursor-pointer hover:shadow-lg hover:shadow-orange-500/10 dark:hover:shadow-orange-500/20 transition-all p-3 space-y-3"
    >
      {/* Drag Handle - separate from click area */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing -mx-3 -mt-3 px-3 pt-3 pb-2 border-b border-gray-100 dark:border-[#2d3548]"
      >
        <div className="flex items-center justify-center">
          <div className="w-8 h-1 bg-gray-300 dark:bg-orange-500/50 rounded-full"></div>
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
          <h4 className="font-semibold text-gray-900 dark:text-orange-400 line-clamp-2">{project.name}</h4>
        </div>

        {/* Tags with Initials and Developer */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Show developer badge if assigned */}
          {project.developer && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-500 text-white text-xs font-bold">
              <Avatar className="w-4 h-4 border">
                <AvatarImage src={devAvatar} alt={devName || ''} />
                <AvatarFallback className="text-[8px]">{devName?.split(' ')[0][0]}</AvatarFallback>
              </Avatar>
              <span>DEV</span>
            </div>
          )}
          {project.labels.map((label) => (
            <span
              key={label.id}
              className="text-xs font-bold px-2 py-1 rounded bg-orange-500 text-white flex items-center gap-1 group"
            >
              {getInitials(label.name)}
              <X 
                className="w-3 h-3 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity" 
                onClick={(e) => handleRemoveTag(e, label.id)}
              />
            </span>
          ))}
          <button
            onClick={handleAddTag}
            className="w-6 h-6 rounded bg-orange-500/20 hover:bg-orange-500/30 flex items-center justify-center transition-colors"
          >
            <Plus className="w-3 h-3 text-orange-500" />
          </button>
        </div>

        {/* Avatars */}
        {/* <div className="flex items-center gap-2">
          <Avatar className="w-6 h-6 border dark:border-orange-500/30">
            <AvatarImage src={pmAvatar} alt={pmName} />
            <AvatarFallback>{pmName.split(' ')[0][0]}</AvatarFallback>
          </Avatar>
          {devAvatar && (
            <Avatar className="w-6 h-6 border dark:border-orange-500/30">
              <AvatarImage src={devAvatar} alt={devName || ''} />
              <AvatarFallback>{devName?.split(' ')[0][0]}</AvatarFallback>
            </Avatar>
          )}
        </div> */}

        {/* Latest Comment */}
        {project.comments.length > 0 && (
          <div className="bg-gray-50 dark:bg-[#232938] rounded-lg p-2 border border-gray-200 dark:border-[#2d3548]">
            <div className="flex items-center gap-1 mb-1">
              <MessageSquare className="w-3 h-3 text-gray-500 dark:text-orange-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-orange-400">Latest comment:</span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
              {project.comments[project.comments.length - 1].content}
            </p>
          </div>
        )}

        {/* Priority & Due Date */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={`px-2 py-1 rounded font-medium ${priorityStyle.color} ${priorityStyle.bgColor} dark:bg-orange-500/20 dark:text-orange-400 dark:border dark:border-orange-500/30`}>
            {priorityStyle.label}
          </span>
          {isOverdue && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
              <Clock className="w-3 h-3" />
              Overdue
            </span>
          )}
          {project.dueDate && !isOverdue && (
            <span className="flex items-center gap-1 text-gray-600 dark:text-orange-400">
              <Calendar className="w-3 h-3" />
              {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-orange-400">
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

      {/* Tag User Modal */}
      <Dialog open={showTagModal} onOpenChange={setShowTagModal}>
        <DialogContent className="dark:bg-[#1a1f2e] dark:border-orange-500/30" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-white">Assign Person / Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleTagUser(user.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-500 transition-colors"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                      {user.id.startsWith('dev') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500 text-white font-bold">
                          DEV
                        </span>
                      )}
                      {user.id.startsWith('pm') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500 text-white font-bold">
                          PM
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                </button>
              ))}
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
