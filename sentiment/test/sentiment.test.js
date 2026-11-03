const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../index');
test('classifies positive and negative sentences and validates input', async () => {
  const positive = await request(app).post('/sentiment').send({ sentence: 'I love this beautiful wonderful gift' }).expect(200);
  assert.equal(positive.body.sentiment, 'positive');
  const negative = await request(app).post('/sentiment').send({ sentence: 'I hate this awful terrible broken thing' }).expect(200);
  assert.equal(negative.body.sentiment, 'negative');
  await request(app).post('/sentiment').send({}).expect(400);
});
