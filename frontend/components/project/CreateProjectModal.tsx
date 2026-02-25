'use client';

import React, { useState } from 'react';
import { useApp } from '@/contexts/useApp';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Project, ProjectStatus, ProjectPriority, WorkspaceType } from '@/lib/types';
import { KANBAN_COLUMNS, PRIORITY_STYLES } from '@/lib/constants';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface CreateProjectModalProps {
  onClose: () => void;
  initialStatus?: ProjectStatus;
  initialWorkspace?: string | null;
}

export function CreateProjectModal({ onClose, initialStatus, initialWorkspace }: CreateProjectModalProps) {
  const { state, dispatch, getAllUsers } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Map URL workspace to internal workspace format
  const mapWorkspace = (ws: string | null | undefined): WorkspaceType => {
    if (!ws) return 'logo';
    const mapping: Record<string, WorkspaceType> = {
      'logo-design': 'logo',
      'web-design': 'web-design',
      'web-development': 'web-development',
      'content': 'content',
      'logo': 'logo'
    };
    return mapping[ws] || 'logo';
  };

  const [workspace, setWorkspace] = useState<WorkspaceType>(
    mapWorkspace(initialWorkspace)
  );
  const [status, setStatus] = useState<ProjectStatus>(initialStatus || 'Todo');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [developer, setDeveloper] = useState<string>('none');
  const [imageUrl, setImageUrl] = useState('');

  const allUsers = getAllUsers();
  const developers = allUsers.filter((u) => u.id.startsWith('dev'));

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Project name is required');
      return;
    }

    if (!state.currentUser) return;

    try {
      const token = localStorage.getItem('token');
      
      // Map workspace to API format
      const workspaceMap: Record<string, string> = {
        'logo': 'LOGO',
        'logo-design': 'LOGO',
        'web-design': 'WEB_DESIGN',
        'web-development': 'WEB_DEVELOPMENT',
        'content': 'CONTENT'
      };

      // Map status to API format
      const statusMap: Record<string, string> = {
        'Todo': 'TODO',
        'in-progress': 'IN_PROGRESS',
        'Completed': 'COMPLETED',
        'Revisons': 'REVISIONS'
      };

      const priorityMap: Record<string, string> = {
        'low': 'LOW',
        'medium': 'MEDIUM',
        'high': 'HIGH',
        'critical': 'CRITICAL'
      };

      const projectData = {
        name: name.trim(),
        workspace: workspaceMap[workspace],
        description: description.trim(),
        priority: priorityMap[priority],
        status: statusMap[status],
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        developerId: developer === 'none' ? undefined : developer,
        image: imageUrl.trim() || undefined
      };

      const response = await fetch('http://localhost:5000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(projectData)
      });

      const result = await response.json();

      if (result.success) {
        // Map workspace back to internal format
        const internalWorkspaceMap: Record<string, WorkspaceType> = {
          'LOGO': 'logo',
          'WEB_DESIGN': 'web-design',
          'WEB_DEVELOPMENT': 'web-development',
          'CONTENT': 'content'
        };

        const internalWorkspace = internalWorkspaceMap[result.data.project.workspace] || workspace;

        // Create local project object for immediate UI update
        const newProject: Project = {
          id: result.data.project.id,
          name: name.trim(),
          description: description.trim(),
          workspace: internalWorkspace,
          status,
          priority,
          dueDate: dueDate || null,
          image: imageUrl.trim() || null,
          pm: state.currentUser.id,
          developer: developer === 'none' ? null : developer,
          labels: [],
          checklist: [],
          comments: [],
          attachments: [],
          activityLog: [
            {
              id: Math.random().toString(36),
              userId: state.currentUser.id,
              action: 'Created project',
              timestamp: new Date(),
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        dispatch({
          type: 'CREATE_PROJECT',
          payload: {
            project: newProject,
            userId: state.currentUser.id,
          },
        });

        onClose();
      } else {
        alert(result.message || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto dark:bg-[#1a1f2e] dark:border-orange-500/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold dark:text-orange-400">Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Project Name */}
          <div>
            <Label htmlFor="name" className="dark:text-white">Project Name *</Label>
            <Input
              id="name"
              placeholder="Enter project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 placeholder:text-gray-400 "
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="dark:text-white">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter project description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-24 placeholder:text-gray-400 "
            />
          </div>

          {/* Workspace */}
          <div>
            <Label className="dark:text-white">Workspace *</Label>
            <Select value={workspace} onValueChange={(val) => setWorkspace(val as WorkspaceType)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="logo">Logo Design</SelectItem>
                <SelectItem value="web-design">Web Design</SelectItem>
                <SelectItem value="web-development">Web Development</SelectItem>
                <SelectItem value="content">Content Creation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="dark:text-white">Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as ProjectStatus)}>
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

            <div>
              <Label className="dark:text-white">Priority</Label>
              <Select value={priority} onValueChange={(val) => setPriority(val as ProjectPriority)}>
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
          </div>

          {/* Due Date */}
          <div>
            <Label className="dark:text-white">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal mt-1 text-white"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                  {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus 
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Developer */}
          <div>
            <Label className="dark:text-white">Assign Developer (optional)</Label>
            <Select value={developer} onValueChange={setDeveloper}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select developer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Developer</SelectItem>
                {developers.map((dev) => (
                  <SelectItem key={dev.id} value={dev.id}>
                    {dev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image URL */}
          <div>
            <Label htmlFor="imageUrl" className="dark:text-white">Cover Image URL (optional)</Label>
            <Input
              id="imageUrl"
              // placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 placeholder:text-gray-400 "
            />
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Preview"
                className="mt-2 w-full h-32 object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleCreate} className="flex-1 bg-orange-500 text-white hover:bg-orange-600">
              Create Project
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1 text-white">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
