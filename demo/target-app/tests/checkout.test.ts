import { describe, expect, it } from "vitest";

import { shouldSubmitCheckout } from "../src/checkout.js";

describe("shouldSubmitCheckout", () => {
  it("does not submit an empty cart", () => {
    expect(shouldSubmitCheckout({ itemCount: 0, pending: false })).toBe(false);
  });

  it("submits a non-empty cart", () => {
    expect(shouldSubmitCheckout({ itemCount: 2, pending: false })).toBe(true);
  });

  it("does not submit while checkout is pending", () => {
    expect(shouldSubmitCheckout({ itemCount: 2, pending: true })).toBe(false);
  });
});
