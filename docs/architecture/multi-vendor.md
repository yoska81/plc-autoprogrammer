# Multi-vendor design (Siemens, Allen-Bradley, Schneider, Yaskawa, ifm … and CLICK)

Status: **design only** (Dev 2, October 2026). Nothing here is built yet except what the
"Today" column says. Statements about vendor tools that still need hands-on confirmation
are marked *(verify)*.

## 1. Goal

The user picks a vendor family (or lets the equipment chooser pick) and the app produces the
same deliverables it produces for CLICK today: equipment and BOM, I/O list, panel design and
drawings, HMI, PLC program that the vendor's own software can import, simulation, documents.

The guiding rule: **one vendor-neutral project model, vendor knowledge in profiles and
catalogs, vendor formats only at the edges (AI prompt facts, import/export files).**

## 2. What is CLICK-specific today

| Area | Where | CLICK / AutomationDirect assumption |
|---|---|---|
| Program model | `src/plc/core/ladder.ts` | Mostly neutral (contacts, coils, TMR/CNT/CMP/MATH/COPY, blocks). CLICK leaks in: addresses are physical memory (`X001`, `C1`, `DS1`, `TD1`, `CTD1`), timer/counter values live in separate registers, one rung = OR of AND branches |
| Profile | `src/plc/core/profile.ts`, `profiles/click.ts` | Interface is vendor-neutral (`autoAddresses`, `parseAddress`, `promptKnowledge`, `checkRung`). Only CLICK and a generic ST profile are implemented; Siemens/Yaskawa are "coming soon" placeholders |
| Checker | `src/plc/core/validate.ts` | Neutral, but assumes address kinds (input/output/bit/timer/counter/register) that fit a memory-mapped PLC |
| Simulator | `src/plc/sim/engine.ts` | CLICK scan semantics: `SC1/SC2/SC7`, `TD`/`CTD` registers, CLICK retentive defaults, 16-bit DS |
| HMI | `src/hmi/**` | C-more panels only; tag ranges C1001… / DS1001… are CLICK addresses; CLICK Ethernet driver |
| Equipment | `src/lib/ai/equipmentAI.ts`, `src/plc/core/fit.ts` | CLICK CPUs and modules, C-more HMIs |
| Electrical | `src/electrical/catalog.ts` | Verified AutomationDirect catalog only (good: every part number is real) |
| Export | `src/plc/core/clickExport.ts` | CLICK nickname CSV + rung listing (CLICK has no ladder import; rungs are entered from the listing) |
| AI prompt | `src/plc/ai/ladderAI.ts` | Neutral rules + `profile.promptKnowledge` (CLICK facts) + HMI tag rules that name CLICK ranges |

## 3. Target architecture

```
project (spec, I/O list, equipment choice)
   │
   ├── vendor-neutral program model  ──►  AI writes / fixes this
   │      tags with IEC data types, POUs (blocks), rungs (neutral ladder) or ST bodies
   │
   ├── PLC profile (per vendor family)
   │      addressing + I/O binding, instruction mapping, limits, prompt facts, checker rules,
   │      simulator semantics, exporter(s)
   │
   ├── catalogs (per vendor, verified part numbers)
   │      PLCs/IO, HMIs, drives, sensors/IO-Link, panel parts
   │
   └── exporters  ──►  vendor files (L5X, TIA Openness XML / SCL, PLCopen XML, CLICK CSV …)
```

### 3.1 Vendor-neutral program model (v2)

Evolve `LadderProgram` instead of replacing it, so CLICK keeps working at every step.

- **Tags, not addresses.** Every operand is a symbol (`Start_PB`, `Pusher_Timeout_SP`) with an
  IEC 61131-3 data type (`BOOL`, `INT`, `DINT`, `REAL`, `TIME`, `TON`, `CTU` …), scope
  (global / block-local), retentive flag, initial value, comment, and optional binding:
  physical I/O point id, HMI tag, or a fixed vendor address. The profile maps symbols to
  vendor addresses at export (CLICK: `C1`, `DS1001` …; Siemens: `%I0.0` / DB members;
  Logix: tag names, `Local:1:I.Data.0` aliases).
- **Function-block timers and counters.** `TON/TOF/RTO`, `CTU/CTD` instances with `.Q`,
  `.ET`/`.ACC`, `.PT`/`.PRE` members replace `T1` + `TD1`. CLICK's profile maps `Tmr.Q → T1`,
  `Tmr.ET → TD1`.
- **POUs = blocks.** Today's blocks become programs/routines (Logix routine, Siemens FB/FC,
  CODESYS POU). Block interfaces (bits passed between blocks) become explicit inputs/outputs —
  the simulator's "signals from other blocks" already computes them.
- **Rung bodies stay neutral ladder** (contacts, coils, set/reset, edge, compare, move, math,
  timer/counter calls). Mapping is mechanical: `NO→XIC`, `NC→XIO`, `OUT→OTE`, `SET/RST→OTL/OTU`
  (Logix); contact/coil/`S`/`R` (LAD, IEC); `MATH→CPT` (Logix) or an ST assignment.
- **ST bodies** for what ladder does badly (recipes, arrays, motion sequencing, comms).
  The generic ST profile already exists.
- **Sequences** as data (step number, step name, transition, timeout, actions) so the same
  sequence can be emitted as ladder step logic (CLICK, Logix) or a CASE statement (ST, SCL).
- The AI schema (`src/plc/core/schema.ts`) grows with the model; old CLICK programs load via
  a converter (address → symbol using the nickname table).

### 3.2 PLC profile interface (extensions)

Keep `PlcProfile` and add, per vendor family:

| Member | Purpose |
|---|---|
| `dataTypes`, `instructionSet` | What the target supports (e.g. CLICK: no REAL compare in contacts, 16-bit DS; Logix: DINT-native) — feeds the checker and the AI prompt |
| `bindIo(io, hardware)` | Physical address / tag alias per I/O point from the chosen CPU + modules |
| `mapSymbol(tag)` | Symbol → vendor operand at export and in listings |
| `limits` | Max rungs/blocks/timers, scan, memory — checker warnings |
| `simSemantics` | System bits (first scan, clocks), retentive defaults, integer widths for the simulator |
| `exporters[]` | `{ id, label, fileName, build(program, project) }` — one or more vendor files |
| `hmiDrivers` | Which HMI families/protocols talk to it, used by the HMI design and chooser |

### 3.3 Exporters per vendor

| Vendor / family | Software | Program exchange we would generate |
|---|---|---|
| AutomationDirect CLICK | CLICK Programming Software | Nickname CSV (import) + rung listing for manual entry — **today** |
| AutomationDirect Productivity / Do-more | Productivity Suite / Do-more Designer | Tag CSV import; ladder entry from listing *(verify import options)* |
| Siemens S7-1200 / S7-1500 | TIA Portal | SCL external source files (`.scl`, importable as external sources and compiled to blocks) + PLC tag table import; LAD/FBD/SCL blocks via **TIA Portal Openness** SimaticML XML for a fully generated project *(Openness needs the add-in/licence on the customer PC)* |
| Allen-Bradley CompactLogix / ControlLogix | Studio 5000 Logix Designer | **L5X** XML (program/routine/rung import; rungs as neutral text `XIC(Start)OTE(Run);`, tags with data types and aliases) |
| Allen-Bradley Micro800 | Connected Components Workbench | ST/ladder via CCW project exchange *(verify; import support is limited, fallback: ST text + tag CSV)* |
| Schneider M241/M251/M262 | EcoStruxure Machine Expert (CODESYS-based) | **PLCopen XML** (POUs, data types, global variables) |
| Schneider M221 | Machine Expert Basic | No PLCopen import *(verify)*; listing + symbol export only |
| Yaskawa iC9200 / MP3300iec | MotionWorks IEC | **PLCopen XML** + PLCopen motion function blocks for servo axes *(verify version support)* |
| Generic IEC 61131-3 | any CODESYS-family IDE | PLCopen XML + ST text — the cheapest "second vendor" |

PLCopen XML is the common denominator (Schneider, Yaskawa, any CODESYS target); L5X and
TIA Openness/SCL cover Allen-Bradley and Siemens.

### 3.4 Catalogs

Same rule as `src/electrical/catalog.ts` today: **only verified part numbers, a source URL per
entry, ratings from the manufacturer's data**. One file per vendor and category under
`src/catalog/<vendor>/` with a shared schema (`CatalogPart` with `vendor`, `category`,
`ratings`, `dimensions`, `url`, `verifiedAt`).

| Category | First vendors |
|---|---|
| PLC CPUs and I/O modules | AutomationDirect (have), Siemens S7-1200/1500 + ET 200SP, Allen-Bradley CompactLogix 5380 + 5069 I/O / Micro850, Schneider M241/M251, Yaskawa iC9200 |
| HMIs | C-more (have), Siemens Comfort/Unified Basic panels, Allen-Bradley PanelView 5000/800, Schneider Harmony HMIST6 |
| Drives | Yaskawa GA500 / GA800 (power, voltage, frame size, EtherNet/IP / PROFINET options), AutomationDirect GS20 (fits CLICK projects) |
| Sensors / IO-Link | ifm: photo-eyes, inductive prox, pressure, IO-Link masters (EtherNet/IP and PROFINET variants) — gives the I/O list real part numbers and IO-Link process data |
| Panel parts | AutomationDirect (have); later Phoenix Contact / Weidmüller terminals, Eaton / Schneider / ABB contactors and breakers per region |

### 3.5 Equipment chooser and electrical AI across vendors

- **Project setting "Vendor preference"**: `auto` (cheapest that fits), a single vendor family,
  or "customer standard" (a list of allowed vendors per category — common in plants:
  "Allen-Bradley PLC, Yaskawa drives, ifm sensors").
- The chooser (`equipmentAI.ts` + `fit.ts`) receives only the allowed catalogs, computes
  fit deterministically (I/O counts, spare %, comms) as today, and the AI explains the trade-off.
- **Compatibility rules** as data: PLC ↔ HMI drivers, PLC ↔ drive network (EtherNet/IP,
  PROFINET, Modbus TCP), IO-Link master ↔ fieldbus. The chooser refuses combinations that
  don't talk.
- The electrical AI picks panel parts only from the chosen region/vendor catalogs; drawings
  already take symbols and data from the catalog, so they follow automatically.
- HMI design: the tag ranges (`C1001…`) become **HMI tag roles** (command, setpoint, status
  word, alarm, status bit) that each profile maps to its own memory (Logix: UDT members,
  Siemens: an HMI DB). The ladder AI rules in `ladderAI.ts` are already written per role.

## 4. Migration steps (in order)

1. **Keep new code neutral** (now): new features in `src/plc/core`, `ai`, `sim` take a profile
   instead of hard-coding CLICK; CLICK facts stay in `core/profiles/click*.ts`.
2. **Generic IEC / PLCopen exporter** from today's model (ladder → ST translation per rung,
   tags from nicknames). Proves the exporter interface and gives Schneider/Yaskawa/CODESYS users
   something usable immediately.
3. **Model v2**: symbols + IEC data types + FB timers/counters; CLICK profile maps them back to
   CLICK memory; converter for saved projects; simulator reads `simSemantics` from the profile.
4. **HMI tag roles** instead of CLICK ranges; C-more stays the first HMI family.
5. **Allen-Bradley Logix profile + L5X exporter** (closest to CLICK ladder; largest US market),
   PanelView catalog.
6. **Siemens S7-1200/1500 profile + SCL/tag-table exporter**, then TIA Openness XML.
7. **Catalog framework** + Yaskawa GA500/GA800 drives and ifm sensors/IO-Link masters;
   drive and IO-Link blocks in the program (start/stop/speed/fault words).
8. **Vendor preference / customer standard** in the project data and the chooser.
9. Schneider (Machine Expert, PLCopen) and Yaskawa iC9200 (MotionWorks IEC, PLCopen + motion)
   profiles on top of the PLCopen exporter.

Each step ships on its own, keeps CLICK projects working, and adds unit tests (exporter output
round-trips through a schema/parser check; simulator tests run per profile).

## 5. Open questions for the user

- First non-CLICK target? Recommendation: Allen-Bradley CompactLogix (L5X import is complete
  and well documented), then Siemens S7-1200.
- Do customers have a "plant standard" list of vendors we should support as a project setting?
- Is a licence-free path required (SCL files / L5X) or can we assume TIA Openness on the
  engineer's PC?
