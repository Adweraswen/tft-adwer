/**
 * TFT Adwer Overwolf Bridge
 * =========================
 *
 * Bu script Overwolf GEP (Game Events Provider) event'lerini dinler ve
 * localhost WebSocket'e yollar. Next.js API route WebSocket'i dinler,
 * event'leri GameState'e çevirir.
 *
 * Mimari:
 *   [TFT oyunu]
 *       ↓ (Overwolf GEP)
 *   [Bu Overwolf app]
 *       ↓ (localhost WebSocket, port 7780)
 *   [Next.js API route → GameState → advisor → UI]
 *
 * Event'ler (PLAN.md bölüm 14.1):
 *   - game_info: oyun modu (TFT), PBE mi
 *   - live_client_data: active_player (gold, level), all_players (HP, level, isDead)
 *   - me: augment'lar (augment_1, augment_2, augment_3)
 *   - match_info: local_player_damage (her şampiyonun hasarı)
 *   - roster: oyuncu listesi
 *   - store: shop_pieces (5 slot şampiyon)
 *   - board: board_pieces (28 cell), opponent_board_pieces (rakip)
 *   - bench: bench_pieces (9 slot), item_bench (sol kenar item'lar)
 *   - carousel: carousel_pieces
 *   - augments: seçili augment'lar
 *   - match_stats: maç sonrası istatistikler
 *
 * WebSocket formatı (her event ayrı JSON mesaj):
 *   { "type": "game_info", "data": {...} }
 *   { "type": "board", "data": {...} }
 *   ...
 */

(function () {
  "use strict";

  // ─── Ayarlar ────────────────────────────────────────────────────────────
  const WS_PORT = 7780;
  const WS_URL = `ws://127.0.0.1:${WS_PORT}/overwolf`;
  const RECONNECT_INTERVAL = 2000; // 2 saniye sonra yeniden bağlan

  // ─── Durum ──────────────────────────────────────────────────────────────
  let ws = null;
  let wsConnected = false;
  let eventCount = 0;
  let lastEventType = "-";
  let lastReconnectAttempt = 0;

  // ─── UI yardımcıları ────────────────────────────────────────────────────
  function setStatus(text, className) {
    const el = document.getElementById("status");
    if (el) {
      el.textContent = text;
      el.className = "status " + className;
    }
    console.log("[status]", text);
  }

  function updateUI() {
    const els = {
      "ow-version": window.overwolf ? "yüklü" : "yok",
      "game-status": lastEventType === "-" ? "bekleniyor" : "aktif",
      "ws-status": wsConnected ? "bağlı" : "kapalı",
      "event-count": String(eventCount),
      "last-event": lastEventType,
    };
    for (const [id, val] of Object.entries(els)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
  }

  // ─── WebSocket bağlantısı ───────────────────────────────────────────────
  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    setStatus("Next.js'e bağlanılıyor...", "connecting");
    console.log("[ws] bağlanılıyor:", WS_URL);

    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      console.error("[ws] bağlantı hatası:", err);
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      wsConnected = true;
      setStatus("Bağlandı — TFT bekleniyor", "connected");
      console.log("[ws] bağlantı açık");
      updateUI();
      // Next.js'e "ben geldim" mesajı yolla
      sendEvent("bridge_connected", { version: "0.1.0", port: WS_PORT });
    };

    ws.onclose = function (event) {
      wsConnected = false;
      setStatus("Bağlantı kapandı — yeniden denenecek", "disconnected");
      console.log("[ws] kapandı, code:", event.code);
      updateUI();
      scheduleReconnect();
    };

    ws.onerror = function (err) {
      console.error("[ws] hata:", err);
      // onclose takip edecek
    };

    ws.onmessage = function (msg) {
      console.log("[ws] mesaj alındı:", msg.data);
    };
  }

  function scheduleReconnect() {
    const now = Date.now();
    if (now - lastReconnectAttempt < RECONNECT_INTERVAL) return;
    lastReconnectAttempt = now;
    setTimeout(connectWebSocket, RECONNECT_INTERVAL);
  }

  function sendEvent(type, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log("[ws] atlandı (kapalı):", type);
      return false;
    }

    const payload = JSON.stringify({ type, data, ts: Date.now() });
    try {
      ws.send(payload);
      eventCount++;
      lastEventType = type;
      updateUI();
      return true;
    } catch (err) {
      console.error("[ws] gönderme hatası:", err);
      return false;
    }
  }

  // ─── Overwolf GEP event'lerini dinle ────────────────────────────────────

  function onGameInfoUpdated(info) {
    // info = { feature, category, key, value }
    if (!info) return;
    console.log("[gep] info update:", info.feature, info.key);
    sendEvent("info_update", info);
  }

  function onGameEvent(info) {
    // info = { feature, events: [...] } veya { feature, info: {...} }
    if (!info) return;
    console.log("[gep] game event:", info.feature);
    sendEvent(info.feature, info);
  }

  function registerGameEvents() {
    if (!window.overwolf || !overwolf.games) {
      console.warn("[overwolf] games API yok, bekleniyor...");
      setTimeout(registerGameEvents, 1000);
      return;
    }

    // Info updates — sürekli güncellenen veriler (board, bench, store, gold, level)
    overwolf.games.events.onInfoUpdates.addListener(onGameInfoUpdated);

    // Game events — tek seferlik event'ler (game_start, augment seçildi, vb.)
    overwolf.games.events.onNewEvents.addListener(onGameEvent);

    // Game launched/closed event'leri
    overwolf.games.onGameLaunched.addListener(function (res) {
      console.log("[overwolf] oyun açıldı:", res);
      sendEvent("game_launched", res);
    });

    overwolf.games.onGameRunningChanged.addListener(function (res) {
      console.log("[overwolf] oyun durumu değişti:", res);
      sendEvent("game_running_changed", res);
    });

    // Mevcut oyun bilgisi
    overwolf.games.getRunningGameInfo(function (res) {
      if (res && res.status === "success" && res.gameInfo) {
        console.log("[overwolf] mevcut oyun:", res.gameInfo);
        sendEvent("game_info", res.gameInfo);
      }
    });

    // GEP event'lerini set et (TFT GameID = 21570, PBE = 215701)
    const tftFeatures = [
      "gep_internal",
      "game_info",
      "live_client_data",
      "me",
      "match_info",
      "roster",
      "store",
      "board",
      "bench",
      "carousel",
      "augments",
      "match_stats",
    ];

    overwolf.games.events.setRequiredFeatures(tftFeatures, function (res) {
      if (res.status === "success") {
        console.log("[overwolf] GEP features set edildi:", res.features);
        setStatus("Bağlandı — TFT bekleniyor", "connected");
      } else {
        console.error("[overwolf] features set hatası:", res);
        setStatus("GEP features hatası: " + res.status, "disconnected");
      }
    });

    setStatus("Overwolf hazır, TFT bekleniyor...", "connecting");
    updateUI();
  }

  // ─── Overwolf hazır olunca başlat ───────────────────────────────────────

  function initOverwolf() {
    if (!window.overwolf) {
      console.warn("[overwolf] API yok, bekleniyor...");
      setTimeout(initOverwolf, 500);
      return;
    }

    console.log("[overwolf] API yüklü, version:", overwolf.version || "?");

    // Overwolf hazır olduğunda
    overwolf.games.inputTracking.onKeyDown.removeListener(function () {});

    // Game events kayıt
    registerGameEvents();

    // WebSocket başlat
    connectWebSocket();
  }

  // ─── Sayfa yüklendiğinde ────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOverwolf);
  } else {
    initOverwolf();
  }

  // Pencere kapatılırken WebSocket'i kapat
  window.addEventListener("beforeunload", function () {
    if (ws) {
      ws.close();
    }
  });

  console.log("[bridge] TFT Adwer Overwolf Bridge yüklendi");
})();
