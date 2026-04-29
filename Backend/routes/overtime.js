import express from 'express';
import { adminOnly, verifyUser } from '../middleware/AuthUser.js';
import {
    createOvertimeEntry,
    getOvertimeEntries,
    updateOvertimeApproval
} from '../controllers/OvertimeController.js';

const router = express.Router();

router.get('/api/overtime', verifyUser, adminOnly, getOvertimeEntries);
router.post('/api/overtime', verifyUser, adminOnly, createOvertimeEntry);
router.patch('/api/overtime/:id/approval', verifyUser, adminOnly, updateOvertimeApproval);

export default router;
