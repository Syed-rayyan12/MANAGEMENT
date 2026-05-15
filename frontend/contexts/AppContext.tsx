'use client';

import React, { createContext, useReducer, ReactNode, useCallback, useEffect, useState } from 'react';
import { AppState, Project, CurrentUser, Notification, ActivityLog, ChecklistItem, Comment, Attachment, Label, ProjectManager } from '@/lib/types';
import { projectAPI, usersAPI, notificationAPI } from '@/lib/api-service';

export type AppAction =
  | { type: 'SET_USER'; payload: CurrentUser }
  | { type: 'LOGOUT' }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'CREATE_PROJECT'; payload: { project: Project; userId: string } }
  | { type: 'DELETE_PROJECT'; payload: { projectId: string; userId: string } }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT_STATUS'; payload: { projectId: string; newStatus: Project['status']; userId: string } }
  | { type: 'ADD_COMMENT'; payload: { projectId: string; comment: Comment; userId: string } }
  | { type: 'UPDATE_COMMENT'; payload: { projectId: string; commentId: string; content: string; userId: string } }
  | { type: 'UPDATE_CHECKLIST'; payload: { projectId: string; checklist: ChecklistItem[]; userId: string } }
  | { type: 'ADD_LABEL'; payload: { projectId: string; label: Label; userId: string } }
  | { type: 'REMOVE_LABEL'; payload: { projectId: string; labelId: string; userId: string } }
  | { type: 'UPDATE_DUE_DATE'; payload: { projectId: string; dueDate: Date | null; userId: string } }
  | { type: 'UPDATE_PRIORITY'; payload: { projectId: string; priority: Project['priority']; userId: string } }
  | { type: 'UPDATE_DESCRIPTION'; payload: { projectId: string; description: string; userId: string } }
  | { type: 'UPDATE_NAME'; payload: { projectId: string; name: string; userId: string } }
  | { type: 'UPDATE_IMAGE'; payload: { projectId: string; image: string | null; userId: string } }
  | { type: 'ADD_ATTACHMENT'; payload: { projectId: string; attachment: Attachment; userId: string } }
  | { type: 'REMOVE_ATTACHMENT'; payload: { projectId: string; attachmentId: string; userId: string } }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ'; payload: string }
  | { type: 'ADD_ACTIVITY'; payload: ActivityLog };

// Helper to get user from localStorage
const getStoredUser = (): CurrentUser | null => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

const initialState: AppState = {
  projects: [], // Start with empty, will be fetched from backend
  currentUser: getStoredUser(),
  notifications: [],
  activityLog: [],
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER': {
      // Save user to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(action.payload));
      }
      return {
        ...state,
        currentUser: action.payload,
      };
    }

    case 'LOGOUT': {
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
      return {
        ...state,
        currentUser: null,
        notifications: [],
      };
    }

    case 'SET_PROJECTS': {
      return {
        ...state,
        projects: action.payload,
      };
    }

    case 'CREATE_PROJECT': {
      const { project, userId } = action.payload;
      return {
        ...state,
        projects: [...state.projects, project],
        activityLog: [
          ...state.activityLog,
          {
            id: Math.random().toString(36),
            userId,
            action: `Created project: ${project.name}`,
            timestamp: new Date(),
          },
        ],
      };
    }

    case 'DELETE_PROJECT': {
      const { projectId, userId } = action.payload;
      const project = state.projects.find((p) => p.id === projectId);
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== projectId),
        activityLog: [
          ...state.activityLog,
          {
            id: Math.random().toString(36),
            userId,
            action: `Deleted project: ${project?.name || 'Unknown'}`,
            timestamp: new Date(),
          },
        ],
      };
    }

    case 'UPDATE_PROJECT': {
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.payload.id ? action.payload : p)),
      };
    }

    case 'UPDATE_PROJECT_STATUS': {
      const { projectId, newStatus, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, status: newStatus, updatedAt: new Date() } : p
        ),
        activityLog: [
          ...state.activityLog,
          {
            id: Math.random().toString(36),
            userId,
            action: `Moved to ${newStatus}`,
            timestamp: new Date(),
          },
        ],
      };
    }

    case 'ADD_COMMENT': {
      const { projectId, comment, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                comments: [...p.comments, comment],
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: 'Added comment',
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'UPDATE_COMMENT': {
      const { projectId, commentId, content, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                comments: p.comments.map((c) =>
                  c.id === commentId ? { ...c, content } : c
                ),
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: 'Updated comment',
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'UPDATE_CHECKLIST': {
      const { projectId, checklist, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                checklist,
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: 'Updated checklist',
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'ADD_LABEL': {
      const { projectId, label, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                labels: [...p.labels, label],
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: `Added label: ${label.name}`,
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'REMOVE_LABEL': {
      const { projectId, labelId, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                labels: p.labels.filter((l) => l.id !== labelId),
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: 'Removed label',
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'UPDATE_DUE_DATE': {
      const { projectId, dueDate, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                dueDate,
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: `Changed due date to ${dueDate?.toLocaleDateString() || 'No date'}`,
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'UPDATE_PRIORITY': {
      const { projectId, priority, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                priority,
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: `Changed priority to ${priority}`,
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'UPDATE_DESCRIPTION': {
      const { projectId, description, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                description,
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: 'Updated description',
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'UPDATE_NAME': {
      const { projectId, name, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                name,
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: 'Changed project name',
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'UPDATE_IMAGE': {
      const { projectId, image, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                image,
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: 'Updated project image',
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'ADD_ATTACHMENT': {
      const { projectId, attachment, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                attachments: [...p.attachments, attachment],
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: `Added attachment: ${attachment.filename}`,
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'REMOVE_ATTACHMENT': {
      const { projectId, attachmentId, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                attachments: p.attachments.filter((a) => a.id !== attachmentId),
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: 'Removed attachment',
                    timestamp: new Date(),
                  },
                ],
              }
            : p
        ),
      };
    }

    case 'ADD_NOTIFICATION': {
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    }

    case 'SET_NOTIFICATIONS': {
      return {
        ...state,
        notifications: action.payload,
      };
    }

    case 'MARK_NOTIFICATION_READ': {
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };
    }

    case 'MARK_ALL_NOTIFICATIONS_READ': {
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.userId === action.payload ? { ...n, read: true } : n
        ),
      };
    }

    case 'ADD_ACTIVITY': {
      return {
        ...state,
        activityLog: [...state.activityLog, action.payload],
      };
    }

    default:
      return state;
  }
}

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  users: ProjectManager[];
  isLoading: boolean;
  getAllUsers: () => ProjectManager[];
  getUserName: (userId: string) => string;
  getUserAvatar: (userId: string) => string | undefined;
} | null>(null);

// ─── Map backend project to frontend Project shape ────────

function mapApiProject(p: any): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    status: p.status || 'todo',
    priority: (p.priority?.toLowerCase() || 'medium') as Project['priority'],
    dueDate: p.dueDate ? new Date(p.dueDate) : null,
    assignments: (p.assignments || []).map((a: any) => ({
      id: a.id,
      projectId: a.projectId,
      userId: a.userId || a.user?.id,
      user: a.user ? {
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        avatar: a.user.avatar || null,
        role: a.user.role,
        specialization: a.user.specialization || undefined,
      } : null,
      role: a.role || 'PRIMARY',
      status: a.status || 'ACTIVE',
      assignedAt: a.assignedAt,
      completedAt: a.completedAt || null,
    })),
    boardId: p.boardId || p.board?.id || '',
    board: p.board ? { id: p.board.id, name: p.board.name, slug: p.board.slug } : undefined,
    teamId: p.teamId || p.team?.id || undefined,
    team: p.team ? { id: p.team.id, name: p.team.name, slug: p.team.slug } : undefined,
    clientId: p.clientId || null,
    client: p.client ? { id: p.client.id, name: p.client.name, contactEmail: p.client.contactEmail } : null,
    image: p.image || null,
    position: p.position ?? 0,
    labels: (p.labels || []).map((pl: any) => {
      // Handle both { label: { id, name, color } } (ProjectLabel join) and { id, name, color } (direct)
      const l = pl.label || pl;
      return { id: l.id, name: l.name, color: l.color };
    }),
    checklist: (p.checklist || []).map((ci: any) => ({
      id: ci.id,
      title: ci.title,
      completed: ci.completed,
    })),
    comments: (p.comments || []).map((c: any) => ({
      id: c.id,
      userId: c.userId,
      content: c.content,
      timestamp: new Date(c.createdAt || c.timestamp),
    })),
    attachments: (p.attachments || []).map((a: any) => ({
      id: a.id,
      filename: a.filename,
      type: a.type as any,
      url: a.url,
      uploadedAt: new Date(a.uploadedAt),
    })),
    activityLog: (p.activities || p.activityLog || []).map((al: any) => ({
      id: al.id,
      userId: al.userId,
      action: al.action,
      timestamp: new Date(al.createdAt || al.timestamp),
      details: al.details || undefined,
    })),
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [users, setUsers] = useState<ProjectManager[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getAllUsers = useCallback(() => users, [users]);

  const getUserName = useCallback((userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.name || 'Unknown User';
  }, [users]);

  const getUserAvatar = useCallback((userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.avatar;
  }, [users]);

  // Fetch users from backend
  useEffect(() => {
    const fetchUsers = async () => {
      if (!state.currentUser || typeof window === 'undefined') return;
      try {
        const result = await usersAPI.getAll();
        if (result.success) {
          setUsers(
            result.data.users.map((u: any) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`,
              role: u.role,
              teams: u.teams || [],
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, [state.currentUser]);

  // Fetch all projects on mount if user is logged in
  useEffect(() => {
    const fetchProjects = async () => {
      if (!state.currentUser || typeof window === 'undefined') return;

      setIsLoading(true);
      try {
        const result = await projectAPI.getAll();
        
        if (result.success) {
          const projects = result.data.projects.map(mapApiProject);
          dispatch({ type: 'SET_PROJECTS', payload: projects });
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [state.currentUser]);

  // Fetch notifications on mount + poll every 30s
  useEffect(() => {
    if (!state.currentUser || typeof window === 'undefined') return;

    const fetchNotifications = async () => {
      try {
        const result = await notificationAPI.getAll();
        if (result.success) {
          const mapped: Notification[] = result.data.notifications.map((n: any) => ({
            id: n.id,
            userId: n.userId,
            type: n.type as Notification['type'],
            projectId: n.projectId || '',
            read: n.read,
            timestamp: new Date(n.createdAt),
            message: n.message,
          }));
          dispatch({ type: 'SET_NOTIFICATIONS', payload: mapped });
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [state.currentUser]);

  return (
    <AppContext.Provider value={{ state, dispatch, users, isLoading, getAllUsers, getUserName, getUserAvatar }}>
      {children}
    </AppContext.Provider>
  );
}
