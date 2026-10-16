import type { CpuModel } from '../profile';

/**
 * CLICK CPU models and AI knowledge. Sources (AutomationDirect):
 * - C0 CPUs:   https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf
 * - C2 CPUs:   https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf
 * - SC relays: https://cdn.automationdirect.com/static/helpfiles/click/Content/109.htm
 * - Timer:     .../Content/165.htm   Counter: .../Content/166.htm
 */

const c0 = (id: string, family: string, inputs: number, outputs: number, io: string): CpuModel => ({
  id, label: `${id} — ${family} (${io})`, builtInInputs: inputs, builtInOutputs: outputs,
});

export const CLICK_CPUS: CpuModel[] = [
  c0('C0-10DD1E-D', 'Ethernet Basic', 8, 6, '8 DC in / 6 DC sinking out'),
  c0('C0-10DD2E-D', 'Ethernet Basic', 8, 6, '8 DC in / 6 DC sourcing out'),
  c0('C0-10DRE-D', 'Ethernet Basic', 8, 6, '8 DC in / 6 relay out'),
  c0('C0-10ARE-D', 'Ethernet Basic', 8, 6, '8 AC in / 6 relay out'),
  c0('C0-11DD1E-D', 'Ethernet Standard', 8, 6, '8 DC in / 6 DC sinking out'),
  c0('C0-11DD2E-D', 'Ethernet Standard', 8, 6, '8 DC in / 6 DC sourcing out'),
  c0('C0-11DRE-D', 'Ethernet Standard', 8, 6, '8 DC in / 6 relay out'),
  c0('C0-11ARE-D', 'Ethernet Standard', 8, 6, '8 AC in / 6 relay out'),
  c0('C0-12DD1E-D', 'Ethernet Analog', 4, 4, '4 DC in / 4 DC sinking out + analog'),
  c0('C0-12DD2E-D', 'Ethernet Analog', 4, 4, '4 DC in / 4 DC sourcing out + analog'),
  c0('C0-12DRE-D', 'Ethernet Analog', 4, 4, '4 DC in / 4 relay out + analog'),
  c0('C0-12ARE-D', 'Ethernet Analog', 4, 4, '4 AC in / 4 relay out + analog'),
  c0('C0-00DD1-D', 'Basic', 8, 6, '8 DC in / 6 DC sinking out'),
  c0('C0-00DD2-D', 'Basic', 8, 6, '8 DC in / 6 DC sourcing out'),
  c0('C0-00DR-D', 'Basic', 8, 6, '8 DC in / 6 relay out'),
  c0('C0-00AR-D', 'Basic', 8, 6, '8 AC in / 6 relay out'),
  c0('C0-01DD1-D', 'Standard', 8, 6, '8 DC in / 6 DC sinking out'),
  c0('C0-01DD2-D', 'Standard', 8, 6, '8 DC in / 6 DC sourcing out'),
  c0('C0-01DR-D', 'Standard', 8, 6, '8 DC in / 6 relay out'),
  c0('C0-01AR-D', 'Standard', 8, 6, '8 AC in / 6 relay out'),
  c0('C0-02DD1-D', 'Analog', 4, 4, '4 DC in / 4 DC sinking out + analog'),
  c0('C0-02DD2-D', 'Analog', 4, 4, '4 DC in / 4 DC sourcing out + analog'),
  c0('C0-02DR-D', 'Analog', 4, 4, '4 DC in / 4 relay out + analog'),
  ...['C2-01CPU', 'C2-02CPU', 'C2-03CPU'].map((id) => ({
    id,
    label: `${id} — CLICK PLUS (no built-in I/O)`,
    builtInInputs: 0,
    builtInOutputs: 0,
    notes: 'CLICK PLUS I/O comes from option-slot and stackable modules. Check System Configuration in CLICK software and type the real addresses in the I/O List.',
  })),
];

export const CLICK_KNOWLEDGE = (cpu: CpuModel) => `CLICK PLC facts you must follow (from AutomationDirect documentation):
- CPU: ${cpu.label}. Built-in I/O: ${cpu.builtInInputs} inputs, ${cpu.builtInOutputs} outputs.
- Address formats, no leading zeros except in X/Y: inputs X001–X816 and outputs Y001–Y816 (first digit = slot, 0 = CPU; then point 01–16). Control relays C1–C2000. Timers T1–T500, with the current value in TD1–TD500. Counters CT1–CT250, with the current value in CTD1–CTD250. Data registers: DS1–DS4500 (16-bit int), DD1–DD1000 (32-bit int), DH1–DH500 (hex), DF1–DF500 (float). System bits SC1–SC1000 and system registers SD1–SD1000 are read-only.
- Useful system bits: SC1 = always ON, SC2 = ON for the first scan only, SC7 = 1-second clock pulse, SC19 = PLC error. There is no always-OFF bit.
- Contacts: NO, NC, RISE (rising edge) and FALL (falling edge) on any bit address (X, Y, C, T, CT, SC). Compare contacts (CMP) compare registers or constants: left/right are addresses like DS1 or numbers.
- Coils: OUT, SET (latch), RST (unlatch) on Y or C bits. Never write to X or SC.
- Timer (TMR): T address, ON_DELAY or OFF_DELAY, unit ms/sec/min/hour/day. The setpoint is a constant or a DS register. Set accumulate=true (retentive, needs resetAddress) only on ON_DELAY timers. The timer's done bit is the same T address, used as a contact.
- Counter (CNT): CT address, UP or DOWN, setpoint constant or DS/DD register; counts on each OFF→ON of the rung; always give a resetAddress bit. The done bit CTn is ON when the count reaches the setpoint.
- COPY copies a constant or register into a register. MATH writes the result of a formula (registers, numbers, + - * / MOD and parentheses) into a register.
- Prefer a step register (e.g. DS1) with compare contacts (DS1 == 3) and COPY to change step, or one C bit per step, for sequences.
- Do not add an END rung. The app adds it when exporting.`;
