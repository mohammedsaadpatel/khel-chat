// ===== Khel chat (Google login + Nexconn chat) =====
import { initializeApp as __kInit } from 'firebase/app';
import { getAuth as __kGetAuth, GoogleAuthProvider as __kGAP, signInWithPopup as __kSign, onAuthStateChanged as __kOnAuth, signOut as __kSignOut } from 'firebase/auth';
import * as __kNC from '@nexconn/chat';
(function () {
const initializeApp = __kInit, getAuth = __kGetAuth, GoogleAuthProvider = __kGAP, signInWithPopup = __kSign;
const onAuthStateChanged = __kOnAuth, signOut = __kSignOut;
const NC = __kNC;
const { NCEngine, DirectChannel, GroupChannel, SendTextMessageParams, MessageHandler } = NC;

const env = import.meta.env;
const auth = getAuth(initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
}));


// ---------- Floating chat widget (Shadow DOM keeps it isolated from the site's styles) ----------
const host = document.createElement('div');
host.id = 'khel-chat-host';
document.body.appendChild(host);
const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `
<style>
:host{all:initial;font-family:'Plus Jakarta Sans',system-ui,sans-serif;--bg:#f8fafc;--panel:#fff;--line:#e2e8f0;--text:#0f172a;--muted:#64748b;--accent:#059669;--accent-ink:#fff;--mine:#059669;--mine-ink:#fff;--theirs:#f1f5f9}
:host([data-theme=dark]){--bg:#020617;--panel:#0f172a;--line:#1e293b;--text:#f1f5f9;--muted:#94a3b8;--accent:#10b981;--accent-ink:#022c22;--mine:#10b981;--mine-ink:#022c22;--theirs:#1e293b}
*{box-sizing:border-box;font-family:inherit}
button{font-weight:600;font-size:.95rem;background:var(--accent);color:var(--accent-ink);border:0;border-radius:10px;padding:.55rem .9rem;cursor:pointer}
button.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
button:disabled{opacity:.5;cursor:not-allowed}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
input{font-size:1rem;color:var(--text);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:.55rem .7rem;width:100%}
#launcher{position:fixed;right:1rem;bottom:1rem;z-index:2147483000;border-radius:999px;padding:.8rem 1.2rem;box-shadow:0 6px 20px rgba(0,0,0,.25)}
#panel{position:fixed;right:1rem;bottom:4.75rem;z-index:2147483000;width:min(820px,calc(100vw - 1.5rem));height:min(640px,calc(100vh - 6rem));background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;line-height:1.5}
.bar{display:flex;justify-content:space-between;align-items:center;padding:.6rem .9rem;border-bottom:1px solid var(--line);background:var(--panel)}
.body{flex:1;overflow:auto;padding:.9rem}
#status{color:var(--muted);margin:.4rem 0 .7rem;font-size:.9rem}
#status.err{color:#dc2626}
#app{display:grid;grid-template-columns:250px 1fr;gap:.9rem}
@media (max-width:700px){#app{grid-template-columns:1fr}}
.side,.main{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:.9rem;display:flex;flex-direction:column;gap:.55rem}
h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:.4rem 0 .2rem;font-weight:600}
.row{display:flex;gap:.5rem;align-items:center}
.me{display:flex;justify-content:space-between;align-items:center;gap:.5rem}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.2rem}
li button{width:100%;text-align:left;background:transparent;color:var(--text);border:1px solid transparent;border-radius:8px;padding:.4rem .5rem;font-weight:500;overflow-wrap:anywhere}
li button[aria-current=true]{border-color:var(--accent)}
.badge{float:right;background:var(--accent);color:var(--accent-ink);border-radius:99px;padding:0 .5rem;font-size:.8rem}
details{border-top:1px solid var(--line);padding-top:.5rem}
summary{cursor:pointer;font-weight:600}
details .row{margin:.35rem 0}
.head{display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap}
#log{flex:1;overflow:auto;display:flex;flex-direction:column;gap:.4rem;min-height:220px;max-height:42vh}
.msg{max-width:78%;padding:.45rem .75rem;border-radius:14px;background:var(--theirs);align-self:flex-start;overflow-wrap:anywhere}
.msg.mine{background:var(--mine);color:var(--mine-ink);align-self:flex-end}
.from{display:block;font-size:.72rem;opacity:.7}
.empty{color:var(--muted);margin:auto;text-align:center}
/* ----- login screen shown when the web app opens ----- */
#gate{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(2,6,23,.72);backdrop-filter:blur(6px)}
#gate .card{width:min(420px,100%);background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:20px;padding:1.75rem 1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:.75rem;text-align:left}
#gate h1{margin:0;font-size:1.45rem;line-height:1.25;font-weight:800;letter-spacing:-.01em}
#gate p{margin:0;color:var(--muted);font-size:.95rem}
#gate button{width:100%;padding:.75rem 1rem;font-size:1rem}
#gate #gate-status{min-height:1.2rem;font-size:.85rem}
#gate #gate-status.err{color:#dc2626}
/* ----- embedded mode: the same chat docked inside the Chats Hub page ----- */
:host([data-mode=embedded]){display:block;width:100%}
:host([data-mode=embedded]) #launcher,:host([data-mode=embedded]) #close{display:none}
:host([data-mode=embedded]) #panel{position:relative;right:auto;bottom:auto;z-index:auto;width:100%;height:720px;max-height:calc(100vh - 8rem);min-height:480px;border:0;border-radius:0;box-shadow:none}
:host([data-mode=embedded]) .body{display:flex;flex-direction:column;min-height:0}
:host([data-mode=embedded]) #app{flex:1;min-height:0;grid-template-rows:minmax(0,1fr)}
:host([data-mode=embedded]) .side,:host([data-mode=embedded]) .main{min-height:0;overflow:auto}
:host([data-mode=embedded]) #log{max-height:none;min-height:0}

.hidden{display:none!important}
</style>
<button id="launcher" aria-expanded="false" aria-controls="panel">Chat</button>
<section id="panel" class="hidden" role="dialog" aria-label="Khel chat">
  <div class="bar"><strong>Khel chat</strong><button class="ghost" id="close" aria-label="Close chat">&#10005;</button></div>
  <div class="body">
    <button id="login">Continue with Google</button>
    <p id="status" role="status"></p>
    <div id="app" class="hidden">
      <aside class="side">
        <div class="me"><strong id="name"></strong></div>
        <div class="row"><button class="ghost" id="copy">Copy my id</button><button class="ghost" id="signout">Sign out</button></div>
        <h2>Communities</h2><ul id="communities"></ul>
        <h2>My chats</h2><ul id="people"></ul>
        <details>
          <summary>Start something</summary>
          <label for="peer">Direct message (their user id)</label>
          <div class="row"><input id="peer" autocomplete="off" /><button id="open">Open</button></div>
          <label for="gname">New group</label>
          <div class="row"><input id="gname" placeholder="Group name" autocomplete="off" /><button id="create">Create</button></div>
          <label for="gid">Join a group (its id)</label>
          <div class="row"><input id="gid" autocomplete="off" /><button id="join">Join</button></div>
        </details>
      </aside>
      <section class="main" aria-label="Conversation">
        <div class="head">
          <strong id="title">Pick a community or start a chat</strong>
          <div class="row hidden" id="actions"><button class="ghost" id="copygid">Copy group id</button><button class="ghost" id="leave">Leave</button></div>
        </div>
        <div id="log" aria-live="polite"><p class="empty">Join a community, create a group, or message a friend.</p></div>
        <div class="row"><input id="text" placeholder="Type a message and press Enter" autocomplete="off" disabled /><button id="send" disabled>Send</button></div>
      </section>
    </div>
  </div>
</section>
<div id="gate" class="hidden" role="dialog" aria-modal="true" aria-labelledby="gate-title">
  <div class="card">
    <h1 id="gate-title">Sign in to Khel &amp; Hangout</h1>
    <p>Chat with your squad, join sport communities and message friends. You can still browse turfs, trips and hangouts without signing in.</p>
    <button id="gate-login">Continue with Google</button>
    <button class="ghost" id="gate-skip">Browse without signing in</button>
    <p id="gate-status" role="status"></p>
  </div>
</div>`;

// follow the site's own light/dark switch (it sets class "dark" on <html>)
const syncTheme = () => host.setAttribute('data-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
syncTheme();
new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

const togglePanel = (open) => {
  const p = root.getElementById('panel'), l = root.getElementById('launcher');
  const show = open ?? p.classList.contains('hidden');
  p.classList.toggle('hidden', !show); l.setAttribute('aria-expanded', String(show));
};
root.getElementById('launcher').onclick = () => togglePanel();
root.getElementById('close').onclick = () => togglePanel(false);
root.addEventListener('keydown', (e) => { if (e.key === 'Escape') togglePanel(false); });
// ---------- end widget ----------

const FREE = 1; // GroupJoinPermission.FREE: anyone can join without approval
const GROUP_TYPE = 3; // ChannelType.GROUP
const COMMUNITIES = ['Football', 'Cricket', 'Badminton', 'Basketball', 'Running', 'Weekend Hangouts']
  .map((name) => ({ name, id: 'community-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));

const $ = (id) => root.getElementById(id);
const say = (t, err = false) => {
  for (const id of ['status', 'gate-status']) { $(id).textContent = t; $(id).className = err ? 'err' : ''; }
};
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

// One group per id, shared by everyone: the first person creates it, everyone else just joins.
// (createGroup fails harmlessly if the group already exists.)
async function openShared(groupId, name) {
  const key = keyOf('g', groupId);
  if (!convos[key]) {
    say(`Joining ${name}...`);
    const cr = await GroupChannel.createGroup({ groupId, groupName: name, joinPermission: FREE });
    const jr = await new GroupChannel(groupId).join();
    console.log('shared group create', cr, 'join', jr);
    if (!cr.isOk && !jr.isOk) return fail(`Could not join ${name}`, jr);
    addConvo('g', groupId, name); say(`Joined ${name}.`);
  }
  openConv(key);
}

const joinCommunity = (c) => openShared(c.id, c.name);

// Same plan or trip id -> same group id for every user, so nobody ever gets a duplicate chat.
const groupIdFor = (id) => 'chat-' + String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
let pending = null; // chat the user asked for before they were signed in

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

let connecting = false, connected = false;

// Gets a chat token from our server for the signed-in Firebase user and connects to Nexconn.
async function connectChat(user) {
  if (connected || connecting) return;
  connecting = true;
  try {
    say('Connecting...');
    const r = await fetch(`${env.VITE_API_URL}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await user.getIdToken() }),
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

    connected = true;
    $('name').textContent = data.name || 'You';
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    hideGate(); renderLists(); say('Connected.');
    if (pending) { const p = pending; pending = null; openShared(p.groupId, p.name); }
  } catch (e) { say(`Sign-in failed: ${e.message}`, true); console.error(e); }
  finally { connecting = false; }
}

async function signIn() {
  try {
    say('Signing in...');
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    await connectChat(cred.user);
  } catch (e) { say(`Sign-in failed: ${e.message}`, true); console.error(e); }
}

// ---------- login screen when the web app opens ----------
const SKIP_KEY = 'khel_gate_skipped';
const showGate = () => { $('gate').classList.remove('hidden'); $('gate-login').focus(); };
const hideGate = (skipped = false) => {
  $('gate').classList.add('hidden');
  if (skipped) { try { sessionStorage.setItem(SKIP_KEY, '1'); } catch {} }
};
$('login').onclick = signIn;
$('gate-login').onclick = signIn;
$('gate-skip').onclick = () => { pending = null; hideGate(true); };
$('gate').addEventListener('keydown', (e) => { if (e.key === 'Escape') { pending = null; hideGate(true); } });
$('signout').onclick = async () => {
  try { await signOut(auth); } catch (e) { console.error(e); }
  location.reload();
};

// Returning users are reconnected silently; everyone else sees the login screen once per visit.
onAuthStateChanged(auth, (user) => {
  if (user) { connectChat(user); return; }
  let skipped = false;
  try { skipped = !!sessionStorage.getItem(SKIP_KEY); } catch {}
  if (!skipped) showGate();
});

// ---------- Chats Hub: the site's hub page docks this same chat into its page ----------
// dock(el) moves the chat out of the floating corner into el; undock() puts it back.
// Keeping one instance means one Nexconn connection and one set of conversations everywhere.
window.khelChat = {
  dock(el) {
    el.appendChild(host); host.setAttribute('data-mode', 'embedded');
    $('panel').classList.remove('hidden');
  },
  undock() {
    document.body.appendChild(host); host.removeAttribute('data-mode');
    $('panel').classList.add('hidden'); $('launcher').setAttribute('aria-expanded', 'false');
  },
  open: () => togglePanel(true),
  // Called by every Squad Chat / Trip Chat button. Signed-in users land in the plan's shared group;
  // others see the login screen first and are taken to the group right after signing in.
  openForPlan({ id, title }) {
    const groupId = groupIdFor(id), name = title || 'Squad chat';
    if (connected) return openShared(groupId, name);
    pending = { groupId, name };
    if (!connecting) showGate();
  },
};

})();
