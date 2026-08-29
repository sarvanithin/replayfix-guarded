export const MAX_REPLAY_FILE_BYTES = 2 * 1024 * 1024;

/** Rejects oversized replay payloads before they are read or JSON-parsed. */
export function assertReplayFileSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_REPLAY_FILE_BYTES) {
    throw new RangeError(
      `Replay file must not exceed ${String(MAX_REPLAY_FILE_BYTES)} bytes`,
    );
  }
}
