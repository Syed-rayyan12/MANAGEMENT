'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authAPI } from '@/lib/api-service';

interface DeleteConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  impactSummary?: string;
}

export function DeleteConfirmation({ open, onClose, onConfirm, title, description, impactSummary }: DeleteConfirmationProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleClose = () => {
    setStep(1);
    setPassword('');
    setError('');
    setLoading(false);
    onClose();
  };

  const handleContinue = () => {
    setStep(2);
    setError('');
  };

  const handleDelete = async () => {
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const verifyResult = await authAPI.verifyPassword(password);
      if (!verifyResult.success) {
        setError('Incorrect password');
        setLoading(false);
        return;
      }

      await onConfirm();
      handleClose();
    } catch (err) {
      setError('Incorrect password');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                {title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>

              {impactSummary && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400" dangerouslySetInnerHTML={{ __html: impactSummary }} />
                </div>
              )}

              <p className="text-xs text-zinc-400">Items can be restored from Trash within 30 days.</p>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleClose} variant="outline" className="flex-1 text-zinc-700 dark:text-zinc-300">
                  Cancel
                </Button>
                <Button onClick={handleContinue} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  Continue
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Enter your password to confirm
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="deletePassword" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="deletePassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                    className="pr-10 placeholder:text-gray-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => { setStep(1); setError(''); setPassword(''); }} variant="outline" className="flex-1 text-zinc-700 dark:text-zinc-300">
                  Back
                </Button>
                <Button onClick={handleDelete} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Delete
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
