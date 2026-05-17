'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Briefcase,
  Inbox,
  FileText,
  TrendingUp,
  Plus,
  Search,
} from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { state } = useApp();
  const userRole = state.currentUser?.role;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => navigate('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/my-work')}>
            <Briefcase className="mr-2 h-4 w-4" />
            My Work
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/inbox')}>
            <Inbox className="mr-2 h-4 w-4" />
            Inbox
          </CommandItem>
          {(userRole === 'PM' || userRole === 'TL' || userRole === 'EXECUTIVE') && (
            <CommandItem onSelect={() => navigate('/dashboard/invoices')}>
              <FileText className="mr-2 h-4 w-4" />
              Invoices
            </CommandItem>
          )}
          {userRole === 'EXECUTIVE' && (
            <CommandItem onSelect={() => navigate('/dashboard/insights')}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Insights
            </CommandItem>
          )}
        </CommandGroup>
        {state.projects && state.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {state.projects.map((project: any) => (
              <CommandItem
                key={project.id}
                onSelect={() => {
                  setOpen(false);
                  // Navigate to the project's workspace with project query param
                  const boardSlug = project.board?.name?.toLowerCase().replace(/\s+/g, '-') || project.boardId;
                  router.push(`/dashboard/${boardSlug}?project=${project.id}`);
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                <span className="font-mono text-[10.5px] mr-2 text-fg-3">
                  {project.identifier || project.id?.slice(0, 6)}
                </span>
                {project.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
