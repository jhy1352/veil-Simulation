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

  const model = 'gemini-3.5-flash';
  console.log(`Testing model: ${model}...`);
  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: model,
        contents: 'Hello, please reply with just "OK".'
      }),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_10S')), 10000))
    ]);
    console.log(`Success with ${model}: ${response.text}`);
  } catch (err: any) {
    console.log(`Failed with ${model}: ${err.message}`);
  }
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
