import { getIO } from './index';

/**
 * Broadcast a project event to everyone in a board room.
 * @param boardSlug  – the board's slug (used as room name)
 * @param event      – event name, e.g. 'project:created'
 * @param data       – payload to send
 * @param excludeSocketId – optional socket ID to exclude (the actor)
 */
export function emitBoardEvent(
  boardSlug: string,
  event: string,
  data: unknown,
  excludeSocketId?: string,
) {
  try {
    const io = getIO();
    const room = `board:${boardSlug}`;
    if (excludeSocketId) {
      io.to(room).except(excludeSocketId).emit(event, data);
    } else {
      io.to(room).emit(event, data);
    }
  } catch (error) {
    // Socket not initialized yet (e.g., during tests) — silently skip
    console.error('[Socket] emitBoardEvent failed:', error);
  }
}

/**
 * Push a notification to a specific user's personal room.
 */
export function emitToUser(userId: string, event: string, data: unknown) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(event, data);
  } catch (error) {
    console.error('[Socket] emitToUser failed:', error);
  }
}
