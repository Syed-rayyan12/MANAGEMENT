import { ProjectPriority, KanbanColumn } from './types';
import { Sparkles, Palette, Code, FileText, FolderKanban } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Fallback columns if workspace columns fail to load
export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { status: 'todo', label: 'To Do', color: '#6B7280', isCustom: false, phase: 'NOT_STARTED' },
  { status: 'in-progress', label: 'In Progress', color: '#3B82F6', isCustom: false, phase: 'IN_PROGRESS' },
  { status: 'completed', label: 'Completed', color: '#10B981', isCustom: false, phase: 'DONE' },
  { status: 'revisions', label: 'Revisions', color: '#F59E0B', isCustom: false, phase: 'IN_PROGRESS' },
];

// Alias for backward compatibility
export const KANBAN_COLUMNS = DEFAULT_KANBAN_COLUMNS;

export const PRIORITY_STYLES: Record<ProjectPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-fg-3', bgColor: 'bg-surface-3' },
  medium: { label: 'Medium', color: 'text-status-amber', bgColor: 'bg-status-amber-soft' },
  high: { label: 'High', color: 'text-accent', bgColor: 'bg-accent-soft' },
  critical: { label: 'Critical', color: 'text-status-red', bgColor: 'bg-status-red-soft' },
};

export const LABEL_COLORS = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Pink', value: '#EC4899' },
];

export const ALL_USERS_ID_PREFIX = 'user_';

// Centralized board metadata — used by dashboard cards and sidebar
export interface BoardMetadata {
  icon: LucideIcon;
  image: string;
  gradient: string;
  sidebarGradient: string;
  accentColor: string;
  description: string;
}

export const BOARD_METADATA: Record<string, BoardMetadata> = {
  'logo-design': {
    icon: Sparkles,
    image: '/logo-section.png',
    gradient: 'accent',
    sidebarGradient: 'accent',
    accentColor: 'var(--ws-logo)',
    description: 'Brand identity, logos, and visual branding',
  },
  'web-design': {
    icon: Palette,
    image: '/web-design.jpg',
    gradient: 'accent',
    sidebarGradient: 'accent',
    accentColor: 'var(--ws-web-design)',
    description: 'UI/UX design, mockups, and prototypes',
  },
  'web-development': {
    icon: Code,
    image: '/web-development.jpg',
    gradient: 'accent',
    sidebarGradient: 'accent',
    accentColor: 'var(--ws-web-dev)',
    description: 'Frontend, backend, and full-stack development',
  },
  'content': {
    icon: FileText,
    image: '/content-writer.jpg',
    gradient: 'accent',
    sidebarGradient: 'accent',
    accentColor: 'var(--ws-content)',
    description: 'Copywriting, documentation, and media',
  },
};

export const DEFAULT_BOARD_METADATA: BoardMetadata = {
  icon: FolderKanban,
  image: '/logo-section.png',
  gradient: 'accent',
  sidebarGradient: 'accent',
  accentColor: 'var(--fg-3)',
  description: 'Manage projects in this workspace',
};
