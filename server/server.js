require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)),
});

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));

// Signed request to Nexconn: Signature = SHA1(AppSecret + Nonce + Timestamp)
async function nexconnPost(path, body) {
  const nonce = crypto.randomBytes(8).toString('hex'); // 16 chars, limit is 18
  const timestamp = String(Date.now());                // milliseconds
  const signature = crypto.createHash('sha1')
    .update(process.env.NEXCONN_APP_SECRET + nonce + timestamp).digest('hex');
  const res = await fetch(`https://${process.env.NEXCONN_HOST}${path}`, {
    method: 'POST',
    headers: {
      'App-Key': process.env.NEXCONN_APP_KEY,
      Nonce: nonce, Timestamp: timestamp, Signature: signature,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Website sends the Firebase ID token; we verify it, then get a chat token.
app.post('/api/login', async (req, res) => {
  try {
    const decoded = await admin.auth().verifyIdToken(req.body.idToken);
    const userId = decoded.uid; // same id in Firebase and Nexconn
    const out = await nexconnPost('/v4/auth/access-token/issue', {
      userId,
      name: decoded.name || 'Player',
      avatarUrl: decoded.picture || '',
    });
    if (out.code !== 0) return res.status(502).json({ error: 'Nexconn error', details: out });
    res.json({ userId, name: decoded.name, chatToken: out.result.accessToken });
  } catch (e) {
    res.status(401).json({ error: 'Invalid sign-in', message: e.message });
  }
});

app.listen(process.env.PORT || 3001, () => console.log('Server running'));
