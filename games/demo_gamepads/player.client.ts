// The seat's keys and gamepads, for the row that is `mine`: every standard action the scene names in
// `world.player.actions` bound by its shape (`plugins/player`, Actions), a stick's two values, an
// axis's or a button's one, each read analog, so a trigger or a stick sends how far it is pushed and
// a key all the way, in whole steps of `world.player.resolution`, and each sent as it changes through
// the row's one act, `input(name, …)`. The row draws nothing: the `viewer` draws it.
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { shapeOf, type Action, type Controls } from '#plugins/player/player.plugin.ts'

let ours = false

export function setup(row: Row, plugins: Plugins) {
  ours = row.data.mine === true
  if (!ours) return
  const actions: Record<string, Action> = plugins.wire.scene.world!.player.actions
  const table: Required<Pick<Controls, 'stick' | 'axis' | 'hold' | 'analog'>> = { stick: {}, axis: {}, hold: {}, analog: Object.keys(actions) }
  for (const [name, a] of Object.entries(actions)) {
    const shape = shapeOf(a.keys)
    if (shape === 'stick') table.stick[name] = (x, y) => ['input', name, x, y]
    else if (shape === 'axis') table.axis[name] = v => ['input', name, v]
    else table.hold[name] = v => ['input', name, v]
  }
  plugins.player.control(table satisfies Controls)
}

export function tick() {}

export function remove(plugins: Plugins) {
  if (ours) plugins.player.unbind()
}
