const sgb = require('./streamGuardBot.js');
const StreamGuardBot = sgb.StreamGuardBot;
const joinChannelCommand = '!guard';
const leaveChannelCommand = '!discharge';


class StreamGuardManager {
  constructor() { this.channels = new Map(); }

  async addChannel(requestedChannel){
    console.log(`Join ${requestedChannel}`);
    if (this.channels.has(requestedChannel))
      return;
    
    this.channels.set(requestedChannel, new StreamGuardBot(requestedChannel));
    await this.channels.get(requestedChannel).initVectorStore();
  }

  removeChannel(requestedChannel){
    console.log(`Part ${requestedChannel}`);
    this.channels.delete(requestedChannel);
  }

  getChannel(requestedChannel){
    console.log(`Get ${requestedChannel}`);
    if (!this.channels.has(requestedChannel))
      return

    return this.channels.get(requestedChannel);
  }
}

module.exports = {
  StreamGuardManager,
  joinChannelCommand,
  leaveChannelCommand,
}
