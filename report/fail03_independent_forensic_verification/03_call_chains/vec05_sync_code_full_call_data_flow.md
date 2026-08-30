# VEC-05 Complete Call & Data Flow Static Trace

## 1. Upstream Trigger & Entry Point
- **Client Trigger:** User opens `CloudSyncModal.tsx` in UI and clicks `"동기화 코드 생성"` button.
- **Frontend Caller:** `src/components/CloudSyncModal.tsx` line 75:
  ```typescript
  const handleCloudSave = async () => {
    // ...
    const res = await fetch('/api/cloud-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: currentSession })
    });
    const data = await res.json();
    if (data.code) {
      setSyncCode(data.code);
    }
  };
  ```
- **Network Request:** HTTP POST `/api/cloud-save` with JSON `{ payload: currentSession }`.

## 2. Server Routing & Function Invocation
- **Server Entry Point:** `server.ts` line 854:
  ```typescript
  app.post('/api/cloud-save', (req, res) => {
    try {
      const { payload } = req.body;
      if (!payload) {
        return res.status(400).json({ error: 'Missing session payload' });
      }

      const code = generate6DigitSyncCode(); // Line 862: Direct Caller
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
- **Target Function:** `server.ts` lines 46–54:
  ```typescript
  function generate6DigitSyncCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * chars.length); // Line 50: Target Symbol
      code += chars[idx];
    }
    return code;
  }
  ```

## 3. Data Flow & Propagation
1. `generate6DigitSyncCode()` executes `Math.random()` 6 times to pick characters from `chars` (base32 charset omitting confusing characters like 0/O/1/I).
2. Concatenates characters into a 6-character string `code` (e.g. `"W4K7P9"`).
3. Value `code` is passed to `cloudSessions.set(code, { ...payload, updatedAt: ... })`.
   - `cloudSessions` is a module-scoped JavaScript `Map<string, any>` instantiated at `server.ts` line 43.
4. Value `code` is returned in HTTP response JSON: `{ success: true, code: "W4K7P9" }`.
5. Frontend `CloudSyncModal.tsx` receives `data.code` and executes `setSyncCode(data.code)`.
6. Browser UI renders `code` in an `<input readOnly value={syncCode} />` element for the player to copy.

## 4. Downstream Consumers & Sinks
- **Consumer 1 (Server-Side):** `GET /api/cloud-load/:code` (`server.ts` line 875):
  ```typescript
  app.get('/api/cloud-load/:code', (req, res) => {
    const { code } = req.params;
    const session = cloudSessions.get(code.toUpperCase());
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    return res.json({ success: true, session });
  });
  ```
  The string is used purely as a lookup key in the in-memory map.
- **Consumer 2 (Client-Side UI):** Read-only text field in `CloudSyncModal.tsx` and clipboard API (`navigator.clipboard.writeText(syncCode)`).
- **Final Sink:**
  1. Key in server in-memory `Map`
  2. JSON string in HTTP Response
  3. DOM text content in browser

## 5. Exhaustive Search for Any Connection to Sovereign Engine
Let us trace every possible path from `generate6DigitSyncCode()` to Sovereign Engine components:
- Does `generate6DigitSyncCode()` or `code` pass into `src/engine/validator.ts` (`EngineValidator`)? **NO**.
- Does it pass into `src/engine/immigrationGate.ts` (`ImmigrationGate`)? **NO**.
- Does it pass into `src/engine/mutationBoundary.ts` (`validateLLM2MutationBoundary`)? **NO**.
- Does it pass into `src/engine/state.ts` (`SovereignEngine.submitProposal`)? **NO**.
- Does it affect `Draft → Validate → Commit`? **NO**.
- Does it modify `CanonicalState`, `stateVersion`, `history`, or `events`? **NO**.
- Does it grant any `authority`, `provenance`, or bypass any ACL check? **NO**.
- Does it influence gameplay RNG, dice rolls, difficulty class (DC), or gameplay decisions? **NO**.

## 6. Static Call Chain Summary
```
[User Click in CloudSyncModal.tsx]
   │
   ▼
[fetch('/api/cloud-save', POST)]
   │
   ▼
[Express app.post('/api/cloud-save') in server.ts:854]
   │
   ▼
[generate6DigitSyncCode() in server.ts:46]
   │
   ├──▶ [Math.random() in server.ts:50]
   │
   ▼
[6-char string 'code' returned]
   │
   ├──▶ [Stored as key in server cloudSessions Map]
   │
   └──▶ [Returned in HTTP JSON { success: true, code }]
           │
           ▼
        [Rendered in CloudSyncModal.tsx UI text box]
```
**Conclusion:** Complete static trace proves `generate6DigitSyncCode` is an auxiliary web-tier utility completely decoupled from the Sovereign Engine core.
