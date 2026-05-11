import { Router } from 'express';
import judgeRouter from './scoring-judge.ts';
import templateRouter from './scoring-templates.ts';
import competitionRouter from './scoring-competitions.ts';
import resultRouter from './scoring-results.ts';
import exportRouter from './scoring-export.ts';
import miscRouter from './scoring-misc.ts';
import { authenticate } from '../../middleware/auth.ts';

const router = Router();

// Judge routes (public login + judgeAuth — no system authenticate required)
router.use(judgeRouter);

// All other routes require system authentication
router.use(authenticate);
router.use(templateRouter);
router.use(competitionRouter);
router.use(resultRouter);
router.use(exportRouter);
router.use(miscRouter);

export default router;
