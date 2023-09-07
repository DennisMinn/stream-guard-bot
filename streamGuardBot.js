const { OpenAI } = require('langchain/llms/openai');
const { LLMChain } = require('langchain/chains');
const { PromptTemplate } = require('langchain/prompts');
const { FaissStore } = require('langchain/vectorstores/faiss');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { fs } = require('fs');

const addQACommand = '!addQA';
const removeQACommand = '!removeQA';
const listFAQCommand = '!listFAQ';
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

class StreamGuardBot {
  constructor(channel) {
    this.channel = channel;
    this.qaChain = new LLMChain({ llm: model, prompt: prompt, outputKey: 'answer' });
  }

  async initVectorStore() {
    this.vectorStore = await FaissStore.fromDocuments([], embeddings);
  }

  async addQA(question, answer) {
    console.log(`${this.channel} ${addQACommand}: "${question} -> ${answer}"`);
    const qa = { pageContent: `${question}\n${answer}` };
    await this.vectorStore.addDocuments([qa]);
  }

  async removeQA(index) {
    if (!this.vectorStore._index || index < 0 || index >= this.vectorStore.index.ntotal()){
      throw RangeError(`Question index does not exist, call ${listFAQCommand} to see all question indices`)
    }

    const faqs = Array.from(this.vectorStore.getDocstore()._docs.values());
    const qa = faqs[index].pageContent.replace('\n', ' -> ');
    console.log(`${this.channel} ${removeQACommand}: "${qa}"`);

    faqs.splice(index, 1);
    this.vectorStore = await FaissStore.fromDocuments(faqs, embeddings);
    return qa;
  }

  listFAQ() {
    console.log(`${this.channel} ${listFAQCommand}`);
    let faqs;
    faqs = Array.from(this.vectorStore.getDocstore()._docs.values());
    faqs = faqs.map((faq, index) => `${index + 1}) ${faq.pageContent}`);
    faqs = faqs.map(faq => faq.replace('\n', ' -> '));
    faqs = faqs.join(' | ');
    return faqs
  }

	async respond(question) {
    console.log(`${this.channel} respond: ${question}`);
    if (!this.vectorStore._index){
      throw ReferenceError(`No questions have been added`);
    }

		const result = (await this.vectorStore.similaritySearchWithScore(question, 1))[0];
    const faq = result[0].pageContent;
    const l2Distance = result[1];

    if (l2Distance > 0.5) {
      console.log(`Not close enough distance: ${l2Distance}`)
      return '';
    }

    const answer = (await this.qaChain.invoke({ channel: this.channel, faq: faq, question: question })).answer
    return (answer !== notInFAQ) ? answer : '';
	}
}

module.exports = {
  StreamGuardBot,
  addQACommand,
  removeQACommand,
  listFAQCommand,
}
