import { useApp } from '@/contexts/useApp';

/**
 * Role-based permission helpers.
 *
 * Roles hierarchy (highest → lowest):
 *   PM > TL > EXECUTIVE > PRODUCTION
 *
 * Permissions:
 *   - canCreateProject: PM only
 *   - canDeleteProject: PM only
 *   - canAddColumn: PM, TL
 *   - canChangePriority: PM, TL
 *   - canEditProject: PM, TL, PRODUCTION (the assigned developer)
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
    canDeleteProject: isPM,

    // Board management
    canAddColumn: true,

    // Project fields
    canChangePriority: isPM || isTL,
    canChangeStatus: isPM || isTL || isProd,
    canEditProjectFields: isPM || isTL,

    // Interaction
    canComment: true, // everyone can comment
    canUploadAttachment: isPM || isTL || isProd,
    canManageChecklist: isPM || isTL || isProd,

    // Invoices
    canAccessInvoices: isPM || isTL || isExec,
    canCreateInvoice: isPM || isTL || isExec,

    // Drag and drop
    canDragCards: isPM || isTL || isProd,

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
