const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const equipmentRoutes = require('./routes/equipment');
const categoryRoutes = require('./routes/categories');
const loanRoutes = require('./routes/loans');
const maintenanceRoutes = require('./routes/maintenance');
const reportsRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/audit');
const realtimeRoutes = require('./routes/realtime');
const lineRoutes = require('./routes/line');

const { emitToAll } = require('./services/realtime');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'IT Equipment API is running' }));
app.use('/api/realtime', realtimeRoutes);

// Broadcast successful data mutations so every open dashboard/view can update without a browser reload.
app.use('/api', (req, res, next) => {
  res.on('finish', () => {
    if (req.method !== 'GET' && res.statusCode >= 200 && res.statusCode < 300) {
      emitToAll('data:refresh', { source: req.path, method: req.method });
    }
  });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/line', lineRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'API endpoint not found' }));

if (require.main === module) {
  app.listen(PORT, () => console.log(`IT Equipment API running on http://localhost:${PORT}`));
}

module.exports = app;
