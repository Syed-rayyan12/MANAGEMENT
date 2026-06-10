// API Service for Project Management
// Base URL for your backend API
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Get token from localStorage
const getToken = () => {
  return localStorage.getItem('token');
};

/**
 * Centralized fetch wrapper with error intercepting.
 * - Auto-adds Content-Type and Authorization headers
 * - Handles 401 (session expired), 403, 500+ errors globally
 * - Returns the raw Response on success so callers can parse as needed
 */
async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('Network error — please check your connection');
  }

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
    throw new Error('Session expired — please log in again');
  }

  if (response.status === 403) {
    throw new Error("You don't have permission to perform this action");
  }

  if (response.status >= 500) {
    let message = 'An unexpected server error occurred';
    try {
      const body = await response.json();
      if (body.message) {
        message = body.message;
      }
    } catch {
      // response wasn't valid JSON — use default message
    }
    throw new Error(message);
  }

  return response;
}

// Auth APIs
export const authAPI = {
  login: async (username: string, password: string) => {
    // Login uses raw fetch — a 401 here means invalid credentials,
    // not an expired session, so the interceptor should not fire.
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (data.success && data.data.token) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }

    return data;
  },

  getMe: async () => {
    const response = await apiFetch(`${API_BASE_URL}/auth/me`);
    return await response.json();
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  verifyPassword: async (password: string) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return await response.json();
  },
};

// Project APIs
export const projectAPI = {
  create: async (projectData: {
    name: string;
    boardId: string;
    description?: string;
    status?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueDate?: string;
    developerId?: string;
  }) => {
    const response = await apiFetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    return await response.json();
  },

  getAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/projects`);
    return await response.json();
  },

  getByBoard: async (boardId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/board/${boardId}`);
    return await response.json();
  },

  getById: async (id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${id}`);
    return await response.json();
  },

  update: async (id: string, updateData: any) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
    return await response.json();
  },

  delete: async (id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
    });
    return await response.json();
  },

  // ─── Comments ────────────────────────────────────
  addComment: async (projectId: string, content: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    return await response.json();
  },

  updateComment: async (projectId: string, commentId: string, content: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
    return await response.json();
  },

  deleteComment: async (projectId: string, commentId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    return await response.json();
  },

  // ─── Checklist ───────────────────────────────────
  updateChecklist: async (projectId: string, items: { title: string; completed: boolean; position: number }[]) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/checklist`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
    return await response.json();
  },

  // ─── Labels ──────────────────────────────────────
  addLabel: async (projectId: string, name: string, color: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    return await response.json();
  },

  removeLabel: async (projectId: string, labelId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/labels/${labelId}`, {
      method: 'DELETE',
    });
    return await response.json();
  },

  // ─── Attachments ─────────────────────────────────
  addAttachment: async (projectId: string, data: { filename: string; url: string; key?: string; type: string; size?: number }) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return await response.json();
  },

  removeAttachment: async (projectId: string, attachmentId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
    return await response.json();
  },
};

// Users APIs
export const usersAPI = {
  getAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/users`);
    return await response.json();
  },

  getByRole: async (role: string) => {
    const response = await apiFetch(`${API_BASE_URL}/users/role/${role}`);
    return await response.json();
  },

  getById: async (id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/users/${id}`);
    return await response.json();
  },
};

// Upload APIs (R2 CDN)
export const uploadAPI = {
  getPresignedUrl: async (filename: string, contentType: string, fileSize: number, folder = 'uploads') => {
    const response = await apiFetch(`${API_BASE_URL}/upload/presign`, {
      method: 'POST',
      body: JSON.stringify({ filename, contentType, fileSize, folder }),
    });
    return await response.json();
  },

  /**
   * Upload a file directly to R2 using a presigned URL.
   * Returns the public CDN URL on success.
   */
  uploadFile: async (file: File, folder = 'uploads'): Promise<{ publicUrl: string; key: string } | null> => {
    try {
      // 1. Get presigned URL from backend (uses apiFetch via getPresignedUrl)
      const presignResult = await uploadAPI.getPresignedUrl(file.name, file.type, file.size, folder);
      if (!presignResult.success) {
        console.error('Presign failed:', presignResult.message);
        return null;
      }

      // 2. PUT the file directly to R2 (raw fetch — external URL, not our API)
      const uploadResponse = await fetch(presignResult.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        console.error('Upload to R2 failed:', uploadResponse.statusText);
        return null;
      }

      return { publicUrl: presignResult.publicUrl, key: presignResult.key };
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  },

  deleteFile: async (key: string) => {
    const response = await apiFetch(`${API_BASE_URL}/upload`, {
      method: 'DELETE',
      body: JSON.stringify({ key }),
    });
    return await response.json();
  },
};

// Dashboard APIs
export const dashboardAPI = {
  getOverview: async () => {
    const response = await apiFetch(`${API_BASE_URL}/dashboard/overview`);
    return await response.json();
  },

  getMyStats: async () => {
    const response = await apiFetch(`${API_BASE_URL}/dashboard/my-stats`);
    return await response.json();
  },
};

// Notification APIs
export const notificationAPI = {
  getAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/notifications`);
    return await response.json();
  },

  getUnreadCount: async () => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/unread-count`);
    return await response.json();
  },

  markAsRead: async (id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PUT',
    });
    return await response.json();
  },

  markAllAsRead: async () => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PUT',
    });
    return await response.json();
  },
};

// Team APIs
export const teamAPI = {
  getMyTeams: async () => {
    const response = await apiFetch(`${API_BASE_URL}/teams/my-teams`);
    return await response.json();
  },

  getBySlug: async (slug: string) => {
    const response = await apiFetch(`${API_BASE_URL}/teams/${slug}`);
    return await response.json();
  },
};

// Invoice APIs
export const invoiceAPI = {
  create: async (data: {
    clientName: string;
    clientEmail?: string;
    description: string;
    amount: number;
    teamId: string;
  }) => {
    const response = await apiFetch(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return await response.json();
  },

  getAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/invoices`);
    return await response.json();
  },

  cancel: async (id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/invoices/${id}/cancel`, {
      method: 'POST',
    });
    return await response.json();
  },
};

// Board APIs
export const boardAPI = {
  getAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/boards`);
    return await response.json();
  },

  getBySlug: async (slug: string) => {
    const response = await apiFetch(`${API_BASE_URL}/boards/${slug}`);
    return await response.json();
  },

  getColumns: async (boardId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/boards/${boardId}/columns`);
    return await response.json();
  },

  create: async (name: string) => {
    const response = await apiFetch(`${API_BASE_URL}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return await response.json();
  },

  addColumn: async (boardId: string, name: string, color?: string, phase?: string) => {
    const response = await apiFetch(`${API_BASE_URL}/boards/${boardId}/columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, phase }),
    });
    return await response.json();
  },

  updateColumn: async (boardId: string, columnId: string, data: { name?: string; color?: string; phase?: string }) => {
    const response = await apiFetch(`${API_BASE_URL}/boards/${boardId}/columns/${columnId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await response.json();
  },

  getAllColumns: async () => {
    const response = await apiFetch(`${API_BASE_URL}/boards/columns/all`);
    return await response.json();
  },
};

// Admin APIs (Executive only)
export const adminAPI = {
  getKPIs: async () => {
    const response = await apiFetch(`${API_BASE_URL}/admin/kpis`);
    return await response.json();
  },

  getEmployees: async () => {
    const response = await apiFetch(`${API_BASE_URL}/admin/employees`);
    return await response.json();
  },

  getEmployeePerformance: async (id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/employees/${id}/performance`);
    return await response.json();
  },

  createEmployee: async (data: {
    name: string;
    email: string;
    username: string;
    role: string;
    specialization?: string;
    teamId?: string;
  }) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/employees`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return await response.json();
  },

  deleteEmployee: async (id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/employees/${id}`, {
      method: 'DELETE',
    });
    return await response.json();
  },

  getTeams: async () => {
    const response = await apiFetch(`${API_BASE_URL}/admin/teams`);
    return await response.json();
  },
};

// Client APIs
export const clientAPI = {
  getAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/clients`);
    return await response.json();
  },

  create: async (data: { name: string; contactEmail?: string | null }) => {
    const response = await apiFetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return await response.json();
  },
};

// Assignment APIs
export const assignmentAPI = {
  add: async (projectId: string, userId: string, role: string = 'PRIMARY') => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/assignments`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
    return await response.json();
  },
  update: async (projectId: string, assignmentId: string, data: { role?: string; status?: string }) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/assignments/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return await response.json();
  },
  remove: async (projectId: string, assignmentId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
    return await response.json();
  },
};

// Trash APIs
export const trashAPI = {
  getAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/trash`);
    return await response.json();
  },

  restore: async (type: 'board' | 'column' | 'project', id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/trash/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    });
    return await response.json();
  },

  softDeleteBoard: async (boardId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/boards/${boardId}/soft-delete`, {
      method: 'POST',
    });
    return await response.json();
  },

  softDeleteColumn: async (boardId: string, columnId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/boards/${boardId}/columns/${columnId}/soft-delete`, {
      method: 'POST',
    });
    return await response.json();
  },

  softDeleteProject: async (projectId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/soft-delete`, {
      method: 'POST',
    });
    return await response.json();
  },
};

// Performance APIs
export const performanceAPI = {
  getMyPerformance: async () => {
    const response = await apiFetch(`${API_BASE_URL}/performance/me`);
    return await response.json();
  },
};

// Attendance APIs
export const attendanceAPI = {
  checkIn: async () => {
    const response = await apiFetch(`${API_BASE_URL}/attendance/check-in`, { method: 'POST' });
    return await response.json();
  },

  checkOut: async () => {
    const response = await apiFetch(`${API_BASE_URL}/attendance/check-out`, { method: 'POST' });
    return await response.json();
  },

  getToday: async () => {
    const response = await apiFetch(`${API_BASE_URL}/attendance/today`);
    return await response.json();
  },

  getMyHistory: async (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const response = await apiFetch(`${API_BASE_URL}/attendance/my-history${qs ? '?' + qs : ''}`);
    return await response.json();
  },

  getTeamAttendance: async (date?: string) => {
    const qs = date ? `?date=${date}` : '';
    const response = await apiFetch(`${API_BASE_URL}/attendance/team${qs}`);
    return await response.json();
  },

  editRecord: async (id: string, data: { checkIn: string; checkOut?: string | null }) => {
    const response = await apiFetch(`${API_BASE_URL}/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return await response.json();
  },

  exportMonthly: async (month: string) => {
    const response = await apiFetch(`${API_BASE_URL}/attendance/export?month=${month}`);
    return await response.json();
  },
};

// Trello Import APIs
export const trelloAPI = {
  getConfig: async () => {
    const response = await apiFetch(`${API_BASE_URL}/trello/config`);
    return await response.json();
  },

  // apiKey/token are optional — the backend uses its own credentials when configured
  getBoards: async (apiKey?: string, token?: string) => {
    const params = new URLSearchParams();
    if (apiKey) params.set('apiKey', apiKey);
    if (token) params.set('token', token);
    const query = params.toString();
    const response = await apiFetch(`${API_BASE_URL}/trello/boards${query ? `?${query}` : ''}`);
    return await response.json();
  },

  startImport: async (trelloBoardId: string, apiKey?: string, token?: string) => {
    const response = await apiFetch(`${API_BASE_URL}/trello/import`, {
      method: 'POST',
      body: JSON.stringify({ apiKey: apiKey || undefined, token: token || undefined, trelloBoardId }),
    });
    return await response.json();
  },

  getRun: async (runId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/trello/import/${runId}`);
    return await response.json();
  },

  getLatestRun: async () => {
    const response = await apiFetch(`${API_BASE_URL}/trello/import/latest`);
    return await response.json();
  },
};
