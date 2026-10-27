// Twitch go-live detection through the Helix API with an app token (client credentials): no user login, no webhook
// server to host. Polls the configured channels and reports each stream ONCE, by its stream id, so a restart or a
// brief API blip never re-announces a stream that is already live.

export function twitch({ clientId, clientSecret, fetchImpl = fetch }) {
  let token = null;
  let expires = 0;

  async function appToken() {
    if (token && Date.now() < expires - 60_000) return token;
    const response = await fetchImpl("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    });
    if (!response.ok) throw new Error(`Twitch token request failed (${response.status}): check TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET`);
    const body = await response.json();
    token = body.access_token;
    expires = Date.now() + body.expires_in * 1000;
    return token;
  }

  return {
    // Live streams among `logins`: [{ id, login, name, title, game, viewers, startedAt, thumbnail }]
    async live(logins) {
      if (!logins.length) return [];
      const url = new URL("https://api.twitch.tv/helix/streams");
      logins.slice(0, 100).forEach((login) => url.searchParams.append("user_login", login));
      let response = await fetchImpl(url, { headers: { "client-id": clientId, authorization: `Bearer ${await appToken()}` } });
      if (response.status === 401) {
        token = null; // (revoked or expired early: get a fresh one once)
        response = await fetchImpl(url, { headers: { "client-id": clientId, authorization: `Bearer ${await appToken()}` } });
      }
      if (!response.ok) throw new Error(`Twitch streams request failed (${response.status})`);
      return (await response.json()).data.map((s) => ({
        id: s.id, login: s.user_login, name: s.user_name, title: s.title, game: s.game_name, viewers: s.viewer_count, startedAt: s.started_at,
        thumbnail: s.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"),
      }));
    },
  };
}

// Which live streams are new since the last check. `announced` holds stream ids already posted (kept small: only ids
// still live are kept, so it never grows).
export function newStreams(live, announced) {
  const fresh = live.filter((s) => !announced.has(s.id));
  const stillLive = new Set(live.map((s) => s.id));
  for (const id of announced) if (!stillLive.has(id)) announced.delete(id);
  fresh.forEach((s) => announced.add(s.id));
  return fresh;
}
