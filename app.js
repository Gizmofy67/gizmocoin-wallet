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
const port = process.env.PORT || 3000;

// CORS FIX: allow only your live store with credentials
app.use(cors({
  origin: "https://getgizmofy.store",
  credentials: true
}));

app.use(express.json());
app.use(helmet());

// Optional rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// WALLET BALANCE ROUTE
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

// Add your other routes here (convert, create-discount, etc.)

// Server start
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});










