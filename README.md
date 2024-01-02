# Stream Guard Bot

## Overview

This is a Twitch chat bot written in TypeScript that provides stream moderation and management functionalities. The bot is built using the [tmi.js](https://github.com/tmijs/tmi.js) library for interacting with the Twitch IRC interface and [axios](https://axios-http.com/) for making HTTP requests.

## Features

- **Stream Guard Manager (SGM):** Manages channel connections and disconnections.
- **Stream Guard Bot (SGB):** Provides moderation and interaction with Twitch chat.

## Prerequisites

Make sure you have the following set up:

- Twitch account
- Twitch Developer application with Client ID and Client Secret
- Twitch bot account for moderation
- OAuth token and refresh token for the bot account

## Setup

1. Install dependencies:

    ```bash
    npm install
    ```

2. Create a `.env` file in the project root and set the following variables:

    ```env
    STREAM_GUARD_CLIENT_ID=<Your Twitch Developer Client ID>
    STREAM_GUARD_CLIENT_SECRET=<Your Twitch Developer Client Secret>
    STREAM_GUARD_USERNAME=<Your Twitch Bot Username>
    STREAM_GUARD_USERID=<Your Twitch Bot User ID>
    STREAM_GUARD_OAUTH_TOKEN=<Your Twitch Bot OAuth Token>
    STREAM_GUARD_REFRESH_TOKEN=<Your Twitch Bot Refresh Token>
    ```

## Usage

Run the bot using the following command:

```bash
tsc app.ts
node app.js
```
## Commands

### Stream Guard Manager (SGM)

- `!join`: Join the specified channel.
- `!leave`: Leave the current channel.

### Stream Guard Bot (SGB)

- `!addqa`: Add a question and answer pair to the bot's FAQ.
- `!removeqa`: Remove a question and answer pair from the bot's FAQ.
- `!listfaq`: List all questions and answers in the bot's FAQ.
- `!setmoderationlevel`: Set the moderation level for the bot.

## Events

- **connected:** Triggered when the bot successfully connects to Twitch IRC.
- **disconnected:** Triggered when the bot disconnects from Twitch IRC. It attempts to reconnect after a delay.
- **chat:** Triggered when a chat message is received. The bot processes commands and performs moderation actions.
