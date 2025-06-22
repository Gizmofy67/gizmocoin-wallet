import express from "express";
import axios   from "axios";
import bodyParser from "body-parser";

const app  = express();
app.use(bodyParser.json());

const STORE  = process.env.SHOPIFY_STORE;            // 2auhys-yk.myshopify.com
const TOKEN  = process.env.SHOPIFY_TOKEN;            // shpat_***
const ADMIN  = `https://${TOKEN}@${STORE}/admin/api/2024-04`;

/* ───────── POST /create-discount ─────────
   Body: { amount: 44.85 }   ← USD (decimal)
   Returns plain text code, e.g. “GZM-ABCD”
*/
app.post("/create-discount", async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).send("Bad amount");

    const code = `GZM-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const now  = new Date().toISOString();

    /* 1️⃣  Create Price Rule worth the exact amount */
    const pr = await axios.post(`${ADMIN}/price_rules.json`, {
      price_rule: {
        title:              code,
        target_type:        "line_item",
        target_selection:   "all",
        allocation_method:  "across",
        value_type:         "fixed_amount",
        value:              -amount,          // negative for discount
        customer_selection: "all",
        starts_at:          now,
        ends_at:            new Date(Date.now()+10*60*1000).toISOString(), // 10-min expiry
        once_per_customer:  true
      }
    });

    const ruleId = pr.data.price_rule.id;

    /* 2️⃣  Attach the one-time code */
    await axios.post(`${ADMIN}/price_rules/${ruleId}/discount_codes.json`, {
      discount_code: { code }
    });

    res.send(code);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send("ERR");
  }
});



// ------------------------------------------------------------------
// ⬇️  put the port FIRST, then call app.listen
