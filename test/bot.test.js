import assert from "node:assert/strict";
import { test } from "node:test";
import { validateConfig } from "../src/config.js";
import { liveMessage, logEntry, rolePickerMessage, roleToggle, welcomeMessage } from "../src/messages.js";
import { newStreams, twitch } from "../src/twitch.js";

const ROLES = [
  { id: "111111111111111111", label: "Stream pings", emoji: "🔔" },
  { id: "222222222222222222", label: "Fortnite" },
  { id: "333333333333333333", label: "Art" },
  { id: "444444444444444444", label: "Clips" },
  { id: "555555555555555555", label: "Events" },
  { id: "666666666666666666", label: "Off-topic" },
];

test("config: valid settles defaults; mistakes are listed together", () => {
  const ok = validateConfig({ welcomeChannelId: "123456789012345678", roles: ROLES, twitch: { logins: ["SomeStreamer"] } });
  assert.deepEqual(ok.twitch, { logins: ["somestreamer"], pingRoleId: "", pollSeconds: 60 });
  assert.equal(ok.logChannelId, "");
  assert.throws(() => validateConfig({ welcomeChannelId: "#general", roles: [{ id: "1", label: "" }], twitch: { logins: ["no spaces allowed"] } }),
    (e) => /welcomeChannelId should be a Discord id/.test(e.message) && /roles\[0\]\.id/.test(e.message) && /roles\[0\]\.label/.test(e.message) && /twitch\.logins/.test(e.message));
  assert.equal(validateConfig({ twitch: { logins: [], pollSeconds: 5 } }).twitch.pollSeconds, 30); // (Twitch rate limits: not faster than 30 s)
});

test("role picker: 5 buttons a row, toggles add then remove, unknown buttons refused", () => {
  const picker = rolePickerMessage(ROLES);
  assert.deepEqual(picker.components.map((row) => row.components.length), [5, 1]);
  assert.deepEqual(picker.components[0].components[0], { type: 2, style: 2, custom_id: "role:111111111111111111", label: "Stream pings", emoji: { name: "🔔" } });
  assert.deepEqual(roleToggle("role:222222222222222222", [], ROLES), { action: "add", roleId: "222222222222222222", reply: "Added **Fortnite**." });
  assert.deepEqual(roleToggle("role:222222222222222222", ["222222222222222222"], ROLES), { action: "remove", roleId: "222222222222222222", reply: "Removed **Fortnite**." });
  assert.equal(roleToggle("role:999999999999999999", [], ROLES).action, "none"); // (a button left from an old config can't give a role)
});

test("welcome and mod log messages mention safely", () => {
  const w = welcomeMessage({ id: "777777777777777777", displayName: "Ava", guildName: "Nuxy's Den", memberCount: 1204, avatarUrl: "https://cdn/x.png" }, "#roles");
  assert.equal(w.content, "<@777777777777777777>");
  assert.deepEqual(w.allowedMentions, { users: ["777777777777777777"] });
  assert.match(w.embeds[0].description, /member #1204\.\nPick your roles in #roles\./);
  const l = logEntry({ type: "roles", tag: "ava", userId: "777777777777777777", added: ["Fortnite"], removed: ["Art"] });
  assert.match(l.embeds[0].description, /\+ Fortnite {2}- Art/);
  assert.deepEqual(l.allowedMentions, { parse: [] }); // (the log never pings anyone)
});

test("go-live: each stream announced once; a stream that ended is forgotten", () => {
  const announced = new Set();
  const a = { id: "s1", login: "nuxy" };
  const b = { id: "s2", login: "friend" };
  assert.deepEqual(newStreams([a], announced), [a]);
  assert.deepEqual(newStreams([a, b], announced), [b]);
  assert.deepEqual(newStreams([b], announced), []);
  assert.deepEqual([...announced], ["s2"]);
  assert.deepEqual(newStreams([a], announced), [a]); // (a new stream later, same channel: s1 is announced again only because it ended and came back with its id)
});

test("live message pings only the configured role", () => {
  const stream = { id: "s1", login: "nuxy", name: "Nuxy", title: "Ranked grind", game: "Fortnite", viewers: 42, startedAt: "2026-10-27T20:00:00Z", thumbnail: "https://thumb/1280x720.jpg" };
  const withPing = liveMessage(stream, "888888888888888888");
  assert.match(withPing.content, /^<@&888888888888888888> \*\*Nuxy\*\* is live! https:\/\/twitch\.tv\/nuxy$/);
  assert.deepEqual(withPing.allowedMentions, { roles: ["888888888888888888"] });
  assert.deepEqual(liveMessage(stream).allowedMentions, { parse: [] });
  assert.equal(withPing.embeds[0].fields[0].value, "Fortnite");
});

test("twitch client: app token cached, streams mapped, a 401 refreshes the token once", async () => {
  const calls = [];
  let tokens = 0;
  let unauthorizedOnce = true;
  const fetchImpl = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("oauth2/token")) {
      tokens++;
      return { ok: true, json: async () => ({ access_token: `t${tokens}`, expires_in: 3600 }) };
    }
    if (unauthorizedOnce) {
      unauthorizedOnce = false;
      return { ok: false, status: 401 };
    }
    assert.equal(init.headers.authorization, "Bearer t2");
    return { ok: true, json: async () => ({ data: [{ id: "s9", user_login: "nuxy", user_name: "Nuxy", title: "hi", game_name: "Fortnite", viewer_count: 7, started_at: "2026-10-27T20:00:00Z", thumbnail_url: "https://t/{width}x{height}.jpg" }] }) };
  };
  const tw = twitch({ clientId: "id", clientSecret: "secret", fetchImpl });
  const live = await tw.live(["nuxy", "friend"]);
  assert.equal(tokens, 2);
  assert.equal(live[0].thumbnail, "https://t/1280x720.jpg");
  assert.match(calls.find((c) => c.includes("helix")), /user_login=nuxy&user_login=friend/);
  await tw.live(["nuxy"]);
  assert.equal(tokens, 2); // (cached)
});
