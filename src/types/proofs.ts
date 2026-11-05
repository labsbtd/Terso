import type { PublicKey, Signer, Transaction } from "@solana/web3.js";
import type { Finding, SolanaCluster } from "./index.js";

export interface WalletProofSigner {
  publicKey: PublicKey;
  signTransaction(transaction: Transaction): Promise<Transaction>;
}

export type ProofSigner = Signer | WalletProofSigner;

export interface CreateProofInput {
  finding: Finding;
  signer: ProofSigner;
}

export interface VerifyProofInput {
  finding: Finding;
  transactionSignature: string;
}

export interface SolanaProof {
  hash: string;
  transactionSignature: string;
  signer: string;
  cluster: SolanaCluster;
  slot: number;
}

export interface ProofVerification {
  verified: boolean;
  expectedHash: string;
  recordedHash?: string;
  transactionSignature: string;
  signer?: string;
  slot?: number;
}
