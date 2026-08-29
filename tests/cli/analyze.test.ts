import { describe, expect, it } from "vitest";

import {
  assertReplayFileSize,
  MAX_REPLAY_FILE_BYTES,
} from "../../src/domain/replay-file.js";

describe("assertReplayFileSize", () => {
  it("accepts files up to the documented limit", () => {
    expect(() => {
      assertReplayFileSize(MAX_REPLAY_FILE_BYTES);
    }).not.toThrow();
  });

  it.each([-1, Number.NaN, MAX_REPLAY_FILE_BYTES + 1])(
    "rejects an invalid or oversized file before parsing: %s",
    (size) => {
      expect(() => {
        assertReplayFileSize(size);
      }).toThrow(RangeError);
    },
  );
});
