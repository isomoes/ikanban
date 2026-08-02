import { describe, expect, it } from "vitest";
import { apiProxyTarget } from "./dev-proxy.js";

describe("apiProxyTarget", () => {
  it("uses the Pi web default port", () => {
    expect(apiProxyTarget({})).toBe("http://127.0.0.1:4098");
  });

  it("follows an explicit server port", () => {
    expect(apiProxyTarget({ PORT: "5100" })).toBe("http://127.0.0.1:5100");
  });
});
