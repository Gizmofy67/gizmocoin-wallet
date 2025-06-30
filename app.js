/* app.js – GizmoCoin Wallet + Discount API  (rev 2025-06-30) */

const express = require("express");
const cors    = require("cors");
const axios   = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

/*─────────────────────────────────────────────────────────────*/
/*  In-memory wallet store (use a real DB in production!)      */
const wallet = {};
const WALLET_PASSPHRASE = "@Colts511";
/*─────────────────────────────────────────────────────────────*/

/* GET /wallet?email=…  →  { balance } */
app.get("/wallet", (req, res) => {
  const email = (req.query.email || "").trim();
  if (!email) return res.status(400).json({ error: "Missing email parameter" });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  res.json({ balance: wallet[email].balance });
});

/* POST /wallet  (credit/debit, passphrase required for ≥0.01) */
app.post("/wallet", (req, res) => {
  const email      = (req.body.email || "").trim();
  const amount     = Number(req.body.amount);
  const passphrase = (req.body.passphrase || "").trim();

  if (!email || isNaN(amount))
    return res.status(400).json({ error: "Missing or invalid email/amount" });

  if (amount !== 0 && passphrase !== WALLET_PASSPHRASE)
    return res.status(403).json({ error: "Invalid passphrase" });

  if (amount < -1000 || amount > 1000)
    return res.status(400).json({ error: "Amount out of range ±1000 GZM" });

  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += amount;

  res.json({ balance: wallet[email].balance });
});

/* POST /convert  { email, usd }  →  add GZM */
app.post("/convert", (req, res) => {
  const email = (req.body.email || "").trim();
  const usd   = Number(req.body.usd);
  const RATE  = 1 / 25;               // 25 USD → 1 GZM

  if (!email || isNaN(usd))
    return res.status(400).json({ success: false, message: "Missing or invalid email/USD" });

  const addGZM = +(usd * RATE).toFixed(4);
  if (!wallet[email]) wallet[email] = { balance: 0 };
  wallet[email].balance += addGZM;

  res.json({ success: true, gizmo: addGZM, balance: wallet[email].balance });
});

/*─────────────────────────────────────────────────────────────*/
/*  POST /create-discount  { amount }  →  GZM-$$ discount code */
/*─────────────────────────────────────────────────────────────*/
app.post("/create-discount", async (req, res) => {
  console.log("🔥  /create-discount hit:", req.body);

  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    console.log("❌ Invalid amount:", amount);
    return res.status(400).send("Bad amount");
  }

  const STORE = process.env.SHOPIFY_STORE;      // e.g. mystore.myshopify.com
  const TOKEN = process.env.SHOPIFY_TOKEN;      // Admin API access token
  if (!STORE || !TOKEN) {
    console.log("❌ Missing Shopify env vars:", { STORE, TOKEN: !!TOKEN });
    return res.status(500).send("Shopify env vars missing");
  }

  const API_VER = "2024-04";
  const ADMIN   = `https://${STORE}/admin/api/${API_VER}`;

  try {
    const code = `GZM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now  = new Date();
    const ends = new Date(now.getTime() + 10 * 60 * 1000);   // +10 min

    /* 1️⃣  Create price rule */
    const prRes = await axios.post(
      `${ADMIN}/price_rules.json`,
      {
        price_rule: {
          title:              code,
          target_type:        "line_item",
          target_selection:   "all",
          allocation_method:  "across",
          value_type:         "fixed_amount",
          value:              `-${amount.toFixed(2)}`,  // Shopify expects string!
          customer_selection: "all",
          starts_at:          now.toISOString(),
          ends_at:            ends.toISOString(),
          once_per_customer:  true
        }
      },
      { headers: { "X-Shopify-Access-Token": TOKEN } }
    );

    /* 2️⃣  Attach discount code to that rule */
    await axios.post(
      `${ADMIN}/price_rules/${prRes.data.price_rule.id}/discount_codes.json`,
      { discount_code: { code } },
      { headers: { "X-Shopify-Access-Token": TOKEN } }
    );

    console.log("✅ Discount code created:", code);
    res.send(code);
  } catch (err) {
    /* Full diagnostic logging */
    console.error("🔥 ERROR in /create-discount");
    console.error("Message :", err.message);
    console.error("Status  :", err.response?.status);
    console.error("Data    :", err.response?.data);
    res.status(500).send("ERR");
  }
});

/* Start server */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🪙 GizmoCoin wallet server running on port ${PORT}`);
});





