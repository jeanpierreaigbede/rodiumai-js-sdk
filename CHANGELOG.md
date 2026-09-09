# Changelog

## 0.3.1 (2026-08-31)

### Documentation

- README: full API reference per endpoint (chat/streaming, images, videos, audio, messages, embeddings, wallet/pricing)
- Examples for image-to-video, inpainting, multimodal chat, real-time SSE loops, function calling

## 0.3.0 (2026-08-31)

### Gateway alignment

- HTTP layer: binary responses, multipart uploads, Anthropic error parsing, Retry-After
- Flat API + fluent builder (parity with Laravel SDK v0.2)
- OpenAI nested API preserved (`client.chat.completions.create`, etc.)
- New resources: models, messages, wallet/pricing extensions
- Video generations implemented (was stub)
- Default model `openai/gpt-4o`; 402 code `insufficient_balance`
- Callable resources: `client.chat(...)`, `client.models(...)`, `client.embeddings(...)`

## 0.2.0

Initial npm release with chat, embeddings, images, audio nested API.
