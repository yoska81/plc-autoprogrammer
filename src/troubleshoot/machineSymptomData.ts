import type { MachineSymptomMap } from "./machineSymptoms";

/**
 * Machine-level symptom maps (see machineSymptoms.ts), one per machine type, from cited maker documents.
 * Roll former with servo flying shear: Encoder Products measuring-wheel notes (TB-108 ranks wheel misalignment as the
 * most common cause), Siemens flying-saw application, Rexroth valve / pressure switch data sheets, H7CX / E6B2 /
 * CLICK / SureServo2 manuals. Where no source ranks causes, the order follows the documents' emphasis (see mechanism).
 */
export const MACHINE_SYMPTOM_DATA: MachineSymptomMap[] = [{
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
          "mechanism": "EPC TB-108 states that misalignment makes the wheel skid and that 'if measurements are not coming out as expected, mis-alignment is the most common cause'. Lost travel means the counter reaches the preset late: parts come out long, by a varying amount. This is the only cause in these documents that a maker explicitly ranks.",
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
            "Stop the line, lock out, and look along the strip: the wheel face must be square to the strip travel, and the axle must be 90 degrees to the direction of travel. Expected: the wheel tracks straight. Faulty: the wheel sits at an angle or the bracket is twisted.",
            "Inspect the wheel tread. Expected: even wear across the width. Faulty: wear on one edge, scuffing or a polished band, which shows the wheel is skidding sideways (TB-108: continuous misalignment causes uneven wheel wear).",
            "Check the encoder bearings by hand with the wheel off the strip. Expected: smooth rotation with no axial play. Faulty: rough or loose bearings from axial load (TB-108: misalignment loads the shaft axially and wears the bearings early)."
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
          "mechanism": "The EPC case study traced finished sheet length 'varying over time' to an encoder 'missing counts occasionally' because seams made the wheel 'jump and lose contact with the surface'. More down pressure cured it. TB-108 calls for enough tracking friction from the spring or bracket weight, and TB-547 lists surface irregularities as a source of position error. Missed counts make parts long and inconsistent.",
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
            "Watch the wheel at production speed, particularly at coil welds or splices, the strip head and tail, and wavy strip. Expected: the wheel stays on the strip. Faulty: the wheel visibly lifts, chatters or bounces.",
            "Check the torsion-arm spring or the bracket loading with the wheel on the strip. Expected: firm, steady contact; the wheel cannot be turned by hand against the moving strip without obvious drag. Faulty: a weak or broken spring, or a pivot that has seized so the arm cannot follow.",
            "Compare the cut-length error with the strip events. Faulty pattern: the long parts coincide with welds, seams or thickness changes."
          ],
          "fix": [
            "Increase the spring or torsion setting, or add weight, until the wheel tracks. TB-108 says to use the minimum force needed and never exceed the rated bearing load.",
            "Free up or replace a seized pivot and replace a weak spring.",
            "Fit a heavier-duty spring-loaded wheel assembly, or dual wheels, as in the EPC case study."
          ],
          "source": "https://www.encoder.com/case-study-tru-trac-keeps-cut-lengths-accurate-every-time (Encoder Products Company case study 'Tru-Trac keeps cut lengths accurate every time' (Hipsher Tool & Die), sections The Problem / The Solution); https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf (Encoder Products Company TB-108 Rev. D 01/18 'Encoders with Measuring Wheels', p.3 Installation); https://www.encoder.com/hubfs/TB-547_Considerations%20for%20TRP%20Implementation_final.pdf (Encoder Products Company TB-547 Rev 1.0 06/2025 'Considerations for TRP Implementation', p.2 Error in measuring wheel applications)"
        },
        {
          "rank": 3,
          "cause": "Length scaling does not match the real wheel circumference (wrong scaling or prescale, worn or swapped wheel, wrong PPR or x4 setting)",
          "mechanism": "Linear resolution comes from the encoder CPR and the wheel circumference (TB-547 Eq.1). TB-547 notes that a ±0.001 in wheel-diameter tolerance alone can cause up to ten times the encoder's own error, that wheel wear makes the error grow over time, and that the error accumulates with every revolution. The Omron H7CX datasheet warns that 'if the prescale value setting is incorrect, a counting error will occur'. The result is an error proportional to length: long parts are off by more than short ones, and the error does not change with speed.",
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
            "Measure the actual wheel circumference with a tape around the tread, or measure the diameter with calipers and multiply by pi. Compare it with the circumference or scaling constant in the PLC or counter. Expected: they agree to within the tolerance you need. Faulty: the wheel is worn smaller, or a different wheel size has been fitted.",
            "Count pulses over a known length: set the scale or prescale to 1, or watch the raw HSC count, jog exactly 1000 mm (marked on the strip), and read the count. Expected count = (1000 / circumference) × PPR × the evaluation multiplier (x1, x2 or x4). Faulty: the count differs by a fixed percentage, which gives the correction factor.",
            "Check the encoder PPR on its label against the PLC or counter setting, and check the quadrature multiplier (CLICK HSC quadrature mode, or the H7CX input mode UP/DOWN C). Faulty: a mismatch gives an error of exactly 2x or 4x, or one equal to the ratio of the two PPRs.",
            "On an H7CX, read the prescale value (pscl) and the decimal point. Expected: prescale = length per pulse in display units (the datasheet example is 0.5 m / 25 pulses = 0.02)."
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
          "cause": "Flying-shear delay-time (dead-time) correction not set or tuned, so the cut lands off position, worst on the first cut after a stop and during speed changes",
          "mechanism": "The Siemens flying-saw example says the delay-time correction for the following axis 'is important for cutting accuracy'. It also says the setting is 'particularly important for applications with measuring inputs or changing leading axis velocity, e.g. for the first material cut after a standstill'. At constant speed the length can still be good, because the inaccuracies are compensated from cut to cut. The Siemens note gives this as a tuning requirement; it does not rank it against measuring-wheel faults.",
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
            "Log the cut lengths (the Siemens example buffers the last 10 cuts in statistics.FSCutData, min/max) and compare the first part after a stop and the parts cut during acceleration with parts cut at steady speed. Faulty pattern: steady-speed parts are good, but the first part or parts cut during acceleration are long or short.",
            "Read the last cut-position accuracy (status.lastCutAccuracy on the Siemens HMI 'Status' page, or the equivalent in other controllers). Expected: near 0. Faulty: a consistent offset that changes with line speed.",
            "Check the external-encoder technology-object settings: velocity filter T1 (start value 0.1 s) and the delay-time correction for the following axis (start value 0.0065 s)."
          ],
          "fix": [
            "Enable actual-value extrapolation, then adjust the delay-time correction step by step until the cut-position accuracy is within tolerance (Siemens §2.4.14).",
            "Set a velocity filter for a noisy encoder signal, and a position hysteresis (start value 5 mm) to avoid false direction reversal from standstill (error 608)."
          ],
          "source": "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.13 Detecting the cutting length p.44-45; §2.4.14 Optimized settings for external encoders p.46-47)"
        },
        {
          "rank": 5,
          "cause": "Counter or PLC input too slow for the encoder frequency (H7CX left at 30 Hz, encoder on a non-high-speed input, or encoder max response exceeded), so counts are lost and parts come out long",
          "mechanism": "The H7CX counting speed is selectable: 30 Hz (16.7 ms minimum pulse width) or 5/10 kHz, set by DIP pin 2 (OFF = 30 Hz, the factory setting). On CLICK only the high-speed inputs (X1-X4 on the C0-1xDDxE CPUs, 100 kHz) count in hardware; Input Modules and Control Relays are scan-based. The E6B2 'will not operate electrically if its speed exceeds the maximum electrical response speed', which is (max response frequency / resolution) × 60. Lost counts grow with line speed, so parts get longer as the line speeds up.",
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
            "Calculate the encoder frequency at maximum line speed: f = (line speed per second / wheel circumference) × PPR. Compare it with the counter or input rating: H7CX 30 Hz or 5/10 kHz; CLICK high-speed input 100 kHz; E6B2 100 kHz (NPN or voltage output) or 50 kHz (PNP); Koyo TRD 200 kHz. Faulty: f is above the rating.",
            "On an H7CX, power down and read the DIP switch. Pin 1 must be ON for the DIP settings to apply. Pin 2 ON = 5 kHz, OFF = 30 Hz. Faulty: pin 2 is OFF while counting an encoder.",
            "On a CLICK, confirm the encoder A/B wires land on X1-X4 of a C0-1xDDxE CPU, configured as an HSC in Quadrature mode. Faulty: the encoder is wired to an input module or a non-HSC input.",
            "Run the line slowly and then at full speed over the same known length. Expected: the same count. Faulty: fewer counts at high speed."
          ],
          "fix": [
            "Set the H7CX to the high counting speed (DIP pin 2 ON, or the counting-speed function setting), then cycle power.",
            "Move the encoder to a high-speed counter input and configure the HSC, or use a lower-PPR encoder or a larger wheel so the frequency stays within the rating."
          ],
          "source": "https://files.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf?v=1 (Omron H7CX-N Multifunction Counter/Tachometer datasheet M079, p.5 Ratings (max. counting speed 30 Hz / 10 kHz), p.6 input-mode counting speeds, p.15 DIP switch settings); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, ch.3 High-Speed Input Configuration p.3-45 to 3-47); https://files.omron.eu/downloads/latest/datasheet/en/q085_e6b2-c_incremental_rotary_encoder_40_mm_datasheet_en.pdf?v=1 (Omron E6B2-C datasheet CSM_E6B2-C_DS_E_6_3, p.2 Ratings and Specifications, note *3)"
        },
        {
          "rank": 6,
          "cause": "Electrical noise or spurious pulses on the encoder line (long open-collector cable, cable run beside power wiring, poor shielding or grounding), giving extra or missing counts",
          "mechanism": "The Omron E6B2 datasheet says not to run encoder cables parallel to power or high-voltage lines, because induction causes malfunction. It also says not to extend an open-collector cable beyond 2 m: use a line-driver model, which allows up to 100 m. It notes that spurious pulses can occur at power on and off. The SureServo2 manual's encoder-error remedies, which describe the same interference mechanism, are to separate the encoder cable from power cables and use shielded cable. Extra counts make parts short, so random short parts point here.",
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
            "Trace the encoder cable route. Faulty: it shares a duct or tray with motor, VFD or servo power cables or solenoid wiring, or an open-collector or voltage-output encoder has more than about 2 m of cable.",
            "With the line stopped and the wheel still, watch the counter while the main drive, servo and hydraulic pump start. Expected: the count does not change. Faulty: the count jumps.",
            "Check the shield. The Koyo TRD shield is not connected to the encoder body, so it must be terminated at the control end as the wiring diagram shows. Faulty: the shield is unterminated or grounded at both ends through the machine frame.",
            "Check power sequencing. Expected: the counter ignores input for at least 0.1 s after the encoder powers up (the H7CX has a 290 ms sensor waiting time). Faulty: a count appears at every power-up."
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
          "mechanism": "The Rockwell flying-shear example uses an encoder on one drive roll as the master. It notes that a real machine may need to compensate 'for mechanical inaccuracies or product slippage'. EPC lists roller-shaft and drive-motor mounting as alternatives where a surface wheel is impractical. If the strip slips in the forming rolls, a roll-mounted encoder still counts the full travel, so parts come out short.",
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
            "Mark the strip and the roll and run a known count. Expected: strip travel equals the counted length. Faulty: the strip moves less than the count, which is roll slip (see the 'material-slips' symptom)."
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
          "mechanism": "In the Siemens flying-saw example the cut can only be triggered while the 'cutPossible' signal is set, and only when the saw axis is synchronized. The enable is reset when the saw has an error or 'the maximum position for the cut was overshot by the saw'. That reset is warning 9001; warning 9000 is 'synchronized position was missed'. Delta notes that if the slave axis does not return immediately after a cut, the shortest cut length is limited. Short parts at high line speed are the usual trigger. The Siemens document lists these as the termination conditions; it does not rank them.",
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
            "Read the flying-shear function-block status or the HMI. Siemens example: errorID 9000 (synchronized position missed) or 9001 (maximum cutting position overshot). Faulty: either code appears when a cut is skipped.",
            "Trend the cut-enable bit (cutPossible) and the cut command against the carriage position. Expected: enable goes TRUE before the cut point and the cut command follows. Faulty: enable never comes TRUE, or drops before the cut command.",
            "Compare the set cut length and line speed with the carriage return time. Faulty: the carriage is still returning when the next synchronization should start; the problem gets worse with shorter parts and higher speed.",
            "Check that the cutDone feedback arrives. The enable ends at cutDone or at maxPosToCut. Faulty: no cutDone, so the carriage runs to maxPosToCut."
          ],
          "fix": [
            "Raise the return velocity, acceleration or jerk, or enable Running Back Optimization so the carriage is back at its start position in time (Siemens §2.4.11-2.4.12).",
            "Lower the line speed for short cut lengths, or extend the synchronous stroke or maxPosToCut where the machine allows.",
            "Fix a missing cutDone signal (blade-down or blade-up sensor)."
          ],
          "source": "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.6 Cut enable p.36, §2.4.7 Termination conditions p.37, §2.4.11-2.4.12 p.41-44, §2.7.3 Error codes p.70); https://filecenter.deltaww.com/appcenter/download/Fae_058_en.pdf (Delta Electronics Product Application 'DVP-PM Series PLC in a Cut-to-Length Flying Shear Cutting Machine', Oct 2010, p.1 Structure, p.2 Establishing CAM Table / Modifying Cutting Length)"
        },
        {
          "rank": 2,
          "cause": "Cut command reaches the valve but the spool does not shift: coil voltage outside ±10 %, open coil or connector, or a coil burnt from overheating",
          "mechanism": "On the Rexroth 4WE 6 the solenoid force pushes the control spool, and the spring returns it when the coil is de-energized. The data sheet gives a voltage tolerance of ±10 % of nominal and a 100 % duty cycle. Its performance limits were determined at 10 % undervoltage, so below that the spool may not shift against the flow forces. The data sheet does not rank failures; this cause comes second because it is the next link in the chain after the command.",
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
            "When the PLC cut output turns on, measure the voltage at the valve connector, at the coil plug, not at the PLC terminal. Expected: 24 VDC ±10 % (21.6-26.4 V) on a 24 V coil. Faulty: less than 21.6 V, or 0 V when the output LED is on.",
            "With power off, measure the coil resistance and compare it with the coil data. Faulty: open circuit, or a short.",
            "Use the manual override (N or N9 versions; only possible up to about 50 bar tank pressure). Expected: the shear strokes. If it strokes on manual override but not electrically, the fault is electrical; if it does not stroke on override, the fault is hydraulic.",
            "For a CLICK sinking output, check that the output driver supply is present: CLICK sinking DC outputs need a sustained voltage on their supply terminal. Faulty: output LED on but no voltage at the load."
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
          "mechanism": "The Rexroth HED 8 piston pressure switch operates its micro switch when the pressure is below the set point and releases it when the set pressure is reached. Logic that waits for 'pressure OK' therefore never fires the shear if pressure is low or the switch is set too high. The data sheet notes that 'the exact setting of the switching pressure is only possible using a pressure gauge', and that the switching differential may increase over service life as the oil deteriorates.",
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
            "Check the switch contact. Terminals 1-2 open on pressure increase and 1-3 close on pressure increase (K14 connector). Expected: the PLC input for 'pressure OK' is ON at running pressure. Faulty: the contact does not change at the set pressure, or the wrong terminals are wired for the logic.",
            "Compare the switch setting with the gauge by slowly raising the pressure. Expected: it switches within about ±1 % of the set pressure (repeatability). Faulty: it switches far from the set point, or chatters."
          ],
          "fix": [
            "Restore system pressure (pump, relief setting), and reset the HED 8 against a gauge.",
            "Mount the switch with low vibration and protect it from pressure surges, as the data sheet recommends. Replace it if the switching differential has drifted."
          ],
          "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE50061 (Bosch Rexroth data sheet RE 50061/02.12, hydro-electric pressure switch HED 8, p.2 note 5, p.3 Function and Notice, p.4-5 Technical data, p.7 switching function / terminals)"
        },
        {
          "rank": 4,
          "cause": "Counter-based (non-servo) cut: the counter output never turns on, because the set value is beyond the countable range, inputs are ignored during sensor waiting time, or the input type is wrong",
          "mechanism": "The Omron H7CX datasheet states that if the set value is greater than {maximum countable value minus prescale value}, 'output will not turn ON'. It also states that no input is accepted for up to 290 ms after power-up (sensor waiting time), and that the input is NPN or PNP switchable (DIP pin 8). This applies only to lines where a preset counter fires the shear.",
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
            "Watch the present value as material runs. Expected: it counts up to the set value and the output LED turns on. Faulty: the PV never moves (wrong NPN/PNP selection or wiring), or it passes the set value with no output (set value or prescale problem).",
            "Check DIP pin 8 against the encoder output: NPN open-collector (sinking) encoder needs NPN input; PNP needs PNP. Pin 1 must be ON for DIP settings to apply.",
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
          "mechanism": "The Siemens flying-saw note states that if there is an error on the saw, an error is output and the automatic material cut is cancelled (error source 1000 / errorID 9110 'Error at the saw technology object'). Diagnose the servo alarm itself under 'line-stops-servo-alarm'.",
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
            "Check that the wheel runs in line with strip travel. Faulty: the wheel is angled, there is a scuffed band or one-sided wear on the tread, or the bracket is bent.",
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
          "mechanism": "TB-108: brackets without spring loading rely on the weight of the assembly, and 'if there is not sufficient tracking friction, weights may be added'. EPC's conveying note recommends spring tension 'to avoid wheel slippage caused by belt motion, changes in speed or direction, belt seams, and belt contaminants'. In EPC's case study, seams made the wheel jump and miss counts.",
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
            "Push the arm by hand. Expected: a firm, even spring load and a pivot that moves freely. Faulty: weak spring, seized pivot, or the arm bottomed against its stop.",
            "Watch the wheel during acceleration, deceleration and at welds or splices. Faulty: the wheel stops or lifts momentarily."
          ],
          "fix": [
            "Increase the spring setting or add weight, using the minimum force needed and staying within the rated bearing load (TB-108). Free or replace the pivot. Use a heavier-duty or dual-wheel unit."
          ],
          "source": "https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf (Encoder Products Company TB-108 Rev. D 01/18 'Encoders with Measuring Wheels', p.3 Installation); https://www.encoder.com/conveying (Encoder Products Company 'Conveying in Material Handling', Surface-mounted measuring wheels: spring tension, wheel material, roller-shaft / drive mounting); https://www.encoder.com/case-study-tru-trac-keeps-cut-lengths-accurate-every-time (Encoder Products Company case study 'Tru-Trac keeps cut lengths accurate every time' (Hipsher Tool & Die), sections The Problem / The Solution)"
        },
        {
          "rank": 3,
          "cause": "Wheel surface wrong for the material, worn, or contaminated",
          "mechanism": "TB-108: 'a harder wheel surface generally provides greater durability, but less traction', 'wheels wear down with usage', and the wheel material expands and contracts with temperature. Knurled aluminum or urethane is suggested for metal. EPC lists belt contaminants as a slip cause. The roll-forming case of oil or lubricant on the strip is not stated in these documents; contaminants is the closest they come.",
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
            "Clean or replace the wheel and choose the surface for the material (knurled aluminum or urethane for metal per TB-108). Recalibrate the scaling after replacing it."
          ],
          "source": "https://www.encoder.com/hubfs/tech-bulletin-100s/TB108-encoders-with-measuring-wheels.pdf (Encoder Products Company TB-108 Rev. D 01/18 'Encoders with Measuring Wheels', p.2 Selecting the Proper Measuring Wheel); https://www.encoder.com/conveying (Encoder Products Company 'Conveying in Material Handling', Surface-mounted measuring wheels: spring tension, wheel material, roller-shaft / drive mounting)"
        },
        {
          "rank": 4,
          "cause": "Wheel turns but counts are lost electrically (counter too slow, wrong NPN/PNP input mode, low encoder supply, or speed above the encoder's electrical response)",
          "mechanism": "The datasheets give hard limits. H7CX: counting speed 30 Hz or 5/10 kHz, and input type NPN or PNP selectable (DIP pins 2 and 8). E6B2: supply 5-24 VDC with ripple ≤5 %; it does not operate electrically above (max response frequency / resolution) × 60 rpm. Koyo TRD: open-collector models 4.75-26.4 VDC, line-driver models 4.75-5.25 VDC, ripple ≤3 %, 200 kHz. CLICK: hardware counting only on its high-speed inputs. The symptom looks like slip, but the strip and the wheel are moving correctly.",
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
            "Measure the encoder supply at the encoder connector, not at the power supply, with the line running. Expected: within the encoder's range (e.g. 5 V ±5 % for a line-driver model). Faulty: low because of voltage drop on a long, thin cable, or ripple above the limit.",
            "Mark the wheel, turn it one revolution by hand, and read the count. Expected: PPR × the evaluation multiplier. Faulty: fewer counts, or none on one channel. A missing channel B, for example, halves the x4 count or makes the count go up and down.",
            "Check the input-type setting against the encoder output: NPN open-collector (sinking), such as Koyo TRD-S..A, needs an input wired as in the CLICK 'Sinking Encoder (Open Collector)' example, or H7CX NPN mode. PNP needs a sourcing setup. Faulty: count missing or erratic.",
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
          "mechanism": "In the Rockwell example the master encoder sits on a drive roll, and the logic has a hook to compensate 'mechanical inaccuracies or product slippage'. EPC notes that a surface wheel reads the moving material directly, whereas roller-shaft or motor encoders read the drive. The documents do not give roll-forming-specific causes for slip in the roll stands, such as roll gap, pinch pressure or accelerating too hard.",
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
            "Mark the strip at the entry and compare the strip travel with the length the roll or motor encoder reports over a long run. Faulty: the strip travels less than reported.",
            "Compare steady speed with acceleration. Faulty: the error appears mainly during acceleration or deceleration."
          ],
          "fix": [
            "Measure the strip directly with a spring-loaded measuring wheel, or add registration or slip compensation in the motion logic. Correct the roll-stand pinch per the machine builder's procedure (not covered by these sources)."
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
          "mechanism": "Flying-shear notes only allow the cut while the slave or carriage runs at line speed. The Siemens 'cutPossible' signal means the saw runs synchronized 'and a material cut is possible in the correct length', and the Delta CAM holds the slave 'at the same speed as the master' through the synchronous section. A speed mismatch while the blade is in the strip is the mechanism that drags or buckles the strip; that is an inference from the sync requirement, not a sentence in the documents.",
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
            "Trend carriage velocity and line velocity together with the cut command. Expected: the velocities are equal from before blade-down until after blade-up. Faulty: the cut command arrives during the acceleration ramp, or the carriage decelerates while the blade is still down.",
            "Check that the cut command is interlocked with the sync or cut-enable bit (cutPossible). Faulty: the cut is fired from a timer or the length count alone."
          ],
          "fix": [
            "Interlock the cut on synchronism, and lengthen the synchronous section of the cam (Delta: the synchronous stroke; Siemens: synchronization profile) so the whole cut happens at matched speed."
          ],
          "source": "https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.1 Symmetric synchronization p.25-26, §2.4.6 Cut enable p.36); https://filecenter.deltaww.com/appcenter/download/Fae_058_en.pdf (Delta Electronics Product Application 'DVP-PM Series PLC in a Cut-to-Length Flying Shear Cutting Machine', Oct 2010, p.1 Structure, p.2 Establishing CAM Table / Modifying Cutting Length)"
        },
        {
          "rank": 2,
          "cause": "Blade cycle too slow for the synchronous window (slow hydraulic or pneumatic stroke, or cutDone given too early), so the carriage brakes or returns during the cut",
          "mechanism": "In the Siemens example the carriage stops with decHaltAfterCut and returns after cutDone, or when maxPosToCut is reached. The Rockwell example notes that open-loop pneumatic or hydraulic shears are timed with on-delay timers. If the stroke is slower than the window allows, or cutDone (or its timer) is set too short, the carriage moves off speed while the blade is still in the strip.",
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
            "Time the blade down-and-up stroke against the synchronous window (blade-down/up sensors or a scope on the valve coil and the blade sensor). Faulty: the stroke time is longer than the time the carriage stays synchronized.",
            "Check what generates cutDone: a blade-up sensor is correct. Faulty: a fixed timer shorter than the measured stroke."
          ],
          "fix": [
            "Fix the slow stroke (see 'hydraulic-cutter-slow'), generate cutDone from a blade-up sensor, or lengthen the synchronous section or lower the line speed."
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
          "mechanism": "The flying-shear carriage repeatedly accelerates to line speed and back, and the Siemens note sizes these return dynamics with its return-velocity and RBO settings. SureServo2 AL009 (Excessive Position Command Deviation) causes are: maximum deviation set too low, gain too low, torque limit too low, excessive external load, wrong E-gear ratio, loose power cables, speed limit too low. Kinetix 5100 E 009 and V90 F7452 give the same family of causes. The drive manuals list these causes without ranking them; this alarm is ranked first because it is the one the documents tie directly to aggressive motion profiles.",
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
            "Check P2.035 (excessive position deviation) on SureServo2/Kinetix 5100 (ID219), or p2546 on V90, against the application. Check gain, torque limit (Kinetix and SureServo2) and P1.055 maximum speed limit.",
            "Monitor torque (SureServo2 P0.002 = 11, average torque %) during the return stroke. Faulty: torque at the limit during acceleration.",
            "Check E-gear P1.044/P1.045 against the mechanics, and check that the UVW power cables are tight."
          ],
          "fix": [
            "Reduce the return acceleration or jerk, or use RBO so the carriage returns 'just fast enough' (Siemens §2.4.12). Re-tune the gains, correct the E-gear, and set the deviation limit for the application. Re-size the motor if the torque is saturating."
          ],
          "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (SureServo2 User Manual 1st Ed. Rev A 08/09/2021, ch.11 Troubleshooting, AL009 p.11-13); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (Kinetix 5100 User Manual 2198-UM004D ch.16 p.449-454) with https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, E 009); https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.258, F7452); https://cache.industry.siemens.com/dl/files/573/109977573/att_1362144/v1/LFlyingSawBasic_S71200G2_V3_1_0_Manual_en.pdf (Siemens application example 'Flying saw S7-1200 G2', Entry-ID 109977573, 03/2026, §2.4.11-2.4.12 p.41-44)"
        },
        {
          "rank": 2,
          "cause": "Overload: average torque persistently above 100 % (cycle rate too high for the motor, mechanical drag)",
          "mechanism": "SureServo2 AL006 causes: load over the rated range with persistent overload, wrong control parameters, incorrect motor or encoder wiring, encoder malfunction. The checks include mechanical vibration and acceleration or deceleration set too high, which describes a short-cut-length, high-speed flying shear.",
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
          "mechanism": "SureServo2 AL005 / AL010 causes: wrong regenerative resistor or external resistor not connected; P1.053 not 0 when no resistor is fitted; parameter error in P1.052/P1.053. Repeated carriage stops on every cut return energy to the DC bus.",
          "devices": {
            "profileIds": [
              "sureservo2-servo-drive"
            ],
            "categories": [
              "servoDrive"
            ]
          },
          "checks": [
            "Check that the external regen resistor is connected and its resistance matches P1.052, and that its wattage matches P1.053. Faulty: open resistor, wrong value, or P1.053 not 0 when no resistor is fitted."
          ],
          "fix": [
            "Fit a correctly sized regen resistor and set P1.052/P1.053 to match."
          ],
          "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (SureServo2 User Manual 1st Ed. Rev A 08/09/2021, ch.11 Troubleshooting, AL005 p.11-11, AL010 p.11-13)"
        },
        {
          "rank": 4,
          "cause": "Servo encoder error from wiring, connector or interference",
          "mechanism": "SureServo2 AL011 causes: wrong encoder wiring, loose connector, poor wiring, 'connection to the encoder is cut off due to interference', damaged encoder. The remedies are to ground the motor (UVW ground to the drive heat sink), separate the encoder cable from power cables, and use shielded cable.",
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
          "mechanism": "SureServo2 AL008 Abnormal Pulse Command: the pulse-command frequency is higher than the rated input frequency for the hardware interface. On a PTO-driven flying shear this happens when the carriage speed needed to match a faster line exceeds what the pulse interface allows.",
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
          "mechanism": "The HED 8 monitors system pressure, and its exact setting 'is only possible using a pressure gauge'. Its switching differential may increase over service life as the oil quality deteriorates. Low pressure gives a slow, weak stroke. The data sheets do not rank the slow-cutter causes; pressure comes first because it is the reference measurement the other checks depend on.",
          "devices": {
            "profileIds": [
              "rexroth-hed8-piston-pressure-switch"
            ],
            "categories": [
              "sensor"
            ]
          },
          "checks": [
            "Fit a gauge at the pressure-switch take-off and cut. Expected: at or above the machine's specified pressure, without a large dip during the stroke. Faulty: low, or a deep dip.",
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
          "mechanism": "The 4WE 6 coil tolerance is ±10 %, and the performance limits were determined 'when the solenoids were at operating temperature, at 10 % undervoltage'. Lower voltage reduces the solenoid force available against the flow forces. Rated DC switching times are ON 25-45 ms and OFF 10-25 ms.",
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
            "Scope the coil voltage against the blade-moving sensor. Expected: motion starts within tens of ms (DC switching ON time 25-45 ms per the data sheet). Faulty: much longer."
          ],
          "fix": [
            "Restore the coil supply voltage (supply sizing, wire gauge, connector) and replace a damaged coil."
          ],
          "source": "https://www.boschrexroth.com/en/xc/myrexroth/media-directory-download?object_nr=RE23178 (Bosch Rexroth data sheet RE 23178 edition 2013-06, directional spool valve 4WE 6 ...6X, p.8 Technical data electric; p.10 Performance limits notice)"
        },
        {
          "rank": 3,
          "cause": "Oil too cold or too hot (viscosity outside the test condition), which changes switching times",
          "mechanism": "The switching times were determined at 40 °C and 46 cSt. The data sheet states that 'deviating hydraulic fluid temperatures can result in different switching times' and that switching times change with operating time and application conditions.",
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
          "mechanism": "The 4WE 6 requires cleanliness class 20/18/15 (ISO 4406). The data sheet: 'effective filtration prevents faults and at the same time increases the life cycle of the components'.",
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
          "mechanism": "The data sheet: 'internal leakage is inherent to the valves, which may increase over the life cycle'. Where switching flows exceed the performance limit, a throttle insert is required. With flow in only one direction (e.g. P to A with B blocked), the admissible performance limit may be considerably lower.",
          "devices": {
            "profileIds": [
              "rexroth-4we6-6x-dc-solenoid"
            ],
            "categories": [
              "solenoidValve"
            ]
          },
          "checks": [
            "With the cylinder held, observe drift or listen for flow through the de-energized valve, and compare the stroke speed with the original commissioning value. Faulty: drift, or a stroke slower than it was when new.",
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
}];
