import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import db from './config/Database.js';

import SequelizeStore from 'connect-session-sequelize';
import FileUpload from 'express-fileupload';

import UserRoute from './routes/UserRoute.js';
import AuthRoute from './routes/AuthRoute.js';
import OvertimeRoute from './routes/overtime.js';
import Overtime from './models/Overtime.js';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const hasDatabaseConfig = Boolean(
    process.env.DB_HOST &&
    process.env.DB_NAME &&
    process.env.DB_USER
);

const sessionStore = SequelizeStore(session.Store);
const store = hasDatabaseConfig ? new sessionStore({
    db: db
}) : null;

/* (async() => {
    await db.sync();
})(); */

app.get('/', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'mern-employee-salary-management-backend',
        databaseConfigured: hasDatabaseConfig
    });
});

app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'mern-employee-salary-management-backend',
        databaseConfigured: hasDatabaseConfig
    });
});

// Middleware
app.use(session({
    secret: process.env.SESS_SECRET,
    resave: false,
    saveUninitialized: true,
    ...(store ? { store } : {}),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        try {
            const hostname = new URL(origin).hostname;

            if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(hostname)) {
                callback(null, true);
                return;
            }
        } catch (error) {
            callback(error);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    }
}));


app.use(express.json());

app.use(FileUpload());
app.use(express.static("public"));

app.use(UserRoute);
app.use(AuthRoute);
app.use('/api/overtime', OvertimeRoute);

// store.sync();

const startServer = async () => {
    try {
        await Overtime.sync();
        app.listen(process.env.PORT || process.env.APP_PORT || 5000, () => {
            console.log('Server up and running...');
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
    }
};

if (!process.env.VERCEL) {
    startServer();
}

export default app;
