import { useApp } from '@/contexts/useApp';

/**
 * Role-based permission helpers.
 *
 * Permissions:
 *   - canCreateProject: PM, TL, PRODUCTION
 *   - canDeleteProject: PM, PRODUCTION
 *   - canAddColumn: PM, TL, PRODUCTION
 *   - canChangePriority: PM, TL, PRODUCTION, EXECUTIVE
 *   - canEditProject: PM, TL, PRODUCTION
 *   - canComment: everyone
 *   - isReadOnly: EXECUTIVE (view-only)
 */
export function usePermissions() {
  const { state } = useApp();
  const role = state.currentUser?.role;
  const userId = state.currentUser?.id;

  const isPM = role === 'PM';
  const isTL = role === 'TL';
  const isExec = role === 'EXECUTIVE';
  const isProd = role === 'PRODUCTION';

  return {
    // Project CRUD
    canCreateProject: true,
    canDeleteProject: isPM || isProd,

    // Board management
    canAddColumn: true,

    // Project fields
    canChangePriority: isPM || isTL || isExec || isProd,
    canChangeStatus: isPM || isTL || isProd,
    canEditProjectFields: isPM || isTL || isProd,

    // Interaction
    canComment: true, // everyone can comment
    canUploadAttachment: isPM || isTL || isProd,
    canManageChecklist: isPM || isTL || isProd,

    // Invoices
    canAccessInvoices: isPM || isTL || isExec,
    canCreateInvoice: isPM || isTL || isExec,

    // Drag and drop
    canDragCards: isPM || isTL || isProd,

    // Trash / soft-delete
    canSoftDelete: isPM || isProd,

    // Performance
    canAccessPerformance: isProd,

    // Attendance
    canCheckIn: isPM || isTL || isProd,
    canViewTeamAttendance: isExec,
    canEditAttendance: isExec,

    // General
    isReadOnly: isExec,
    canAccessAdmin: isExec,

    // Helpers
    role,
    userId,
    isPM,
    isTL,
    isExec,
    isProd,
  };
}
