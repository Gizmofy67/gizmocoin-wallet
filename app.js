import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const wallet = {};

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Dummy login
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    return res.json("dummy-token-123");
  }
  res.status(400).json({ error: "Missing credentials" });
});

// Wallet balance
app.get('/wallet', (req, res) => {
  res.json({ balance: 10 });
});

/*─────────────────────────  UPDATED CHECKOUT  ───────────────────────*/
// Accepts either { email,total } OR { cart:[{ qty }] } and derives total.
app.post("/checkout", (req, res) => {
  const email = (req.body.email || "test@gizmofy.store").trim();

  // If total not provided, derive it from cart array (1 GZM per item × qty)
  let total = Number(req.body.total);
  if (isNaN(total) && Array.isArray(req.body.cart)) {
    total = req.body.cart.reduce((sum, item) => {
      return sum + (Number(item.qty) || 1);
    }, 0);
  }

  if (!total || total <= 0) {
    return res.status(400).json({ error: "Invalid total amount" });
  }

  if (!wallet[email]) wallet[email] = { balance: 0 };
  if (wallet[email].balance < total) {
    return res.status(402).json({ error: "Insufficient balance" });
  }

  wallet[email].balance -= total;

  res.json({
    id: Math.floor(Math.random() * 10000),
    remaining: wallet[email].balance
  });
});
/*────────────────────────────────────────────────────────────────────*/

// USD → GZM Conversion
app.post("/convert", (req, res) => {
  const email = (req.body.email || "").trim();
  const usd = Number(req.body.usd);
  const RATE = 1 / 25;

  if (!email || isNaN(usd))
    return res.status(400).json({ message: "Invalid input" });

  const addGZM = +(usd * RATE).toFixed(4);
  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += addGZM;

  res.json({ success: true, gizmo: addGZM, balance: wallet[email].balance })

});








