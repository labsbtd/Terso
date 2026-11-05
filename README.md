# @labsbtd/terso

  
  ![enter image description here](https://cyan-worried-mite-516.mypinata.cloud/ipfs/bafybeib4rhlx2nzhplnb6qgwndk45n2k7e6ag24ngjkyyi5ru7ercip6ri)
<p align="center">
  <img src="https://skillicons.dev/icons?i=ts,js,nodejs,npm,git,github,githubactions,eslint,prettier&theme=dark&perline=7" alt="Tech Stack" />
</p>

Production-oriented TypeScript client for submitting and monitoring security scans through the Terso API and anchoring privacy-preserving finding proofs on Solana. Version **1.1.4**. Sensitive finding details stay off-chain: only a deterministic SHA-256 hash is written to Solana.


## Installation

  

```sh

npm  i  @labsbtd/terso

```

  

Requires Node.js 18 or newer, or a modern bundler/runtime with standards-compatible `fetch`, `AbortController`, and Web APIs. TypeScript is optional for consumers. Both ESM and CommonJS entry points are included.

  

## Quick start

  

```ts

import { Terso } from "@labsbtd/terso";

const terso = new Terso({
  apiKey: process.env.TERSO_API_KEY!,
  baseUrl: process.env.TERSO_BASE_URL,
});

const scan = await terso.scans.create({
  projectName: "my-app",
  source: {
    type: "repository",
    url: "https://github.com/example/my-app",
    branch: "main",
  },
});

const result = await terso.scans.waitForResult(scan.id);

```

  

Use environment variables in your application (the SDK deliberately does not load `dotenv`):

  

```dotenv

TERSO_API_KEY=terso_your_api_key_here

TERSO_BASE_URL=https://api.terso.example/v1

```

  

Never expose an API key in browser bundles, source control, logs, URLs, or client-side storage. Prefer calling Terso from a trusted server. Direct browser usage may also be restricted by the API's CORS policy and cannot reliably set the `User-Agent` header; a server-side proxy is recommended.

  

## Configuration

  



`new Terso(options)` accepts the following configuration options:

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `apiKey` | `string` | **Required** | Bearer authentication credential. Never exposed in SDK-generated errors. |
| `baseUrl` | `string` | `https://api.terso.example/v1` | API base URL. Trailing slashes are automatically removed. |
| `timeoutMs` | `number` | `30000` | Timeout in milliseconds for each HTTP request attempt. |
| `maxRetries` | `number` | `2` | Maximum number of additional retry attempts for retryable failures. |
| `fetch` | `typeof globalThis.fetch` | Global `fetch` | Custom fetch implementation for testing or compatible runtimes. |
| `userAgentSuffix` | `string` | `none` | Optional application identifier appended to the SDK user agent. |
| `solana` | `SolanaProofOptions` | `devnet` | Solana cluster, RPC endpoint, and commitment configuration for proofs. |


  

## Privacy-preserving Solana proofs

  

Terso can hash a finding locally and record only that hash in a transaction using Solana's standard Memo program. The finding title, description, file, remediation, and other report data are **not** included in the transaction. Solana transactions are public and permanent, so the hash, signer address, transaction signature, time/slot, and the `terso:v1:` protocol marker are public.

  

```ts


import { Keypair } from "@solana/web3.js";
import { Terso, type Finding } from "@labsbtd/terso";

const terso = new Terso({
  apiKey: process.env.TERSO_API_KEY!,
  solana: {
    cluster: "devnet",
  },
});

const finding: Finding = {
  id: "finding_123",
  title: "SQL injection",
  description: "Private evidence retained by the report owner",
  severity: "high",
};

const proof = await terso.proofs.create({
  finding,
  signer: Keypair.generate(), // Use a securely loaded signer in production
});

const result = await terso.proofs.verify({
  finding,
  transactionSignature: proof.transactionSignature,
});

console.log(result.verified);


```

  

`proofs.hash(finding)` produces the same lowercase SHA-256 hex digest without making a network request. Objects are serialized with recursively sorted keys and omitted `undefined` properties, so property insertion order does not alter the proof. Changing any included value changes the hash.

  

`proofs.create(input)` accepts either a Solana `Signer` such as `Keypair` or a wallet adapter-shaped object with `publicKey` and `signTransaction`. The SDK never transmits or stores a private key. Wallet applications should approve the transaction visibly; server applications should load signing material through their own secret manager.

  

`proofs.verify(input)` fetches the referenced Solana transaction, finds the Terso Memo instruction, recomputes the finding hash locally, checks transaction success, and reports whether the values match. Verification does not prove that a finding is objectively correct; it proves that the supplied finding matches the content committed by that signer in that transaction.

  

Solana configuration accepts `cluster: "devnet" | "testnet" | "mainnet-beta" | "custom"`, an optional `rpcUrl`, and `commitment: "processed" | "confirmed" | "finalized"`. The default is Devnet with `confirmed` commitment. A custom cluster requires `rpcUrl`. Recording requires SOL for transaction fees; verification does not require a wallet.

  

## Scans

  

Create a scan from a repository, remotely hosted archive, or inline code:

  

```ts


await terso.scans.create({
  projectName: "service-api",
  source: {
    type: "archive",
    url: "https://downloads.example/service.tgz",
  },
  metadata: {
    environment: "staging",
  },
});

await terso.scans.create({
  projectName: "snippet",
  source: {
    type: "code",
    content: "const value = input;",
    filename: "index.ts",
  },
});


```

  

Retrieve, list, or cancel scans:

  

```ts

const  scan = await  terso.scans.get("scan_123");

const  page = await  terso.scans.list({ page:  1, pageSize:  25  });

const  cursorPage = await  terso.scans.list({ cursor:  "next_cursor"  });

const  cancelled = await  terso.scans.cancel("scan_123");

```

  

Wait for a terminal state (`completed`, `failed`, or `cancelled`):

  

```ts

const  result = await  terso.scans.waitForResult("scan_123", {
pollingIntervalMs:  2_000,
timeoutMs:  5  *  60_000,
});

```

  

Polling cleans up timers when it completes, times out, or is aborted. Abort both an in-flight request and subsequent polling delay with `AbortController`:

  

```ts

const  controller = new  AbortController();
setTimeout(() =>  controller.abort(), 10_000);

await  terso.scans.waitForResult("scan_123", { signal: controller.signal });

```

  

Check service health with `await terso.health.check()`, which resolves to `{ status, version? }`.

  

## Errors

  

All SDK errors extend `TersoError`:

  

```ts

import {
  TersoApiError,
  TersoAuthenticationError,
  TersoRateLimitError,
  TersoTimeoutError,
} from "@labsbtd/terso";

try {
  await terso.scans.get("scan_123");
} catch (error) {
  if (error instanceof TersoRateLimitError) {
    console.error(error.requestId, error.retryAfterMs);
  } else if (error instanceof TersoAuthenticationError) {
    console.error("Check server-side Terso credentials");
  } else if (error instanceof TersoApiError) {
    console.error(error.statusCode, error.code, error.requestId);
  } else if (error instanceof TersoTimeoutError) {
    console.error("The request or polling operation timed out");
  }
}

```

  

-  `TersoApiError` exposes `statusCode`, `code`, `requestId`, and optional `details`.

-  `TersoAuthenticationError` represents HTTP 401/403.

-  `TersoRateLimitError` represents HTTP 429 and exposes `retryAfterMs`.

-  `TersoTimeoutError`, `TersoNetworkError`, and `TersoValidationError` represent client-side timeout, connectivity, and input failures. Applicable errors expose the native `cause`.

  

## Retry and timeout behavior

  

The SDK retries network errors and HTTP 408, 429, 500, 502, 503, and 504 responses, up to `maxRetries`. It uses capped exponential backoff with jitter and honors numeric or HTTP-date `Retry-After` values. Authentication and ordinary validation/API failures are not retried. `timeoutMs` applies independently to each HTTP attempt; `waitForResult` has its own total timeout.

  

## API and types

  



| Export | Description |
|:-------|:------------|
| `Terso` | Main client exposing `scans` and `health` APIs. |
| `TersoOptions` | Client constructor configuration. |
| `CreateScanInput` | Scan input with project name, source, and optional metadata. |
| `ScanSource` | Source types: `repository`, `archive`, or `code`. |
| `Scan`, `ScanStatus` | Scan state and status. Completed scans include `result`. |
| `ScanResult` | Scan findings, optional summary, and completion timestamp. |
| `Finding`, `FindingSeverity` | Finding details and severity levels: `critical`, `high`, `medium`, `low`, `info`. |
| `PaginationInput`, `PaginatedResponse<T>` | Pagination request and response types. |
| `WaitForResultOptions` | Polling interval, timeout, and abort signal configuration. |
| `TersoApiErrorShape` | Structured API error response. |
| `HealthResponse` | Service health-check response. |
| `SolanaProofOptions`, `SolanaCluster` | Solana RPC, cluster, and commitment settings. |
| `CreateProofInput`, `VerifyProofInput` | Inputs for creating and verifying finding proofs. |
| `ProofSigner`, `WalletProofSigner` | Server-side and wallet-compatible signer types. |
| `SolanaProof`, `ProofVerification` | On-chain proof receipt and verification result. |
| `VERSION` | Current SDK version (`1.1.4`). |

  

Public methods are `scans.create(input)`, `scans.get(scanId)`, `scans.list(options?)`, `scans.cancel(scanId)`, `scans.waitForResult(scanId, options?)`, `health.check()`, `proofs.hash(finding)`, `proofs.create(input)`, and `proofs.verify(input)`.

  

## Assumed REST contract

  

No authoritative production API contract was supplied. The transport therefore centralizes these documented assumptions so the base URL can be changed without changing resource code:

  



| Method | Endpoint | Description |
|:------:|:---------|:------------|
| `POST` | `/scans` | Create a new scan using `CreateScanInput`. Returns `Scan`. |
| `GET` | `/scans/{encodedScanId}` | Retrieve a scan by its ID. Returns `Scan`. |
| `GET` | `/scans?page=&pageSize=&cursor=` | List scans with pagination. Returns `PaginatedResponse<Scan>`. |
| `POST` | `/scans/{encodedScanId}/cancel` | Cancel a scan and return the updated `Scan`. |
| `GET` | `/health` | Check service health. Returns `HealthResponse`. |


  

Requests use `Authorization: Bearer …`, JSON content negotiation, `X-Terso-SDK-Version`, and a user-agent. Successful empty bodies are supported by the transport, though current resource methods assume the response shapes above. Structured errors are assumed to be `{ error: { code?, message, details? }, requestId? }`; non-JSON errors receive a safe status-based fallback. Runtime response-schema validation is not performed because the actual schema is unknown.

  

## Development and publishing

  

```sh

npm  install
npm  run  typecheck
npm  test
npm  run  test:coverage
npm  run  lint
npm  run  format:check
npm  run  build
npm  run  validate:package
npm  pack

```

  

`prepublishOnly` runs full package validation. Inspect the tarball before publishing. Publishing is intentionally not performed by these commands except when you explicitly run `npm publish`.