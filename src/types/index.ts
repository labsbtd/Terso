export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  ruleId?: string;
  file?: string;
  line?: number;
  remediation?: string;
}

export interface ScanResult {
  findings: Finding[];
  summary?: {
    total: number;
    bySeverity?: Partial<Record<FindingSeverity, number>>;
  };
  completedAt: string;
}

export type ScanSource =
  | { type: "repository"; url: string; branch?: string; commit?: string }
  | { type: "archive"; url: string }
  | { type: "code"; content: string; filename?: string };

export type ScanStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled";

interface ScanBase {
  id: string;
  projectName: string;
  source: ScanSource;
  createdAt: string;
  updatedAt: string;
}

export type Scan =
  | (ScanBase & { status: "queued" | "running" })
  | (ScanBase & { status: "completed"; result: ScanResult })
  | (ScanBase & {
      status: "failed";
      error?: { code?: string; message: string };
    })
  | (ScanBase & { status: "cancelled" });

export interface CreateScanInput {
  projectName: string;
  source: ScanSource;
  metadata?: Record<string, string>;
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page?: number;
    pageSize?: number;
    total?: number;
    nextCursor?: string;
  };
}

export interface WaitForResultOptions {
  pollingIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface TersoApiErrorShape {
  error: { code?: string; message: string; details?: unknown };
  requestId?: string;
}

export interface TersoOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
  userAgentSuffix?: string;
  solana?: SolanaProofOptions;
}

export type SolanaCluster = "devnet" | "testnet" | "mainnet-beta" | "custom";

export interface SolanaProofOptions {
  cluster?: SolanaCluster;
  rpcUrl?: string;
  commitment?: "processed" | "confirmed" | "finalized";
}
