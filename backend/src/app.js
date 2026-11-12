require('dotenv').config();
require('express-async-errors'); // lets async route handlers throw and reach errorHandler

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const skillRoutes = require('./routes/skillRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const matchRoutes = require('./routes/matchRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const credentialRoutes = require('./routes/credentialRoutes');
const adminRoutes = require('./routes/adminRoutes');
const moduleRoutes = require('./routes/moduleRoutes');
const placeRoutes = require('./routes/placeRoutes');
const skillCheckRoutes = require('./routes/skillCheckRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const learnerRoutes = require('./routes/learnerRoutes');
const activityRoutes = require('./routes/activityRoutes');
const testRoutes = require('./routes/testRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const learnerDashboardRoutes = require('./routes/learnerDashboardRoutes');
const specialistModuleRoutes = require('./routes/specialistModuleRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: process.env.NODE_ENV === 'production' ? 300 : 2000,
	// JSON, so the app can show the reason (e.g. on the login page) instead of "Login failed".
	message: { success: false, message: 'Too many requests from this computer. Please wait a few minutes and try again.' },
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'iElevate API is running' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/elevate/skill-check', skillCheckRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/elevate/applications', applicationRoutes);
app.use('/api/elevate/learners', learnerRoutes);
app.use('/api/elevate/activities', activityRoutes);
app.use('/api/elevate/tests', testRoutes);
app.use('/api/elevate/portfolio', portfolioRoutes);
app.use('/api/elevate/dashboard', learnerDashboardRoutes);
app.use('/api/elevate/my-modules', specialistModuleRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
