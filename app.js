// === app.js — COMPLETE, FUNCTIONAL, AND CLEAN ===
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

// === Middleware ===
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

// === PostgreSQL Connection ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// === WALLET BALANCE ===
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

// === ADMIN CREDIT GIZMOCOIN ===
app.post("/create-discount", async (req, res) => {
  const { gzm, email, pass } = req.body;
  if (!gzm || !email || !pass) return res.status(400).json({ success: false, error: "Missing fields" });
  if (pass !== process.env.ADMIN_CODE) return res.status(403).json({ success: false, error: "Unauthorized" });

  try {
    await pool.query(`
      INSERT INTO wallets (email, balance)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET balance = wallets.balance + $2
    `, [email, gzm]);

    res.json({ success: true });
  } catch (err) {
    console.error("Credit error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// === CONVERT USD TO GIZMOCOIN ===
app.post("/convert", async (req, res) => {
  const { usd, email } = req.body;
  if (!usd || !email) return res.status(400).json({ success: false, error: "Missing fields" });

  const rate = 25;
  const gzm = parseFloat((usd / rate).toFixed(4));

  try {
    await pool.query(`
      INSERT INTO wallets (email, balance)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET balance = wallets.balance + $2
    `, [email, gzm]);

    res.json({ success: true, gzm });
  } catch (err) {
    console.error("Conversion error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// === GIZMOCOIN CHECKOUT ===
app.post("/checkout", async (req, res) => {
  const { email, items } = req.body;
  if (!email || !items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  const totalUSD = items.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0);
  const totalGZM = parseFloat((totalUSD / 25).toFixed(4));

  try {
    const result = await pool.query("SELECT balance FROM wallets WHERE email = $1", [email]);
    const balance = result.rows[0]?.balance || 0;

    if (balance < totalGZM) {
      return res.status(402).json({ success: false, message: "Insufficient GizmoCoin balance." });
    }

    await pool.query("UPDATE wallets SET balance = balance - $1 WHERE email = $2", [totalGZM, email]);
    return res.status(200).json({ success: true, message: "Checkout successful." });
  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ success: false, message: "Server error during checkout." });
  }
});

// === START SERVER ===
app.listen(port, () => {
  console.log(`🪙 GizmoCoin wallet running on port ${port}`);
});


