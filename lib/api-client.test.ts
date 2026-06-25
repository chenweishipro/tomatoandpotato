import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "./api-client";

const fetchMock = vi.fn();
global.fetch = fetchMock as any;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe("apiFetch", () => {
  it("prepends /tomato to relative URLs starting with /", async () => {
    await apiFetch("/api/foo");
    expect(fetchMock).toHaveBeenCalledWith("/tomato/api/foo", undefined);
  });

  it("prepends /tomato/ to relative URLs without leading slash", async () => {
    await apiFetch("api/foo");
    expect(fetchMock).toHaveBeenCalledWith("/tomato/api/foo", undefined);
  });

  it("does not prepend basePath to absolute URLs", async () => {
    await apiFetch("https://other.example.com/api/foo");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://other.example.com/api/foo",
      undefined
    );
  });

  it("passes through options when given", async () => {
    await apiFetch("/api/foo", { method: "POST", body: "x" });
    expect(fetchMock).toHaveBeenCalledWith("/tomato/api/foo", {
      method: "POST",
      body: "x",
    });
  });
});
