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
const app = express();
const port = process.env.PORT || 10000;
// CORS: Allow only your store
app.use(cors({
  origin: "https://getgizmofy.store",
  credentials: true
}));

app.use(express.json());
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// === WALLET ROUTES ===

app.get("/wallet/balance", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const result = await pool.query("SELECT balance FROM wallets WHERE email = $1", [email]);
    const balance = result.rows[0]?.balance || 0;
    res.json({ balance });
  } catch (err) {
    console.error("Balance fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// === CREDIT WALLET ROUTE ===
app.post("/create-discount", async (req, res) => {
  const { gzm, email, pass } = req.body;
  if (!gzm || !email || !pass) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  if (pass !== process.env.ADMIN_CODE) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }

  try {
    await pool.query(
      `INSERT INTO wallets (email, balance)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET balance = wallets.balance + $2`,
      [email, gzm]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Credit error:", err);
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// === START SERVER ===
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});















