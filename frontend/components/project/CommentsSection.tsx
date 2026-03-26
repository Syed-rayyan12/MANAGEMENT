'use client';

import React, { useState } from 'react';
import { Project, ProjectManager } from '@/lib/types';
import { projectAPI } from '@/lib/api-service';
import { toast } from 'sonner';
import { useApp } from '@/contexts/useApp';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Edit, AtSign } from 'lucide-react';

interface CommentsSectionProps {
  project: Project;
}

export function CommentsSection({ project }: CommentsSectionProps) {
  const { state, dispatch, getUserName, getAllUsers, getUserAvatar } = useApp();
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const commentInputRef = React.useRef<HTMLTextAreaElement>(null);

  const allUsers = getAllUsers();

  const handleAddComment = async () => {
    if (newComment.trim() && state.currentUser) {
      try {
        const result = await projectAPI.addComment(project.id, newComment);
        if (result.success) {
          const savedComment = result.data.comment;
          const comment = {
            id: savedComment.id,
            userId: savedComment.userId,
            content: savedComment.content,
            timestamp: new Date(savedComment.createdAt),
          };

          dispatch({
            type: 'ADD_COMMENT',
            payload: {
              projectId: project.id,
              comment,
              userId: state.currentUser.id,
            },
          });
          toast.success('Comment added');
        } else {
          console.error('Error adding comment:', result.message);
          toast.error('Failed to add comment');
        }
      } catch (error) {
        console.error('Error adding comment:', error);
        toast.error('Failed to add comment');
      }

      setNewComment('');
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (editCommentContent.trim() && state.currentUser) {
      try {
        await projectAPI.updateComment(project.id, commentId, editCommentContent);
        toast.success('Comment updated');
      } catch (error) {
        console.error('Error updating comment:', error);
        toast.error('Failed to update comment');
      }

      dispatch({
        type: 'UPDATE_COMMENT',
        payload: {
          projectId: project.id,
          commentId,
          content: editCommentContent,
          userId: state.currentUser.id,
        },
      });

      setEditingCommentId(null);
      setEditCommentContent('');
    }
  };

  const handleCommentChange = (value: string, isNewComment: boolean = true) => {
    if (isNewComment) {
      setNewComment(value);
    } else {
      setEditCommentContent(value);
    }

    const textarea = commentInputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionSearchQuery(textAfterAt.toLowerCase());
        setMentionPosition(lastAtIndex);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const handleSelectMention = (user: ProjectManager, isNewComment: boolean = true) => {
    const currentText = isNewComment ? newComment : editCommentContent;
    const beforeMention = currentText.substring(0, mentionPosition);
    const afterMention = currentText.substring(mentionPosition + mentionSearchQuery.length + 1);
    const username = user.name.replace(/\s+/g, '');
    const newText = `${beforeMention}@${username} ${afterMention}`;

    if (isNewComment) {
      setNewComment(newText);
    } else {
      setEditCommentContent(newText);
    }
    setShowMentionDropdown(false);
  };

  const renderCommentWithMentions = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        const user = allUsers.find(u => u.name.toLowerCase().replace(/\s+/g, '') === username.toLowerCase());
        if (user) {
          return (
            <span key={index} className="text-indigo-600 font-semibold bg-indigo-50 px-1 rounded">
              @{user.name}
            </span>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  const MentionDropdown = ({ isNewComment }: { isNewComment: boolean }) => (
    <>
      {showMentionDropdown && (
        <div className="absolute bottom-full left-0 mb-1 w-full bg-white dark:bg-[#1a1f2e] border dark:border-orange-500/30 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50">
          {allUsers
            .filter(u => u.name.toLowerCase().includes(mentionSearchQuery))
            .map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectMention(user, isNewComment)}
                className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-[#232938] transition-colors text-left"
              >
                <Avatar className="w-6 h-6">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium dark:text-orange-400">{user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
              </button>
            ))
          }
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {project.comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <p className="text-xs mt-1">Start a conversation about this project</p>
          </div>
        ) : (
          project.comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-3 border dark:border-orange-500/30 rounded-lg bg-gray-50 dark:bg-[#1a1f2e]">
              <Avatar className="w-8 h-8">
                <AvatarImage src={getUserAvatar(comment.userId)} alt={getUserName(comment.userId)} />
                <AvatarFallback>{getUserName(comment.userId)[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm dark:text-orange-400">{getUserName(comment.userId)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(comment.timestamp).toLocaleDateString()} at {new Date(comment.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {editingCommentId === comment.id ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Textarea
                        ref={commentInputRef}
                        value={editCommentContent}
                        onChange={(e) => handleCommentChange(e.target.value, false)}
                        className="min-h-20"
                        placeholder="Type @ to mention someone"
                      />
                      <MentionDropdown isNewComment={false} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleUpdateComment(comment.id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingCommentId(null);
                        setEditCommentContent('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 dark:text-orange-400">{renderCommentWithMentions(comment.content)}</p>
                    {state.currentUser?.id === comment.userId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditCommentContent(comment.content);
                        }}
                        className="mt-2 h-7 text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t pt-4 space-y-2">
        <div className="relative">
          <Textarea
            ref={commentInputRef}
            placeholder="Add a comment... (Type @ to mention someone)"
            value={newComment}
            onChange={(e) => handleCommentChange(e.target.value, true)}
            className="min-h-20"
          />
          <MentionDropdown isNewComment={true} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <AtSign className="w-3 h-3" />
            Type @ to mention team members
          </p>
          <Button onClick={handleAddComment} className="bg-orange-500 hover:bg-orange-600 text-white">
            <MessageSquare className="w-4 h-4 mr-2" />
            Post Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
