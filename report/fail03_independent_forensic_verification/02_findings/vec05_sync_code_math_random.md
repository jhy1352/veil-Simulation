# VEC-05 Forensic Finding Detail

## 1. Finding Specification
- **Finding ID:** `VEC-05`
- **Title:** Server-Side Non-CSPRNG Pseudorandom Generation in Sync Code (Constitution Article 21 Audit Finding)
- **Source File:** `/server.ts`
- **Line Range:** Lines 46–54
- **Symbol:** `generate6DigitSyncCode(): string`
- **Triggering Code:**
  ```typescript
  // Helper to generate 6-digit collision-resistant alphanumeric key (e.g. X9K2A7)
  function generate6DigitSyncCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      code += chars[idx];
    }
    return code;
  }
  ```

## 2. Triggering Mechanism in Runner
In `scripts/adversarial_runtime_break_runner.ts` lines 390–417:
```typescript
const serverPath = path.join(process.cwd(), 'server.ts');
const serverCode = fs.readFileSync(serverPath, 'utf8');

const usesMathRandom = serverCode.includes('generate6DigitSyncCode') &&
                       serverCode.includes('Math.random()');
```
The runner evaluates `usesMathRandom === true` and assigns `vulnerabilityStatus: 'BREAK_CONFIRMED'` under the rule of Constitution Article 21 regarding the literal string `Synchronization Code`.

## 3. Production Source Context
In `server.ts`:
- Line 43: `const cloudSessions = new Map<string, any>();` (In-memory KV fallback for cloud save sessions).
- Line 854–873:
  ```typescript
  // 2. API: /api/cloud-save (Generate 6-digit sync code)
  app.post('/api/cloud-save', (req, res) => {
    try {
      const { payload } = req.body;
      if (!payload) {
        return res.status(400).json({ error: 'Missing session payload' });
      }

      const code = generate6DigitSyncCode();
      cloudSessions.set(code, {
        ...payload,
        updatedAt: new Date().toISOString()
      });

      return res.json({ success: true, code });
    } catch (err: any) {
      console.error('Cloud Save Error:', err);
      return res.status(500).json({ error: err.message });
    }
  });
  ```
