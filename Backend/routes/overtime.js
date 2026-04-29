import express from 'express';
import { adminOnly, verifyUser } from '../middleware/AuthUser.js';
import {
    createOvertimeEntry,
    getOvertimeEntries,
    updateOvertimeApproval
} from '../controllers/OvertimeController.js';

const router = express.Router();

router.get('/', verifyUser, adminOnly, getOvertimeEntries);
router.post('/', verifyUser, adminOnly, createOvertimeEntry);
router.patch('/:id/approval', verifyUser, adminOnly, updateOvertimeApproval);

export default router;
