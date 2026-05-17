'use client';

import { cn } from '@/lib/utils';

interface AvatarUser {
  id?: string;
  name: string;
  avatar?: string;
}

interface AvatarStackProps {
  users: AvatarUser[];
  max?: number;
  size?: number;
  className?: string;
}

// Deterministic color palette based on name
const AVATAR_COLORS = [
  'oklch(0.75 0.08 30)',   // warm peach
  'oklch(0.72 0.10 245)',  // soft blue
  'oklch(0.70 0.10 155)',  // mint
  'oklch(0.75 0.10 295)',  // lavender
  'oklch(0.78 0.08 75)',   // warm yellow
  'oklch(0.72 0.12 340)',  // rose
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AvatarStack({ users, max = 3, size = 24, className }: AvatarStackProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((user, i) => (
        <div
          key={user.id || user.name + i}
          className="rounded-full border border-border flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            width: size,
            height: size,
            marginLeft: i > 0 ? -6 : 0,
            backgroundColor: user.avatar ? undefined : getAvatarColor(user.name),
            zIndex: visible.length - i,
            position: 'relative',
          }}
          title={user.name}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[9px] font-medium text-white">
              {getInitials(user.name)}
            </span>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="rounded-full border border-border bg-surface-2 flex items-center justify-center flex-shrink-0"
          style={{
            width: size,
            height: size,
            marginLeft: -6,
            position: 'relative',
            zIndex: 0,
          }}
        >
          <span className="text-[9px] font-medium text-fg-3">+{overflow}</span>
        </div>
      )}
    </div>
  );
}
