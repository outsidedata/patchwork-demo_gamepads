// The kinds of main and the main.scene.json file next to this one: the seat's `player` row, the
// controller as the truth hears it, and the `viewer`, one `actors` entry whose look draws what the
// player plugin reads of every gamepad and what the row holds. Every number of them that never
// changes is its definition in `assets/demo_gamepads.json`, which the scene's `world.defs` names.
// The seat stands nowhere, so the scene has no `start`.
import type { Scene, Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'
import { loader } from '#plugins/loader/loader.sim.ts'
import { player } from './player.sim.ts'
import { viewer } from './viewer.sim.ts'
import file from './main.scene.json' with { type: 'json' }

export const sim: Sim = { scenemanager, loader, player, viewer }

export const scene = file as Scene
