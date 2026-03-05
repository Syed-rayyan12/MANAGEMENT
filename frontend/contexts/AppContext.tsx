'use client';

import React, { createContext, useReducer, ReactNode, useCallback, useEffect } from 'react';
import { AppState, Project, CurrentUser, Notification, ActivityLog, ChecklistItem, Comment, Attachment, Label } from '@/lib/types';
import { SAMPLE_PROJECTS, HARDCODED_USERS } from '@/lib/initial-data';
import { projectAPI } from '@/lib/api-service';

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
  | { type: 'UPDATE_DEVELOPER'; payload: { projectId: string; developerId: string | null; userId: string } }
  | { type: 'UPDATE_PRIORITY'; payload: { projectId: string; priority: Project['priority']; userId: string } }
  | { type: 'UPDATE_DESCRIPTION'; payload: { projectId: string; description: string; userId: string } }
  | { type: 'UPDATE_NAME'; payload: { projectId: string; name: string; userId: string } }
  | { type: 'UPDATE_IMAGE'; payload: { projectId: string; image: string | null; userId: string } }
  | { type: 'ADD_ATTACHMENT'; payload: { projectId: string; attachment: Attachment; userId: string } }
  | { type: 'REMOVE_ATTACHMENT'; payload: { projectId: string; attachmentId: string; userId: string } }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
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

    case 'UPDATE_DEVELOPER': {
      const { projectId, developerId, userId } = action.payload;
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                developer: developerId,
                updatedAt: new Date(),
                activityLog: [
                  ...p.activityLog,
                  {
                    id: Math.random().toString(36),
                    userId,
                    action: `Changed developer to ${developerId || 'Unassigned'}`,
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
  getAllUsers: () => typeof HARDCODED_USERS;
  getUserName: (userId: string) => string;
  getUserAvatar: (userId: string) => string | undefined;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const getAllUsers = useCallback(() => HARDCODED_USERS, []);

  const getUserName = useCallback((userId: string) => {
    const user = HARDCODED_USERS.find((u) => u.id === userId);
    return user?.name || 'Unknown User';
  }, []);

  const getUserAvatar = useCallback((userId: string) => {
    const user = HARDCODED_USERS.find((u) => u.id === userId);
    return user?.avatar;
  }, []);

  // Fetch all projects on mount if user is logged in
  useEffect(() => {
    const fetchProjects = async () => {
      // Only fetch if user is logged in
      if (!state.currentUser || typeof window === 'undefined') return;

      try {
        const result = await projectAPI.getAll();
        
        if (result.success) {
          // Map API projects to local format
          const workspaceMap: Record<string, Project['workspace']> = {
            'LOGO': 'logo',
            'WEB_DESIGN': 'web-design',
            'WEB_DEVELOPMENT': 'web-development',
            'CONTENT': 'content'
          };

          const statusMap: Record<string, Project['status']> = {
            'TODO': 'Todo',
            'IN_PROGRESS': 'in-progress',
            'COMPLETED': 'Completed',
            'REVISIONS': 'Revisons'
          };

          const projects = result.data.projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            status: statusMap[p.status as keyof typeof statusMap] || 'Todo',
            priority: p.priority.toLowerCase() as Project['priority'],
            dueDate: p.dueDate ? new Date(p.dueDate) : null,
            pm: p.pmId,
            developer: p.developerId || null,
            workspace: workspaceMap[p.workspace as keyof typeof workspaceMap] || 'logo',
            image: p.image || null,
            labels: [],
            checklist: [],
            comments: [],
            attachments: [],
            activityLog: [],
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          }));

          dispatch({ type: 'SET_PROJECTS', payload: projects });
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };

    fetchProjects();
  }, [state.currentUser]);

  return (
    <AppContext.Provider value={{ state, dispatch, getAllUsers, getUserName, getUserAvatar }}>
      {children}
    </AppContext.Provider>
  );
}
