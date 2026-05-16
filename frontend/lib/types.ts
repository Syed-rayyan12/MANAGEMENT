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

export type ColumnPhase = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'ON_HOLD';

export interface BoardColumn {
  id: string;
  name: string;
  key: string;
  color: string;
  position: number;
  phase: ColumnPhase;
}

export interface KanbanColumn {
  status: string;
  label: string;
  color: string;
  isCustom?: boolean;
  phase?: ColumnPhase;
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
  assignments: ProjectAssignment[];
  labels: Label[];
  description: string;
  checklist: ChecklistItem[];
  comments: Comment[];
  attachments: Attachment[];
  activityLog: ActivityLog[];
  createdAt: Date;
  updatedAt: Date;
  clientId?: string | null;
  client?: { id: string; name: string; contactEmail: string | null } | null;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  teams?: TeamInfo[];
  specialization?: Specialization;
}

// ─── Invoices ──────────────────────────────────────

export type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'FAILED';

export interface Invoice {
  id: string;
  clientName: string;
  clientEmail: string | null;
  description: string;
  amount: string; // Decimal comes as string from Prisma
  currency: string;
  status: InvoiceStatus;
  squarePaymentLinkId: string | null;
  paymentLink: string | null;
  paidAt: string | null;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  teamId: string;
  team: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Admin ─────────────────────────────────────────

export type Specialization = 'LOGO_DESIGNER' | 'FIGMA_DESIGNER' | 'DEVELOPER' | 'CONTENT_WRITER' | 'QA';

export type AssignmentRole = 'PRIMARY' | 'COLLABORATOR';
export type AssignmentStatus = 'ACTIVE' | 'DONE';

export interface ProjectAssignment {
  id: string;
  projectId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
    specialization?: Specialization;
  };
  role: AssignmentRole;
  status: AssignmentStatus;
  assignedAt: string;
  completedAt: string | null;
}

export interface Client {
  id: string;
  name: string;
  contactEmail: string | null;
  organizationId: string;
  projects?: {
    id: string;
    name: string;
    status: string;
    board?: { name: string; slug: string };
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  specialization?: Specialization;
  avatar?: string;
  teams: { id: string; name: string; slug: string }[];
  createdAt: string;
  // Basic stats (from getEmployees)
  activeProjects?: number;
  completedProjects?: number;
  totalRevenue?: number;
  teamMembersCount?: number;
}

export interface KPIData {
  totalRevenueAllTime: number;
  totalRevenueThisMonth: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  liveProjects: number;
  projectsByBoard: { id: string; name: string; slug: string; _count: { projects: number } }[];
  revenueByTeam: { id: string; name: string; slug: string; totalRevenue: number }[];
  newClientsThisMonth: number;
  activeAssignments: number;
  completedAssignmentsThisMonth: number;
}

export interface InvoiceBreakdown {
  [status: string]: { count: number; amount: number };
}

export interface BoardBreakdown {
  boardId: string;
  boardName: string;
  boardSlug: string;
  count: number;
}

export interface TeamMemberStats {
  id: string;
  name: string;
  role: string;
  username: string;
  avatar: string | null;
  specialization?: Specialization;
  teamId: string;
  revenue: number;
  activeProjects: number;
  completedProjects: number;
}

export interface TeamAggregate {
  totalRevenue: number;
  revenueThisMonth: number;
  invoiceBreakdown: InvoiceBreakdown;
  activeProjects: number;
  completedProjects: number;
  members: TeamMemberStats[];
}

export interface EmployeePerformance {
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    specialization?: Specialization;
    avatar: string | null;
    createdAt: string;
    teams: { id: string; name: string; slug: string }[];
  };
  role: string;
  // Common
  activeProjects: number;
  completedProjects: number;
  asPrimary: number;
  asCollaborator: number;
  projectsByBoard: BoardBreakdown[];
  // Sales (PM/TL)
  totalRevenue?: number;
  revenueThisMonth?: number;
  averageInvoiceValue?: number;
  totalInvoicesSent?: number;
  invoiceBreakdown?: InvoiceBreakdown;
  totalClients?: number;
  newClientsThisMonth?: number;
  // TL team
  team?: TeamAggregate;
  // Production (new)
  specialization?: Specialization;
  avgTurnaround?: number;
  fastestTurnaround?: number;
  slowestTurnaround?: number;
  onTimeRate?: number | null;
  onTimeCount?: number;
  lateCount?: number;
  withDueDateCount?: number;
  totalRegressions?: number;
  regressionsThisMonth?: number;
  regressionRate?: number;
  completionTrend?: { month: string; count: number }[];
  recentCompletions?: {
    projectId: string;
    projectName: string;
    board: string;
    boardSlug: string;
    assignedAt: string;
    completedAt: string | null;
    turnaroundDays: number | null;
    onTime: boolean | null;
  }[];
  recentRegressions?: {
    projectId: string;
    projectName: string;
    causedBy: string;
    fromColumn: string;
    toColumn: string;
    createdAt: string;
  }[];
}

export interface AppState {
  projects: Project[];
  currentUser: CurrentUser | null;
  notifications: Notification[];
  activityLog: ActivityLog[];
}

export interface TrashItem {
  id: string;
  name: string;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
  daysRemaining: number;
}

export interface TrashBoard extends TrashItem {
  slug: string;
  _count: { columns: number; projects: number };
}

export interface TrashColumn extends TrashItem {
  key: string;
  board: { id: string; name: string; slug: string };
}

export interface TrashProject extends TrashItem {
  priority: string;
  status: string;
  board: { id: string; name: string; slug: string };
}

export interface TrashData {
  boards: TrashBoard[];
  columns: TrashColumn[];
  projects: TrashProject[];
}
