/** Pure scene selection helper. Wire to the EXISTING player's clock and completion. */
export type Phase = "jersey" | "message" | "done";
export function sceneAt(elapsedMs: number, hasMessage: boolean): Phase {
  if (!Number.isFinite(elapsedMs)) throw new Error("elapsedMs must be finite");
  const t = Math.max(0, elapsedMs);
  if (t < 7000) return "jersey";
  if (hasMessage && t < 12000) return "message";
  return "done";
}
// Caller computes elapsed using its authoritative monotonic clock.
// No DOM mutation, timers, loop or completion callbacks are owned by this helper.
// Determine hasMessage from normalized/trimmed content BEFORE playback starts.
