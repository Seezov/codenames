import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@codenames/shared';

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

export default socket;
