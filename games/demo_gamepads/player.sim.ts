// The row one seat possesses: the controller in the player's hands, as the truth hears it. Nothing of
// it stands anywhere. `addons/player` spawns it when a connection takes a slot, writes the slot into
// `seat`, and sends it to every seat, the seat's own marked `mine`. Its fields:
//   inputs   each standard action the seat has sent, by name, as it last arrived: a stick's `[x, y]`,
//            an axis's or a button's value, each −1 to 1 (a button 0 to 1). An action never sent is
//            not in it, at rest.
//   presses  each button action, by name, the times it has gone from at rest to held.
// The standard actions are the scene's `world.player.actions` (`demo_gamepads.scene.json`), which
// `player.client.ts` binds, each sent through the one act:
//   input(name, x, y?)   `name` one of the scene's actions; `x` its value, and `y` the second of a
//            stick's. The values come from outside the program: a name the scene does not hold, or a
//            value that is not a finite number, changes nothing, and a value past −1 or 1 is kept to it.
import type { Kind } from '#engine/engine.ts'
import type { Action } from '#plugins/player/player.plugin.ts'

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const kept = (v: number) => Math.max(-1, Math.min(1, v))
// An action's shape by its keys (`plugins/player`, Actions): a list of keys is a button, four lists a
// stick, two an axis.
const shapeOf = (keys: Action['keys']) => (keys.every(k => typeof k === 'string') ? 'button' : keys.length === 4 ? 'stick' : 'axis')

export const player: Kind = {
  acts: {
    input(me, w, _seat, name: unknown, x: unknown, y: unknown) {
      const actions: Record<string, Action> = w.world.player.actions
      if (typeof name !== 'string' || !Object.hasOwn(actions, name) || !finite(x)) return
      const shape = shapeOf(actions[name].keys)
      if (shape === 'stick') {
        if (!finite(y)) return
        me.data.inputs = { ...me.data.inputs, [name]: [kept(x), kept(y)] }
        return
      }
      const v = kept(x)
      if (shape === 'button' && v > 0 && !(me.data.inputs[name] > 0)) me.data.presses = { ...me.data.presses, [name]: (me.data.presses[name] ?? 0) + 1 }
      me.data.inputs = { ...me.data.inputs, [name]: v }
    },
  },
}
