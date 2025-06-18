const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

// Simple in-memory wallet store (use a DB later)
const walletData = {};

app.get('/wallet', (req, res) => {
  const email = req.query.email;

  if (!email) {
    return res.status(400).json({ error: 'Missing email parameter' });
  }

  if (!walletData[email]) {
    walletData[email] = { balance: 0 };
  }

  res.json({ balance: walletData[email].balance });
});

// Optional: POST route to simulate adding GizmoCoin
app.post('/wallet', (req, res) => {
  const { email, amount } = req.body;

  if (!email || typeof amount !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid data' });
  }

  if (!walletData[email]) {
    walletData[email] = { balance: 0 };
  }

  walletData[email].balance += amount;
  res.json({ balance: walletData[email].balance });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`GizmoCoin wallet server running on port ${PORT}`);
});

