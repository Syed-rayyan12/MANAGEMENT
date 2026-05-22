'use client';

import { useState, useEffect } from 'react';
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

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  commentsImported: number;
  commentsFailed: number;
  attachmentsImported: number;
  attachmentsFailed: number;
  details: ImportDetail[];
  newBoards?: string[];
}

export default function TrelloImportPage() {
  const { state, dispatch } = useApp();
  const router = useRouter();

  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [fetchingBoards, setFetchingBoards] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (state.currentUser && state.currentUser.username !== 'prod.tahiranwar') {
      router.push('/dashboard');
    }
  }, [state.currentUser, router]);

  if (!state.currentUser || state.currentUser.username !== 'prod.tahiranwar') {
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
    setResult(null);

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
    setImporting(true);
    setResult(null);

    try {
      const res = await trelloAPI.import(apiKey.trim(), token.trim(), selectedBoardId);
      if (!res.success) {
        setError(res.message || 'Import failed.');
        return;
      }
      setResult(res.data);

      // Refresh projects in global state so workspaces show imported/updated projects
      if (res.data.imported > 0 || res.data.updated > 0) {
        const projectsRes = await projectAPI.getAll();
        if (projectsRes.success) {
          dispatch({ type: 'SET_PROJECTS', payload: projectsRes.data.projects.map(mapApiProject) });
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
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
              disabled={importing || !selectedBoardId}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
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

      {/* Section 3: Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{result.imported}</p>
              <p className="text-xs text-fg-3 mt-1">Imported</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-blue-500">{result.updated}</p>
              <p className="text-xs text-fg-3 mt-1">Updated</p>
            </div>
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{result.failed}</p>
              <p className="text-xs text-fg-3 mt-1">Failed</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface border border-border p-3 flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-fg-3" />
              <div>
                <p className="text-sm font-semibold text-foreground">{result.commentsImported}</p>
                <p className="text-xs text-fg-3">Comments imported</p>
              </div>
            </div>
            <div className="rounded-lg bg-surface border border-border p-3 flex items-center gap-3">
              <Paperclip className="h-4 w-4 text-fg-3" />
              <div>
                <p className="text-sm font-semibold text-foreground">{result.attachmentsImported}</p>
                <p className="text-xs text-fg-3">Attachments imported</p>
              </div>
            </div>
          </div>

          {/* Failure warnings */}
          {(result.commentsFailed > 0 || result.attachmentsFailed > 0) && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                {result.commentsFailed > 0 && `${result.commentsFailed} comment(s) failed to import. `}
                {result.attachmentsFailed > 0 && `${result.attachmentsFailed} attachment(s) failed to import.`}
              </span>
            </div>
          )}

          {/* New boards created */}
          {result.newBoards && result.newBoards.length > 0 && (
            <div className="rounded-md bg-accent/10 border border-accent/20 px-4 py-3 text-sm text-foreground">
              <span className="font-medium">New boards created:</span>{' '}
              <span className="text-fg-2">{result.newBoards.join(', ')}</span>
            </div>
          )}

          {/* Detail table */}
          {result.details && result.details.length > 0 && (
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
                    {result.details.map((detail, idx) => (
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
