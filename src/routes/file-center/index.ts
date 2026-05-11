import { Router } from 'express';
import activitiesRouter from './activities.ts';
import foldersRouter from './folders.ts';
import itemsRouter from './items.ts';
import tweetsRouter from './tweets.ts';
import ossRouter from './oss.ts';
import { authenticate } from '../../middleware/auth.ts';

const router = Router();

// All file center routes require authentication
router.use(authenticate);

router.use(activitiesRouter);
router.use(foldersRouter);
router.use(itemsRouter);
router.use(tweetsRouter);
router.use(ossRouter);

export default router;
