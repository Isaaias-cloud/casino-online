require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { initFirebase } = require('./firebase');
const { GameManager, makeId } = require('./game-manager');
const { HorseRaceGame } = require('./games/horse-race');
const { BlackjackGame } = require('./games/blackjack');
const { PoolGame } = require('./games/pool');
const { SlotsGame } = require('./games/slots');

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const STARTING_CREDITS = 10000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN, methods: ['GET', 'POST'] }
});

const { db, auth } = initFirebase();
const memoryUsers = new Map();
const globalChat = [];
const socketRate = new Map();

app.use(cors({ origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'Casino Online Multiplayer' }));
app.get('/api/firebase-config-template', (_, res) => {
  res.json({
    apiKey: 'TU_API_KEY',
    authDomain: 'TU_PROYECTO.firebaseapp.com',
    projectId: 'TU_PROYECTO',
    storageBucket: 'TU_PROYECTO.appspot.com',
    messagingSenderId: 'TU_SENDER_ID',
    appId: 'TU_APP_ID'
  });
});

function cleanName(name) {
  return String(name || 'Invitado Neon').replace(/[<>]/g, '').trim().slice(0, 28) || 'Invitado Neon';
}

async function loadUser(uid, fallbackName, registered = false) {
  if (db) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const profile = {
        uid,
        name: cleanName(fallbackName),
        credits: STARTING_CREDITS,
        registered,
        stats: { games: 0, wins: 0, losses: 0 },
        history: [],
        createdAt: Date.now()
      };
      await ref.set(profile);
      return profile;
    }
    return { uid, ...snap.data() };
  }

  if (!memoryUsers.has(uid)) {
    memoryUsers.set(uid, {
      uid,
      name: cleanName(fallbackName),
      credits: STARTING_CREDITS,
      registered,
      stats: { games: 0, wins: 0, losses: 0 },
      history: [],
      createdAt: Date.now()
    });
  }
  return memoryUsers.get(uid);
}

async function saveUser(user) {
  if (db) await db.collection('users').doc(user.uid).set(user, { merge: true });
  else memoryUsers.set(user.uid, user);
}

async function getUser(uid) {
  if (db) {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? { uid, ...snap.data() } : null;
  }
  return memoryUsers.get(uid) || null;
}

async function changeCredits(uid, delta, reason) {
  const user = await getUser(uid);
  if (!user) throw new Error('Usuario no encontrado.');
  const next = Math.max(0, Number(user.credits || 0) + delta);
  if (delta < 0 && Number(user.credits || 0) < Math.abs(delta)) throw new Error('Creditos insuficientes.');
  user.credits = next;
  user.history = [{ delta, reason, at: Date.now() }, ...(user.history || [])].slice(0, 30);
  await saveUser(user);
  io.to(`user:${uid}`).emit('user:profile', publicUser(user));
  io.emit('leaderboard:update', await leaderboard());
  return user;
}

const economy = {
  debit: (uid, amount, reason) => changeCredits(uid, -Math.abs(Number(amount)), reason),
  credit: (uid, amount, reason) => changeCredits(uid, Math.abs(Number(amount)), reason),
  async recordGame(uid, gameId, won, amount) {
    const user = await getUser(uid);
    if (!user) return;
    user.stats = user.stats || { games: 0, wins: 0, losses: 0 };
    user.stats.games++;
    if (won) user.stats.wins++;
    else user.stats.losses++;
    user.lastGame = { gameId, won, amount, at: Date.now() };
    await saveUser(user);
  }
};

function publicUser(user) {
  return {
    uid: user.uid,
    name: user.name,
    credits: user.credits,
    registered: Boolean(user.registered),
    stats: user.stats || { games: 0, wins: 0, losses: 0 },
    history: user.history || []
  };
}

async function leaderboard() {
  if (db) {
    const snap = await db.collection('users').orderBy('credits', 'desc').limit(10).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return { uid: doc.id, name: data.name, credits: data.credits, stats: data.stats || {} };
    });
  }
  return [...memoryUsers.values()]
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 10)
    .map((user) => ({ uid: user.uid, name: user.name, credits: user.credits, stats: user.stats || {} }));
}

const manager = new GameManager({ io, economy, store: { getUser, saveUser } });
manager.registerGame(new HorseRaceGame());
manager.registerGame(new BlackjackGame());
manager.registerGame(new PoolGame());
manager.registerGame(new SlotsGame());

function rateLimit(socket, eventName, limit = 12, windowMs = 4000) {
  const key = `${socket.id}:${eventName}`;
  const now = Date.now();
  const bucket = socketRate.get(key) || [];
  const recent = bucket.filter((time) => now - time < windowMs);
  recent.push(now);
  socketRate.set(key, recent);
  return recent.length <= limit;
}

async function authenticate(socket, payload = {}) {
  if (payload.idToken && auth) {
    const decoded = await auth.verifyIdToken(payload.idToken);
    return loadUser(decoded.uid, decoded.name || decoded.email || payload.name, true);
  }
  if (payload.uid && !auth) return loadUser(String(payload.uid), payload.name, true);
  return loadUser(`guest-${socket.id}`, payload.name || `Invitado ${socket.id.slice(0, 4)}`, false);
}

io.on('connection', (socket) => {
  socket.on('auth:login', async (payload, reply) => {
    try {
      const user = await authenticate(socket, payload);
      socket.data.user = { uid: user.uid, name: user.name };
      socket.join(`user:${user.uid}`);
      reply?.({ ok: true, user: publicUser(user) });
      socket.emit('games:list', manager.listGames());
      socket.emit('rooms:list', manager.listRooms());
      socket.emit('chat:global', globalChat);
      socket.emit('leaderboard:update', await leaderboard());
    } catch (error) {
      reply?.({ ok: false, error: error.message });
    }
  });

  socket.on('profile:update', async (payload, reply) => {
    try {
      const user = await getUser(socket.data.user?.uid);
      if (!user) throw new Error('No autenticado.');
      user.name = cleanName(payload.name);
      socket.data.user.name = user.name;
      await saveUser(user);
      reply?.({ ok: true, user: publicUser(user) });
    } catch (error) {
      reply?.({ ok: false, error: error.message });
    }
  });

  socket.on('room:create', async (payload, reply) => {
    try {
      if (!rateLimit(socket, 'room:create', 4, 10000)) throw new Error('Demasiadas salas creadas. Espera un momento.');
      const user = socket.data.user;
      if (!user) throw new Error('No autenticado.');
      const fullUser = await getUser(user.uid);
      if (!fullUser?.registered) throw new Error('Debes registrarte para crear salas.');
      const room = manager.createRoom({ gameId: payload.gameId, name: payload.name, owner: user });
      manager.joinRoom(room.id, socket, user);
      reply?.({ ok: true, room: manager.publicRoom(room) });
    } catch (error) {
      reply?.({ ok: false, error: error.message });
    }
  });

  socket.on('room:join', (payload, reply) => {
    try {
      const user = socket.data.user;
      if (!user) throw new Error('No autenticado.');
      manager.leaveRoom(socket);
      const room = manager.joinRoom(String(payload.roomId || ''), socket, user);
      socket.emit('chat:room', room.chat);
      reply?.({ ok: true, room: manager.publicRoom(room) });
    } catch (error) {
      reply?.({ ok: false, error: error.message });
    }
  });

  socket.on('room:leave', (_, reply) => {
    manager.leaveRoom(socket);
    reply?.({ ok: true });
  });

  socket.on('game:action', async (payload, reply) => {
    try {
      if (!rateLimit(socket, 'game:action', 30, 5000)) throw new Error('Demasiadas acciones.');
      if (!socket.data.user) throw new Error('No autenticado.');
      await manager.handleAction(socket, String(payload.action || ''), payload.data || {});
      reply?.({ ok: true });
    } catch (error) {
      reply?.({ ok: false, error: error.message });
    }
  });

  socket.on('slots:spin', async (payload, reply) => {
    try {
      if (!socket.data.user) throw new Error('No autenticado.');
      const room = manager.createRoom({ gameId: 'slots', name: 'Slots Solo', owner: socket.data.user });
      manager.joinRoom(room.id, socket, socket.data.user);
      await manager.handleAction(socket, 'spin', payload || {});
      reply?.({ ok: true, state: room.data.lastSpin, roomId: room.id });
    } catch (error) {
      reply?.({ ok: false, error: error.message });
    }
  });

  socket.on('chat:global:send', async (payload) => {
    if (!socket.data.user || !rateLimit(socket, 'chat', 8, 4000)) return;
    const message = String(payload.message || '').replace(/[<>]/g, '').trim().slice(0, 240);
    if (!message) return;
    globalChat.push({ id: makeId('msg'), uid: socket.data.user.uid, name: socket.data.user.name, message, at: Date.now() });
    while (globalChat.length > 40) globalChat.shift();
    io.emit('chat:global', globalChat);
  });

  socket.on('chat:room:send', (payload) => {
    if (!socket.data.user || !rateLimit(socket, 'roomchat', 8, 4000)) return;
    const room = manager.rooms.get(socket.data.roomId);
    if (room) manager.pushRoomChat(room, socket.data.user, payload.message);
  });

  socket.on('disconnect', () => {
    manager.leaveRoom(socket);
    socketRate.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Casino Online Multiplayer listo en http://localhost:${PORT}`);
});
