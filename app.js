import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
import crypto from "crypto";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

/*───────────────────  ENV  ────────────────────*/
const {
  PORT = 10000,
  DATABASE_URL,
  JWT_SECRET = "super-secret-change-me",
  RATE_USD_PER_GZM = 25,
  SHOPIFY_STORE,
  SHOPIFY_TOKEN
} = process.env;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

/*───────────────────  DB  ────────────────────*/
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("amazonaws.com") ? { rejectUnauthorized: false } : false
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS wallets (
    email TEXT PRIMARY KEY,
    balance NUMERIC(20,6) NOT NULL DEFAULT 0
  );
`);

/*───────────────────  APP INIT  ────────────────────*/
const app = express();
app.use(helmet());
app.use(
  cors({
    origin: ["https://getgizmofy.store", /\.gizmofy\.store$/],
    credentials: true
  })
);
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/*───────────────────  AUTH LAYER  ────────────────────*/
const auth = (req, res, next) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
};

/*───────────────────  HELPERS  ────────────────────*/
async function getBalance(email, client = pool) {
  const { rows } = await client.query("SELECT balance FROM wallets WHERE email=$1", [email]);
  return rows[0]?.balance ?? 0;
}

async function setBalance(email, balance, client = pool) {
  await client.query(
    "INSERT INTO wallets(email,balance) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET balance=$2",
    [email, balance]
  );
}

/*───────────────────  BASIC ROUTES  ────────────────────*/
app.get("/", (_req, res) => res.send("GizmoCoin API live"));
app.get("/health", (_req, res) => res.send("OK"));

/*───────────────────  AUTH ENDPOINTS  ────────────────────*/
app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Missing credentials" });
    // TODO: replace with real password check or OAuth
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "15m" });
    res.json({ token });
  })
);

/*───────────────────  WALLET  ────────────────────*/
app.get(
  "/wallet",
  auth,
  asyncHandler(async (req, res) => {
    const balance = await getBalance(req.user.email);
    res.json({ balance });
  })
);

/*───────────────────  USD → GZM  ────────────────────*/
app.post(
  "/convert",
  auth,
  asyncHandler(async (req, res) => {
    const usd = Number(req.body.usd);
    if (isNaN(usd) || usd <= 0)
      return res.status(400).json({ error: "Invalid USD amount" });

    const addGZM = +(usd / RATE_USD_PER_GZM).toFixed(6);
    const current = await getBalance(req.user.email);
    const newBal = +(Number(current) + addGZM).toFixed(6);
    await setBalance(req.user.email, newBal);

    res.json({ gizmo: addGZM, balance: newBal });
  })
);

/*───────────────────  CHECKOUT  ────────────────────*/
app.post(
  "/checkout",
  auth,
  asyncHandler(async (req, res) => {
    const { total, cart } = req.body;

    let gzmTotal = Number(total);
    if (isNaN(gzmTotal) && Array.isArray(cart)) {
      gzmTotal = cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    }
    if (!gzmTotal || gzmTotal <= 0)
      return res.status(400).json({ error: "Invalid total" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const bal = await getBalance(req.user.email, client);
      if (bal < gzmTotal) {
        await client.query("ROLLBACK");
        return res.status(402).json({ error: "Insufficient balance", balance: bal });
      }

      const newBal = +(Number(bal) - gzmTotal).toFixed(6);
      await setBalance(req.user.email, newBal, client);
      await client.query("COMMIT");

      res.json({ orderId: crypto.randomUUID(), remaining: newBal });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

/*───────────────────  SHOPIFY DISCOUNT  ────────────────────*/
app.post(
  "/create-discount",
  auth,
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    if (!amount || !SHOPIFY_STORE || !SHOPIFY_TOKEN)
      return res.status(500).json({ error: "Server misconfiguration" });

    const code = `GZM-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const now = new Date().toISOString();
    const ends = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    const ADMIN = `https://${SHOPIFY_STORE}/admin/api/2024-04`;

    const prRes = await axios.post(
      `${ADMIN}/price_rules.json`,
      {
        price_rule: {
          title: code,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "fixed_amount",
          value: `-${amount.toFixed(2)}`,
          customer_selection: "prerequisite",
          starts_at: now,
          ends_at: ends,
          once_per_customer: true
        }
      },
      { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN } }
    );

    await axios.post(
      `${ADMIN}/price_rules/${prRes.data.price_rule.id}/discount_codes.json`,
      { discount_code: { code } },
      { headers: { "X-Shopify-Access-Token": SHOPIFY_TOKEN } }
    );

    res.json({ code, expires: ends });
  })
);

/*───────────────────  ERROR HANDLER  ────────────────────*/
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

/*───────────────────  START SERVER  ────────────────────*/
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🪙 GizmoCoin wallet running on port ${PORT}`);
});









