const tmi = require('tmi.js');
const StreamGuardManager = require('./streamGuardManager.js');


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
const streamGuardManager = new StreamGuardManager();

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// Called every time a message comes in
async function onMessageHandler (channel, userstate, message, self) {
  if (self) { return; } // Ignore messages from the bot

  channel = channel.substring(1);
  message = message.trim();

  if (message.startsWith('!')) {
    const [command, ...args] = message.split(" ");

    if (command === '!guardChannel' && args[0].toLowerCase() === userstate.username){
      client.join(args[0].toLowerCase());
    } else if (command === '!dischargeChannel' && args[0].toLowerCase() === userstate.username){
      client.part(args[0].toLowerCase());
    }

    const response = await streamGuardManager.commandHandler(channel, userstate, command, args);
    console.log(response);
    if (response !== undefined)
      client.say(channel, response);
  }

}

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}
