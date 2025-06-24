/* app.js – GizmoCoin Wallet + Discount API */

const express = require("express");
const cors    = require("cors");
const axios   = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const wallet = {}; // In-memory wallet store
const WALLET_PASSPHRASE = "@Colts511";

/* GET /wallet?email=… */
app.get("/wallet", (req, res) => {
  const email = (req.query.email || "").trim();
  if (!email) return res.status(400).json({ error: "Missing email parameter" });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  res.json({ balance: wallet[email].balance });
});

/* POST /wallet → credit/debit GZM (requires passphrase) */
app.post("/wallet", (req, res) => {
  const email = (req.body.email || "").trim();
  const amount = Number(req.body.amount);
  const passphrase = (req.body.passphrase || "").trim();

  if (passphrase !== WALLET_PASSPHRASE)
    return res.status(403).json({ error: "Invalid passphrase" });

  if (!email || isNaN(amount))
    return res.status(400).json({ error: "Missing or invalid email/amount" });

  if (amount <= 0 || amount > 1000)
    return res.status(400).json({ error: "Amount must be between 0 and 1000 GZM" });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += amount;

  res.json({ balance: wallet[email].balance });
});

/* POST /convert → convert USD to GZM */
app.post("/convert", (req, res) => {
  const email = (req.body.email || "").trim();
  const usd = Number(req.body.usd);
  const GIZMO_PER_USD = 1 / 25;

  if (!email || isNaN(usd)) {
    return res.status(400).json({ success: false, message: "Missing or invalid email/USD" });
  }

  const gizmoAdded = +(usd * GIZMO_PER_USD).toFixed(4);
  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += gizmoAdded;

  res.json({ success: true, gizmo: gizmoAdded, balance: wallet[email].balance });
});

/* ✅ POST /create-discount → generates a 10-minute Shopify discount */
app.post("/create-discount", async (req, res) => {
  console.log("🔥 /create-discount hit with:", req.body);

  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      console.log("❌ Invalid amount:", amount);
      return res.status(400).send("Bad amount");
    }

    const STORE = process.env.SHOPIFY_STORE;
    const TOKEN = process.env.SHOPIFY_TOKEN;
    if (!STORE || !TOKEN) {
      console.log("❌ Missing Shopify env vars:", { STORE, TOKEN });
      return res.status(500).send("Shopify env vars missing");
    }

    const ADMIN = `https://${TOKEN}@${STORE}/admin/api/2024-04`;
    const code = `GZM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    // 1️⃣ Create price rule
    const pr = await axios.post(`${ADMIN}/price_rules.json`, {
      price_rule: {
        title: code,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "fixed_amount",
        value: -amount,
        customer_selection: "all",
        starts_at: now,
        ends_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        once_per_customer: true
      }
    });

    // 2️⃣ Attach discount code
    await axios.post(
      `${ADMIN}/price_rules/${pr.data.price_rule.id}/discount_codes.json`,
      { discount_code: { code } }
    );

    console.log("✅ Discount code created:", code);
    res.send(code);

  } catch (err) {
    console.error("🔥 ERROR in /create-discount:", err.response?.data || err.message || err);
    res.status(500).send("ERR");
  }
});

/* Start server */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🪙 GizmoCoin wallet server running on port ${PORT}`);
});




