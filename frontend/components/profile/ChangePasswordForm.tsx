'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { authAPI } from '@/lib/api-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Must be at least 8 characters').max(128),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    try {
      const result = await authAPI.changePassword(values.currentPassword, values.newPassword);
      if (result.success) {
        toast.success('Password changed successfully');
        reset();
      } else if (result.message === 'Current password is incorrect') {
        setError('currentPassword', { message: result.message });
      } else {
        toast.error(result.message || 'Failed to change password');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Change password</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        You&apos;ll keep your current session after changing it.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4 max-w-sm">
        <div>
          <Label htmlFor="current-password" className="text-zinc-700 dark:text-zinc-300">Current password</Label>
          <Input id="current-password" type="password" autoComplete="current-password" {...register('currentPassword')} className="mt-1.5" />
          {errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword.message}</p>}
        </div>
        <div>
          <Label htmlFor="new-password" className="text-zinc-700 dark:text-zinc-300">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" {...register('newPassword')} className="mt-1.5" />
          {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>}
        </div>
        <div>
          <Label htmlFor="confirm-password" className="text-zinc-700 dark:text-zinc-300">Confirm new password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} className="mt-1.5" />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 text-white shadow-[0_4px_20px_rgba(224,92,41,0.35)]"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update password
          </Button>
        </div>
      </form>
    </div>
  );
}
