const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');
const db = require('../models/db');
const data = require('../util/import-mongo/secondChanceItems.json').docs;
describe('SecondChance API with MongoDB', function () {
  let token, created;
  const user = { firstName: 'Test', lastName: 'Learner', email: 'api-test@example.test', password: 'IntegrationPass123!' };
  before(async () => {
    assert.ok(process.env.MONGO_DB?.endsWith('_test'), 'Tests require a disposable _test database');
    const database = await db();
    await database.dropDatabase();
    await database.collection('secondChanceItems').insertMany(data.map(({ _id, ...item }) => item));
  });
  after(async () => { const database = await db(); await database.dropDatabase(); await db.close(); });
  it('lists 16 imported items and fetches one item', async () => {
    const all = await request(app).get('/api/secondchance/items').expect(200);
    assert.equal(all.body.length, 16);
    const one = await request(app).get('/api/secondchance/items/' + data[0].id).expect(200);
    assert.equal(one.body.name, data[0].name);
    await request(app).get('/api/secondchance/items/missing').expect(404);
  });
  it('filters category, name, condition and maximum age', async () => {
    const response = await request(app).get('/api/secondchance/search').query({ category: data[0].category, age_years: 100 }).expect(200);
    assert.ok(response.body.length);
    assert.ok(response.body.every(item => item.category === data[0].category && item.age_years <= 100));
    const escaped = await request(app).get('/api/secondchance/search').query({ name: '.*' }).expect(200);
    assert.equal(escaped.body.length, 0);
    await request(app).get('/api/secondchance/search?age_years=bad').expect(400);
  });
  it('creates an item with multipart image, updates and deletes it', async () => {
    const response = await request(app).post('/api/secondchance/items').field('name', 'API test lamp').field('category', 'Kitchen').field('condition', 'New').attach('file', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw2kAAAAASUVORK5CYII=', 'base64'), { filename: 'pixel.png', contentType: 'image/png' }).expect(201);
    created = response.body;
    assert.ok(created.id);
    assert.ok(created.image.startsWith('/images/'));
    await request(app).get(created.image).expect(200);
    const updated = await request(app).put('/api/secondchance/items/' + created.id).send({ name: 'Updated lamp', _id: 'ignored' }).expect(200);
    assert.equal(updated.body.name, 'Updated lamp');
    await request(app).delete('/api/secondchance/items/' + created.id).expect(200);
    await request(app).get('/api/secondchance/items/' + created.id).expect(404);
  });
  it('registers, rejects duplicates and invalid credentials, and logs in', async () => {
    const registration = await request(app).post('/api/auth/register').send(user).expect(201);
    assert.ok(registration.body.authtoken);
    assert.equal(registration.body.user.password, undefined);
    const database = await db();
    const stored = await database.collection('users').findOne({ email: user.email });
    assert.notEqual(stored.password, user.password);
    await request(app).post('/api/auth/register').send(user).expect(409);
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong' }).expect(401);
    const login = await request(app).post('/api/auth/login').send(user).expect(200);
    token = login.body.authtoken;
    assert.ok(token);
  });
  it('protects profile updates with JWT and updates only the authenticated user', async () => {
    await request(app).put('/api/auth/updateuser').send({ name: 'Unauthorized' }).expect(401);
    const profile = await request(app).put('/api/auth/updateuser').set('Authorization', 'Bearer ' + token).send({ name: 'Updated', email: 'other@example.test' }).expect(200);
    assert.equal(profile.body.user.firstName, 'Updated');
    assert.equal(profile.body.user.email, user.email);
    await request(app).get('/api/auth/user').set('Authorization', 'Bearer ' + token).expect(200);
  });
});
