// Single source of truth for the cn-rollformer-01 fixture.
// build.mjs draws every sheet from these tables and writes expected.json from the
// same tables, so the answer key cannot drift from what is drawn.

export const META = {
  companyCn: '无锡恒成冷弯机械有限公司',
  companyEn: 'Wuxi Hengcheng Roll Forming Machinery Co., Ltd.',
  projectCn: 'HC-YX840 彩钢瓦冷弯成型机 (伺服追剪)',
  projectEn: 'HC-YX840 Roof panel roll-forming machine (servo flying shear)',
  dwgNo: 'HC-YX840-E01',
  rev: 'B',
  date: '2022-09-15',
  designed: '陈刚 Chen Gang',
  checked: '刘洋 Liu Yang',
  approved: '周斌 Zhou Bin',
  standardCn: 'GB/T 5226.1-2019 (IEC 60204-1)',
  machineCn:
    'HC-YX840 彩钢瓦冷弯成型机：主电机 5.5 kW 经变频器驱动成型辊连续成型；测长编码器测量板材长度，' +
    '伺服驱动器电子凸轮(E-CAM)追剪功能使剪切小车与板材同步，液压剪刀在同步区剪断；计数器统计根数，批量完成后自动停机。' +
    '无 PLC，继电器逻辑控制；急停、防护罩由安全继电器监控。',
  machineEn:
    'HC-YX840 roof-panel roll-forming line built in China to IEC 60204-1 / GB standards, with no PLC. The forming rolls are driven ' +
    'continuously by the 5.5 kW main motor M1 on a Delta VFD-E inverter U1 (with braking resistor R1). A 1000 ppr measuring-wheel ' +
    'encoder B1 on the strip feeds the auxiliary encoder input (CN5) of a Delta ASDA-A2 servo drive U2, whose built-in E-CAM ' +
    'flying-shear function moves the 1.5 kW servo carriage M3 in sync with the strip and gives a cut signal; a hydraulic shear ' +
    '(pump M2 2.2 kW DOL, valve YV1 down / YV2 up, limits SQ1/SQ2) cuts on the fly. Sequencing is hard-wired relay logic ' +
    '(KA1-KA10, cut watchdog timer KT1, Omron H7CX batch counter), with run-out table and material sensors. Two E-stops and the ' +
    'shear guard switch are monitored by a Pilz PNOZ s3 safety relay. Supply 380 V 3-phase + N + PE 50 Hz, 220 VAC pump ' +
    'contactor control, 24 VDC relay control, servo drive on 220 V single phase (L3-N).',
};

export const SUPPLY = {
  voltage: 380,
  phases: 3,
  neutral: true,
  frequencyHz: 50,
  system: '3P+N+PE (TN-S)',
  incomingTerminals: 'XT0: L1, L2, L3, N, PE',
  incomingCable: '5×10 mm²',
  mainSwitch: 'QF0 Chint NH2-125 4P 40A',
  upstreamProtectionA: 40,
  installedPowerKw: 9.2,
  maxPhaseCurrentA: 28,
  breakingCapacityKa: 6,
  controlVoltageAc: '220 VAC L2-N via QF5 for the hydraulic pump contactor KM1',
  controlVoltageDc: '24 VDC from G1 Mean Well NDR-120-24 (5 A) via FU1-FU3, 0V bonded to PE',
  servoSupply: '220 VAC single phase L3-N via QF3 (U2 R/S and L1C/L2C)',
};

export const MOTORS = [
  {
    tag: 'M1', kW: 5.5, V: 380, Hz: 50, A: 11.6, rpm: 1440, starter: 'VFD',
    model: 'YE3-132S-4', maker: 'Wannan 皖南电机',
    cn: '主机成型电机', en: 'Main roll-forming motor',
    starterTags: ['QF1', 'U1', 'R1'], partNumbers: ['Delta VFD055E43A', 'Chint NXB-63 3P C25', 'Delta BR1K0W075'],
  },
  {
    tag: 'M2', kW: 2.2, V: 380, Hz: 50, A: 5.0, rpm: 1430, starter: 'DOL',
    model: 'YE3-100L1-4', maker: 'Wannan 皖南电机',
    cn: '液压泵电机', en: 'Hydraulic pump motor (shear)',
    starterTags: ['QF2', 'KM1', 'FR1'], partNumbers: ['Chint NXB-63 3P C10', 'Chint NXC-12 AC220V', 'Chint NXR-12 4-6A'],
    overloadSettingA: 5.0,
  },
  {
    tag: 'M3', kW: 1.5, V: 220, Hz: null, A: 8.3, rpm: 2000, starter: 'SERVO',
    model: 'ECMA-E21315RS', maker: 'Delta 台达',
    cn: '追剪伺服电机', en: 'Flying shear carriage servo motor',
    starterTags: ['QF3', 'U2'], partNumbers: ['Delta ASD-A2-1521-L', 'Chint NXB-63 2P C16'],
  },
];

// Field and operator devices (the "signals" of a relay-logic machine).
// [tag, maker+part, kind, contact, cn, en, drives]
export const SIGNALS = [
  ['SB0', 'Schneider XB2BS542 + ZBE102', 'E-stop', '2NC', '急停 (操作台)', 'Emergency stop, operator console', 'KA0 channels S11-S12 / S21-S22'],
  ['SB10', 'Schneider XB2BS542 + ZBE102', 'E-stop', '2NC', '急停 (出料端)', 'Emergency stop, run-out end', 'KA0 channels S11-S12 / S21-S22 (in series with SB0)'],
  ['SQ5', 'Schneider XCSPA791', 'guard switch', '2NC', '剪切防护罩开关', 'Shear guard interlock switch', 'KA0 channels (in series with SB0/SB10)'],
  ['SB9', 'Schneider XB2BA61 + ZBE101', 'pushbutton', '2NO', '复位 (安全/伺服报警)', 'Reset: safety relay and servo alarm', 'KA0 S33-S34 (13-14) and U2 DI5 ARST (23-24)'],
  ['SB1', 'Schneider XB2BA31', 'pushbutton', 'NO', '油泵启动', 'Hydraulic pump start', 'KM1 coil (self-holding)'],
  ['SB2', 'Schneider XB2BA42', 'pushbutton', 'NC', '油泵停止', 'Hydraulic pump stop', 'KM1 coil circuit'],
  ['SB3', 'Schneider XB2BA31', 'pushbutton', 'NO', '联动启动', 'Line (auto) start', 'KA1 coil (self-holding)'],
  ['SB4', 'Schneider XB2BA42', 'pushbutton', 'NC', '联动停止', 'Line (auto) stop', 'KA1 run circuit'],
  ['SB5', 'Schneider XB2BA21', 'pushbutton', 'NO', '点动正转', 'Jog forward', 'KA2 coil (VFD MI1 + MI3 JOG)'],
  ['SB6', 'Schneider XB2BA21', 'pushbutton', 'NO', '点动反转', 'Jog reverse', 'KA3 coil (VFD MI2 + MI3 JOG)'],
  ['SB7', 'Schneider XB2BA51', 'pushbutton', 'NO', '手动剪切', 'Manual cut (line stopped only)', 'YV1 shear down via KA8 NC'],
  ['SB8', 'Schneider XB2BA61', 'pushbutton', 'NO', '计数复位', 'Batch counter reset', 'H7CX RST input'],
  ['SA1', 'Schneider XB2BD21', 'selector', 'NO', '伺服使能 开/关', 'Servo enable ON/OFF', 'KA4 coil (U2 DI1 SON)'],
  ['SQ1', 'Chint YBLX-ME/8108', 'limit switch', 'NO', '剪刀下限位', 'Shear blade down limit', 'KA8 coil (cut return latch)'],
  ['SQ2', 'Chint YBLX-ME/8108', 'limit switch', 'NC', '剪刀上限位', 'Shear blade up limit (opens at top)', 'KA8 hold circuit'],
  ['SQ3', 'Autonics BR100-DDT', 'photoelectric sensor', 'NPN', '出料台末端检测', 'Run-out table end (overrun) sensor', 'KA9 coil'],
  ['SQ4', 'Autonics PR18-8DN', 'inductive sensor', 'NPN NO', '进料有料检测', 'Material present at entry', 'KA10 coil'],
  ['B1', 'Autonics E50S8-1000-6-L-5', 'encoder', 'A/B/Z line driver 5 V', '测长编码器 1000P/R', 'Length measuring-wheel encoder 1000 ppr', 'U2 CN5 auxiliary encoder (E-CAM master)'],
  ['U1', 'Delta VFD055E43A', 'drive relay', 'RA/RB/RC', '变频器故障继电器', 'VFD fault relay', 'RB-RC (NC) in KA1 run circuit, RA-RC (NO) to fault lamp HL4'],
  ['U2', 'Delta ASD-A2-1521-L', 'servo DO', 'DO1/DO3/DO5', '伺服输出 SRDY/CUT/ALRM', 'Servo outputs ready / cut / alarm', 'KA5 / KA7 / KA6'],
  ['H7CX', 'Omron H7CX-A4D', 'counter', 'OUT C/O', '批量计数器', 'Batch (piece) counter', 'OUT NC in KA1 run circuit, OUT NO to HL5'],
  ['HL1', 'Schneider XB2BVB1LC', 'pilot light', 'white', '电源指示', 'Control power on', '24V1'],
  ['HL2', 'Schneider XB2BVB3LC', 'pilot light', 'green', '油泵运行', 'Hydraulic pump running', 'KM1 63-64'],
  ['HL3', 'Schneider XB2BVB3LC', 'pilot light', 'green', '联动运行', 'Line running', 'parallel to KA1 coil'],
  ['HL4', 'Schneider XB2BVB4LC', 'pilot light', 'red', '故障', 'Fault (servo alarm or VFD fault)', 'KA6 21-24 / U1 RA-RC'],
  ['HL5', 'Schneider XB2BVB5LC', 'pilot light', 'yellow', '批量完成', 'Batch complete', 'H7CX OUT NO'],
  ['YV1', 'Huade 4WE6E61B/CG24N9Z5L (sol. a)', 'solenoid valve', '24 VDC', '剪刀下行电磁阀', 'Shear down solenoid', 'hydraulic shear cylinder down'],
  ['YV2', 'Huade 4WE6E61B/CG24N9Z5L (sol. b)', 'solenoid valve', '24 VDC', '剪刀上行电磁阀', 'Shear up solenoid', 'hydraulic shear cylinder up'],
];

// Relays and timers of the relay logic: tag -> [cn, en]
export const RELAYS = {
  KA1: ['联动运行', 'Line run (auto)'],
  KA2: ['点动正转', 'Jog forward'],
  KA3: ['点动反转', 'Jog reverse'],
  KA4: ['伺服使能', 'Servo ON'],
  KA5: ['伺服准备好', 'Servo ready (U2 DO1 SRDY)'],
  KA6: ['伺服报警', 'Servo alarm (U2 DO5 ALRM)'],
  KA7: ['追剪剪切信号', 'Cut command (U2 DO3)'],
  KA8: ['剪切回程自锁', 'Cut return latch'],
  KA9: ['出料超长', 'Run-out overrun'],
  KA10: ['有料', 'Material present'],
  KT1: ['剪切超时 2s', 'Cut watchdog 2 s'],
};

// [tag, maker, partNumber, cn, en, qty, category]
export const PARTS = [
  ['QF0', 'Chint 正泰', 'NH2-125 4P 40A', '隔离开关 4P 40A (主开关)', 'Main isolating switch 4-pole 40 A', 1, 'disconnect'],
  ['QF1', 'Chint 正泰', 'NXB-63 3P C25', '小型断路器 3P C25 主机变频器', 'MCB 3P C25, main VFD U1 supply', 1, 'circuit-protection'],
  ['QF2', 'Chint 正泰', 'NXB-63 3P C10', '小型断路器 3P C10 液压泵', 'MCB 3P C10, hydraulic pump M2', 1, 'circuit-protection'],
  ['QF3', 'Chint 正泰', 'NXB-63 2P C16', '小型断路器 2P C16 伺服驱动器', 'MCB 2P C16, servo drive U2 (L3-N)', 1, 'circuit-protection'],
  ['QF4', 'Chint 正泰', 'NXB-63 2P C6', '小型断路器 2P C6 开关电源', 'MCB 2P C6, 24 V PSU G1 (L1-N)', 1, 'circuit-protection'],
  ['QF5', 'Chint 正泰', 'NXB-63 2P C4', '小型断路器 2P C4 交流控制', 'MCB 2P C4, 220 VAC control (L2-N)', 1, 'circuit-protection'],
  ['FU1', 'Chint 正泰', 'RT28N-32/1P + RT28-32 2A', '熔断器 2A 24V1 指示/计数/安全', 'Fuse 2 A, 24V1 (lamps, counter, safety relay)', 1, 'circuit-protection'],
  ['FU2', 'Chint 正泰', 'RT28N-32/1P + RT28-32 2A', '熔断器 2A 24V2 伺服 I/O', 'Fuse 2 A, 24V2 (servo CN1 COM+)', 1, 'circuit-protection'],
  ['FU3', 'Chint 正泰', 'RT28N-32/1P + RT28-32 6A', '熔断器 6A 24V3 继电器/电磁阀', 'Fuse 6 A, 24V3 (via KA0 23-24 to 24VS)', 1, 'circuit-protection'],
  ['G1', 'Mean Well 明纬', 'NDR-120-24', '开关电源 24VDC 5A', 'DIN-rail power supply 24 VDC 5 A 120 W', 1, 'power-supply'],
  ['U1', 'Delta 台达', 'VFD055E43A', '变频器 5.5kW 三相380V', 'VFD 5.5 kW 3-phase 380-480 V (main motor)', 1, 'drive'],
  ['R1', 'Delta 台达', 'BR1K0W075', '制动电阻 1000W 75Ω', 'Braking resistor 1000 W 75 Ω', 1, 'drive'],
  ['U2', 'Delta 台达', 'ASD-A2-1521-L', '伺服驱动器 1.5kW 220V (E-CAM)', 'Servo drive 1.5 kW 220 V with E-CAM', 1, 'servo'],
  ['M3', 'Delta 台达', 'ECMA-E21315RS', '伺服电机 1.5kW 2000rpm', 'Servo motor 1.5 kW 2000 r/min 20-bit', 1, 'servo'],
  ['B1', 'Autonics 奥托尼克斯', 'E50S8-1000-6-L-5', '编码器 1000P/R 线驱动 5V', 'Incremental encoder 1000 ppr line driver 5 V', 1, 'encoder'],
  ['KM1', 'Chint 正泰', 'NXC-12 AC220V + F4-22', '交流接触器 12A + 辅助触头 2NO+2NC', 'Contactor 12 A 220 VAC coil + aux block 2NO+2NC', 1, 'contactor'],
  ['FR1', 'Chint 正泰', 'NXR-12 4-6A', '热过载继电器 整定5.0A', 'Thermal overload relay 4-6 A, set 5.0 A', 1, 'overload'],
  ['KA0', 'Pilz 皮尔磁', 'PNOZ s3 750103 24VDC', '安全继电器 急停/防护罩', 'Safety relay, E-stop / guard, 2 NO + 1 NC', 1, 'safety'],
  ['KA1-KA10', 'Chint 正泰', 'JZX-22F(D)/4Z DC24V + CZY14A', '中间继电器 4转换 带底座', 'Control relay 4 C/O 24 VDC with socket', 10, 'relay'],
  ['KT1', 'Omron 欧姆龙', 'H3Y-2 DC24 5S', '时间继电器 通电延时 0-5s 设2s', 'On-delay timer 0-5 s, set 2 s', 1, 'timer'],
  ['H7CX', 'Omron 欧姆龙', 'H7CX-A4D', '预置计数器 4位 批量', 'Preset counter 4-digit (batch)', 1, 'counter'],
  ['SB0, SB10', 'Schneider 施耐德', 'XB2BS542 + ZBE102', '急停按钮 Ø40 红色蘑菇头 2NC', 'E-stop mushroom Ø40 red, 2NC', 2, 'safety'],
  ['SQ5', 'Schneider 施耐德', 'XCSPA791', '防护罩安全开关 2NC', 'Guard safety interlock switch 2NC', 1, 'safety'],
  ['SB1, SB3', 'Schneider 施耐德', 'XB2BA31', '启动按钮 绿色 1NO', 'Start pushbutton green 1NO', 2, 'operator'],
  ['SB2, SB4', 'Schneider 施耐德', 'XB2BA42', '停止按钮 红色 1NC', 'Stop pushbutton red 1NC', 2, 'operator'],
  ['SB5, SB6', 'Schneider 施耐德', 'XB2BA21', '点动按钮 黑色 1NO', 'Jog pushbutton black 1NO', 2, 'operator'],
  ['SB7', 'Schneider 施耐德', 'XB2BA51', '手动剪切按钮 黄色 1NO', 'Manual cut pushbutton yellow 1NO', 1, 'operator'],
  ['SB8', 'Schneider 施耐德', 'XB2BA61', '计数复位按钮 蓝色 1NO', 'Counter reset pushbutton blue 1NO', 1, 'operator'],
  ['SB9', 'Schneider 施耐德', 'XB2BA61 + ZBE101', '复位按钮 蓝色 2NO', 'Reset pushbutton blue 2NO', 1, 'operator'],
  ['SA1', 'Schneider 施耐德', 'XB2BD21', '选择开关 2位 伺服使能', 'Selector 2-position, servo enable', 1, 'operator'],
  ['HL1', 'Schneider 施耐德', 'XB2BVB1LC', '指示灯 白色 24V', 'Pilot light white 24 V', 1, 'pilot-light'],
  ['HL2, HL3', 'Schneider 施耐德', 'XB2BVB3LC', '指示灯 绿色 24V', 'Pilot light green 24 V', 2, 'pilot-light'],
  ['HL4', 'Schneider 施耐德', 'XB2BVB4LC', '指示灯 红色 24V', 'Pilot light red 24 V', 1, 'pilot-light'],
  ['HL5', 'Schneider 施耐德', 'XB2BVB5LC', '指示灯 黄色 24V', 'Pilot light yellow 24 V', 1, 'pilot-light'],
  ['SQ1, SQ2', 'Chint 正泰', 'YBLX-ME/8108', '行程开关 剪刀上/下限', 'Limit switch, shear up / down', 2, 'sensor'],
  ['SQ3', 'Autonics 奥托尼克斯', 'BR100-DDT', '光电开关 漫反射 100mm NPN', 'Photoelectric sensor diffuse 100 mm NPN', 1, 'sensor'],
  ['SQ4', 'Autonics 奥托尼克斯', 'PR18-8DN', '接近开关 M18 8mm NPN 常开', 'Inductive sensor M18 8 mm NPN NO', 1, 'sensor'],
  ['YV1, YV2', 'Huade 北京华德', '4WE6E61B/CG24N9Z5L', '电磁换向阀 双电控 24VDC', 'Directional valve double solenoid 24 VDC', 1, 'valve'],
  ['M1', 'Wannan 皖南', 'YE3-132S-4 5.5kW', '三相异步电机 5.5kW 380V', 'Induction motor 5.5 kW 380 V 50 Hz (main)', 1, 'motor'],
  ['M2', 'Wannan 皖南', 'YE3-100L1-4 2.2kW', '三相异步电机 2.2kW 380V', 'Induction motor 2.2 kW 380 V 50 Hz (pump)', 1, 'motor'],
  ['XT0', 'Phoenix 菲尼克斯', 'UK 10 N / USLKG 10 N', '电源进线端子', 'Supply terminals (4 + 1 PE)', 5, 'terminal'],
  ['XT1', 'Phoenix 菲尼克斯', 'UK 5 N / USLKG 5', '电机端子', 'Motor terminals (9 + 3 PE)', 12, 'terminal'],
  ['XT2', 'CHNT 正泰', 'JF5-2.5/5', '控制端子 2.5mm²', 'Control terminals 2.5 mm²', 22, 'terminal'],
  ['W1', '—', 'RVVP 8×0.3', '编码器屏蔽电缆', 'Encoder cable shielded, B1 to U2 CN5', 1, 'cable'],
  ['W2', 'Delta 台达', 'ASD-B2EB1003', '伺服编码器电缆 3m', 'Servo motor encoder cable 3 m (CN2)', 1, 'cable'],
];

export const MOTION = {
  axis: 'Flying shear carriage',
  drive: { tag: 'U2', part: 'Delta ASD-A2-1521-L', supply: '220 VAC 1-phase (L3-N)' },
  motor: { tag: 'M3', part: 'Delta ECMA-E21315RS', kW: 1.5, ratedRpm: 2000, feedback: '20-bit incremental (CN2, cable W2)' },
  mechanics: 'Ball screw lead 20 mm, carriage stroke 500 mm',
  masterEncoder: {
    tag: 'B1', part: 'Autonics E50S8-1000-6-L-5', ppr: 1000, output: 'line driver A/B/Z, 5 VDC from CN5',
    wheelCircumferenceMm: 200, mmPerPulse: 0.2, quadratureResolutionMm: 0.05, input: 'U2 CN5 auxiliary encoder',
  },
  flyingShearMode: 'Servo drive built-in E-CAM (electronic cam) flying shear, master = CN5 auxiliary encoder B1; carriage synchronises with the strip, DO3 gives the cut command',
  cutLengthMm: [300, 6000],
  maxLineSpeedMpm: 30,
  ioSignals: [
    'DI1 SON <- KA4 11-14 (servo enable, SA1)',
    'DI5 ARST <- SB9 23-24 (alarm reset)',
    'DI7 CAM engage <- KA1 31-34 (line running)',
    'DO1 SRDY -> KA5 (servo ready, in run circuit)',
    'DO3 CUT -> KA7 (cut command, YV1 shear down)',
    'DO5 ALRM -> KA6 (servo alarm, stops line, HL4)',
  ],
  batchCounter: 'Omron H7CX-A4D counts cuts (CP1 <- KA8 41-44), preset = pieces per batch; OUT stops the line and lights HL5; reset by SB8',
};

export const SAFETY = [
  {
    function: 'Emergency stop',
    cn: '急停',
    devices: ['SB0', 'SB10', 'KA0', 'KM1', 'KA1', 'KA2', 'KA3', 'KA4', 'YV1', 'YV2'],
    logic: 'SB0 and SB10 (2NC each) in series, two channels S11-S12 / S21-S22 of PNOZ s3 KA0; KA0 13-14 opens the 220 VAC coil circuit of KM1 (hydraulic pump); KA0 23-24 removes 24VS from all relays KA1-KA10, KT1 and valves YV1/YV2 (line run, jog, servo ON, cut)',
    stopCategory: 0,
    category: '3',
    pl: 'd',
  },
  {
    function: 'Shear guard interlock',
    cn: '剪切防护罩联锁',
    devices: ['SQ5', 'KA0', 'KM1', 'KA1', 'KA4', 'YV1', 'YV2'],
    logic: 'SQ5 2NC in series with the E-stops in both channels of KA0; same outputs as the E-stop',
    stopCategory: 0,
    category: '3',
    pl: 'd',
  },
  {
    function: 'Manual monitored reset with external device monitoring',
    cn: '手动复位 + 接触器反馈监控',
    devices: ['SB9', 'KM1', 'KA0'],
    logic: 'S33-S34 loop: KM1 21-22 (NC feedback) in series with SB9 13-14',
    category: '3',
    pl: 'd',
  },
];

// Hard-wired circuits, in the order drawn. [id, coil/load, sheet, cn, en]
export const RELAY_LOGIC = [
  ['C1', 'KM1', 3, '液压泵：SB1 启动，KM1 13-14 自锁，SB2 停止，FR1 95-96 过载保护，KA0 13-14 安全断开。',
    'Hydraulic pump KM1 (220 VAC): 101 -> KA0 13-14 -> SB2 (NC stop) -> SB1 (NO start) in parallel with KM1 13-14 (self-hold) -> FR1 95-96 -> KM1 coil -> N51. Pump running lamp HL2 via KM1 63-64.'],
  ['C2', 'KA1', 5, '联动运行：SB4 停止、油泵运行、伺服准备好、无伺服报警、变频器正常、剪切未超时、批量未完成、出料未超长、有料，按 SB3 启动 KA1 自锁；HL3 运行指示。',
    'Line run KA1 (24VS): SB4 (NC stop) -> KM1 53-54 (pump running) -> KA5 11-14 (servo ready) -> KA6 11-12 (no servo alarm) -> U1 RB-RC (VFD healthy) -> KT1 15-16 (cut watchdog not timed out) -> H7CX OUT NC (batch not complete) -> KA9 11-12 (no run-out overrun) -> KA10 11-14 (material present) -> SB3 (NO start) in parallel with KA1 11-14 (self-hold) -> KA1 coil; HL3 in parallel with the coil. KA1 21-24 runs the VFD forward (MI1) and KA1 31-34 engages the servo E-CAM (DI7).'],
  ['C3', 'KA2/KA3', 5, '点动：仅在 KA1 未运行时 (KA1 41-42)，SB5 点动正转 KA2，SB6 点动反转 KA3，互锁。',
    'Jog (24VS, only while KA1 is off via KA1 41-42): SB5 -> KA3 11-12 -> KA2 coil (jog forward: MI1 + MI3); SB6 -> KA2 11-12 -> KA3 coil (jog reverse: MI2 + MI3); KA2/KA3 are mutually interlocked.'],
  ['C4', 'KA4', 5, '伺服使能：SA1 闭合 -> KA4 -> U2 DI1 SON。',
    'Servo enable: 24VS -> SA1 -> KA4 coil; KA4 11-14 switches U2 DI1 (SON).'],
  ['C5', 'KA9/KA10', 5, '出料末端光电 SQ3 -> KA9 (停机)；进料接近开关 SQ4 -> KA10 (有料)。',
    'Sensors: SQ3 (run-out end photo, NPN) switches KA9 coil (overrun stops the line); SQ4 (entry inductive, NPN) switches KA10 coil (material present permits run).'],
  ['C6', 'KA5/KA6/KA7', 6, '伺服输出：DO1 SRDY -> KA5，DO5 ALRM -> KA6，DO3 剪切信号 -> KA7。',
    'Servo outputs (24VS through relay coils to U2 DO+ / DO- to 0V): DO1 SRDY -> KA5, DO5 ALRM -> KA6, DO3 cut command -> KA7. U2 inputs from 24V2 COM+: DI1 SON (KA4), DI5 ARST (SB9 23-24), DI7 CAM (KA1 31-34).'],
  ['C7', 'YV1/KT1', 6, '剪刀下行：KA7 或手动剪切 SB7 (仅停机) -> KA8 常闭 -> YV1；KT1 与 YV1 并联，2 s 未到下限则 KT1 15-16 断开联动。',
    'Shear down: 24VS -> KA7 11-14 (servo cut) or wire 341 (SB7 manual cut, only with KA1 off) -> KA8 11-12 -> YV1; watchdog KT1 in parallel with YV1: if the shear stays down-commanded for 2 s, KT1 15-16 opens the line run circuit.'],
  ['C8', 'KA8/YV2', 6, '剪刀回程：SQ1 下限 -> KA8，经 SQ2 上限常闭自锁；KA8 -> YV2 上行，到上限 SQ2 断开复位；KA8 41-44 计数。',
    'Shear return: SQ1 (down limit) energises KA8, which holds through KA8 21-24 and SQ2 (up limit NC); KA8 31-34 energises YV2 (shear up) and KA8 11-12 drops YV1; at the top SQ2 opens and KA8 drops out. KA8 41-44 pulses the H7CX count input CP1.'],
  ['C9', 'H7CX', 6, '批量计数：H7CX 计数剪切次数，到预置值 OUT 动作，停机并点亮 HL5；SB8 复位。',
    'Batch counter H7CX (24V1): CP1 counts cuts from KA8 41-44, SB8 resets (RST); at preset the OUT changeover opens the KA1 run circuit (OUT NC) and lights HL5 (OUT NO).'],
  ['C10', 'HL1-HL5', 4, '指示灯：HL1 电源，HL2 油泵运行，HL4 故障 (KA6 或 U1 RA-RC)，HL5 批量完成。',
    'Pilot lights (24V1): HL1 power on, HL2 pump running (KM1 63-64), HL4 fault (KA6 21-24 or U1 RA-RC), HL5 batch complete (H7CX OUT NO); HL3 line running is on sheet 5.'],
  ['C11', 'U1', 4, '变频器控制：DCM 公共端，KA1/KA2 -> MI1 正转，KA3 -> MI2 反转，KA2/KA3 -> MI3 点动。',
    'VFD control (U1 sink inputs, common DCM): MI1 forward via KA1 21-24 or KA2 21-24; MI2 reverse via KA3 21-24; MI3 JOG via KA2 31-34 or KA3 31-34.'],
];

export const INTERLOCKS = [
  'The line (KA1) can only start when the hydraulic pump is running (KM1 53-54), the servo is ready (KA5) and not in alarm (KA6), the VFD is healthy (U1 RB-RC), the cut watchdog has not timed out (KT1), the batch is not complete (H7CX), there is no run-out overrun (KA9) and material is present (KA10).',
  'Jog forward/reverse (KA2/KA3) and the manual cut (SB7) are only possible while the line run relay KA1 is off (KA1 41-42).',
  'Jog forward and jog reverse are mutually interlocked (KA3 11-12 in KA2, KA2 11-12 in KA3).',
  'The shear-down solenoid YV1 is dropped by KA8 11-12 as soon as the down limit SQ1 is reached, so YV1 and YV2 can never be energised together.',
  'If the shear is commanded down for more than 2 s without reaching SQ1, timer KT1 15-16 opens the line run circuit.',
  'At the batch preset the H7CX output stops the line (OUT NC) until the counter is reset with SB8.',
  'The hydraulic pump contactor KM1 coil is supplied through safety relay KA0 13-14 and overload FR1 95-96; all 24 V relays, the timer and the shear valves are fed from 24VS through KA0 23-24.',
  'The safety relay KA0 can only be reset with SB9 when KM1 is dropped out (KM1 21-22 feedback in S33-S34).',
  'The servo flying-shear cam (DI7) is engaged only while the line runs (KA1 31-34); the servo is enabled only with SA1 on and the safety circuit closed (KA4 on 24VS).',
];

export const CONTROL_NOTES_CN = [
  '1. 先开油泵 (SB1)，SA1 打到伺服使能；伺服准备好后按 SB3 联动启动，SB4 停止。',
  '2. 剪切长度、同步区在伺服驱动器 U2 电子凸轮 (E-CAM) 参数中设定；测长编码器 B1 1000P/R，测长轮周长 200 mm。',
  '3. 剪刀下行 YV1 超过 2 s 未到下限 SQ1 (KT1)、伺服报警、变频器故障、出料超长或无料：联动停止。',
  '4. 计数器 H7CX 达到预置根数：联动停止，黄灯 HL5 亮，按 SB8 复位。',
  '5. 点动 SB5/SB6 及手动剪切 SB7 仅在联动停止时有效。',
];
export const CONTROL_NOTES_EN = [
  '1. Start the hydraulic pump (SB1), set SA1 to servo ON; when the servo is ready press SB3 for line start, SB4 stops.',
  '2. Cut length and sync zone are set in the E-CAM parameters of servo drive U2; encoder B1 1000 ppr on a 200 mm wheel.',
  '3. Shear down >2 s without SQ1 (KT1), servo alarm, VFD fault, run-out overrun or no material: the line stops.',
  '4. H7CX batch preset reached: line stops, yellow HL5 on, reset with SB8.',
  '5. Jog SB5/SB6 and manual cut SB7 only work while the line is stopped.',
];

export const WIRE_NOTES = [
  ['电源进线', 'Supply cable', '5×10 mm²', 'YJV'],
  ['主机变频器回路', 'Main VFD circuit', '4 mm² 黑 BK', 'BVR'],
  ['液压泵/伺服回路', 'Pump / servo circuits', '2.5 mm² 黑 BK', 'BVR'],
  ['交流控制 220V', 'AC control 220 V', '1.0 mm² 红 RD', 'BVR'],
  ['直流 24V+', 'DC 24V+', '0.75 mm² 棕 BN', 'BVR'],
  ['直流 0V', 'DC 0V', '0.75 mm² 蓝 BU', 'BVR'],
  ['中性线 N', 'Neutral N', '同相线截面 浅蓝 LBU', 'BVR'],
  ['保护地 PE', 'Protective earth PE', '≥4 mm² 黄绿 GNYE', 'BVR'],
  ['编码器/伺服信号', 'Encoder / servo signals', '0.3 mm² 屏蔽 shielded', 'RVVP'],
];

export const NA_NOTES = [
  { topic: 'Supply', current: '380 V 3-phase + N + PE, 50 Hz (TN-S); single-phase 220 V loads taken L-N', change: '480 V 3-phase 60 Hz, 3-wire + ground (no neutral). Feed the 220 V servo drive from a 480:230 V transformer (or use a 400/480 V class servo), and the PSU and contactor control from a 480:120 V control transformer with primary/secondary protection.' },
  { topic: 'Control voltage', current: '220 VAC KM1 coil circuit (L2-N), 24 VDC relay logic', change: '120 VAC from the control transformer (or a 24 VDC coil); grounded control circuits per NFPA 79 9.4.3; 24 VDC logic can stay.' },
  { topic: 'Motors', current: 'YE3 IEC motors 380 V 50 Hz: M1 5.5 kW, M2 2.2 kW; servo M3 1.5 kW 220 V', change: 'NEMA/UL-recognised 460 V 60 Hz motors: M1 7.5 hp, M2 3 hp; size from NEC Table 430.250 FLA (7.5 hp 11 A, 3 hp 4.8 A at 460 V); 60 Hz raises speed 20 % - re-check roll speed and pump flow; servo motor stays (UL-recognised, check).' },
  { topic: 'Branch-circuit protection', current: 'Chint NXB-63 MCBs (IEC 60898, C-curve) QF1-QF5, RT28 fuses FU1-FU3', change: 'UL 489 circuit breakers or UL 248 Class CC/J fuses for motor, drive and feeder branch circuits (NEC 430 Part IV, drive manufacturer listed protection); UL 1077 supplementary protectors only behind branch protection.' },
  { topic: 'Disconnect', current: 'Chint NH2-125 4P 40A isolating switch, no overcurrent protection, upstream ≤40 A assumed', change: 'UL 98 / UL 508 listed, door-interlocked, lockable main disconnect (NFPA 79 5.3) with marked SCCR; 3-pole.' },
  { topic: 'Motor starter', current: 'Chint NXC-12 contactor + NXR-12 4-6A thermal overload (pump M2)', change: 'UL 508 listed starter or manual motor protector combination (Type E/F); overload set to 460 V FLA.' },
  { topic: 'VFD and servo', current: 'Delta VFD055E43A 5.5 kW and ASD-A2-1521-L 1.5 kW 220 V, run/enable via relay contacts, no STO', change: 'Re-select for 480 V 60 Hz (7.5 hp VFD; 400/480 V class servo or transformer); use listed branch protection; for Cat 3 / PL d the stop of the main motor and the servo must be two-channel (STO-capable drives or monitored contactors) - a single KA1/KA4 contact does not meet Cat 3.' },
  { topic: 'SCCR', current: 'Only MCB breaking capacity 6 kA noted', change: 'Determine and mark the panel SCCR per UL 508A Supplement SB / NFPA 79 16.4.' },
  { topic: 'Device tags', current: 'GB/IEC letter codes: QF, KM, FR, KA, KT, SB, SA, SQ, YV, HL, FU, G, U, R, B, M, XT', change: 'NFPA 79 / JIC style: QF0->DISC1, QF1-QF5->CB1-CB5, KM1->M2 (pump starter), FR1->OL2, KA1-KA10->CR1-CR10, KT1->TR1, KA0->MSR1, SB0/SB10->ESTOP1/ESTOP2, SB1-SB9->PB1-PB9, SA1->SS1, SQ1/SQ2->LS1/LS2, SQ3->PE1, SQ4->PRS1, SQ5->LS-GD1, YV1/YV2->SOL1A/SOL1B, HL1-HL5->LT1-LT5, H7CX->CTR1, G1->PS1, U1->VFD1, U2->SD1, R1->BR1, B1->ENC1, M1-M3->MTR1-MTR3, XT->TB.' },
  { topic: 'Wire sizes', current: 'mm²: 10 / 4 / 2.5 / 1.0 / 0.75 / 0.3', change: 'AWG per NFPA 79 Table 12.5.1 / NEC 310.16: 10 mm²->8 AWG, 4 mm²->12 AWG, 2.5 mm²->14 AWG, 1.0 mm²->16 AWG, 0.75 mm²->18 AWG, 0.3 mm²->22 AWG shielded; MTW / UL 1015 machine tool wire.' },
  { topic: 'Wire colours', current: 'GB: power BK, AC control RD, DC+ BN, 0V BU, N light blue, PE GNYE', change: 'NFPA 79 13.2: power BK, AC control RD, DC control BU, grounded conductor white/grey, PE green (or GNYE), orange for circuits not de-energised by the disconnect.' },
  { topic: 'Non-UL components', current: 'Chint MCBs/contactor/overload/fuses/limit switches, CHNT JF5 terminals, Wannan motors, Huade valve, Chint relays', change: 'Verify cULus listing for every part and replace IEC-only parts with UL listed/recognised equivalents (Mean Well, Pilz, Schneider XB2, Delta drives, Omron H3Y/H7CX, Autonics generally carry UL/CSA marks - confirm exact part numbers).' },
  { topic: 'Safety', current: 'PNOZ s3, 2 E-stops + shear guard, Cat 3 / PL d (GB/T 16855.1), stop category 0', change: 'Keep ISO 13849-1 PL d validation (accepted by ANSI B11.19 / NFPA 79 9.2.5.4); E-stop stays hardwired stop category 0 or 1; add the second channel for the main VFD and servo (STO) and a guard for the flying-shear travel zone; document validation.' },
  { topic: 'Documentation & language', current: 'Bilingual Chinese/English title block, IEC vertical schematics with /sheet.column cross-references', change: 'English-only drawings per NFPA 79 Ch. 17: ladder diagrams with line numbers, JIC/IEEE 315 symbols, nameplate with FLA, SCCR, voltage; operator panel legends in English.' },
  { topic: 'Sensor polarity', current: 'NPN (sink) sensors switching relay coils, VFD sink inputs (DCM common)', change: 'Acceptable, but North American practice prefers PNP (sourcing) sensors; confirm the customer standard.' },
];

export const SHEETS = [
  { no: 1, cn: '封面 / 图纸目录 / 技术说明', en: 'Cover / drawing index / technical notes' },
  { no: 2, cn: '主电源分配', en: 'Power distribution' },
  { no: 3, cn: '电机及伺服主回路 / 液压泵控制', en: 'Motor & servo power circuits / pump control' },
  { no: 4, cn: '安全回路 / 变频器控制 / 指示灯', en: 'Safety circuit / VFD control / pilot lights' },
  { no: 5, cn: '继电器控制回路 (一) 联动 / 点动', en: 'Relay control (1) line run / jog' },
  { no: 6, cn: '继电器控制回路 (二) 伺服 / 剪切 / 计数', en: 'Relay control (2) servo / shear / counter' },
  { no: 7, cn: '端子表', en: 'Terminal list' },
  { no: 8, cn: '元件清单', en: 'Bill of materials' },
];
