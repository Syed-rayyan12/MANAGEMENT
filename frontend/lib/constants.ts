import { ProjectPriority, KanbanColumn } from './types';

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { status: 'Todo', label: 'Todo', color: '#6B7280', isCustom: false },
  { status: 'in-progress', label: 'In Progress', color: '#3B82F6', isCustom: false },
  { status: 'Completed', label: 'Completed', color: '#10B981', isCustom: false },
  { status: 'Revisons', label: 'Revisions', color: '#F59E0B', isCustom: false },
];

// Backward compatibility
export const KANBAN_COLUMNS = DEFAULT_KANBAN_COLUMNS;

export const PRIORITY_STYLES: Record<ProjectPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  medium: { label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
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
