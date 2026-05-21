import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * Check in for today
 * POST /api/attendance/check-in
 */
export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    // Compute today's date (date-only, start of day UTC)
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Check if already checked in today
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: 'You have already checked in today',
      });
      return;
    }

    // Determine if today is a weekend (Sat=6, Sun=0)
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: today,
        checkIn: now,
        isWeekend,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Checked in successfully',
      data: attendance,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Check out — closes the most recent open entry
 * POST /api/attendance/check-out
 */
export const checkOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    // Find the most recent open entry (no checkOut)
    const openEntry = await prisma.attendance.findFirst({
      where: { userId, checkOut: null },
      orderBy: { date: 'desc' },
    });

    if (!openEntry) {
      res.status(400).json({
        success: false,
        message: 'No open check-in to close',
      });
      return;
    }

    // Compute hours worked
    const diffMs = now.getTime() - openEntry.checkIn.getTime();
    const hoursWorked = Math.round((diffMs / 3600000) * 100) / 100;

    const attendance = await prisma.attendance.update({
      where: { id: openEntry.id },
      data: {
        checkOut: now,
        hoursWorked,
      },
    });

    res.json({
      success: true,
      message: 'Checked out successfully',
      data: attendance,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get current user's today entry
 * GET /api/attendance/today
 */
export const getToday = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    // Also check for any unclosed entry from a previous day
    const unclosedEntry = await prisma.attendance.findFirst({
      where: {
        userId,
        checkOut: null,
        date: { lt: today },
      },
      orderBy: { date: 'desc' },
    });

    res.json({
      success: true,
      message: 'Today attendance fetched',
      data: {
        today: attendance,
        unclosedEntry: unclosedEntry || null,
      },
    });
  } catch (error) {
    console.error('Get today error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get current user's attendance history
 * GET /api/attendance/my-history?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const getMyHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { from, to } = req.query;

    const where: Record<string, unknown> = { userId };

    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from as string);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to as string);
    }

    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    res.json({
      success: true,
      message: 'Attendance history fetched',
      data: records,
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get all employees' attendance for a given date (EXECUTIVE only)
 * GET /api/attendance/team?date=YYYY-MM-DD
 */
export const getTeamAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.query;
    const now = new Date();
    const targetDate = date
      ? new Date(date as string)
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Get all non-EXECUTIVE users
    const users = await prisma.user.findMany({
      where: { role: { not: 'EXECUTIVE' } },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        avatar: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get attendance records for these users on the target date
    const userIds = users.map((u) => u.id);
    const records = await prisma.attendance.findMany({
      where: {
        userId: { in: userIds },
        date: targetDate,
      },
    });

    // Build a lookup
    const recordMap = new Map(records.map((r) => [r.userId, r]));

    const data = users.map((user) => ({
      user,
      attendance: recordMap.get(user.id) || null,
    }));

    res.json({
      success: true,
      message: 'Team attendance fetched',
      data,
    });
  } catch (error) {
    console.error('Get team attendance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Export monthly attendance for all employees (EXECUTIVE only)
 * GET /api/attendance/export?month=2025-05
 */
export const exportMonthly = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month as string)) {
      res.status(400).json({ success: false, message: 'month query param required in YYYY-MM format' });
      return;
    }

    const [year, mon] = (month as string).split('-').map(Number);
    const startDate = new Date(Date.UTC(year, mon - 1, 1));
    const endDate = new Date(Date.UTC(year, mon, 0)); // last day of the month

    // Get all non-EXECUTIVE users
    const users = await prisma.user.findMany({
      where: { role: { not: 'EXECUTIVE' } },
      select: { id: true, name: true, username: true, role: true },
      orderBy: { name: 'asc' },
    });

    const userIds = users.map((u) => u.id);

    // Get all attendance records for these users in the month
    const records = await prisma.attendance.findMany({
      where: {
        userId: { in: userIds },
        date: { gte: startDate, lte: endDate },
      },
      orderBy: [{ date: 'asc' }],
    });

    // Build lookup: userId -> records[]
    const recordMap = new Map<string, typeof records>();
    for (const r of records) {
      const arr = recordMap.get(r.userId) || [];
      arr.push(r);
      recordMap.set(r.userId, arr);
    }

    // Count working days (Mon-Fri) in the month, capped to today if current month
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const capDate = endDate > today ? today : endDate;

    let totalWorkingDays = 0;
    for (let d = new Date(startDate); d <= capDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.getUTCDay();
      if (day !== 0 && day !== 6) totalWorkingDays++;
    }

    const SHIFT_HOURS = 9;

    const data = users.map((user) => {
      const userRecords = recordMap.get(user.id) || [];

      // Late = completed record (has checkOut) but hoursWorked < 9
      const totalLate = userRecords.filter(
        (r) => r.checkOut && r.hoursWorked !== null && parseFloat(String(r.hoursWorked)) < SHIFT_HOURS
      ).length;

      // Days with a record (regardless of weekend)
      const daysWithRecord = new Set(
        userRecords.map((r) => r.date.toISOString().split('T')[0])
      );

      // Absent = working days with no attendance record
      let totalAbsent = 0;
      for (let d = new Date(startDate); d <= capDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.getUTCDay();
        if (day !== 0 && day !== 6 && !daysWithRecord.has(d.toISOString().split('T')[0])) {
          totalAbsent++;
        }
      }

      return {
        user,
        records: userRecords,
        totalLate,
        totalAbsent,
        totalWorkingDays,
      };
    });

    res.json({
      success: true,
      message: 'Monthly attendance exported',
      data: {
        month: month as string,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        employees: data,
      },
    });
  } catch (error) {
    console.error('Export monthly error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Manual edit of an attendance record (EXECUTIVE only)
 * PUT /api/attendance/:id
 */
export const editAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut } = req.body;

    const record = await prisma.attendance.findUnique({ where: { id } });
    if (!record) {
      res.status(404).json({ success: false, message: 'Attendance record not found' });
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = checkOut ? new Date(checkOut) : null;

    // Compute hours worked if both timestamps present
    let hoursWorked = null;
    if (checkOutDate) {
      const diffMs = checkOutDate.getTime() - checkInDate.getTime();
      hoursWorked = Math.round((diffMs / 3600000) * 100) / 100;
    }

    // Recompute isWeekend based on the check-in date
    const dayOfWeek = checkInDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        checkIn: checkInDate,
        checkOut: checkOutDate,
        hoursWorked,
        isWeekend,
        editedById: req.user!.id,
        editedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Attendance record updated',
      data: updated,
    });
  } catch (error) {
    console.error('Edit attendance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
