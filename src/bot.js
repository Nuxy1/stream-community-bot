// The bot: welcome cards, role buttons, Twitch go-live alerts, mod log. Settings in config.json, secrets in .env.
import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import { loadConfig } from "./config.js";
import { liveMessage, logEntry, rolePickerMessage, roleToggle, welcomeMessage } from "./messages.js";
import { newStreams, twitch } from "./twitch.js";

const config = loadConfig();
if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN is missing (put it in .env)");

const client = new Client({
  // (GuildMembers is a privileged intent: switch on "Server Members Intent" in the Developer Portal > Bot)
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration],
  partials: [Partials.GuildMember], // (so a member who leaves before ever being cached still reaches the mod log)
});

async function post(channelId, message) {
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    await channel?.send(message);
  } catch (error) {
    console.error(`[bot] could not post to ${channelId}: ${error.message}`); // (one failed post never stops the bot)
  }
}

client.once(Events.ClientReady, (ready) => {
  console.log(`[bot] online as ${ready.user.tag} in ${ready.guilds.cache.size} server(s)`);
  if (config.twitch.logins.length && process.env.TWITCH_CLIENT_ID) {
    const tw = twitch({ clientId: process.env.TWITCH_CLIENT_ID, clientSecret: process.env.TWITCH_CLIENT_SECRET });
    const announced = new Set();
    let first = true;
    const check = async () => {
      try {
        const fresh = newStreams(await tw.live(config.twitch.logins), announced);
        // (on start, streams already live are remembered, not announced: a restart mid-stream stays quiet)
        if (!first) for (const stream of fresh) await post(config.liveChannelId, liveMessage(stream, config.twitch.pingRoleId));
        first = false;
      } catch (error) {
        console.error(`[twitch] ${error.message}`);
      }
    };
    check();
    setInterval(check, config.twitch.pollSeconds * 1000);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  await post(config.welcomeChannelId, welcomeMessage({
    id: member.id, displayName: member.displayName, guildName: member.guild.name, memberCount: member.guild.memberCount, avatarUrl: member.displayAvatarURL({ size: 256 }),
  }));
  await post(config.logChannelId, logEntry({ type: "join", tag: member.user.tag, userId: member.id, accountCreated: member.user.createdTimestamp }));
});

client.on(Events.GuildMemberRemove, (member) => post(config.logChannelId, logEntry({ type: "leave", tag: member.user?.tag ?? member.id, userId: member.id })));

client.on(Events.GuildBanAdd, (ban) => post(config.logChannelId, logEntry({ type: "ban", tag: ban.user.tag, userId: ban.user.id })));

client.on(Events.GuildMemberUpdate, (before, after) => {
  if (before.partial) return; // (the earlier roles aren't known: nothing to compare)
  const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id)).map((r) => r.name);
  const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id)).map((r) => r.name);
  if (added.length || removed.length) post(config.logChannelId, logEntry({ type: "roles", tag: after.user.tag, userId: after.id, added, removed }));
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "rolepicker") {
      await interaction.channel.send(rolePickerMessage(config.roles));
      await interaction.reply({ content: "Role picker posted.", flags: MessageFlags.Ephemeral });
    } else if (interaction.isButton() && interaction.customId.startsWith("role:")) {
      const toggle = roleToggle(interaction.customId, [...interaction.member.roles.cache.keys()], config.roles);
      if (toggle.action === "add") await interaction.member.roles.add(toggle.roleId, "self-serve role button");
      if (toggle.action === "remove") await interaction.member.roles.remove(toggle.roleId, "self-serve role button");
      await interaction.reply({ content: toggle.reply, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error(`[bot] interaction failed: ${error.message}`);
    // (usually the bot's own role sits below the role it tried to give: drag it higher in Server Settings > Roles)
    const reply = { content: "Something went wrong; a moderator has been told in the logs.", flags: MessageFlags.Ephemeral };
    if (interaction.isRepliable() && !interaction.replied) await interaction.reply(reply).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
