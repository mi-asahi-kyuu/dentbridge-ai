import { describe, expect, it, vi } from "vitest";
import { createRandomId } from "./random-id";

describe("createRandomId", () => {
  it("uses randomUUID when the browser provides it", () => {
    const randomUUID = vi.fn(() => "3f6fda74-0651-49ce-8db7-b2a485755bbb");
    const getRandomValues = vi.fn((array: Uint8Array) => array);
    expect(createRandomId({ randomUUID, getRandomValues })).toBe(
      "3f6fda74-0651-49ce-8db7-b2a485755bbb",
    );
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("creates a valid v4 UUID when randomUUID is unavailable", () => {
    const getRandomValues = (array: Uint8Array) => {
      array.fill(0);
      return array;
    };
    expect(createRandomId({ getRandomValues })).toBe("00000000-0000-4000-8000-000000000000");
  });
});
