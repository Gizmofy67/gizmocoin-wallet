/* app.js – GizmoCoin Wallet API
   Simple in-memory version. Replace with DB
   when you’re ready for persistence.          */

const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------------
// In-memory wallet store  { email: { balance: Number } }
const wallet = {};

// ------------------------------------------------------------------
// GET  /wallet?email=someone@example.com
// ------------------------------------------------------------------
app.get('/wallet', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Missing email parameter' });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  res.json({ balance: wallet[email].balance });
});

// ------------------------------------------------------------------
// POST /wallet      { email, amount }   (amount = GZM to add)
// An optional “manual credit” route – you can keep or delete it.
// ------------------------------------------------------------------
app.post('/wallet', (req, res) => {
  const { email, amount } = req.body;
  if (!email || typeof amount !== 'number')
    return res.status(400).json({ error: 'Missing or invalid data' });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += amount;
  res.json({ balance: wallet[email].balance });
});

// ------------------------------------------------------------------
// POST /convert     { email, usd }
// 1. Converts USD → GizmoCoin (1 GZM per $25)
// 2. Adds GZM to wallet
// 3. Returns success + amount added + new balance
// ------------------------------------------------------------------
app.post('/convert', (req, res) => {
  const { email, usd } = req.body;
  if (!email || typeof usd !== 'number')
    return res.status(400).json({ success: false, message: 'Missing or invalid data' });

  const GIZMO_PER_USD = 1 / 25;              // $25 = 1 GZM
  const gizmoAdded    = +(usd * GIZMO_PER_USD).toFixed(4); // round to 4 dp

  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += gizmoAdded;

  res.json({
    success: true,
    gizmo:   gizmoAdded,
    balance: wallet[email].balance
  });
});

// ------------------------------------------------------------------

app.listen(PORT, () => console.log(`🪙 GizmoCoin wallet server running on ${PORT}`));


const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`GizmoCoin wallet server running on port ${PORT}`);
});

