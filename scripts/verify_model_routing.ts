// scripts/verify_model_routing.ts
// Verifies runtime execution of selectedModel routing against local server endpoint

async function testModelRouting(modelName: string) {
  console.log(`\n======================================================`);
  console.log(`[TESTING MODEL ROUTING]: ${modelName}`);
  console.log(`======================================================`);

  const payload = {
    messages: [
      {
        role: 'user',
        content: '천마신교의 전령이 무림맹 산문 앞에 도착했다. 상황을 한 줄로 묘사하라.'
      }
    ],
    worldInfo: {
      worldName: '정통 무협',
      worldType: 'popular_genre',
      settingDescription: '천마신교와 무림맹이 대치하는 중원',
      toneStyle: '진중함',
      currentTime: { formattedTime: '성화 3년 계묘월' },
      chapters: { currentChapter: '서막: 전령의 내방' },
      dcHistory: [10, 12, 10]
    },
    character: {
      name: '단운하',
      stats: { strength: 14, agility: 16, constitution: 14, intelligence: 12, wisdom: 15, charisma: 10 },
      inventory: ['흑철검', '행전']
    },
    storyTurnCount: 1,
    userPrompt: '천마신교의 전령이 무림맹 산문 앞에 도착했다. 상황을 한 줄로 묘사하라.',
    selectedModel: modelName
  };

  const tStart = Date.now();
  try {
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const elapsed = Date.now() - tStart;
    console.log(`HTTP Status: ${res.status} (${res.statusText}) in ${elapsed}ms`);

    const json = await res.json();
    if (!res.ok) {
      console.log(`❌ Request Failed:`, json);
      return { modelName, success: false, error: json.error, status: res.status };
    }

    console.log(`✅ Request Succeeded!`);
    console.log(`Requested Model:`, json.requestedModel);
    console.log(`Actual Model Version:`, json.actualModelVersion);
    console.log(`Server Timings:`, json.serverTimings);
    console.log(`Output Snippet:`, (json.rawResponse || json.text || '').substring(0, 180) + '...');

    return {
      modelName,
      success: true,
      requestedModel: json.requestedModel,
      actualModelVersion: json.actualModelVersion,
      durationMs: elapsed
    };
  } catch (err: any) {
    console.error(`❌ Network/Execution Error:`, err.message);
    return { modelName, success: false, error: err.message };
  }
}

async function runAll() {
  console.log('--- STARTING AI MODEL ROUTING RUNTIME VERIFICATION ---');

  // Test 1: Official Default (gemini-3.7-flash)
  const res37 = await testModelRouting('gemini-3.7-flash');

  // Test 2: Dev Test (gemini-3.6-flash)
  const res36 = await testModelRouting('gemini-3.6-flash');

  // Test 3: Legacy / Experimental (gemini-2.5-flash)
  const res25 = await testModelRouting('gemini-2.5-flash');

  console.log('\n======================================================');
  console.log('--- FINAL RUNTIME VERIFICATION SUMMARY ---');
  console.log('======================================================');
  console.log('1. Gemini 3.7 Flash:', res37.success ? `SUCCESS (v: ${res37.actualModelVersion})` : `FAILED (${res37.error})`);
  console.log('2. Gemini 3.6 Flash:', res36.success ? `SUCCESS (v: ${res36.actualModelVersion})` : `FAILED (${res36.error})`);
  console.log('3. Gemini 2.5 Flash:', res25.success ? `SUCCESS (v: ${res25.actualModelVersion})` : `FAILED (${res25.error})`);
}

runAll();
