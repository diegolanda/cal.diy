import { describe, expect, it } from "vitest";
import { ENDPOINTS } from "./shared";

describe("tRPC endpoint registry", () => {
  it("routes Team procedures through the Teams API endpoint", () => {
    expect(ENDPOINTS).toContain("teams");
  });
});
