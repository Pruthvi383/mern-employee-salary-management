import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { Breadcrumb } from '../../../../components';
import Layout from '../../../../layout';
import { getMe } from '../../../../config/redux/action';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../../../utils/formatDate';

const initialFormState = {
    employeeId: '',
    date: '',
    hours: '',
    reason: ''
};

const initialErrorState = {
    employeeId: '',
    date: '',
    hours: '',
    reason: '',
    general: ''
};

const parseDateInput = (value) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

const OvertimeEntry = () => {
    const [formState, setFormState] = useState(initialFormState);
    const [errors, setErrors] = useState(initialErrorState);
    const [employees, setEmployees] = useState([]);
    const [overtimeEntries, setOvertimeEntries] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [approvalMessage, setApprovalMessage] = useState('');

    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { isError, user } = useSelector((state) => state.auth);

    const fetchEmployees = async () => {
        const response = await axios.get('/data_pegawai');
        setEmployees(response.data);
    };

    const fetchOvertimeEntries = async () => {
        setLoadingEntries(true);

        try {
            const response = await axios.get('/api/overtime');
            setOvertimeEntries(response.data);
        } catch (error) {
            setErrors((currentErrors) => ({
                ...currentErrors,
                general: error.response?.data?.message || 'Unable to load overtime entries.'
            }));
        } finally {
            setLoadingEntries(false);
        }
    };

    const validateForm = () => {
        const nextErrors = {
            employeeId: '',
            date: '',
            hours: '',
            reason: '',
            general: ''
        };

        const selectedDate = parseDateInput(formState.date);
        const today = getTodayUtc();
        const oldestAllowedDate = addUtcDays(today, -7);

        if (!formState.employeeId) {
            nextErrors.employeeId = 'Worker is required';
        }

        if (!formState.date) {
            nextErrors.date = 'Date is required';
        } else if (!selectedDate) {
            nextErrors.date = 'Date is required';
        } else if (selectedDate > today) {
            nextErrors.date = 'Date cannot be in the future';
        } else if (selectedDate < oldestAllowedDate) {
            nextErrors.date = 'Date cannot be more than 7 days ago';
        }

        if (!formState.hours) {
            nextErrors.hours = 'Overtime hours is required';
        } else {
            const numericHours = Number(formState.hours);

            if (!Number.isInteger(numericHours) || numericHours < 1 || numericHours > 6) {
                nextErrors.hours = 'Overtime hours must be between 1 and 6';
            }
        }

        if (!formState.reason.trim()) {
            nextErrors.reason = 'Reason is required';
        } else if (formState.reason.trim().length < 10) {
            nextErrors.reason = 'Reason must be at least 10 characters';
        }

        setErrors(nextErrors);
        return !Object.values(nextErrors).some((value) => value);
    };

    const mapBackendMessageToErrors = (message) => {
        const nextErrors = {
            employeeId: '',
            date: '',
            hours: '',
            reason: '',
            general: ''
        };

        if (message === 'All fields are required') {
            if (!formState.employeeId) {
                nextErrors.employeeId = 'Worker is required';
            }
            if (!formState.date) {
                nextErrors.date = 'Date is required';
            }
            if (!formState.hours) {
                nextErrors.hours = 'Overtime hours is required';
            }
            if (!formState.reason.trim()) {
                nextErrors.reason = 'Reason is required';
            }
        } else if (message === 'Overtime hours must be between 1 and 6') {
            nextErrors.hours = message;
        } else if (message === 'Date cannot be in the future' || message === 'Date cannot be more than 7 days ago' || message === 'Date is required') {
            nextErrors.date = message;
        } else if (message === 'Reason must be at least 10 characters') {
            nextErrors.reason = message;
        } else if (message === 'Employee must exist') {
            nextErrors.employeeId = message;
        } else if (message === 'Overtime already logged for this worker on this date') {
            nextErrors.date = message;
        } else if (message === 'Monthly overtime cap of 60 hours exceeded') {
            nextErrors.hours = message;
        } else {
            nextErrors.general = message;
        }

        return nextErrors;
    };

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormState((currentState) => ({
            ...currentState,
            [name]: value
        }));

        setErrors((currentErrors) => ({
            ...currentErrors,
            [name]: '',
            general: ''
        }));

        setSuccessMessage('');
        setApprovalMessage('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSuccessMessage('');
        setApprovalMessage('');

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post('/api/overtime', {
                employeeId: Number(formState.employeeId),
                date: formState.date,
                hours: Number(formState.hours),
                reason: formState.reason.trim()
            });

            setSuccessMessage(response.data.message);
            setFormState(initialFormState);
            setErrors(initialErrorState);
            await fetchOvertimeEntries();
        } catch (error) {
            const backendMessage = error.response?.data?.message || 'Unable to save overtime entry.';
            setErrors(mapBackendMessageToErrors(backendMessage));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApproval = async (id, status) => {
        setApprovalMessage('');
        setSuccessMessage('');
        setErrors((currentErrors) => ({
            ...currentErrors,
            general: ''
        }));

        try {
            const response = await axios.patch(`/api/overtime/${id}/approval`, {
                status
            });
            setApprovalMessage(response.data.message);
            await fetchOvertimeEntries();
        } catch (error) {
            setErrors((currentErrors) => ({
                ...currentErrors,
                general: error.response?.data?.message || 'Unable to update overtime approval.'
            }));
        }
    };

    useEffect(() => {
        dispatch(getMe());
    }, [dispatch]);

    useEffect(() => {
        if (isError) {
            navigate('/login');
        }

        if (user && user.hak_akses !== 'admin') {
            navigate('/dashboard');
        }
    }, [isError, user, navigate]);

    useEffect(() => {
        fetchEmployees();
        fetchOvertimeEntries();
    }, []);

    return (
        <Layout>
            <Breadcrumb pageName='Overtime Entry & Approval' />

            <div className='grid gap-6 xl:grid-cols-[0.95fr_1.05fr]'>
                <div className='rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark'>
                    <div className='border-b border-stroke py-4 px-6.5 dark:border-strokedark'>
                        <h3 className='font-medium text-black dark:text-white'>
                            Log Overtime
                        </h3>
                    </div>

                    <form onSubmit={handleSubmit} className='p-6.5'>
                        {successMessage ? (
                            <div className='mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700'>
                                {successMessage}
                            </div>
                        ) : null}

                        {errors.general ? (
                            <div className='mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                                {errors.general}
                            </div>
                        ) : null}

                        <div className='mb-4.5'>
                            <label className='mb-2.5 block text-black dark:text-white'>
                                Worker <span className='text-meta-1'>*</span>
                            </label>
                            <select
                                name='employeeId'
                                value={formState.employeeId}
                                onChange={handleChange}
                                className='w-full rounded border border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input'
                            >
                                <option value=''>Select worker</option>
                                {employees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>
                                        {employee.nama_pegawai} - {employee.nik}
                                    </option>
                                ))}
                            </select>
                            {errors.employeeId ? <p className='mt-2 text-sm text-meta-1'>{errors.employeeId}</p> : null}
                        </div>

                        <div className='mb-4.5 grid gap-6 xl:grid-cols-2'>
                            <div>
                                <label className='mb-2.5 block text-black dark:text-white'>
                                    Date <span className='text-meta-1'>*</span>
                                </label>
                                <input
                                    type='date'
                                    name='date'
                                    value={formState.date}
                                    onChange={handleChange}
                                    className='w-full rounded border border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input'
                                />
                                {errors.date ? <p className='mt-2 text-sm text-meta-1'>{errors.date}</p> : null}
                            </div>

                            <div>
                                <label className='mb-2.5 block text-black dark:text-white'>
                                    Overtime Hours <span className='text-meta-1'>*</span>
                                </label>
                                <input
                                    type='number'
                                    min='1'
                                    max='6'
                                    name='hours'
                                    value={formState.hours}
                                    onChange={handleChange}
                                    className='w-full rounded border border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input'
                                    placeholder='Enter overtime hours'
                                />
                                {errors.hours ? <p className='mt-2 text-sm text-meta-1'>{errors.hours}</p> : null}
                            </div>
                        </div>

                        <div className='mb-6'>
                            <label className='mb-2.5 block text-black dark:text-white'>
                                Reason <span className='text-meta-1'>*</span>
                            </label>
                            <textarea
                                rows='5'
                                name='reason'
                                value={formState.reason}
                                onChange={handleChange}
                                className='w-full rounded border border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input'
                                placeholder='Enter the overtime reason'
                            />
                            {errors.reason ? <p className='mt-2 text-sm text-meta-1'>{errors.reason}</p> : null}
                        </div>

                        <button
                            type='submit'
                            disabled={isSubmitting}
                            className='inline-flex items-center justify-center rounded bg-primary py-3 px-6 text-center font-medium text-white hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70'
                        >
                            {isSubmitting ? 'Saving...' : 'Log Overtime'}
                        </button>
                    </form>
                </div>

                <div className='rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark'>
                    <div className='border-b border-stroke py-4 px-6.5 dark:border-strokedark'>
                        <h3 className='font-medium text-black dark:text-white'>
                            Overtime Approval Queue
                        </h3>
                    </div>

                    <div className='p-6.5'>
                        {approvalMessage ? (
                            <div className='mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700'>
                                {approvalMessage}
                            </div>
                        ) : null}

                        <div className='max-w-full overflow-x-auto'>
                            <table className='w-full table-auto'>
                                <thead>
                                    <tr className='bg-gray-2 text-left dark:bg-meta-4'>
                                        <th className='py-4 px-4 font-medium text-black dark:text-white'>Worker</th>
                                        <th className='py-4 px-4 font-medium text-black dark:text-white'>Date</th>
                                        <th className='py-4 px-4 font-medium text-black dark:text-white'>Hours</th>
                                        <th className='py-4 px-4 font-medium text-black dark:text-white'>Reason</th>
                                        <th className='py-4 px-4 font-medium text-black dark:text-white'>Status</th>
                                        <th className='py-4 px-4 font-medium text-black dark:text-white'>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingEntries ? (
                                        <tr>
                                            <td colSpan='6' className='py-6 px-4 text-center text-black dark:text-white'>
                                                Loading overtime entries...
                                            </td>
                                        </tr>
                                    ) : null}

                                    {!loadingEntries && overtimeEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan='6' className='py-6 px-4 text-center text-black dark:text-white'>
                                                No overtime entries found.
                                            </td>
                                        </tr>
                                    ) : null}

                                    {!loadingEntries && overtimeEntries.map((entry) => (
                                        <tr key={entry.id}>
                                            <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark'>
                                                <p className='text-black dark:text-white'>{entry.employeeName}</p>
                                            </td>
                                            <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark'>
                                                <p className='text-black dark:text-white'>{formatDate(entry.date)}</p>
                                            </td>
                                            <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark'>
                                                <p className='text-black dark:text-white'>{entry.hours}</p>
                                            </td>
                                            <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark'>
                                                <p className='text-black dark:text-white'>{entry.reason}</p>
                                            </td>
                                            <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark'>
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                                    entry.status === 'approved'
                                                        ? 'bg-green-100 text-green-700'
                                                        : entry.status === 'rejected'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {entry.status}
                                                </span>
                                            </td>
                                            <td className='border-b border-[#eee] py-5 px-4 dark:border-strokedark'>
                                                <div className='flex gap-2'>
                                                    <button
                                                        type='button'
                                                        disabled={entry.status !== 'pending'}
                                                        onClick={() => handleApproval(entry.id, 'approved')}
                                                        className='rounded bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50'
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type='button'
                                                        disabled={entry.status !== 'pending'}
                                                        onClick={() => handleApproval(entry.id, 'rejected')}
                                                        className='rounded bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50'
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default OvertimeEntry;
