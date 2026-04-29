import { Op } from 'sequelize';
import Overtime from '../models/Overtime.js';
import DataPegawai from '../models/DataPegawaiModel.js';

const normalizeDate = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const parsedDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    parsedDate.setHours(0, 0, 0, 0);
    return parsedDate;
};

const formatOvertimeEntry = (entry) => ({
    id: entry.id,
    employeeId: entry.employeeId,
    employeeName: entry.employee?.nama_pegawai || '',
    employeeNik: entry.employee?.nik || '',
    employeeJabatan: entry.employee?.jabatan || '',
    date: entry.date,
    hours: entry.hours,
    reason: entry.reason,
    status: entry.status,
    approvedBy: entry.approvedBy,
    approvedAt: entry.approvedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
});

export const getOvertimeEntries = async (_req, res) => {
    try {
        const overtimeEntries = await Overtime.findAll({
            include: [{
                model: DataPegawai,
                as: 'employee',
                attributes: ['id', 'nik', 'nama_pegawai', 'jabatan']
            }],
            order: [
                ['date', 'DESC'],
                ['createdAt', 'DESC']
            ]
        });

        res.status(200).json(overtimeEntries.map(formatOvertimeEntry));
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

export const createOvertimeEntry = async (req, res) => {
    const { employeeId, date, hours, reason } = req.body;
    const selectedDate = normalizeDate(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oldestAllowedDate = new Date(today);
    oldestAllowedDate.setDate(oldestAllowedDate.getDate() - 7);

    if (!employeeId || !date || hours === '' || hours === undefined || hours === null || !reason) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    if (!selectedDate) {
        return res.status(400).json({ message: 'Date is required' });
    }

    if (selectedDate > today) {
        return res.status(400).json({ message: 'Date cannot be in the future' });
    }

    if (selectedDate < oldestAllowedDate) {
        return res.status(400).json({ message: 'Date cannot be more than 7 days ago' });
    }

    const numericHours = Number(hours);
    if (!Number.isInteger(numericHours) || numericHours < 1 || numericHours > 6) {
        return res.status(400).json({ message: 'Overtime hours must be between 1 and 6' });
    }

    if (String(reason).trim().length < 10) {
        return res.status(400).json({ message: 'Reason must be at least 10 characters' });
    }

    try {
        const employee = await DataPegawai.findByPk(employeeId, {
            attributes: ['id', 'nik', 'nama_pegawai', 'jabatan']
        });

        if (!employee) {
            return res.status(400).json({ message: 'Employee must exist' });
        }

        const duplicateEntry = await Overtime.findOne({
            where: {
                employeeId,
                date
            }
        });

        if (duplicateEntry) {
            return res.status(400).json({ message: 'Overtime already logged for this worker on this date' });
        }

        const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const monthlyEntries = await Overtime.findAll({
            where: {
                employeeId,
                date: {
                    [Op.between]: [
                        monthStart.toISOString().slice(0, 10),
                        monthEnd.toISOString().slice(0, 10)
                    ]
                }
            }
        });

        const monthlyHours = monthlyEntries.reduce((total, entry) => total + Number(entry.hours), 0);

        if (monthlyHours + numericHours > 60) {
            return res.status(400).json({ message: 'Monthly overtime cap of 60 hours exceeded' });
        }

        const overtimeEntry = await Overtime.create({
            employeeId,
            date,
            hours: numericHours,
            reason: String(reason).trim()
        });

        const createdEntry = await Overtime.findByPk(overtimeEntry.id, {
            include: [{
                model: DataPegawai,
                as: 'employee',
                attributes: ['id', 'nik', 'nama_pegawai', 'jabatan']
            }]
        });

        return res.status(201).json({
            message: 'Overtime logged successfully',
            data: formatOvertimeEntry(createdEntry)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const updateOvertimeApproval = async (req, res) => {
    const { status } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    try {
        const overtimeEntry = await Overtime.findByPk(req.params.id, {
            include: [{
                model: DataPegawai,
                as: 'employee',
                attributes: ['id', 'nik', 'nama_pegawai', 'jabatan']
            }]
        });

        if (!overtimeEntry) {
            return res.status(404).json({ message: 'Overtime entry not found' });
        }

        if (overtimeEntry.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending overtime entries can be updated' });
        }

        await overtimeEntry.update({
            status,
            approvedBy: req.userId,
            approvedAt: new Date()
        });

        return res.status(200).json({
            message: `Overtime entry ${status} successfully`,
            data: formatOvertimeEntry(overtimeEntry)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
