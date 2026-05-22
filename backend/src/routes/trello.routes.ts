import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getTrelloBoards, prepareTrelloImport, importBatch } from '../controllers/trello.controller';

const router = Router();

router.get('/boards', authenticate, getTrelloBoards);
router.post('/prepare', authenticate, prepareTrelloImport);
router.post('/import-batch', authenticate, importBatch);

export default router;
