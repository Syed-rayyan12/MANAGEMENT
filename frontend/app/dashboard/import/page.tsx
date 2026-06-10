'use client';

import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/contexts/useApp';
import { trelloAPI, projectAPI } from '@/lib/api-service';
import { mapApiProject } from '@/contexts/AppContext';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  RefreshCw,
  MessageSquare,
  Paperclip,
  AlertTriangle,
  Server,
} from 'lucide-react';

interface TrelloBoard {
  id: string;
  name: string;
}

interface ImportDetail {
  cardName: string;
  status: 'imported' | 'updated' | 'skipped' | 'failed';
  reason?: string;
}

interface ImportRun {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalCards: number;
  processedCards: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  commentsImported: number;
  commentsFailed: number;
  attachmentsImported: number;
  attachmentsFailed: number;
  newBoards: string[];
  details: ImportDetail[];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

const POLL_INTERVAL_MS = 5000;

export default function TrelloImportPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();

  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [error, setError] = useState('');
  const [fetchingBoards, setFetchingBoards] = useState(false);
  const [starting, setStarting] = useState(false);
  const [run, setRun] = useState<ImportRun | null>(null);

  const isAuthorized = state.currentUser?.username === 'prod.tahiranwar';
  const isRunning = run?.status === 'RUNNING';
  const prevStatusRef = useRef<ImportRun['status'] | null>(null);

  useEffect(() => {
    if (state.currentUser && !isAuthorized) {
      router.push('/dashboard');
    }
  }, [state.currentUser, isAuthorized, router]);

  // On load, pick up the most recent run — a run started earlier (even from a
  // closed tab) keeps going on the server and its progress shows up here
  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    trelloAPI
      .getLatestRun()
      .then((res) => {
        if (!cancelled && res.success && res.data?.run) {
          setRun(res.data.run);
        }
      })
      .catch(() => {
        // no previous run to show — not an error worth surfacing
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  // Poll while a run is in progress
  useEffect(() => {
    if (!isRunning || !run?.id) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await trelloAPI.getRun(run.id);
        if (!cancelled && res.success && res.data?.run) {
          setRun(res.data.run);
        }
      } catch {
        // transient polling error — retry on the next tick
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isRunning, run?.id]);

  // Refresh global projects once a run finishes successfully
  useEffect(() => {
    if (!run) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = run.status;
    if (prev === 'RUNNING' && run.status === 'COMPLETED' && (run.imported > 0 || run.updated > 0)) {
      projectAPI.getAll().then((res) => {
        if (res.success) {
          dispatch({ type: 'SET_PROJECTS', payload: res.data.projects.map(mapApiProject) });
        }
      });
    }
  }, [run, dispatch]);

  if (!state.currentUser || !isAuthorized) {
    return null;
  }

  const handleFetchBoards = async () => {
    if (!apiKey.trim() || !token.trim()) {
      setError('Please enter both API Key and Token.');
      return;
    }
    setError('');
    setFetchingBoards(true);
    setBoards([]);
    setSelectedBoardId('');

    try {
      const res = await trelloAPI.getBoards(apiKey.trim(), token.trim());
      if (!res.success) {
        setError(res.message || 'Failed to fetch boards.');
        return;
      }
      setBoards(res.data?.boards || []);
      if (!res.data?.boards || res.data.boards.length === 0) {
        setError('No boards found for this Trello account.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch boards.');
    } finally {
      setFetchingBoards(false);
    }
  };

  const handleImport = async () => {
    if (!selectedBoardId) {
      setError('Please select a board to import.');
      return;
    }
    setError('');
    setStarting(true);

    try {
      const res = await trelloAPI.startImport(apiKey.trim(), token.trim(), selectedBoardId);
      if (!res.success) {
        setError(res.message || 'Failed to start import.');
        return;
      }
      const runRes = await trelloAPI.getRun(res.data.runId);
      if (runRes.success && runRes.data?.run) {
        setRun(runRes.data.run);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start import.');
    } finally {
      setStarting(false);
    }
  };

  const statusIcon = (status: ImportDetail['status']) => {
    switch (status) {
      case 'imported':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'updated':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Upload className="h-5 w-5 text-accent" />
        <h1 className="text-lg font-semibold text-foreground">Trello Import</h1>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Section 1: Connect to Trello */}
      <div className="rounded-lg bg-surface border border-border p-5 space-y-4">
        <h2 className="text-sm font-medium text-foreground">Connect to Trello</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-fg-3 mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Trello API key"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-fg-3 mb-1">Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your Trello token"
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            onClick={handleFetchBoards}
            disabled={fetchingBoards}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fetchingBoards ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              'Fetch Boards'
            )}
          </button>
        </div>
      </div>

      {/* Section 2: Select Board & Import */}
      {boards.length > 0 && (
        <div className="rounded-lg bg-surface border border-border p-5 space-y-4">
          <h2 className="text-sm font-medium text-foreground">Select Board & Import</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-fg-3 mb-1">Trello Board</label>
              <select
                value={selectedBoardId}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select a board...</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleImport}
              disabled={starting || isRunning || !selectedBoardId}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting || isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import Projects
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {isRunning && run && (
        <div className="rounded-lg bg-surface border border-border p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-2 truncate max-w-[70%]">
              {run.totalCards > 0
                ? `Importing — ${run.processedCards} of ${run.totalCards} cards processed`
                : 'Fetching board data from Trello...'}
            </span>
            {run.totalCards > 0 && (
              <span className="text-fg-3 text-xs flex-shrink-0">
                {run.processedCards} / {run.totalCards}
              </span>
            )}
          </div>
          {run.totalCards > 0 && (
            <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((run.processedCards / run.totalCards) * 100)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-fg-3 flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 flex-shrink-0" />
            The import runs on the server — you can close this page and come back later.
          </p>
        </div>
      )}

      {/* Failed run error */}
      {run?.status === 'FAILED' && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-500 flex items-center gap-2">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span>Import failed: {run.error || 'Unknown error'}</span>
        </div>
      )}

      {/* Section 3: Results */}
      {run && run.status !== 'RUNNING' && (
        <div className="space-y-4">
          <p className="text-xs text-fg-3">
            Last import started {new Date(run.startedAt).toLocaleString()}
            {run.finishedAt && `, finished ${new Date(run.finishedAt).toLocaleString()}`}
          </p>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{run.imported}</p>
              <p className="text-xs text-fg-3 mt-1">Imported</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-blue-500">{run.updated}</p>
              <p className="text-xs text-fg-3 mt-1">Updated</p>
            </div>
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{run.skipped}</p>
              <p className="text-xs text-fg-3 mt-1">Skipped</p>
            </div>
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{run.failed}</p>
              <p className="text-xs text-fg-3 mt-1">Failed</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface border border-border p-3 flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-fg-3" />
              <div>
                <p className="text-sm font-semibold text-foreground">{run.commentsImported}</p>
                <p className="text-xs text-fg-3">Comments imported</p>
              </div>
            </div>
            <div className="rounded-lg bg-surface border border-border p-3 flex items-center gap-3">
              <Paperclip className="h-4 w-4 text-fg-3" />
              <div>
                <p className="text-sm font-semibold text-foreground">{run.attachmentsImported}</p>
                <p className="text-xs text-fg-3">Attachments imported</p>
              </div>
            </div>
          </div>

          {/* Failure warnings */}
          {(run.commentsFailed > 0 || run.attachmentsFailed > 0) && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                {run.commentsFailed > 0 && `${run.commentsFailed} comment(s) failed to import. `}
                {run.attachmentsFailed > 0 && `${run.attachmentsFailed} attachment(s) failed to import.`}
              </span>
            </div>
          )}

          {/* New boards created */}
          {run.newBoards && run.newBoards.length > 0 && (
            <div className="rounded-md bg-accent/10 border border-accent/20 px-4 py-3 text-sm text-foreground">
              <span className="font-medium">New boards created:</span>{' '}
              <span className="text-fg-2">{run.newBoards.join(', ')}</span>
            </div>
          )}

          {/* Detail table */}
          {run.details && run.details.length > 0 && (
            <div className="rounded-lg bg-surface border border-border overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-fg-3">
                        Project Name
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-fg-3">
                        Status
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-fg-3">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {run.details.map((detail, idx) => (
                      <tr key={idx} className="hover:bg-surface-2/50">
                        <td className="px-4 py-2 text-[13px] text-foreground">
                          {detail.cardName}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                            {statusIcon(detail.status)}
                            {detail.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-fg-4">
                          {detail.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
