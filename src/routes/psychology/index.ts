import { Router } from 'express';
import counselorsRouter from './counselors.ts';
import chatRouter from './chat.ts';
import appointmentsRouter from './appointments.ts';

const router = Router();

router.use('/counselors', counselorsRouter);
router.use('/chat', chatRouter);
router.use('/appointments', appointmentsRouter);

export default router;
