import { OpenAI } from 'langchain/llms/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from 'langchain/prompts';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { parseArgsStringToArgv } from 'string-argv';
import { createWriteStream } from 'fs';
import type { WriteStream } from 'fs';

export const addQACommand = '!addQA';
export const removeQACommand = '!removeQA';
export const listFAQCommand = '!listFAQ';
const notInFAQ = "The information isn't specified in the FAQ.";

const model = new OpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0,
  maxConcurrency: 100
});
const embeddings = new OpenAIEmbeddings({ maxConcurrency: 100 });
const qaTemplate = `As {channel}'s friendly AI Twitch assistant, your role is to respond to users. Remember, users are communicating with {channel}, not you. To answer their queries, refer to {channel}'s FAQ. Keep your responses concise, under 25 words, and respond in the 3rd person. If the answer is not provided in the FAQ, respond with "${notInFAQ}". Do not make up your response.
<< FAQ >>
{faq}

<< user >>
{question}`;
const prompt = PromptTemplate.fromTemplate(qaTemplate);

export class StreamGuardBot {

  private channel: string;
  private category: string;
  private qaChain: LLMChain;
  private vectorStore: FaissStore;
  public writeStream: WriteStream;

  constructor (channel) {
    this.channel = channel;
    this.writeStream = createWriteStream(`data/${this.channel}.tsv`, { flags: 'a' });
  }

  public async commandHandler (client, channel, userstate, message): Promise<void> {
    const args = parseArgsStringToArgv(message);
    if (
      userstate.badges?.broadcaster === undefined &&
      userstate.badges?.moderator === undefined &&
      !message.startsWith(listFAQCommand)
    ) {
      client.say(channel, "Insufficient permission, please add your channel then go to your own channel's chat to add or remove questions to your FAQ");
    }

    switch (args[0]) {
      case addQACommand: {
        const [, question, answer] = args;
        const response = await this.addQA(question, answer);
        client.say(channel, response);
        break;
      }
      case removeQACommand: {
        const [, index] = args;
        const response = this.removeQA(parseInt(index) + 1);
        client.say(channel, response);
        break;
      }
      case listFAQCommand: {
        client.say(channel, this.listFAQ());
        break;
      }
    }
  }

  public async addQA (question: string, answer: string): Promise<string> {
    if (this.vectorStore === undefined) {
      this.vectorStore = await FaissStore.fromDocuments([], embeddings);
      this.qaChain = new LLMChain({ llm: model, prompt: prompt, outputKey: 'answer' });
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

  public async listFAQ (): Promise<string> {
    console.log(`${this.channel} ${listFAQCommand}`);
    let faqs;
    faqs = Array.from(this.vectorStore.getDocstore()._docs.values());
    faqs = faqs.map((faq, index) => `${index + 1}) ${faq.pageContent}`);
    faqs = faqs.map(faq => faq.replace('\n', ' -> '));
    faqs = faqs.join(' | ');
    return faqs;
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
    const answer = (await this.qaChain.invoke({ channel: this.channel, faq: faq, question: question })).answer;

    console.log(`${this.channel} respond: ${question} -> ${answer}`);
    return (answer !== notInFAQ) ? answer : '';
  }

  public async setCategory (category: string): Promise<void> {
    this.category = category;
  }

  public logMessage (username: string, message: string): void {
    const timestamp = new Date().toISOString();
    const data = `${timestamp}\t${this.category}\t${username}\t${message}\n`;

    try {
      this.writeStream.write(data);
    } catch (error) {
      console.error(error);
    }
  }

}
