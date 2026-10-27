// Registers the /rolepicker command in one server (instant, unlike global commands). Run once, and again after a change.
//   DISCORD_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID in .env
import { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const { DISCORD_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_APP_ID || !DISCORD_GUILD_ID) throw new Error("set DISCORD_TOKEN, DISCORD_APP_ID and DISCORD_GUILD_ID in .env");

export const commands = [
  new SlashCommandBuilder()
    .setName("rolepicker")
    .setDescription("Post the role-picker buttons in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles), // (only people who can manage roles see it)
].map((command) => command.toJSON());

await new REST().setToken(DISCORD_TOKEN).put(Routes.applicationGuildCommands(DISCORD_APP_ID, DISCORD_GUILD_ID), { body: commands });
console.log(`registered ${commands.length} command(s) in server ${DISCORD_GUILD_ID}`);
