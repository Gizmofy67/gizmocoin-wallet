// app.js
const express = require('express');
const cors    = require('cors');

const app  = express();
app.use(cors());
app.use(express.json());

// Always listen on the port Render gives you
const PORT = process.env.PORT || 10000;

/**
 * Dummy in-memory balances.
 * Replace with real database look-ups later.
 */
const balances = {
  'arthurskinney@yahoo.com': 150,
  'test@example.com': 0
};

/**
 * GET /wallet?email=user@example.com
 * Returns { balance: <number> }
 * If the email is not found, balance is 0 (no 404).
 */
app.get('/wallet', (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const balance = balances[email] ?? 0;
  return res.json({ balance });
});

app.listen(PORT, () => {
  console.log(`GizmoCoin wallet server running on port ${PORT}`);
});
