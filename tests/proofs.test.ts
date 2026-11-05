import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Terso, TersoValidationError, type Finding } from "../src/index.js";

const memoProgram = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);
const finding: Finding = {
  id: "finding_1",
  title: "SQL injection",
  description: "Sensitive evidence",
  severity: "high",
  file: "src/db.ts",
  line: 12,
};

afterEach(() => vi.restoreAllMocks());

describe("Solana proofs", () => {
  it("hashes findings canonically without exposing details", () => {
    const proofs = new Terso({ apiKey: "x" }).proofs;
    const reordered = {
      severity: "high",
      description: "Sensitive evidence",
      title: "SQL injection",
      id: "finding_1",
      line: 12,
      file: "src/db.ts",
    } as Finding;
    expect(proofs.hash(finding)).toBe(proofs.hash(reordered));
    expect(proofs.hash(finding)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records only a prefixed hash in a signed Memo transaction", async () => {
    const signer = Keypair.generate();
    let serialized: Buffer | undefined;
    vi.spyOn(Connection.prototype, "getLatestBlockhash").mockResolvedValue({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 42,
    });
    vi.spyOn(Connection.prototype, "sendRawTransaction").mockImplementation(
      (raw) => {
        serialized = Buffer.from(raw);
        return Promise.resolve("signature_1");
      },
    );
    vi.spyOn(Connection.prototype, "confirmTransaction").mockResolvedValue({
      context: { slot: 99 },
      value: { err: null },
    });
    const proof = await new Terso({
      apiKey: "x",
      solana: { cluster: "devnet" },
    }).proofs.create({ finding, signer });
    expect(proof).toMatchObject({
      transactionSignature: "signature_1",
      cluster: "devnet",
      slot: 99,
    });
    const transaction = Transaction.from(serialized!);
    const memo = Buffer.from(transaction.instructions[0]!.data).toString(
      "utf8",
    );
    expect(memo).toBe(`terso:v1:${proof.hash}`);
    expect(memo).not.toContain(finding.description);
  });

  it("verifies a matching on-chain memo and rejects changed findings", async () => {
    const payer = Keypair.generate();
    const proofs = new Terso({ apiKey: "x" }).proofs;
    const hash = proofs.hash(finding);
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: Keypair.generate().publicKey.toBase58(),
      instructions: [
        new TransactionInstruction({
          programId: memoProgram,
          keys: [],
          data: Buffer.from(`terso:v1:${hash}`),
        }),
      ],
    }).compileToV0Message();
    const transaction = new VersionedTransaction(message);
    const response = {
      slot: 7,
      transaction,
      meta: { err: null },
    } as unknown as NonNullable<
      Awaited<ReturnType<Connection["getTransaction"]>>
    >;
    vi.spyOn(Connection.prototype, "getTransaction").mockResolvedValue(
      response,
    );
    await expect(
      proofs.verify({ finding, transactionSignature: "signature_1" }),
    ).resolves.toMatchObject({ verified: true, recordedHash: hash, slot: 7 });
    await expect(
      proofs.verify({
        finding: { ...finding, line: 13 },
        transactionSignature: "signature_1",
      }),
    ).resolves.toMatchObject({ verified: false, recordedHash: hash });
  });

  it("validates custom cluster configuration", () => {
    expect(
      () => new Terso({ apiKey: "x", solana: { cluster: "custom" } }),
    ).toThrow(TersoValidationError);
  });
});
