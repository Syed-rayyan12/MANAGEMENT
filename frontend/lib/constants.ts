import { ProjectPriority, KanbanColumn } from './types';
import { Sparkles, Palette, Code, FileText, FolderKanban } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Fallback columns if workspace columns fail to load
export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { status: 'todo', label: 'To Do', color: '#6B7280', isCustom: false },
  { status: 'in-progress', label: 'In Progress', color: '#3B82F6', isCustom: false },
  { status: 'completed', label: 'Completed', color: '#10B981', isCustom: false },
  { status: 'revisions', label: 'Revisions', color: '#F59E0B', isCustom: false },
];

// Alias for backward compatibility
export const KANBAN_COLUMNS = DEFAULT_KANBAN_COLUMNS;

export const PRIORITY_STYLES: Record<ProjectPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-zinc-600 dark:text-zinc-400', bgColor: 'bg-zinc-500/15' },
  medium: { label: 'Medium', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/15' },
  high: { label: 'High', color: 'text-[#e05c29]', bgColor: 'bg-[#e05c29]/15' },
  critical: { label: 'Critical', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/15' },
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
  description: string;
}

export const BOARD_METADATA: Record<string, BoardMetadata> = {
  'logo-design': {
    icon: Sparkles,
    image: '/logo-section.png',
    gradient: 'from-[#e05c29] via-rose-500 to-orange-400',
    sidebarGradient: 'from-[#e05c29] to-rose-500',
    description: 'Brand identity, logos, and visual branding',
  },
  'web-design': {
    icon: Palette,
    image: '/web-design.jpg',
    gradient: 'from-[#e05c29] via-orange-400 to-amber-400',
    sidebarGradient: 'from-[#e05c29] to-amber-400',
    description: 'UI/UX design, mockups, and prototypes',
  },
  'web-development': {
    icon: Code,
    image: '/web-development.jpg',
    gradient: 'from-orange-400 via-[#e05c29] to-rose-500',
    sidebarGradient: 'from-orange-400 to-[#e05c29]',
    description: 'Frontend, backend, and full-stack development',
  },
  'content': {
    icon: FileText,
    image: '/content-writer.jpg',
    gradient: 'from-amber-500 via-orange-400 to-[#e05c29]',
    sidebarGradient: 'from-amber-500 to-orange-400',
    description: 'Copywriting, documentation, and media',
  },
};

export const DEFAULT_BOARD_METADATA: BoardMetadata = {
  icon: FolderKanban,
  image: '/logo-section.png',
  gradient: 'from-gray-500 via-gray-600 to-gray-700',
  sidebarGradient: 'from-gray-500 to-gray-600',
  description: 'Manage projects in this workspace',
};
