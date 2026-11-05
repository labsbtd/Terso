import { Terso } from "@labsbtd/terso";

const terso = new Terso({
  apiKey: process.env.TERSO_API_KEY ?? "",
  ...(process.env.TERSO_BASE_URL
    ? { baseUrl: process.env.TERSO_BASE_URL }
    : {}),
});
const scan = await terso.scans.create({
  projectName: "my-app",
  source: {
    type: "repository",
    url: "https://github.com/example/my-app",
    branch: "main",
  },
});
console.log(scan.id);
