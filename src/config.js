import { readFileSync } from "node:fs";

// config.json, checked up front so a typo fails at start with a clear message, not hours later on the first event.
//   welcomeChannelId, logChannelId, liveChannelId: channel ids (any may be "" to switch that feature off)
//   roles: [{ id, label, emoji? }]: the self-serve roles members can toggle with buttons (up to 25)
//   twitch: { logins: ["streamer"], pingRoleId?: "", pollSeconds?: 60 }
export function validateConfig(raw) {
  const errors = [];
  const id = (value, name) => {
    if (value !== undefined && value !== "" && !/^\d{17,20}$/.test(String(value))) errors.push(`${name} should be a Discord id (17-20 digits), got "${value}"`);
  };
  id(raw.welcomeChannelId, "welcomeChannelId");
  id(raw.logChannelId, "logChannelId");
  id(raw.liveChannelId, "liveChannelId");
  const roles = raw.roles ?? [];
  if (!Array.isArray(roles) || roles.length > 25) errors.push("roles should be a list of at most 25 roles");
  else roles.forEach((role, i) => {
    id(role.id, `roles[${i}].id`);
    if (!role.label || String(role.label).length > 80) errors.push(`roles[${i}].label is required (at most 80 characters)`);
  });
  const twitch = raw.twitch ?? { logins: [] };
  if (!Array.isArray(twitch.logins) || twitch.logins.some((login) => !/^[a-z0-9_]{3,25}$/i.test(login))) errors.push("twitch.logins should be Twitch usernames");
  id(twitch.pingRoleId, "twitch.pingRoleId");
  if (errors.length) throw new Error(`config.json:\n- ${errors.join("\n- ")}`);
  return {
    welcomeChannelId: raw.welcomeChannelId || "",
    logChannelId: raw.logChannelId || "",
    liveChannelId: raw.liveChannelId || "",
    roles,
    twitch: { logins: twitch.logins.map((l) => l.toLowerCase()), pingRoleId: twitch.pingRoleId || "", pollSeconds: Math.max(30, Number(twitch.pollSeconds) || 60) },
  };
}

export function loadConfig(path = "config.json") {
  return validateConfig(JSON.parse(readFileSync(path, "utf8")));
}
