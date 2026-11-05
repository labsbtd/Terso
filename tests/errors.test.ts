import { describe, expect, it } from "vitest";
import { TersoApiError } from "../src/index.js";

describe("errors", () => {
  it("serializes useful safe fields", () => {
    const error = new TersoApiError("bad request", 400, {
      code: "invalid",
      requestId: "req_1",
    });
    expect(error.toJSON()).toEqual({
      name: "TersoApiError",
      message: "bad request",
      code: "invalid",
      requestId: "req_1",
      statusCode: 400,
      details: undefined,
    });
  });
});
