import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Signer,
} from "@solana/web3.js";
import { TersoError, TersoValidationError } from "../errors/index.js";
import type {
  CreateProofInput,
  ProofSigner,
  ProofVerification,
  SolanaProof,
  VerifyProofInput,
} from "../types/proofs.js";
import type { SolanaCluster, SolanaProofOptions } from "../types/index.js";
import { canonicalJson } from "../utils/canonical-json.js";
import { requireNonEmpty } from "../utils/validation.js";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);
const MEMO_PREFIX = "terso:v1:";

function isLocalSigner(signer: ProofSigner): signer is Signer {
  return "secretKey" in signer;
}

export class ProofsResource {
  private readonly connection: Connection;
  private readonly cluster: SolanaCluster;
  private readonly commitment: NonNullable<SolanaProofOptions["commitment"]>;

  constructor(options: SolanaProofOptions = {}) {
    this.cluster = options.cluster ?? "devnet";
    this.commitment = options.commitment ?? "confirmed";
    if (this.cluster === "custom" && !options.rpcUrl)
      throw new TersoValidationError(
        "solana.rpcUrl is required for the custom cluster",
      );
    const rpcUrl =
      options.rpcUrl ??
      clusterApiUrl(this.cluster === "custom" ? "devnet" : this.cluster);
    try {
      this.connection = new Connection(rpcUrl, this.commitment);
    } catch (error) {
      throw new TersoValidationError(
        "solana.rpcUrl must be a valid Solana RPC URL",
        { cause: error },
      );
    }
  }

  hash(finding: CreateProofInput["finding"]): string {
    if (!finding || typeof finding !== "object")
      throw new TersoValidationError("finding is required");
    return bytesToHex(sha256(new TextEncoder().encode(canonicalJson(finding))));
  }

  async create(input: CreateProofInput): Promise<SolanaProof> {
    if (!input?.signer) throw new TersoValidationError("signer is required");
    const hash = this.hash(input.finding);
    const signer = input.signer;
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash(this.commitment);
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: signer.publicKey,
    }).add(
      new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [{ pubkey: signer.publicKey, isSigner: true, isWritable: false }],
        data: Buffer.from(`${MEMO_PREFIX}${hash}`, "utf8"),
      }),
    );
    let signed: Transaction;
    if (isLocalSigner(signer)) {
      transaction.sign(signer);
      signed = transaction;
    } else {
      signed = await signer.signTransaction(transaction);
    }
    try {
      const transactionSignature = await this.connection.sendRawTransaction(
        signed.serialize(),
      );
      const confirmation = await this.connection.confirmTransaction(
        { signature: transactionSignature, blockhash, lastValidBlockHeight },
        this.commitment,
      );
      if (confirmation.value.err)
        throw new TersoError("Solana rejected the proof transaction", {
          code: "SOLANA_TRANSACTION_FAILED",
        });
      return {
        hash,
        transactionSignature,
        signer: signer.publicKey.toBase58(),
        cluster: this.cluster,
        slot: confirmation.context.slot,
      };
    } catch (error) {
      if (error instanceof TersoError) throw error;
      throw new TersoError("Unable to record the proof on Solana", {
        code: "SOLANA_PROOF_FAILED",
        cause: error,
      });
    }
  }

  async verify(input: VerifyProofInput): Promise<ProofVerification> {
    requireNonEmpty(input?.transactionSignature, "transactionSignature");
    const expectedHash = this.hash(input.finding);
    let response;
    try {
      response = await this.connection.getTransaction(
        input.transactionSignature,
        {
          commitment:
            this.commitment === "finalized" ? "finalized" : "confirmed",
          maxSupportedTransactionVersion: 0,
        },
      );
    } catch (error) {
      throw new TersoError("Unable to retrieve the Solana proof transaction", {
        code: "SOLANA_RPC_FAILED",
        cause: error,
      });
    }
    if (!response)
      return {
        verified: false,
        expectedHash,
        transactionSignature: input.transactionSignature,
      };
    const message = response.transaction.message;
    const keys = message.getAccountKeys().staticAccountKeys;
    const instruction = message.compiledInstructions.find(
      (candidate) =>
        keys[candidate.programIdIndex]?.equals(MEMO_PROGRAM_ID) === true,
    );
    const memo = instruction
      ? Buffer.from(instruction.data).toString("utf8")
      : undefined;
    const recordedHash = memo?.startsWith(MEMO_PREFIX)
      ? memo.slice(MEMO_PREFIX.length)
      : undefined;
    const signer = keys[0]?.toBase58();
    return {
      verified: recordedHash === expectedHash && response.meta?.err === null,
      expectedHash,
      ...(recordedHash ? { recordedHash } : {}),
      transactionSignature: input.transactionSignature,
      ...(signer ? { signer } : {}),
      slot: response.slot,
    };
  }
}
