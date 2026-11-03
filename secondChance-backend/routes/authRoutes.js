const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const connectToDatabase = require('../models/db');
const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured');
  return process.env.JWT_SECRET;
};
const publicUser = user => ({ id: user._id.toString(), firstName: user.firstName, lastName: user.lastName, email: user.email });
const tokenFor = user => jwt.sign({ user: { id: user._id.toString() } }, secret(), { expiresIn: '1h' });
const normalizedEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
router.post('/register', async (req, res, next) => {
  try {
    const { firstName, lastName, password } = req.body;
    const email = normalizedEmail(req.body.email);
    if (typeof firstName !== 'string' || !firstName.trim() || typeof lastName !== 'string' || !lastName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Provide first name, last name, valid email and an 8-72 character password' });
    secret();
    const db = await connectToDatabase();
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    const user = { firstName: firstName.trim(), lastName: lastName.trim(), email, password: await bcrypt.hash(password, 12), createdAt: new Date() };
    const result = await users.insertOne(user);
    user._id = result.insertedId;
    res.status(201).json({ message: 'User registered successfully', authtoken: tokenFor(user), email: user.email, user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Email already registered' });
    next(error);
  }
});
router.post('/login', async (req, res, next) => {
  try {
    const email = normalizedEmail(req.body.email);
    if (!email || typeof req.body.password !== 'string') return res.status(400).json({ error: 'Email and password are required' });
    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ email });
    if (!user || !await bcrypt.compare(req.body.password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ authtoken: tokenFor(user), userName: user.firstName, userEmail: user.email, user: publicUser(user) });
  } catch (error) { next(error); }
});
function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['auth-token'];
    const payload = jwt.verify(token || '', secret());
    if (!ObjectId.isValid(payload.user?.id)) return res.status(401).json({ error: 'Invalid token' });
    req.userId = new ObjectId(payload.user.id);
    next();
  } catch (error) { res.status(401).json({ error: 'Authentication required' }); }
}
router.get('/user', authenticate, async (req, res, next) => {
  try {
    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: req.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(user));
  } catch (error) { next(error); }
});
router.put(['/updateuser', '/update'], authenticate, async (req, res, next) => {
  try {
    const changes = {};
    const name = req.body.firstName || req.body.name;
    if (typeof name === 'string' && name.trim()) changes.firstName = name.trim();
    if (typeof req.body.lastName === 'string' && req.body.lastName.trim()) changes.lastName = req.body.lastName.trim();
    if (!Object.keys(changes).length) return res.status(400).json({ error: 'No valid profile fields supplied' });
    const db = await connectToDatabase();
    const result = await db.collection('users').findOneAndUpdate({ _id: req.userId }, { $set: changes }, { returnDocument: 'after' });
    if (!result.value) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User updated successfully', user: publicUser(result.value) });
  } catch (error) { next(error); }
});
module.exports = router;
