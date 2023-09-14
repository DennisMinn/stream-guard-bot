import { client } from 'tmi.js';
import { Command } from 'commander';
import { parseArgsStringToArgv } from 'string-argv';
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

const manager = new StreamGuardManager();
const application = new client(opts);
const cli = new Command();

manager.addChannel(process.env.STREAM_GUARD_USERNAME);

// Register our event handlers
application.on('message', onMessageHandler);
application.on('connected', onConnectedHandler);
application.connect();

// Error Handling for CLI
cli.exitOverride();

// joinChannels();
// setInterval(joinChannels, 120000);

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port): void {
  console.log(`* Connected to ${addr}:${port}`);
}

// Called every time a message comes in
async function onMessageHandler (channel, userstate, message, self): Promise<undefined> {
  if (self) { return; } // Ignore messages from the bot
  if (message.includes('--channel') === true || message.includes('--username') === true) {
    return;
  }

  // Removes hash prefix
  channel = channel.substring(1);
  message = message.trim();

  const channelFlag = ['--channel', channel];
  const usernameFlag = ['--username', userstate.username];
  const broadcasterFlag = userstate.badges?.broadcaster !== undefined ? ['--broadcaster'] : [];
  const moderatorFlag = userstate.badges?.moderator !== undefined ? ['--moderator'] : [];
  console.log(broadcasterFlag, moderatorFlag);

  // Checks for Stream Guard Manager commands
  if (sgmCommands.some(command => message.startsWith(command))) {
    try {
      const command = parseArgsStringToArgv(message);
      cli.parse(process.argv.concat(command, channelFlag, usernameFlag));
    } catch (error) {
      if (error.code === 'commander.helpDisplayed') {
        return;
      }

      console.log(error.message);
      application.say(channel, error.message);
    }
    return;
  }

  // Checks for Stream Bot Manager commands
  if (sgbCommands.some(command => message.startsWith(command))) {
    try {
      const command = parseArgsStringToArgv(message);
      cli.parse(process.argv.concat(command, channelFlag, usernameFlag, broadcasterFlag, moderatorFlag));
    } catch (error) {
      if (error.code === 'commander.helpDisplayed') {
        return;
      }
      // console.log(error.message);
      application.say(channel, error.message);
    }
    return;
  }

  if (message.startsWith('!') === true) {
    return;
  }

  try {
    console.log(message);
    const channelBot = manager.getChannel(channel);
    channelBot.logMessage(message);

    const response = await channelBot.respond(message);
    application.say(channel, (response !== '') ? `@${userstate.username} ${response}` : '');
  } catch (error) {
    console.log(error.message);
  }
}

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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data
  });

  const token = await response.json();
  accessToken = token.access_token;
  refreshToken = token.refresh_token;
}

// Stream Guard Manager Commands
cli.command(joinChannelCommand)
  .description('Adds channel to Stream Guard Manager')
  .argument('<requestedChannel>', 'TODO')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .action((requestedChannel, options) => {
    if (options.channel !== process.env.STREAM_GUARD_USERNAME) {
      return;
    }

    if (options.username !== requestedChannel) {
      return;
    }

    manager.addChannel(requestedChannel);
    application.join(requestedChannel);
    application.say(options.channel, `${requestedChannel} is now guarded!`);
  });

cli.command(leaveChannelCommand)
  .description('Removes channel from Stream Guard Manager')
  .argument('<requestedChannel>', 'TODO')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .action((requestedChannel, options) => {
    if (options.channel !== process.env.STREAM_GUARD_USERNAME && options.channel !== requestedChannel) {
      return;
    }
    if (options.username !== requestedChannel) {
      return;
    }

    application.say(options.channel, `Stream Guard Bot has left ${requestedChannel}'s chat`);
    application.part(requestedChannel);
    manager.removeChannel(requestedChannel);
  });

// Stream Guard Bot Commands
cli.command(listFAQCommand)
  .description('Lists all added question/answer pairs in FAQ')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .option('--broadcaster', 'TODO')
  .option('--moderator', 'TODO')
  .action((options) => {
    const bot = manager.getChannel(options.channel);
    const faq = bot.listFAQ();
    application.say(options.channel, faq);
  });

cli.command(addQACommand)
  .description('Adds question/answer pair to FAQ')
  .argument('<question>', 'TODO')
  .argument('<answer>', 'TODO')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .option('--broadcaster', 'TODO')
  .option('--moderator', 'TODO')
  .action((question, answer, options) => {
    if (options.broadcaster === false && options.moderator === false) {
      return;
    }

    const bot = manager.getChannel(options.channel);
    bot.addQA(question, answer);
    application.say(options.channel, `Added "${question} -> ${answer}" to FAQ`);
  });

cli.command(removeQACommand)
  .description('Removes question/answer pair to FAQ')
  .argument('<index>', 'TODO')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .option('--broadcaster', 'TODO')
  .option('--moderator', 'TODO')
  .action((index, options) => {
    if (options.broadcaster === false && options.moderator === false) {
      return;
    }

    const bot = manager.getChannel(options.channel);
    index = parseInt(index) - 1;
    bot.removeQA(index)
      .then(qa => { application.say(options.channel, `Removed "${qa}" from FAQ`); })
      .catch(error => {
        console.log(error.message);
        application.say(options.channel, error.message);
      });
  });

async function getStreams (): Promise<Array<{ channel: string, category: string }>> {
  const apiURL = 'https://api.twitch.tv/helix/streams';
  const queryParameters = new URLSearchParams({
    language: 'en',
    first: '100',
    after: ''
  });

  let streams: Array<{ channel: string, category: string }> = [];
  while (true) {
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
    break;
  }

  return streams;
}

async function joinChannels (): Promise<undefined> {
  console.log('Updating Channels');
  const streams = await getStreams();
  streams.forEach(stream => {
    manager.addChannel(stream.channel);
    application.join(stream.channel);

    const channelBot = manager.getChannel(stream.channel);
    channelBot.setCategory(stream.category);
  });
}
