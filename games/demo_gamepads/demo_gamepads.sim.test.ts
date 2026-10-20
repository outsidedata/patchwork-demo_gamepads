// demo_gamepads: the manager booted as its page boots it and main loaded; a seat joins, its
// `player` row holds nothing yet, and `input` writes each standard action's value onto it as it
// arrives, counts a button's presses, and keeps a bad name or value out.
import { expect, test } from 'vitest'
import { boot, type Scene } from '#engine/engine.ts'
import { connection, load, manager, type Down } from '#addons/scenemanager/scenemanager.addon.ts'
import { possessed } from '#addons/player/player.addon.ts'
import { sim } from './demo_gamepads.sim.ts'
import file from './demo_gamepads.scene.json' with { type: 'json' }

const DT = file.prefabs.engine.dt
const actions = file.world.player.actions

test('input writes each standard action onto the seat\'s row as it arrives, counts a button\'s presses, and keeps a bad name or value out', async () => {
  const truth = boot(file as Scene, sim)
  const room = (await load(truth, import.meta.url)).get('main')!
  const heard: Down[] = []
  const seat = connection(manager(truth), d => heard.push(d))
  truth.step(DT)
  const last = heard[heard.length - 1]
  const me = possessed(last.packet.rows)!
  const row = () => room.rows.find(r => r.id === me.id)!
  expect(row().data).toMatchObject({ inputs: {}, presses: {} })
  let seq = 0
  // Sent on one step, taken on the next and not before.
  const send = (...args: unknown[]) => {
    seat.take({ scene: last.scene, seat: last.seat, msg: { seq: ++seq, n: room.n, id: me.id, action: 'input', args: args as any[] } })
  }
  expect(Object.keys(actions)).toContain('move')
  send('move', 0.5, -1)
  send('primary', 0.25)
  expect(row().data.inputs).toEqual({})
  truth.step(DT)
  expect(row().data.inputs).toEqual({ move: [0.5, -1], primary: 0.25 })
  expect(row().data.presses).toEqual({ primary: 1 })
  // Held on, a button counts no new press; let go and pressed again, it does.
  send('primary', 1)
  truth.step(DT)
  send('primary', 0)
  truth.step(DT)
  send('primary', 0.5)
  truth.step(DT)
  expect(row().data.presses).toEqual({ primary: 2 })
  // A value past 1 is kept to it; a name the scene does not hold, a value that is not a finite
  // number, or a stick sent one value, changes nothing.
  send('confirm', 3)
  send('look', -2, 0.5)
  truth.step(DT)
  expect(row().data.inputs).toMatchObject({ confirm: 1, look: [-1, 0.5] })
  const before = structuredClone(row().data)
  for (const bad of [['jump', 1], ['confirm', NaN], ['confirm', 'down'], ['move', 1], ['move', 1, Infinity], [7, 1], ['toString', 1]]) send(...bad)
  truth.step(DT)
  expect(row().data.inputs).toEqual(before.inputs)
  expect(row().data.presses).toEqual(before.presses)
})
