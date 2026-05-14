import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { getKPIs, getEmployees, getEmployeePerformance, createEmployee, deleteEmployee, getAdminTeams } from '../controllers/admin.controller';
import { validate, createEmployeeSchema } from '../utils/validators';

const router = Router();
router.use(authenticate);
router.use(authorizeRoles('EXECUTIVE'));

router.get('/kpis', getKPIs);
router.get('/employees', getEmployees);
router.get('/employees/:id/performance', getEmployeePerformance);
router.post('/employees', validate(createEmployeeSchema), createEmployee);
router.delete('/employees/:id', deleteEmployee);

// List all teams (for employee creation form)
router.get('/teams', getAdminTeams);

export default router;
