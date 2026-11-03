require('dotenv').config();
const express = require('express');
const natural = require('natural');
const app = express();
const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
const tokenizer = new natural.WordTokenizer();
app.use(express.json({ limit: '100kb' }));
app.post('/sentiment', (req, res) => {
  const { sentence } = req.body;
  if (typeof sentence !== 'string' || !sentence.trim()) return res.status(400).json({ error: 'No sentence provided' });
  try {
    const sentimentScore = analyzer.getSentiment(tokenizer.tokenize(sentence));
    const sentiment = sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral';
    res.json({ sentimentScore, sentiment });
  } catch (error) { res.status(500).json({ message: 'Error performing sentiment analysis' }); }
});
if (require.main === module) app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Sentiment service ready'));
module.exports = app;
