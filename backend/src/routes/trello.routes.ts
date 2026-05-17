import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getTrelloBoards, importFromTrello } from '../controllers/trello.controller';

const router = Router();

router.get('/boards', authenticate, getTrelloBoards);
router.post('/import', authenticate, importFromTrello);

export default router;
