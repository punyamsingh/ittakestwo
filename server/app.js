import express from 'express';
import { existsSync } from 'fs';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { customAlphabet } from 'nanoid';
import { Room } from './room.js';
import { isValidAvatarType, isValidColor } from '../shared/constants.js';

const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);
const CLIENT_DIST = fileURLToPath(new URL('../client/dist', import.meta.url));

export function createApp() {
  const app = express();
  if (existsSync(CLIENT_DIST)) app.use(express.static(CLIENT_DIST));

  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const rooms = new Map();

  function broadcastLobby(room) {
    io.to(room.code).emit('lobby-update', room.lobbyState());
  }

  function leaveRoom(socket) {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    socket.data.roomCode = null;
    if (!room) return;
    socket.leave(code);
    room.removePlayer(socket.id);
    if (room.players.length === 0) {
      room.destroy();
      rooms.delete(code);
    } else {
      io.to(code).emit('opponent-left');
      broadcastLobby(room);
    }
  }

  const roomOf = (socket) => rooms.get(socket.data.roomCode);
  const hostRoom = (socket) => {
    const room = roomOf(socket);
    return room && room.hostId === socket.id ? room : null;
  };

  io.on('connection', (socket) => {
    socket.on('create-room', (payload) => {
      leaveRoom(socket);
      let code;
      do {
        code = genCode();
      } while (rooms.has(code));
      const room = new Room(code, io);
      rooms.set(code, room);
      room.addPlayer(socket);
      room.setUnlocked(payload?.progress);
      socket.join(code);
      socket.data.roomCode = code;
      socket.emit('room-created', { code });
      broadcastLobby(room);
    });

    socket.on('join-room', (payload) => {
      const code = String(payload?.code ?? '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return socket.emit('join-error', { message: 'Room not found' });
      if (room.getPlayer(socket.id)) return;
      if (room.players.length >= 2) return socket.emit('join-error', { message: 'Room is full' });
      leaveRoom(socket);
      const player = room.addPlayer(socket);
      socket.join(code);
      socket.data.roomCode = code;
      socket.emit('room-joined', { code, index: player.index });
      broadcastLobby(room);
    });

    socket.on('set-avatar', (avatar) => {
      const room = roomOf(socket);
      const player = room?.getPlayer(socket.id);
      if (!player || !room.canChangeAvatar()) return;
      player.avatar = {
        type: isValidAvatarType(avatar?.type) ? avatar.type : player.avatar.type,
        color: isValidColor(avatar?.color) ? avatar.color.toLowerCase() : player.avatar.color,
      };
      broadcastLobby(room);
    });

    socket.on('select-level', (payload) => {
      const room = hostRoom(socket);
      if (room?.selectLevel(payload?.index)) broadcastLobby(room);
    });

    socket.on('start-level', () => hostRoom(socket)?.startStory());
    socket.on('next-level', () => hostRoom(socket)?.nextLevel());
    socket.on('restart-level', () => roomOf(socket)?.restartLevel());
    socket.on('story-done', () => roomOf(socket)?.storyDone(socket.id));

    socket.on('to-map', () => {
      const room = hostRoom(socket);
      if (!room) return;
      room.toMap();
      io.to(room.code).emit('to-map');
      broadcastLobby(room);
    });

    socket.on('input', (input) => roomOf(socket)?.setInput(socket.id, input));
    socket.on('leave-room', () => leaveRoom(socket));
    socket.on('disconnect', () => leaveRoom(socket));
  });

  return { app, httpServer, io, rooms };
}
