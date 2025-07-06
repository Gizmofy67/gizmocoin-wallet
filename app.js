<pre><code>import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const wallet = {};  // in-memory wallet store

// 🔧 Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 🔧 Dummy login
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    return res.json("dummy-token-123");
  }
  res.status(400).json({ error: "Missing credentials" });
});

// 🔧 Dummy wallet







