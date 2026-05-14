import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getClients, createClient } from '../controllers/client.controller';
import { validate, createClientSchema } from '../utils/validators';

const router = Router();
router.use(authenticate);

router.get('/', getClients);
router.post('/', validate(createClientSchema), createClient);

export default router;
