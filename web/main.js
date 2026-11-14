import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { NCEngine, DirectChannel, GroupChannel, SendTextMessageParams, MessageHandler } from '@nexconn/chat';
import * as NC from '@nexconn/chat'; // used for history; if a name is missing it only affects history

const env = import.meta.env;
const auth = getAuth(initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
}));

const FREE = 1; // GroupJoinPermission.FREE: anyone can join without approval
const GROUP_TYPE = 3; // ChannelType.GROUP
const COMMUNITIES = ['Football', 'Cricket', 'Badminton', 'Basketball', 'Running', 'Weekend Hangouts']
  .map((name) => ({ name, id: 'community-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));

const $ = (id) => document.getElementById(id);
const say = (t, err = false) => { $('status').textContent = t; $('status').className = err ? 'err' : ''; };
const fail = (what, r) => { say(`${what} (code ${r?.code ?? 'unknown'})`, true); console.error(what, r); };
const keyOf = (type, id) => `${type}:${id}`;

let myId = null, active = null, convos = {};
const msgs = {}, unread = {}, loaded = {};

const store = () => `khel_chats_${myId}`;
const save = () => { try { localStorage.setItem(store(), JSON.stringify(convos)); } catch {} };
const restore = () => { try { convos = JSON.parse(localStorage.getItem(store())) || {}; } catch { convos = {}; } };

function listButton(key, label) {
  const li = document.createElement('li'), b = document.createElement('button');
  b.textContent = label;
  if (key === active) b.setAttribute('aria-current', 'true');
  if (unread[key]) { const s = document.createElement('span'); s.className = 'badge'; s.textContent = unread[key]; b.appendChild(s); }
  li.appendChild(b); return [li, b];
}

function renderLists() {
  const comm = $('communities'), ppl = $('people');
  comm.innerHTML = ''; ppl.innerHTML = '';
  COMMUNITIES.forEach((c) => {
    const key = keyOf('g', c.id), [li, b] = listButton(key, c.name);
    b.onclick = () => joinCommunity(c); comm.appendChild(li);
  });
  Object.entries(convos).filter(([, c]) => !c.id.startsWith('community-')).forEach(([key, c]) => {
    const [li, b] = listButton(key, (c.type === 'g' ? '# ' : '@ ') + c.name);
    b.onclick = () => openConv(key); ppl.appendChild(li);
  });
}

function renderLog() {
  const log = $('log'); log.innerHTML = '';
  const list = msgs[active] || [];
  if (!list.length) { log.innerHTML = '<p class="empty">No messages yet. Say hi.</p>'; return; }
  const isGroup = convos[active]?.type === 'g';
  list.forEach((m) => {
    const d = document.createElement('div'); d.className = 'msg' + (m.mine ? ' mine' : '');
    if (isGroup && !m.mine) { const f = document.createElement('span'); f.className = 'from'; f.textContent = (m.from || '').slice(0, 8); d.appendChild(f); }
    d.appendChild(document.createTextNode(m.text)); log.appendChild(d);
  });
  log.scrollTop = log.scrollHeight;
}

function addConvo(type, id, name) {
  const key = keyOf(type, id);
  if (!convos[key]) { convos[key] = { type, id, name }; save(); }
  return key;
}

async function loadHistory(key) {
  if (loaded[key]) return; loaded[key] = true;
  const c = convos[key];
  try {
    const ident = c.type === 'g' ? new NC.GroupChannelIdentifier(c.id) : new NC.DirectChannelIdentifier(c.id);
    const r = await GroupChannel.createMessagesQuery({ channelIdentifier: ident, pageSize: 30 }).loadNextPage();
    if (!r.isOk) throw new Error('code ' + r.code);
    msgs[key] = r.data.data.filter((m) => m.content?.text).sort((a, b) => a.sentTime - b.sentTime)
      .map((m) => ({ mine: m.senderUserId === myId, from: m.senderUserId, text: m.content.text }));
    if (key === active) renderLog();
  } catch (e) { console.error('history failed', e); say('Could not load earlier messages.', true); }
}

function openConv(key) {
  active = key; unread[key] = 0; const c = convos[key];
  $('title').textContent = (c.type === 'g' ? '# ' : 'Chat with ') + c.name;
  $('actions').classList.toggle('hidden', c.type !== 'g');
  $('text').disabled = false; $('send').disabled = false; $('text').focus();
  renderLists(); renderLog(); loadHistory(key);
}

async function joinCommunity(c) {
  const key = keyOf('g', c.id);
  if (!convos[key]) {
    say(`Joining ${c.name}...`);
    const cr = await GroupChannel.createGroup({ groupId: c.id, groupName: c.name, joinPermission: FREE }); // fails harmlessly if it already exists
    const jr = await new GroupChannel(c.id).join();
    console.log('community create', cr, 'join', jr);
    if (!cr.isOk && !jr.isOk) return fail(`Could not join ${c.name}`, jr);
    addConvo('g', c.id, c.name); say(`Joined ${c.name}.`);
  }
  openConv(key);
}

$('create').onclick = async () => {
  const name = $('gname').value.trim(); if (!name) return;
  const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = await GroupChannel.createGroup({ groupId: id, groupName: name, joinPermission: FREE });
  if (!r.isOk) return fail('Could not create group', r);
  $('gname').value = ''; openConv(addConvo('g', id, name));
  say('Group created. Use "Copy group id" and send it to friends.');
};

$('join').onclick = async () => {
  const id = $('gid').value.trim(); if (!id) return;
  const r = await new GroupChannel(id).join();
  console.log('join', r);
  if (!r.isOk) return fail('Could not join group', r);
  $('gid').value = ''; openConv(addConvo('g', id, id)); say('Joined the group.');
};

$('leave').onclick = async () => {
  const c = convos[active]; if (!c) return;
  const r = await new GroupChannel(c.id).leave();
  if (!r.isOk) return fail('Could not leave group', r);
  delete convos[active]; delete msgs[active]; delete loaded[active]; save(); active = null;
  $('title').textContent = 'Pick a community or start a chat'; $('actions').classList.add('hidden');
  $('text').disabled = true; $('send').disabled = true; renderLists(); renderLog();
  say('You left the group.');
};

$('copygid').onclick = async () => {
  const c = convos[active]; if (!c) return;
  try { await navigator.clipboard.writeText(c.id); say('Group id copied.'); } catch { say('Group id: ' + c.id); }
};

$('open').onclick = () => {
  const id = $('peer').value.trim(); if (!id || id === myId) return;
  $('peer').value = ''; openConv(addConvo('d', id, id));
};

async function send() {
  const c = convos[active], text = $('text').value.trim(); if (!c || !text) return;
  try {
    const ch = c.type === 'g' ? new GroupChannel(c.id) : new DirectChannel(c.id);
    const r = await ch.sendMessage(new SendTextMessageParams({ text }));
    console.log('send', r);
    if (!r.isOk) throw new Error('code ' + r.code);
    (msgs[active] = msgs[active] || []).push({ mine: true, from: myId, text });
    $('text').value = ''; renderLog();
  } catch (e) { say('Message not sent: ' + e.message, true); console.error(e); }
}
$('send').onclick = send;
$('text').onkeydown = (e) => { if (e.key === 'Enter') send(); };
$('peer').onkeydown = (e) => { if (e.key === 'Enter') $('open').click(); };

$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(myId); say('Your id is copied.'); } catch { say('Your id: ' + myId); }
};

$('login').onclick = async () => {
  try {
    say('Signing in...');
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const r = await fetch(`${env.VITE_API_URL}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await cred.user.getIdToken() }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || data.error);
    myId = data.userId; restore();

    NCEngine.initialize({ appKey: env.VITE_NEXCONN_APP_KEY });
    NCEngine.addMessageHandler('main', new MessageHandler({
      onMessageReceived({ messages }) {
        messages.forEach((m) => {
          const text = m.content?.text, ci = m.channelIdentifier;
          if (!text || !ci?.channelId || m.senderUserId === myId) return;
          const type = ci.channelType === GROUP_TYPE ? 'g' : 'd';
          const key = addConvo(type, ci.channelId, ci.channelId);
          (msgs[key] = msgs[key] || []).push({ mine: false, from: m.senderUserId, text });
          if (key !== active) unread[key] = (unread[key] || 0) + 1;
        });
        renderLists(); if (active) renderLog();
      },
    }));
    const result = await NCEngine.connect({ token: data.chatToken });
    console.log('connect result', result);
    if (!result.isOk) throw new Error('chat connection failed, code ' + result.code);

    $('name').textContent = data.name || 'You';
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    renderLists(); say('Connected.');
  } catch (e) { say(`Sign-in failed: ${e.message}`, true); console.error(e); }
};
