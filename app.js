/* app.js – GizmoCoin Wallet + Discount API
   Simple in-memory wallet; add DB later.
*/

const express     = require("express");
const cors        = require("cors");
const axios       = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

/* ───────────────── In-memory wallet ────────────────── */
const wallet = {};        // { email: { balance:Number } }

/* GET  /wallet?email=…  → { balance } */
app.get("/wallet", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Missing email parameter" });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  res.json({ balance: wallet[email].balance });
});

/* POST /wallet  { email, amount }  → credit/debit GZM */
app.post("/wallet", (req, res) => {
  const { email, amount } = req.body;
  if (!email || typeof amount !== "number")
    return res.status(400).json({ error: "Missing or invalid data" });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += amount;
  res.json({ balance: wallet[email].balance });
});

/* POST /convert  { email, usd }  → convert USD to GZM and credit */
app.post("/convert", (req, res) => {
  const { email, usd } = req.body;
  if (!email || typeof usd !== "number")
    return res.status(400).json({ success: false, message: "Missing or invalid data" });

  const GIZMO_PER_USD = 1 / 25;                    // $25 = 1 GZM
  const gizmoAdded    = +(usd * GIZMO_PER_USD).toFixed(4);

  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += gizmoAdded;

  res.json({ success: true, gizmo: gizmoAdded, balance: wallet[email].balance });
});

/* ───────────────── Create-discount route ──────────────────
   Needs env vars: SHOPIFY_STORE, SHOPIFY_TOKEN
   Body: { amount: 44.85 } → returns plain-text code (e.g. GZM-ABCD)
*/
app.post("/create-discount", async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).send("Bad amount");

    const STORE = process.env.SHOPIFY_STORE;      // e.g. 2auhys-yk.myshopify.com
    const TOKEN = process.env.SHOPIFY_TOKEN;      // shpat_***
    if (!STORE || !TOKEN) return res.status(500).send("Shopify env vars missing");

    const ADMIN = `https://${TOKEN}@${STORE}/admin/api/2024-04`;

    const code = `GZM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now  = new Date().toISOString();

    /* 1️⃣ Create price rule */
    const pr = await axios.post(`${ADMIN}/price_rules.json`, {
      price_rule: {
        title: code,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "fixed_amount",
        value: -amount,                      // negative for discount
        customer_selection: "all",
        starts_at: now,
        ends_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
        once_per_customer: true
      }
    });

    /* 2️⃣ Attach one-time code */
    await axios.post(`${ADMIN}/price_rules/${pr.data.price_rule.id}/discount_codes.json`, {
      discount_code: { code }
    });

    res.send(code);                            // plain text
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send("ERR");
  }
});

/* ───────────────── Start server ────────────────── */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🪙 GizmoCoin wallet server running on port ${PORT}`);
});
