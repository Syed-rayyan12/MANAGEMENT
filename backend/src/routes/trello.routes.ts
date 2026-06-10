import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getTrelloConfig,
  getTrelloBoards,
  startImport,
  getLatestImportRun,
  getImportRun,
} from '../controllers/trello.controller';

const router = Router();

router.get('/config', authenticate, getTrelloConfig);
router.get('/boards', authenticate, getTrelloBoards);
router.post('/import', authenticate, startImport);
// /import/latest must be registered before /import/:runId
router.get('/import/latest', authenticate, getLatestImportRun);
router.get('/import/:runId', authenticate, getImportRun);

export default router;
