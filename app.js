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

// Checkout
app.post("/checkout", (req, res) => {
  const email = (req.body.email || "").trim();
  const total = Number(req.body.total);

  if (!email || isNaN(total) || total <= 0)
    return res.status(400).json({ error: "Invalid email or total amount" });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  if (wallet[email].balance < total)
    return res.status(402).json({ error: "Insufficient balance" });

  wallet[email].balance -= total;
  res.json({ message: "Checkout successful", remaining: wallet[email].balance });
});

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

  res.json({ success: true, gizmo: addGZM, balance: wallet[email].balance });
});

// Shopify Discount Code
app.post("/create-discount", async (req, res) => {
  const amount = Number(req.body.amount);
  const STORE = process.env.SHOPIFY_STORE;
  const TOKEN = process.env.SHOPIFY_TOKEN;
  const API_VER = "2024-04";
  const ADMIN = `https://${STORE}/admin/api/${API_VER}`;

  if (!amount || !STORE || !TOKEN) return res.status(500).send("Missing data");

  try {
    const code = `GZM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now = new Date();
    const ends = new Date(now.getTime() + 10 * 60 * 1000);

    const pr = await axios.post(`${ADMIN}/price_rules.json`, {
      price_rule: {
        title: code,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "fixed_amount",
        value: `-${amount.toFixed(2)}`,
        customer_selection: "all",
        starts_at: now.toISOString(),
        ends_at: ends.toISOString(),
        once_per_customer: true
      }
    }, { headers: { "X-Shopify-Access-Token": TOKEN } });

    await axios.post(`${ADMIN}/price_rules/${pr.data.price_rule.id}/discount_codes.json`, {
      discount_code: { code }
    }, { headers: { "X-Shopify-Access-Token": TOKEN } });

    res.send(code);
  } catch (err) {
    console.error("Discount error:", err.response?.data || err.message);
    res.status(500).send("ERR");
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🪙 GizmoCoin wallet running on port ${PORT}`);
});








