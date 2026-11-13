import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { NCEngine, DirectChannel, SendTextMessageParams, MessageHandler } from '@nexconn/chat';

const env = import.meta.env;
const auth = getAuth(initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
}));

const $ = (id) => document.getElementById(id);
const say = (t) => ($('status').textContent = t);
const addLine = (t, mine) => {
  const p = document.createElement('div');
  p.textContent = t; if (mine) p.className = 'me';
  $('log').appendChild(p);
};

let myId = null;

$('login').onclick = async () => {
  try {
    say('Signing in...');
    // 1. Google sign-in through Firebase
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const idToken = await cred.user.getIdToken();

    // 2. Backend verifies it and returns a Nexconn chat token
    const r = await fetch(`${env.VITE_API_URL}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || data.error);
    myId = data.userId;

    // 3. Connect the chat SDK with that token
    NCEngine.initialize({ appKey: env.VITE_NEXCONN_APP_KEY });
    NCEngine.addMessageHandler('main', new MessageHandler({
      onMessageReceived({ messages }) {
        messages.forEach((m) => addLine(`${m.senderUserId}: ${m.content?.text ?? ''}`, false));
      },
    }));
    const result = await NCEngine.connect({ token: data.chatToken });
    console.log('connect result', result);

    say(`Signed in as ${data.name}. Your user id: ${myId}`);
    $('chat').classList.remove('hidden');
  } catch (e) { say(`Failed: ${e.message}`); console.error(e); }
};

$('send').onclick = async () => {
  const peer = $('peer').value.trim(), text = $('text').value.trim();
  if (!peer || !text) return;
  const channel = new DirectChannel(peer);
  const result = await channel.sendMessage(new SendTextMessageParams({ text }));
  console.log('send result', result);
  addLine(text, true); $('text').value = '';
};
