import type { HttpClient } from "../transport/http-client.js";

export interface HealthResponse {
  status: string;
  version?: string;
}
export class HealthResource {
  constructor(private readonly http: HttpClient) {}
  check(): Promise<HealthResponse> {
    return this.http.request("health");
  }
}
