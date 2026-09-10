import { GoogleGenAI } from '@google/genai';

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not defined!');
    process.exit(1);
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const models = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const m of models) {
    try {
      console.log(`Testing model: ${m}...`);
      const response = await ai.models.generateContent({
        model: m,
        contents: 'Hello, please reply with just one word.'
      });
      console.log(`Success with ${m}: ${response.text}`);
      process.exit(0);
    } catch (err: any) {
      console.log(`Failed with ${m}: ${err.message}`);
    }
  }
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
