# RodiumAI JavaScript SDK

Official TypeScript/JavaScript SDK for the [Rodium AI](https://www.rodiumai.io) API — unified access to AI models (OpenAI, Anthropic, Google, DeepSeek…) with **RODI** credit billing and **Mobile Money** top-ups.

> **OpenAI-compatible** REST API: same endpoints and payloads as documented at [rodiumai.io/docs](https://www.rodiumai.io/docs).

[![npm version](https://img.shields.io/npm/v/rodiumai)](https://www.npmjs.com/package/rodiumai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://github.com/Docteur-Parfait/rodiumai-js-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Docteur-Parfait/rodiumai-js-sdk/actions)

## Links

| Resource | URL |
|----------|-----|
| **npm** | [npmjs.com/package/rodiumai](https://www.npmjs.com/package/rodiumai) |
| **Source code** | [github.com/Docteur-Parfait/rodiumai-js-sdk](https://github.com/Docteur-Parfait/rodiumai-js-sdk) |
| **JavaScript SDK guide** | [rodiumai.io/docs/guides/javascript-sdk](https://www.rodiumai.io/docs/guides/javascript-sdk) |
| **API documentation** | [rodiumai.io/docs](https://www.rodiumai.io/docs) |
| **Dashboard & API keys** | [rodiumai.io/dashboard](https://www.rodiumai.io/dashboard) |

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Three ways to call the API](#three-ways-to-call-the-api)
- [Quick start](#quick-start)
- [Chat completions](#chat-completions)
- [Streaming & real-time chat (SSE)](#streaming--real-time-chat-sse)
- [Models catalogue](#models-catalogue)
- [Embeddings](#embeddings)
- [Images (`POST /v1/images/generations`)](#images-post-v1imagesgenerations)
- [Videos (`POST /v1/videos/generations`)](#videos-post-v1videosgenerations)
- [Audio](#audio)
- [Anthropic Messages](#anthropic-messages)
- [Wallet & pricing](#wallet--pricing)
- [Error handling](#error-handling)
- [SDK reference](#sdk-reference)
- [OpenAI migration](#openai-migration)
- [Local development](#local-development)
- [Migration 0.2.x → 0.3.0](#migration-02x--030)
- [Testing](#testing)
- [License](#license)

## Requirements

- Node.js **18+** (or any runtime with `fetch` and `FormData`)
- Rodium AI account + API key (`rd_sk_…`): [dashboard](https://www.rodiumai.io/dashboard)

## Installation

```bash
npm install rodiumai
# or
pnpm add rodiumai
# or
yarn add rodiumai
```

## Configuration

Environment variables (recommended):

```bash
export RODIUMAI_API_KEY=rd_sk_your_secret_key
export RODIUMAI_BASE_URL=https://api.rodiumai.io/v1   # optional
export RODIUMAI_DEFAULT_MODEL=openai/gpt-4o          # optional
```

Constructor options:

```typescript
import { RodiumAI } from 'rodiumai';

const client = new RodiumAI({
  apiKey: 'rd_sk_...',              // or RODIUMAI_API_KEY env
  baseURL: 'https://api.rodiumai.io/v1',
  defaultModel: 'openai/gpt-4o',
  timeout: 30_000,                  // ms
  streamTimeout: 600_000,           // ms (streaming / long jobs)
  maxRetries: 3,
});
```

| Variable / option | Default | Description |
|-------------------|---------|-------------|
| `RODIUMAI_API_KEY` | — | Secret key from the dashboard |
| `RODIUMAI_BASE_URL` | `https://api.rodiumai.io/v1` | Gateway base URL (`http://localhost:8001/v1` for local dev) |
| `RODIUMAI_DEFAULT_MODEL` | `openai/gpt-4o` | Default model slug |
| `timeout` | `30000` | HTTP timeout in ms |
| `streamTimeout` | `600000` | Timeout for streams and long requests |

Never commit API keys or `.env` files.

## Three ways to call the API

| Style | When to use | Example |
|-------|-------------|---------|
| **Flat API** | Recommended — parity with Laravel SDK | `await client.chat('Hello')` |
| **Fluent builder** | Chain model / decoding options | `await client.model('openai/gpt-4o').temperature(0.7).chat('Hi')` |
| **OpenAI nested** | Drop-in for existing OpenAI code | `await client.chat.completions.create({ ... })` |

All three hit the same gateway endpoints.

## Quick start

```typescript
import { RodiumAI } from 'rodiumai';

const client = new RodiumAI();

// Flat API (recommended)
const response = await client.chat('Explain RODI credits in one sentence.');
console.log(response.choices[0].message.content);
console.log(response.cost_rodi);

// Fluent builder
const fluent = await client.model('openai/gpt-4o').temperature(0.7).chat('Hello!');
```

## Chat completions

`POST /v1/chat/completions` — OpenAI-compatible chat. All extra OpenAI fields are **pass-through** (`tools`, `response_format`, `seed`, …).

### Parameters

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `model` | yes | string | `openai/gpt-4o` | Catalogue slug or smart alias |
| `messages` | yes | array | — | `{role, content}` — string or multimodal blocks |
| `max_tokens` | no | integer | model max | Max output tokens |
| `temperature` | no | float | — | 0–2 |
| `top_p` | no | float | — | 0–1 |
| `stream` | no | boolean | `false` | Enable SSE |
| `stop` | no | string \| array | — | Stop sequences |
| `tools` | no | array | — | Function tools |
| `tool_choice` | no | string \| object | — | `auto`, `none`, `required` |
| `response_format` | no | object | — | JSON mode / JSON schema |
| `session_id` | no | string | — | Custom models memory |

### Basic usage

```typescript
const response = await client.chat('What is Rodium AI?');

const response2 = await client.chat(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain Laravel Service Providers.' },
  ],
  { max_tokens: 500, temperature: 0.5 },
);
```

### Multi-turn conversation

```typescript
const history: Array<{ role: string; content: string }> = [
  { role: 'user', content: 'My name is Amina.' },
  { role: 'assistant', content: 'Nice to meet you, Amina!' },
  { role: 'user', content: 'What is my name?' },
];
const response = await client.chat(history);
```

### Multimodal — vision

```typescript
import fs from 'node:fs';

const b64 = fs.readFileSync('invoice.png').toString('base64');

const response = await client.chat(
  [{
    role: 'user',
    content: [
      { type: 'text', text: 'Extract the total from this invoice.' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    ],
  }],
  { model: 'openai/gpt-4o' },
);
```

HTTP(S) URLs work in **chat** vision (not in image/video generation).

### Function calling

```typescript
const response = await client.chat(
  [{ role: 'user', content: "What's the weather in Lomé?" }],
  {
    tools: [{
      type: 'function',
      function: {
        name: 'get_weather',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      },
    }],
    tool_choice: 'auto',
  },
);
```

### Structured JSON

```typescript
const response = await client.chat('List 3 capitals as JSON.', {
  response_format: { type: 'json_object' },
});
```

### Smart routing

| Alias | Behavior |
|-------|----------|
| `rodiumai/smart` | LLM router + `routing` metadata |
| `rodium/fast`, `rodium/pro`, … | Rule-based profiles |

```typescript
const response = await client.model('rodiumai/smart').chat('Summarize RODI credits.');
console.log(response.routing, response.cost_rodi);
```

### OpenAI nested

```typescript
const response = await client.chat.completions.create({
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

---

## Streaming & real-time chat (SSE)

**No WebSocket** — real-time uses **SSE** (`stream: true`).

```typescript
for await (const delta of client.stream('Tell a short story about Lagos.')) {
  process.stdout.write(delta);
}
```

### Real-time chat loop (UI pattern)

```typescript
const history: Array<{ role: string; content: string }> = [];

async function ask(userText: string) {
  history.push({ role: 'user', content: userText });
  const parts: string[] = [];
  for await (const delta of client.stream(history, { model: 'openai/gpt-4o' })) {
    parts.push(delta);
    process.stdout.write(delta); // stream to UI
  }
  const assistant = parts.join('');
  history.push({ role: 'assistant', content: assistant });
  return assistant;
}

await ask('Bonjour!');
await ask('Rappelle-moi ma première question.');
```

### SSE format

```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: [DONE]
```

Use `streamTimeout: 600_000` (default) for long streams.

---

## Models catalogue

```typescript
const catalogue = await client.models();
const info = await client.modelInfo('openai/gpt-4o');
const coding = await client.codingModels();
```

Models include `rodiumai_pricing`, `rodiumai_capabilities` (modalities, streaming, tools, vision), and `rodiumai_kind` for smart aliases.

---

## Embeddings

`POST /v1/embeddings`

```typescript
const result = await client.embeddings('Hello world', { model: 'openai/text-embedding-3-small' });
const batch = await client.embeddings(['A', 'B'], { model: 'openai/text-embedding-3-small', dimensions: 768 });
```

---

## Images (`POST /v1/images/generations`)

| Parameter | Required | Notes |
|-----------|----------|-------|
| `model`, `prompt` | yes | |
| `n` | no | 1–10 (Imagen max 4) |
| `size` | no | `1024x1024`, `1536x1024`, … |
| `quality` | no | Affects RODI quote |
| `aspect_ratio` | no | Gemini native |
| `image`, `images` | no | i2i — up to 14 refs (Gemini) |
| `mask` | no | OpenAI inpainting |

**No remote HTTP fetch** for reference images — use base64, data URL, or `gs://` (Gemini).

### Text-to-image

```typescript
const image = await client.images({
  model: 'openai/gpt-image-1',
  prompt: 'A red fox in the snow',
  size: '1024x1024',
  quality: 'medium',
});
const b64 = image.data[0].b64_json;
```

### Image-to-image

```typescript
import fs from 'node:fs';

const ref = fs.readFileSync('product.png').toString('base64');

const image = await client.images({
  model: 'google/gemini-3.1-flash-image',
  prompt: 'Soft white studio background',
  image: { b64_json: ref, mime_type: 'image/png' },
});
```

### Inpainting

```typescript
const image = await client.images({
  model: 'openai/gpt-image-1',
  prompt: 'Replace sky with sunset',
  image: { b64_json: '<SOURCE>' },
  mask: { b64_json: '<MASK>' },
});
```

---

## Videos (`POST /v1/videos/generations`)

Always set `timeout: 600_000` — jobs can take minutes.

| Parameter | Required | Notes |
|-----------|----------|-------|
| `model`, `prompt` | yes | |
| `duration_seconds` | no | Default 8; Sora snaps to 4/8/12 |
| `aspect_ratio`, `size` | no | Sora layout |
| `image` | no | Start frame (image→video) |
| `last_frame` | no | End frame (Veo interpolation) |
| `resolution`, `resize_mode` | no | Veo only |

### Text-to-video

```typescript
const video = await client.videos({
  model: 'google/veo-3.1-generate-preview',
  prompt: 'Ocean waves at golden hour',
  duration_seconds: 8,
  timeout: 600_000,
});
```

### Image-to-video

```typescript
import fs from 'node:fs';

const frame = fs.readFileSync('storyboard.png').toString('base64');

const video = await client.videos({
  model: 'google/veo-3.1-generate-preview',
  prompt: 'Subtle pulse animation',
  duration_seconds: 8,
  image: { b64_json: frame, mime_type: 'image/png' },
  timeout: 600_000,
});
```

### Start + end frame (Veo)

```typescript
const video = await client.videos({
  model: 'google/veo-3.1-generate-preview',
  prompt: 'Smooth morph',
  image: { b64_json: '<START>' },
  last_frame: { b64_json: '<END>' },
  timeout: 600_000,
});
```

Response: `{ data: [{ url, b64_json, mime_type: 'video/mp4', duration_seconds }] }`.

---

## Audio

### Transcriptions — multipart

| Parameter | Required | Notes |
|-----------|----------|-------|
| `file` | yes | Path, Buffer, Blob, File |
| `model` | yes | |
| `language` | no | ISO-639-1 |
| `prompt` | no | Spelling/style hint |
| `response_format` | no | `json`, `text`, `verbose_json` |

```typescript
const transcript = await client.transcribe('recording.mp3', {
  model: 'google/gemini-2.5-flash',
  language: 'fr',
});
```

### Speech — binary response

| Parameter | Required | Notes |
|-----------|----------|-------|
| `model`, `input` | yes | |
| `voice` | no | OpenAI: alloy, echo, fable, onyx, nova, shimmer |
| `response_format` | no | mp3, opus, wav, pcm |
| `speed` | no | 0.25–4.0 |
| `instructions` | no | Style hint |

```typescript
import fs from 'node:fs';

const audio = await client.speech({
  model: 'openai/tts-1',
  input: 'Hello from RodiumAI',
  voice: 'nova',
  response_format: 'mp3',
});
fs.writeFileSync('speech.mp3', Buffer.from(audio));
```

---

## Anthropic Messages

`POST /v1/messages`

```typescript
const result = await client.messages({
  model: 'anthropic/claude-sonnet-4-6',
  max_tokens: 1024,
  system: 'You are concise.',
  messages: [{ role: 'user', content: 'Explain RODI credits.' }],
});
```

Streaming: pass `stream: true` — Anthropic SSE events (`content_block_delta`, …).

---

## Wallet & pricing

```typescript
const wallet = await client.wallet();
const allPricing = await client.pricing();
const oneModel = await client.pricing('openai/gpt-4o');
```

## Error handling

See [docs/api/errors](https://www.rodiumai.io/docs/api/errors).

| HTTP | Exception | `error_code` |
|------|-----------|--------------|
| 401 | `InvalidAPIKeyError` | `invalid_api_key` |
| 402 | `InsufficientRODIError` | `insufficient_balance` |
| 403 | `PermissionDeniedError` | `permission_denied` |
| 404 | `ModelNotFoundError` | `model_not_found` |
| 429 | `RateLimitError` | `rate_limit_exceeded` — use `retryAfter` |
| 500 | `InternalServerError` | `internal_error` |
| 503 | `ServiceUnavailableError` | `service_unavailable` |
| Timeout | `TimeoutError` | `timeout` |
| Network | `NetworkError` | `network_error` |

Both OpenAI-shaped and Anthropic-shaped error envelopes are parsed from the gateway.

```typescript
import { RodiumAI, InsufficientRODIError, RateLimitError } from 'rodiumai';

const client = new RodiumAI();

try {
  await client.chat('Test');
} catch (err) {
  if (err instanceof InsufficientRODIError) {
    console.error(err.errorCode, err.requestId);
  } else if (err instanceof RateLimitError) {
    await new Promise((r) => setTimeout(r, (err.retryAfter ?? 1) * 1000));
  }
}
```

## SDK reference

| Flat method | Nested equivalent | Gateway route |
|-------------|-------------------|---------------|
| `chat(messages, opts?)` | `chat.completions.create(...)` | `POST /v1/chat/completions` |
| `stream(messages, opts?)` | `chat.completions.create({ stream: true })` | `POST /v1/chat/completions` (SSE) |
| `models()` | `models.list()` | `GET /v1/models` |
| `modelInfo(id)` | `models.retrieve(id)` | `GET /v1/models/{id}` |
| `codingModels()` | `models.listCoding()` | `GET /v1/models/coding` |
| `embeddings(input, opts?)` | `embeddings.create(...)` | `POST /v1/embeddings` |
| `images(opts)` | `images.generate(...)` | `POST /v1/images/generations` |
| `videos(opts)` | `video.generations.create(...)` | `POST /v1/videos/generations` |
| `transcribe(file, opts?)` | `audio.transcriptions.create(...)` | `POST /v1/audio/transcriptions` |
| `speech(opts)` → `ArrayBuffer` | `audio.speech.create(...)` | `POST /v1/audio/speech` |
| `messages(opts)` | `messages.create(...)` | `POST /v1/messages` |
| `wallet()` | — | `GET /v1/wallet` |
| `pricing(opts?)` | — | `GET /v1/pricing` |

Fluent builder: `model()`, `temperature()`, `topP()`, `maxTokens()`, `systemPrompt()`.

Response extensions on `ChatCompletion`: `cost_rodi`, `routing`, `raw`.

Technical mapping: [docs/api-alignment.md](docs/api-alignment.md).

## OpenAI migration

```typescript
// Before (OpenAI)
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: 'sk-...' });

// After (RodiumAI) — nested API unchanged
import { RodiumAI } from 'rodiumai';
const client = new RodiumAI({ apiKey: 'rd_sk_...' });

const response = await client.chat.completions.create({
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

Or use the flat API: `await client.chat('Hello!')`.

## Local development

Point the SDK at a local gateway (e.g. Docker Compose on port 8001):

```bash
export RODIUMAI_BASE_URL=http://localhost:8001/v1
export RODIUMAI_API_KEY=rd_sk_dev_...
```

## Migration 0.2.x → 0.3.0

| Change | Action |
|--------|--------|
| Default model | `auto` → `openai/gpt-4o` (override via `RODIUMAI_DEFAULT_MODEL`) |
| Flat + fluent API | New recommended surface: `client.chat()`, `client.stream()`, … |
| Video | Implemented (`client.videos()`) — was stub in 0.2.x |
| 402 error code | `insufficient_rodi` → `insufficient_balance` |
| Speech | Returns binary `ArrayBuffer` (not JSON envelope) |
| New resources | `models`, `messages`, `wallet`, `pricing` |

Require `rodiumai@^0.3` in your dependencies.

## Testing

```bash
git clone https://github.com/Docteur-Parfait/rodiumai-js-sdk.git
cd rodiumai-js-sdk
npm ci

# Local CI (lint + typecheck + format + audit + unit tests) — same checks as GitHub Actions
npm run ci

# Full CI (+ integration tests + build)
npm run ci:full

# Or on Windows:
# pwsh scripts/ci.ps1
```

Individual checks: `npm run lint`, `npm run typecheck`, `npm run format`, `npm run audit`.

## License

MIT — see [LICENSE](LICENSE).
