// The manager. One row, naming the game's scenes and the one every connection enters. Its scene file
// holds the standard actions every scene binds, `world.player.actions`.
import type { Sim } from '#engine/engine.ts'
import { scenemanager } from '#plugins/scenemanager/scenemanager.sim.ts'

export const sim: Sim = { scenemanager }
