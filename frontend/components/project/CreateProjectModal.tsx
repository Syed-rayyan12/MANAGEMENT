
'use client';
import { API_BASE_URL, projectAPI, clientAPI, assignmentAPI } from '@/lib/api-service';
import { toast } from 'sonner';

import React, { useState, useEffect } from 'react';
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
import { Project, ProjectStatus, ProjectPriority, Client } from '@/lib/types';
import { DEFAULT_KANBAN_COLUMNS, PRIORITY_STYLES } from '@/lib/constants';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';

interface CreateProjectModalProps {
  onClose: () => void;
  initialStatus?: ProjectStatus;
  initialBoard?: string | null;
}

export function CreateProjectModal({ onClose, initialStatus, initialBoard }: CreateProjectModalProps) {
  const { state, dispatch, getAllUsers } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const [status, setStatus] = useState<ProjectStatus>(initialStatus || 'todo');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const allUsers = getAllUsers();

  useEffect(() => {
    clientAPI.getAll()
      .then(r => { if (r.success) setClients(r.data.clients || []); })
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Project name is required');
      return;
    }

    if (!state.currentUser || !initialBoard) return;

    try {
      const token = localStorage.getItem('token');

      const priorityMap: Record<string, string> = {
        'low': 'LOW',
        'medium': 'MEDIUM',
        'high': 'HIGH',
        'critical': 'CRITICAL'
      };

      const projectData = {
        name: name.trim(),
        boardId: initialBoard,
        description: description.trim(),
        priority: priorityMap[priority],
        status,
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        image: imageUrl.trim() || undefined,
        clientId: (selectedClientId && selectedClientId !== 'none') ? selectedClientId : undefined,
      };

      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(projectData)
      });

      const result = await response.json();

      if (result.success) {
        const p = result.data.project;

        // Add selected members as assignments
        const addedAssignments: any[] = [];
        for (const memberId of selectedMembers) {
          if (memberId === state.currentUser?.id) continue; // Creator already assigned by backend
          try {
            const assignResult = await assignmentAPI.add(p.id, memberId, 'PRIMARY');
            if (assignResult.success) {
              addedAssignments.push(assignResult.data.assignment);
            }
          } catch { /* continue */ }
        }

        // Create local project object for immediate UI update
        const newProject: Project = {
          id: p.id,
          name: name.trim(),
          description: description.trim(),
          boardId: p.boardId || initialBoard,
          board: p.board ? { id: p.board.id, name: p.board.name } : undefined,
          teamId: p.teamId,
          team: p.team ? { id: p.team.id, slug: p.team.slug, name: p.team.name } : undefined,
          status: p.status || status,
          priority: (p.priority || 'MEDIUM').toLowerCase() as ProjectPriority,
          dueDate: dueDate || null,
          image: imageUrl.trim() || null,
          position: 0,
          clientId: (selectedClientId && selectedClientId !== 'none') ? selectedClientId : null,
          assignments: [
            // Creator's assignment (from backend response)
            ...(p.assignments || []),
            // Additional assignments we just created
            ...addedAssignments,
          ],
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

        toast.success('Project created successfully');
        onClose();
      } else {
        toast.error(result.message || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project. Please try again.');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-white/10 ring-1 ring-[#e05c29]/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Project Name */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Project Name *</Label>
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
            <Label htmlFor="description" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter project description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-24 placeholder:text-gray-400 "
            />
          </div>

          {/* Client */}
          <div>
            <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Client (optional)</Label>
            <Select
              value={selectedClientId}
              onValueChange={(val) => {
                if (val === 'new-client') {
                  setShowNewClientInput(true);
                  setSelectedClientId('');
                } else {
                  setShowNewClientInput(false);
                  setSelectedClientId(val);
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="No client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                <SelectItem value="new-client">+ Create new client</SelectItem>
              </SelectContent>
            </Select>
            {showNewClientInput && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Client name"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#e05c29]/30 focus:border-[#e05c29]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newClientName.trim()) return;
                    try {
                      const result = await clientAPI.create({ name: newClientName.trim() });
                      if (result.success) {
                        const newClient = result.data.client;
                        setClients(prev => [...prev, newClient]);
                        setSelectedClientId(newClient.id);
                        setShowNewClientInput(false);
                        setNewClientName('');
                      } else {
                        toast.error(result.message || 'Failed to create client');
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to create client');
                    }
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 transition-all"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as ProjectStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_KANBAN_COLUMNS.map((col) => (
                    <SelectItem key={col.status} value={col.status}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Priority</Label>
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
            <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal mt-1 text-zinc-900 dark:text-zinc-100"
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

          {/* Members */}
          <div>
            <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Members (optional)</Label>
            {/* Selected members chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                {selectedMembers.map((uid) => {
                  const u = allUsers.find(x => x.id === uid);
                  return u ? (
                    <span key={uid} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-xs text-orange-400 font-medium">
                      {u.name}
                      <button onClick={() => setSelectedMembers(prev => prev.filter(id => id !== uid))} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <Select onValueChange={(val) => {
              if (!selectedMembers.includes(val)) {
                setSelectedMembers(prev => [...prev, val]);
              }
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Add member..." />
              </SelectTrigger>
              <SelectContent>
                {allUsers
                  .filter(u => !selectedMembers.includes(u.id))
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image URL */}
          <div>
            <Label htmlFor="imageUrl" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cover Image URL (optional)</Label>
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
            <Button onClick={handleCreate} className="flex-1 rounded-lg bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 text-white shadow-[0_4px_20px_rgba(224,92,41,0.35)] transition-all duration-200">
              Create Project
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1 rounded-lg text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
