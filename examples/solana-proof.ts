import { Keypair } from "@solana/web3.js";
import { Terso, type Finding } from "@labsbtd/terso";

const terso = new Terso({
  apiKey: process.env.TERSO_API_KEY ?? "",
  solana: { cluster: "devnet" },
});

const finding: Finding = {
  id: "finding_123",
  title: "Example finding",
  description: "Sensitive details remain off-chain.",
  severity: "high",
};

// Load keys through your application's secure signer; never hard-code them.
const signer = Keypair.generate();
const proof = await terso.proofs.create({ finding, signer });
const verification = await terso.proofs.verify({
  finding,
  transactionSignature: proof.transactionSignature,
});

console.log(proof.hash, verification.verified);
