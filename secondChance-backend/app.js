require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectToDatabase = require('./models/db');
const authRoutes = require('./routes/authRoutes');
const secondChanceItemsRoutes = require('./routes/secondChanceItemsRoutes');
const searchRoutes = require('./routes/searchRoutes');
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/api/auth', authRoutes);
app.use('/api/secondchance/items', secondChanceItemsRoutes);
app.use('/api/secondchance/search', searchRoutes);
app.get('/health', async (req, res, next) => {
  try { const db = await connectToDatabase(); await db.command({ ping: 1 }); res.json({ status: 'ok' }); }
  catch (error) { next(error); }
});
const frontend = path.join(__dirname, '../secondChance-frontend/build');
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../secondChance-frontend/public/home.html')));
app.use('/static', express.static(path.join(__dirname, '../secondChance-frontend/public/static')));
if (fs.existsSync(frontend)) {
  app.use(express.static(frontend));
  app.get('/app*', (req, res) => res.sendFile(path.join(frontend, 'index.html')));
}
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  console.error(error.message);
  res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 5 MB' : 'Internal server error' });
});
if (require.main === module) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured');
  connectToDatabase().then(() => app.listen(process.env.PORT || 3060, '0.0.0.0', () => console.log('SecondChance listening on ' + (process.env.PORT || 3060)))).catch(error => { console.error(error.message); process.exit(1); });
}
module.exports = app;
