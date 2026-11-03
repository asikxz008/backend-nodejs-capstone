const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const connectToDatabase = require('../models/db');
const router = express.Router();
const directoryPath = path.join(__dirname, '../public/images');
fs.mkdirSync(directoryPath, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: directoryPath,
    filename: (req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype))
});
const fields = ['name', 'category', 'condition', 'posted_by', 'zipcode', 'description'];
const itemFields = body => Object.fromEntries(fields.filter(key => typeof body[key] === 'string').map(key => [key, body[key].trim()]));
// Mounted at /api/secondchance/items in app.js.
router.get('/', async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    res.json(await db.collection('secondChanceItems').find({}).toArray());
  } catch (error) { next(error); }
});
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const item = itemFields(req.body);
    if (!item.name || !item.category || !item.condition) return res.status(400).json({ error: 'Name, category and condition are required' });
    Object.assign(item, { id: randomUUID(), date_added: Math.floor(Date.now() / 1000), age_days: 0, age_years: 0, comments: [], image: req.file ? '/images/' + req.file.filename : '' });
    const db = await connectToDatabase();
    const result = await db.collection('secondChanceItems').insertOne(item);
    res.status(201).json({ ...item, _id: result.insertedId });
  } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const item = await db.collection('secondChanceItems').findOne({ id: req.params.id });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) { next(error); }
});
router.put('/:id', async (req, res, next) => {
  try {
    const changes = itemFields(req.body);
    if (!Object.keys(changes).length) return res.status(400).json({ error: 'No valid item fields supplied' });
    const db = await connectToDatabase();
    const result = await db.collection('secondChanceItems').findOneAndUpdate({ id: req.params.id }, { $set: changes }, { returnDocument: 'after' });
    if (!result.value) return res.status(404).json({ error: 'Item not found' });
    res.json(result.value);
  } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const result = await db.collection('secondChanceItems').deleteOne({ id: req.params.id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted', id: req.params.id });
  } catch (error) { next(error); }
});
module.exports = router;
