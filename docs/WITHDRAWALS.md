# UNSAID — Legal withdrawal / online function

## Scope

The legal withdrawal declaration is a separate domain from the physical return/RMA workflow, refund execution and inventory restock.

```text
withdrawal notice
    |\
    | +--> one or more physical RMA records
    | +--> zero or more refund cases
    |
    +----> order/customer identity
```

Recording the declaration does **not** approve an RMA, calculate a refund, move money or restock inventory.

## Legal engineering baseline

For distance contracts concluded through an online interface, Article 54-bis of the Italian Consumer Code requires an online withdrawal function that is clearly identifiable, continuously available during the applicable withdrawal period and easily accessible. The online statement must let the consumer provide or confirm the consumer name, information identifying the contract and the electronic means used for the acknowledgement.

After the statement is completed, the interface must use a separate, explicit confirmation action. After confirmation, the trader must send an acknowledgement on a durable medium without undue delay, including the content of the statement and the date and time of submission. The online withdrawal is considered exercised within the applicable period when the consumer transmits the statement before the period expires.

This repository implements only the technical foundation. Final wording, placement, applicable periods, exceptions, return-cost rules and refund entitlements require the reviewed sales policy and qualified legal review before commerce is enabled.

Official references:

- Italian Legislative Decree 31 December 2025, no. 209, inserting Consumer Code Article 54-bis: https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=26G00002&atto.dataPubblicazioneGazzetta=2026-01-08
- Directive (EU) 2023/2673, including new Directive 2011/83/EU Article 11a: https://eur-lex.europa.eu/eli/dir/2023/2673/oj

## Storage

Declarations are stored server-side in:

```text
withdrawalNotices/withdrawal__{orderId}__{idempotencyKey}
```

A notice stores:

- immutable order/customer references;
- the order email snapshot;
- the consumer name provided/confirmed for the statement;
- whole-order or selected-line scope;
- immutable SKU/title/quantity snapshots identifying the goods;
- the exact generated statement text and statement version;
- `submissionMethod = online_withdrawal_function`;
- explicit confirmation evidence and server timestamp;
- the order status at submission for audit context only;
- acknowledgement channel/destination and deterministic outbox ID;
- optional links to one or more RMA IDs and refund-case IDs;
- created/updated/submitted timestamps.

There is deliberately no `approved`, `rejected` or RMA-style status on the withdrawal notice. The declaration is a recorded event, not an operational approval request.

## Intake and idempotency

`POST /api/account/withdrawals` is server-session protected, cross-origin protected and feature-gated.

The server:

1. verifies the authenticated customer owns the referenced order;
2. snapshots the identified order lines from authoritative order data;
3. requires an explicit confirmation signal from the second-step UI action;
4. generates the statement server-side;
5. records the statement and acknowledgement outbox record in the same Firestore transaction;
6. uses a deterministic ID from `orderId + idempotencyKey` so an identical retry returns the original notice;
7. rejects conflicting reuse of the same idempotency key.

The intake does **not** require `order.status = delivered` and does not wait for RMA approval. Operational or legal follow-up can assess the consequences separately without erasing or delaying the declaration record.

## Durable acknowledgement

The email outbox adds:

```text
withdrawal_acknowledgement
```

Its rendering payload includes:

- withdrawal notice ID;
- order ID;
- consumer name;
- exact statement content;
- server-side submission timestamp.

The outbox record is atomic with the withdrawal notice, but an outbox record is not proof of external delivery. The launch configuration must keep all three gates false until their prerequisites are complete:

```env
WITHDRAWAL_ENABLED=false
WITHDRAWAL_POLICY_READY=false
WITHDRAWAL_ACKNOWLEDGEMENT_READY=false
```

`WITHDRAWAL_ACKNOWLEDGEMENT_READY` must remain false until a real transactional email sender/retry path consumes the new outbox kind and delivery is tested. The current worker boundary contains the provider-neutral renderer only.

## Relationship with RMA

A withdrawal notice may be linked to one or more RMA records. The server verifies:

- same order;
- same customer;
- RMA SKU/quantities are covered by the withdrawal notice selection.

The RMA stores the linked `withdrawalNoticeId` as relationship metadata only. Its own lifecycle remains:

```text
requested -> approved/rejected -> in_transit -> received -> inspected -> closed
```

An RMA may also exist for a defective/wrong-item support path that is not a legal withdrawal. Do not infer that every RMA is a withdrawal.

## Relationship with refunds

A withdrawal notice may link to zero or more existing refund cases after the server verifies order/customer identity.

The withdrawal layer does not set refund amounts, execute Stripe actions or infer shipping reimbursement. Refund concurrency and money movement remain controlled by `refundCases`, `refundControls` and the Stripe refund adapter.

## Account export

Account export includes all customer withdrawal notices. The export path also uses dedicated unbounded customer-order and return queries rather than the dashboard's normal 50-order display limit, so older RMA records are not silently omitted solely because their order fell outside the UI window.

## UI still required

No compliant public withdrawal UI is enabled by this foundation. Before enabling the gates, build and review an interface that at minimum:

- exposes a clearly identifiable withdrawal function in the required period;
- lets the consumer provide/confirm name, contract identification and acknowledgement destination;
- has a distinct confirmation step/action;
- does not ask for a reason as a condition of exercising the withdrawal;
- presents a clear success state after the server has recorded the statement;
- preserves access while relevant withdrawal periods remain open, including operational scenarios where new sales are paused.

Do not repurpose the existing RMA request form as the legal withdrawal function.
