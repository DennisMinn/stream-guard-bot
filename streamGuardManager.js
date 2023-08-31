const StreamGuardBot = require('./streamGuardBot.js');
const joinChannelCommand = '!guard';
const leaveChannelCommand = '!discharge';
const addQACommand = '!addQA';
const removeQACommand = '!removeQA';
const listFAQCommand = '!listFAQ';


class StreamGuardManager {
  constructor(client) {
    this.channels = new Map();
    this.client = client
  }

  async commandHandler (channel, userstate, command, args) {
    if (command === '!dice'){
      const num = rollDice();
      return `You rolled a ${num}`;
    }

    // Stream Guard Manager Command Handler
    if ([addQACommand, removeQACommand, listFAQCommand].includes(command) && this.channels.has(channel)){
      return this.channels.get(channel).commandHandler(channel, userstate, command, args);
    }

    if (command === joinChannelCommand) {
      return this.addChannel(args[0]);
    }

    if (command === leaveChannelCommand) {
      return this.removeChannel(args[0]);
    }
  }

  async addChannel(requestedChannel){
    if (this.channels.has(requestedChannel))
      return;
    
    this.client.join(requestedChannel);
    this.channels.set(requestedChannel, new StreamGuardBot(requestedChannel));
    await this.channels.get(requestedChannel).initVectorStore();
    return `${requestedChannel} is now guarded!`;
  }

  removeChannel(requestedChannel){
    this.client.part(requestedChannel);
    this.channels.delete(requestedChannel);
    return `Stream Guard Bot has left ${requestedChannel}`;
  }
}

function rollDice () {
	const sides = 6;
	return Math.floor(Math.random() * sides) + 1;
}

module.exports = StreamGuardManager;
