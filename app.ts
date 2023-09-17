import { client as Client } from 'tmi.js';
import { StreamGuardManager, joinChannelCommand, leaveChannelCommand } from './streamGuardManager.js';
import { addQACommand, removeQACommand, listFAQCommand } from './streamGuardBot.js';

const CLIENTID = process.env.CLIENT_ID;
const CLIENTSECRET = process.env.CLIENT_SECRET;

const sgmCommands: string[] = [
  joinChannelCommand,
  leaveChannelCommand
];
const sgbCommands: string[] = [
  addQACommand,
  removeQACommand,
  listFAQCommand
];
const allCommands: string[] = sgmCommands.concat(sgbCommands);

let accessToken = process.env.STREAM_GUARD_OAUTH_TOKEN;
let refreshToken = process.env.STREAM_GUARD_REFRESH_TOKEN;

// Define configuration options
const opts = {
  identity: {
    username: process.env.STREAM_GUARD_USERNAME,
    password: `oauth:${accessToken}`
  },
  channels: [
    process.env.STREAM_GUARD_USERNAME
  ]
};
const client = new Client(opts);
const manager = new StreamGuardManager();

// Register our event handlers
client.on('connected', async (address, port) => {
  console.log(`* Connected to ${address}:${port}`);
  void manager.addChannel(process.env.STREAM_GUARD_USERNAME);
  void joinChannels();
  setInterval(joinChannels, 1800000);
});
/*
client.on('chat', async (channel, userstate, message, self) => {
  if (userstate.username === process.env.STREAM_GUARD_USERNAME) {
    return;
  }

  if (
    !allCommands.some(command => message.startsWith(command)) &&
    message.startsWith('!') === true
  ) {
    return;
  }

  channel = channel.substring(1);
  message = message.trim();

  // Stream Guard Manager commands
  if (sgmCommands.some(command => message.startsWith(command))) {
    void manager.commandHandler(client, channel, userstate, message);
    return;
  }

  // Stream Guard Bot commands
  if (sgbCommands.some(command => message.startsWith(command))) {
    const channelBot = await manager.getChannel(channel);
    void channelBot.commandHandler(client, channel, userstate, message);
    return;
  }

  const channelBot = await manager.getChannel(channel);
  const response = await channelBot.respond(message);
  if (response !== undefined && response !== '') {
    client.say(channel, `@${userstate.username} ${response}`);
  }
});
**/

// Logging
client.on('chat', (channel, userstate, message, self) => {
  void manager.getChannel(channel.substring(1))
    .then(channelBot => { channelBot.logMessage(userstate.username, message); });
});

client.on('timeout', (channel, username, reason, duration, userstate) => {
  void manager.getChannel(channel.substring(1))
    .then(channelBot => { channelBot.logMessage(username, 'TIMEOUT'); });
});

client.on('ban', (channel, username, reason, userstate) => {
  void manager.getChannel(channel.substring(1))
    .then(channelBot => { channelBot.logMessage(username, 'BAN'); });
});

client.on('messagedeleted', (channel, username, deletedMessage, userstate) => {
  void manager.getChannel(channel.substring(1))
    .then(channelBot => { channelBot.logMessage(username, `DELELTEDMESSAGE_${deletedMessage}`); });
});

client.connect();

async function refreshUserAccessToken (): Promise<undefined> {
  const apiURL = 'https://id.twitch.tv/oauth2/token';
  const data = new URLSearchParams({
    client_id: CLIENTID,
    client_secret: CLIENTSECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const response = await fetch(apiURL, {
    method: 'POST',
    headers: { 'Content-Type': 'client/x-www-form-urlencoded' },
    body: data
  });

  const token = await response.json();
  accessToken = token.access_token;
  refreshToken = token.refresh_token;
}

async function getStreams (): Promise<Array<{ channel: string, category: string }>> {
  const apiURL = 'https://api.twitch.tv/helix/streams';
  const queryParameters = new URLSearchParams({
    language: 'en',
    first: '100',
    after: ''
  });

  let streams: Array<{ channel: string, category: string }> = [];
  let counter = 0;
  while (counter <= 150) {
    const response = await fetch(`${apiURL}?${queryParameters.toString()}`, {
      headers: {
        'Client-ID': CLIENTID,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (response.status === 401) {
      console.log(response.status);
      await refreshUserAccessToken();
      continue;
    }

    if (response.status === 429) {
      const ratelimitLimit = response.headers.get('ratelimit-limit');
      const ratelimitRemaining = response.headers.get('ratelimit-remaining');
      const ratelimitReset = response.headers.get('ratelimit-reset');
      console.log(response.status);
      console.log({ ratelimitLimit, ratelimitRemaining, ratelimitReset });
      break;
    }

    const { data, pagination } = await response.json();
    const extractedStreams = data.map(stream => ({
      channel: stream.user_login,
      category: stream.game_name
    }));

    streams = streams.concat(extractedStreams);

    if (Object.keys(pagination).length === 0) {
      break;
    }
    queryParameters.set('after', pagination.cursor);
    counter = counter + 1;
  }

  return streams;
}

async function joinChannels (): Promise<undefined> {
  console.log('Updating Channels');
  const streams = await getStreams();
  for (const stream of streams) {
    if (manager.channels.has(stream.channel)) {
      const channelBot = await manager.getChannel(stream.channel);
      void channelBot.setCategory(stream.category);
      continue;
    }

    try {
      await client.join(stream.channel);
      await manager.addChannel(stream.channel);
      const channelBot = await manager.getChannel(stream.channel);
      void channelBot.setCategory(stream.category);
    } catch (error) {
      console.error(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log('Done Joining');
}
