const StreamGuardBot = require('./streamGuardBot.js');
const joinChannelCommand = '!guardChannel';
const leaveChannelCommand = '!dischargeChannel';
const addQACommand = '!addQA';
const removeQACommand = '!removeQA';
const listFAQCommand = '!listFAQ';


class StreamGuardManager {
  constructor() { this.channels = new Map(); }

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

  async addChannel(channel){
    channel = channel.toLowerCase();
    if (this.channels.has(channel)){
      return;
    }
    
    this.channels.set(channel, new StreamGuardBot(channel));
    await this.channels.get(channel).initVectorStore();
    return `${channel} is now guarded!`;
  }

  removeChannel(channel){
    this.channels.delete(channel.toLowerCase());
    return `Stream Guard Bot has left ${channel}`;
  }
}

function rollDice () {
	const sides = 6;
	return Math.floor(Math.random() * sides) + 1;
}

module.exports = StreamGuardManager;
