const router = require('express').Router();
const connectToDatabase = require('../models/db');
const escapeRegex = text => text.replace(/[.*+?^{}()|[\]\\$]/g, '\\$&');
router.get('/', async (req, res, next) => {
  try {
    const query = {};
    if (typeof req.query.name === 'string' && req.query.name.trim()) query.name = { $regex: escapeRegex(req.query.name.trim()), $options: 'i' };
    for (const key of ['category', 'condition']) {
      if (typeof req.query[key] === 'string' && req.query[key]) query[key] = req.query[key];
    }
    if (req.query.age_years !== undefined && req.query.age_years !== '') {
      const age = Number(req.query.age_years);
      if (!Number.isFinite(age) || age < 0) return res.status(400).json({ error: 'Invalid age_years' });
      query.age_years = { $lte: age };
    }
    const db = await connectToDatabase();
    res.json(await db.collection('secondChanceItems').find(query).toArray());
  } catch (error) { next(error); }
});
module.exports = router;
