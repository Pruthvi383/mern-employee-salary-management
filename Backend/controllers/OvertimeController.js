import { Op } from 'sequelize';
import Overtime from '../models/Overtime.js';
import DataPegawai from '../models/DataPegawaiModel.js';

const parseDateInput = (value) => {
    if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
    ) {
        return null;
    }

    return parsedDate;
};

const getTodayUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const addUtcDays = (date, days) => {
    const shiftedDate = new Date(date);
    shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
    return shiftedDate;
};

const toDateOnlyString = (date) => date.toISOString().slice(0, 10);

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
    const selectedDate = parseDateInput(date);
    const today = getTodayUtc();
    const oldestAllowedDate = addUtcDays(today, -7);

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
        const normalizedDate = toDateOnlyString(selectedDate);
        const employee = await DataPegawai.findByPk(employeeId, {
            attributes: ['id', 'nik', 'nama_pegawai', 'jabatan']
        });

        if (!employee) {
            return res.status(400).json({ message: 'Employee must exist' });
        }

        const duplicateEntry = await Overtime.findOne({
            where: {
                employeeId,
                date: normalizedDate
            }
        });

        if (duplicateEntry) {
            return res.status(400).json({ message: 'Overtime already logged for this worker on this date' });
        }

        const monthStart = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() + 1, 0));

        const monthlyEntries = await Overtime.findAll({
            where: {
                employeeId,
                date: {
                    [Op.between]: [
                        toDateOnlyString(monthStart),
                        toDateOnlyString(monthEnd)
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
            date: normalizedDate,
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
