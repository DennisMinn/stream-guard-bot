import { parseArgsStringToArgv } from 'string-argv';
import { StreamGuardBot } from './streamGuardBot.js';

export const joinChannelCommand = '!guard';
export const leaveChannelCommand = '!discharge';

export class StreamGuardManager {

  public channels: Map<string, StreamGuardBot>;

  constructor () {
    this.channels = new Map();
  }

  public async commandHandler (client, channel, userstate, message): Promise<void> {
    const [command, requestedChannel] = parseArgsStringToArgv(message);

    switch (command) {
      case joinChannelCommand: {
        await this.addChannel(requestedChannel.toLowerCase());
        client.join(requestedChannel.toLowerCase());
        client.say(channel, `${requestedChannel} is now guarded!`);
        break;
      }
      case leaveChannelCommand: {
        await this.removeChannel(requestedChannel.toLowerCase());
        client.say(channel, `Stream Guard Bot has left ${requestedChannel}`);
        client.part(requestedChannel.toLowerCase());
        break;
      }
    }
  }

  async addChannel (requestedChannel: string): Promise<void> {
    console.log(`SGM add ${requestedChannel}`);
    if (this.channels.has(requestedChannel)) {
      return;
    }

    this.channels.set(requestedChannel, new StreamGuardBot(requestedChannel));
  }

  async removeChannel (requestedChannel: string): Promise<void> {
    console.log(`SGM remove ${requestedChannel}`);
    const channelBot = await this.getChannel(requestedChannel);
    channelBot.writeStream.end();
    this.channels.delete(requestedChannel);
  }

  async getChannel (requestedChannel: string): Promise<StreamGuardBot> {
    // console.log(`SGM get ${requestedChannel}`);
    if (!this.channels.has(requestedChannel)) {
      await this.addChannel(requestedChannel);
    }

    return this.channels.get(requestedChannel);
  }

}

export default StreamGuardManager;
