# Changelog

## 0.3.1

### Features & Improvements

- **Responses API**: Added OpenAI-compatible `/v1/responses` resource with streaming and text aggregation
- **Observability**: Automatic in-memory usage tracking (`client.usage`) recording latency, tokens, error rates, and request counts
- **Test coverage**: Unit tests added for Video generations and Realtime Responses resources (100% passing)
- **Documentation**: Full API reference in README per endpoint, corrected brand naming to RodiumAI

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
