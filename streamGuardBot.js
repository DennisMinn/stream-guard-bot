const { OpenAI } = require('langchain/llms/openai');
const { LLMChain } = require('langchain/chains');
const { PromptTemplate } = require('langchain/prompts');
const { FaissStore } = require('langchain/vectorstores/faiss');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { fs } = require('fs');

const addQACommand = '!addQA';
const removeQACommand = '!removeQA';
const listFAQCommand = '!listFAQ';

const model = new OpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0,
  maxConcurrency: 100
});
const embeddings = new OpenAIEmbeddings({ maxConcurrency: 100 });
const qaTemplate = `You are friendly AI assistant to {channel} meant to answer questions. According to the following FAQ what is the answer to the question?  Keep your responses under 25 words and respond in the 3rd person. If you don't know the answer or the question is unrelated to the FAQ, just say that you don't know, don't try to make up an answer. 

<< FAQ >>
{faq}

<< question >>
{question}`;
const prompt = PromptTemplate.fromTemplate(qaTemplate);

class StreamGuardBot {
  constructor(channel) {
    this.channel = channel;
    this.qaChain = new LLMChain({ llm: model, prompt: prompt, outputKey: 'answer'});
  }

  async initVectorStore() {
    this.vectorStore = await FaissStore.fromDocuments([], embeddings);
  }

  async commandHandler(channel, userstate, command, args) {
    if (command === listFAQCommand)
      return this.listFAQ();

    if (command === addQACommand)
      return this.addQA(args[0], args[1]);

    if (command == removeQACommand)
      return this.removeQA(args[0]);
  }

  async addQA(question, answer) {
    console.log(`${addQACommand} ${this.channel} ${question} -> ${answer}`);
    const qa = { pageContent: `${question}\n${answer}` };
    await this.vectorStore.addDocuments([qa]);
  }

  async removeQA(index) {
    console.log(`${removeQACommand} ${this.channel}`);
    let faqs = Array.from(this.vectorStore.getDocstore()._docs.values());
    faqs.splice(parseInt(index) - 1, 1);
    this.vectorStore = await FaissStore.fromDocuments(faqs, embeddings);
  }

  listFAQ() {
    console.log(`${listFAQCommand} ${this.channel}`);
    let faqs;
    faqs = Array.from(this.vectorStore.getDocstore()._docs.values());
    faqs = faqs.map((faq, index) => (`${index + 1}) ${faq.pageContent}`));
    faqs = faqs.join('|\n');
    return faqs
  }

	async respond(question) {
    if (this.vectorStore.index.ntotal() === 0) {
      return '';
    }

		const result = (await this.vectorStore.similaritySearchWithScore(question, 1))[0];
    const faq = result[0].pageContent;
    const l2Distance = result[1];

    if (l2Distance > 0.25) {
      return '';
    }

    const answer = (await this.qaChain.invoke({ channel: this.channel, faq: faq, question: question })).answer
    return (answer !== "I don't know") ? answer : '';
	}
}

module.exports = {
  StreamGuardBot,
  addQACommand,
  removeQACommand,
  listFAQCommand,
}
