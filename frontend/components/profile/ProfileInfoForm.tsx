'use client';

import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useApp } from '@/contexts/useApp';
import { authAPI, uploadAPI } from '@/lib/api-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Camera } from 'lucide-react';

const SPECIALIZATIONS = [
  { value: 'LOGO_DESIGNER', label: 'Logo Designer' },
  { value: 'FIGMA_DESIGNER', label: 'Figma Designer' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'CONTENT_WRITER', label: 'Content Writer' },
  { value: 'QA', label: 'QA' },
];

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').max(254),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileInfoForm() {
  const { state, dispatch } = useApp();
  const user = state.currentUser;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [specialization, setSpecialization] = useState<string>(user?.specialization || '');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  });

  if (!user) return null;

  const mergeUser = (updated: Record<string, unknown>) => {
    // SET_USER also persists to localStorage; keep teams from the existing user
    dispatch({ type: 'SET_USER', payload: { ...user, ...updated } });
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadAPI.uploadFile(file, 'avatars');
      if (!uploaded) {
        toast.error('Avatar upload failed');
        return;
      }
      const result = await authAPI.updateMe({ avatar: uploaded.publicUrl });
      if (result.success) {
        mergeUser({ avatar: uploaded.publicUrl });
        toast.success('Avatar updated');
      } else {
        toast.error(result.message || 'Failed to save avatar');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Avatar upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const payload: Record<string, unknown> = { name: values.name, email: values.email };
      if (user.role === 'PRODUCTION') {
        payload.specialization = specialization || null;
      }
      const result = await authAPI.updateMe(payload);
      if (result.success) {
        mergeUser({
          name: values.name,
          email: values.email,
          ...(user.role === 'PRODUCTION' && { specialization: specialization || undefined }),
        });
        toast.success('Profile updated');
      } else if (result.message === 'Email already in use') {
        setError('email', { message: result.message });
      } else {
        toast.error(result.message || 'Failed to update profile');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="text-lg bg-[#e05c29]/15 text-[#e05c29] font-medium">
              {user.name.split(' ')[0][0]}
            </AvatarFallback>
          </Avatar>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-3.5 h-3.5" />
            Change photo
          </button>
          <p className="mt-1 text-xs text-zinc-400">PNG or JPG, max 5MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelect}
          />
        </div>
      </div>

      {/* Read-only identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-zinc-700 dark:text-zinc-300">Username</Label>
          <Input value={user.username} disabled className="mt-1.5" />
        </div>
        <div>
          <Label className="text-zinc-700 dark:text-zinc-300">Role</Label>
          <div className="mt-1.5">
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#e05c29]/15 text-[#e05c29]">
              {user.role}
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-400 -mt-3">Username and role are managed by your admin.</p>

      {/* Editable fields */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="profile-name" className="text-zinc-700 dark:text-zinc-300">Name</Label>
          <Input id="profile-name" {...register('name')} className="mt-1.5" />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="profile-email" className="text-zinc-700 dark:text-zinc-300">Email</Label>
          <Input id="profile-email" type="email" {...register('email')} className="mt-1.5" />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>
        {user.role === 'PRODUCTION' && (
          <div>
            <Label className="text-zinc-700 dark:text-zinc-300">Specialization</Label>
            <Select value={specialization} onValueChange={setSpecialization}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select specialization" />
              </SelectTrigger>
              <SelectContent>
                {SPECIALIZATIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 text-white shadow-[0_4px_20px_rgba(224,92,41,0.35)]"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
