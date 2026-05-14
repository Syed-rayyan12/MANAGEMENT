import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { getKPIs, getEmployees, getEmployeePerformance, createEmployee, deleteEmployee } from '../controllers/admin.controller';
import { validate, createEmployeeSchema } from '../utils/validators';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);
router.use(authorizeRoles('EXECUTIVE'));

router.get('/kpis', getKPIs);
router.get('/employees', getEmployees);
router.get('/employees/:id/performance', getEmployeePerformance);
router.post('/employees', validate(createEmployeeSchema), createEmployee);
router.delete('/employees/:id', deleteEmployee);

// List all teams (for employee creation form)
router.get('/teams', async (_req, res) => {
  try {
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: { teams } });
  } catch {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
