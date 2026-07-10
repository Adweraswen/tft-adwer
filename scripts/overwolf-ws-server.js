/**
 * Overwolf WebSocket Server
 * =========================
 *
 * Bu script Overwolf app'ten (overwolf-app/src/js/bridge.js) gelen
 * WebSocket mesajlarını dinler. Event'leri alır, GameState'e çevirir,
 * Next.js /api/snapshot'a POST atar (VLM ile aynı yol).
 *
 * Çalıştırma:
 *   node scripts/overwolf-ws-server.js
 *   veya
 *   bun run dev:ws
 *
 * Next.js ile paralel çalıştırma:
 *   bun run dev:all
 *
 * Mimari:
 *   [Overwolf app] → ws://127.0.0.1:7780/overwolf → [bu server]
 *       ↓ (event'leri GameState'e çevir)
 *   [POST http://localhost:3000/api/snapshot]
 *       ↓ (mevcut VLM yolu: sanity filter + advisor + DB)
 *   [UI gösterimi]
 */

const WebSocket = require("ws");
const http = require("http");

// ─── Ayarlar ───────────────────────────────────────────────────────────────
const WS_PORT = 7780;
const NEXTJS_URL = "http://localhost:3000/api/snapshot";
const SNAPSHOT_INTERVAL_MS = 2000; // GameState'i 2 saniyede bir POST at

// ─── Durum: gelen event'leri burada topla ──────────────────────────────────
const state = {
  gold: null,
  level: null,
  hp: null,
  allPlayers: [],
  augments: [],
  shop: ["", "", "", "", ""],
  board: [],
  bench: [],
  connected: false,
  lastEventTs: 0,
  eventCount: 0,
};

// ─── WebSocket server ──────────────────────────────────────────────────────
const wss = new WebSocket.Server({ port: WS_PORT, path: "/overwolf" });

console.log(`[ws] Overwolf WebSocket server dinleniyor: ws://127.0.0.1:${WS_PORT}/overwolf`);

wss.on("connection", (ws, req) => {
  console.log("[ws] Overwolf app bağlandı, IP:", req.socket.remoteAddress);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      console.error("[ws] JSON parse hatası:", err);
      return;
    }
    handleEvent(msg);
  });

  ws.on("close", () => {
    console.log("[ws] Overwolf app koptu");
  });

  ws.on("error", (err) => {
    console.error("[ws] hata:", err);
  });

  ws.send(JSON.stringify({ type: "welcome", msg: "TFT Adwer WebSocket hazır" }));
});

// ─── Event işleme ──────────────────────────────────────────────────────────

function handleEvent(msg) {
  state.eventCount++;
  state.lastEventTs = Date.now();

  const { type, data, ts } = msg;
  console.log(`[event] #${state.eventCount} type=${type} ts=${ts}`);

  switch (type) {
    case "bridge_connected":
      console.log("[bridge] Overwolf app bağlandı, version:", data.version);
      break;
    case "game_launched":
    case "game_running_changed":
      console.log("[game] durum:", JSON.stringify(data).slice(0, 200));
      break;
    case "game_info":
      handleGameInfo(data);
      break;
    case "live_client_data":
      handleLiveClientData(data);
      break;
    case "me":
      handleMe(data);
      break;
    case "store":
      handleStore(data);
      break;
    case "board":
      handleBoard(data);
      break;
    case "bench":
      handleBench(data);
      break;
    case "augments":
      handleMe(data); // aynı yapı
      break;
    case "carousel":
    case "match_info":
    case "match_stats":
    case "roster":
    case "info_update":
      console.log(`[${type}] (şimdilik kullanılmıyor)`);
      break;
    default:
      console.log(`[unknown] type=${type}`);
  }
}

function handleGameInfo(data) {
  if (data.key === "is_pbe" || data.key === "game_info") {
    state.connected = true;
  }
  console.log("[game_info] key:", data.key, "value:", String(data.value).slice(0, 100));
}

function handleLiveClientData(data) {
  try {
    const lcd = data.info?.live_client_data;
    if (!lcd) return;

    if (lcd.active_player) {
      const ap = typeof lcd.active_player === "string"
        ? JSON.parse(lcd.active_player)
        : lcd.active_player;
      if (ap.currentGold !== undefined) {
        state.gold = Math.round(ap.currentGold);
      }
      if (ap.level !== undefined) {
        state.level = ap.level;
      }
      console.log("[lcd] active_player: gold=", state.gold, "level=", state.level);
    }

    if (lcd.all_players) {
      const players = typeof lcd.all_players === "string"
        ? JSON.parse(lcd.all_players)
        : lcd.all_players;
      if (Array.isArray(players)) {
        state.allPlayers = players.map(p => ({
          riotId: p.riotId || p.summonerName || "",
          level: p.level || 1,
          hp: p.hp || 100,
          isDead: p.isDead || false,
        }));
        const me = players[0];
        if (me) {
          state.hp = me.hp || 100;
        }
        console.log("[lcd] all_players count:", state.allPlayers.length);
      }
    }

    if (lcd.game_data) {
      const gd = typeof lcd.game_data === "string"
        ? JSON.parse(lcd.game_data)
        : lcd.game_data;
      if (gd.gameMode === "TFT") {
        state.connected = true;
      }
      console.log("[lcd] game_mode:", gd.gameMode, "time:", gd.gameTime);
    }
  } catch (err) {
    console.error("[lcd] parse hatası:", err);
  }
}

function handleMe(data) {
  try {
    const me = typeof data.value === "string"
      ? JSON.parse(data.value)
      : data.value;
    const augments = [];
    if (me.augment_1?.name) augments.push(me.augment_1.name);
    if (me.augment_2?.name) augments.push(me.augment_2.name);
    if (me.augment_3?.name) augments.push(me.augment_3.name);
    state.augments = augments;
    console.log("[me] augments:", augments);
  } catch (err) {
    console.error("[me] parse hatası:", err);
  }
}

function handleStore(data) {
  try {
    const sp = data.info?.store?.shop_pieces;
    if (!sp) return;
    const shop = typeof sp === "string" ? JSON.parse(sp) : sp;
    const result = ["", "", "", "", ""];
    for (let i = 1; i <= 5; i++) {
      const slot = shop[`slot_${i}`];
      if (slot?.name) {
        result[i - 1] = slot.name.replace(/^TFT\d*_/, "").replace(/_/g, " ");
      }
    }
    state.shop = result;
    console.log("[store] shop:", result);
  } catch (err) {
    console.error("[store] parse hatası:", err);
  }
}

function handleBoard(data) {
  try {
    const bp = data.info?.board?.board_pieces;
    if (!bp) return;
    const pieces = typeof bp === "string" ? JSON.parse(bp) : bp;
    const result = [];
    for (const [cellName, piece] of Object.entries(pieces)) {
      if (!piece?.name) continue;
      const name = piece.name.replace(/^TFT\d*_/, "").replace(/_/g, " ");
      const items = [piece.item_1, piece.item_2, piece.item_3]
        .filter(it => it && it !== "" && !/^0+$/.test(it))
        .map(it => it.replace(/^TFT_Item_/, "").replace(/_/g, " "));
      result.push({
        name,
        stars: parseInt(piece.level || "1", 10),
        items,
      });
    }
    state.board = result;
    console.log("[board] pieces:", result.length);
  } catch (err) {
    console.error("[board] parse hatası:", err);
  }
}

function handleBench(data) {
  try {
    const bp = data.info?.bench?.bench_pieces;
    if (!bp) return;
    const pieces = typeof bp === "string" ? JSON.parse(bp) : bp;
    const result = [];
    for (const [slotName, piece] of Object.entries(pieces)) {
      if (!piece?.name) continue;
      const name = piece.name.replace(/^TFT\d*_/, "").replace(/_/g, " ");
      const items = [piece.item_1, piece.item_2, piece.item_3]
        .filter(it => it && it !== "" && !/^0+$/.test(it))
        .map(it => it.replace(/^TFT_Item_/, "").replace(/_/g, " "));
      result.push({
        name,
        stars: parseInt(piece.level || "1", 10),
        items,
      });
    }
    state.bench = result;
    console.log("[bench] pieces:", result.length);
  } catch (err) {
    console.error("[bench] parse hatası:", err);
  }
}

// ─── GameState üret + POST at ──────────────────────────────────────────────

function buildGameState() {
  return {
    source: "overwolf",
    connected: state.connected,
    level: state.level || 1,
    gold: state.gold || 0,
    hp: state.hp || 100,
    stage: 1,
    round: 1,
    streak: 0,
    shop: state.shop,
    board: state.board,
    bench: state.bench,
    augments: state.augments,
  };
}

function postSnapshot(gameState) {
  const body = JSON.stringify({ state: gameState, source: "overwolf" });
  const req = http.request(
    NEXTJS_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          console.log("[snapshot] POST başarılı, gold=", gameState.gold, "level=", gameState.level);
        } else {
          console.error("[snapshot] POST fail:", res.statusCode, data.slice(0, 200));
        }
      });
    }
  );
  req.on("error", (err) => {
    console.error("[snapshot] bağlantı hatası:", err.message);
  });
  req.write(body);
  req.end();
}

// ─── Periyodik POST ────────────────────────────────────────────────────────
setInterval(() => {
  if (!state.connected) return;
  const gs = buildGameState();
  postSnapshot(gs);
}, SNAPSHOT_INTERVAL_MS);

// 10 saniyede bir durum yazdır
setInterval(() => {
  console.log("---");
  console.log("state: connected=", state.connected,
    "gold=", state.gold, "level=", state.level, "hp=", state.hp,
    "board=", state.board.length, "bench=", state.bench.length,
    "augments=", state.augments.length,
    "events=", state.eventCount);
  console.log("---");
}, 10000);

console.log("[ws] hazır, Overwolf app bekleniyor...");
console.log("[ws] Next.js URL:", NEXTJS_URL);
console.log("[ws] Snapshot interval:", SNAPSHOT_INTERVAL_MS, "ms");
