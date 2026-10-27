// What the bot posts, built as plain data (discord.js accepts these objects), so it is testable without Discord.

const PURPLE = 0x9146ff;
const GREEN = 0x3fb950;
const GREY = 0x8b949e;
const RED = 0xf85149;

export function welcomeMessage(member, roleChannelHint = "") {
  return {
    content: `<@${member.id}>`,
    allowedMentions: { users: [member.id] },
    embeds: [{
      color: PURPLE,
      title: `Welcome to ${member.guildName}!`,
      description: `Glad you're here, **${member.displayName}**. You're member #${member.memberCount}.${roleChannelHint ? `\nPick your roles in ${roleChannelHint}.` : ""}`,
      thumbnail: member.avatarUrl ? { url: member.avatarUrl } : undefined,
    }],
  };
}

// The role picker: one button a role, 5 to a row (Discord's limit), custom ids "role:<id>".
export function rolePickerMessage(roles) {
  const rows = [];
  for (let i = 0; i < roles.length; i += 5) {
    rows.push({
      type: 1,
      components: roles.slice(i, i + 5).map((role) => ({ type: 2, style: 2, custom_id: `role:${role.id}`, label: role.label, ...(role.emoji ? { emoji: { name: role.emoji } } : {}) })),
    });
  }
  return { embeds: [{ color: PURPLE, title: "Pick your roles", description: "Tap a button to add the role. Tap it again to remove it." }], components: rows };
}

// What a role button does for this member: add or remove, and the private reply they see.
export function roleToggle(customId, memberRoleIds, roles) {
  const roleId = customId.startsWith("role:") ? customId.slice(5) : "";
  const role = roles.find((r) => r.id === roleId);
  if (!role) return { action: "none", reply: "That role isn't offered any more." };
  const has = memberRoleIds.includes(roleId);
  return { action: has ? "remove" : "add", roleId, reply: has ? `Removed **${role.label}**.` : `Added **${role.label}**.` };
}

export function liveMessage(stream, pingRoleId = "") {
  return {
    content: `${pingRoleId ? `<@&${pingRoleId}> ` : ""}**${stream.name}** is live! https://twitch.tv/${stream.login}`,
    allowedMentions: pingRoleId ? { roles: [pingRoleId] } : { parse: [] },
    embeds: [{
      color: PURPLE,
      title: stream.title || `${stream.name} is live`,
      url: `https://twitch.tv/${stream.login}`,
      fields: [{ name: "Playing", value: stream.game || "Just chatting", inline: true }, { name: "Viewers", value: String(stream.viewers), inline: true }],
      image: { url: `${stream.thumbnail}?t=${Date.parse(stream.startedAt) || 0}` }, // (a fresh thumbnail, not Discord's cached one)
      timestamp: stream.startedAt,
    }],
  };
}

export function logEntry(event) {
  const color = { join: GREEN, leave: GREY, roles: PURPLE, ban: RED }[event.type] ?? GREY;
  const what = {
    join: `joined (account created <t:${Math.floor(event.accountCreated / 1000)}:R>)`,
    leave: "left the server",
    ban: "was banned",
    roles: [event.added?.length ? `+ ${event.added.join(", ")}` : "", event.removed?.length ? `- ${event.removed.join(", ")}` : ""].filter(Boolean).join("  "),
  }[event.type];
  return { embeds: [{ color, description: `**${event.tag}** (<@${event.userId}>) ${what}`, timestamp: new Date(event.at ?? Date.now()).toISOString() }], allowedMentions: { parse: [] } };
}
