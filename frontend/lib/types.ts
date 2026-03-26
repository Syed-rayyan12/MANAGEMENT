export type ProjectStatus = string;
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationType =
  | 'assigned'    // you were assigned to a project
  | 'comment'     // someone commented on your project
  | 'status'      // project status changed
  | 'completed'   // project marked as completed
  | 'priority'    // priority escalated to CRITICAL
  | 'deleted'     // project you were on was deleted
  | 'attachment'  // file uploaded to your project
  | 'checklist'   // checklist fully completed
  | 'due_date'    // due date reminder
  | 'developer';  // developer changed
export type AttachmentType = 'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'other';

export interface TeamInfo {
  id: string;
  slug: string;
  name: string;
}

export interface BoardInfo {
  id: string;
  name: string;
  slug?: string;
  columns?: BoardColumn[];
}

export interface BoardColumn {
  id: string;
  name: string;
  key: string;
  color: string;
  position: number;
}

export interface KanbanColumn {
  status: string;
  label: string;
  color: string;
  isCustom?: boolean;
}

export interface ProjectManager {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  teams?: { id: string; slug: string; name: string }[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  timestamp: Date;
}

export interface Attachment {
  id: string;
  filename: string;
  type: AttachmentType;
  url: string;
  uploadedAt: Date;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  projectId: string;
  read: boolean;
  timestamp: Date;
  message: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  boardId: string;
  board?: BoardInfo;
  teamId?: string;
  team?: TeamInfo;
  status: ProjectStatus;
  dueDate: Date | null;
  priority: ProjectPriority;
  image: string | null;
  position: number;
  pm: string; // PM ID
  developer: string | null; // Developer ID
  labels: Label[];
  description: string;
  checklist: ChecklistItem[];
  comments: Comment[];
  attachments: Attachment[];
  activityLog: ActivityLog[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  teams?: TeamInfo[];
}

export interface AppState {
  projects: Project[];
  currentUser: CurrentUser | null;
  notifications: Notification[];
  activityLog: ActivityLog[];
}
