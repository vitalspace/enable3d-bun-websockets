import { serve, type ServerWebSocket } from "bun";

interface Player {
  x: number;
  y: number;
  z: number;
  r: number;
  animation: string;
  playerId: string;
}

const players: Record<string, Player> = {};

interface CustomServerWebSocket extends ServerWebSocket {
  id: string;
}

const uuidV4 = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const app = serve({
  websocket: {
    open: (ws: CustomServerWebSocket) => {
      ws.id = uuidV4();
      ws.subscribe("main");

      players[ws.id] = {
        x: 0,
        y: 1,
        z: 0,
        r: 0,
        animation: "idle",
        playerId: ws.id,
      };

      ws.send(JSON.stringify({ type: "playerId", id: ws.id }));
      ws.send(JSON.stringify({ type: "currentPlayers", players }));
      ws.publish(
        "main",
        JSON.stringify({ type: "newPlayer", player: players[ws.id] })
      );

      console.log(`${ws.id} connected`);
    },

    message: (ws: CustomServerWebSocket, dta: any) => {
      const data = JSON.parse(dta);

      switch (data.type) {
        case "playerMovement":
          players[ws.id].x = data.position.x;
          players[ws.id].y = data.position.y;
          players[ws.id].z = data.position.z;
          players[ws.id].r = data.position.r;
          (players[ws.id].animation = data.position.animation),
            ws.publish(
              "main",
              JSON.stringify({
                type: "playerMoved",
                playerInfo: players[ws.id],
              })
            );
          break;
      }
    },

    close: (ws: CustomServerWebSocket) => {
      delete players[ws.id];
      // app.publish("main", JSON.stringify({ type: "currentPlayers", players }));
      app.publish(
        "main",
        JSON.stringify({ type: "disconnect", playerId: ws.id })
      );
      console.log(`${ws.id} disconnected`);
    },
  },

  fetch(req, server) {
    const { url, method } = req;
    const { pathname } = new URL(url);

    server.upgrade(req);

    // if (pathname === "/" && method === "GET") {
    //   return new Response("Hello world");
    // }
    // return new Response("Hello world");
  },
});

console.log("Server on port:", app.port);
