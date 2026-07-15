import { Server } from "socket.io";

let io = null;

export function initSocket(server, corsOptions) {
  io = new Server(server, {
    cors: corsOptions,
  });

  io.on("connection", (socket) => {
    socket.join("ranking");
  });

  return io;
}

export function emitRankingUpdated(payload = {}) {
  if (!io) return;

  io.to("ranking").emit("ranking:updated", {
    ...payload,
    updatedAt: new Date().toISOString(),
  });
}
