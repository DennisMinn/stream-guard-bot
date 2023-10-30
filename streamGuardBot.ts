import OpenAI from 'openai';
import { OpenAI as LangChainOpenAI } from 'langchain/llms/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from 'langchain/prompts';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { parseArgsStringToArgv } from 'string-argv';
import type { client as Client, ChatUserstate } from 'tmi.js';

export const addQACommand = '!addQA';
export const removeQACommand = '!removeQA';
export const listFAQCommand = '!listFAQ';
export const setModerationLevelCommand = '!moderationLevel';
const notInFAQ = "The information isn't specified in the FAQ.";
const moderationLevelMessages = ['None', 'Delete Message', '10 Minute Timeout', 'Ban'];

const embeddings = new OpenAIEmbeddings({ maxConcurrency: 100 });

// Set up Question Answer model
const moderationModel = new OpenAI();
const qaModel = new LangChainOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0,
  maxConcurrency: 100
});
const qaTemplate = `As {channel}'s friendly AI Twitch assistant, your role is to respond to users. Remember, users are communicating with {channel}, not you. To answer their queries, refer to {channel}'s FAQ. Keep your responses concise, under 25 words, and respond in the 3rd person. If the answer is not provided in the FAQ, respond with "${notInFAQ}". Do not make up your response.
<< FAQ >>
{faq}

<< user >>
{question}`;
const qaPrompt = PromptTemplate.fromTemplate(qaTemplate);


export class StreamGuardBot {

  readonly userId: string;
  readonly channel: string;
  readonly qaChain: LLMChain;
  public moderationLevel: number;
  public category: string;
  private vectorStore: FaissStore;

  constructor (userId: string, channel: string) {
    this.userId = userId;
    this.channel = channel;
    this.qaChain = new LLMChain({ llm: qaModel, prompt: qaPrompt });
    this.moderationLevel = 0;
  }

  public async commandHandler (client: InstanceType<typeof Client>, channel: string, userstate: ChatUserstate, message: string): Promise<void> {
    const args = parseArgsStringToArgv(message);
    const isBroadcaster = userstate.badges?.broadcaster !== undefined;
    const isModerator = userstate.badges?.moderator !== undefined;

    switch (args[0]) {
      case addQACommand: {
        const [, question, answer] = args;
        if (question === undefined) throw new SyntaxError('Question not specified');
        if (answer === undefined) throw new SyntaxError('Answer not specified');
        if (!isBroadcaster && !isModerator) throw new Error('Insufficent Permission, please call this command in your own channel');

        const response = await this.addQA(question, answer);
        client.say(channel, response);
        break;
      }
      case removeQACommand: {
        const [, index] = args;
        if (index === undefined) throw new SyntaxError('Index not specified');
        if (!isBroadcaster && !isModerator) throw new Error('Insufficent Permission, please call this command in your own channel');

        const response = await this.removeQA(parseInt(index) - 1);
        client.say(channel, response);
        break;
      }
      case listFAQCommand: {
        client.say(channel, this.listFAQ());
        break;
      }
      case setModerationLevelCommand: {
        const [, moderationLevel] = args;
        if (!isBroadcaster && !isModerator) throw new Error('Insufficent Permission, please call this command in your own channel');

        const response = this.setModerationLevel(Number(moderationLevel));
        client.say(channel, response);
      }
    }
  }

  public async addQA (question: string, answer: string): Promise<string> {
    if (this.vectorStore === undefined) {
      this.vectorStore = await FaissStore.fromDocuments([], embeddings);
    }

    console.log(`${this.channel} ${addQACommand}: "${question} -> ${answer}"`);
    const qa = { pageContent: `${question}\n${answer}`, metadata: {} };
    await this.vectorStore.addDocuments([qa]);
    return `Added "${question} -> ${answer}" to FAQ`;
  }

  public async removeQA (index: number): Promise<string> {
    if (
      this.vectorStore?._index === undefined ||
      index < 0 ||
      index >= this.vectorStore.index.ntotal()
    ) {
      return `Question index does not exist, call ${listFAQCommand} to see all question indices`;
    }

    const faqs = Array.from(this.vectorStore.getDocstore()._docs.values());
    const qa = faqs[index].pageContent.replace('\n', ' -> ');
    console.log(`${this.channel} ${removeQACommand}: "${qa}"`);

    faqs.splice(index, 1);
    this.vectorStore = await FaissStore.fromDocuments(faqs, embeddings);
    return `Removed "${qa}" from FAQ`;
  }

  public listFAQ (): string {
    let faqs;
    faqs = Array.from(this.vectorStore.getDocstore()._docs.values());
    faqs = faqs.map((faq, index) => `${index + 1}) ${faq.pageContent}`);
    faqs = faqs.map(faq => faq.replace('\n', ' -> '));
    faqs = faqs.join(' | ');
    return faqs;
  }

  public setModerationLevel (moderationLevel: number): string {
    if (isNaN(moderationLevel) || moderationLevel < 0 || moderationLevel >= moderationLevelMessages.length) {
      return `Invalid moderation level: ${moderationLevel}. Set moderation level between 0 and ${moderationLevelMessages.length - 1}`;
    }

    this.moderationLevel = moderationLevel;
    return `Current punishment for message violation: ${moderationLevelMessages[this.moderationLevel]}`;
  }

  public async respond (question: string): Promise<string> {
    if (this.vectorStore?._index === undefined) {
      return '';
    }

    const result = (await this.vectorStore.similaritySearchWithScore(question, 1))[0];
    const faq = result[0].pageContent;
    const l2Distance = result[1];

    if (l2Distance > 0.5) {
      console.log(`Not close enough distance: ${l2Distance}`);
      return '';
    }
    const answer = (await this.qaChain.invoke({ channel: this.channel, faq, question })).text;

    console.log(`${this.channel} respond: ${question} -> ${answer}`);
    return (answer !== notInFAQ) ? answer : '';
  }

  public async moderate (text: string): Promise<number> {
    if (this.moderationLevel === 0) {
      return 0;
    }

    const prompt = `{text: ${text}, channel: ${this.channel}, category: ${this.category}}`;
    const completion = await moderationModel.completions.create({
      model: 'ft:babbage-002:personal::8ELHpKGY',
      prompt,
      logprobs: 1,
      max_tokens: 1,
      temperature: 0
    });

    const probability = Math.exp(completion.choices[0].logprobs.token_logprobs[0]);
    console.log(probability);
    return (probability > 0.85) ? this.moderationLevel : 0;
  }

  public async setCategory (category: string): Promise<void> {
    this.category = category;
  }

}
