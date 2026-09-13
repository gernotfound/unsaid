# Render pipeline

1. Approve phrase + design brief.
2. Create queued render job with prompt version/product ID.
3. Worker calls image provider asynchronously.
4. Originals go to object storage.
5. Worker creates AVIF/WebP derivatives and metadata.
6. Human reviews front/back independently.
7. Approved immutable assets allow `ready` -> `published`.

Reliability: idempotency keys, exponential retry for transient failures, no automatic retry of editorial/policy rejection, provider request IDs for debugging, bounded worker concurrency.
