// The viewer on one page on the manager, as `index.html` makes it, with a stand-in gamepad the player
// plugin reads each frame and the page's listeners stubbed by type and phase. What it shows is read
// off the `viewer` panel by key; what the truth heard, off the seat's `player` row.
import { afterEach, expect, test, vi } from 'vitest'
import type * as PIXI from 'pixi.js'
import { boot, type Row, type Scene } from '#engine/engine.ts'
import { accept, link, load, manager, view } from '#addons/scenemanager/scenemanager.addon.ts'
import { loopback } from '#addons/loopback/loopback.addon.ts'
import { keyCode, possessed } from '#plugins/player/player.plugin.ts'
import { sim } from './demo_gamepads.sim.ts'
import file from './demo_gamepads.scene.json'
import defs from './assets/demo_gamepads.json'

const DT = file.prefabs.engine.dt
const here = new URL('./', import.meta.url).href
const V = defs.viewer
const { deadzone } = file.world.player

type On = { type: string; f: (e: unknown) => void; capture: boolean }
const listening: On[] = []
vi.stubGlobal('addEventListener', (type: string, f: (e: unknown) => void, o?: unknown) => { listening.push({ type, f, capture: o === true }) })
vi.stubGlobal('removeEventListener', (type: string, f: (e: unknown) => void, o?: unknown) => {
  const i = listening.findIndex(x => x.type === type && x.f === f && x.capture === (o === true))
  if (i >= 0) listening.splice(i, 1)
})
const key = (type: 'keydown' | 'keyup', k: string) => {
  const e = { code: keyCode(k), key: k, repeat: false, target: null, preventDefault() {} }
  for (const capture of [true, false]) for (const o of listening.filter(o => o.type === type && o.capture === capture)) o.f(e)
}

type Pad = { connected: boolean; id: string; mapping: string; buttons: { pressed: boolean; value: number }[]; axes: number[] }
const pads: (Pad | null)[] = []
vi.stubGlobal('navigator', { getGamepads: () => pads })
const plug = (id: string, mapping = 'standard'): Pad => {
  const p = { connected: true, id, mapping, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }
  pads.push(p)
  return p
}
const button = (p: Pad, i: number, value: number) => { p.buttons[i] = { pressed: value > 0, value } }
const out = (v: number) => Math.sign(v) * (deadzone + Math.abs(v) * (1 - deadzone))
afterEach(() => { pads.length = 0 })

const XBOX = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'
const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'

async function start() {
  const truth = boot(structuredClone(file) as Scene, sim)
  const room = (await load(truth, here)).get('main')!
  const p = view(link(loopback(accept(manager(truth)))), file as Scene, here, me => {
    me.plugins.ui.canvas = { addEventListener() {}, removeEventListener() {}, style: {}, width: 1280, height: 720, remove() {} }
  })
  const frames = async (k: number) => { for (let i = 0; i < k; i++) { truth.step(DT); await p.frame() } }
  await frames(3)
  const panel = () => p.client!.plugins.ui.panel(V.panel) as PIXI.Container
  const shown = (label: string) => panel().getChildByLabel(label) as PIXI.Text | null
  const said = (label: string) => shown(label)?.text
  const me = (): Row => room.rows.find(r => r.id === possessed(p.client!.rows)!.id)!
  return { truth, room, p, frames, shown, said, me }
}

test('with no gamepad the viewer says so and shows keyboard and mouse used, and every standard action with its keys in words', async () => {
  const g = await start()
  expect(g.said('title')).toBe(V.title.text)
  expect(g.said('status')).toBe('Last used: keyboard and mouse   ·   Gamepads connected: 0')
  expect(g.said('none')).toBe(V.diagram.none.text)
  expect(g.shown('heading')).toBeNull()
  expect(g.shown('raw.heading')).toBeNull()
  // One line per action in the scene's order, its keys by group or by name.
  for (const [name, a] of Object.entries(file.world.player.actions)) expect(g.said(`action.${name}`)).toBe(a.label)
  expect(g.said('keyboard.move')).toBe('Arrows / WASD')
  expect(g.said('pad.move.keys')).toBe('D-pad / Left stick')
  expect(g.said('keyboard.look')).toBe('IJKL')
  expect(g.said('pad.look.keys')).toBe('Right stick')
  expect(g.said('keyboard.confirm')).toBe('Enter / Space')
  expect(g.said('pad.confirm.keys')).toBe('A')
  expect(g.said('keyboard.primary')).toBe('Left mouse')
  expect(g.said('pad.primary.keys')).toBe('RT')
  expect(g.said('truth.move')).toBe(V.table.rest)
  expect(g.said('presses.confirm')).toBe('0')
  expect(g.said('presses.move')).toBe('')
  expect(g.said('held')).toBe(V.held.none)
})

test('an Xbox pad is drawn by its own words: its triggers, sticks and buttons read raw, the actions as the truth hears them, and what is held', async () => {
  const g = await start()
  const pad = plug(XBOX)
  await g.frames(1)
  button(pad, 7, 0.5)
  button(pad, 0, 1)
  pad.axes = [out(0.5), out(-1), 0.3, 0]
  await g.frames(2)
  expect(g.said('status')).toBe('Last used: Xbox gamepad   ·   Gamepads connected: 1')
  expect(g.said('heading')).toBe('Gamepad 0: Xbox gamepad')
  expect(['face.0', 'face.1', 'face.2', 'face.3'].map(g.said)).toEqual(V.faces.xbox)
  expect([g.said('trigger.6'), g.said('trigger.7'), g.said('bumper.4'), g.said('bumper.5'), g.said('stick.10'), g.said('stick.11')]).toEqual(['LT', 'RT', 'LB', 'RB', 'L3', 'R3'])
  // Raw: every button and axis as the browser gave it, before the dead zone.
  expect(g.said('raw.heading')).toBe('Raw buttons and axes, as the browser reports them (standard mapping)')
  expect(Array.from({ length: 17 }, (_, i) => g.said(`raw.button.${i}`))).toEqual(Array.from({ length: 17 }, (_, i) => String(i)))
  expect([0, 1, 2, 3].map(i => g.said(`raw.axis.${i}.value`))).toEqual([out(0.5), out(-1), 0.3, 0].map(v => v.toFixed(2)))
  // The truth heard the actions read analog: the trigger half way, the stick half right and full up.
  expect(g.me().data.inputs).toMatchObject({ primary: 0.5, confirm: 1, move: [0.5, -1], look: [0.18, 0] })
  expect(g.said('truth.primary')).toBe('0.50')
  expect(g.said('truth.move')).toBe('0.50, -1.00')
  expect(g.said('presses.confirm')).toBe('1')
  // Keys that went down in one read are in the order the read finds them: buttons by number, then the sticks.
  // Each name's spaces do not break, so the line wraps only between names.
  expect(g.said('held')).toBe(['A', 'RT', 'Left stick right', 'Left stick up', 'Right stick right'].map(n => n.replace(/ /g, ' ')).join(V.held.between))
  expect(g.said(`pad.0`)).toBe(`Gamepad 0  ·  Xbox gamepad  ·  standard  ·  ${XBOX.slice(0, V.pads.ids)}${V.pads.cut}${V.pads.used}`)
  // Let go: the truth hears it at rest, and nothing is held.
  button(pad, 7, 0)
  button(pad, 0, 0)
  pad.axes = [0, 0, 0, 0]
  await g.frames(2)
  expect(g.said('truth.primary')).toBe('0.00')
  expect(g.said('held')).toBe(V.held.none)
})

test('a PlayStation pad is drawn by its own words, the one used last is the one drawn, and a gamepad the browser does not map says so', async () => {
  const g = await start()
  const xbox = plug(XBOX), ps = plug(DUALSENSE), odd = plug('Generic USB Joystick (Vendor: 0079 Product: 0006)', '')
  await g.frames(1)
  button(ps, 0, 1)
  await g.frames(1)
  expect(g.said('heading')).toBe('Gamepad 1: PlayStation gamepad')
  // Its buttons bear marks, drawn as shapes, not letters.
  expect(V.diagram.marks.playstation).toEqual(['cross', 'circle', 'square', 'triangle'])
  expect(['face.0', 'face.1', 'face.2', 'face.3'].map(g.shown)).toEqual([null, null, null, null])
  expect(g.said('touchpad')).toBe(V.diagram.layouts.playstation.touchpad.text)
  expect(g.said('pad.confirm.keys')).toBe('Cross')
  expect(g.said('trigger.7')).toBe('R2')
  expect(g.said('status')).toBe('Last used: PlayStation gamepad   ·   Gamepads connected: 3')
  button(ps, 0, 0)
  button(odd, 2, 1)
  await g.frames(1)
  expect(g.said('heading')).toBe(`Gamepad 2: gamepad${V.diagram.heading.unmapped}`)
  expect(g.said('raw.heading')).toBe('Raw buttons and axes, as the browser reports them (no standard mapping)')
  expect(g.said('pad.2')).toContain('not mapped')
  // The keyboard last: the diagram keeps the pad last used, the status says keyboard and mouse.
  button(odd, 2, 0)
  key('keydown', ' ')
  await g.frames(1)
  expect(g.said('status')).toBe('Last used: keyboard and mouse   ·   Gamepads connected: 3')
  expect(g.said('held')).toBe('Space')
  expect(g.me().data.inputs.confirm).toBe(1)
  key('keyup', ' ')
  // Unplugged, a gamepad is gone from the list.
  xbox.connected = false
  ps.connected = false
  odd.connected = false
  await g.frames(1)
  expect(g.said('status')).toBe('Last used: keyboard and mouse   ·   Gamepads connected: 0')
  expect(g.said('none')).toBe(V.diagram.none.text)
  expect(g.shown('pad.0')).toBeNull()
})
