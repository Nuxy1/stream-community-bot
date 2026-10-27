# Stream Community Bot

A Discord bot for a streamer's community that runs the four things mods otherwise do by hand.

| Feature | What members and mods see |
|---|---|
| **Welcome cards** | A new member is greeted by name with their avatar and member number, and pointed to the roles channel. |
| **Role buttons** | `/rolepicker` posts buttons. A member taps one to add a role and taps again to remove it. Members get a private confirmation, and roles not in the config can never be handed out. |
| **Twitch go-live alerts** | When the stream starts, one post with the title, game, viewer count and a live thumbnail, pinging only the opt-in role. It never posts twice, even after a restart mid-stream. |
| **Mod log** | Joins (with account age, to spot fresh alt accounts), leaves, bans and role changes, posted to a staff channel without pinging anyone. |

Built on discord.js v14. Settings live in `config.json` and are checked at start-up, so a typo fails immediately with a clear message, not hours later. Secrets go in `.env`.

## Set up

1. **Create the bot.** In the [Discord Developer Portal](https://discord.com/developers/applications): New Application > Bot.
   - Switch on **Server Members Intent**.
   - Copy the token into `.env` (from `.env.example`), with the Application ID and your server's ID.
2. **Invite it to your server:**
   - In OAuth2 > URL Generator, pick the scopes `bot` and `applications.commands`, and the permissions Manage Roles, Send Messages and Embed Links. Open the link.
   - In Server Settings > Roles, drag the bot's role **above** the roles it should hand out. Discord only lets a bot give roles below its own.
3. **Configure it:** copy `config.example.json` to `config.json` and fill in the channel and role IDs. To copy an ID, turn on Developer Mode, then right-click the channel or role.
4. **Twitch alerts** (optional): register an app at dev.twitch.tv/console and put its client ID and secret in `.env`.
5. **Run it:** `npm install`, `npm run register` (adds `/rolepicker`), then `npm start`.

## Tested

```bash
npm test   # config checking, role buttons (rows of 5, add/remove, stale buttons refused), welcome and log
           # messages (who gets pinged), go-live (each stream once), the Twitch client (token cache, 401 refresh)
```

Message building and decisions are plain functions, kept apart from the Discord connection, so they're tested without a live server.
