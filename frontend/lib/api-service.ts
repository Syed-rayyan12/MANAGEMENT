// API Service for Project Management
// Base URL for your backend API
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Get token from localStorage
const getToken = () => {
  return localStorage.getItem('token');
};

// Common headers
const getHeaders = (includeAuth = true) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

// Auth APIs
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(false),
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
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

// Project APIs
export const projectAPI = {
  create: async (projectData: {
    name: string;
    workspace: 'LOGO' | 'WEB_DESIGN' | 'WEB_DEVELOPMENT' | 'CONTENT';
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueDate?: string;
    developerId?: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(projectData),
    });
    return await response.json();
  },

  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  getLogoDesign: async () => {
    const response = await fetch(`${API_BASE_URL}/projects/logo-design`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  getWebDesign: async () => {
    const response = await fetch(`${API_BASE_URL}/projects/web-design`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  getWebDevelopment: async () => {
    const response = await fetch(`${API_BASE_URL}/projects/web-development`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  getContentWriter: async () => {
    const response = await fetch(`${API_BASE_URL}/projects/content-writer`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  update: async (id: string, updateData: any) => {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updateData),
    });
    return await response.json();
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return await response.json();
  },

  // ─── Comments ────────────────────────────────────
  addComment: async (projectId: string, content: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    return await response.json();
  },

  updateComment: async (projectId: string, commentId: string, content: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/comments/${commentId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    return await response.json();
  },

  deleteComment: async (projectId: string, commentId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return await response.json();
  },

  // ─── Checklist ───────────────────────────────────
  updateChecklist: async (projectId: string, items: { title: string; completed: boolean; position: number }[]) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/checklist`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ items }),
    });
    return await response.json();
  },

  // ─── Labels ──────────────────────────────────────
  addLabel: async (projectId: string, name: string, color: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/labels`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, color }),
    });
    return await response.json();
  },

  removeLabel: async (projectId: string, labelId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/labels/${labelId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return await response.json();
  },

  // ─── Attachments ─────────────────────────────────
  addAttachment: async (projectId: string, data: { filename: string; url: string; key?: string; type: string; size?: number }) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/attachments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return await response.json();
  },

  removeAttachment: async (projectId: string, attachmentId: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return await response.json();
  },
};

// Users APIs
export const usersAPI = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  getByRole: async (role: string) => {
    const response = await fetch(`${API_BASE_URL}/users/role/${role}`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      headers: getHeaders(),
    });
    return await response.json();
  },
};

// Upload APIs (R2 CDN)
export const uploadAPI = {
  getPresignedUrl: async (filename: string, contentType: string, fileSize: number, folder = 'uploads') => {
    const response = await fetch(`${API_BASE_URL}/upload/presign`, {
      method: 'POST',
      headers: getHeaders(),
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
      // 1. Get presigned URL from backend
      const presignResult = await uploadAPI.getPresignedUrl(file.name, file.type, file.size, folder);
      if (!presignResult.success) {
        console.error('Presign failed:', presignResult.message);
        return null;
      }

      // 2. PUT the file directly to R2
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
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ key }),
    });
    return await response.json();
  },
};

// Dashboard APIs
export const dashboardAPI = {
  getOverview: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  getMyStats: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/my-stats`, {
      headers: getHeaders(),
    });
    return await response.json();
  },
};
