// GERADO por `npm run build` (supabase/build.mjs). Não edite: mude src/match/.

// src/match/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// ../engine/src/rules.ts
var DEFAULT_RULES = {
  playerHp: 20,
  handSize: 3,
  energyPerTurn: 3,
  slots: 3,
  deckSize: 7,
  deckPowerLimit: 110,
  maxTurns: 60,
  summoningSickness: false,
  secondPlayerBonusEnergy: 2,
  advantageMultiplier: 1.5,
  disadvantageMultiplier: 0.75,
  energyCost: { comum: 1, incomum: 2, rara: 2, epica: 3, lendaria: 3 },
  powerBudget: { comum: 9, incomum: 15, rara: 18, epica: 27, lendaria: 28 },
  photoBonusRatio: 0.1,
  upgradeRatio: 0.25
};
var BEATS = {
  fogo: "planta",
  planta: "terra",
  terra: "ar",
  ar: "agua",
  agua: "fogo"
};
function hasAdvantage(attacker, defender) {
  return BEATS[attacker] === defender;
}
function elementMultiplier(attacker, defender, rules) {
  if (hasAdvantage(attacker, defender)) return rules.advantageMultiplier;
  if (hasAdvantage(defender, attacker)) return rules.disadvantageMultiplier;
  return 1;
}
function damageAgainst(attacker, defender, rules) {
  return Math.max(1, Math.floor(attacker.attack * elementMultiplier(attacker.element, defender.element, rules)));
}
function cardPower(card) {
  return card.attack * 2 + card.health;
}
function energyCostOf(card, rules) {
  return rules.energyCost[card.rarity];
}
function photoBonusCap(rarity, rules) {
  return Math.max(1, Math.floor(rules.powerBudget[rarity] * rules.photoBonusRatio));
}
function upgradeCap(rarity, rules) {
  return Math.floor(rules.powerBudget[rarity] * rules.upgradeRatio);
}
function maxCardPower(rarity, rules) {
  return rules.powerBudget[rarity] + photoBonusCap(rarity, rules) + upgradeCap(rarity, rules);
}

// ../engine/src/rng.ts
function nextRandom(state) {
  const next = state + 1831565813 | 0;
  let t = next;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return { value: ((t ^ t >>> 14) >>> 0) / 4294967296, next };
}

// ../engine/src/cards.ts
function c(id, name, element, rarity, attack, health) {
  return { id, name, element, rarity, attack, health };
}
var CARDS = [
  // Fogo
  c("fogo-formiga", "Formiga-de-fogo", "fogo", "comum", 3, 3),
  c("fogo-lagartixa", "Lagartixa", "fogo", "comum", 2, 5),
  c("fogo-raposa", "Raposa", "fogo", "incomum", 5, 5),
  c("fogo-tigre", "Tigre", "fogo", "rara", 6, 6),
  c("fogo-leao", "Le\xE3o", "fogo", "epica", 9, 9),
  c("fogo-fenix", "F\xEAnix", "fogo", "lendaria", 10, 8),
  // Planta
  c("planta-joaninha", "Joaninha", "planta", "comum", 2, 5),
  c("planta-lesma", "Lesma", "planta", "comum", 1, 7),
  c("planta-coelho", "Coelho", "planta", "incomum", 4, 7),
  c("planta-cervo", "Cervo", "planta", "rara", 5, 8),
  c("planta-urso", "Urso", "planta", "epica", 8, 11),
  c("planta-ent", "Ent", "planta", "lendaria", 9, 10),
  // Terra
  c("terra-minhoca", "Minhoca", "terra", "comum", 1, 7),
  c("terra-tatu", "Tatu", "terra", "comum", 3, 3),
  c("terra-texugo", "Texugo", "terra", "incomum", 5, 5),
  c("terra-javali", "Javali", "terra", "rara", 7, 4),
  c("terra-elefante", "Elefante", "terra", "epica", 7, 13),
  c("terra-golem", "Golem", "terra", "lendaria", 9, 10),
  // Ar
  c("ar-mosquito", "Mosquito", "ar", "comum", 4, 1),
  c("ar-pardal", "Pardal", "ar", "comum", 3, 3),
  c("ar-gaivota", "Gaivota", "ar", "incomum", 6, 3),
  c("ar-falcao", "Falc\xE3o", "ar", "rara", 7, 4),
  c("ar-aguia", "\xC1guia", "ar", "epica", 10, 7),
  c("ar-condor", "Condor", "ar", "lendaria", 10, 8),
  // Água
  c("agua-sapo", "Sapo", "agua", "comum", 2, 5),
  c("agua-peixe", "Peixe", "agua", "comum", 3, 3),
  c("agua-tartaruga", "Tartaruga", "agua", "incomum", 3, 9),
  c("agua-foca", "Foca", "agua", "rara", 5, 8),
  c("agua-tubarao", "Tubar\xE3o", "agua", "epica", 9, 9),
  c("agua-baleia", "Baleia", "agua", "lendaria", 9, 10)
];
var BY_ID = new Map(CARDS.map((card) => [card.id, card]));
function getCard(id) {
  const card = BY_ID.get(id);
  if (!card) throw new Error(`Carta desconhecida: ${id}`);
  return card;
}

// ../engine/src/deck.ts
function deckPower(deck) {
  return deck.reduce((sum, card) => sum + cardPower(card), 0);
}
function validateDeck(deck, rules) {
  const problems = [];
  if (deck.length !== rules.deckSize) {
    problems.push(`O baralho precisa ter ${rules.deckSize} cartas (tem ${deck.length}).`);
  }
  const ids = new Set(deck.map((card) => card.id));
  if (ids.size !== deck.length) {
    problems.push("O baralho tem cartas repetidas.");
  }
  for (const card of deck) {
    const power = cardPower(card);
    const max = maxCardPower(card.rarity, rules);
    if (power > max) {
      const budget = rules.powerBudget[card.rarity];
      problems.push(
        `${card.name} tem poder ${power}, acima do m\xE1ximo ${max} da raridade ${card.rarity} (or\xE7amento ${budget} + b\xF4nus de foto ${photoBonusCap(card.rarity, rules)} + melhoria ${upgradeCap(card.rarity, rules)}).`
      );
    }
  }
  const total = deckPower(deck);
  if (total > rules.deckPowerLimit) {
    problems.push(`Poder total ${total} passa do limite ${rules.deckPowerLimit}.`);
  }
  return problems;
}

// ../engine/src/game.ts
function clone(state) {
  return JSON.parse(JSON.stringify(state));
}
function other(p) {
  return p === 0 ? 1 : 0;
}
function rand(state) {
  const r = nextRandom(state.rngState);
  state.rngState = r.next;
  return r.value;
}
function shuffleInPlace(state, items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}
function newPlayer(deck, rules) {
  return {
    hp: rules.playerHp,
    drawPile: deck.slice(),
    discard: [],
    hand: [],
    field: Array.from({ length: rules.slots }, () => null)
  };
}
function createGame(deckA, deckB, seed, rules = DEFAULT_RULES) {
  for (const deck of [deckA, deckB]) {
    const problems = validateDeck(deck, rules);
    if (problems.length > 0) throw new Error(`Baralho inv\xE1lido: ${problems.join(" ")}`);
  }
  const state = {
    rules,
    players: [newPlayer(deckA, rules), newPlayer(deckB, rules)],
    turn: 0,
    active: 0,
    firstPlayer: 0,
    energy: 0,
    rngState: seed | 0,
    winner: null,
    endReason: null
  };
  shuffleInPlace(state, state.players[0].drawPile);
  shuffleInPlace(state, state.players[1].drawPile);
  state.active = rand(state) < 0.5 ? 0 : 1;
  state.firstPlayer = state.active;
  const events = [];
  startTurn(state, events);
  return { state, events };
}
function drawCard(state, p, events) {
  const player = state.players[p];
  if (player.drawPile.length === 0) {
    if (player.discard.length === 0) return;
    player.drawPile = player.discard;
    player.discard = [];
    shuffleInPlace(state, player.drawPile);
  }
  const card = player.drawPile.pop();
  if (card) {
    player.hand.push(card);
    events.push({ type: "draw", player: p, card });
  }
}
function startTurn(state, events) {
  state.turn += 1;
  state.energy = state.rules.energyPerTurn;
  if (state.turn === 2) state.energy += state.rules.secondPlayerBonusEnergy;
  events.push({ type: "turn_start", player: state.active, turn: state.turn });
  const player = state.players[state.active];
  while (player.hand.length < state.rules.handSize) {
    const before = player.hand.length;
    drawCard(state, state.active, events);
    if (player.hand.length === before) break;
  }
}
function legalActions(state) {
  if (state.winner !== null) return [];
  const actions = [];
  const player = state.players[state.active];
  player.hand.forEach((card, handIndex) => {
    if (energyCostOf(card, state.rules) > state.energy) return;
    player.field.forEach((occupant, slot) => {
      if (occupant === null) actions.push({ type: "play", handIndex, slot });
    });
  });
  actions.push({ type: "end" });
  return actions;
}
function isLegal(state, action) {
  return legalActions(state).some(
    (a) => a.type === action.type && (a.type === "end" || action.type === "play" && a.handIndex === action.handIndex && a.slot === action.slot)
  );
}
function applyAction(prev, action) {
  if (action.type === "forfeit") return forfeit(prev, action.player);
  if (!isLegal(prev, action)) {
    throw new Error(`A\xE7\xE3o ilegal: ${JSON.stringify(action)}`);
  }
  const state = clone(prev);
  const events = [];
  if (action.type === "play") {
    const player = state.players[state.active];
    const [card] = player.hand.splice(action.handIndex, 1);
    if (!card) throw new Error("\xCDndice de m\xE3o inv\xE1lido");
    state.energy -= energyCostOf(card, state.rules);
    player.field[action.slot] = { card, health: card.health, playedOnTurn: state.turn };
    events.push({ type: "play", player: state.active, card, slot: action.slot });
    return { state, events };
  }
  resolveAttacks(state, events);
  if (state.winner === null && state.turn >= state.rules.maxTurns) {
    const a = state.players[0].hp;
    const b = state.players[1].hp;
    state.winner = a === b ? "draw" : a > b ? 0 : 1;
    state.endReason = "turn_limit";
    events.push({ type: "game_over", winner: state.winner, reason: "turn_limit" });
  }
  if (state.winner === null) {
    state.active = other(state.active);
    startTurn(state, events);
  }
  return { state, events };
}
function forfeit(prev, player) {
  if (player !== 0 && player !== 1) throw new Error(`Jogador inv\xE1lido: ${String(player)}`);
  if (prev.winner !== null) throw new Error("A partida j\xE1 terminou: n\xE3o d\xE1 para desistir.");
  const state = clone(prev);
  state.winner = other(player);
  state.endReason = "forfeit";
  return { state, events: [{ type: "game_over", winner: state.winner, reason: "forfeit" }] };
}
function resolveAttacks(state, events) {
  const me = state.active;
  const foe = other(me);
  const mine = state.players[me];
  const theirs = state.players[foe];
  for (let slot = 0; slot < state.rules.slots; slot++) {
    const attacker = mine.field[slot];
    if (!attacker) continue;
    if (state.rules.summoningSickness && attacker.playedOnTurn === state.turn) continue;
    const target = theirs.field[slot];
    if (!target) {
      theirs.hp -= attacker.card.attack;
      events.push({ type: "attack_player", player: me, slot, damage: attacker.card.attack, hpAfter: theirs.hp });
      if (theirs.hp <= 0) {
        state.winner = me;
        state.endReason = "hp_zero";
        events.push({ type: "game_over", winner: me, reason: "hp_zero" });
        return;
      }
      continue;
    }
    const damage = damageAgainst(attacker.card, target.card, state.rules);
    target.health -= damage;
    events.push({
      type: "attack_creature",
      player: me,
      slot,
      damage,
      multiplier: elementMultiplier(attacker.card.element, target.card.element, state.rules),
      targetHealthAfter: target.health
    });
    if (target.health <= 0) {
      theirs.field[slot] = null;
      theirs.discard.push(target.card);
      events.push({ type: "creature_died", player: foe, slot, card: target.card });
    }
  }
}

// ../engine/src/view.ts
function publicPart(state, seat) {
  const p = state.players[seat];
  return {
    hp: p.hp,
    field: p.field,
    discard: p.discard,
    handCount: p.hand.length,
    drawCount: p.drawPile.length
  };
}
function viewFor(state, seat) {
  const foeSeat = seat === 0 ? 1 : 0;
  return {
    rules: state.rules,
    seat,
    turn: state.turn,
    active: state.active,
    firstPlayer: state.firstPlayer,
    energy: state.energy,
    winner: state.winner,
    endReason: state.endReason,
    me: { ...publicPart(state, seat), hand: state.players[seat].hand },
    foe: publicPart(state, foeSeat),
    legal: state.active === seat ? legalActions(state) : []
  };
}
function redactEvents(events, seat) {
  return events.filter((e) => !(e.type === "draw" && e.player !== seat));
}

// src/match/handler.ts
var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
var LOG_LIMIT = 80;
var CODE_ATTEMPTS = 5;
var ERRORS = {
  unauthorized: [401, "Entre no app antes de jogar online."],
  invalid_request: [400, "Pedido inv\xE1lido."],
  invalid_code: [400, "O c\xF3digo tem 6 letras e n\xFAmeros."],
  code_not_found: [404, "N\xE3o achei essa partida. Confira o c\xF3digo (vale por 15 minutos) ou pe\xE7a outro."],
  own_match: [409, "Esse c\xF3digo \xE9 de uma partida criada por voc\xEA. Passe-o para o seu amigo."],
  already_in_match: [409, "Voc\xEA j\xE1 est\xE1 numa partida. Termine ou desista dela antes de come\xE7ar outra."],
  deck_missing: [422, 'Monte e salve o seu baralho em "Meu baralho" antes de jogar online.'],
  deck_invalid: [422, "O seu baralho n\xE3o \xE9 v\xE1lido."],
  match_not_found: [404, "Partida n\xE3o encontrada."],
  not_waiting: [409, "Essa partida j\xE1 come\xE7ou: use Desistir."],
  match_finished: [409, "Essa partida j\xE1 terminou."],
  not_your_turn: [409, "N\xE3o \xE9 a sua vez."],
  stale_state: [409, "A partida mudou. Atualize a tela e jogue de novo."],
  illegal_action: [422, "Jogada n\xE3o permitida."],
  not_expired: [409, "O tempo do turno ainda n\xE3o acabou."],
  internal: [500, "Erro interno na partida."]
};
function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
var Refusal = class extends Error {
  constructor(code, extra = {}, detail) {
    super(code);
    this.code = code;
    this.extra = extra;
    this.detail = detail;
  }
  code;
  extra;
  detail;
};
function refusal(e) {
  const [status, message] = ERRORS[e.code];
  return json(status, { error: e.code, message: e.detail ?? message, ...e.extra });
}
async function loadDeck(deps2, userId) {
  const data = await deps2.rpc("match_load_deck", { p_user: userId });
  if (!data.card_ids || data.card_ids.length === 0) throw new Refusal("deck_missing");
  const photoById = new Map(data.photo_cards.map((c2) => [c2.id, c2]));
  const cards = [];
  const photos = {};
  for (const id of data.card_ids) {
    const photo = photoById.get(id);
    if (photo) {
      cards.push({ id: photo.id, name: photo.name, element: photo.element, rarity: photo.rarity, attack: photo.attack, health: photo.health });
      photos[photo.id] = photo.photo_path;
      continue;
    }
    try {
      cards.push(getCard(id));
    } catch {
      throw new Refusal("deck_invalid", {}, 'O seu baralho tem uma carta que voc\xEA n\xE3o possui. Abra "Meu baralho" e salve de novo.');
    }
  }
  const problems = validateDeck(cards, DEFAULT_RULES);
  if (problems.length > 0) throw new Refusal("deck_invalid", { problems }, `O seu baralho n\xE3o \xE9 v\xE1lido: ${problems[0]}`);
  return { name: data.display_name, cards, photos };
}
async function loadConfig(deps2) {
  return await deps2.rpc("match_config", {});
}
function seatOf(row, userId) {
  if (row.host_id === userId) return 0;
  if (row.guest_id === userId) return 1;
  return null;
}
function playerId(row, seat) {
  const id = seat === 0 ? row.host_id : row.guest_id;
  if (!id) throw new Error("Partida sem o segundo jogador");
  return id;
}
function revealedIds(state, seat) {
  const p = state.players[seat];
  return [...p.field.filter((c2) => c2 !== null).map((c2) => c2.card.id), ...p.discard.map((c2) => c2.id)];
}
function allIds(state, seat) {
  const p = state.players[seat];
  return [...revealedIds(state, seat), ...p.hand.map((c2) => c2.id), ...p.drawPile.map((c2) => c2.id)];
}
function buildViews(input, ids) {
  const rows = [];
  const byUser = {};
  for (const seat of [0, 1]) {
    const foe = seat === 0 ? 1 : 0;
    const userId = seat === 0 ? ids.host : ids.guest;
    const visible = redactEvents(input.events, seat);
    const log = visible.slice(-LOG_LIMIT);
    const photos = {};
    for (const id of allIds(input.state, seat)) {
      const path = input.cardPhotos[id];
      if (path) photos[id] = path;
    }
    const foePaths = [];
    for (const id of revealedIds(input.state, foe)) {
      const path = input.cardPhotos[id];
      if (path) {
        photos[id] = path;
        foePaths.push(path);
      }
    }
    const view = {
      kind: "game",
      matchId: input.matchId,
      version: input.version,
      serverNowMs: input.now.getTime(),
      deadlineMs: input.deadline ? input.deadline.getTime() : null,
      turnSeconds: input.config.turn_seconds,
      maxMissedTurns: input.config.max_missed_turns,
      missed: seat === 0 ? input.missed : [input.missed[1], input.missed[0]],
      myName: seat === 0 ? input.hostName : input.guestName,
      foeName: seat === 0 ? input.guestName : input.hostName,
      endCause: input.endCause,
      game: viewFor(input.state, seat),
      photos,
      log,
      logStart: visible.length - log.length
    };
    byUser[userId] = view;
    rows.push({
      player_id: userId,
      seat,
      status: input.state.winner === null ? "active" : "finished",
      view,
      photo_paths: foePaths
    });
  }
  return { rows, byUser };
}
function dbError(e) {
  return e instanceof Error ? e.message : String(e?.message ?? e);
}
async function opCreate(deps2, userId) {
  const deck = await loadDeck(deps2, userId);
  const matchId = deps2.newId();
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = deps2.newCode();
    const view = { kind: "waiting", matchId, code, serverNowMs: deps2.now().getTime() };
    try {
      await deps2.rpc("match_create", {
        p_match: matchId,
        p_host: userId,
        p_code: code,
        p_deck: deck.cards,
        p_photos: deck.photos,
        p_views: [{ player_id: userId, seat: 0, status: "waiting", view, photo_paths: [] }]
      });
      return view;
    } catch (e) {
      const msg = dbError(e);
      if (msg.includes("already_in_match")) {
        throw new Refusal("already_in_match", { matchId: await deps2.rpc("match_current", { p_user: userId }) });
      }
      if (msg.includes("matches_code_waiting_idx") || msg.includes("duplicate key")) continue;
      throw e;
    }
  }
  throw new Error("N\xE3o consegui sortear um c\xF3digo livre");
}
async function opJoin(deps2, userId, rawCode) {
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (!CODE_PATTERN.test(code)) throw new Refusal("invalid_code");
  const invite = await deps2.rpc("match_by_code", { p_code: code });
  if (!invite) throw new Refusal("code_not_found");
  if (invite.host_id === userId) throw new Refusal("own_match");
  const deck = await loadDeck(deps2, userId);
  let created;
  try {
    created = createGame(invite.host_deck, deck.cards, deps2.randomSeed());
  } catch (e) {
    throw new Refusal("deck_invalid", {}, dbError(e));
  }
  const config = await loadConfig(deps2);
  const now = deps2.now();
  const deadline = new Date(now.getTime() + config.turn_seconds * 1e3);
  const cardPhotos = { ...invite.card_photos, ...deck.photos };
  const { rows, byUser } = buildViews(
    {
      matchId: invite.id,
      version: 1,
      state: created.state,
      events: created.events,
      hostName: invite.host_name,
      guestName: deck.name,
      cardPhotos,
      deadline,
      missed: [0, 0],
      endCause: null,
      config,
      now
    },
    { host: invite.host_id, guest: userId }
  );
  try {
    await deps2.rpc("match_join", {
      p_match: invite.id,
      p_guest: userId,
      p_state: created.state,
      p_events: created.events,
      p_deadline: deadline.toISOString(),
      p_views: rows
    });
  } catch (e) {
    const msg = dbError(e);
    if (msg.includes("match_not_waiting")) throw new Refusal("code_not_found");
    if (msg.includes("own_match")) throw new Refusal("own_match");
    if (msg.includes("already_in_match")) {
      throw new Refusal("already_in_match", { matchId: await deps2.rpc("match_current", { p_user: userId }) });
    }
    throw e;
  }
  return byUser[userId];
}
async function commit(deps2, row, applied, userId, config) {
  const now = deps2.now();
  const finished = applied.state.winner !== null;
  const events = [...row.events, ...applied.newEvents];
  const { rows, byUser } = buildViews(
    {
      matchId: row.id,
      version: row.version + 1,
      state: applied.state,
      events,
      hostName: row.host_name,
      guestName: row.guest_name,
      cardPhotos: row.card_photos,
      deadline: finished ? null : applied.deadline,
      missed: applied.missed,
      endCause: applied.cause,
      config,
      now
    },
    { host: row.host_id, guest: playerId(row, 1) }
  );
  try {
    await deps2.rpc("match_apply", {
      p_match: row.id,
      p_expected: row.version,
      p_state: applied.state,
      p_new_events: applied.newEvents,
      p_status: finished ? "finished" : "active",
      p_cause: applied.cause,
      p_deadline: applied.deadline.toISOString(),
      p_missed: applied.missed,
      p_views: rows
    });
  } catch (e) {
    const msg = dbError(e);
    if (msg.includes("stale_state")) throw new Refusal("stale_state");
    if (msg.includes("match_not_active")) throw new Refusal("match_finished");
    throw e;
  }
  return byUser[userId];
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function readMatch(deps2, matchId, userId) {
  if (typeof matchId !== "string" || !UUID.test(matchId)) throw new Refusal("invalid_request");
  const row = await deps2.rpc("match_get", { p_match: matchId });
  const seat = row ? seatOf(row, userId) : null;
  if (!row || seat === null) throw new Refusal("match_not_found");
  return { row, seat };
}
async function loadMatch(deps2, matchId, userId) {
  const found = await readMatch(deps2, matchId, userId);
  if (found.row.status !== "active" || !found.row.state) throw new Refusal("match_finished");
  return found;
}
async function opCancel(deps2, userId, matchId) {
  const { row, seat } = await readMatch(deps2, matchId, userId);
  if (row.status === "finished") return;
  if (row.status !== "waiting" || seat !== 0) throw new Refusal("not_waiting");
  await deps2.rpc("match_cancel_waiting", { p_host: userId });
}
async function opTurnAction(deps2, userId, req) {
  if (!Number.isInteger(req.version)) throw new Refusal("invalid_request");
  if (req.op === "play" && (!Number.isInteger(req.handIndex) || !Number.isInteger(req.slot))) {
    throw new Refusal("invalid_request");
  }
  const { row, seat } = await loadMatch(deps2, req.matchId, userId);
  if (row.version !== req.version) throw new Refusal("stale_state");
  const state = row.state;
  if (state.active !== seat) throw new Refusal("not_your_turn");
  const action = req.op === "play" ? { type: "play", handIndex: req.handIndex, slot: req.slot } : { type: "end" };
  let result;
  try {
    result = applyAction(state, action);
  } catch {
    throw new Refusal("illegal_action");
  }
  const config = await loadConfig(deps2);
  const missed = [row.missed_turns[0], row.missed_turns[1]];
  missed[seat] = 0;
  const passed = req.op === "end";
  const deadline = passed ? new Date(deps2.now().getTime() + config.turn_seconds * 1e3) : new Date(row.turn_deadline ?? deps2.now().getTime());
  return commit(
    deps2,
    row,
    {
      state: result.state,
      newEvents: result.events,
      cause: result.state.winner !== null ? result.state.endReason : null,
      deadline,
      missed
    },
    userId,
    config
  );
}
async function opForfeit(deps2, userId, matchId) {
  for (let attempt = 0; ; attempt++) {
    const { row, seat } = await loadMatch(deps2, matchId, userId);
    const result = applyAction(row.state, { type: "forfeit", player: seat });
    try {
      return await commit(
        deps2,
        row,
        { state: result.state, newEvents: result.events, cause: "forfeit", deadline: deps2.now(), missed: row.missed_turns },
        userId,
        await loadConfig(deps2)
      );
    } catch (e) {
      if (e instanceof Refusal && e.code === "stale_state" && attempt < 2) continue;
      throw e;
    }
  }
}
async function opTimeout(deps2, userId, matchId) {
  for (let attempt = 0; ; attempt++) {
    const { row } = await loadMatch(deps2, matchId, userId);
    const state = row.state;
    const config = await loadConfig(deps2);
    const now = deps2.now();
    const deadline = row.turn_deadline ? new Date(row.turn_deadline) : null;
    if (!deadline || now.getTime() < deadline.getTime()) {
      throw new Refusal("not_expired", { remainingMs: deadline ? deadline.getTime() - now.getTime() : null });
    }
    const late = state.active;
    const overdueMs = now.getTime() - deadline.getTime();
    const missed = [row.missed_turns[0], row.missed_turns[1]];
    missed[late] += 1;
    const abandoned = overdueMs > config.abandon_seconds * 1e3;
    let applied;
    if (abandoned || missed[late] >= config.max_missed_turns) {
      const result = applyAction(state, { type: "forfeit", player: late });
      applied = { state: result.state, newEvents: result.events, cause: abandoned ? "abandoned" : "timeout", deadline: now, missed };
    } else {
      const result = applyAction(state, { type: "end" });
      const finished = result.state.winner !== null;
      applied = {
        state: result.state,
        newEvents: result.events,
        cause: finished ? result.state.endReason : null,
        deadline: new Date(now.getTime() + config.turn_seconds * 1e3),
        missed
      };
    }
    try {
      return await commit(deps2, row, applied, userId, config);
    } catch (e) {
      if (e instanceof Refusal && e.code === "stale_state" && attempt < 2) continue;
      throw e;
    }
  }
}
async function handleMatch(req, deps2) {
  if (req.method !== "POST") return refusal(new Refusal("invalid_request"));
  try {
    const userId = await deps2.getUserId(req);
    if (!userId) return refusal(new Refusal("unauthorized"));
    let body;
    try {
      body = await req.json();
    } catch {
      return refusal(new Refusal("invalid_request"));
    }
    let view;
    switch (body.op) {
      case "cancel":
        await opCancel(deps2, userId, body.matchId);
        return json(200, { matchId: body.matchId, view: null });
      case "create":
        view = await opCreate(deps2, userId);
        break;
      case "join":
        view = await opJoin(deps2, userId, body.code);
        break;
      case "play":
      case "end":
        view = await opTurnAction(deps2, userId, body);
        break;
      case "forfeit":
        view = await opForfeit(deps2, userId, body.matchId);
        break;
      case "timeout":
        view = await opTimeout(deps2, userId, body.matchId);
        break;
      default:
        return refusal(new Refusal("invalid_request"));
    }
    return json(200, { matchId: view.matchId, view });
  } catch (e) {
    if (e instanceof Refusal) return refusal(e);
    console.error("match: erro interno", dbError(e));
    return refusal(new Refusal("internal"));
  }
}

// src/match/index.ts
var admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false }
});
var deps = {
  async getUserId(req) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async rpc(fn, args) {
    const { data, error } = await admin.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  },
  now: () => /* @__PURE__ */ new Date(),
  randomSeed: () => crypto.getRandomValues(new Uint32Array(1))[0],
  newId: () => crypto.randomUUID(),
  newCode: () => {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  }
};
var cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS"
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const res = await handleMatch(req, deps);
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
});
