import { StreamGuardBot } from './streamGuardBot.js';
import { parseArgsStringToArgv } from 'string-argv';

export const joinChannelCommand = '!guard';
export const leaveChannelCommand = '!discharge';

export class StreamGuardManager {
  private channels: Map<string, StreamGuardBot>;

  constructor () {
    this.channels = new Map();
  }

  addChannel (requestedChannel: string): void {
    console.log(`Join ${requestedChannel}`);
    if (this.channels.has(requestedChannel)) {
      return;
    }

    this.channels.set(requestedChannel, new StreamGuardBot(requestedChannel));
  }

  removeChannel (requestedChannel: string): void {
    console.log(`Part ${requestedChannel}`);
    this.channels.delete(requestedChannel);
  }

  getChannel (requestedChannel: string): StreamGuardBot {
    console.log(`Get ${requestedChannel}`);
    if (!this.channels.has(requestedChannel)) {
      throw new ReferenceError(
        `Channel is not guarded, have you called ${joinChannelCommand} <your_channel_name> first?`
      );
    }

    return this.channels.get(requestedChannel);
  }
}

export default StreamGuardManager;
