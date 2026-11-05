import { Terso } from "@labsbtd/terso";

const terso = new Terso({ apiKey: process.env.TERSO_API_KEY ?? "" });
const scan = await terso.scans.create({
  projectName: "my-app",
  source: { type: "repository", url: "https://github.com/example/my-app" },
});
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
console.log(
  await terso.scans.waitForResult(scan.id, {
    pollingIntervalMs: 2_000,
    timeoutMs: 300_000,
    signal: controller.signal,
  }),
);
