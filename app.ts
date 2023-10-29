import axios from 'axios';
import { client as Client } from 'tmi.js';
import { StreamGuardManager, joinChannelCommand, leaveChannelCommand } from './streamGuardManager.js';
import { addQACommand, removeQACommand, listFAQCommand } from './streamGuardBot.js';
import type { ChatUserstate } from 'tmi.js';

import * as dotenv from 'dotenv';
dotenv.config();

const CLIENTID = process.env.STREAM_GUARD_CLIENT_ID as string;
const CLIENTSECRET = process.env.STREAM_GUARD_CLIENT_SECRET as string;
const USERNAME = process.env.STREAM_GUARD_USERNAME as string;
const USERID = process.env.STREAM_GUARD_USERID as string;

const sgmCommands: string[] = [joinChannelCommand, leaveChannelCommand];
const sgbCommands: string[] = [addQACommand, removeQACommand, listFAQCommand];
const allCommands: string[] = sgmCommands.concat(sgbCommands);

let accessToken = process.env.STREAM_GUARD_OAUTH_TOKEN as string;
let refreshToken = process.env.STREAM_GUARD_REFRESH_TOKEN as string;

// Define configuration options
const opts = {
  identity: {
    username: USERNAME,
    password: `oauth:${accessToken}`
  },
  channels: [
    USERNAME
  ]
};
const client = new Client(opts);
const manager = new StreamGuardManager();

// Register our event handlers
client.on('connected', (address: string, port: number) => {
  console.info(`* Connected to ${address}:${port}`);
  manager.addChannel(USERID, USERNAME);
});

client.on('disconnected', async (reason: string) => {
  console.log(`Disconnected: ${reason}`);
  await new Promise((resolve) => setTimeout(resolve, 10000));
  await connect();
});

client.on('chat', async (channel: string, userstate: ChatUserstate, message: string, self: boolean) => {
  console.log(userstate);
  if (self) {
    return;
  }

  if (
    !allCommands.some(command => message.startsWith(command)) &&
    message.startsWith('!')
  ) {
    return;
  }

  channel = channel.substring(1);
  message = message.trim();

  // Stream Guard Manager commands
  if (sgmCommands.some(command => message.startsWith(command))) {
    try {
      await manager.commandHandler(client, channel, userstate, message);
    } catch (error) {
      console.log(error.message);
      client.say(channel, error.message);
    }
    return;
  }

  // Stream Guard Bot commands
  if (sgbCommands.some(command => message.startsWith(command))) {
    try {
      const channelBot = manager.getChannel(channel);
      await channelBot.commandHandler(client, channel, userstate, message);
    } catch (error) {
      console.log(error.message);
      client.say(channel, error.message);
    }
    return;
  }

  const channelBot = manager.getChannel(channel);
  const moderation = await channelBot.moderate(message);
  if (moderation) {
    // deleteMessage(channel, userstate);
    banUser(channel, userstate, message, 10);
  }
  const response = await channelBot.respond(message);
  if (response !== undefined && response !== '') {
    client.say(channel, `@${userstate.username} ${response}`).catch(error => { console.log(error); });
  }
});

async function connect (): Promise<void> {
  try {
    await client.connect();
  } catch (error) {
    console.log(`Connect Error: ${error}`);
  }
}

async function refreshUserAccessToken (): Promise<undefined> {
  const url = 'https://id.twitch.tv/oauth2/token';
  const data = new URLSearchParams({
    client_id: CLIENTID,
    client_secret: CLIENTSECRET,
    grant_type: 'refresh_token',
    refresh_token: encodeURIComponent(refreshToken)
  });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: data
  };

  const response = await fetch(url, options);
  const token = await response.json();

  // Assign new token
  accessToken = token.access_token;
  refreshToken = token.refresh_token;

  const expiration = token.expires_in;
  console.info({ accessToken, refreshToken, expiration });

  // Update Client
  const clientOptions = client.getOptions();
  clientOptions.identity.password = `oauth:${accessToken}`;

  // Set timer
  await new Promise((resolve) => setTimeout(resolve, (expiration - 1800) * 1000));
  void refreshUserAccessToken();
}

async function deleteMessage (channel: string, userstate: ChatUserstate): Promise<void> {
  const url = 'https://api.twitch.tv/helix/moderation/chat';
  const broadcasterId = manager.getChannel(channel).userId;
  const moderatorId = USERID;
  const messageId = userstate.id as string;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Client-Id': CLIENTID
  };

  const queryParams = `broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}&message_id=${messageId}`;
  await axios.delete(`${url}?${queryParams}`, { headers });
}

async function banUser (channel: string, userstate: ChatUserstate, message: string, duration: number = 0): Promise<void> {
  const url = 'https://api.twitch.tv/helix/moderation/bans';
  const broadcasterId = manager.getChannel(channel).userId;
  const moderatorId = USERID;
  const userId = userstate['user-id'] as string;

  const requestBody = {
    data: {
      user_id: userId,
      duration,
      reason: `Inappropriate message detected by Stream Guard Bot: ${message}`
    }
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Client-Id': CLIENTID,
    'Content-Type': 'application/json'
  };
  const queryParams = `broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}`;
  await axios.post(`${url}?${queryParams}`, requestBody, { headers });
}

// void refreshUserAccessToken();
void connect();
