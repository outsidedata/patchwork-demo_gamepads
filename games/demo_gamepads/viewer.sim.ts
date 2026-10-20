// The viewer: one `actors` entry, whose browser half (`viewer.client.ts`) draws every gamepad the
// player plugin reads and the standard actions as the seat's `player` row holds them. It has no rule.
import type { Kind } from '#engine/engine.ts'

export const viewer: Kind = {}
