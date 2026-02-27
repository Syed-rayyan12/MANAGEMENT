// API Service for Project Management
// Base URL for your backend API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

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
  // Login
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

  // Get current user
  getMe: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

// Project APIs
export const projectAPI = {
  // Create a new project
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

  // Get all projects
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  // Get Logo Design projects
  getLogoDesign: async () => {
    const response = await fetch(`${API_BASE_URL}/projects/logo-design`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  // Get Web Design projects
  getWebDesign: async () => {
    const response = await fetch(`${API_BASE_URL}/projects/web-design`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  // Get Web Development projects
  getWebDevelopment: async () => {
    const response = await fetch(`${API_BASE_URL}/projects/web-development`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  // Get Content Writer projects
  getContentWriter: async () => {
    const response = await fetch(`${API_BASE_URL}/projects/content-writer`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  // Get project by ID
  getById: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  // Update project
  update: async (id: string, updateData: any) => {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updateData),
    });
    return await response.json();
  },

  // Delete project
  delete: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return await response.json();
  },
};

// Dashboard APIs
export const dashboardAPI = {
  // Get dashboard overview
  getOverview: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
      headers: getHeaders(),
    });
    return await response.json();
  },

  // Get user-specific stats
  getMyStats: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard/my-stats`, {
      headers: getHeaders(),
    });
    return await response.json();
  },
};

// Example Usage in React Component:
/*
import { projectAPI, authAPI, dashboardAPI } from '@/lib/api-service';

// In your component:
const [logoProjects, setLogoProjects] = useState([]);

// Fetch logo design projects
const fetchLogoProjects = async () => {
  const result = await projectAPI.getLogoDesign();
  if (result.success) {
    setLogoProjects(result.data.projects);
  }
};

// Create a new project
const handleCreateProject = async () => {
  const result = await projectAPI.create({
    name: 'New Logo Design',
    workspace: 'LOGO',
    description: 'Design a modern logo',
    priority: 'HIGH',
    dueDate: '2026-03-01'
  });
  
  if (result.success) {
    console.log('Project created:', result.data.project);
    // Refresh the projects list
    fetchLogoProjects();
  }
};

// On component mount
useEffect(() => {
  fetchLogoProjects();
}, []);
*/
