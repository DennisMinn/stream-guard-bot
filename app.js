const tmi = require('tmi.js');
const commander = require('commander');
const { parseArgsStringToArgv } = require('string-argv');
const sgm = require('./streamGuardManager.js');
const sgb = require('./streamGuardBot.js');
const StreamGuardManager = sgm.StreamGuardManager;

const sgmCommands = [
    sgm.joinChannelCommand,
    sgm.leaveChannelCommand,
]

const sgbCommands = [
    sgb.addQACommand,
    sgb.removeQACommand,
    sgb.listFAQCommand,
]


// Define configuration options
const opts = {
  identity: {
    username: process.env.STREAM_GUARD_USERNAME,
    password: `oauth:${process.env.STREAM_GUARD_OAUTH_TOKEN}`,
  },
  channels: [
    process.env.STREAM_GUARD_USERNAME
  ]
};

// Create a client with our options
const client = new tmi.client(opts);
const manager = new StreamGuardManager(client);
const cli = new commander.Command();

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// Stream Guard Manager Commands
cli.command(sgm.joinChannelCommand)
  .description('Adds channel to Stream Guard Manager')
  .argument('<requestedChannel>', 'TODO')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .action((requestedChannel, options) => {
    if (options.channel !== process.env.STREAM_GUARD_USERNAME)
      return;
    if (options.username !== requestedChannel)
      return;

    manager.addChannel(requestedChannel);
    client.join(requestedChannel);
    client.say(options.channel, `${requestedChannel} is now guarded!`);
  });

cli.command(sgm.leaveChannelCommand)
  .description('Removes channel from Stream Guard Manager')
  .argument('<requestedChannel>', 'TODO')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .action((requestedChannel, options) => {
    if (options.channel !== process.env.STREAM_GUARD_USERNAME && options.channel !== requestedChannel)
      return;
    if (options.username !== requestedChannel)
      return;

    client.say(options.channel, `Stream Guard Bot is leaving ${requestedChannel}'s chat`);
    client.part(requestedChannel);
    manager.removeChannel(requestedChannel);
  });

// Stream Guard Bot Commands
cli.command(sgb.listFAQCommand)
  .description('Lists all added question/answer pairs in FAQ')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .option('--broadcaster', 'TODO')
  .option('--moderator', 'TODO')
  .action((options) => {
    const bot = manager.getChannel(options.channel);
    const faq = bot.listFAQ();
    client.say(options.channel, faq);
  });

cli.command(sgb.addQACommand)
  .description('Adds question/answer pair to FAQ')
  .argument('<question>', 'TODO')
  .argument('<answer>', 'TODO')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .option('--broadcaster', 'TODO')
  .option('--moderator', 'TODO')
  .action((question, answer, options) => {
    if (!options.broadcaster && !options.moderator)
      return

    const bot = manager.getChannel(options.channel);
    bot.addQA(question, answer);
    client.say(options.channel, `Added "${question} -> ${answer}" to FAQ`);
  });

cli.command(sgb.removeQACommand)
  .description('Removes question/answer pair to FAQ')
  .argument('<index>', 'TODO')
  .option('--channel <channel>', 'TODO')
  .option('--username <username>', 'TODO')
  .option('--broadcaster', 'TODO')
  .option('--moderator', 'TODO')
  .action((index, options) => {
    if (!options.broadcaster && !options.moderator)
      return

    const bot = manager.getChannel(options.channel);
    index = parseInt(index) - 1;
    bot.removeQA(index)
      .then(qa => { client.say(options.channel, `Removed "${qa}" from FAQ`); })
      .catch(error => { console.log(error); });
  });

// Called every time a message comes in
async function onMessageHandler (channel, userstate, message, self) {
  if (self) { return; } // Ignore messages from the bot

  // Removes hash prefix
  channel = channel.substring(1);
  message = message.trim();

  if (message === '!dice'){
    const num = rollDice();
    client.say(channel, `You rolled a ${num}`);
    return;
  }

  // Checks for Stream Guard Manager commands
  if (sgmCommands.some(command => message.startsWith(command))) {
    command = parseArgsStringToArgv(message);
    const channelFlag = ['--channel', channel];
    const usernameFlag = ['--username', userstate.username];

    cli.parseAsync(process.argv.concat(command, channelFlag, usernameFlag));
    return;
  }

  // Checks for Stream Bot Manager commands
  if (sgbCommands.some(command => message.startsWith(command))) {
    command = parseArgsStringToArgv(message);
    const channelFlag = ['--channel', channel];
    const usernameFlag = ['--username', userstate.username];
    const broadcasterFlag = userstate.badges.broadcaster ? ['--broadcaster'] : [];
    const moderatorFlag = userstate.badges.moderator ? ['--moderator'] : [];

    cli.parseAsync(process.argv.concat(command, channelFlag, usernameFlag, broadcasterFlag, moderatorFlag));
    return;
  }

  if (message.startsWith('!'))
    return;

  const response = await manager.getChannel(channel).respond(message);
  client.say(channel, response);
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

function rollDice () {
    const sides = 6;
    return Math.floor(Math.random() * sides) + 1;
  }
