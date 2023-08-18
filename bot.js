const tmi = require('tmi.js');

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

console.log(opts.identity);
// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// Called every time a message comes in
function onMessageHandler (channel, userstate, message, self) {
	if (self) { return; } // Ignore messages from the bot

	message = message.trim();
    if (message.startsWith('!')) {
        commandHandler(channel, message);
    }
}

function commandHandler (channel, message) {
    const [command, ...args] = message.split(" ");

    if (command === '!dice'){
		const num = rollDice();
		client.say(channel, `You rolled a ${num}`);
		console.log(`* Executed ${command} command`);
	} else {
		console.log(`* Unknown command ${command}`);
	}

}


// Function called when the "dice" command is issued
function rollDice () {
	const sides = 6;
	return Math.floor(Math.random() * sides) + 1;
}

// Called every time the bot connects to Twitch chat
function onConnectedHandler (addr, port) {
	console.log(`* Connected to ${addr}:${port}`);
}
