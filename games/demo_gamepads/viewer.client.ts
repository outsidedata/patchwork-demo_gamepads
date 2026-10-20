// The viewer on the UI's `viewer` panel: what the player plugin reads of every gamepad, and the
// standard actions as the seat's own `player` row holds them, redrawn every frame. Every place, size
// and word is the `viewer` definition's in `assets/demo_gamepads.json`, in the panel's pixels
// from its top left; every look is a ui style in `main.scene.json`.
//   The title, and the status line: what was used last (`device()`) and how many gamepads are
//   connected.
//   The diagram (`diagram`): the gamepad that last had a key go down, else the first connected, drawn
//   by the browser's standard mapping as a controller: its triggers over the shoulders filling from
//   the bottom as far as each is pressed, its bumpers under them, and its body (`body`, a path) with
//   the sticks, d-pad, face and middle buttons laid out as the family lays them out (`layoutOf`,
//   `layouts`): the Xbox's left stick high and right stick low, the PlayStation's sticks low and level
//   with a touchpad between the shoulders. A gamepad of no known family is drawn as an Xbox one. Each
//   stick's cap stands as far across its well as the stick is pushed, the dead zone
//   (`world.player.deadzone`, or the player's own) a ring in the well, cap and rim lit while the stick
//   is pressed in. Bumpers, d-pad, touchpad and middle buttons light while held; the face buttons are
//   ringed in the family's colours (`colours`) at rest and filled with them while pressed, each
//   lettered (`faces`: A B X Y on an Xbox pad) or, on a family whose buttons bear marks (`marks`), its
//   mark drawn: the PlayStation's cross, circle, square and triangle. Its other words are the
//   family's (`labels`). With no gamepad connected it says so (`none`).
//   The raw buttons and axes (`raw`) of that gamepad as the browser reports them, before any dead
//   zone: a cell per button, its number and a bar filled by its value, lit while pressed; a bar per
//   axis, filled from the middle to its value, and the value.
//   Every gamepad connected (`pads`), one line each: its place, family, mapping and id.
//   The table (`table`): a line per standard action, in the scene's order: its label, its keyboard
//   and gamepad keys in words (a stick's or an axis's keys by their group, `names.groups`, a
//   button's by name), what the seat's `player` row holds of it (a stick's x and y in a box, an
//   axis's or a button's value as a bar), and how many times a button action has been pressed.
//   Held now (`held`): every key the player plugin holds, by name.
import type * as PIXI from 'pixi.js'
import type { Row } from '#engine/engine.ts'
import type { Plugins } from '#engine/browser.ts'
import { def } from '#plugins/loader/loader.sim.ts'
import { possessed, type Pad, type Shown } from '#plugins/player/player.plugin.ts'

type Spot = { button: number; at: [number, number]; radius: number; label: [number, number] }
const line = (form: string, fields: Record<string, string | number>) => form.replace(/\{(\w+)\}/g, (_, f: string) => String(fields[f]))
const isPad = (key: string) => key.startsWith('Pad')

export function setup() {}

export function tick(row: Row, plugins: Plugins) {
  const { ui, player, wire } = plugins
  const d = def(wire, row.kind)
  const P = d.panel as string
  const T = ui.PIXI as typeof PIXI
  const text = (key: string, style: string, at: number[], value: string, anchor: number[] = [0, 0]) => {
    const t = ui.show(P, key, () => new T.Text({ text: value, style: ui.style(style) })) as PIXI.Text
    t.text = value
    t.anchor.set(anchor[0], anchor[1])
    t.position.set(at[0], at[1])
    return t
  }

  const box = ui.panel(P).boundsArea
  ui.show(P, 'back', () => new T.Graphics().rect(0, 0, box.width, box.height).fill(ui.style('viewer.back')))
  const g = (ui.show(P, 'shapes', () => new T.Graphics()) as PIXI.Graphics).clear()
  const lit = ui.style('viewer.lit'), dim = ui.style('viewer.dim'), track = ui.style('viewer.track'), fill = ui.style('viewer.fill')
  const frame = ui.style('viewer.frame'), rule = ui.style('viewer.rule')

  const pads = player.pads() as Pad[]
  text('title', 'viewer.title', d.title.at, d.title.text, d.title.anchor)
  text('status', 'viewer.muted', d.status.at, line(d.status.line, { device: d.devices[player.device()], count: pads.length }), d.status.anchor)

  // ---------------------------------------------------------------- the diagram
  const D = d.diagram
  const [ox, oy] = D.at
  g.roundRect(ox, oy, D.size[0], D.size[1], D.radius).stroke(rule)
  const shown = pads.find(p => p.used) ?? pads[0]
  const family = shown?.family ?? 'xbox'
  if (!shown) text('none', 'viewer.muted', [ox + D.none.at[0], oy + D.none.at[1]], D.none.text, D.none.anchor)
  else {
    const b = (i: number) => shown.buttons[i] ?? { pressed: false, value: 0 }
    const label = (i: number) => d.labels[family][String(i)]
    text('heading', 'viewer.text', [ox + D.heading.at[0], oy + D.heading.at[1]],
      line(D.heading.line, { index: shown.index, family: d.devices[family], mapping: shown.mapping === 'standard' ? '' : D.heading.unmapped }), D.heading.anchor)
    const L = D.layouts[D.layoutOf[family]]
    const edge = ui.style('viewer.edge'), pressed = ui.style('viewer.pressed')
    // The triggers over the shoulders, filling from the bottom as far as each is pressed; the bumpers
    // under them.
    for (const t of D.triggers) {
      const [x, y] = [ox + t.at[0], oy + t.at[1]], [w, h] = t.size, v = b(t.button).value
      g.roundRect(x, y, w, h, t.radius).fill(track)
      if (v > 0) g.roundRect(x, y + h * (1 - v), w, h * v, Math.min(t.radius, (h * v) / 2)).fill(b(t.button).pressed ? lit : fill)
      g.roundRect(x, y, w, h, t.radius).stroke(edge)
      text(`trigger.${t.button}`, 'viewer.mark', [ox + t.label[0], oy + t.label[1]], label(t.button), [0.5, 0.5])
    }
    for (const s of D.bumpers) {
      const [x, y] = [ox + s.at[0], oy + s.at[1]], [w, h] = s.size
      g.roundRect(x, y, w, h, s.radius).fill(b(s.button).pressed ? lit : dim).roundRect(x, y, w, h, s.radius).stroke(edge)
      text(`bumper.${s.button}`, 'viewer.mark', [x + w / 2, y + h / 2], label(s.button), [0.5, 0.5])
    }
    // The body, its outline the definition's path, `M`ove, `L`ine and `C`urve, in the box's pixels.
    for (const [op, ...n] of D.body as [string, ...number[]][]) {
      const p = n.map((v, j) => v + (j % 2 ? oy : ox))
      if (op === 'M') g.moveTo(p[0], p[1])
      else if (op === 'L') g.lineTo(p[0], p[1])
      else g.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5])
    }
    g.closePath().fill(ui.style('viewer.body')).stroke(edge)
    // Each stick: a well, the dead zone a ring in it, and the cap pushed as far across the well as the
    // stick is across its range, lit and its rim lit while the stick is pressed in.
    const deadzone = player.settings().deadzone ?? 0
    for (const s of L.sticks) {
      const [x, y] = [ox + s.at[0], oy + s.at[1]], r = s.radius, down = b(s.button).pressed
      const ax = shown.axes[s.axes[0]] ?? 0, ay = shown.axes[s.axes[1]] ?? 0
      g.circle(x, y, r).fill(ui.style('viewer.well')).circle(x, y, r).stroke(down ? pressed : edge)
      g.circle(x, y, r * deadzone).stroke(ui.style('viewer.dead'))
      const [cx, cy] = [x + ax * (r - s.cap), y + ay * (r - s.cap)]
      g.circle(cx, cy, s.cap).fill(down ? lit : ui.style('viewer.cap')).circle(cx, cy, s.cap).stroke(ui.style('viewer.capedge'))
      text(`stick.${s.button}`, 'viewer.muted', [ox + s.label[0], oy + s.label[1]], label(s.button), [0.5, 0.5])
    }
    // The d-pad: its middle and an arm each way, up, down, left and right, each lit while held.
    const [dx, dy] = [ox + L.dpad.at[0], oy + L.dpad.at[1]], c = L.dpad.cell
    const ways = [[0, -1], [0, 1], [-1, 0], [1, 0]]
    g.rect(dx - c / 2, dy - c / 2, c, c).fill(dim)
    L.dpad.buttons.forEach((i: number, k: number) => {
      const [x, y] = [dx + ways[k][0] * c - c / 2, dy + ways[k][1] * c - c / 2]
      g.roundRect(x, y, c, c, L.dpad.radius).fill(b(i).pressed ? lit : dim)
    })
    // The face buttons in the family's colours (`colours`), bottom, right, left and top: ringed and
    // lettered in their colour at rest, filled with it and lettered dark while pressed.
    const [fx, fy] = [ox + L.face.at[0], oy + L.face.at[1]], spread = L.face.spread
    const spots = [[0, 1], [1, 0], [-1, 0], [0, -1]]
    const ink = ui.style('viewer.ink').color, m = D.mark
    L.face.buttons.forEach((i: number, k: number) => {
      const [x, y] = [fx + spots[k][0] * spread, fy + spots[k][1] * spread], colour = { color: D.colours[family][k] }
      const down = b(i).pressed, line = { color: down ? ink : colour.color, width: D.rim }
      if (down) g.circle(x, y, L.face.radius).fill(colour)
      else g.circle(x, y, L.face.radius).fill(dim).circle(x, y, L.face.radius).stroke({ ...colour, width: D.rim })
      // A family whose buttons bear marks, not letters (`marks`), has each drawn `mark` pixels out from the middle.
      const mark = D.marks[family]?.[k]
      if (mark === 'cross') g.moveTo(x - m, y - m).lineTo(x + m, y + m).moveTo(x + m, y - m).lineTo(x - m, y + m).stroke(line)
      else if (mark === 'circle') g.circle(x, y, m).stroke(line)
      else if (mark === 'square') g.rect(x - m, y - m, 2 * m, 2 * m).stroke(line)
      else if (mark === 'triangle') g.poly((D.triangle as number[]).map((v, j) => (j % 2 ? y : x) + v * m)).stroke(line)
      else text(`face.${i}`, 'viewer.mark', [x, y], d.faces[family][k], [0.5, 0.5]).style.fill = down ? ink : colour.color
    })
    if (L.touchpad) {
      const t = L.touchpad, [x, y] = [ox + t.at[0], oy + t.at[1]]
      g.roundRect(x, y, t.size[0], t.size[1], t.radius).fill(b(t.button).pressed ? lit : dim).roundRect(x, y, t.size[0], t.size[1], t.radius).stroke(edge)
      text('touchpad', 'viewer.muted', [ox + t.label[0], oy + t.label[1]], t.text, [0.5, 0.5])
    }
    for (const m of L.middle as Spot[]) {
      g.circle(ox + m.at[0], oy + m.at[1], m.radius).fill(b(m.button).pressed ? lit : dim)
      text(`middle.${m.button}`, 'viewer.muted', [ox + m.label[0], oy + m.label[1]], label(m.button), [0.5, 0.5])
    }

    // ---------------------------------------------------------------- raw
    const R = d.raw
    const [rx, ry] = R.at
    text('raw.heading', 'viewer.header', [rx, ry], line(R.heading.line, { mapping: R.mappings[shown.mapping] ?? R.mappings[''] }))
    // A cell per button, as wide as `cells.size` gives, narrower where more buttons than that fit in
    // the raw `width`.
    const C = R.cells
    const cw = Math.min(C.size[0], (R.width + C.gap) / shown.buttons.length - C.gap)
    shown.buttons.forEach((btn, i) => {
      const [x, y] = [rx + i * (cw + C.gap), ry + C.drop]
      g.rect(x, y, cw, C.size[1]).fill(dim)
      if (btn.pressed) g.rect(x, y, cw, C.size[1]).stroke(pressed)
      const [inset, by, bh] = C.bar, bw = cw - 2 * inset
      g.rect(x + inset, y + by, bw, bh).fill(track)
      if (btn.value > 0) g.rect(x + inset, y + by + bh * (1 - btn.value), bw, bh * btn.value).fill(btn.pressed ? lit : fill)
      text(`raw.button.${i}`, 'viewer.mono', [x + cw / 2, y + C.index], String(i), [0.5, 0.5])
    })
    const A = R.axes
    shown.axes.forEach((v, i) => {
      const [x, y] = [rx + i * (A.width + A.gap), ry + A.drop]
      const [bx, by, bw, bh] = A.bar, mid = x + bx + bw / 2
      g.rect(x + bx, y + by, bw, bh).fill(track)
      g.rect(Math.min(mid, mid + (v * bw) / 2), y + by, Math.abs((v * bw) / 2), bh).fill(fill)
      g.rect(mid - A.tick[0] / 2, y + by - A.tick[1], A.tick[0], bh + 2 * A.tick[1]).fill(frame)
      text(`raw.axis.${i}`, 'viewer.muted', [x, y], line(A.label, { n: i }))
      text(`raw.axis.${i}.value`, 'viewer.mono', [x + A.value[0], y + A.value[1]], v.toFixed(2), [1, 0])
    })
  }

  // ---------------------------------------------------------------- every gamepad connected
  pads.forEach((p, k) => {
    const id = p.id.length > d.pads.ids ? p.id.slice(0, d.pads.ids) + d.pads.cut : p.id
    text(`pad.${p.index}`, 'viewer.muted', [d.pads.at[0], d.pads.at[1] + k * d.pads.step],
      line(d.pads.line, { index: p.index, family: d.devices[p.family], mapping: d.pads.mappings[p.mapping] ?? d.pads.mappings[''], id }) + (p.used ? d.pads.used : ''))
  })

  // ---------------------------------------------------------------- the standard actions
  const Tb = d.table
  const [tx, ty] = Tb.at
  for (const [k, word] of Object.entries(Tb.headers as Record<string, string>)) {
    text(`header.${k}`, 'viewer.header', [tx + Tb.columns[k], ty], word, k === 'presses' ? [1, 0] : [0, 0])
  }
  const named = (key: string) => (isPad(key) ? d.names[family][key] ?? d.names.keys[key] ?? key : d.names.keys[key] ?? key.toUpperCase())
  const words = (a: Shown, pad: boolean) => {
    const keys = (a.keys as (string | string[])[]).flat().filter(k => isPad(k) === pad)
    const each = a.shape === 'button' ? keys.map(named) : keys.map(k => d.names.groups[k] ?? named(k))
    return [...new Set(each)].join(Tb.between)
  }
  const me = possessed(wire.rows)
  const inputs: Record<string, number | number[]> = me?.data.inputs ?? {}
  const presses: Record<string, number> = me?.data.presses ?? {}
  ;(player.actions() as Shown[]).forEach((a, i) => {
    const y = ty + Tb.first + i * Tb.step
    if (i > 0) g.rect(tx, y - Tb.rule, Tb.columns.presses, 1).fill(rule)
    text(`action.${a.name}`, 'viewer.text', [tx + Tb.columns.action, y], a.label)
    text(`keyboard.${a.name}`, 'viewer.muted', [tx + Tb.columns.keyboard, y], words(a, false))
    text(`pad.${a.name}.keys`, 'viewer.muted', [tx + Tb.columns.pad, y], words(a, true))
    const at = tx + Tb.columns.truth, v = inputs[a.name]
    const [bx, by, bw, bh] = Tb.bar
    let value: string
    if (a.shape === 'stick') {
      const [sx, sy] = (v as number[] | undefined) ?? [0, 0], s = Tb.box
      g.rect(at, y, s, s).fill(track).rect(at, y, s, s).stroke(frame)
      g.circle(at + s / 2 + (sx * s) / 2, y + s / 2 + (sy * s) / 2, Tb.dot).fill(ui.style('viewer.dot'))
      value = v === undefined ? Tb.rest : `${sx.toFixed(2)}, ${sy.toFixed(2)}`
    } else {
      const n = (v as number | undefined) ?? 0
      g.rect(at + bx, y + by, bw, bh).fill(track)
      if (a.shape === 'axis') g.rect(at + bx + bw / 2 + Math.min(0, (n * bw) / 2), y + by, Math.abs((n * bw) / 2), bh).fill(fill)
      else if (n > 0) g.rect(at + bx, y + by, bw * n, bh).fill(n >= 1 ? lit : fill)
      value = v === undefined ? Tb.rest : n.toFixed(2)
    }
    const off = a.shape === 'stick' ? Tb.stickValue : Tb.value
    text(`truth.${a.name}`, 'viewer.mono', [at + off[0], y + off[1]], value)
    text(`presses.${a.name}`, 'viewer.mono', [tx + Tb.columns.presses, y], a.shape === 'button' ? String(presses[a.name] ?? 0) : '', [1, 0])
  })

  // ---------------------------------------------------------------- held now
  const H = d.held
  text('held.heading', 'viewer.header', H.at, H.heading)
  // Each name's spaces kept from breaking, so the line wraps between names and never inside one.
  const held = (player.held() as string[]).map(k => named(k).replace(/ /g, ' '))
  text('held', 'viewer.held', [H.at[0], H.at[1] + H.drop], held.length ? held.join(H.between) : H.none)
}

export function remove() {}
