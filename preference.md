# Project Architecture & Folder Understanding (preference.md)

This file contains the persistent understanding and architecture mapping of the current workspace directory, created to assist Kak Kiky with project development and maintenance.

## 📁 Directory Structure Overview

- **`index.js`** / **`index.js.local-backup`**: Main entry point for the Discord bot. Handles client initialization, global error handling, instance locking (`.bot.lock`), and imports modular command handlers.
- **`package.json`** & **`package-lock.json`**: Node.js dependencies configuration. Core packages include `discord.js`, `play-dl`, `spotify-web-api-node`, `youtubei.js`, `yt-stream`, and `dotenv`.
- **`readme.md`**: User-facing documentation detailing custom bot commands (e.g., `!whellevi`, `!addinput`, `!arenaevent`, `!arenalb`, cropping options).
- **`CHANGES.md`**: Changelog documenting major feature additions, such as Spotify API integration and backup configurations.
- **`annoucnment.txt`**: Template text for arena event announcements and reward breakdowns (RC points).
- **`SPOTIFY_SETUP.md`**: Guide for setting up Spotify API credentials (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`).

---

## 🛠️ Commands Module (`/commands/`)

Modular command handlers executed by the bot:
- **`activity.js`**: Tracks user text chat and voice state activity.
- **`announcment.js`**: Handles server-wide and custom announcements/embeds.
- **`Arenaplay.js`**: Manages arena events, match announcements, and rankings (`!arenalb`).
- **`buatcoderrandom.js`**: Generates random coding snippets or challenges.
- **`input.js`**: Manages user profiles, custom bios, and background images with alignment/cropping support (`crop=top-left`, `crop=center`, etc.), including auto-syncing to GitHub repositories.
- **`music.js` & `playmusic.js`**: Audio playback system supporting both YouTube links/search and Spotify direct links/playlists with automatic fallback streams.
- **`Roleinfo.js`**: Retrieves role information and details.
- **`rules.js`**: Displays server guidelines and rules.
- **`studySchedule.js`**: Manages study schedules and reminders.
- **`tasks.js`**: Handles user task management.
- **`web.js`**: Web utility commands.
- **`whellevi.js`**: Manages WHELL and LEVIA spending points, resets, leaderboard generation (`!spenderlb`), and synchronization with remote GitHub data paths.

---

## 📊 Data Storage (`/data/`)
- **`activity-points.json`**: Stores user activity statistics and points.
- **`whellevi-points.json`**: Stores member spendings, points for WHELL and LEVIA, and leaderboard states.
- **`whellevi-points.json` (remote/sync)**: Synced with GitHub (`kikysena13/dc`).
