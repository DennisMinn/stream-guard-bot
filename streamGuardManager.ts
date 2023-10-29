import { StreamGuardBot } from './streamGuardBot.js';
import type { client as Client, ChatUserstate } from 'tmi.js';

export const joinChannelCommand = '!guard';
export const leaveChannelCommand = '!discharge';

export class StreamGuardManager {

  public channels: Map<string, StreamGuardBot>;

  constructor () {
    this.channels = new Map();
  }

  public async commandHandler (client: InstanceType<typeof Client>, channel: string, userstate: ChatUserstate, message: string): Promise<void> {
    const username = userstate.username as string;
    const userId = userstate['user-id'] as string;

    switch (message) {
      case joinChannelCommand: {
        this.addChannel(userId, username);
        await client.say(channel, `${username} is now guarded!`);
        break;
      }
      case leaveChannelCommand: {
        this.removeChannel(username);
        await client.say(channel, `Stream Guard Bot has left ${username}`);
      }
    }
  }

  addChannel (userId: string, requestedChannel: string): void {
    console.log(`SGM add ${requestedChannel}`);
    if (this.channels.has(requestedChannel)) {
      return;
    }

    this.channels.set(requestedChannel, new StreamGuardBot(userId, requestedChannel));
  }

  removeChannel (requestedChannel: string): void {
    console.log(`SGM remove ${requestedChannel}`);
    this.channels.delete(requestedChannel);
  }

  getChannel (requestedChannel: string): StreamGuardBot {
    if (this.channels.get(requestedChannel) === undefined) {
      throw new SyntaxError('Channel not added');
    }

    return this.channels.get(requestedChannel);
  }

}

export default StreamGuardManager;
