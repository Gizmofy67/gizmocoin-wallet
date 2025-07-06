import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const wallet = {};

/*───────────────────  BASIC ROUTES  ────────────────────*/

// Root ping (Render hits this by default)
app.get('/', (req, res) => {
  res.send('GizmoCoin API live');
});

// Health check
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

/*───────────────────  AUTH  ────────────────────*/

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) return res.json('dummy-token-123');
  res.status(400).json({ error: 'Missing credentials' });
});

/*───────────────────  WALLET  ────────────────────*/

app.get('/wallet', (req, res) => {
  res.json({ balance: 10 }); // placeholder
});

/*───────────────────  CHECKOUT  ────────────────────*/

// Accepts { email,total } OR { cart:[{qty}] } (1 GZM per item)
app.post('/checkout', (req, res) => {
  const email = (req.body.email || 'test@gizmofy.store').trim();

  let total = Number(req.body.total);
  if (isNaN(total) && Array.isArray(req.body.cart)) {
    total = req.body.cart.reduce(
      (sum, item) => sum + (Number(item.qty) || 1),
      0
    );
  }

  if (!total || total <= 0)
    return res.status(400).json({ error: 'Invalid total amount' });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  if (wallet[email].balance < total)
    return res.status(402).json({ error: 'Insufficient balance' });

  wallet[email].balance -= total;
  res.json({
    id: Math.floor(Math.random() * 10000),
    remaining: wallet[email].balance
  });
});

/*───────────────────  USD → GZM  ────────────────────*/

app.post('/convert', (req, res) => {
  const email = (req.body.email || '').trim();
  const usd = Number(req.body.usd);
  const RATE = 1 / 25; // $25 = 1 GZM

  if (!email || isNaN(usd))
    return res.status(400).json({ message: 'Invalid input' });

  const addGZM = +(usd * RATE).toFixed(4);
  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += addGZM;

  res.json({ success: true, gizmo: addGZM, balance: wallet[email].balance });
});

/*───────────────────  SHOPIFY DISCOUNT  ────────────────────*/

app.post('/create-discount', async (req, res) => {
  const amount = Number(req.body.amount);
  const { SHOPIFY_STORE: STORE, SHOPIFY_TOKEN: TOKEN } = process.env;
  const API_VER = '2024-04';
  const ADMIN = `https://${STORE}/admin/api/${API_VER}`;

  if (!amount || !STORE || !TOKEN)
    return res.status(500).send('Missing data');

  try {
    const code = `GZM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now = new Date();
    const ends = new Date(now.getTime() + 10 * 60 * 1000);

    const pr = await axios.post(
      `${ADMIN}/price_rules.json`,
      {
        price_rule: {
          title: code,
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          value_type: 'fixed_amount',
          value: `-${amount.toFixed(2)}`,
          customer_selection: 'all',
          starts_at: now.toISOString(),
          ends_at: ends.toISOString(),
          once_per_customer: true
        }
      },
      { headers: { 'X-Shopify-Access-Token': TOKEN } }
    );

    await axios.post(
      `${ADMIN}/price_rules/${pr.data.price_rule.id}/discount_codes.json`,
      { discount_code: { code } },
      { headers: { 'X-Shopify-Access-Token': TOKEN } }
    );

    res.send(code);
  } catch (err) {
    console.error('Discount error:', err.response?.data || err.message);
    res.status(500).send('ERR');
  }
});

/*───────────────────  START SERVER  ────────────────────*/

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪙 GizmoCoin wallet running on port ${PORT}`);
});








