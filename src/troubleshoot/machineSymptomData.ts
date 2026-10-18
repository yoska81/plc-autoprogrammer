import type { MachineSymptomMap } from "./machineSymptoms";

/**
 * Machine-level symptom maps (see machineSymptoms.ts), one per machine type, from cited maker documents.
 * Roll former with servo flying shear: Encoder Products measuring-wheel notes (TB-108 ranks wheel misalignment as the
 * most common cause), Siemens flying-saw application, Rexroth valve / pressure switch data sheets, H7CX / E6B2 /
 * CLICK / SureServo2 manuals. Where no source ranks causes, the order follows the documents' emphasis (see mechanism).
 */
export const MACHINE_SYMPTOM_DATA: MachineSymptomMap[] = [
  {
    "machineType": "roll-former-flying-shear",
    "title": "Roll former with servo flying shear (cut-to-length line)",
    "aliases": [
      "roll former",
      "roll forming",
      "roll-forming line",
      "roll forming line",
      "rollformer",
      "flying shear",
      "flying cut-off",
      "flying cutoff",
      "flying saw",
      "cut to length",
      "cut-to-length",
      "ctl line"
    ],
    "symptoms": [
      {
        "id": "cut-length-wrong",
        "symptom": "Cut length is wrong, drifting or inconsistent (parts too long or too short)",
        "aliases": [
          "cut length wrong",
          "wrong cut length",
          "length drifts",
          "length drifting",
          "inconsistent length",
          "inconsistent cut length",
          "parts too long",
          "parts too short",
          "parts long",
          "parts short",
          "pieces too long",
          "pieces too short",
          "length out of tolerance",
          "cut length varies",
          "first part wrong length",
          "length error"
        ],
        "causes": [
          {
            "rank": 1,
            "cause": "Measuring wheel misaligned with the strip, so the wheel skids",
            "mechanism": "Misaligned wheel skids and loses travel; count hits preset late, parts long by varying amounts. TB-108 ranks misalignment as the top cause.",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver"
              ],
              "categories": [
                "encoder"
              ]
            },
            "checks": [
              "Stop, lock out, sight along strip: wheel face square to travel, axle at 90 degrees. Good: tracks straight. Bad: angled wheel or twisted bracket.",
              "Inspect tread. Good: even wear. Bad: one-edge wear, scuffing or a polished band = sideways skid (TB-108: misalignment gives uneven wear).",
              "Wheel off strip, spin the encoder by hand. Good: smooth, no axial play. Bad: rough/loose bearings from axial load (TB-108: misalignment)."
            ],
            "fix": [
              "Re-square the encoder bracket or torsion arm so the wheel tracks in line with the strip.",
              "Replace a wheel that has worn unevenly, and replace the encoder if its bearings are rough.",
              "If the strip wanders sideways, use a dual-wheel unit. TB-108 notes that if one wheel slips, the other takes up the slack."
            ],
            "source": "https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf (Encoder Products Company TB-108 Rev. D 01/18 'Encoders with Measuring Wheels', p.3 Installation; p.1 dual-shaft / two-wheel note)"
          },
          {
            "rank": 2,
            "cause": "Wheel bounces or loses contact (low spring or down pressure, seams, surface irregularities), so it misses counts",
            "mechanism": "Seams make the wheel bounce off the strip and miss counts, so lengths drift long and uneven; more down force fixed it (EPC; TB-108, TB-547).",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver"
              ],
              "categories": [
                "encoder"
              ]
            },
            "checks": [
              "Watch the wheel at line speed, esp. at welds/splices, strip head/tail and wavy strip. Good: stays in contact. Bad: lifts, chatters or bounces.",
              "Check torsion spring/bracket load with wheel on strip. Good: firm steady contact, drags if turned by hand. Bad: weak/broken spring or seized pivot.",
              "Compare the cut-length error with the strip events. Faulty pattern: the long parts coincide with welds, seams or thickness changes."
            ],
            "fix": [
              "Raise spring/torsion setting or add weight until the wheel tracks; per TB-108 use the least force needed, never above rated bearing load.",
              "Free up or replace a seized pivot and replace a weak spring.",
              "Fit a heavier-duty spring-loaded wheel assembly, or dual wheels, as in the EPC case study."
            ],
            "source": "https://www.encoder.com/case-study-tru-trac-keeps-cut-lengths-accurate-every-time (Encoder Products Company case study 'Tru-Trac keeps cut lengths accurate every time' (Hipsher Tool & Die), sections The Problem / The Solution); https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf (Encoder Products Company TB-108 Rev. D 01/18 'Encoders with Measuring Wheels', p.3 Installation); https://www.encoder.com/hubfs/TB-547_Considerations%20for%20TRP%20Implementation_final.pdf (Encoder Products Company TB-547 Rev 1.0 06/2025 'Considerations for TRP Implementation', p.2 Error in measuring wheel applications)"
          },
          {
            "rank": 3,
            "cause": "Length scaling does not match the real wheel circumference (wrong scaling or prescale, worn or swapped wheel, wrong PPR or x4 setting)",
            "mechanism": "Resolution = encoder CPR and wheel circumference (TB-547 Eq.1); ±0.001 in diameter or wear, or a wrong H7CX prescale, gives length-proportional error.",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver",
                "omron-h7cx-a-screw",
                "omron-h7cx-a11-socket"
              ],
              "categories": [
                "encoder",
                "plc"
              ]
            },
            "checks": [
              "Measure wheel circumference (tape, or caliper diameter x pi) and compare with the PLC/counter constant. Bad: worn wheel or different wheel fitted.",
              "Scale/prescale 1 (or raw HSC), jog 1000 mm; expect (1000 / circumference) × PPR × multiplier (x1, x2, x4). A fixed % error gives the correction.",
              "Compare label PPR and quadrature multiplier (CLICK HSC quadrature, H7CX UP/DOWN C) with settings. Bad: error of exactly 2x, 4x or the PPR ratio.",
              "On H7CX read prescale (pscl) and decimal point; prescale should = length per pulse in display units (e.g. 0.5 m / 25 pulses = 0.02)."
            ],
            "fix": [
              "Correct the circumference or scale constant from the measured pulses per known length, then re-verify with a cut test.",
              "Replace a worn wheel and recalibrate. Schedule wheel inspection, because wear makes the error grow (TB-547).",
              "Set the PPR and x4 evaluation to match the installed encoder."
            ],
            "source": "https://www.encoder.com/hubfs/TB-547_Considerations%20for%20TRP%20Implementation_final.pdf (Encoder Products Company TB-547 Rev 1.0 06/2025 'Considerations for TRP Implementation', p.1 Rule 1 / Eq.1, p.2 Wheel Diameter and accumulation figure); https://files.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf?v=1 (Omron H7CX-N Multifunction Counter/Tachometer datasheet M079, p.18 Prescale Value (pscl))"
          },
          {
            "rank": 4,
            "cause": "Flying-shear dead-time (delay-time) correction not set/tuned: cut lands off position, worst on first cut after a stop and when speed changes",
            "mechanism": "Siemens flying saw: delay-time correction sets cut accuracy, esp. first cut after standstill or with changing lead speed; steady speed may be OK.",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive",
                "kinetix-5100-servo-drive",
                "sinamics-v90-pti-400v-servo-drive",
                "sinamics-v90-pn-servo-drive"
              ],
              "categories": [
                "servoDrive",
                "plc"
              ]
            },
            "checks": [
              "Log cut lengths (Siemens: last 10 in statistics.FSCutData, min/max). Bad: steady-speed parts OK but first part after a stop or accel parts off.",
              "Check last cut accuracy (status.lastCutAccuracy, Siemens HMI 'Status' page or similar). OK: near 0; bad: steady offset that varies with speed.",
              "Check external-encoder TO settings: velocity filter T1 (start 0.1 s) and following-axis delay-time correction (start 0.0065 s)."
            ],
            "fix": [
              "Enable actual-value extrapolation, then tune delay-time correction in steps until cut accuracy is in tolerance (Siemens §2.4.14).",
              "Add a velocity filter for a noisy encoder, and position hysteresis (start 5 mm) to stop false reversal from standstill (error 608)."
            ],
            "source": "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.13 Detecting the cutting length p.44-45; §2.4.14 Optimized settings for external encoders p.46-47)"
          },
          {
            "rank": 5,
            "cause": "Counter/PLC input too slow for encoder frequency (H7CX at 30 Hz, non-high-speed input, or encoder max response exceeded): lost counts, long parts",
            "mechanism": "H7CX: 30 Hz (16.7 ms) or 5/10 kHz via DIP pin 2; CLICK: only X1-X4 on C0-1xDDxE (100 kHz) count in HW; E6B2 limit = (freq/res) × 60. (see source)",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver",
                "omron-h7cx-a-screw",
                "omron-h7cx-a11-socket",
                "click-c0-dc-input-sink-source"
              ],
              "categories": [
                "encoder",
                "plc"
              ]
            },
            "checks": [
              "f = (line speed per s / wheel circumference) × PPR at max speed. Limits: H7CX 30 Hz or 5/10 kHz; CLICK 100 kHz; E6B2 100/50 kHz; TRD 200 kHz.",
              "H7CX: power down, read DIP. Pin 1 ON enables DIP settings; pin 2 ON = 5 kHz, OFF = 30 Hz. Bad: pin 2 OFF while counting an encoder.",
              "CLICK: encoder A/B must land on X1-X4 of a C0-1xDDxE CPU set as HSC Quadrature. Bad: wired to an input module or non-HSC input.",
              "Run the line slowly and then at full speed over the same known length. Expected: the same count. Faulty: fewer counts at high speed."
            ],
            "fix": [
              "Set the H7CX to the high counting speed (DIP pin 2 ON, or the counting-speed function setting), then cycle power.",
              "Move encoder to a high-speed counter input and set up the HSC, or use lower PPR or a bigger wheel to keep frequency within rating."
            ],
            "source": "https://files.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf?v=1 (Omron H7CX-N Multifunction Counter/Tachometer datasheet M079, p.5 Ratings (max. counting speed 30 Hz / 10 kHz), p.6 input-mode counting speeds, p.15 DIP switch settings); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, ch.3 High-Speed Input Configuration p.3-45 to 3-47); https://files.omron.eu/downloads/latest/datasheet/en/q085_e6b2-c_incremental_rotary_encoder_40_mm_datasheet_en.pdf?v=1 (Omron E6B2-C datasheet CSM_E6B2-C_DS_E_6_3, p.2 Ratings and Specifications, note *3)"
          },
          {
            "rank": 6,
            "cause": "Noise or false pulses on encoder line (long open-collector cable, run next to power wiring, poor shield/ground): extra or missing counts",
            "mechanism": "E6B2: avoid power lines; open-collector max 2 m, line-driver 100 m; false pulses at power on/off. SureServo2: separate, shield. Extra counts = short.",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver",
                "omron-h7cx-a-screw",
                "omron-h7cx-a11-socket"
              ],
              "categories": [
                "encoder",
                "plc"
              ]
            },
            "checks": [
              "Trace encoder cable. Bad: shares duct/tray with motor, VFD, servo or solenoid wiring, or open-collector/voltage-output cable over about 2 m.",
              "Line stopped, wheel still: watch the counter as main drive, servo and hydraulic pump start. Good: count steady. Bad: count jumps.",
              "Koyo TRD shield is not tied to the encoder body; terminate it at the control end per diagram. Bad: shield open, or grounded at both ends via frame.",
              "Check power-up order: counter should ignore input at least 0.1 s after encoder powers (H7CX waits 290 ms). Bad: a count on every power-up."
            ],
            "fix": [
              "Re-route the encoder cable away from power wiring and use shielded twisted-pair cable.",
              "For long runs, use a line-driver (differential) encoder and receiver.",
              "Add surge absorption on the encoder supply if surges are present, as the E6B2 datasheet recommends."
            ],
            "source": "https://files.omron.eu/downloads/latest/datasheet/en/q085_e6b2-c_incremental_rotary_encoder_40_mm_datasheet_en.pdf?v=1 (Omron E6B2-C datasheet CSM_E6B2-C_DS_E_6_3, p.4 Precautions for Safe Use 2-4 and Precautions for Correct Use (cable extension, wiring)); https://cdn.automationdirect.com/static/specs/encodertrd.pdf (AutomationDirect Koyo TRD-S/SH incremental encoder specifications, Electrical Specifications table and Wiring diagrams); https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (SureServo2 User Manual 1st Ed. Rev A 08/09/2021, ch.11 Troubleshooting, AL011 p.11-14)"
          },
          {
            "rank": 7,
            "cause": "Encoder is on a drive roll or motor instead of the strip, so roll slip is not measured",
            "mechanism": "Roll-mounted encoder (Rockwell master on a drive roll) counts full travel even if strip slips in forming rolls, so parts come out short.",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver"
              ],
              "categories": [
                "encoder",
                "vfd"
              ]
            },
            "checks": [
              "Find where the length encoder is mounted. Faulty for this cause: on a roll shaft or motor rather than on a wheel riding the strip.",
              "Mark strip and roll, run a known count. Good: strip travel = counted length. Bad: strip moves less = roll slip (see 'material-slips')."
            ],
            "fix": [
              "Measure the strip directly with a spring-loaded measuring wheel, or add registration or slip compensation in the motion program."
            ],
            "source": "https://www.rockwellautomation.com/en-us/support/product/product-downloads/innovation-center/flying-shear-application.html (Rockwell Automation Innovation Center 'Flying Shear Application': 'Is this useful for me?' component list and Web Control Routine rungs 2-5); https://www.encoder.com/conveying (Encoder Products Company 'Conveying in Material Handling', Surface-mounted measuring wheels: spring tension, wheel material, roller-shaft / drive mounting)"
          }
        ]
      },
      {
        "id": "shear-does-not-fire",
        "symptom": "Shear / cutter does not cut (doesn't fire, misses cuts)",
        "aliases": [
          "shear does not fire",
          "shear doesn't fire",
          "shear wont fire",
          "shear doesnt fire",
          "cutter doesnt cut",
          "shear doesnt cut",
          "shear wont cut",
          "cutter does not cut",
          "cutter doesn't cut",
          "shear does not cut",
          "shear misses cuts",
          "missed cut",
          "skips cuts",
          "no cut",
          "knife does not fire",
          "cut-off does not cut",
          "saw does not cut",
          "shear not cutting"
        ],
        "kind": "output-no-motion",
        "causes": [
          {
            "rank": 1,
            "cause": "Cut enable is never given or is withdrawn: the carriage did not reach synchronism in time, or overshot the maximum cut position",
            "mechanism": "Siemens: cut only while 'cutPossible' and saw synced; warning 9000 = sync position missed, 9001 = max cut position overshot. (see source)",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive",
                "kinetix-5100-servo-drive",
                "sinamics-v90-pti-400v-servo-drive",
                "sinamics-v90-pn-servo-drive"
              ],
              "categories": [
                "servoDrive",
                "plc"
              ]
            },
            "checks": [
              "Read flying-shear FB status/HMI. Siemens errorID 9000 (sync position missed) or 9001 (max cut position overshot). Bad: either shows on a skipped cut.",
              "Trend cutPossible and cut command vs carriage position. Good: enable TRUE before cut point, command follows. Bad: never TRUE, or drops before command.",
              "Compare cut length and line speed with carriage return time. Bad: carriage still returning when next sync starts; worse with short parts, high speed.",
              "Check that the cutDone feedback arrives. The enable ends at cutDone or at maxPosToCut. Faulty: no cutDone, so the carriage runs to maxPosToCut."
            ],
            "fix": [
              "Increase return velocity, accel or jerk, or enable Running Back Optimization so the carriage is home in time (Siemens §2.4.11-2.4.12).",
              "Lower the line speed for short cut lengths, or extend the synchronous stroke or maxPosToCut where the machine allows.",
              "Fix a missing cutDone signal (blade-down or blade-up sensor)."
            ],
            "source": "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.6 Cut enable p.36, §2.4.7 Termination conditions p.37, §2.4.11-2.4.12 p.41-44, §2.7.3 Error codes p.70); https://filecenter.deltaww.com/appcenter/download/Fae_058_en.pdf (Delta Electronics Product Application 'DVP-PM Series PLC in a Cut-to-Length Flying Shear Cutting Machine', Oct 2010, p.1 Structure, p.2 Establishing CAM Table / Modifying Cutting Length)"
          },
          {
            "rank": 2,
            "cause": "Cut command reaches the valve but the spool does not shift: coil voltage outside ±10 %, open coil or connector, or a coil burnt from overheating",
            "mechanism": "4WE 6: solenoid shifts spool, spring returns it. ±10 % of nominal, 100 % duty; limits set at 10 % undervoltage, below that spool may not shift.",
            "devices": {
              "profileIds": [
                "rexroth-4we6-6x-dc-solenoid",
                "click-dc-output-sinking",
                "click-dc-output-sourcing"
              ],
              "categories": [
                "solenoidValve",
                "plc",
                "relay"
              ]
            },
            "checks": [
              "With cut output ON, measure at the coil plug, not the PLC. Good: 24 VDC ±10 % (21.6-26.4 V) on a 24 V coil. Bad: under 21.6 V, or 0 V with LED on.",
              "With power off, measure the coil resistance and compare it with the coil data. Faulty: open circuit, or a short.",
              "Keep everyone clear (machine will move). Manual override (N or N9; to ~50 bar tank): strokes = electrical fault; no stroke = hydraulic.",
              "CLICK sinking DC outputs need voltage on their supply terminal; confirm it. Bad: output LED on but no voltage at the load."
            ],
            "fix": [
              "Restore the coil supply (supply sizing, voltage drop, connector) to within ±10 %.",
              "Replace an open or burnt coil (the coil can be changed without opening the pressure chamber) and the mating connector.",
              "Fix the PLC output power or the interposing relay."
            ],
            "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE23178 (Bosch Rexroth data sheet RE 23178 edition 2013-06, directional spool valve 4WE 6 ...6X, p.6 Function, section; p.8 Technical data electric; p.10 Performance limits notice; p.4 note 2 and p.8 Notices on manual override); https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, ch.2 p.2-23 power budgeting note on sinking DC outputs; p.2-61 C0-10DD1E-D input specifications)"
          },
          {
            "rank": 3,
            "cause": "Hydraulic pressure is low or the pressure-switch permissive is open, so the cut is inhibited or too weak",
            "mechanism": "HED 8 micro switch actuates below set pressure, releases at set pressure; low pressure or high setting blocks 'pressure OK'. Set with a gauge only.",
            "devices": {
              "profileIds": [
                "rexroth-hed8-piston-pressure-switch",
                "rexroth-4we6-6x-dc-solenoid"
              ],
              "categories": [
                "sensor",
                "solenoidValve"
              ]
            },
            "checks": [
              "Read a gauge at the HED 8 pressure take-off while the pump runs. Expected: system pressure above the switch set point. Faulty: below it.",
              "K14: 1-2 open and 1-3 close on rising pressure. Good: 'pressure OK' input ON at running pressure. Bad: no change at set point, or wrong pair wired.",
              "Raise pressure slowly and compare switch point with a gauge. Good: within about ±1 % of set (repeatability). Bad: far off set point, or chatter."
            ],
            "fix": [
              "Restore system pressure (pump, relief setting), and reset the HED 8 against a gauge.",
              "Mount the switch where vibration is low and shield it from pressure surges (per data sheet); replace it if the differential has drifted."
            ],
            "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE50061 (Bosch Rexroth data sheet RE 50061/02.12, hydro-electric pressure switch HED 8, p.2 note 5, p.3 Function and Notice, p.4-5 Technical data, p.7 switching function / terminals)"
          },
          {
            "rank": 4,
            "cause": "Counter-based (non-servo) cut: output never turns on; set value out of countable range, input blocked in sensor wait time, or wrong input type",
            "mechanism": "H7CX: output stays OFF if set value > {max countable - prescale}; inputs ignored 290 ms after power-up; NPN/PNP on DIP pin 8; counter-fired shears.",
            "devices": {
              "profileIds": [
                "omron-h7cx-a-screw",
                "omron-h7cx-a11-socket",
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver"
              ],
              "categories": [
                "plc",
                "encoder"
              ]
            },
            "checks": [
              "Watch PV running. Good: counts to set value, output LED on. Bad: PV static (NPN/PNP or wiring), or passes set value with no output (set/prescale).",
              "Match DIP pin 8 to encoder: NPN open-collector (sinking) needs NPN input, PNP needs PNP. Pin 1 must be ON for DIP settings to work.",
              "Check that the set value is less than (maximum countable value - prescale value)."
            ],
            "fix": [
              "Correct the input type, set value and prescale; cycle power after changing DIP switches."
            ],
            "source": "https://files.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf?v=1 (Omron H7CX-N Multifunction Counter/Tachometer datasheet M079, p.5 Ratings (sensor waiting time, input type), p.15 DIP switch settings, p.18 Prescale value notes)"
          },
          {
            "rank": 5,
            "cause": "Saw/shear axis is in fault, so the automatic cut is cancelled",
            "mechanism": "Siemens: a saw error cancels the auto cut (source 1000 / errorID 9110, saw TO error). Diagnose the servo alarm under 'line-stops-servo-alarm'.",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive",
                "kinetix-5100-servo-drive",
                "sinamics-v90-pti-400v-servo-drive",
                "sinamics-v90-pn-servo-drive"
              ],
              "categories": [
                "servoDrive",
                "servoMotor"
              ]
            },
            "checks": [
              "Read the drive display and the function-block errorID / errorSource. Faulty: any active drive alarm (e.g. SureServo2 AL009, Kinetix E 009, V90 F7452)."
            ],
            "fix": [
              "Clear the drive fault at its cause (see 'line-stops-servo-alarm'), reset, and restart automatic mode."
            ],
            "source": "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.7 Termination conditions p.37, §2.7.2-2.7.3 p.69-70)"
          }
        ]
      },
      {
        "id": "material-slips",
        "symptom": "Material slips on the rolls or under the measuring wheel (encoder counts low)",
        "aliases": [
          "material slips",
          "material slipping",
          "strip slips",
          "slipping on rolls",
          "slips under measuring wheel",
          "measuring wheel slips",
          "wheel slipping",
          "encoder counts low",
          "counts low",
          "low counts",
          "missing counts",
          "lost counts",
          "encoder wheel skids",
          "wheel skidding"
        ],
        "kind": "no-input",
        "causes": [
          {
            "rank": 1,
            "cause": "Measuring wheel misaligned, so it skids instead of rolling",
            "mechanism": "TB-108 says misalignment makes the wheel skid and is 'the most common cause' when measurements do not come out as expected.",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver"
              ],
              "categories": [
                "encoder"
              ]
            },
            "checks": [
              "Check the wheel runs in line with strip travel. Bad: angled wheel, scuffed band or one-sided tread wear, or bent bracket.",
              "Mark the wheel and the strip and jog a known length. Expected: wheel revolutions × circumference = strip travel. Faulty: the wheel turns less."
            ],
            "fix": [
              "Re-align the bracket or torsion arm. Replace the wheel if it is worn unevenly."
            ],
            "source": "https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf (Encoder Products Company TB-108 Rev. D 01/18 'Encoders with Measuring Wheels', p.3 Installation)"
          },
          {
            "rank": 2,
            "cause": "Not enough tracking force (weak or mis-set spring, seized pivot) or the wheel bounces off seams and irregularities",
            "mechanism": "TB-108: unsprung brackets rely on weight; add weight if friction is too low. EPC: spring tension stops slip from motion, seams, contaminants.",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver"
              ],
              "categories": [
                "encoder"
              ]
            },
            "checks": [
              "Push the arm by hand. Good: firm even spring load, free pivot. Bad: weak spring, seized pivot, or arm bottomed on its stop.",
              "Watch the wheel during acceleration, deceleration and at welds or splices. Faulty: the wheel stops or lifts momentarily."
            ],
            "fix": [
              "Raise spring setting or add weight (minimum force, within bearing rating, TB-108); free or replace the pivot; use a heavier or dual-wheel unit."
            ],
            "source": "https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf (Encoder Products Company TB-108 Rev. D 01/18 'Encoders with Measuring Wheels', p.3 Installation); https://www.encoder.com/conveying (Encoder Products Company 'Conveying in Material Handling', Surface-mounted measuring wheels: spring tension, wheel material, roller-shaft / drive mounting); https://www.encoder.com/case-study-tru-trac-keeps-cut-lengths-accurate-every-time (Encoder Products Company case study 'Tru-Trac keeps cut lengths accurate every time' (Hipsher Tool & Die), sections The Problem / The Solution)"
          },
          {
            "rank": 3,
            "cause": "Wheel surface wrong for the material, worn, or contaminated",
            "mechanism": "TB-108: harder wheels last longer but grip less, wear, and change size with temperature; knurled aluminum/urethane for metal. EPC: contaminants slip.",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver"
              ],
              "categories": [
                "encoder"
              ]
            },
            "checks": [
              "Inspect the tread. Faulty: glazed or smooth knurl, urethane worn or cracked, a coating of oil or fines, or a wheel type unsuited to oiled steel.",
              "Measure the wheel circumference (see 'cut-length-wrong' cause 3)."
            ],
            "fix": [
              "Clean or replace the wheel; pick the surface for the material (knurled aluminum or urethane for metal, TB-108). Recalibrate scaling afterwards."
            ],
            "source": "https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf (Encoder Products Company TB-108 Rev. D 01/18 'Encoders with Measuring Wheels', p.2 Selecting the Proper Measuring Wheel); https://www.encoder.com/conveying (Encoder Products Company 'Conveying in Material Handling', Surface-mounted measuring wheels: spring tension, wheel material, roller-shaft / drive mounting)"
          },
          {
            "rank": 4,
            "cause": "Wheel turns but counts lost electrically: counter too slow, wrong NPN/PNP mode, low encoder supply, or speed beyond encoder's electrical response",
            "mechanism": "H7CX 30 Hz or 5/10 kHz, NPN/PNP (DIP 2, 8); E6B2 5-24 VDC, ≤5 %, (freq/res) × 60 rpm; TRD 4.75-26.4/4.75-5.25 VDC, ≤3 %, 200 kHz. (see source)",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver",
                "omron-h7cx-a-screw",
                "omron-h7cx-a11-socket",
                "click-c0-dc-input-sink-source"
              ],
              "categories": [
                "encoder",
                "plc",
                "powerSupply"
              ]
            },
            "checks": [
              "Measure encoder supply at its connector, line running. Good: in range (e.g. 5 V ±5 % line-driver). Bad: low from drop on long thin cable, or ripple.",
              "Mark wheel, turn one rev by hand, read count. Good: PPR × multiplier. Bad: fewer or none on a channel; lost B halves x4 count or makes it go up/down.",
              "Match input to encoder: NPN open-collector (e.g. Koyo TRD-S..A) needs CLICK 'Sinking Encoder (Open Collector)' wiring or H7CX NPN; PNP needs sourcing.",
              "Check the input frequency at maximum line speed against the counter's rating (see 'cut-length-wrong' cause 5)."
            ],
            "fix": [
              "Fix the supply (feed the encoder from a dedicated, adequately sized 24 V or 5 V supply, and use heavier conductors).",
              "Set the counter input type and speed, or move the encoder to an HSC input. Use a line-driver encoder for long cables."
            ],
            "source": "https://files.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf?v=1 (Omron H7CX-N Multifunction Counter/Tachometer datasheet M079, p.5 Ratings, p.15 DIP switch settings); https://files.omron.eu/downloads/latest/datasheet/en/q085_e6b2-c_incremental_rotary_encoder_40_mm_datasheet_en.pdf?v=1 (Omron E6B2-C datasheet CSM_E6B2-C_DS_E_6_3, p.2 Ratings and Specifications); https://cdn.automationdirect.com/static/specs/encodertrd.pdf (AutomationDirect Koyo TRD-S/SH incremental encoder specifications, Electrical Specifications table and Wiring diagrams); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, ch.3 High-Speed Input Configuration p.3-45 to 3-47)"
          },
          {
            "rank": 5,
            "cause": "Strip slips in the forming or feed rolls (not under the wheel), seen only when the encoder is on a roll or motor",
            "mechanism": "Rockwell master encoder on a drive roll, with a slip-compensation hook; EPC: surface wheel reads material, shaft/motor encoders read the drive.",
            "devices": {
              "profileIds": [
                "koyo-trd-encoder-open-collector",
                "koyo-trd-encoder-push-pull",
                "koyo-trd-encoder-line-driver",
                "omron-e6b2-c-npn-open-collector",
                "omron-e6b2-c-line-driver",
                "inovance-md500-md290-vfd"
              ],
              "categories": [
                "encoder",
                "vfd"
              ]
            },
            "checks": [
              "Mark strip at entry; over a long run compare strip travel with roll/motor encoder length. Bad: strip travels less than reported.",
              "Compare steady speed with acceleration. Faulty: the error appears mainly during acceleration or deceleration."
            ],
            "fix": [
              "Measure strip directly with a spring-loaded wheel, or add registration/slip compensation in motion logic. Fix roll pinch per machine builder."
            ],
            "source": "https://www.rockwellautomation.com/en-us/support/product/product-downloads/innovation-center/flying-shear-application.html (Rockwell Automation Innovation Center 'Flying Shear Application': 'Is this useful for me?' component list and Web Control Routine rungs 2-5); https://www.encoder.com/conveying (Encoder Products Company 'Conveying in Material Handling', Surface-mounted measuring wheels: spring tension, wheel material, roller-shaft / drive mounting)"
          }
        ]
      },
      {
        "id": "shear-cuts-crooked-or-burr",
        "symptom": "Shear cuts crooked / angled, buckles the strip, or leaves a burr",
        "aliases": [
          "crooked cut",
          "cut not square",
          "angled cut",
          "cut at an angle",
          "burr",
          "heavy burr",
          "ragged cut",
          "strip buckles at shear",
          "material buckles during cut",
          "torn cut",
          "cut not clean"
        ],
        "causes": [
          {
            "rank": 1,
            "cause": "Cut fired while the carriage is not matched to strip speed (cut before synchronism, or too-short synchronous stroke)",
            "mechanism": "Cut allowed only with carriage at line speed (Siemens cutPossible; Delta CAM sync section). Inferred: speed mismatch mid-cut drags/buckles strip.",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive",
                "kinetix-5100-servo-drive",
                "sinamics-v90-pti-400v-servo-drive",
                "sinamics-v90-pn-servo-drive"
              ],
              "categories": [
                "servoDrive",
                "plc"
              ]
            },
            "checks": [
              "Trend carriage and line speed with cut command. Good: equal from before blade-down to after blade-up. Bad: cut on accel ramp, or decel with blade in.",
              "Confirm the cut command is interlocked with the sync/cut-enable bit (cutPossible). Bad: cut fired from a timer or length count only."
            ],
            "fix": [
              "Interlock cut on sync; lengthen the cam synchronous section (Delta: synchronous stroke; Siemens: sync profile) so the whole cut is at matched speed."
            ],
            "source": "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.1 Symmetric synchronization p.25-26, §2.4.6 Cut enable p.36); https://filecenter.deltaww.com/appcenter/download/Fae_058_en.pdf (Delta Electronics Product Application 'DVP-PM Series PLC in a Cut-to-Length Flying Shear Cutting Machine', Oct 2010, p.1 Structure, p.2 Establishing CAM Table / Modifying Cutting Length)"
          },
          {
            "rank": 2,
            "cause": "Blade cycle too slow for sync window (slow hydraulic/pneumatic stroke, or cutDone too early): carriage brakes or returns mid-cut",
            "mechanism": "Siemens: carriage stops (decHaltAfterCut), returns on cutDone or maxPosToCut; Rockwell: open-loop shears on on-delays. Slow stroke = off-speed cut.",
            "devices": {
              "profileIds": [
                "rexroth-4we6-6x-dc-solenoid",
                "rexroth-hed8-piston-pressure-switch",
                "sureservo2-servo-drive",
                "kinetix-5100-servo-drive",
                "sinamics-v90-pti-400v-servo-drive",
                "sinamics-v90-pn-servo-drive"
              ],
              "categories": [
                "solenoidValve",
                "servoDrive"
              ]
            },
            "checks": [
              "Time blade down/up stroke vs sync window (blade sensors or scope on valve coil). Bad: stroke longer than the carriage stays synchronized.",
              "Check what generates cutDone: a blade-up sensor is correct. Faulty: a fixed timer shorter than the measured stroke."
            ],
            "fix": [
              "Fix slow stroke (see 'hydraulic-cutter-slow'), make cutDone from a blade-up sensor, or lengthen sync section or lower line speed."
            ],
            "source": "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.6 Cut enable p.36, §2.4.11 Return velocity p.41-42); https://www.rockwellautomation.com/en-us/support/product/product-downloads/innovation-center/flying-shear-application.html (Rockwell Automation Innovation Center 'Flying Shear Application': 'Is this useful for me?' component list and Web Control Routine rungs 2-5)"
          }
        ]
      },
      {
        "id": "line-stops-servo-alarm",
        "symptom": "Line stops with a servo / flying-shear axis alarm",
        "aliases": [
          "servo alarm",
          "servo fault",
          "shear servo alarm",
          "carriage servo fault",
          "line stops servo",
          "position deviation alarm",
          "following error",
          "AL009",
          "E 009",
          "F7452",
          "overload alarm",
          "AL006",
          "regen alarm",
          "AL005",
          "encoder error AL011",
          "flying shear fault"
        ],
        "kind": "display-code",
        "causes": [
          {
            "rank": 1,
            "cause": "Excessive position deviation / following error during the carriage's synchronization or return moves",
            "mechanism": "SureServo2 AL009 (Kinetix 5100 E 009, V90 F7452): low deviation limit/gain/torque limit, high load, E-gear, loose cables, speed limit. (see source)",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive",
                "kinetix-5100-servo-drive",
                "sinamics-v90-pti-400v-servo-drive",
                "sinamics-v90-pn-servo-drive"
              ],
              "categories": [
                "servoDrive",
                "servoMotor"
              ]
            },
            "checks": [
              "Read the alarm code on the drive (SureServo2 AL009 / Kinetix E 009 / V90 F7452).",
              "Check P2.035 (position deviation) on SureServo2/Kinetix 5100 (ID219) or p2546 on V90; also gain, torque limit and P1.055 max speed limit.",
              "Monitor torque (SureServo2 P0.002 = 11, average torque %) during the return stroke. Faulty: torque at the limit during acceleration.",
              "Check E-gear P1.044/P1.045 against the mechanics, and check that the UVW power cables are tight."
            ],
            "fix": [
              "Lower return accel/jerk or use RBO (Siemens §2.4.12); re-tune gains, fix E-gear, set deviation limit; resize motor if torque saturates."
            ],
            "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (SureServo2 User Manual 1st Ed. Rev A 08/09/2021, ch.11 Troubleshooting, AL009 p.11-13); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (Kinetix 5100 User Manual 2198-UM004D ch.16 p.449-454) with https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, E 009); https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.258, F7452); https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.11-2.4.12 p.41-44)"
          },
          {
            "rank": 2,
            "cause": "Overload: average torque persistently above 100 % (cycle rate too high for the motor, mechanical drag)",
            "mechanism": "SureServo2 AL006: persistent overload, bad control params, motor/encoder wiring, bad encoder; also vibration or high accel/decel (fast flying shear).",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive",
                "kinetix-5100-servo-drive",
                "sinamics-v90-pti-400v-servo-drive",
                "sinamics-v90-pn-servo-drive"
              ],
              "categories": [
                "servoDrive",
                "servoMotor"
              ]
            },
            "checks": [
              "Set P0.002 = 11 and watch the average torque %. Expected: below 100 %. Faulty: continuously above 100 %.",
              "Check the carriage for binding: rails, bearings, cable chain."
            ],
            "fix": [
              "Reduce the acceleration or deceleration (or the cuts per minute), fix mechanical drag, or increase the motor or drive capacity."
            ],
            "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (SureServo2 User Manual 1st Ed. Rev A 08/09/2021, ch.11 Troubleshooting, AL006 p.11-12)"
          },
          {
            "rank": 3,
            "cause": "Regeneration error: braking energy from the carriage's hard decelerations has no resistor, or the resistor parameters are wrong",
            "mechanism": "SureServo2 AL005 / AL010: wrong or missing regen resistor, P1.053 not 0 with no resistor, bad P1.052/P1.053. Each carriage stop feeds the DC bus.",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive"
              ],
              "categories": [
                "servoDrive"
              ]
            },
            "checks": [
              "Check regen resistor is connected, ohms match P1.052, watts match P1.053. Bad: open or wrong resistor, or P1.053 not 0 with no resistor fitted."
            ],
            "fix": [
              "Fit a correctly sized regen resistor and set P1.052/P1.053 to match."
            ],
            "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (SureServo2 User Manual 1st Ed. Rev A 08/09/2021, ch.11 Troubleshooting, AL005 p.11-11, AL010 p.11-13)"
          },
          {
            "rank": 4,
            "cause": "Servo encoder error from wiring, connector or interference",
            "mechanism": "SureServo2 AL011: bad/loose encoder wiring, interference cutting the link, damaged encoder. Fix: ground UVW to heat sink, separate and shield cable.",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive",
                "kinetix-5100-servo-drive"
              ],
              "categories": [
                "servoDrive",
                "servoMotor"
              ]
            },
            "checks": [
              "Set P0.002 = -80 to watch the encoder communication-error count. Expected: steady. Faulty: it keeps increasing, which means interference.",
              "Re-seat CN2 and the motor encoder connector, and check the cable for damage."
            ],
            "fix": [
              "Fix the grounding and cable routing, use shielded encoder cable, and replace the cable or motor if the alarm persists."
            ],
            "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (SureServo2 User Manual 1st Ed. Rev A 08/09/2021, ch.11 Troubleshooting, AL011 p.11-14)"
          },
          {
            "rank": 5,
            "cause": "Pulse-train command frequency too high (PLC PTO driving the carriage servo)",
            "mechanism": "SureServo2 AL008: pulse command frequency above interface rating; on PTO flying shears, when carriage speed for a faster line exceeds the pulse limit.",
            "devices": {
              "profileIds": [
                "sureservo2-servo-drive",
                "sinamics-v90-pti-400v-servo-drive"
              ],
              "categories": [
                "servoDrive",
                "plc"
              ]
            },
            "checks": [
              "Scope the pulse input at the maximum line speed and compare it with the drive's rated pulse input. Faulty: above the rating."
            ],
            "fix": [
              "Change the E-gear so fewer pulses per unit are needed, or use the drive's high-speed differential pulse input or a network motion interface."
            ],
            "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (SureServo2 User Manual 1st Ed. Rev A 08/09/2021, ch.11 Troubleshooting, AL008 p.11-12)"
          }
        ]
      },
      {
        "id": "hydraulic-cutter-slow",
        "symptom": "Hydraulic cutter is slow / weak or strokes late",
        "aliases": [
          "hydraulic shear slow",
          "cutter slow",
          "slow cut",
          "shear slow",
          "shear weak",
          "cut late",
          "knife slow to return",
          "valve slow to shift",
          "hydraulic cutter slow",
          "press slow"
        ],
        "causes": [
          {
            "rank": 1,
            "cause": "System pressure low, or pressure switch set or drifted (checked at the HED 8 pressure take-off)",
            "mechanism": "HED 8 watches system pressure; set it only with a gauge; differential widens as oil ages. Low pressure gives slow, weak strokes. Check pressure first.",
            "devices": {
              "profileIds": [
                "rexroth-hed8-piston-pressure-switch"
              ],
              "categories": [
                "sensor"
              ]
            },
            "checks": [
              "Fit a gauge at the switch take-off and cut. Good: at/above machine spec with no big dip during stroke. Bad: low, or a deep dip.",
              "Compare where the HED 8 switches with the gauge. Faulty: the switch point is far from the setting, or the switch chatters."
            ],
            "fix": [
              "Restore pressure (pump and relief valve per the machine builder) and reset the HED 8 against a gauge."
            ],
            "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE50061 (Bosch Rexroth data sheet RE 50061/02.12, hydro-electric pressure switch HED 8, p.2 note 5, p.3 Function and Notice, p.5 Technical data and Notice on switching pressure differential)"
          },
          {
            "rank": 2,
            "cause": "Coil undervoltage (below -10 %) or a hot coil, giving a slow or incomplete spool shift",
            "mechanism": "4WE 6 coil ±10 %; limits set hot at 10 % undervoltage; lower voltage = less solenoid force vs flow. DC switching ON 25-45 ms, OFF 10-25 ms.",
            "devices": {
              "profileIds": [
                "rexroth-4we6-6x-dc-solenoid",
                "click-dc-output-sinking",
                "click-dc-output-sourcing"
              ],
              "categories": [
                "solenoidValve",
                "powerSupply"
              ]
            },
            "checks": [
              "Measure the coil voltage at the plug while it is energized and the cut is running. Expected: nominal ±10 %. Faulty: below -10 %.",
              "Scope coil voltage vs blade-motion sensor. Good: motion within tens of ms (DC ON time 25-45 ms per data sheet). Bad: much longer."
            ],
            "fix": [
              "Restore the coil supply voltage (supply sizing, wire gauge, connector) and replace a damaged coil."
            ],
            "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE23178 (Bosch Rexroth data sheet RE 23178 edition 2013-06, directional spool valve 4WE 6 ...6X, p.8 Technical data electric; p.10 Performance limits notice)"
          },
          {
            "rank": 3,
            "cause": "Oil too cold or too hot (viscosity outside the test condition), which changes switching times",
            "mechanism": "Switching times are rated at 40 °C and 46 cSt; other fluid temperatures, operating time and conditions change them.",
            "devices": {
              "profileIds": [
                "rexroth-4we6-6x-dc-solenoid"
              ],
              "categories": [
                "solenoidValve"
              ]
            },
            "checks": [
              "Read the oil temperature. Faulty: slow cuts at cold start that improve as the machine warms up, or slow cuts at high oil temperature."
            ],
            "fix": [
              "Warm up the hydraulics before production, or add oil heating or cooling to keep the oil near its design temperature."
            ],
            "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE23178 (Bosch Rexroth data sheet RE 23178 edition 2013-06, directional spool valve 4WE 6 ...6X, p.8 Technical data electric, note 3)"
          },
          {
            "rank": 4,
            "cause": "Contaminated oil, so the spool is sticky or slow",
            "mechanism": "4WE 6 needs cleanliness class 20/18/15 (ISO 4406); good filtration prevents faults and extends component life.",
            "devices": {
              "profileIds": [
                "rexroth-4we6-6x-dc-solenoid",
                "rexroth-hed8-piston-pressure-switch"
              ],
              "categories": [
                "solenoidValve"
              ]
            },
            "checks": [
              "Take an oil sample for a particle count, and check the filter element and its clogging indicator. Expected: 20/18/15 or better. Faulty: worse."
            ],
            "fix": [
              "Change the filters, clean or flush the system, and replace the valve if the spool still sticks."
            ],
            "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE23178 (Bosch Rexroth data sheet RE 23178 edition 2013-06, directional spool valve 4WE 6 ...6X, p.7 Technical data hydraulic, note 1)"
          },
          {
            "rank": 5,
            "cause": "Valve internal leakage grown over life, or flow above the valve's performance limit",
            "mechanism": "Internal leakage is inherent and grows with age. Over the flow limit fit a throttle insert; one-way flow (e.g. P to A, B blocked) may lower the limit.",
            "devices": {
              "profileIds": [
                "rexroth-4we6-6x-dc-solenoid"
              ],
              "categories": [
                "solenoidValve"
              ]
            },
            "checks": [
              "Hold the cylinder; check drift or flow noise through the de-energized valve; compare stroke speed with commissioning. Bad: drift, or slower than new.",
              "Check the cylinder flow against the 4WE 6 performance-limit curves for the spool symbol in use."
            ],
            "fix": [
              "Replace the worn valve. Fit a throttle insert, or a larger valve, if the flow exceeds the performance limit."
            ],
            "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE23178 (Bosch Rexroth data sheet RE 23178 edition 2013-06, directional spool valve 4WE 6 ...6X, p.6 Notices; p.10-12 Performance limits)"
          }
        ]
      }
    ],
    "sources": [
      "https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf",
      "https://www.encoder.com/case-study-tru-trac-keeps-cut-lengths-accurate-every-time",
      "https://www.encoder.com/hubfs/TB-547_Considerations%20for%20TRP%20Implementation_final.pdf",
      "https://files.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf?v=1",
      "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf",
      "https://files.omron.eu/downloads/latest/datasheet/en/q085_e6b2-c_incremental_rotary_encoder_40_mm_datasheet_en.pdf?v=1",
      "https://cdn.automationdirect.com/static/specs/encodertrd.pdf",
      "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf",
      "https://www.rockwellautomation.com/en-us/support/product/product-downloads/innovation-center/flying-shear-application.html",
      "https://www.encoder.com/conveying",
      "https://filecenter.deltaww.com/appcenter/download/Fae_058_en.pdf",
      "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE23178",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf",
      "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE50061",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx",
      "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf"
    ]
  }
];
