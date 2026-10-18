import type { DeviceFaultProfile } from "../deviceFaults";

/**
 * Drive and servo fault profiles: AutomationDirect GS10 / GS20 / GS30, Inovance MD500 / MD290, AutomationDirect SureServo2.
 * Generated from the maker manuals (each fault cites its chapter / page in `source`). Codes exactly as displayed.
 * Delta VFD-E / MS300 / C2000 Plus are not here: Delta downloads sit behind a captcha (not bypassed).
 */
export const DRIVE_FAULTS: DeviceFaultProfile[] = [
  {
    "id": "gs20-vfd",
    "title": "AutomationDirect DURApulse GS20 / GS20X AC drive",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "GS20"
    },
    "normal": [
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS20 120 V class 1-phase (100-120 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "85-132 VAC",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-11",
        "liveWork": true
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS20/GS20X 230 V class (200-240 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "170-265 VAC (GS20X: 170-264 VAC)",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ],
          [
            "S/L2",
            "T/L3"
          ],
          [
            "R/L1",
            "T/L3"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-12 to 1-14, 1-18, 1-19",
        "liveWork": true
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS20/GS20X 460 V class 3-phase (380-480 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "323-528 VAC",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ],
          [
            "S/L2",
            "T/L3"
          ],
          [
            "R/L1",
            "T/L3"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-15, 1-16, 1-20",
        "liveWork": true
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS20 575 V class 3-phase (500-600 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "425-660 VAC",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ],
          [
            "S/L2",
            "T/L3"
          ],
          [
            "R/L1",
            "T/L3"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-17",
        "liveWork": true
      },
      {
        "terminals": "Keypad user display U (P00.04 = 3, default: DC bus voltage)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "DC bus between Lv level P06.00 (180VDC 120/230V, 360VDC 460V, 450VDC 575V) and ov trip (410VDC 120/230V, 820VDC 460V, 1116VDC 575V)",
        "note": "Lv/ov levels: Fault Codes table, LvA-LvS and ovA-ovS rows. P00.04 = 3 shows DC bus voltage; P06.34 holds DC bus at fault (p.4-31). https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf https://cdn.automationdirect.com/static/manuals/gs20m/ch4.pdf"
      },
      {
        "terminals": "+24V to DCM",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC ±10% (21.6-26.4 VDC), 100 mA max",
        "pins": [
          [
            "+24V",
            "DCM"
          ]
        ],
        "note": "Control terminal specifications, https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31"
      },
      {
        "terminals": "DI1-DI7 input (e.g. FWD (DI1)) to DCM, Source mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": ">= 11 VDC (activation current 3.3 mA)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ],
          [
            "DI6",
            "DCM"
          ],
          [
            "DI7",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31; DCM is the digital control common"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Source mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "<= 5 VDC (cut-off voltage)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ],
          [
            "DI6",
            "DCM"
          ],
          [
            "DI7",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Sink mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": "<= 13 VDC (activation current 3.3 mA)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ],
          [
            "DI6",
            "DCM"
          ],
          [
            "DI7",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Sink mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": ">= 19 VDC (cut-off voltage)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ],
          [
            "DI6",
            "DCM"
          ],
          [
            "DI7",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31"
      },
      {
        "terminals": "+10V to ACM",
        "state": "powered",
        "meter": "VDC",
        "expected": "10.5 ±0.5 VDC (10.0-11.0 VDC), 20 mA max (potentiometer supply)",
        "pins": [
          [
            "+10V",
            "ACM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-32"
      },
      {
        "terminals": "AI1 to ACM",
        "state": "voltage-mode speed reference",
        "meter": "VDC",
        "expected": "0-10 VDC = 0 to maximum output frequency (P01.00)",
        "pins": [
          [
            "AI1",
            "ACM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-32"
      },
      {
        "terminals": "STO1 to SCM and STO2 to SCM",
        "state": "run permitted (STO cut-off mode; default STO1/STO2 jumpered to +24V)",
        "meter": "VDC",
        "expected": "11-30 VDC on both channels (rated 24 VDC ±10%, 6.67 mA)",
        "pins": [
          [
            "STO1",
            "SCM"
          ],
          [
            "STO2",
            "SCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-33"
      },
      {
        "terminals": "STO1 to SCM or STO2 to SCM",
        "state": "safe torque off active",
        "meter": "VDC",
        "expected": "0-5 VDC on either channel; drive output stops within 20 ms",
        "pins": [
          [
            "STO1",
            "SCM"
          ],
          [
            "STO2",
            "SCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-33"
      }
    ],
    "pairs": [
      {
        "a": "R1",
        "b": "R1O",
        "when": "fault (default P02.13 = 11, malfunction indication)",
        "note": "R1O = relay 1 N.O., R1C = relay 1 N.C., R1 = relay 1 common (p.2-32). P02.13 (R1) default 11 = fault output, on for any fault except Lv stop (p.4-94). https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf https://cdn.automationdirect.com/static/manuals/gs20m/ch4.pdf"
      },
      {
        "a": "R1",
        "b": "R1C",
        "when": "no fault (relay not activated, default P02.13 = 11)",
        "note": "R1O = relay 1 N.O., R1C = N.C., R1 = common (p.2-32). P02.13 (R1) default 11 = fault output, not for Lv stop (p.4-94). N.C. closed when unpowered. https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf https://cdn.automationdirect.com/static/manuals/gs20m/ch4.pdf"
      }
    ],
    "indicators": [
      {
        "name": "RUN LED",
        "state": "steady on",
        "meaning": "Drive is running."
      },
      {
        "name": "RUN LED",
        "state": "blinking",
        "meaning": "Drive is stopping or in base block."
      },
      {
        "name": "RUN LED",
        "state": "off",
        "meaning": "Drive is not running."
      },
      {
        "name": "FWD LED",
        "state": "steady on",
        "meaning": "Drive is operating in Forward mode."
      },
      {
        "name": "FWD LED",
        "state": "blinking",
        "meaning": "Drive is changing direction."
      },
      {
        "name": "REV LED",
        "state": "steady on",
        "meaning": "Drive is operating in Reverse mode."
      },
      {
        "name": "REV LED",
        "state": "blinking",
        "meaning": "Drive is changing direction."
      },
      {
        "name": "STOP LED",
        "state": "steady on",
        "meaning": "Drive is stopped or in the process of stopping."
      },
      {
        "name": "STOP LED",
        "state": "blinking",
        "meaning": "Drive is in standby (run but does not output)."
      },
      {
        "name": "STOP LED",
        "state": "off",
        "meaning": "Drive is not currently executing an operational (STOP) command."
      },
      {
        "name": "PLC LED",
        "state": "steady on",
        "meaning": "PLC STOP (PLC 2) initiated."
      },
      {
        "name": "PLC LED",
        "state": "blinking",
        "meaning": "PLC Run (PLC1) initiated."
      },
      {
        "name": "PLC LED",
        "state": "off",
        "meaning": "No PLC functions implemented (PLC 0)."
      },
      {
        "name": "keypad display",
        "state": "shows a fault code (e.g. ocA, ovd, GFF)",
        "meaning": "Drive tripped on this fault (see ch6 Fault Codes). STOP/RESET clears it once the cause is gone; non-resettable faults show in fault records (MENU)."
      }
    ],
    "faults": [
      {
        "code": "ocA",
        "title": "Over-current during acceleration",
        "symptom": "Drive trips; keypad shows ocA, fault ID 1 in the fault record.",
        "causes": [
          "Output current over 3x rated while accelerating. Drive cuts output at once, motor coasts, display shows ocA.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 1 = ocA.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "If accel time is too short: lengthen accel or S-curve accel, use auto accel/decel (P01.44) or OC stall prevention (P06.03), or fit a bigger drive.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Compare output current over the whole cycle with drive rating; if it is exceeded, use a larger drive.",
          "Reduce the load or increase the capacity of AC motor drive.",
          "Check the motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive).",
          "Check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve setting and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the torque compensation (refer to P07.26 torque compensation gain) until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Enable speed tracking during start-up of P07.12.",
          "Correct the parameter settings for speed tracking. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Check the settings for P00.11 control mode: a) For IM, P00.11=0, 1, 2, 5 b) For PM, P00.11=2",
          "Increase the AC motor drive’s capacity.",
          "Install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Check the stall prevention setting and set the stall prevention to the proper value.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-25, ocA ID 1)"
      },
      {
        "code": "ocd",
        "title": "Over-current during deceleration",
        "symptom": "Drive trips; keypad shows ocd, fault ID 2 in the fault record.",
        "causes": [
          "Output current over 3x rated while decelerating. Drive cuts output at once, motor coasts, display shows ocd.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 2 = ocd.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "If decel time is too short: lengthen decel or S-curve decel, use auto accel/decel (P01.44) or OC stall prevention (P06.03), or fit a bigger drive.",
          "Check if the mechanical brake of the motor activates too early.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Compare output current over the whole cycle with drive rating; if it is exceeded, use a larger drive.",
          "Check the impulsive change of the load and reduce the load or increase the capacity of AC motor drive as needed.",
          "Verify the motor capacity, the rated current on the motor’s nameplate should ≤ the rated current of the drive.",
          "With a contactor on the U/V/W output, check its timing: it must not switch while the drive is outputting voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it is too long, increase the AC motor drive’s capacity or install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Verify the stall prevention setting and set the stall prevention to the proper value.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-26, ocd ID 2)"
      },
      {
        "code": "ocn",
        "title": "Over-current during steady operation",
        "symptom": "Drive trips; keypad shows ocn, fault ID 3 in the fault record.",
        "causes": [
          "Output current over 3x rated at constant speed. Drive cuts output at once, motor coasts, display shows ocn.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 3 = ocn.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Look for locked shaft, burnt or aged motor insulation. Megger the motor; replace it if insulation is poor."
        ],
        "fix": [
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check for impulsive change of the load, and reduce the load or increase the capacity of AC motor drive.",
          "Check motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive)",
          "With a contactor on the drive output, check its timing: it must not switch while the drive is outputting voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-27, ocn ID 3)"
      },
      {
        "code": "GFF",
        "title": "Ground fault",
        "symptom": "Drive trips; keypad shows GFF, fault ID 4 in the fault record.",
        "causes": [
          "Ground short detected on output U/V/W. Drive cuts output at once, motor coasts, display shows GFF."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 4 = GFF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for motor burnout or aging insulation. a) Check the motor insulation value with megger. b) Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the cable for short circuits and replace the cable if needed.",
          "If the motor cable length exceeds 100 m, decrease the setting value for the carrier frequency and take remedies to reduce stray capacitance.",
          "Check grounding and wiring of the comms circuit. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Cycle the power after checking the status of motor, cable, and cable length. If GFF still exists, contact AutomationDirect Technical Support.",
          "Refer to the corrective actions for ocn.",
          "Refer to the corrective actions for ocA.",
          "Refer to the corrective actions for ocd.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-27, GFF ID 4)"
      },
      {
        "code": "ocS",
        "title": "Over-current at stop",
        "symptom": "Drive trips; keypad shows ocS, fault ID 6 in the fault record.",
        "causes": [
          "Over-current, or current-sensing hardware fault, while stopped. Cycle power after ocS; hardware faults show as cd1, cd2 or cd3.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 6 = ocS.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check if other error codes such as cd1–cd3 occur after cycling the power. If yes, return to the factory for repair.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-28, ocS ID 6)"
      },
      {
        "code": "ovA",
        "title": "Over-voltage during acceleration",
        "symptom": "Drive trips; keypad shows ovA, fault ID 7 in the fault record.",
        "causes": [
          "DC bus over-voltage while accelerating. Drive cuts output, motor coasts, display shows ovA.",
          "Trips at once when DC bus exceeds: 410VDC (120V/230V), 820VDC (460V), 1116VDC (575V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 7 = ovA.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Check acceleration. If too slow: a) Decrease the acceleration time b) Use a braking unit or DC bus c) Replace the drive with a larger capacity model.",
          "Check the setting for stall prevention level. If the value is lower than no-load current, adjust it to be higher than no-load current.",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "If load inertia regenerates: use OV stall prevention (P06.01), auto accel/decel (P01.44), or a braking unit / DC bus.",
          "Fault right after accel ends means accel too short: lengthen accel, set P06.01 OV stall prevention, raise P01.25 S-curve accel time 2.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or brake unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-28, ovA ID 7)"
      },
      {
        "code": "ovd",
        "title": "Over-voltage during deceleration",
        "symptom": "Drive trips; keypad shows ovd, fault ID 8 in the fault record.",
        "causes": [
          "DC bus over-voltage while decelerating. Drive cuts output at once, motor coasts, display shows ovd.",
          "Trips at once when DC bus exceeds: 410VDC (120V/230V), 820VDC (460V), 1116VDC (575V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 8 = ovd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Decel too short, too much regen: raise P01.13/P01.15/P01.17/P01.19, add brake resistor/unit, use P06.01, P01.44, adjust P07.01 (see source)",
          "Verify that the setting for stall prevention level is larger than no-load current",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, ovd ID 8)"
      },
      {
        "code": "ovn",
        "title": "Over-voltage during constant speed",
        "symptom": "Drive trips; keypad shows ovn, fault ID 9 in the fault record.",
        "causes": [
          "DC bus over-voltage at constant speed. Drive cuts output at once, motor coasts, display shows ovn.",
          "Trips at once when DC bus exceeds: 410VDC (120V/230V), 820VDC (460V), 1116VDC (575V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 9 = ovn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Sudden load changes: add brake resistor, braking unit or DC bus; reduce load; use a larger drive; adjust braking level (P07.01 or unit bolt).",
          "Verify the stall prevention level setting is higher than no-load current.",
          "Check for regenerative voltage, then enable over-voltage stall prevention function (P06.01) or use a braking unit or DC bus",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, ovn ID 9)"
      },
      {
        "code": "ovS",
        "title": "Over-voltage at stop",
        "symptom": "Drive trips; keypad shows ovS, fault ID 10 in the fault record.",
        "causes": [
          "Over-voltage at stop",
          "Trips at once when DC bus exceeds: 410VDC (120V/230V), 820VDC (460V), 1116VDC (575V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 10 = ovS.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check if other error codes such as cd1–cd3 occur after cycling the power. If yes, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, ovS ID 10)"
      },
      {
        "code": "LvA",
        "title": "Low-voltage during acceleration",
        "symptom": "Drive trips; keypad shows LvA, fault ID 11 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value during acceleration",
          "Trips at once when DC bus falls below P06.00 (180VDC 120V/230V, 360VDC 460V, 450VDC 575V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 11 = LvA.",
          "Compare P06.34 (DC bus at fault) with trip level P06.00: 180VDC (120V/230V), 360VDC (460V), 450VDC (575V)."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The load may be too heavy. If so: a) Reduce the load. b) Increase the drive capacity. c) Increase the acceleration time.",
          "Check the DC bus and install DC reactor(s).",
          "Check that the jumper plate or DC reactor between terminals +1 and +2 is fitted; install one if missing.",
          "If the error still exists, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, LvA ID 11)"
      },
      {
        "code": "Lvd",
        "title": "Low-voltage during deceleration",
        "symptom": "Drive trips; keypad shows Lvd, fault ID 12 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value during deceleration",
          "Trips at once when DC bus falls below P06.00 (180VDC 120V/230V, 360VDC 460V, 450VDC 575V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 12 = Lvd.",
          "Compare P06.34 (DC bus at fault) with trip level P06.00: 180VDC (120V/230V), 360VDC (460V), 450VDC (575V)."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The fault may be triggered by sudden load. If so: a) Reduce the load. b) Increase the drive capacity.",
          "Check the DC bus and install DC reactor(s).",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, Lvd ID 12)"
      },
      {
        "code": "Lvn",
        "title": "Low-voltage at constant speed",
        "symptom": "Drive trips; keypad shows Lvn, fault ID 13 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value at constant speed",
          "Trips at once when DC bus falls below P06.00 (180VDC 120V/230V, 360VDC 460V, 450VDC 575V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 13 = Lvn.",
          "Compare P06.34 (DC bus at fault) with trip level P06.00: 180VDC (120V/230V), 360VDC (460V), 450VDC (575V)."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The fault may be triggered by sudden load. If so: a) Reduce the load. b) Increase the drive capacity.",
          "Check the DC bus and install DC reactor(s).",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, Lvn ID 13)"
      },
      {
        "code": "LvS",
        "title": "Low-voltage at stop",
        "symptom": "Drive trips; keypad shows LvS, fault ID 14 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value at stop or a hardware failure in voltage detection had occurred.",
          "Trips at once when DC bus falls below P06.00 (180VDC 120V/230V, 360VDC 460V, 450VDC 575V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 14 = LvS.",
          "Compare P06.34 (DC bus at fault) with trip level P06.00: 180VDC (120V/230V), 360VDC (460V), 450VDC (575V)."
        ],
        "fix": [
          "Improve power supply condition.",
          "Check if the power specification matches the drive.",
          "Adjust voltage to the power range of the drive.",
          "Cycle the power after checking the power. If LvS error still exists, return to the factory for repair.",
          "Check the power system.",
          "Increase the capacity of power equipment.",
          "Install DC reactor(s).",
          "Reset: Manual / Auto: 120V/230V series: Lv level + 30VDC + 500ms 460V series: Lv level + 60VDC + 500ms 575V series: Lv level + 75VDC + 500ms; 500 ms."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, LvS ID 14)"
      },
      {
        "code": "orP",
        "title": "Phase loss protection",
        "symptom": "Drive trips; keypad shows orP, fault ID 15 in the fault record.",
        "causes": [
          "Phase loss of power input",
          "DC bus ripple above limit with output over 50% rated starts a counter; orP trips when it hits the limit. Delay depends on output current."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 15 = orP.",
          "Check P06.34 (DC bus at fault). orP trips after high DC ripple persists with output current over 50% of rated."
        ],
        "fix": [
          "Verify the wiring of the main circuit power is installed correctly.",
          "Check that a single-phase power supply is not being used with a three-phase model. Choose the model whose power matches the voltage.",
          "Supply voltage swings can cause it. Check main circuit and supply, cycle power; if orP stays, call AutomationDirect support.",
          "Check for loose terminal wiring, tighten the terminal screws according to the torque described in the user manual.",
          "Verify the input cable is undamaged and replace if needed.",
          "Check for unbalanced three-phase input power.",
          "Fault setting parameter: P06.53",
          "Reset: Manual reset; Immediately reset when DC bus is higher than P07.00."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, orP ID 15)"
      },
      {
        "code": "oH1",
        "title": "IGBT overheating",
        "symptom": "Drive trips; keypad shows oH1, fault ID 16 in the fault record.",
        "causes": [
          "IGBT temperature exceeds the protection level. Protection level is model default of P06.15 + 5°C",
          "IGBT overheat: level = model default of P06.15 +5°C. If P06.15 is above oH1 level, oH1 trips instead of warning; drive stops at once."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 16 = oH1.",
          "Read P06.36 (IGBT temperature at malfunction); P06.43 shows present IGBT temperature."
        ],
        "fix": [
          "Check the ambient temperature.",
          "Regularly inspect the ventilation hole of the control cabinet.",
          "Change the installed location if there are heating objects, such as braking resistors, in the surroundings.",
          "Install/add cooling fan or air conditioner to lower the temperature inside the cabinet.",
          "Check for and remove obstructions or replace the cooling fan.",
          "Increase ventilation space of the drive.",
          "Decrease loading.",
          "Decrease the carrier wave.",
          "Replace the drive with higher capacity model.",
          "Reset: Manual reset; Reset only when IGBT temperature is lower than oH1 error level minus (-) 10°C."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, oH1 ID 16)"
      },
      {
        "code": "tH1o",
        "title": "IGBT temperature detection failure",
        "symptom": "Drive trips; keypad shows tH1o, fault ID 18 in the fault record.",
        "causes": [
          "IGBT hardware failure in temperature detection",
          "NTC open or miswired. tH1o trips when IGBT temp is above protection level for over 100 ms."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 18 = tH1o.",
          "Read P06.36 (IGBT temperature at malfunction); P06.43 shows present IGBT temperature."
        ],
        "fix": [
          "Wait for 10 minutes, and then cycle the power. Check if tH1o protection still exists. If yes, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, tH1o ID 18)"
      },
      {
        "code": "oL",
        "title": "Over load",
        "symptom": "Drive trips; keypad shows oL, fault ID 21 in the fault record.",
        "causes": [
          "Output current too high. Limits: VT 120% for 1 min, 150% for 3 s; CT 150% for 1 min, 200% for 3 s (of drive rated current).",
          "Trips per overload and derating curves when load stays above the limit longer than allowed (oL)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 21 = oL.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "Replace the drive with a larger capacity model.",
          "If oL only at low speed: cut low-speed load, use a bigger drive, or lower carrier frequency P00.17.",
          "Adjust P07.26 Torque Compensation Gain until the output current reduces and the motor does not stall.",
          "Verify stall prevention is set to the proper value.",
          "Check the status of three-phase motor and verify the cable is not broken or screws are loose.",
          "Verify the parameter settings for speed tracking. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, oL ID 21)"
      },
      {
        "code": "EoL1",
        "title": "Electronics thermal relay 1 protection",
        "symptom": "Drive trips; keypad shows EoL1, fault ID 22 in the fault record.",
        "causes": [
          "Electronics thermal relay 1 protection. The drive coasts to stop once it activates.",
          "Counts when output > 150% of motor 1 rated current; trips after P06.14. Repeat > 105% within 60 sec shortens the time."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 22 = EoL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL1 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P06.13=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P06.13=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, EoL1 ID 22)"
      },
      {
        "code": "EoL2",
        "title": "Electronic thermal relay 2 protection",
        "symptom": "Drive trips; keypad shows EoL2, fault ID 23 in the fault record.",
        "causes": [
          "Electronic thermal relay 2 protection. The drive coasts to stop once it activates.",
          "Counts at output > 150% motor 2 current (P06.28; faster if > 105% again within 60 sec). PTC > P06.30 (50%) or PT100 > P06.57 (7V): immediate."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 23 = EoL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 2 V/F curve P01.35-P01.42; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL2 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P06.27=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P06.27=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Check ambient temperature. Move away from heat sources, or add a fan or air conditioning to cool the enclosure.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Check time spent at low speed: shorten it, use an inverter-duty motor, or a larger motor.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Check V/F voltage; tune P01.01-P01.08, as a low mid-point voltage cuts low-speed torque.",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection between PTC thermistor and the heat protection.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Check ambient temperature. Move away from heat sources, or add a fan or air conditioning to cool the enclosure.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Check time spent at low speed: shorten it, use an inverter-duty motor, or a larger motor.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Check V/F voltage; tune P01.01-P01.08, as a low mid-point voltage cuts low-speed torque.",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection of PT100 RTD.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Action set by P06.29: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = no warning.",
          "P06.29=0: oH3 is a warning, auto-clears (when temp < P06.56). P06.29=1 or 2: oH3 is a fault, reset by hand. Some cases reset five seconds after clear."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, EoL2 ID 23)"
      },
      {
        "code": "ot1",
        "title": "Over torque 1",
        "symptom": "Drive trips; keypad shows ot1, fault ID 26 in the fault record.",
        "causes": [
          "ot1: output current above P06.07 for longer than P06.08, with P06.06 or P06.09 set to 2 or 4.",
          "Trip condition (Action Level): P06.07; action time: P06.08"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 26 = ot1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the settings for P06.07 and P06.08.",
          "Check for mechanical failure and remove any causes of malfunction.",
          "Reduce the load or replace the motor with a higher capacity model.",
          "Increase the setting values for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 1 V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque.",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Check speed tracking: enable it and adjust its max current P07.09.",
          "P06.06: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P06.06=1 or 3: ot1 is a warning, clears when current < (Pr.06-07 - 5%). P06.06=2 or 4: ot1 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-35, ot1 ID 26)"
      },
      {
        "code": "ot2",
        "title": "Over torque 2",
        "symptom": "Drive trips; keypad shows ot2, fault ID 27 in the fault record.",
        "causes": [
          "ot2: output current above P06.10 for longer than P06.11, with P06.09 set to 2 or 4.",
          "Trip condition (Action Level): P06.10; action time: P06.11"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 27 = ot2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the settings for P06.10 and P06.11.",
          "Check for mechanical failure and remove any causes of malfunction.",
          "Reduce the load or replace the motor with a higher capacity model.",
          "Increase the setting values for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve (Motor 1, P01.35-P01.42); a low mid-point voltage cuts low-speed torque.",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Check speed tracking: enable it and adjust its max current P07.09.",
          "P06.09: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P06.09=1 or 3: ot2 is a warning, clears when current < (P06.10 - 5%). P06.09=2 or 4: ot2 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, ot2 ID 27)"
      },
      {
        "code": "uC",
        "title": "Under current",
        "symptom": "Drive trips; keypad shows uC, fault ID 28 in the fault record.",
        "causes": [
          "Low current detection",
          "Trip condition (Action Level): P06.71; action time: P06.72"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 28 = uC.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Confirm the motor cable is connected properly.",
          "Verify settings of P06.71, P06.72, and P06.73 and set to correct values if needed.",
          "Check if the load is too low and whether the motor capacity matches the load.",
          "P06.73: 0 = off; 1 = fault, coast stop; 2 = fault, ramp stop on 2nd decel time; 3 = warn, keep running.",
          "P06.73=3: uC is a warning, clears when current > (P06.71+0.1A). P06.73=1 or 2: uC is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, uC ID 28)"
      },
      {
        "code": "cF2",
        "title": "EEPROM read error",
        "symptom": "Drive trips; keypad shows cF2, fault ID 31 in the fault record.",
        "causes": [
          "Internal EEPROM cannot be read",
          "Trip condition (Action Level): Firmware internal detection; action time: cF2 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 31 = cF2."
        ],
        "fix": [
          "Press “RESET” key or reset the parameter to the default setting. If cF2 still occurs, contact AutomationDirect Technical Support.",
          "Cycle the power, if cF2 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, cF2 ID 31)"
      },
      {
        "code": "cd1",
        "title": "U-phase error",
        "symptom": "Drive trips; keypad shows cd1, fault ID 33 in the fault record.",
        "causes": [
          "U-phase current detection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: cd1 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 33 = cd1."
        ],
        "fix": [
          "Cycle the power, if cd1 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, cd1 ID 33)"
      },
      {
        "code": "cd2",
        "title": "V-phase error",
        "symptom": "Drive trips; keypad shows cd2, fault ID 34 in the fault record.",
        "causes": [
          "V-phase current detection error when power ON",
          "Trip condition (Action Level): Hardware detection; action time: cd2 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 34 = cd2."
        ],
        "fix": [
          "Cycle the power, if cd2 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, cd2 ID 34)"
      },
      {
        "code": "cd3",
        "title": "W-phase error",
        "symptom": "Drive trips; keypad shows cd3, fault ID 35 in the fault record.",
        "causes": [
          "W-phase current detection error when power ON",
          "Trip condition (Action Level): Hardware detection; action time: cd3 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 35 = cd3."
        ],
        "fix": [
          "Cycle the power, if cd3 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, cd3 ID 35)"
      },
      {
        "code": "Hd0",
        "title": "cc hardware error",
        "symptom": "Drive trips; keypad shows Hd0, fault ID 36 in the fault record.",
        "causes": [
          "cc (current clamp) hardware protection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: Hd0 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 36 = Hd0."
        ],
        "fix": [
          "Cycle the power, if Hd0 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, Hd0 ID 36)"
      },
      {
        "code": "Hd1",
        "title": "oc hardware error",
        "symptom": "Drive trips; keypad shows Hd1, fault ID 37 in the fault record.",
        "causes": [
          "oc hardware protection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: Hd1 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 37 = Hd1."
        ],
        "fix": [
          "Cycle the power, if Hd1 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, Hd1 ID 37)"
      },
      {
        "code": "AUE",
        "title": "Auto-tuning error",
        "symptom": "Drive trips; keypad shows AUE, fault ID 40 in the fault record.",
        "causes": [
          "Motor auto-tuning error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 40 = AUE."
        ],
        "fix": [
          "This error can occur if you press the STOP key during auto-tuning. Re-execute auto-tuning.",
          "Check motor capacity and related parameters. a) Set the correct parameters P01.01–P01.02. b) Set P01.00 larger than the motor rated frequency.",
          "Check the motor wiring.",
          "Check for motor shaft lock and remove cause of lock if needed.",
          "Check for electromagnetic contactor at output (U/V/W) and make sure the electromagnetic valve is OFF.",
          "Verify load. If too heavy: a) Reduce the load. b) Replace the motor with a larger capacity model.",
          "Check if accel/decel time is too short, then increase the setting values for P01.12–P01.19 (accel./decel. time) if needed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, AUE ID 40)"
      },
      {
        "code": "AFE",
        "title": "PID loss AI2",
        "symptom": "Drive trips; keypad shows AFE, fault ID 41 in the fault record.",
        "causes": [
          "PID feedback loss (analog feedback signal is only valid when the PID function is enabled)",
          "Trip condition (Action Level): When the analog input < 4 mA (only detects 4–20 mA analog input); action time: P08.08"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 41 = AFE."
        ],
        "fix": [
          "Check the PID feedback cable and tighten the terminal. Replace the cable with a new one if needed.",
          "Check for feedback device failure and replace the device with a new one.",
          "Check all the wiring. If AFE fault still exists, contact AutomationDirect Technical Support.",
          "P08.09: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = warn, run at last frequency.",
          "P08.09=3 or 4: AFE is a warning, clears when feedback > 4 mA. P08.09=1 or 2: AFE is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-38, AFE ID 41)"
      },
      {
        "code": "PGF2",
        "title": "PG feedback loss",
        "symptom": "Drive trips; keypad shows PGF2, fault ID 43 in the fault record.",
        "causes": [
          "P10.00 and P10.02 is not set in the PG control mode. When press “RUN” key, PGF2 fault occurs.",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 43 = PGF2."
        ],
        "fix": [
          "Reset encoder parameters (P10.00 and P10.02)",
          "Verify correct control mode is selected (P00.11=1).",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-38, PGF2 ID 43)"
      },
      {
        "code": "PGF3",
        "title": "PG feedback stall",
        "symptom": "Drive trips; keypad shows PGF3, fault ID 44 in the fault record.",
        "causes": [
          "PG mode: motor frequency above stall level P10.10 for longer than detection time P10.11 gives PGF3.",
          "Trip condition (Action Level): P10.10; action time: P10.11"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 44 = PGF3."
        ],
        "fix": [
          "Reset encoder parameter (P10.01)",
          "Value for P01.00 may be too low, set a higher value.",
          "Reset ASR parameters. Verify accel/decel times and reset if needed.",
          "Reset PG feedback stall values, P10.10 and P10.11.",
          "Fault setting parameter: P10.12 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-38, PGF3 ID 44)"
      },
      {
        "code": "PGF4",
        "title": "PG slip error",
        "symptom": "Drive trips; keypad shows PGF4, fault ID 45 in the fault record.",
        "causes": [
          "PG mode: motor frequency beyond slip range P10.13 for longer than detection time P10.14 gives PGF4.",
          "Trip condition (Action Level): P10.13; action time: P10.14"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 45 = PGF4."
        ],
        "fix": [
          "Reset PG feedback parameters (P10.13 and P10.14)",
          "Reset ASR parameters. Verify accel/decel times and reset if needed.",
          "Reset encoder parameters (P0.01).",
          "Verify torque limit and set new values if needed (P06.12, P11.17-P11.20)",
          "Check for and resolve any causes of motor shaft lock.",
          "Check the mechanical brake has released correctly and verify the timing of the system.",
          "Fault setting parameter: P10.15 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop",
          "P10.15=0: PGF4 is a warning, auto-clears once output vs motor frequency is back within slip range. P10.15=1 or 2: fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-38, PGF4 ID 45)"
      },
      {
        "code": "ACE",
        "title": "AI2 loss",
        "symptom": "Drive trips; keypad shows ACE, fault ID 48 in the fault record.",
        "causes": [
          "Analog input loss (including all the 4–20 mA analog signal)",
          "Trip condition (Action Level): When the analog input is < 4 mA (only detects 4–20 mA analog input); action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 48 = ACE."
        ],
        "fix": [
          "Check the AI2 feedback cable and tighten the terminal. Replace the cable with a new one if needed.",
          "Check for external device failure and replace the device with a new one.",
          "Check all the wiring. If ACE fault still exists, contact AutomationDirect Technical Support.",
          "P03.19: 0 = off; 1 = keep last frequency, show ANL; 2 = decel to stop, show ANL; 3 = stop at once, show ACE.",
          "P03.19=1 or 2: ACE is a warning, clears when analog input > 4 mA. P03.19=3: ACE is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, ACE ID 48)"
      },
      {
        "code": "EF",
        "title": "External fault",
        "symptom": "Drive trips; keypad shows EF, fault ID 49 in the fault record.",
        "causes": [
          "External fault. When the drive decelerates based on the setting of P07.20, the EF fault displays on the keypad.",
          "Trip condition (Action Level): DIx=10: External fault (EF) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 49 = EF.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Press RESET key after the fault is cleared.",
          "P07.20: 0 = coast; 1-4 = stop on 1st/2nd/3rd/4th decel time; 5 = system decel; 6 = auto decel (P01.46).",
          "Reset: Manual reset; Manual reset only after the external fault is cleared (terminal status is recovered)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, EF ID 49)"
      },
      {
        "code": "EF1",
        "title": "Emergency stop",
        "symptom": "Drive trips; keypad shows EF1, fault ID 50 in the fault record.",
        "causes": [
          "When the contact of DIx=EF1 is ON, the output stops immediately and displays EF1 on the keypad. The motor is in free running.",
          "Trip condition (Action Level): DIx=28: Emergency Stop (EF1) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 50 = EF1.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Verify if the system is back to normal condition, and then press “RESET” key to go back to the default.",
          "Reset: Manual reset; Manual reset only after the external fault is cleared (terminal status is recovered)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, EF1 ID 50)"
      },
      {
        "code": "bb",
        "title": "External base block",
        "symptom": "Drive trips; keypad shows bb, fault ID 51 in the fault record.",
        "causes": [
          "When the contact of DIx=bb is ON, the output stops immediately and displays bb on the keypad. The motor is in free running.",
          "Trip condition (Action Level): DIx=11: Base Block (BB) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 51 = bb.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Verify if the system is back to normal condition, and then press “RESET” key to go back to the default.",
          "Reset: The display “bb” is automatically cleared after the fault is cleared.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, bb ID 51)"
      },
      {
        "code": "Pcod",
        "title": "Password is locked",
        "symptom": "Drive trips; keypad shows Pcod, fault ID 52 in the fault record.",
        "causes": [
          "Entering the wrong password three consecutive times through P00.07",
          "Trip condition (Action Level): Entering the wrong password three consecutive times; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 52 = Pcod."
        ],
        "fix": [
          "Input the correct password after rebooting the motor drive.",
          "Forgot password: enter 9999 and press ENTER, then do it again. Both entries must be done within 10 seconds, else retry.",
          "The parameter settings return to the default when the “Input 9999” process is finished.",
          "Reset: Manual reset; Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-40, Pcod ID 52)"
      },
      {
        "code": "CE1",
        "title": "Illegal command",
        "symptom": "Drive trips; keypad shows CE1, fault ID 54 in the fault record.",
        "causes": [
          "Communication command is illegal",
          "Trip condition (Action Level): When the function code is not 03, 06, 10, or 63.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 54 = CE1."
        ],
        "fix": [
          "Check if the communication command is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-40, CE1 ID 54)"
      },
      {
        "code": "CE2",
        "title": "Illegal data address",
        "symptom": "Drive trips; keypad shows CE2, fault ID 55 in the fault record.",
        "causes": [
          "Data address is illegal",
          "Trip condition (Action Level): When the data address is correct.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 55 = CE2."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-40, CE2 ID 55)"
      },
      {
        "code": "CE3",
        "title": "Illegal data value",
        "symptom": "Drive trips; keypad shows CE3, fault ID 56 in the fault record.",
        "causes": [
          "Data value is illegal",
          "Trip condition (Action Level): When the data length is too long; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 56 = CE3."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-40, CE3 ID 56)"
      },
      {
        "code": "CE4",
        "title": "Data is written to read- only address",
        "symptom": "Drive trips; keypad shows CE4, fault ID 57 in the fault record.",
        "causes": [
          "Data is written to read- only address",
          "Trip condition (Action Level): When the data is written to read-only address.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 57 = CE4."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-41, CE4 ID 57)"
      },
      {
        "code": "CE10",
        "title": "Modbus transmission time-out",
        "symptom": "Drive trips; keypad shows CE10, fault ID 58 in the fault record.",
        "causes": [
          "Modbus transmission time-out occurs",
          "Trip condition (Action Level): When the communication time exceeds the detection time for P09.03 communication time-out.; action time: P09.03"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 58 = CE10."
        ],
        "fix": [
          "Check if the upper unit transmits the communication command within the setting time for P09.03.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "P09.02: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = no warning or fault, keep running.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-41, CE10 ID 58)"
      },
      {
        "code": "ydc",
        "title": "Y-connection / Δ-connection switch error",
        "symptom": "Drive trips; keypad shows ydc, fault ID 61 in the fault record.",
        "causes": [
          "An error occurs when Y-Δ switches",
          "ydc: Y and Δ confirm signals both on at once, or neither confirm signal arrives within P05.25."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 61 = ydc."
        ],
        "fix": [
          "Check if the electromagnetic valve works normally during switch. If not, replace it.",
          "Check if related parameters are all set up and set correctly.",
          "Check the wiring of the Y-Δ switch function.",
          "Manual reset, allowed only when the confirm signal matching the active connection (Y or Δ) is on."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-41, ydc ID 61)"
      },
      {
        "code": "dEb",
        "title": "Deceleration energy backup error",
        "symptom": "Drive trips; keypad shows dEb, fault ID 62 in the fault record.",
        "causes": [
          "With P07.13 not 0, a power loss drops the DC bus below the dEb level; drive ramps the motor to stop and shows dEb.",
          "Trip condition (Action Level): When P07.13 is not 0, and the DC bus voltage is lower than the level of dEb.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 62 = dEb.",
          "Compare P06.34 (DC bus at fault) with the dEb level; applies when P07.13 is not 0."
        ],
        "fix": [
          "Check that the power system is not unstable or off.",
          "Another large load on the same supply: upsize the supply, or move that load to a separate supply.",
          "P07.13=2: dEb auto-clears and output resumes when power returns. P07.13=1: drive stops, reset by hand once at 0 Hz."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, dEb ID 62)"
      },
      {
        "code": "oSL",
        "title": "Over slip error",
        "symptom": "Drive trips; keypad shows oSL, fault ID 63 in the fault record.",
        "causes": [
          "oSL (induction motors only): at constant speed, F>H or F<H deviation exceeds P07.29 for longer than P07.30, based on slip limit P10.29.",
          "Trip condition (Action Level): P07.29 100% of P07.29 = the maximum limit of the slip frequency (P10.29); action time: P07.30"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 63 = oSL."
        ],
        "fix": [
          "Verify the group 5 motor parameters.",
          "Decrease the load",
          "Check the setting of oSL protection function related parameters P07.29, P07.30, and P10.29",
          "Fault setting parameter: P07.31 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "P07.31=0: oSL warning auto-clears once F>H or F<H is back within P07.29. P07.31=1 or 2: oSL is an error, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, oSL ID 63)"
      },
      {
        "code": "SrL1",
        "title": "STO Loss 1",
        "symptom": "Drive trips; keypad shows SrL1, fault ID 72 in the fault record.",
        "causes": [
          "STO1–SCM1 internal loop detection error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 72 = SrL1."
        ],
        "fix": [
          "Verify the connections at the drive control terminals.",
          "If issue still persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, SrL1 ID 72)",
        "fixIfNoStoWiring": [
          "Check the STO1-SCM1 short-circuit line; reconnect if missing. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "Sro",
        "title": "STO",
        "symptom": "Drive trips; keypad shows Sro, fault ID 76 in the fault record.",
        "causes": [
          "Safety Torque Off function active",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 76 = Sro."
        ],
        "fix": [
          "Reset the STO1/SCM1 and STO2/SCM2 switch (ON) and cycle the power.",
          "Verify the connections at the drive control terminals.",
          "If issue still persists, contact AutomationDirect Technical Support.",
          "After the STo cause is cleared: P06.44=1 resets automatically; P06.44=0 needs a manual reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, Sro ID 76)"
      },
      {
        "code": "SrL2",
        "title": "STO Loss 2",
        "symptom": "Drive trips; keypad shows SrL2, fault ID 77 in the fault record.",
        "causes": [
          "STO2–SCM2 internal loop detection error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 77 = SrL2."
        ],
        "fix": [
          "Verify the connections at the drive control terminals.",
          "If the issue persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, SrL2 ID 77)",
        "fixIfNoStoWiring": [
          "Check the STO2-SCM2 short-circuit line; reconnect if missing. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "SrL3",
        "title": "STO Loss 3",
        "symptom": "Drive trips; keypad shows SrL3, fault ID 78 in the fault record.",
        "causes": [
          "STO1–SCM1 and STO2– SCM2 internal loop detection error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 78 = SrL3."
        ],
        "fix": [
          "Verify the connections at the drive control terminals.",
          "If the issue persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, SrL3 ID 78)",
        "fixIfNoStoWiring": [
          "Check jumpers STO1-SCM1 and STO2-SCM2 are fitted; refit. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "Aoc",
        "title": "U-phase over-current before run",
        "symptom": "Drive trips; keypad shows Aoc (shown as UoC on the GS4-KPD keypad), fault ID 79 in the fault record.",
        "causes": [
          "U-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 79 = Aoc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "Aoc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, Aoc ID 79)"
      },
      {
        "code": "boc",
        "title": "V-phase over-current before run",
        "symptom": "Drive trips; keypad shows boc (shown as VoC on the GS4-KPD keypad), fault ID 80 in the fault record.",
        "causes": [
          "V-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 80 = boc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "boc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-44, boc ID 80)"
      },
      {
        "code": "coc",
        "title": "W-phase over-current before run",
        "symptom": "Drive trips; keypad shows coc (shown as WoC on the GS4-KPD keypad), fault ID 81 in the fault record.",
        "causes": [
          "W-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 81 = coc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "coc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-44, coc ID 81)"
      },
      {
        "code": "oPL1",
        "title": "Output phase loss U phase",
        "symptom": "Drive trips; keypad shows oPL1, fault ID 82 in the fault record.",
        "causes": [
          "U phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 82 = oPL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL1 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-45, oPL1 ID 82)"
      },
      {
        "code": "oPL2",
        "title": "Output phase loss V phase",
        "symptom": "Drive trips; keypad shows oPL2, fault ID 83 in the fault record.",
        "causes": [
          "V phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 83 = oPL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL2 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and keep operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-45, oPL2 ID 83)"
      },
      {
        "code": "oPL3",
        "title": "Output phase loss W phase",
        "symptom": "Drive trips; keypad shows oPL3, fault ID 84 in the fault record.",
        "causes": [
          "W phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 84 = oPL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL3 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, oPL3 ID 84)"
      },
      {
        "code": "oL3",
        "title": "Low frequency overload protection",
        "symptom": "Drive trips; keypad shows oL3, fault ID 87 in the fault record.",
        "causes": [
          "Low frequency and high current protection",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 87 = oL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Enhance the heat dissipation capacity for the cabinet.",
          "Lower the carrier frequency (P00.17).",
          "Decrease the voltage settings that correspond to frequency below 15 Hz in the V/F curve.",
          "Set P00.11=0 (V/F, general control mode).",
          "Replace the drive with a higher power model.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, oL3 ID 87)"
      },
      {
        "code": "roPd",
        "title": "Rotor position detection error",
        "symptom": "Drive trips; keypad shows roPd, fault ID 89 in the fault record.",
        "causes": [
          "Rotor position detection error protection",
          "Trip condition (Action Level): Reset the software; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 89 = roPd."
        ],
        "fix": [
          "Check the motor cable for damage and replace if needed.",
          "Check the motor coil, if damaged replace the motor.",
          "IGBT may be broken. If so, contact AutomationDirect Technical Support.",
          "Cycle the power. If roPd still occurs during operation, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, roPd ID 89)"
      },
      {
        "code": "CD10",
        "title": "Ethernet Card Timeout",
        "symptom": "Drive trips; keypad shows CD10, fault ID 97 in the fault record.",
        "causes": [
          "Ethernet communication has not been received from the external controller (within the Ethernet Timeout window).",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 97 = CD10."
        ],
        "fix": [
          "Initiate Ethernet communications from the master controller again.",
          "Disable checking for Ethernet Timeout in P9.94.",
          "Reset: Manual reset; Immediate reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, CD10 ID 97)"
      },
      {
        "code": "ictE",
        "title": "InrCOM time-out error",
        "symptom": "Drive trips; keypad shows ictE, fault ID 111 in the fault record.",
        "causes": [
          "Internal communication overtime error",
          "ictE trips at once on internal Master/Slave comms error; P09.31 = -1 to -10 (no -9)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 111 = ictE."
        ],
        "fix": [
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Verify the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Automatically reset after the internal communication is normal."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-47, ictE ID 111)"
      },
      {
        "code": "CP20",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP20, fault ID 121 in the fault record.",
        "causes": [
          "Internal communication time-out",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 121 = CP20."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-47, CP20 ID 121)"
      },
      {
        "code": "CP22",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP22, fault ID 123 in the fault record.",
        "causes": [
          "Abnormal internal communication",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 123 = CP22."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-47, CP22 ID 123)"
      },
      {
        "code": "CP30",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP30, fault ID 124 in the fault record.",
        "causes": [
          "Abnormal internal communication",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 124 = CP30."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-47, CP30 ID 124)"
      },
      {
        "code": "CP32",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP32, fault ID 126 in the fault record.",
        "causes": [
          "Abnormal internal communication",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 126 = CP32."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-47, CP32 ID 126)"
      },
      {
        "code": "CP33",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP33, fault ID 127 in the fault record.",
        "causes": [
          "Abnormal internal communication",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 127 = CP33."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-47, CP33 ID 127)"
      },
      {
        "code": "ot3",
        "title": "Over-torque 3",
        "symptom": "Drive trips; keypad shows ot3, fault ID 128 in the fault record.",
        "causes": [
          "ot3: output current above P14.75 for longer than P14.76, with P14.74 set to 2 or 4.",
          "Trip condition (Action Level): P14.75; action time: P14.76"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 128 = ot3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Configure the settings for P14.75 and P14.76 again.",
          "Check for mechanical error and remove the causes of malfunction.",
          "Verify load and decrease the loading or replace with a motor with larger capacity if load is too high.",
          "Verify accel/decel time and increase the setting values for P01.12– P01.19 (accel./ decel. time) if work cycle is too short.",
          "Check V/F voltage; tune motor 3 curve P01.54-P01.61, as a low mid-point voltage cuts low-speed torque.",
          "Replace motor with a larger capacity motor.",
          "Check for overload during low-speed operation and decrease the loading during low-speed operation or increase the motor capacity.",
          "Verify torque compensation and adjust P07.73 torque compensation gain until the output current decreases and the motor does not stall.",
          "Correct the parameter settings for speed tracking. Start the speed tracking function. Adjust the maximum current for P07.09 speed tracking.",
          "P14.74: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P14.74=1 or 3: ot3 is a warning, clears when current < P14.75. P14.74=2 or 4: ot3 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-48, ot3 ID 128)"
      },
      {
        "code": "ot4",
        "title": "Over-torque 4",
        "symptom": "Drive trips; keypad shows ot4, fault ID 129 in the fault record.",
        "causes": [
          "ot4: output current above P14.78 for longer than P14.79, with P14.77 set to 2 or 4.",
          "Trip condition (Action Level): P14.78; action time: P14.79"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 129 = ot4.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Configure the settings for P14.78 and P14.79 again.",
          "Check for mechanical error and remove the causes of malfunction.",
          "Verify load and decrease the loading or replace with a motor with larger capacity if load is too high.",
          "Verify accel/decel time and increase the setting values for P01.12– P01.19 (accel./ decel. time) if work cycle is too short.",
          "Check V/F voltage; tune V/F curve (Motor 3, P01.63-P01.70), as a low mid-point voltage cuts low-speed torque.",
          "Replace motor with a larger capacity motor.",
          "Check for overload during low-speed operation and decrease the loading during low-speed operation or increase the motor capacity.",
          "Verify torque compensation and adjust P07.75 torque compensation gain until the output current decreases and the motor does not stall.",
          "Correct the parameter settings for speed tracking. Start the speed tracking function. Adjust the maximum current for P07.09 speed tracking.",
          "P14.77: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P14.77=1 or 3: ot3 is a warning, clears when current < P14.75. P14.77=2 or 4: ot3 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-48, ot4 ID 129)"
      },
      {
        "code": "EoL3",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows EoL3, fault ID 134 in the fault record.",
        "causes": [
          "Electronic thermal relay 3 protection. The drive coasts to stop once it activates.",
          "Counts when output > 150% of motor 3 rated current; trips after P14.81. Repeat > 105% within 60 sec shortens the time."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 134 = EoL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 3 V/F curve P01.54-P01.61; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL3 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P14.80=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P14.80=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.73 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-49, EoL3 ID 134)"
      },
      {
        "code": "EoL4",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows EoL4, fault ID 135 in the fault record.",
        "causes": [
          "Electronic thermal relay 4 protection. The drive coasts to stop once it activates.",
          "Counts when output > 150% of motor 4 rated current; trips after P14.83. Repeat > 105% within 60 sec shortens the time."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 135 = EoL4.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 4 V/F curve P01.62-P01.70; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL4 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P14.82=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P14.82=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.75 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-49, EoL4 ID 135)"
      },
      {
        "code": "Hd6",
        "title": "oc hardware error",
        "symptom": "Drive trips; keypad shows Hd6, fault ID 140 in the fault record.",
        "causes": [
          "GFF hardware protection error when power is ON.",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act when the fault is detected"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 140 = Hd6."
        ],
        "fix": [
          "Cycle the power. If Hd6 still exists, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, Hd6 ID 140)"
      },
      {
        "code": "b4GFF",
        "title": "GFF occurs before run",
        "symptom": "Drive trips; keypad shows b4GFF, fault ID 141 in the fault record.",
        "causes": [
          "The ground short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 250% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 141 = b4GFF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, b4GFF ID 141)"
      },
      {
        "code": "AuE1",
        "title": "Auto-tune error 1",
        "symptom": "Drive trips; keypad shows AuE1, fault ID 142 in the fault record.",
        "causes": [
          "No feedback current error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 142 = AuE1."
        ],
        "fix": [
          "Verify the motor is wired correctly.",
          "If a contactor is used as an open state on the output side of the drive (U/V/W), check if the contactor coil is closed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, AuE1 ID 142)"
      },
      {
        "code": "AuE2",
        "title": "Auto-tune error 2",
        "symptom": "Drive trips; keypad shows AuE2, fault ID 143 in the fault record.",
        "causes": [
          "Motor phase loss error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 143 = AuE2."
        ],
        "fix": [
          "Verify that the motor is wired correctly and no wires are broken.",
          "Confirm that the motor works normally outside of auto-tuning.",
          "If an output (U/V/W) contactor is fitted, confirm all three of its phases are closed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, AuE2 ID 143)"
      },
      {
        "code": "AuE3",
        "title": "Auto-tune error 3",
        "symptom": "Drive trips; keypad shows AuE3, fault ID 144 in the fault record.",
        "causes": [
          "No load current I measurement 0 error when the motor parameter automatically detects.",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 144 = AuE3."
        ],
        "fix": [
          "Check the settings for P05.01 / P05.13 / P05.34.",
          "Confirm that the motor works normally outside of auto-tuning.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, AuE3 ID 144)"
      },
      {
        "code": "AUE5",
        "title": "Auto-tune error 5",
        "symptom": "Drive trips; keypad shows AUE5, fault ID 149 in the fault record.",
        "causes": [
          "The rotor resistance measuring error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 149 = AUE5."
        ],
        "fix": [
          "Verify that the motor is wired correctly and no wires are broken.",
          "Confirm that the motor works normally outside of auto-tuning. Possibly test with standard across-the-line starter.\"",
          "Reset: Manual reset; Immediate reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, AUE5 ID 149)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/gs20m/ch1.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs20m/ch3.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs20m/ch4.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf"
    ]
  },
  {
    "id": "gs10-vfd",
    "title": "AutomationDirect DURApulse GS10 AC drive",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "GS10|GS1"
    },
    "normal": [
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS10 120 V class 1-phase (100-120 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "85-132 VAC",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-11",
        "liveWork": true
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS10 230 V class 1-/3-phase (200-240 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "170-265 VAC",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ],
          [
            "S/L2",
            "T/L3"
          ],
          [
            "R/L1",
            "T/L3"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-12 to 1-14",
        "liveWork": true
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS10 460 V class 3-phase (380-480 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "323-528 VAC",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ],
          [
            "S/L2",
            "T/L3"
          ],
          [
            "R/L1",
            "T/L3"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-15, 1-16",
        "liveWork": true
      },
      {
        "terminals": "Keypad user display U (P00.04 = 3, default: DC bus voltage)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "DC bus between Lv level P06.00 (180VDC 120/230V, 360VDC 460V) and ov trip level (410VDC 120/230V, 820VDC 460V)",
        "note": "Lv/ov levels: Fault Codes table, LvA-LvS and ovA-ovS rows. P00.04 = 3 shows DC bus voltage; P06.34 holds DC bus at fault (p.4-27). https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf https://cdn.automationdirect.com/static/manuals/gs10m/ch4.pdf"
      },
      {
        "terminals": "+24V to DCM",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC ±10% (21.6-26.4 VDC), 100 mA max",
        "pins": [
          [
            "+24V",
            "DCM"
          ]
        ],
        "note": "Control terminal specifications, https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23"
      },
      {
        "terminals": "DI1-DI5 input (e.g. FWD (DI1)) to DCM, Source mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": ">= 11 VDC (activation current 3.3 mA)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23; DCM is the digital control common"
      },
      {
        "terminals": "DI1-DI5 input to DCM, Source mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "<= 5 VDC (cut-off voltage)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23"
      },
      {
        "terminals": "DI1-DI5 input to DCM, Sink mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": "<= 13 VDC (activation current 3.3 mA)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23"
      },
      {
        "terminals": "DI1-DI5 input to DCM, Sink mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": ">= 19 VDC (cut-off voltage)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23"
      },
      {
        "terminals": "+10V to ACM",
        "state": "powered",
        "meter": "VDC",
        "expected": "10.5 ±0.5 VDC (10.0-11.0 VDC), 20 mA max (potentiometer supply)",
        "pins": [
          [
            "+10V",
            "ACM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23/2-24"
      },
      {
        "terminals": "AI (AI-V voltage mode) to ACM",
        "state": "voltage-mode speed reference",
        "meter": "VDC",
        "expected": "0-10 VDC = 0 to maximum output frequency (P01.00)",
        "pins": [
          [
            "AI",
            "ACM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23/2-24"
      }
    ],
    "pairs": [
      {
        "a": "R1",
        "b": "R1O",
        "when": "fault (default P02.13 = 11, malfunction indication)",
        "note": "R1O = relay 1 N.O., R1C = relay 1 N.C., R1 = relay 1 common (p.2-23). P02.13 (R1) default 11 = fault output, on for any fault except Lv stop (p.4-87). https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf https://cdn.automationdirect.com/static/manuals/gs10m/ch4.pdf"
      },
      {
        "a": "R1",
        "b": "R1C",
        "when": "no fault (relay not activated, default P02.13 = 11)",
        "note": "R1O = relay 1 N.O., R1C = N.C., R1 = common (p.2-23). P02.13 (R1) default 11 = fault output, not for Lv stop (p.4-87). N.C. closed when unpowered. https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf https://cdn.automationdirect.com/static/manuals/gs10m/ch4.pdf"
      }
    ],
    "indicators": [
      {
        "name": "RUN LED",
        "state": "steady on",
        "meaning": "Drive is running."
      },
      {
        "name": "RUN LED",
        "state": "blinking",
        "meaning": "Drive is stopping or in base block."
      },
      {
        "name": "RUN LED",
        "state": "off",
        "meaning": "Drive is not running."
      },
      {
        "name": "FWD LED",
        "state": "steady on",
        "meaning": "Drive is operating in Forward mode."
      },
      {
        "name": "FWD LED",
        "state": "blinking",
        "meaning": "Drive is changing direction."
      },
      {
        "name": "REV LED",
        "state": "steady on",
        "meaning": "Drive is operating in Reverse mode."
      },
      {
        "name": "REV LED",
        "state": "blinking",
        "meaning": "Drive is changing direction."
      },
      {
        "name": "STOP LED",
        "state": "steady on",
        "meaning": "Drive is stopped or in the process of stopping."
      },
      {
        "name": "STOP LED",
        "state": "blinking",
        "meaning": "Drive is in standby (run but does not output)."
      },
      {
        "name": "STOP LED",
        "state": "off",
        "meaning": "Drive is not currently executing an operational (STOP) command."
      },
      {
        "name": "keypad display",
        "state": "shows a fault code (e.g. ocA, ovd, GFF)",
        "meaning": "Drive tripped on this fault (see ch6 Fault Codes). STOP/RESET clears it once the cause is gone; non-resettable faults show in fault records (MENU)."
      }
    ],
    "faults": [
      {
        "code": "ocA",
        "title": "Over-current during acceleration",
        "symptom": "Drive trips; keypad shows ocA, fault ID 1 in the fault record.",
        "causes": [
          "Output current over 3x rated while accelerating. Drive cuts output at once, motor coasts, display shows ocA.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 1 = ocA.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "If accel time is too short: lengthen accel or S-curve accel, use auto accel/decel (P01.44) or OC stall prevention (P06.03), or fit a bigger drive.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Compare output current over the whole cycle with drive rating; if it is exceeded, use a larger drive.",
          "Reduce the load or increase the capacity of AC motor drive.",
          "Check the motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive).",
          "Check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve setting and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the torque compensation (refer to P07.26 torque compensation gain) until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Enable speed tracking during start-up of P07.12.",
          "Correct the parameter settings for speed tracking. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Check the settings for P00.11 control mode: a) For IM, P00.11=0, 1, 2 b) For PM, P00.11=2",
          "Increase the AC motor drive’s capacity.",
          "Install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Check the stall prevention setting and set the stall prevention to the proper value.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-17, ocA ID 1)"
      },
      {
        "code": "ocd",
        "title": "Over-current during deceleration",
        "symptom": "Drive trips; keypad shows ocd, fault ID 2 in the fault record.",
        "causes": [
          "Output current over 3x rated while decelerating. Drive cuts output at once, motor coasts, display shows ocd.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 2 = ocd.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "If decel time is too short: lengthen decel or S-curve decel, use auto accel/decel (P01.44) or OC stall prevention (P06.03), or fit a bigger drive.",
          "Check if the mechanical brake of the motor activates too early.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Compare output current over the whole cycle with drive rating; if it is exceeded, use a larger drive.",
          "Check the impulsive change of the load and reduce the load or increase the capacity of AC motor drive as needed.",
          "Verify the motor capacity, the rated current on the motor’s nameplate should ≤ the rated current of the drive.",
          "With a contactor on the U/V/W output, check its timing: it must not switch while the drive is outputting voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it is too long, increase the AC motor drive’s capacity or install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Verify the stall prevention setting and set the stall prevention to the proper value.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-18, ocd ID 2)"
      },
      {
        "code": "ocn",
        "title": "Over-current during steady operation",
        "symptom": "Drive trips; keypad shows ocn, fault ID 3 in the fault record.",
        "causes": [
          "Output current over 3x rated at constant speed. Drive cuts output at once, motor coasts, display shows ocn.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 3 = ocn.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Look for locked shaft, burnt or aged motor insulation. Megger the motor; replace it if insulation is poor."
        ],
        "fix": [
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check for impulsive change of the load, and reduce the load or increase the capacity of AC motor drive.",
          "Check motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive)",
          "With a contactor on the drive output, check its timing: it must not switch while the drive is outputting voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-19, ocn ID 3)"
      },
      {
        "code": "GFF",
        "title": "Ground fault",
        "symptom": "Drive trips; keypad shows GFF, fault ID 4 in the fault record.",
        "causes": [
          "Ground short detected on output U/V/W. Drive cuts output at once, motor coasts, display shows GFF."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 4 = GFF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for motor burnout or aging insulation. a) Check the motor insulation value with megger. b) Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the cable for short circuits and replace the cable if needed.",
          "If the motor cable length exceeds 100 m, decrease the setting value for the carrier frequency and take remedies to reduce stray capacitance.",
          "Check grounding and wiring of the comms circuit. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Cycle the power after checking the status of motor, cable, and cable length. If GFF still exists, contact AutomationDirect Technical Support.",
          "Refer to the corrective actions for ocn.",
          "Refer to the corrective actions for ocA.",
          "Refer to the corrective actions for ocd.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-19, GFF ID 4)"
      },
      {
        "code": "ocS",
        "title": "Over-current at stop",
        "symptom": "Drive trips; keypad shows ocS, fault ID 6 in the fault record.",
        "causes": [
          "Over-current, or current-sensing hardware fault, while stopped. Cycle power after ocS; hardware faults show as cd1, cd2 or cd3.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 6 = ocS.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check if other error codes such as cd1–cd3 occur after cycling the power. If yes, return to the factory for repair.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-20, ocS ID 6)"
      },
      {
        "code": "ovA",
        "title": "Over-voltage during acceleration",
        "symptom": "Drive trips; keypad shows ovA, fault ID 7 in the fault record.",
        "causes": [
          "DC bus over-voltage while accelerating. Drive cuts output, motor coasts, display shows ovA.",
          "Trips at once when DC bus exceeds: 410VDC (120V/230V), 820VDC (460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 7 = ovA.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Check acceleration. If too slow: a) Decrease the acceleration time b) Use a braking unit or DC bus c) Replace the drive with a larger capacity model.",
          "Check the setting for stall prevention level. If the value is lower than no-load current, adjust it to be higher than no-load current.",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "If load inertia regenerates: use OV stall prevention (P06.01), auto accel/decel (P01.44), or a braking unit / DC bus.",
          "Fault right after accel ends means accel too short: lengthen accel, set P06.01 OV stall prevention, raise P01.25 S-curve accel time 2.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or brake unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-20, ovA ID 7)"
      },
      {
        "code": "ovd",
        "title": "Over-voltage during deceleration",
        "symptom": "Drive trips; keypad shows ovd, fault ID 8 in the fault record.",
        "causes": [
          "DC bus over-voltage while decelerating. Drive cuts output at once, motor coasts, display shows ovd.",
          "Trips at once when DC bus exceeds: 410VDC (120V/230V), 820VDC (460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 8 = ovd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Decel too short, too much regen: raise P01.13/P01.15/P01.17/P01.19, add brake resistor/unit, use P06.01, P01.44, adjust P07.01 (see source)",
          "Verify that the setting for stall prevention level is larger than no-load current",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-21, ovd ID 8)"
      },
      {
        "code": "ovn",
        "title": "Over-voltage during constant speed",
        "symptom": "Drive trips; keypad shows ovn, fault ID 9 in the fault record.",
        "causes": [
          "DC bus over-voltage at constant speed. Drive cuts output at once, motor coasts, display shows ovn.",
          "Trips at once when DC bus exceeds: 410VDC (120V/230V), 820VDC (460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 9 = ovn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Sudden load changes: add brake resistor, braking unit or DC bus; reduce load; use a larger drive; adjust braking level (P07.01 or unit bolt).",
          "Verify the stall prevention level setting is higher than no-load current.",
          "Check for regenerative voltage, then enable over-voltage stall prevention function (P06.01) or use a braking unit or DC bus",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-21, ovn ID 9)"
      },
      {
        "code": "ovS",
        "title": "Over-voltage at stop",
        "symptom": "Drive trips; keypad shows ovS, fault ID 10 in the fault record.",
        "causes": [
          "Over-voltage at stop",
          "Trips at once when DC bus exceeds: 410VDC (120V/230V), 820VDC (460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 10 = ovS.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check if other error codes such as cd1–cd3 occur after cycling the power. If yes, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-22, ovS ID 10)"
      },
      {
        "code": "LvA",
        "title": "Low-voltage during acceleration",
        "symptom": "Drive trips; keypad shows LvA, fault ID 11 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value during acceleration",
          "Trips at once when DC bus falls below P06.00 (180VDC 120V/230V, 360VDC 460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 11 = LvA.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 (120V/230V series = 180VDC 460V series = 360VDC."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The load may be too heavy. If so: a) Reduce the load. b) Increase the drive capacity. c) Increase the acceleration time.",
          "Check the DC bus and install DC reactor(s).",
          "Check that the jumper plate or DC reactor between terminals +1 and +2 is fitted; install one if missing.",
          "If the error still exists, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-22, LvA ID 11)"
      },
      {
        "code": "Lvd",
        "title": "Low-voltage during deceleration",
        "symptom": "Drive trips; keypad shows Lvd, fault ID 12 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value during deceleration",
          "Trips at once when DC bus falls below P06.00 (180VDC 120V/230V, 360VDC 460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 12 = Lvd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 (120V/230V series = 180VDC 460V series = 360VDC."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The fault may be triggered by sudden load. If so: a) Reduce the load. b) Increase the drive capacity.",
          "Check the DC bus and install DC reactor(s).",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-22, Lvd ID 12)"
      },
      {
        "code": "Lvn",
        "title": "Low-voltage at constant speed",
        "symptom": "Drive trips; keypad shows Lvn, fault ID 13 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value at constant speed",
          "Trips at once when DC bus falls below P06.00 (180VDC 120V/230V, 360VDC 460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 13 = Lvn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 (120V/230V series = 180VDC 460V series = 360VDC."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The fault may be triggered by sudden load. If so: a) Reduce the load. b) Increase the drive capacity.",
          "Check the DC bus and install DC reactor(s).",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-23, Lvn ID 13)"
      },
      {
        "code": "LvS",
        "title": "Low-voltage at stop",
        "symptom": "Drive trips; keypad shows LvS, fault ID 14 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value at stop or a hardware failure in voltage detection had occurred.",
          "Trips at once when DC bus falls below P06.00 (180VDC 120V/230V, 360VDC 460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 14 = LvS.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 (120V/230V series = 180VDC 460V series = 360VDC."
        ],
        "fix": [
          "Improve power supply condition.",
          "Check if the power specification matches the drive.",
          "Adjust voltage to the power range of the drive.",
          "Cycle the power after checking the power. If LvS error still exists, return to the factory for repair.",
          "Check the power system.",
          "Increase the capacity of power equipment.",
          "Install DC reactor(s).",
          "Reset: Manual / Auto: 120V/230V series: Lv level + 30VDC + 500ms 460V series: Lv level + 60VDC + 500ms; 500 ms."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-23, LvS ID 14)"
      },
      {
        "code": "orP",
        "title": "Phase loss protection",
        "symptom": "Drive trips; keypad shows orP, fault ID 15 in the fault record.",
        "causes": [
          "Phase loss of power input",
          "DC bus ripple above limit with output over 50% rated starts a counter; orP trips when it hits the limit. Delay depends on output current."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 15 = orP.",
          "Check P06.34 (DC bus at fault). orP trips after high DC ripple persists with output current over 50% of rated."
        ],
        "fix": [
          "Verify the wiring of the main circuit power is installed correctly.",
          "Check that a single-phase power supply is not being used with a three-phase model. Choose the model whose power matches the voltage.",
          "Supply voltage swings can cause it. Check main circuit and supply, cycle power; if orP stays, call AutomationDirect support.",
          "Check for loose terminal wiring, tighten the terminal screws according to the torque described in the user manual.",
          "Verify the input cable is undamaged and replace if needed.",
          "Check for unbalanced three-phase input power.",
          "Fault setting parameter: P06.53",
          "Reset: Manual reset; Immediately reset when DC bus is higher than P07.00."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-23, orP ID 15)"
      },
      {
        "code": "oH1",
        "title": "IGBT overheating",
        "symptom": "Drive trips; keypad shows oH1, fault ID 16 in the fault record.",
        "causes": [
          "IGBT temperature exceeds the protection level. Protection level is model default of P06.15 + 5°C",
          "IGBT overheat: level = model default of P06.15 +5°C. If P06.15 is above oH1 level, oH1 trips instead of warning; drive stops at once."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 16 = oH1.",
          "Read P06.36 (IGBT temperature at malfunction); P06.43 shows present IGBT temperature."
        ],
        "fix": [
          "Check the ambient temperature.",
          "Regularly inspect the ventilation hole of the control cabinet.",
          "Change the installed location if there are heating objects, such as braking resistors, in the surroundings.",
          "Install/add cooling fan or air conditioner to lower the temperature inside the cabinet.",
          "Check for and remove obstructions or replace the cooling fan.",
          "Increase ventilation space of the drive.",
          "Decrease loading.",
          "Decrease the carrier wave.",
          "Replace the drive with higher capacity model.",
          "Reset: Manual reset; Reset only when IGBT temperature is lower than oH1 error level minus (-) 10°C."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-24, oH1 ID 16)"
      },
      {
        "code": "tH1o",
        "title": "IGBT temperature detection failure",
        "symptom": "Drive trips; keypad shows tH1o, fault ID 18 in the fault record.",
        "causes": [
          "IGBT hardware failure in temperature detection",
          "NTC open or miswired. tH1o trips when IGBT temp is above protection level for over 100 ms."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 18 = tH1o.",
          "Read P06.36 (IGBT temperature at malfunction); P06.43 shows present IGBT temperature."
        ],
        "fix": [
          "Wait for 10 minutes, and then cycle the power. Check if tH1o protection still exists. If yes, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-24, tH1o ID 18)"
      },
      {
        "code": "oL",
        "title": "Over load",
        "symptom": "Drive trips; keypad shows oL, fault ID 21 in the fault record.",
        "causes": [
          "Output current too high. Limits: VT 120% for 1 min, 150% for 3 s; CT 150% for 1 min, 200% for 3 s (of drive rated current).",
          "Trips per overload and derating curves when load stays above the limit longer than allowed (oL)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 21 = oL.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "Replace the drive with a larger capacity model.",
          "If oL only at low speed: cut low-speed load, use a bigger drive, or lower carrier frequency P00.17.",
          "Adjust P07.26 Torque Compensation Gain until the output current reduces and the motor does not stall.",
          "Verify stall prevention is set to the proper value.",
          "Check the status of three-phase motor and verify the cable is not broken or screws are loose.",
          "Verify the parameter settings for speed tracking. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-24, oL ID 21)"
      },
      {
        "code": "EoL1",
        "title": "Electronics thermal relay 1 protection",
        "symptom": "Drive trips; keypad shows EoL1, fault ID 22 in the fault record.",
        "causes": [
          "Electronics thermal relay 1 protection. The drive coasts to stop once it activates.",
          "Counts when output > 150% of motor 1 rated current; trips after P06.14. Repeat > 105% within 60 sec shortens the time."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 22 = EoL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL1 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P06.13=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P06.13=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-25, EoL1 ID 22)"
      },
      {
        "code": "EoL2",
        "title": "Electronic thermal relay 2 protection",
        "symptom": "Drive trips; keypad shows EoL2, fault ID 23 in the fault record.",
        "causes": [
          "Electronic thermal relay 2 protection. The drive coasts to stop once it activates.",
          "Counts at output > 150% motor 2 current (P06.28; faster if > 105% again within 60 sec). PTC > P06.30 (50%) or PT100 > P06.57 (7V): immediate."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 23 = EoL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 2 V/F curve P01.35-P01.42; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL2 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P06.27=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P06.27=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Check ambient temperature. Move away from heat sources, or add a fan or air conditioning to cool the enclosure.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Check time spent at low speed: shorten it, use an inverter-duty motor, or a larger motor.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Check V/F voltage; tune P01.01-P01.08, as a low mid-point voltage cuts low-speed torque.",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection between PTC thermistor and the heat protection.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Check ambient temperature. Move away from heat sources, or add a fan or air conditioning to cool the enclosure.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Check time spent at low speed: shorten it, use an inverter-duty motor, or a larger motor.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Check V/F voltage; tune P01.01-P01.08, as a low mid-point voltage cuts low-speed torque.",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection of PT100 RTD.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Action set by P06.29: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = no warning.",
          "P06.29=0: oH3 is a warning, auto-clears (when temp < P06.56). P06.29=1 or 2: oH3 is a fault, reset by hand. Some cases reset five seconds after clear."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-25, EoL2 ID 23)"
      },
      {
        "code": "ot1",
        "title": "Over torque 1",
        "symptom": "Drive trips; keypad shows ot1, fault ID 26 in the fault record.",
        "causes": [
          "ot1: output current above P06.07 for longer than P06.08, with P06.06 or P06.09 set to 2 or 4.",
          "Trip condition (Action Level): P06.07; action time: P06.08"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 26 = ot1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the settings for P06.07 and P06.08.",
          "Check for mechanical failure and remove any causes of malfunction.",
          "Reduce the load or replace the motor with a higher capacity model.",
          "Increase the setting values for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 1 V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque.",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Check speed tracking: enable it and adjust its max current P07.09.",
          "P06.06: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P06.06=1 or 3: ot1 is a warning, clears when current < (Pr.06-07 - 5%). P06.06=2 or 4: ot1 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-27, ot1 ID 26)"
      },
      {
        "code": "ot2",
        "title": "Over torque 2",
        "symptom": "Drive trips; keypad shows ot2, fault ID 27 in the fault record.",
        "causes": [
          "ot2: output current above P06.10 for longer than P06.11, with P06.09 set to 2 or 4.",
          "Trip condition (Action Level): P06.10; action time: P06.11"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 27 = ot2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the settings for P06.10 and P06.11.",
          "Check for mechanical failure and remove any causes of malfunction.",
          "Reduce the load or replace the motor with a higher capacity model.",
          "Increase the setting values for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve (Motor 1, P01.35-P01.42); a low mid-point voltage cuts low-speed torque.",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Check speed tracking: enable it and adjust its max current P07.09.",
          "P06.09: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P06.09=1 or 3: ot2 is a warning, clears when current < (P06.10 - 5%). P06.09=2 or 4: ot2 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-28, ot2 ID 27)"
      },
      {
        "code": "uC",
        "title": "Under current",
        "symptom": "Drive trips; keypad shows uC, fault ID 28 in the fault record.",
        "causes": [
          "Low current detection",
          "Trip condition (Action Level): P06.71; action time: P06.72"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 28 = uC.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Confirm the motor cable is connected properly.",
          "Verify settings of P06.71, P06.72, and P06.73 and set to correct values if needed.",
          "Check if the load is too low and whether the motor capacity matches the load.",
          "P06.73: 0 = off; 1 = fault, coast stop; 2 = fault, ramp stop on 2nd decel time; 3 = warn, keep running.",
          "P06.73=3: uC is a warning, clears when current > (P06.71+0.1A). P06.73=1 or 2: uC is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-28, uC ID 28)"
      },
      {
        "code": "cF2",
        "title": "EEPROM read error",
        "symptom": "Drive trips; keypad shows cF2, fault ID 31 in the fault record.",
        "causes": [
          "Internal EEPROM cannot be read",
          "Trip condition (Action Level): Firmware internal detection; action time: cF2 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 31 = cF2."
        ],
        "fix": [
          "Press “RESET” key or reset the parameter to the default setting. If cF2 still occurs, contact AutomationDirect Technical Support.",
          "Cycle the power, if cF2 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-28, cF2 ID 31)"
      },
      {
        "code": "cd1",
        "title": "U-phase error",
        "symptom": "Drive trips; keypad shows cd1, fault ID 33 in the fault record.",
        "causes": [
          "U-phase current detection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: cd1 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 33 = cd1."
        ],
        "fix": [
          "Cycle the power, if cd1 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, cd1 ID 33)"
      },
      {
        "code": "cd2",
        "title": "V-phase error",
        "symptom": "Drive trips; keypad shows cd2, fault ID 34 in the fault record.",
        "causes": [
          "V-phase current detection error when power ON",
          "Trip condition (Action Level): Hardware detection; action time: cd2 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 34 = cd2."
        ],
        "fix": [
          "Cycle the power, if cd2 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, cd2 ID 34)"
      },
      {
        "code": "cd3",
        "title": "W-phase error",
        "symptom": "Drive trips; keypad shows cd3, fault ID 35 in the fault record.",
        "causes": [
          "W-phase current detection error when power ON",
          "Trip condition (Action Level): Hardware detection; action time: cd3 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 35 = cd3."
        ],
        "fix": [
          "Cycle the power, if cd3 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, cd3 ID 35)"
      },
      {
        "code": "Hd0",
        "title": "cc hardware error",
        "symptom": "Drive trips; keypad shows Hd0, fault ID 36 in the fault record.",
        "causes": [
          "cc (current clamp) hardware protection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: Hd0 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 36 = Hd0."
        ],
        "fix": [
          "Cycle the power, if Hd0 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, Hd0 ID 36)"
      },
      {
        "code": "Hd1",
        "title": "oc hardware error",
        "symptom": "Drive trips; keypad shows Hd1, fault ID 37 in the fault record.",
        "causes": [
          "oc hardware protection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: Hd1 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 37 = Hd1."
        ],
        "fix": [
          "Cycle the power, if Hd1 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, Hd1 ID 37)"
      },
      {
        "code": "AUE",
        "title": "Auto-tuning error",
        "symptom": "Drive trips; keypad shows AUE, fault ID 40 in the fault record.",
        "causes": [
          "Motor auto-tuning error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 40 = AUE."
        ],
        "fix": [
          "This error can occur if you press the STOP key during auto-tuning. Re-execute auto-tuning.",
          "Check motor capacity and related parameters. a) Set the correct parameters P01.01–P01.02. b) Set P01.00 larger than the motor rated frequency.",
          "Check the motor wiring.",
          "Check for motor shaft lock and remove cause of lock if needed.",
          "Check for electromagnetic contactor at output (U/V/W) and make sure the electromagnetic valve is OFF.",
          "Verify load. If too heavy: a) Reduce the load. b) Replace the motor with a larger capacity model.",
          "Check if accel/decel time is too short, then increase the setting values for P01.12–P01.19 (accel./decel. time) if needed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, AUE ID 40)"
      },
      {
        "code": "AFE",
        "title": "PID loss AI-C",
        "symptom": "Drive trips; keypad shows AFE, fault ID 41 in the fault record.",
        "causes": [
          "PID feedback loss (analog feedback signal is only valid when the PID function is enabled)",
          "Trip condition (Action Level): When the analog input < 4 mA (only detects 4–20 mA analog input); action time: P08.08"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 41 = AFE."
        ],
        "fix": [
          "Check the PID feedback cable and tighten the terminal. Replace the cable with a new one if needed.",
          "Check for feedback device failure and replace the device with a new one.",
          "Check all the wiring. If AFE fault still exists, contact AutomationDirect Technical Support.",
          "P08.09: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = warn, run at last frequency.",
          "P08.09=3 or 4: AFE is a warning, clears when feedback > 4 mA. P08.09=1 or 2: AFE is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, AFE ID 41)"
      },
      {
        "code": "ACE",
        "title": "AI-C loss",
        "symptom": "Drive trips; keypad shows ACE, fault ID 48 in the fault record.",
        "causes": [
          "Analog input loss (including all the 4–20 mA analog signal)",
          "Trip condition (Action Level): When the analog input is < 4 mA (only detects 4–20 mA analog input); action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 48 = ACE."
        ],
        "fix": [
          "Check the AI2 feedback cable and tighten the terminal. Replace the cable with a new one if needed.",
          "Check for external device failure and replace the device with a new one.",
          "Check all the wiring. If ACE fault still exists, contact AutomationDirect Technical Support.",
          "P03.19: 0 = off; 1 = keep last frequency, show ANL; 2 = decel to stop, show ANL; 3 = stop at once, show ACE.",
          "P03.19=1 or 2: ACE is a warning, clears when analog input > 4 mA. P03.19=3: ACE is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, ACE ID 48)"
      },
      {
        "code": "EF",
        "title": "External fault",
        "symptom": "Drive trips; keypad shows EF, fault ID 49 in the fault record.",
        "causes": [
          "External fault. When the drive decelerates based on the setting of P07.20, the EF fault displays on the keypad.",
          "Trip condition (Action Level): DIx=10: External fault (EF) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 49 = EF.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Press RESET key after the fault is cleared.",
          "P07.20: 0 = coast; 1-4 = stop on 1st/2nd/3rd/4th decel time; 5 = system decel; 6 = auto decel (P01.46).",
          "Reset: Manual reset; Manual reset only after the external fault is cleared (terminal status is recovered)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, EF ID 49)"
      },
      {
        "code": "EF1",
        "title": "Emergency stop",
        "symptom": "Drive trips; keypad shows EF1, fault ID 50 in the fault record.",
        "causes": [
          "When the contact of DIx=EF1 is ON, the output stops immediately and displays EF1 on the keypad. The motor is in free running.",
          "Trip condition (Action Level): DIx=28: Emergency Stop (EF1) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 50 = EF1.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Verify if the system is back to normal condition, and then press “RESET” key to go back to the default.",
          "Reset: Manual reset; Manual reset only after the external fault is cleared (terminal status is recovered)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, EF1 ID 50)"
      },
      {
        "code": "bb",
        "title": "External base block",
        "symptom": "Drive trips; keypad shows bb, fault ID 51 in the fault record.",
        "causes": [
          "When the contact of DIx=bb is ON, the output stops immediately and displays bb on the keypad. The motor is in free running.",
          "Trip condition (Action Level): DIx=11: Base Block (BB) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 51 = bb.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Verify if the system is back to normal condition, and then press “RESET” key to go back to the default.",
          "Reset: The display “bb” is automatically cleared after the fault is cleared.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, bb ID 51)"
      },
      {
        "code": "Pcod",
        "title": "Password is locked",
        "symptom": "Drive trips; keypad shows Pcod, fault ID 52 in the fault record.",
        "causes": [
          "Entering the wrong password three consecutive times through P00.07",
          "Trip condition (Action Level): Entering the wrong password three consecutive times; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 52 = Pcod."
        ],
        "fix": [
          "Input the correct password after rebooting the motor drive.",
          "Forgot password: enter 9999 and press ENTER, then do it again. Both entries must be done within 10 seconds, else retry.",
          "The parameter settings return to the default when the “Input 9999” process is finished.",
          "Reset: Manual reset; Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, Pcod ID 52)"
      },
      {
        "code": "CE1",
        "title": "Illegal command",
        "symptom": "Drive trips; keypad shows CE1, fault ID 54 in the fault record.",
        "causes": [
          "Communication command is illegal",
          "Trip condition (Action Level): When the function code is not 03, 06, 10, or 63.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 54 = CE1."
        ],
        "fix": [
          "Check if the communication command is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, CE1 ID 54)"
      },
      {
        "code": "CE2",
        "title": "Illegal data address",
        "symptom": "Drive trips; keypad shows CE2, fault ID 55 in the fault record.",
        "causes": [
          "Data address is illegal",
          "Trip condition (Action Level): When the data address is correct.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 55 = CE2."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, CE2 ID 55)"
      },
      {
        "code": "CE3",
        "title": "Illegal data value",
        "symptom": "Drive trips; keypad shows CE3, fault ID 56 in the fault record.",
        "causes": [
          "Data value is illegal",
          "Trip condition (Action Level): When the data length is too long; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 56 = CE3."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, CE3 ID 56)"
      },
      {
        "code": "CE4",
        "title": "Data is written to read- only address",
        "symptom": "Drive trips; keypad shows CE4, fault ID 57 in the fault record.",
        "causes": [
          "Data is written to read- only address",
          "Trip condition (Action Level): When the data is written to read-only address.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 57 = CE4."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, CE4 ID 57)"
      },
      {
        "code": "CE10",
        "title": "Modbus transmission time-out",
        "symptom": "Drive trips; keypad shows CE10, fault ID 58 in the fault record.",
        "causes": [
          "Modbus transmission time-out occurs",
          "Trip condition (Action Level): When the communication time exceeds the detection time for P09.03 communication time-out.; action time: P09.03"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 58 = CE10."
        ],
        "fix": [
          "Check if the upper unit transmits the communication command within the setting time for P09.03.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "P09.02: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = no warning or fault, keep running.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, CE10 ID 58)"
      },
      {
        "code": "oSL",
        "title": "Over slip error",
        "symptom": "Drive trips; keypad shows oSL, fault ID 63 in the fault record.",
        "causes": [
          "oSL (induction motors only): at constant speed, F>H or F<H deviation exceeds P07.29 for longer than P07.30, based on slip limit P10.29.",
          "Trip condition (Action Level): P07.29 100% of P07.29 = the maximum limit of the slip frequency (P10.29); action time: P07.30"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 63 = oSL."
        ],
        "fix": [
          "Verify the group 5 motor parameters.",
          "Decrease the load",
          "Check the setting of oSL protection function related parameters P07.29, P07.30, and P10.29",
          "Fault setting parameter: P07.31 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "P07.31=0: oSL warning auto-clears once F>H or F<H is back within P07.29. P07.31=1 or 2: oSL is an error, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, oSL ID 63)"
      },
      {
        "code": "Sto",
        "title": "STO",
        "symptom": "Drive trips; keypad shows Sto, fault ID 76 in the fault record.",
        "causes": [
          "GS10 does not have STO function. Fault occurs due to missing jumper on the bypass pins or internal drive problem",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 76 = Sto."
        ],
        "fix": [
          "If STO fault still exists after cycling the power, please contact ADC\"",
          "Only after the STO cause is cleared: P06.44=1 resets automatically; P06.44=0 needs a manual reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, Sto ID 76)",
        "fixIfNoStoWiring": [
          "Check the bypass-pin jumper is fitted. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "Aoc",
        "title": "U-phase over-current before run",
        "symptom": "Drive trips; keypad shows Aoc (shown as UoC on the GS4-KPD keypad), fault ID 79 in the fault record.",
        "causes": [
          "U-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 79 = Aoc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "Aoc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, Aoc ID 79)"
      },
      {
        "code": "boc",
        "title": "V-phase over-current before run",
        "symptom": "Drive trips; keypad shows boc (shown as VoC on the GS4-KPD keypad), fault ID 80 in the fault record.",
        "causes": [
          "V-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 80 = boc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "boc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, boc ID 80)"
      },
      {
        "code": "coc",
        "title": "W-phase over-current before run",
        "symptom": "Drive trips; keypad shows coc (shown as WoC on the GS4-KPD keypad), fault ID 81 in the fault record.",
        "causes": [
          "W-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 81 = coc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "coc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-34, coc ID 81)"
      },
      {
        "code": "oPL1",
        "title": "Output phase loss U phase",
        "symptom": "Drive trips; keypad shows oPL1, fault ID 82 in the fault record.",
        "causes": [
          "U phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 82 = oPL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL1 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-34, oPL1 ID 82)"
      },
      {
        "code": "oPL2",
        "title": "Output phase loss V phase",
        "symptom": "Drive trips; keypad shows oPL2, fault ID 83 in the fault record.",
        "causes": [
          "V phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 83 = oPL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL2 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and keep operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-35, oPL2 ID 83)"
      },
      {
        "code": "oPL3",
        "title": "Output phase loss W phase",
        "symptom": "Drive trips; keypad shows oPL3, fault ID 84 in the fault record.",
        "causes": [
          "W phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 84 = oPL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL3 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-35, oPL3 ID 84)"
      },
      {
        "code": "oL3",
        "title": "Low frequency overload protection",
        "symptom": "Drive trips; keypad shows oL3, fault ID 87 in the fault record.",
        "causes": [
          "Low frequency and high current protection",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 87 = oL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Enhance the heat dissipation capacity for the cabinet.",
          "Lower the carrier frequency (P00.17).",
          "Decrease the voltage settings that correspond to frequency below 15 Hz in the V/F curve.",
          "Set P00.11=0 (V/F, general control mode).",
          "Replace the drive with a higher power model.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-35, oL3 ID 87)"
      },
      {
        "code": "Hd6",
        "title": "oc hardware error",
        "symptom": "Drive trips; keypad shows Hd6, fault ID 140 in the fault record.",
        "causes": [
          "GFF hardware protetion error when power is ON.",
          "Trip condition (Action Level): Hardware; action time: Immediately act when the fault is detected"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 140 = Hd6."
        ],
        "fix": [
          "Cycle the power. If Hd6 still exists, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, Hd6 ID 140)"
      },
      {
        "code": "b4GF",
        "title": "GFF occurs before run",
        "symptom": "Drive trips; keypad shows b4GF, fault ID 141 in the fault record.",
        "causes": [
          "The ground short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 250% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 141 = b4GF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, b4GF ID 141)"
      },
      {
        "code": "AuE1",
        "title": "Auto-tune error 1",
        "symptom": "Drive trips; keypad shows AuE1, fault ID 142 in the fault record.",
        "causes": [
          "No feedback current error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 142 = AuE1."
        ],
        "fix": [
          "Verify the motor is wired correctly.",
          "If a contactor is used as an open state on the output side of the drive (U/V/W), check if the contactor coil is closed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, AuE1 ID 142)"
      },
      {
        "code": "AuE2",
        "title": "Auto-tune error 2",
        "symptom": "Drive trips; keypad shows AuE2, fault ID 143 in the fault record.",
        "causes": [
          "Motor phase loss error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 143 = AuE2."
        ],
        "fix": [
          "Verify that the motor is wired correctly and no wires are broken.",
          "Confirm that the motor works normally outside of auto-tuning.",
          "If an output (U/V/W) contactor is fitted, confirm all three of its phases are closed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, AuE2 ID 143)"
      },
      {
        "code": "AUE3",
        "title": "Auto-tune error 3",
        "symptom": "Drive trips; keypad shows AUE3, fault ID 144 in the fault record.",
        "causes": [
          "No load current I measurement 0 error when the motor parameter automatically detects.",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 144 = AUE3."
        ],
        "fix": [
          "Check the settings for P05.01 / P05.13 / P05.34.",
          "Confirm that the motor works normally outside of auto-tuning.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, AUE3 ID 144)"
      },
      {
        "code": "AuE5",
        "title": "Total resistance measurement fault",
        "symptom": "Drive trips; keypad shows AuE5, fault ID 149 in the fault record.",
        "causes": [
          "Fault on measuring total resistance.",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 149 = AuE5."
        ],
        "fix": [
          "Check if the motor works normally.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-36, AuE5 ID 149)"
      },
      {
        "code": "AuE6",
        "title": "No-load current IO measurement fault",
        "symptom": "Drive trips; keypad shows AuE6, fault ID 150 in the fault record.",
        "causes": [
          "Fault on measuring no- load current IO.",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 150 = AuE6."
        ],
        "fix": [
          "Check if the motor works normally.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, AuE6 ID 150)"
      },
      {
        "code": "AuE7",
        "title": "dq axis inductance measurement fault",
        "symptom": "Drive trips; keypad shows AuE7, fault ID 151 in the fault record.",
        "causes": [
          "Fault on measuring dq axis inductance",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 151 = AuE7."
        ],
        "fix": [
          "Check if the motor works normally.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, AuE7 ID 151)"
      },
      {
        "code": "AuE8",
        "title": "High frequency injection measurement fault",
        "symptom": "Drive trips; keypad shows AuE8, fault ID 152 in the fault record.",
        "causes": [
          "Fault on measuring high frequency injection",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 152 = AuE8."
        ],
        "fix": [
          "Check if the motor works normally.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, AuE8 ID 152)"
      },
      {
        "code": "dEv",
        "title": "Pump PID feedback error",
        "symptom": "Drive trips; keypad shows dEv, fault ID 157 in the fault record.",
        "causes": [
          "Pump PID feedback error",
          "Trip condition (Action Level): Feedback value < target value × (1 - P08.13); action time: P08.14"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 157 = dEv."
        ],
        "fix": [
          "Check P08.14 time extension for unreasonable parameter settings.",
          "Check if the motor works normally.",
          "Fault setting parameter: P08.62",
          "Reset: Self-recovery or manual reset.; Set as Warning: Feedback value ≥ target value (1 - P08.13) automatic recovery. Set as Fault: Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, dEv ID 157)"
      },
      {
        "code": "Hd7",
        "title": "Gate driver error",
        "symptom": "Drive trips; keypad shows Hd7, fault ID 159 in the fault record.",
        "causes": [
          "Hardware error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: Hd7 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 159 = Hd7."
        ],
        "fix": [
          "Cycle the power, if Hd7 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, Hd7 ID 159)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/gs10m/ch1.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs10m/ch3.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs10m/ch4.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf"
    ]
  },
  {
    "id": "gs30-vfd",
    "title": "AutomationDirect DURApulse GS30 AC drive",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "GS30"
    },
    "normal": [
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS30 230 V class 1-/3-phase (200-240 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "170-265 VAC",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ],
          [
            "S/L2",
            "T/L3"
          ],
          [
            "R/L1",
            "T/L3"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-14 to 1-17",
        "liveWork": true
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS30 460 V class 3-phase (380-480 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "323-528 VAC",
        "pins": [
          [
            "R/L1",
            "S/L2"
          ],
          [
            "S/L2",
            "T/L3"
          ],
          [
            "R/L1",
            "T/L3"
          ]
        ],
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-18 to 1-20",
        "liveWork": true
      },
      {
        "terminals": "Keypad user display U (P00.04 = 3, default: DC bus voltage)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "DC bus above the low-voltage level P06.00 (180 VDC 230 V class, 360 VDC 460 V) and below the over-voltage trip level (410 VDC 230 V, 820 VDC 460 V)",
        "note": "Lv/ov levels: Fault Codes table, LvA-LvS and ovA-ovS rows. P00.04 = 3 shows DC bus voltage; P06.34 holds DC bus at fault (p.4-33). https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf https://cdn.automationdirect.com/static/manuals/gs30m/ch4.pdf"
      },
      {
        "terminals": "+24V to DCM",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC ±10% (21.6-26.4 VDC), 100 mA max",
        "pins": [
          [
            "+24V",
            "DCM"
          ]
        ],
        "note": "Control terminal specifications, https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30"
      },
      {
        "terminals": "DI1-DI7 input (e.g. FWD (DI1)) to DCM, Source mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": ">= 11 VDC (activation current 3.3 mA)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ],
          [
            "DI6",
            "DCM"
          ],
          [
            "DI7",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30; DCM is the digital control common"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Source mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "<= 5 VDC (cut-off voltage)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ],
          [
            "DI6",
            "DCM"
          ],
          [
            "DI7",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Sink mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": "<= 13 VDC (activation current 3.3 mA)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ],
          [
            "DI6",
            "DCM"
          ],
          [
            "DI7",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Sink mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": ">= 19 VDC (cut-off voltage)",
        "pins": [
          [
            "DI1",
            "DCM"
          ],
          [
            "DI2",
            "DCM"
          ],
          [
            "DI3",
            "DCM"
          ],
          [
            "DI4",
            "DCM"
          ],
          [
            "DI5",
            "DCM"
          ],
          [
            "DI6",
            "DCM"
          ],
          [
            "DI7",
            "DCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30"
      },
      {
        "terminals": "+10V to ACM",
        "state": "powered",
        "meter": "VDC",
        "expected": "10.5 ±0.5 VDC (10.0-11.0 VDC), 20 mA max (potentiometer supply)",
        "pins": [
          [
            "+10V",
            "ACM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-31"
      },
      {
        "terminals": "AI1 to ACM",
        "state": "voltage-mode speed reference",
        "meter": "VDC",
        "expected": "0-10 VDC = 0 to maximum output frequency (P01.00)",
        "pins": [
          [
            "AI1",
            "ACM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-31"
      },
      {
        "terminals": "STO1 to SCM and STO2 to SCM",
        "state": "run permitted (STO cut-off mode; default STO1/STO2 jumpered to +24V)",
        "meter": "VDC",
        "expected": "11-30 VDC on both channels (rated 24 VDC ±10%, 6.67 mA)",
        "pins": [
          [
            "STO1",
            "SCM"
          ],
          [
            "STO2",
            "SCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-32"
      },
      {
        "terminals": "STO1 to SCM or STO2 to SCM",
        "state": "safe torque off active",
        "meter": "VDC",
        "expected": "0-5 VDC on either channel; drive output stops within 20 ms",
        "pins": [
          [
            "STO1",
            "SCM"
          ],
          [
            "STO2",
            "SCM"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-32"
      }
    ],
    "pairs": [
      {
        "a": "R1",
        "b": "R1O",
        "when": "fault (default P02.13 = 11, malfunction indication)",
        "note": "R1O = relay 1 N.O., R1C = relay 1 N.C., R1 = relay 1 common (p.2-31). P02.13 (R1) default 11 = fault output, on for faults except Lv stop (p.4-112). https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf https://cdn.automationdirect.com/static/manuals/gs30m/ch4.pdf"
      },
      {
        "a": "R1",
        "b": "R1C",
        "when": "no fault (relay not activated, default P02.13 = 11)",
        "note": "R1O = relay 1 N.O., R1C = N.C., R1 = common (p.2-31). P02.13 (R1) default 11 = fault output, not for Lv stop (p.4-112). N.C. closed when unpowered. https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf https://cdn.automationdirect.com/static/manuals/gs30m/ch4.pdf"
      }
    ],
    "indicators": [
      {
        "name": "RUN LED",
        "state": "steady on",
        "meaning": "Drive is running."
      },
      {
        "name": "RUN LED",
        "state": "blinking",
        "meaning": "Drive is stopping or in base block."
      },
      {
        "name": "RUN LED",
        "state": "off",
        "meaning": "Drive is not running."
      },
      {
        "name": "FWD LED",
        "state": "steady on",
        "meaning": "Drive is operating in Forward mode."
      },
      {
        "name": "FWD LED",
        "state": "blinking",
        "meaning": "Drive is changing direction."
      },
      {
        "name": "REV LED",
        "state": "steady on",
        "meaning": "Drive is operating in Reverse mode."
      },
      {
        "name": "REV LED",
        "state": "blinking",
        "meaning": "Drive is changing direction."
      },
      {
        "name": "STOP LED",
        "state": "steady on",
        "meaning": "Drive is stopped or in the process of stopping."
      },
      {
        "name": "STOP LED",
        "state": "blinking",
        "meaning": "Drive is in standby (run but does not output)."
      },
      {
        "name": "STOP LED",
        "state": "off",
        "meaning": "Drive is not currently executing an operational (STOP) command."
      },
      {
        "name": "PLC LED",
        "state": "steady on",
        "meaning": "PLC STOP (PLC 2) initiated."
      },
      {
        "name": "PLC LED",
        "state": "blinking",
        "meaning": "PLC Run (PLC1) initiated."
      },
      {
        "name": "PLC LED",
        "state": "off",
        "meaning": "No PLC functions implemented (PLC 0)."
      },
      {
        "name": "keypad display",
        "state": "shows a fault code (e.g. ocA, ovd, GFF)",
        "meaning": "Drive tripped on this fault (see ch6 Fault Codes). STOP/RESET clears it once the cause is gone; non-resettable faults show in fault records (MENU)."
      }
    ],
    "faults": [
      {
        "code": "ocA",
        "title": "Over-current during acceleration",
        "symptom": "Drive trips; keypad shows ocA, fault ID 1 in the fault record.",
        "causes": [
          "Output current over 3x rated while accelerating. Drive cuts output at once, motor coasts, display shows ocA.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 1 = ocA.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "If accel time is too short: lengthen accel or S-curve accel, use auto accel/decel (P01.44) or OC stall prevention (P06.03), or fit a bigger drive.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Compare output current over the whole cycle with drive rating; if it is exceeded, use a larger drive.",
          "Reduce the load or increase the capacity of AC motor drive.",
          "Check the motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive).",
          "Check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve setting and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the torque compensation (refer to P07.26 torque compensation gain) until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Enable speed tracking during start-up of P07.12.",
          "Correct the parameter settings for speed tracking. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Check the settings for P00.11 control mode: a) For IM, P00.11=0, 1, 2, 5 b) For PM, P00.11=2",
          "Increase the AC motor drive’s capacity.",
          "Install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Check the stall prevention setting and set the stall prevention to the proper value.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-26, ocA ID 1)"
      },
      {
        "code": "ocd",
        "title": "Over-current during deceleration",
        "symptom": "Drive trips; keypad shows ocd, fault ID 2 in the fault record.",
        "causes": [
          "Output current over 3x rated while decelerating. Drive cuts output at once, motor coasts, display shows ocd.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 2 = ocd.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "If decel time is too short: lengthen decel or S-curve decel, use auto accel/decel (P01.44) or OC stall prevention (P06.03), or fit a bigger drive.",
          "Check if the mechanical brake of the motor activates too early.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Compare output current over the whole cycle with drive rating; if it is exceeded, use a larger drive.",
          "Check the impulsive change of the load and reduce the load or increase the capacity of AC motor drive as needed.",
          "Verify the motor capacity, the rated current on the motor’s nameplate should ≤ the rated current of the drive.",
          "With a contactor on the U/V/W output, check its timing: it must not switch while the drive is outputting voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it is too long, increase the AC motor drive’s capacity or install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Verify the stall prevention setting and set the stall prevention to the proper value.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-27, ocd ID 2)"
      },
      {
        "code": "ocn",
        "title": "Over-current during steady operation",
        "symptom": "Drive trips; keypad shows ocn, fault ID 3 in the fault record.",
        "causes": [
          "Output current over 3x rated at constant speed. Drive cuts output at once, motor coasts, display shows ocn.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 3 = ocn.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Look for locked shaft, burnt or aged motor insulation. Megger the motor; replace it if insulation is poor."
        ],
        "fix": [
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check for impulsive change of the load, and reduce the load or increase the capacity of AC motor drive.",
          "Check motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive)",
          "With a contactor on the drive output, check its timing: it must not switch while the drive is outputting voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "Hardware cause: output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-28, ocn ID 3)"
      },
      {
        "code": "GFF",
        "title": "Ground fault",
        "symptom": "Drive trips; keypad shows GFF, fault ID 4 in the fault record.",
        "causes": [
          "Ground short detected on output U/V/W. Drive cuts output at once, motor coasts, display shows GFF."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 4 = GFF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for motor burnout or aging insulation. a) Check the motor insulation value with megger. b) Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the cable for short circuits and replace the cable if needed.",
          "If the motor cable length exceeds 100 m, decrease the setting value for the carrier frequency and take remedies to reduce stray capacitance.",
          "Check grounding and wiring of the comms circuit. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Cycle the power after checking the status of motor, cable, and cable length. If GFF still exists, contact AutomationDirect Technical Support.",
          "Refer to the corrective actions for ocn.",
          "Refer to the corrective actions for ocA.",
          "Refer to the corrective actions for ocd.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-28, GFF ID 4)"
      },
      {
        "code": "occ",
        "title": "IGBT short circuit between upper bridge and lower bridge",
        "symptom": "Drive trips; keypad shows occ, fault ID 5 in the fault record.",
        "causes": [
          "Short-circuit is detected between upper bridge and lower bridge of the IGBT module",
          "Trip condition (Action Level): Hardware protection; action time: Act immediately"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 5 = occ.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check the motor wiring.",
          "Cycle the power. If occ still occurs, return to AutomationDirect.",
          "Reset: Manual reset; Rest in 5 seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, occ ID 5)"
      },
      {
        "code": "ocS",
        "title": "Over-current at stop",
        "symptom": "Drive trips; keypad shows ocS, fault ID 6 in the fault record.",
        "causes": [
          "Over-current, or current-sensing hardware fault, while stopped. Cycle power after ocS; hardware faults show as cd1, cd2 or cd3.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 6 = ocS.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check if other error codes such as cd1–cd3 occur after cycling the power. If yes, return to the factory for repair.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, ocS ID 6)"
      },
      {
        "code": "ovA",
        "title": "Over-voltage during acceleration",
        "symptom": "Drive trips; keypad shows ovA, fault ID 7 in the fault record.",
        "causes": [
          "DC bus over-voltage while accelerating. Drive cuts output, motor coasts, display shows ovA.",
          "Trip condition (Action Level): 230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 7 = ovA.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Check acceleration. If too slow: a) Decrease the acceleration time b) Use a braking unit or DC bus c) Replace the drive with a larger capacity model.",
          "Check the setting for stall prevention level. If the value is lower than no-load current, adjust it to be higher than no-load current.",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "If load inertia regenerates: use OV stall prevention (P06.01), auto accel/decel (P01.44), or a braking unit / DC bus.",
          "Fault right after accel ends means accel too short: lengthen accel, set P06.01 OV stall prevention, raise P01.25 S-curve accel time 2.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or brake unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-29, ovA ID 7)"
      },
      {
        "code": "ovd",
        "title": "Over-voltage during deceleration",
        "symptom": "Drive trips; keypad shows ovd, fault ID 8 in the fault record.",
        "causes": [
          "DC bus over-voltage while decelerating. Drive cuts output at once, motor coasts, display shows ovd.",
          "Trip condition (Action Level): 230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 8 = ovd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Decel too short, too much regen: raise P01.13/P01.15/P01.17/P01.19, add brake resistor/unit, use P06.01, P01.44, adjust P07.01 (see source)",
          "Verify that the setting for stall prevention level is larger than no-load current",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, ovd ID 8)"
      },
      {
        "code": "ovn",
        "title": "Over-voltage during constant speed",
        "symptom": "Drive trips; keypad shows ovn, fault ID 9 in the fault record.",
        "causes": [
          "DC bus over-voltage at constant speed. Drive cuts output at once, motor coasts, display shows ovn.",
          "Trip condition (Action Level): 230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 9 = ovn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Sudden load changes: add brake resistor, braking unit or DC bus; reduce load; use a larger drive; adjust braking level (P07.01 or unit bolt).",
          "Verify the stall prevention level setting is higher than no-load current.",
          "Check for regenerative voltage, then enable over-voltage stall prevention function (P06.01) or use a braking unit or DC bus",
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-30, ovn ID 9)"
      },
      {
        "code": "ovS",
        "title": "Over-voltage at stop",
        "symptom": "Drive trips; keypad shows ovS, fault ID 10 in the fault record.",
        "causes": [
          "Over-voltage at stop",
          "Trip condition (Action Level): 230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 10 = ovS.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Phase-advance capacitors or an active supply on the same network can cause brief input surges; add an AC reactor.",
          "Ground-fault current can charge the DC bus caps. Check motor cable, junction box and its terminals for a ground fault.",
          "If using a braking resistor or braking unit, check the wiring.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check if other error codes such as cd1–cd3 occur after cycling the power. If yes, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset only when the DC bus voltage is lower than 90% of the over- voltage level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, ovS ID 10)"
      },
      {
        "code": "LvA",
        "title": "Low-voltage during acceleration",
        "symptom": "Drive trips; keypad shows LvA, fault ID 11 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value during acceleration",
          "Trips at once when DC bus falls below P06.00 (180VDC 230V, 360VDC 460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 11 = LvA.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 230V series = 180VDC 460V series = 360VDC."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The load may be too heavy. If so: a) Reduce the load. b) Increase the drive capacity. c) Increase the acceleration time.",
          "Check the DC bus and install DC reactor(s).",
          "Check that the jumper plate or DC reactor between terminals +1 and +2 is fitted; install one if missing.",
          "If the error still exists, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, LvA ID 11)"
      },
      {
        "code": "Lvd",
        "title": "Low-voltage during deceleration",
        "symptom": "Drive trips; keypad shows Lvd, fault ID 12 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value during deceleration",
          "Trips at once when DC bus falls below P06.00 (180VDC 230V, 360VDC 460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 12 = Lvd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 230V series = 180VDC 460V series = 360VDC."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The fault may be triggered by sudden load. If so: a) Reduce the load. b) Increase the drive capacity.",
          "Check the DC bus and install DC reactor(s).",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-31, Lvd ID 12)"
      },
      {
        "code": "Lvn",
        "title": "Low-voltage at constant speed",
        "symptom": "Drive trips; keypad shows Lvn, fault ID 13 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value at constant speed",
          "Trips at once when DC bus falls below P06.00 (180VDC 230V, 360VDC 460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 13 = Lvn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 230V series = 180VDC 460V series = 360VDC."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The fault may be triggered by sudden load. If so: a) Reduce the load. b) Increase the drive capacity.",
          "Check the DC bus and install DC reactor(s).",
          "Reset: Manual reset; Reset when the DC bus voltage is higher than P06.00 + 30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, Lvn ID 13)"
      },
      {
        "code": "LvS",
        "title": "Low-voltage at stop",
        "symptom": "Drive trips; keypad shows LvS, fault ID 14 in the fault record.",
        "causes": [
          "DC bus voltage is lower than P06.00 setting value at stop or a hardware failure in voltage detection had occurred.",
          "Trips at once when DC bus falls below P06.00 (180VDC 230V, 360VDC 460V)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 14 = LvS.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 230V series = 180VDC 460V series = 360VDC."
        ],
        "fix": [
          "Improve power supply condition.",
          "Check if the power specification matches the drive.",
          "Adjust voltage to the power range of the drive.",
          "Cycle the power after checking the power. If LvS error still exists, return to the factory for repair.",
          "Check the power system.",
          "Increase the capacity of power equipment.",
          "Install DC reactor(s).",
          "Reset: Manual / Auto: 230V series: Lv level + 30VDC + 500ms 460V series: Lv level + 60VDC + 500ms; 500 ms."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, LvS ID 14)"
      },
      {
        "code": "orP",
        "title": "Phase loss protection",
        "symptom": "Drive trips; keypad shows orP, fault ID 15 in the fault record.",
        "causes": [
          "Phase loss of power input",
          "DC bus ripple above limit with output over 50% rated starts a counter; orP trips when it hits the limit. Delay depends on output current."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 15 = orP.",
          "Check P06.34 (DC bus at fault). orP trips after high DC ripple persists with output current over 50% of rated."
        ],
        "fix": [
          "Verify the wiring of the main circuit power is installed correctly.",
          "Check that a single-phase power supply is not being used with a three-phase model. Choose the model whose power matches the voltage.",
          "Supply voltage swings can cause it. Check main circuit and supply, cycle power; if orP stays, call AutomationDirect support.",
          "Check for loose terminal wiring, tighten the terminal screws according to the torque described in the user manual.",
          "Verify the input cable is undamaged and replace if needed.",
          "Check for unbalanced three-phase input power.",
          "Fault setting parameter: P06.53",
          "Reset: Manual reset; Immediately reset when DC bus is higher than P07.00."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, orP ID 15)"
      },
      {
        "code": "oH1",
        "title": "IGBT overheating",
        "symptom": "Drive trips; keypad shows oH1, fault ID 16 in the fault record.",
        "causes": [
          "IGBT temperature exceeds the protection level. Protection level is model default of P06.15 + 5°C",
          "IGBT overheat: level = model default of P06.15 +5°C. If P06.15 is above oH1 level, oH1 trips instead of warning; drive stops at once."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 16 = oH1.",
          "Read P06.36 (IGBT temperature at malfunction); P06.43 shows present IGBT temperature."
        ],
        "fix": [
          "Check the ambient temperature.",
          "Regularly inspect the ventilation hole of the control cabinet.",
          "Change the installed location if there are heating objects, such as braking resistors, in the surroundings.",
          "Install/add cooling fan or air conditioner to lower the temperature inside the cabinet.",
          "Check for and remove obstructions or replace the cooling fan.",
          "Increase ventilation space of the drive.",
          "Decrease loading.",
          "Decrease the carrier wave.",
          "Replace the drive with higher capacity model.",
          "Reset: Manual reset; Reset only when IGBT temperature is lower than oH1 error level minus (-) 10°C."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, oH1 ID 16)"
      },
      {
        "code": "oH2",
        "title": "Over-heat key components",
        "symptom": "Drive trips; keypad shows oH2, fault ID 17 in the fault record.",
        "causes": [
          "The drive has detected the key components are overheating",
          "oH2: a key-component temperature sensor reads above the model's overheat setpoint for 100ms."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 17 = oH2.",
          "Read P06.36 (IGBT temperature at malfunction); P06.43 shows present IGBT temperature."
        ],
        "fix": [
          "Check the ambient temperature.",
          "Regularly inspect the ventilation hole of the control cabinet.",
          "Change the installed location if there are heating objects, such as braking resistors, in the surroundings.",
          "Install/add cooling fan or air conditioner to lower the temperature inside the cabinet.",
          "Check for and remove obstructions or replace the cooling fan.",
          "Increase ventilation space of the drive.",
          "Decrease loading.",
          "Decrease the carrier wave.",
          "Replace the drive with higher capacity model.",
          "Install reactor(s).",
          "Reduce load changes.",
          "Manual reset; also auto-resets once the key-component sensor reads 10ºC below the oH2 level."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, oH2 ID 17)"
      },
      {
        "code": "tH1o",
        "title": "IGBT temperature detection failure",
        "symptom": "Drive trips; keypad shows tH1o, fault ID 18 in the fault record.",
        "causes": [
          "IGBT hardware failure in temperature detection",
          "NTC open or miswired. tH1o trips when IGBT temp is above protection level for over 100 ms."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 18 = tH1o.",
          "Read P06.36 (IGBT temperature at malfunction); P06.43 shows present IGBT temperature."
        ],
        "fix": [
          "Wait for 10 minutes, and then cycle the power. Check if tH1o protection still exists. If yes, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, tH1o ID 18)"
      },
      {
        "code": "tH2o",
        "title": "Capacitor hardware fault",
        "symptom": "Drive trips; keypad shows tH2o, fault ID 19 in the fault record.",
        "causes": [
          "Hardware failure in capacitor temperature detection",
          "NTC open or miswired. tH2o trips when IGBT temp is above protection level for over 100 ms."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 19 = tH2o.",
          "Read P06.36 (IGBT temperature at malfunction); P06.43 shows present IGBT temperature."
        ],
        "fix": [
          "Wait for 10 minutes, and then cycle the power. Check if tH2o protection still exists. If yes, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, tH2o ID 19)"
      },
      {
        "code": "oL",
        "title": "Over load",
        "symptom": "Drive trips; keypad shows oL, fault ID 21 in the fault record.",
        "causes": [
          "Output current too high. Limits: VT 120% for 1 min, 150% for 3 s; CT 150% for 1 min, 200% for 3 s (of drive rated current).",
          "Trips per overload and derating curves when load stays above the limit longer than allowed (oL)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 21 = oL.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "Replace the drive with a larger capacity model.",
          "If oL only at low speed: cut low-speed load, use a bigger drive, or lower carrier frequency P00.17.",
          "Adjust P07.26 Torque Compensation Gain until the output current reduces and the motor does not stall.",
          "Verify stall prevention is set to the proper value.",
          "Check the status of three-phase motor and verify the cable is not broken or screws are loose.",
          "Verify the parameter settings for speed tracking. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-34, oL ID 21)"
      },
      {
        "code": "EoL1",
        "title": "Electronics thermal relay 1 protection",
        "symptom": "Drive trips; keypad shows EoL1, fault ID 22 in the fault record.",
        "causes": [
          "Electronics thermal relay 1 protection. The drive coasts to stop once it activates.",
          "Counts when output > 150% of motor 1 rated current; trips after P06.14. Repeat > 105% within 60 sec shortens the time."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 22 = EoL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL1 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P06.13=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P06.13=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-34, EoL1 ID 22)"
      },
      {
        "code": "EoL2",
        "title": "Electronic thermal relay 2 protection",
        "symptom": "Drive trips; keypad shows EoL2, fault ID 23 in the fault record.",
        "causes": [
          "Electronic thermal relay 2 protection. The drive coasts to stop once it activates.",
          "Counts at output > 150% motor 2 current (P06.28; faster if > 105% again within 60 sec). PTC > P06.30 (50%) or PT100 > P06.57 (7V): immediate."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 23 = EoL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 2 V/F curve P01.35-P01.42; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL2 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P06.27=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P06.27=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Check ambient temperature. Move away from heat sources, or add a fan or air conditioning to cool the enclosure.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Check time spent at low speed: shorten it, use an inverter-duty motor, or a larger motor.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Check V/F voltage; tune P01.01-P01.08, as a low mid-point voltage cuts low-speed torque.",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection between PTC thermistor and the heat protection.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Check ambient temperature. Move away from heat sources, or add a fan or air conditioning to cool the enclosure.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Check time spent at low speed: shorten it, use an inverter-duty motor, or a larger motor.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Check V/F voltage; tune P01.01-P01.08, as a low mid-point voltage cuts low-speed torque.",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection of PT100 RTD.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Action set by P06.29: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = no warning.",
          "P06.29=0: oH3 is a warning, auto-clears (when temp < P06.56). P06.29=1 or 2: oH3 is a fault, reset by hand. Some cases reset five seconds after clear."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-35, EoL2 ID 23)"
      },
      {
        "code": "ot1",
        "title": "Over torque 1",
        "symptom": "Drive trips; keypad shows ot1, fault ID 26 in the fault record.",
        "causes": [
          "ot1: output current above P06.07 for longer than P06.08, with P06.06 or P06.09 set to 2 or 4.",
          "Trip condition (Action Level): P06.07; action time: P06.08"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 26 = ot1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the settings for P06.07 and P06.08.",
          "Check for mechanical failure and remove any causes of malfunction.",
          "Reduce the load or replace the motor with a higher capacity model.",
          "Increase the setting values for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 1 V/F curve P01.01-P01.08; a low mid-point voltage cuts low-speed torque.",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Check speed tracking: enable it and adjust its max current P07.09.",
          "P06.06: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P06.06=1 or 3: ot1 is a warning, clears when current < (Pr.06-07 - 5%). P06.06=2 or 4: ot1 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, ot1 ID 26)"
      },
      {
        "code": "ot2",
        "title": "Over torque 2",
        "symptom": "Drive trips; keypad shows ot2, fault ID 27 in the fault record.",
        "causes": [
          "ot2: output current above P06.10 for longer than P06.11, with P06.09 set to 2 or 4.",
          "Trip condition (Action Level): P06.10; action time: P06.11"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 27 = ot2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Verify the settings for P06.10 and P06.11.",
          "Check for mechanical failure and remove any causes of malfunction.",
          "Reduce the load or replace the motor with a higher capacity model.",
          "Increase the setting values for P01.12–P01.19 (accel./decel. time)",
          "Tune V/F curve (Motor 1, P01.35-P01.42); a low mid-point voltage cuts low-speed torque.",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Check speed tracking: enable it and adjust its max current P07.09.",
          "P06.09: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P06.09=1 or 3: ot2 is a warning, clears when current < (P06.10 - 5%). P06.09=2 or 4: ot2 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-38, ot2 ID 27)"
      },
      {
        "code": "uC",
        "title": "Under current",
        "symptom": "Drive trips; keypad shows uC, fault ID 28 in the fault record.",
        "causes": [
          "Low current detection",
          "Trip condition (Action Level): P06.71; action time: P06.72"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 28 = uC.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Confirm the motor cable is connected properly.",
          "Verify settings of P06.71, P06.72, and P06.73 and set to correct values if needed.",
          "Check if the load is too low and whether the motor capacity matches the load.",
          "P06.73: 0 = off; 1 = fault, coast stop; 2 = fault, ramp stop on 2nd decel time; 3 = warn, keep running.",
          "P06.73=3: uC is a warning, clears when current > (P06.71+0.1A). P06.73=1 or 2: uC is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-38, uC ID 28)"
      },
      {
        "code": "Lit",
        "title": "Limit error",
        "symptom": "Drive trips; keypad shows Lit, fault ID 29 in the fault record.",
        "causes": [
          "Drive in speed mode (not IMFOCPG/ PMFOCPG) with a DIx forward or reverse run-limit input active.",
          "Trips at once in speed mode (not FOCPG) when the forward or reverse run limit is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 29 = Lit."
        ],
        "fix": [
          "Set the limit ON/OFF switch to the correct position.",
          "Set P00.04=16 (digital input status ON/OFF) to verify if the DIx terminals work properly.",
          "Reduce deceleration time. Adjust setting value of DC brake to current level (P07.01 or the insert position on the brake unit).",
          "Reset: Move the motor away from the limit position and press the STOP/RESET button on the keypad (manual reset).; Immediately resets.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-38, Lit ID 29)"
      },
      {
        "code": "cF2",
        "title": "EEPROM read error",
        "symptom": "Drive trips; keypad shows cF2, fault ID 31 in the fault record.",
        "causes": [
          "Internal EEPROM cannot be read",
          "Trip condition (Action Level): Firmware internal detection; action time: cF2 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 31 = cF2."
        ],
        "fix": [
          "Press “RESET” key or reset the parameter to the default setting. If cF2 still occurs, contact AutomationDirect Technical Support.",
          "Cycle the power, if cF2 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, cF2 ID 31)"
      },
      {
        "code": "cd1",
        "title": "U-phase error",
        "symptom": "Drive trips; keypad shows cd1, fault ID 33 in the fault record.",
        "causes": [
          "U-phase current detection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: cd1 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 33 = cd1."
        ],
        "fix": [
          "Cycle the power, if cd1 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, cd1 ID 33)"
      },
      {
        "code": "cd2",
        "title": "V-phase error",
        "symptom": "Drive trips; keypad shows cd2, fault ID 34 in the fault record.",
        "causes": [
          "V-phase current detection error when power ON",
          "Trip condition (Action Level): Hardware detection; action time: cd2 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 34 = cd2."
        ],
        "fix": [
          "Cycle the power, if cd2 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, cd2 ID 34)"
      },
      {
        "code": "cd3",
        "title": "W-phase error",
        "symptom": "Drive trips; keypad shows cd3, fault ID 35 in the fault record.",
        "causes": [
          "W-phase current detection error when power ON",
          "Trip condition (Action Level): Hardware detection; action time: cd3 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 35 = cd3."
        ],
        "fix": [
          "Cycle the power, if cd3 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, cd3 ID 35)"
      },
      {
        "code": "Hd0",
        "title": "cc hardware error",
        "symptom": "Drive trips; keypad shows Hd0, fault ID 36 in the fault record.",
        "causes": [
          "cc (current clamp) hardware protection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: Hd0 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 36 = Hd0."
        ],
        "fix": [
          "Cycle the power, if Hd0 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, Hd0 ID 36)"
      },
      {
        "code": "Hd1",
        "title": "oc hardware error",
        "symptom": "Drive trips; keypad shows Hd1, fault ID 37 in the fault record.",
        "causes": [
          "oc hardware protection error when power is ON",
          "Trip condition (Action Level): Hardware detection; action time: Hd1 acts immediately when the drive detects the fault"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 37 = Hd1."
        ],
        "fix": [
          "Cycle the power, if Hd1 error still occurs, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-39, Hd1 ID 37)"
      },
      {
        "code": "AUE",
        "title": "Auto-tuning error",
        "symptom": "Drive trips; keypad shows AUE, fault ID 40 in the fault record.",
        "causes": [
          "Motor auto-tuning error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 40 = AUE."
        ],
        "fix": [
          "This error can occur if you press the STOP key during auto-tuning. Re-execute auto-tuning.",
          "Check motor capacity and related parameters. a) Set the correct parameters P01.01–P01.02. b) Set P01.00 larger than the motor rated frequency.",
          "Check the motor wiring.",
          "Check for motor shaft lock and remove cause of lock if needed.",
          "Check for electromagnetic contactor at output (U/V/W) and make sure the electromagnetic valve is OFF.",
          "Verify load. If too heavy: a) Reduce the load. b) Replace the motor with a larger capacity model.",
          "Check if accel/decel time is too short, then increase the setting values for P01.12–P01.19 (accel./decel. time) if needed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-40, AUE ID 40)"
      },
      {
        "code": "AFE",
        "title": "PID loss AI2",
        "symptom": "Drive trips; keypad shows AFE, fault ID 41 in the fault record.",
        "causes": [
          "PID feedback loss (analog feedback signal is only valid when the PID function is enabled)",
          "Trip condition (Action Level): When the analog input < 4 mA (only detects 4–20 mA analog input); action time: P08.08"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 41 = AFE."
        ],
        "fix": [
          "Check the PID feedback cable and tighten the terminal. Replace the cable with a new one if needed.",
          "Check for feedback device failure and replace the device with a new one.",
          "Check all the wiring. If AFE fault still exists, contact AutomationDirect Technical Support.",
          "P08.09: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = warn, run at last frequency.",
          "P08.09=3 or 4: AFE is a warning, clears when feedback > 4 mA. P08.09=1 or 2: AFE is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-40, AFE ID 41)"
      },
      {
        "code": "PGF1",
        "title": "Encoder feedback error",
        "symptom": "Drive trips; keypad shows PGF1, fault ID 42 in the fault record.",
        "causes": [
          "The motor runs in a reverse direction to the frequency command direction",
          "Trip condition (Action Level): Software detection; action time: P10.09"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 42 = PGF1."
        ],
        "fix": [
          "Check and reset encoder parameter (P10.02) if incorrect.",
          "Check encoder wiring and rewire if necessary.",
          "Check the PG card or encoder, replace if failed.",
          "Verify wiring of the control circuit and wiring/grounding of the main circuit to prevent interference.",
          "Fault setting parameter: P10.08 0: Warn and keep operation 1: Fault and ramp to stop 2: Fault and coast to stop",
          "Reset: Manual reset; Immediately resets."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-40, PGF1 ID 42)"
      },
      {
        "code": "PGF2",
        "title": "Encoder feedback loss",
        "symptom": "Drive trips; keypad shows PGF2, fault ID 43 in the fault record.",
        "causes": [
          "P10.00 and P10.02 is not set in the PG control mode. When press “RUN” key, PGF2 fault occurs.",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 43 = PGF2."
        ],
        "fix": [
          "Reset encoder parameters (P10.00 and P10.02)",
          "Verify correct control mode is selected (P00.11=1).",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-40, PGF2 ID 43)"
      },
      {
        "code": "PGF3",
        "title": "Encoder feedback stall",
        "symptom": "Drive trips; keypad shows PGF3, fault ID 44 in the fault record.",
        "causes": [
          "PG mode: motor frequency above stall level P10.10 for longer than detection time P10.11 gives PGF3.",
          "Trip condition (Action Level): P10.10; action time: P10.11"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 44 = PGF3."
        ],
        "fix": [
          "Reset encoder parameter (P10.01)",
          "Value for P01.00 may be too low, set a higher value.",
          "Reset ASR parameters. Verify accel/decel times and reset if needed.",
          "Reset PG feedback stall values, P10.10 and P10.11.",
          "Fault setting parameter: P10.12 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-41, PGF3 ID 44)"
      },
      {
        "code": "PGF4",
        "title": "Encoder slip error",
        "symptom": "Drive trips; keypad shows PGF4, fault ID 45 in the fault record.",
        "causes": [
          "PG mode: motor frequency beyond slip range P10.13 for longer than detection time P10.14 gives PGF4.",
          "Trip condition (Action Level): P10.13; action time: P10.14"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 45 = PGF4."
        ],
        "fix": [
          "Reset PG feedback parameters (P10.13 and P10.14)",
          "Reset ASR parameters. Verify accel/decel times and reset if needed.",
          "Reset encoder parameters (P0.01).",
          "Verify torque limit and set new values if needed (P06.12, P11.17-P11.20)",
          "Check for and resolve any causes of motor shaft lock.",
          "Check the mechanical brake has released correctly and verify the timing of the system.",
          "Fault setting parameter: P10.15 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop",
          "P10.15=0: PGF4 is a warning, auto-clears once output vs motor frequency is back within slip range. P10.15=1 or 2: fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-41, PGF4 ID 45)"
      },
      {
        "code": "ACE",
        "title": "AI2 loss",
        "symptom": "Drive trips; keypad shows ACE, fault ID 48 in the fault record.",
        "causes": [
          "Analog input loss (including all the 4–20 mA analog signal)",
          "Trip condition (Action Level): When the analog input is < 4 mA (only detects 4–20 mA analog input); action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 48 = ACE."
        ],
        "fix": [
          "Check the AI2 feedback cable and tighten the terminal. Replace the cable with a new one if needed.",
          "Check for external device failure and replace the device with a new one.",
          "Check all the wiring. If ACE fault still exists, contact AutomationDirect Technical Support.",
          "P03.19: 0 = off; 1 = keep last frequency, show ANL; 2 = decel to stop, show ANL; 3 = stop at once, show ACE.",
          "P03.19=1 or 2: ACE is a warning, clears when analog input > 4 mA. P03.19=3: ACE is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-41, ACE ID 48)"
      },
      {
        "code": "EF",
        "title": "External fault",
        "symptom": "Drive trips; keypad shows EF, fault ID 49 in the fault record.",
        "causes": [
          "External fault. When the drive decelerates based on the setting of P07.20, the EF fault displays on the keypad.",
          "Trip condition (Action Level): DIx=10: External fault (EF) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 49 = EF.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Press RESET key after the fault is cleared.",
          "P07.20: 0 = coast; 1-4 = stop on 1st/2nd/3rd/4th decel time; 5 = system decel; 6 = auto decel (P01.46).",
          "Reset: Manual reset; Manual reset only after the external fault is cleared (terminal status is recovered)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, EF ID 49)"
      },
      {
        "code": "EF1",
        "title": "Emergency stop",
        "symptom": "Drive trips; keypad shows EF1, fault ID 50 in the fault record.",
        "causes": [
          "When the contact of DIx=EF1 is ON, the output stops immediately and displays EF1 on the keypad. The motor is in free running.",
          "Trip condition (Action Level): DIx=28: Emergency Stop (EF1) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 50 = EF1.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Verify if the system is back to normal condition, and then press “RESET” key to go back to the default.",
          "Reset: Manual reset; Manual reset only after the external fault is cleared (terminal status is recovered)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, EF1 ID 50)"
      },
      {
        "code": "bb",
        "title": "External base block",
        "symptom": "Drive trips; keypad shows bb, fault ID 51 in the fault record.",
        "causes": [
          "When the contact of DIx=bb is ON, the output stops immediately and displays bb on the keypad. The motor is in free running.",
          "Trip condition (Action Level): DIx=11: Base Block (BB) and the DI terminal is ON; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 51 = bb.",
          "Read P06.40 (status of the digital input terminals at malfunction) to see which DI was active."
        ],
        "fix": [
          "Verify if the system is back to normal condition, and then press “RESET” key to go back to the default.",
          "Reset: The display “bb” is automatically cleared after the fault is cleared.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, bb ID 51)"
      },
      {
        "code": "Pcod",
        "title": "Password is locked",
        "symptom": "Drive trips; keypad shows Pcod, fault ID 52 in the fault record.",
        "causes": [
          "Entering the wrong password three consecutive times through P00.07",
          "Trip condition (Action Level): Entering the wrong password three consecutive times; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 52 = Pcod."
        ],
        "fix": [
          "Input the correct password after rebooting the motor drive.",
          "Forgot password: enter 9999 and press ENTER, then do it again. Both entries must be done within 10 seconds, else retry.",
          "The parameter settings return to the default when the “Input 9999” process is finished.",
          "Reset: Manual reset; Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, Pcod ID 52)"
      },
      {
        "code": "CE1",
        "title": "Illegal command",
        "symptom": "Drive trips; keypad shows CE1, fault ID 54 in the fault record.",
        "causes": [
          "Communication command is illegal",
          "Trip condition (Action Level): When the function code is not 03, 06, 10, or 63.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 54 = CE1."
        ],
        "fix": [
          "Check if the communication command is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, CE1 ID 54)"
      },
      {
        "code": "CE2",
        "title": "Illegal data address",
        "symptom": "Drive trips; keypad shows CE2, fault ID 55 in the fault record.",
        "causes": [
          "Data address is illegal",
          "Trip condition (Action Level): When the data address is correct.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 55 = CE2."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, CE2 ID 55)"
      },
      {
        "code": "CE3",
        "title": "Illegal data value",
        "symptom": "Drive trips; keypad shows CE3, fault ID 56 in the fault record.",
        "causes": [
          "Data value is illegal",
          "Trip condition (Action Level): When the data length is too long; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 56 = CE3."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, CE3 ID 56)"
      },
      {
        "code": "CE4",
        "title": "Data is written to read- only address",
        "symptom": "Drive trips; keypad shows CE4, fault ID 57 in the fault record.",
        "causes": [
          "Data is written to read- only address",
          "Trip condition (Action Level): When the data is written to read-only address.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 57 = CE4."
        ],
        "fix": [
          "Check if the communication command from the upper limit is correct.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, CE4 ID 57)"
      },
      {
        "code": "CE10",
        "title": "Modbus transmission time-out",
        "symptom": "Drive trips; keypad shows CE10, fault ID 58 in the fault record.",
        "causes": [
          "Modbus transmission time-out occurs",
          "Trip condition (Action Level): When the communication time exceeds the detection time for P09.03 communication time-out.; action time: P09.03"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 58 = CE10."
        ],
        "fix": [
          "Check if the upper unit transmits the communication command within the setting time for P09.03.",
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "P09.02: 0 = warn, keep running; 1 = fault, ramp stop; 2 = fault, coast stop; 3 = no warning or fault, keep running.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, CE10 ID 58)"
      },
      {
        "code": "ydc",
        "title": "Y-connection / Δ-connection switch error",
        "symptom": "Drive trips; keypad shows ydc, fault ID 61 in the fault record.",
        "causes": [
          "An error occurs when Y-Δ switches",
          "ydc: Y and Δ confirm signals both on at once, or neither confirm signal arrives within P05.25."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 61 = ydc."
        ],
        "fix": [
          "Check if the electromagnetic valve works normally during switch. If not, replace it.",
          "Check if related parameters are all set up and set correctly.",
          "Check the wiring of the Y-Δ switch function.",
          "Manual reset, allowed only when the confirm signal matching the active connection (Y or Δ) is on."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-44, ydc ID 61)"
      },
      {
        "code": "dEb",
        "title": "Deceleration energy backup error",
        "symptom": "Drive trips; keypad shows dEb, fault ID 62 in the fault record.",
        "causes": [
          "With P07.13 not 0, a power loss drops the DC bus below the dEb level; drive ramps the motor to stop and shows dEb.",
          "Trip condition (Action Level): When P07.13 is not 0, and the DC bus voltage is lower than the level of dEb.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 62 = dEb.",
          "Compare P06.34 (DC bus at fault) with the dEb level; applies when P07.13 is not 0."
        ],
        "fix": [
          "Check that the power system is not unstable or off.",
          "Another large load on the same supply: upsize the supply, or move that load to a separate supply.",
          "P07.13=2: dEb auto-clears and output resumes when power returns. P07.13=1: drive stops, reset by hand once at 0 Hz."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-44, dEb ID 62)"
      },
      {
        "code": "oSL",
        "title": "Over slip error",
        "symptom": "Drive trips; keypad shows oSL, fault ID 63 in the fault record.",
        "causes": [
          "oSL (induction motors only): at constant speed, F>H or F<H deviation exceeds P07.29 for longer than P07.30, based on slip limit P10.29.",
          "Trip condition (Action Level): P07.29 100% of P07.29 = the maximum limit of the slip frequency (P10.29); action time: P07.30"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 63 = oSL."
        ],
        "fix": [
          "Verify the group 5 motor parameters.",
          "Decrease the load",
          "Check the setting of oSL protection function related parameters P07.29, P07.30, and P10.29",
          "Fault setting parameter: P07.31 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "P07.31=0: oSL warning auto-clears once F>H or F<H is back within P07.29. P07.31=1 or 2: oSL is an error, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-44, oSL ID 63)"
      },
      {
        "code": "SdRv",
        "title": "Reverse direction of the speed feedback",
        "symptom": "Drive trips; keypad shows SdRv, fault ID 68 in the fault record.",
        "causes": [
          "Rotating direction is different from the commanding direction.",
          "Trip condition (Action Level): Software detection; action time: P10.09"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 68 = SdRv."
        ],
        "fix": [
          "The setting of P10.25 FOC bandwidth is incorrect. Decrease the value in P10.25",
          "Motor parameters may be incorrect. Validate correct motor parameters are set.",
          "Motor cable problem. Inspect the motor cable/wires to make sure connections are secure and undamaged",
          "At start, a reverse force is applied to the motor or the motor starts to run in reverse. Start Speed Tracking function in P07.12",
          "Fault caused by electrical interference. Verify control and supply wiring is correct and properly grounded and shielded.",
          "Fault setting parameter: P10.08 0: Warn and keep operation 1: Fault and ramp to stop 2: Fault and coast to stop",
          "Reset: Manual reset; Immediate reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-45, SdRv ID 68)"
      },
      {
        "code": "SdOr",
        "title": "Over speed rotation feedback",
        "symptom": "Drive trips; keypad shows SdOr, fault ID 69 in the fault record.",
        "causes": [
          "Over speed rotation detected by the drive",
          "Trip condition (Action Level): P10.10; action time: P10.11"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 69 = SdOr."
        ],
        "fix": [
          "The setting of P10.25 FOC bandwidth is incorrect. Decrease the value in P10.25",
          "Motor parameters may be incorrect. Validate correct motor parameters are set.",
          "The setting of ASR bandwidth. Check the settings in P11.03, P11.05 and P11.05",
          "Fault caused by electrical interference. Verify control and supply wiring is correct and properly grounded and shielded.",
          "Fault setting parameter: P10.12 0: Warn and keep operation 1: Fault and ramp to stop 2: Fault and coast to stop",
          "Reset: Manual reset; Immediate reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-45, SdOr ID 69)"
      },
      {
        "code": "SdDe",
        "title": "Large deviation of speed feedback",
        "symptom": "Drive trips; keypad shows SdDe, fault ID 70 in the fault record.",
        "causes": [
          "A large deviation between the rotating speed and commanded speed",
          "Trip condition (Action Level): P10.13; action time: P10.14"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 70 = SdDe."
        ],
        "fix": [
          "Incorrect slip settings in P10.13 and P10.14. Adjust values as needed",
          "Improper parameter setting for ASR and acceleration/deceleration. Reset ASR parameters and validate Accel and Decel times.",
          "The acceleration/deceleration time is too short. Check the settings in the P01.xx Accel and Decel times being used.",
          "Motor shaft is locked. Verify motor shaft is not mechanically locked.",
          "Mechanical brake is not released. Ensure mechanical brake is release at start.",
          "Incorrect torque limits set. Check settings in P06.12 and P11.17 to .20",
          "Fault caused by electrical interference. Verify control and supply wiring is correct and properly grounded and shielded.",
          "Fault setting parameter: P10.15 0: Warn and keep operation 1: Fault and ramp to stop 2: Fault and coast to stop",
          "Reset: Manual reset; Immediate reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-45, SdDe ID 70)"
      },
      {
        "code": "SrL1",
        "title": "STO Loss 1",
        "symptom": "Drive trips; keypad shows SrL1, fault ID 72 in the fault record.",
        "causes": [
          "STO1–SCM1 internal loop detection error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 72 = SrL1."
        ],
        "fix": [
          "Verify the connections at the drive control terminals.",
          "If issue still persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, SrL1 ID 72)",
        "fixIfNoStoWiring": [
          "Check the STO1-SCM1 short-circuit line; reconnect if missing. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "Sro",
        "title": "STO",
        "symptom": "Drive trips; keypad shows Sro, fault ID 76 in the fault record.",
        "causes": [
          "Safety Torque Off function active",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 76 = Sro."
        ],
        "fix": [
          "Reset the STO1/SCM1 and STO2/SCM2 switch (ON) and cycle the power.",
          "Verify the connections at the drive control terminals.",
          "If issue still persists, contact AutomationDirect Technical Support.",
          "After the STo cause is cleared: P06.44=1 resets automatically; P06.44=0 needs a manual reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, Sro ID 76)"
      },
      {
        "code": "SrL2",
        "title": "STO Loss 2",
        "symptom": "Drive trips; keypad shows SrL2, fault ID 77 in the fault record.",
        "causes": [
          "STO2–SCM2 internal loop detection error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 77 = SrL2."
        ],
        "fix": [
          "Verify the connections at the drive control terminals.",
          "If the issue persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, SrL2 ID 77)",
        "fixIfNoStoWiring": [
          "Check the STO2-SCM2 short-circuit line; reconnect if missing. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "SrL3",
        "title": "STO Loss 3",
        "symptom": "Drive trips; keypad shows SrL3, fault ID 78 in the fault record.",
        "causes": [
          "STO1–SCM1 and STO2– SCM2 internal loop detection error",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 78 = SrL3."
        ],
        "fix": [
          "Verify the connections at the drive control terminals.",
          "If the issue persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, SrL3 ID 78)",
        "fixIfNoStoWiring": [
          "Check jumpers STO1-SCM1 and STO2-SCM2 are fitted; refit. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "Aoc",
        "title": "U-phase over-current before run",
        "symptom": "Drive trips; keypad shows Aoc, fault ID 79 in the fault record.",
        "causes": [
          "U-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 79 = Aoc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "Aoc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-47, Aoc ID 79)"
      },
      {
        "code": "boc",
        "title": "V-phase over-current before run",
        "symptom": "Drive trips; keypad shows boc, fault ID 80 in the fault record.",
        "causes": [
          "V-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 80 = boc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "Aoc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-47, boc ID 80)"
      },
      {
        "code": "coc",
        "title": "W-phase over-current before run",
        "symptom": "Drive trips; keypad shows coc, fault ID 81 in the fault record.",
        "causes": [
          "W-phase short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 81 = coc.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it’s too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "Aoc: possible output short or ground fault. Meter B1, DC- and ground (symbol in manual) against U, V, W; if shorted, call AutomationDirect support.",
          "Reset: Manual reset; Reset in five seconds after the fault clears."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-48, coc ID 81)"
      },
      {
        "code": "oPL1",
        "title": "Output phase loss U phase",
        "symptom": "Drive trips; keypad shows oPL1, fault ID 82 in the fault record.",
        "causes": [
          "U phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 82 = oPL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL1 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-48, oPL1 ID 82)"
      },
      {
        "code": "oPL2",
        "title": "Output phase loss V phase",
        "symptom": "Drive trips; keypad shows oPL2, fault ID 83 in the fault record.",
        "causes": [
          "V phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 83 = oPL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL2 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and keep operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-49, oPL2 ID 83)"
      },
      {
        "code": "oPL3",
        "title": "Output phase loss W phase",
        "symptom": "Drive trips; keypad shows oPL3, fault ID 84 in the fault record.",
        "causes": [
          "W phase output phase loss",
          "Level P06.47; time P06.48, or P06.46 when DC braking is active."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 84 = oPL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the control board ribbon cable; reseat if loose and retest. If the fault stays, call AutomationDirect support.",
          "Check 3-phase current balance with a clamp meter. If balanced and oPL3 persists, call AutomationDirect support.",
          "Make sure the capacity of the drive and motor match each other.",
          "Fault setting parameter: P06.45 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-49, oPL3 ID 84)"
      },
      {
        "code": "oL3",
        "title": "Low frequency overload protection",
        "symptom": "Drive trips; keypad shows oL3, fault ID 87 in the fault record.",
        "causes": [
          "Low frequency and high current protection",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 87 = oL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Enhance the heat dissipation capacity for the cabinet.",
          "Lower the carrier frequency (P00.17).",
          "Decrease the voltage settings that correspond to frequency below 15 Hz in the V/F curve.",
          "Set P00.11=0 (V/F, general control mode).",
          "Replace the drive with a higher power model.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-49, oL3 ID 87)"
      },
      {
        "code": "roPd",
        "title": "Rotor position detection error",
        "symptom": "Drive trips; keypad shows roPd, fault ID 89 in the fault record.",
        "causes": [
          "Rotor position detection error protection",
          "Trip condition (Action Level): Reset the software; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 89 = roPd."
        ],
        "fix": [
          "Check the motor cable for damage and replace if needed.",
          "Check the motor coil, if damaged replace the motor.",
          "IGBT may be broken. If so, contact AutomationDirect Technical Support.",
          "Cycle the power. If roPd still occurs during operation, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, roPd ID 89)"
      },
      {
        "code": "CD10",
        "title": "Ethernet Card Timeout",
        "symptom": "Drive trips; keypad shows CD10, fault ID 97 in the fault record.",
        "causes": [
          "Ethernet communication has not been received from the external controller (within the Ethernet Timeout window).",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 97 = CD10."
        ],
        "fix": [
          "Initiate Ethernet communications from the master controller again.",
          "Disable checking for Ethernet Timeout in P9.94.",
          "Reset: Manual reset; Immediate reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, CD10 ID 97)"
      },
      {
        "code": "ictE",
        "title": "InrCOM time-out error",
        "symptom": "Drive trips; keypad shows ictE, fault ID 111 in the fault record.",
        "causes": [
          "Internal communication overtime error",
          "ictE trips at once on internal Master/Slave comms error; P09.31 = -1 to -10 (no -9)."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 111 = ictE."
        ],
        "fix": [
          "Check comms wiring and grounding. Route it apart from main power, or cross at 90 degree, to reduce noise.",
          "Verify the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Reset: Automatically reset after the internal communication is normal."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, ictE ID 111)"
      },
      {
        "code": "CP20",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP20, fault ID 121 in the fault record.",
        "causes": [
          "Internal communication time-out",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 121 = CP20."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, CP20 ID 121)"
      },
      {
        "code": "CP22",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP22, fault ID 123 in the fault record.",
        "causes": [
          "Abnormal internal communication",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 123 = CP22."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, CP22 ID 123)"
      },
      {
        "code": "CP30",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP30, fault ID 124 in the fault record.",
        "causes": [
          "Abnormal internal communication",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 124 = CP30."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-50, CP30 ID 124)"
      },
      {
        "code": "CP32",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP32, fault ID 126 in the fault record.",
        "causes": [
          "Abnormal internal communication",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 126 = CP32."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-51, CP32 ID 126)"
      },
      {
        "code": "CP33",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows CP33, fault ID 127 in the fault record.",
        "causes": [
          "Abnormal internal communication",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 127 = CP33."
        ],
        "fix": [
          "Contact AutomationDirect Technical Support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-51, CP33 ID 127)"
      },
      {
        "code": "ot3",
        "title": "Over-torque 3",
        "symptom": "Drive trips; keypad shows ot3, fault ID 128 in the fault record.",
        "causes": [
          "ot3: output current above P14.75 for longer than P14.76, with P14.74 set to 2 or 4.",
          "Trip condition (Action Level): P14.75; action time: P14.76"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 128 = ot3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Configure the settings for P14.75 and P14.76 again.",
          "Check for mechanical error and remove the causes of malfunction.",
          "Verify load and decrease the loading or replace with a motor with larger capacity if load is too high.",
          "Verify accel/decel time and increase the setting values for P01.12– P01.19 (accel./ decel. time) if work cycle is too short.",
          "Check V/F voltage; tune motor 3 curve P01.54-P01.61, as a low mid-point voltage cuts low-speed torque.",
          "Replace motor with a larger capacity motor.",
          "Check for overload during low-speed operation and decrease the loading during low-speed operation or increase the motor capacity.",
          "Verify torque compensation and adjust P07.73 torque compensation gain until the output current decreases and the motor does not stall.",
          "Correct the parameter settings for speed tracking. Start the speed tracking function. Adjust the maximum current for P07.09 speed tracking.",
          "P14.74: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P14.74=1 or 3: ot3 is a warning, clears when current < P14.75. P14.74=2 or 4: ot3 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-51, ot3 ID 128)"
      },
      {
        "code": "ot4",
        "title": "Over-torque 4",
        "symptom": "Drive trips; keypad shows ot4, fault ID 129 in the fault record.",
        "causes": [
          "ot4: output current above P14.78 for longer than P14.79, with P14.77 set to 2 or 4.",
          "Trip condition (Action Level): P14.78; action time: P14.79"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 129 = ot4.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Configure the settings for P14.78 and P14.79 again.",
          "Check for mechanical error and remove the causes of malfunction.",
          "Verify load and decrease the loading or replace with a motor with larger capacity if load is too high.",
          "Verify accel/decel time and increase the setting values for P01.12– P01.19 (accel./ decel. time) if work cycle is too short.",
          "Check V/F voltage; tune V/F curve (Motor 3, P01.63-P01.70), as a low mid-point voltage cuts low-speed torque.",
          "Replace motor with a larger capacity motor.",
          "Check for overload during low-speed operation and decrease the loading during low-speed operation or increase the motor capacity.",
          "Verify torque compensation and adjust P07.75 torque compensation gain until the output current decreases and the motor does not stall.",
          "Correct the parameter settings for speed tracking. Start the speed tracking function. Adjust the maximum current for P07.09 speed tracking.",
          "P14.77: 0 = off; 1/2 = detect at constant speed, continue/stop; 3/4 = detect during RUN, continue/stop.",
          "P14.77=1 or 3: ot3 is a warning, clears when current < P14.75. P14.77=2 or 4: ot3 is a fault, reset by hand."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-52, ot4 ID 129)"
      },
      {
        "code": "EoL3",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows EoL3, fault ID 134 in the fault record.",
        "causes": [
          "Electronic thermal relay 3 protection. The drive coasts to stop once it activates.",
          "Counts when output > 150% of motor 3 rated current; trips after P14.81. Repeat > 105% within 60 sec shortens the time."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 134 = EoL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 3 V/F curve P01.54-P01.61; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL3 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P14.80=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P14.80=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.73 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-53, EoL3 ID 134)"
      },
      {
        "code": "EoL4",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows EoL4, fault ID 135 in the fault record.",
        "causes": [
          "Electronic thermal relay 4 protection. The drive coasts to stop once it activates.",
          "Counts when output > 150% of motor 4 rated current; trips after P14.83. Repeat > 105% within 60 sec shortens the time."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 135 = EoL4.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Tune motor 4 V/F curve P01.62-P01.70; a low mid-point voltage cuts low-speed torque. See V/F selection P01.43.",
          "If the EoL4 only occurs during low-speed operations: a) Replaced the drive with a dedicated VFD model. b) Increase the motor capacity.",
          "If using a VFD dedicated motor, verify P14.82=1: Standard motor (motor with fan on the shaft).",
          "Verify motor rated current and reset if needed.",
          "Verify motor rated frequency and reset if needed.",
          "If using one drive to run multiple motors, set P14.82=2: Disable, and install thermal relay on each motor.",
          "Set stall prevention to the proper value.",
          "Adjust P07.75 torque compensation gain until the current reduces and the motor does not stall.",
          "Check the status of the fan, or replace the fan.",
          "Replace the motor.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-54, EoL4 ID 135)"
      },
      {
        "code": "Hd6",
        "title": "oc hardware error",
        "symptom": "Drive trips; keypad shows Hd6, fault ID 140 in the fault record.",
        "causes": [
          "GFF hardware protection error when power is ON.",
          "Trip condition (Action Level): Hardware detection; action time: Immediately act when the fault is detected"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 140 = Hd6."
        ],
        "fix": [
          "Cycle the power. If Hd6 still exists, contact AutomationDirect Technical Support.",
          "Reset: Power-off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-55, Hd6 ID 140)"
      },
      {
        "code": "b4GFF",
        "title": "GFF occurs before run",
        "symptom": "Drive trips; keypad shows b4GFF, fault ID 141 in the fault record.",
        "causes": [
          "The ground short circuit detected when the output wiring detection is performed before the drive runs.",
          "Trip condition (Action Level): 250% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 141 = b4GFF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the motor’s internal wiring and the UVW wiring of the drive output terminal are correct.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-55, b4GFF ID 141)"
      },
      {
        "code": "AuE1",
        "title": "Auto-tune error 1",
        "symptom": "Drive trips; keypad shows AuE1, fault ID 142 in the fault record.",
        "causes": [
          "No feedback current error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 142 = AuE1."
        ],
        "fix": [
          "Verify the motor is wired correctly.",
          "If a contactor is used as an open state on the output side of the drive (U/V/W), check if the contactor coil is closed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-55, AuE1 ID 142)"
      },
      {
        "code": "AuE2",
        "title": "Auto-tune error 2",
        "symptom": "Drive trips; keypad shows AuE2, fault ID 143 in the fault record.",
        "causes": [
          "Motor phase loss error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 143 = AuE2."
        ],
        "fix": [
          "Verify that the motor is wired correctly and no wires are broken.",
          "Confirm that the motor works normally outside of auto-tuning.",
          "If an output (U/V/W) contactor is fitted, confirm all three of its phases are closed.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-55, AuE2 ID 143)"
      },
      {
        "code": "AuE3",
        "title": "Auto-tune error 3",
        "symptom": "Drive trips; keypad shows AuE3, fault ID 144 in the fault record.",
        "causes": [
          "No load current I measurement 0 error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 144 = AuE3."
        ],
        "fix": [
          "Check the settings for P05.01 / P05.13 / P05.34.",
          "Confirm that the motor works normally outside of auto-tuning.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-55, AuE3 ID 144)"
      },
      {
        "code": "AuE5",
        "title": "Auto-tune error 5",
        "symptom": "Drive trips; keypad shows AuE5, fault ID 149 in the fault record.",
        "causes": [
          "The rotor resistance measuring error when the motor parameter automatically detects",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 149 = AuE5."
        ],
        "fix": [
          "Verify that the motor is wired correctly and no wires are broken.",
          "Confirm that the motor works normally outside of auto-tuning. Possibly test with standard across-the-line starter.",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-56, AuE5 ID 149)"
      },
      {
        "code": "CD12",
        "title": "Encoder Card Not Present",
        "symptom": "Drive trips; keypad shows CD12, fault ID 174 in the fault record.",
        "causes": [
          "Encoder card disconnected from drive after power up",
          "Trip condition (Action Level): Software detection; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 174 = CD12."
        ],
        "fix": [
          "Check installation of card and connection to drive.",
          "Cycle drive power after re-seating encoder card",
          "Reset: Manual reset; Immediate reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-56, CD12 ID 174)"
      },
      {
        "code": "CD13",
        "title": "I/O Card Not Present",
        "symptom": "Drive trips; keypad shows CD13, fault ID 175 in the fault record.",
        "causes": [
          "I/O card disconnected from drive after power up",
          "Trip condition (Action Level): Software detection Immediate; action time: Immediately act Immediate"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 175 = CD13."
        ],
        "fix": [
          "Check installation of card and connection to drive.",
          "Cycle drive power after re-seating IO card",
          "Power cycle drive.",
          "Verify correct connection of USB cable at PC and drive",
          "Close and restart GSoft2",
          "Attempt firmware update again",
          "Fault setting parameter: N/A NA",
          "Reset: Manual reset Power Cycle; Immediate reset NA."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-56, CD13 ID 175)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/gs30m/ch1.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs30m/ch3.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs30m/ch4.pdf",
      "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf"
    ]
  },
  {
    "id": "inovance-md500-md290-vfd",
    "title": "Inovance MD500 / MD290 AC drive",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "MD500|MD290"
    },
    "normal": [
      {
        "terminals": "R, S, T (line to line)",
        "state": "power applied, 3-phase 380-480 VAC models",
        "meter": "VAC",
        "expected": "323-528 VAC (380-480 VAC -15%/+10%), 47.5-63 Hz",
        "pins": [
          [
            "R",
            "S"
          ],
          [
            "S",
            "T"
          ],
          [
            "R",
            "T"
          ]
        ],
        "note": "MD290 User Guide B06, Table 4-2/4-3 Electrical specifications: https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF",
        "liveWork": true
      },
      {
        "terminals": "R, S, T (line to line)",
        "state": "power applied, 200-240 VAC models",
        "meter": "VAC",
        "expected": "170-264 VAC (-15%/+10%)",
        "pins": [
          [
            "R",
            "S"
          ],
          [
            "S",
            "T"
          ],
          [
            "R",
            "T"
          ]
        ],
        "note": "MD290 User Guide B06, chapter 4 Technical data",
        "liveWork": true
      },
      {
        "terminals": "Operating panel bus voltage (U0 monitoring)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "Between undervoltage A5-06 (default 350 V) and overvoltage A5-09 (default 820 V); outside this the drive shows Err09 or Err05-Err07",
        "note": "MD290 User Guide B06, 7.6.2 Setting of Undervoltage/Overvoltage Threshold, p.326 (400 V class defaults)"
      },
      {
        "terminals": "+24V to COM",
        "state": "powered",
        "meter": "VDC",
        "expected": "+24 V supply for DIs/DOs and sensors, 200 mA max",
        "pins": [
          [
            "+24V",
            "COM"
          ]
        ],
        "note": "MD290 User Guide B06, Table 5-36 control terminal functions, p.185"
      },
      {
        "terminals": "DI1-DI5 to OP",
        "state": "input ON",
        "meter": "VDC",
        "expected": "Operating voltage range 9-30 V (input impedance 1.39 kOhm; DI5 1.03 kOhm). OP is jumpered to +24V by default (internal supply).",
        "pins": [
          [
            "DI1",
            "OP"
          ],
          [
            "DI2",
            "OP"
          ],
          [
            "DI3",
            "OP"
          ],
          [
            "DI4",
            "OP"
          ],
          [
            "DI5",
            "OP"
          ]
        ],
        "note": "MD290 User Guide B06, Table 5-36, p.185"
      },
      {
        "terminals": "+10V to GND",
        "state": "powered",
        "meter": "VDC",
        "expected": "+10 V, 10 mA max (potentiometer 1-5 kOhm)",
        "pins": [
          [
            "+10V",
            "GND"
          ]
        ],
        "note": "MD290 User Guide B06, Table 5-36, p.185"
      },
      {
        "terminals": "AI1 to GND",
        "state": "speed reference",
        "meter": "VDC",
        "expected": "0-10 VDC (input impedance 22 kOhm)",
        "pins": [
          [
            "AI1",
            "GND"
          ]
        ],
        "note": "MD290 User Guide B06, Table 5-36, p.185"
      }
    ],
    "pairs": [
      {
        "a": "T/A",
        "b": "T/C",
        "when": "fault (default F5-02 = 2, fault output)",
        "note": "T/A-T/B NC, T/A-T/C NO; F5-02 default 2 = fault output (on when a fault stops drive). MD500 19010355-SC ch.3/ch.6; MD290 PS00000462 F5-02."
      },
      {
        "a": "T/A",
        "b": "T/B",
        "when": "no fault (relay off, default F5-02 = 2)",
        "note": "T/A-T/B NC, T/A-T/C NO; F5-02 default 2 = fault output (on when a fault stops drive). MD500 19010355-SC ch.3/ch.6; MD290 PS00000462 F5-02."
      }
    ],
    "indicators": [
      {
        "name": "RUN",
        "state": "off",
        "meaning": "Stop"
      },
      {
        "name": "RUN",
        "state": "on",
        "meaning": "Running"
      },
      {
        "name": "LOCAL/REMOT",
        "state": "off",
        "meaning": "Operating panel control"
      },
      {
        "name": "LOCAL/REMOT",
        "state": "on",
        "meaning": "Terminal control"
      },
      {
        "name": "LOCAL/REMOT",
        "state": "flashing",
        "meaning": "Communication control"
      },
      {
        "name": "FWD/REV",
        "state": "off",
        "meaning": "Forward run"
      },
      {
        "name": "FWD/REV",
        "state": "on",
        "meaning": "Reverse run"
      },
      {
        "name": "TUNE/TC",
        "state": "off",
        "meaning": "Operating normally"
      },
      {
        "name": "TUNE/TC",
        "state": "flashing slowly (once per second)",
        "meaning": "Auto-tuning state"
      },
      {
        "name": "TUNE/TC",
        "state": "flashing quickly (4 times per second)",
        "meaning": "Faulty state"
      }
    ],
    "faults": [
      {
        "code": "E002.0",
        "title": "Overcurrent during acceleration",
        "symptom": "E002.0 (Err02): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Peak current > 2.5 x 1.414 x drive rated current in accel.",
        "causes": [
          "The output circuit of the AC drive is grounded or short-circuited.",
          "The acceleration time is too short under abrupt acceleration conditions.",
          "The overcurrent stall suppression parameters are set improperly.",
          "The manual torque boost or V/f curve is improper.",
          "The motor is started while rotating.",
          "The drive suffers external interference."
        ],
        "confirm": [
          "Panel: E002.0, U0-62 = 2 (Err02). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Output grounded or shorted: meter U/V/W and motor cable for shorts, check motor winding resistance balance, megger to ground (see source)",
          "Accel too short for a hard ramp: raise F0-17 and F0-18 and see if output current drops.",
          "Check OC stall suppression: F3-19 enabled and stall current F3-18 set sensibly.",
          "Check manual torque boost F3-01 is not too high and the V/f curve was not altered in V/f mode.",
          "The motor is started while rotating: Check whether the motor is started while rotating.",
          "External noise: check for heavy interference sources running on site, and whether supply was normal at the fault."
        ],
        "fix": [
          "Output grounded or shorted: replace a shorted output cable; replace the motor if winding resistance is unbalanced.",
          "The acceleration time is too short under abrupt acceleration conditions: Increase the acceleration time (F0–17).",
          "OC stall suppression: set F3-19 = 1; if F3-18 too high set 120% to 160%; if F3-20 too low set 20 to 40.",
          "The manual torque boost or V/f curve is improper: Adjust the manual torque boost or V/f curve.",
          "The motor is started while rotating: Select the flying start mode or start the motor after it stops.",
          "Noise: if fault-log current never hit F3-18, remove noise sources; if none found, driver board or Hall sensor may be bad, contact maker."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.361, E002.0)"
      },
      {
        "code": "E003.0",
        "title": "Overcurrent during deceleration",
        "symptom": "E003.0 (Err03): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Peak current > 2.5 x 1.414 x drive rated current in decel.",
        "causes": [
          "The output circuit of the AC drive is grounded or short-circuited.",
          "The control mode is FVC or SVC but parameter auto-tuning is not performed.",
          "The deceleration time is too short under abrupt deceleration conditions.",
          "The overcurrent stall suppression parameters are set improperly.",
          "The braking unit or braking resistor is not installed.",
          "The drive suffers external interference."
        ],
        "confirm": [
          "Panel: E003.0, U0-62 = 3 (Err03). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Output grounded or shorted: meter U/V/W and motor cable for shorts, check motor winding resistance balance, megger to ground (see source)",
          "FVC or SVC without auto-tune: check whether tuning was done; pick the tuning mode in F1-37 per motor type.",
          "Decel too short for a hard stop: raise F0-17 and F0-18 and see if output current drops.",
          "Check OC stall suppression: F3-19 enabled and stall current F3-18 set sensibly.",
          "The braking unit or braking resistor is not installed: Check whether the braking unit and braking resistor are installed.",
          "External noise: check for heavy interference sources running on site, and whether supply was normal at the fault."
        ],
        "fix": [
          "Output grounded or shorted: replace a shorted output cable; replace the motor if winding resistance is unbalanced.",
          "FVC or SVC without auto-tune: enter nameplate motor data and run auto-tuning.",
          "The deceleration time is too short under abrupt deceleration conditions: Increase the deceleration time (F0-18).",
          "OC stall suppression: set F3-19 = 1; if F3-18 too high set 120% to 150%; if F3-20 too low set 20 to 40.",
          "The braking unit or braking resistor is not installed: Install the braking unit and braking resistor.",
          "Noise: if fault-log current never hit F3-18, remove noise sources; if none found, driver board or Hall sensor may be bad, contact maker."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.363, E003.0)"
      },
      {
        "code": "E004.0",
        "title": "Overcurrent during operation at a constant speed",
        "symptom": "E004.0 (Err04): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Peak current > 2.5 x 1.414 x rated at constant speed.",
        "causes": [
          "The output circuit of the AC drive is grounded or short-circuited.",
          "The overcurrent stall suppression parameters are set improperly.",
          "The drive power rating is too low.",
          "The drive suffers external interference."
        ],
        "confirm": [
          "Panel: E004.0, U0-62 = 4 (Err04). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Output grounded or shorted: meter U/V/W and motor cable for shorts, check motor winding resistance balance, megger to ground (see source)",
          "Check OC stall suppression: F3-19 enabled and stall current F3-18 set sensibly.",
          "The drive power rating is too low: Check whether the power of the drive meets the requirements of the working conditions.",
          "External noise: check for heavy interference sources running on site, and whether supply was normal at the fault."
        ],
        "fix": [
          "The output circuit of the AC drive is grounded or short-circuited: Check whether the motor is short-circuited or disconnected.",
          "OC stall suppression: set F3-19 = 1; if F3-18 too high set 120% to 150%; if F3-20 too low set 20 to 40.",
          "Drive undersized: if steady running current exceeds motor rated or drive rated output current, fit a higher-rated drive.",
          "Noise: if fault-log current never hit F3-18, remove noise sources; if none found, driver board or Hall sensor may be bad, contact maker."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.364, E004.0)"
      },
      {
        "code": "E005.0",
        "title": "Overvoltage during acceleration",
        "symptom": "E005.0 (Err05): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Bus voltage above A5-09 (V) during accel.",
        "causes": [
          "The input grid voltage is excessively high.",
          "External force drives the motor during acceleration.",
          "The overvoltage suppression parameters are set improperly.",
          "The braking unit or braking resistor is not installed.",
          "The acceleration time is too short."
        ],
        "confirm": [
          "Panel: E005.0, U0-62 = 5 (Err05). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Supply too high? Measure input. Normal: 380 V 3-ph model 342 VAC to 418 VAC; 220 V 3-ph model 198 VAC to 235.4 VAC.",
          "External force drives the motor during acceleration: Check whether the external force drives the motor during acceleration.",
          "Check OV stall suppression F3-23 is enabled and its action voltage F3-22 is set correctly.",
          "The braking unit or braking resistor is not installed: Check whether the braking unit and braking resistor are installed.",
          "Check accel time F0-17 is not under 50% of its default; too short causes overmodulation and overvoltage."
        ],
        "fix": [
          "The input grid voltage is excessively high: Adjust the voltage until it is within the normal range.",
          "Load drives motor in accel: remove the force or add a braking resistor; raise F3-26 (max rise freq in OV suppression) to 5 Hz to 15 Hz.",
          "OV suppression: enable F3-23; if F3-22 (action voltage) too high set 770 V to 700 V; if F3-24 (gain) too low set 30 to 50.",
          "The braking unit or braking resistor is not installed: Install the braking unit and braking resistor.",
          "The acceleration time is too short: Increase the acceleration time (F0-17)."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.365, E005.0)"
      },
      {
        "code": "E006.0",
        "title": "Overvoltage during deceleration",
        "symptom": "E006.0 (Err06): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Bus voltage above A5-09 (V) during decel.",
        "causes": [
          "The overvoltage suppression parameters are set improperly.",
          "External force drives the motor during deceleration.",
          "The deceleration time is too short.",
          "The braking unit or braking resistor is not installed."
        ],
        "confirm": [
          "Panel: E006.0, U0-62 = 6 (Err06). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Check OV stall suppression F3-23 is enabled and its action voltage F3-22 is set correctly.",
          "External force drives the motor during deceleration: Check whether the external force drives the motor during deceleration.",
          "Check decel time F0-18 is not under 50% of default; too short returns excess energy and causes overvoltage.",
          "The braking unit or braking resistor is not installed: Check whether the braking unit and braking resistor are installed."
        ],
        "fix": [
          "OV suppression: enable F3-23; if F3-22 (action voltage) too high set 770 V to 700 V; if F3-24 (gain) too low set 30 to 50.",
          "Load drives motor in decel: remove the force or add a braking resistor; raise F3-26 (max rise freq in OV suppression) to 5 Hz to 15 Hz.",
          "The deceleration time is too short: Increase the deceleration time.",
          "The braking unit or braking resistor is not installed: Install the braking unit and braking resistor."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.366, E006.0)"
      },
      {
        "code": "E007.0",
        "title": "Overvoltage during operation at a constant speed",
        "symptom": "E007.0 (Err07): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Bus voltage above A5-09 (V) at constant speed.",
        "causes": [
          "The overvoltage suppression parameters are set improperly.",
          "External force drives the motor during running."
        ],
        "confirm": [
          "Panel: E007.0, U0-62 = 7 (Err07). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Check OV stall suppression F3-23 is enabled and its action voltage F3-22 is set correctly.",
          "External force drives the motor during running: Check whether the external force drives the motor during deceleration."
        ],
        "fix": [
          "Enable F3-23; F3-22 too high: 770 V to 700 V; F3-24 too low: 30 to 50; F3-26 too low: 5 Hz to 20 Hz.",
          "Load drives motor while running: remove the force or add a braking resistor; raise F3-26 (max rise freq in OV suppression) to 5 Hz to 15 Hz."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.367, E007.0)"
      },
      {
        "code": "E008.0",
        "title": "Pre-charge resistor fault",
        "symptom": "E008.0 (Err08): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Charge relay closed many times in a short time at power ON.",
        "causes": [
          "The input voltage is not within the permissible range, leading to frequent open/close of the contactor."
        ],
        "confirm": [
          "Panel: E008.0, U0-62 = 8 (Err08). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Input out of range cycling the contactor: check supply is 342 VAC to 418 VAC, not switching on/off repeatedly, and not fluctuating heavily."
        ],
        "fix": [
          "Bring input voltage into normal range so bus fluctuation stops cycling the contactor."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.368, E008.0)"
      },
      {
        "code": "E009.0",
        "title": "Undervoltage",
        "symptom": "E009.0 (Err09): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Bus voltage below undervoltage level A5-06 (V).",
        "causes": [
          "An instantaneous power failure occurs.",
          "The input voltage of the drive is beyond the allowed range.",
          "The bus voltage is abnormal.",
          "The rectifier, the inverter driver board, or the inverter control board is faulty."
        ],
        "confirm": [
          "Panel: E009.0, U0-62 = 9 (Err09). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Brief power loss: check supply is 342 VAC to 418 VAC and look for voltage dips.",
          "Input out of range: confirm supply is within 342 VAC to 418 VAC.",
          "The bus voltage is abnormal: Use a voltage measurement device or InoDriverShop to measure the bus voltage and check whether oscillation exists.",
          "Bad rectifier, driver or control board: meter DC bus (should be about 1.414 x input RMS), then compare with the drive's own bus reading."
        ],
        "fix": [
          "An instantaneous power failure occurs: Enable the power dip ride-through function (F9-59=1) to prevent undervoltage upon instantaneous power failure.",
          "The input voltage of the drive is beyond the allowed range: Adjust the voltage to the normal range.",
          "The bus voltage is abnormal: Seek technical support.",
          "The rectifier, the inverter driver board, or the inverter control board is faulty: Seek technical support."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.368, E009.0)"
      },
      {
        "code": "E010.0",
        "title": "Drive overload",
        "symptom": "E010.0 (Err10): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Drive overload time reached on its overload curve.",
        "causes": [
          "The carrier frequency is set too high.",
          "The load is too heavy or the motor is stalled."
        ],
        "confirm": [
          "Panel: E010.0, U0-62 = 10 (Err10). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The carrier frequency is set too high: Check whether F0-15 (Carrier frequency) is set to a value higher than the default value.",
          "Heavy load or stall: check output current in normal running, whether the motor is turning at the fault, and the output cable for cracks."
        ],
        "fix": [
          "The carrier frequency is set too high: Reduce the value of F0-15 (Carrier frequency).",
          "Reduce load and retest; remove stall risk and retest (if it persists, call Inovance support); redo auto-tune; check cable for shorts or cracks."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.369, E010.0)"
      },
      {
        "code": "E011.0",
        "title": "Motor overload",
        "symptom": "E011.0 (Err11): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Motor overload time reached on motor overload curve.",
        "causes": [
          "F9-01 (Motor overload protection gain) is set incorrectly.",
          "The load is too heavy or the motor is stalled."
        ],
        "confirm": [
          "Panel: E011.0, U0-62 = 11 (Err11). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Check motor overload gain F9-01 is not below 1.0 (default 1.0).",
          "Heavy load or stall: check output current in normal running and whether the motor is turning when the overload trips."
        ],
        "fix": [
          "Set motor overload gain F9-01 correctly; a higher F9-01 allows a longer overload time.",
          "The load is too heavy or the motor is stalled: Reduce the load and check the motor and machinery."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.370, E011.0)"
      },
      {
        "code": "E012.0",
        "title": "Input phase loss",
        "symptom": "E012.0 (Err12): output stops, TUNE/TC blinks 4 times per second, fault relay acts. Input phase-loss signal is active.",
        "causes": [
          "The three-phase input power supply is abnormal.",
          "The driver board, lightning protection board, main control board, or rectifier bridge is faulty."
        ],
        "confirm": [
          "Panel: E012.0, U0-62 = 12 (Err12). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The three-phase input power supply is abnormal: Check whether the input grid voltage or power supply is between 342 VAC and 418 VAC.",
          "Possible bad driver, surge-protection or control board, or rectifier: measure the 3-phase supply for imbalance."
        ],
        "fix": [
          "The three-phase input power supply is abnormal: Check and eliminate faults in peripheral circuits.",
          "Fix the cause of supply imbalance or derate the drive; if the fault persists, contact Inovance support."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.370, E012.0)"
      },
      {
        "code": "E013.0",
        "title": "Output phase loss",
        "symptom": "E013.0 (Err13): output stops, TUNE/TC blinks 4 times/s, relay acts. Above 0.8 Hz, max/min phase output current ratio is over 7.",
        "causes": [
          "The motor is faulty.",
          "The drain wire between the drive and the motor is abnormal.",
          "The three-phase outputs of the AC drive are unbalanced during motor running.",
          "The driver board or the IGBT module is abnormal."
        ],
        "confirm": [
          "Panel: E013.0, U0-62 = 13 (Err13). F9-14/F9-15/F9-16 = 1st/2nd/3rd fault; F9-17/F9-18/F9-19 = freq/current/bus at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The motor is faulty: Check whether open circuit occurs on U/V/W phase of the motor.",
          "The drain wire between the drive and the motor is abnormal: Check whether the drain wire between the drive output end and the motor end is proper.",
          "Unbalanced three-phase output while running: check that the RMS output current is equal on all three phases.",
          "The driver board or the IGBT module is abnormal: If the drive output phase loss persists, the driver board and IGBT module are abnormal."
        ],
        "fix": [
          "The motor is faulty: Replace the motor.",
          "The drain wire between the drive and the motor is abnormal: Eliminate external faults.",
          "The three-phase outputs of the AC drive are unbalanced during motor running: Ensure the motor three-phase winding is correct or replace the motor.",
          "The driver board or the IGBT module is abnormal: Replace the drive."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.371, E013.0)"
      },
      {
        "code": "E014.0",
        "title": "Drive overheat",
        "symptom": "E014.0 (Err14): output off, TUNE/TC flashes 4x/s, fault relay trips. Heatsink above overtemperature threshold.",
        "causes": [
          "The ambient temperature is excessively high.",
          "The air duct is blocked.",
          "The fan is damaged.",
          "The thermistor is damaged.",
          "Product components are damaged."
        ],
        "confirm": [
          "Panel: E014.0 (U0-62 = 14, Err14). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Ambient too hot: check it is not above 40℃; at 40℃ to 50℃ the drive must be derated 1.5% per extra 1℃.",
          "The air duct is blocked: Check whether the air duct of the drive or in the environment is blocked.",
          "The fan is damaged: Check whether the fan stops.",
          "The thermistor is damaged: Stop the drive for more than 1 h and check whether the temperature rises or does not fall.",
          "Product components are damaged: If the fault persists, the internal components of the drive may be damaged."
        ],
        "fix": [
          "Ambient too hot: cool it below 40°C, or derate the drive if it must run at 40℃-50℃.",
          "The air duct is blocked: Clean the air duct.",
          "The fan is damaged: Replace the damaged fan.",
          "The thermistor is damaged: Contact Inovance for technical support to replace the thermistor.",
          "Product components are damaged: Contact Inovance for technical support to replace the damaged component."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.371, E014.0)"
      },
      {
        "code": "E015.0",
        "title": "External device fault",
        "symptom": "E015.0 (Err15): output off, TUNE/TC flashes 4x/s, fault relay trips. DI reads opposite to its type (NO input seen closed or NC input seen open).",
        "causes": [
          "An external fault signal is input through the multi-functional DI (NO).",
          "An external fault signal is input using the virtual I/O terminal (NO)."
        ],
        "confirm": [
          "Panel: E015.0 (U0-62 = 15, Err15). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "External fault via multi-function DI (NO): find the DI set to function 11 in group F4; check if that physical DI is closed.",
          "External fault via virtual I/O (NO): find the DI set to function 33 in group F4; check if that physical DI is open."
        ],
        "fix": [
          "External fault via DI (NO): clear the external fault and make sure the machine allows a restart.",
          "External fault via virtual I/O (NO): verify the virtual I/O settings in group A1, then reset."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.372, E015.0)"
      },
      {
        "code": "E016.0",
        "title": "Communication fault",
        "symptom": "E016.0 (Err16): output off, TUNE/TC flashes 4x/s, fault relay trips. MD290 comm loss: gap over FD-04 (Modbus)/FD-08 (expansion) or slave lost.",
        "causes": [
          "The host controller does not work properly.",
          "The communication cable is faulty.",
          "F0-28 (Communication protocol selection) is set incorrectly.",
          "Communication parameters in group FD are set improperly."
        ],
        "confirm": [
          "Panel: E016.0 (U0-62 = 16, Err16). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Host controller fault: check its program, the config file for the protocol used, and that wiring is secure and correct.",
          "The communication cable is faulty: Check whether the network cable and differential signal cable are abnormal.",
          "F0-28 (protocol select) wrong: verify it (0 = Modbus, 1 = non-Modbus).",
          "FD group mismatch: check FD-00 (baud), FD-01 (Modbus data format) and FD-02 (local address) match the host controller."
        ],
        "fix": [
          "Host controller fault: have after-sales engineers check its software, supply the right config file and check wiring.",
          "Faulty comms cable: check it is intact and properly connected.",
          "F0-28 (Communication protocol selection) is set incorrectly: Set the communication expansion card correctly.",
          "FD group mismatch: set FD-00 (baud), FD-01 (Modbus data format) and FD-02 (local address) to match the host."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.373, E016.0)"
      },
      {
        "code": "E017.0",
        "title": "Contactor fault",
        "symptom": "E017.0 (Err17): output off, TUNE/TC flashes 4x/s, fault relay trips. Pre-charge contactor error signal seen continuously for 1s.",
        "causes": [
          "The driver board and power supply are abnormal.",
          "The contactor is abnormal.",
          "The lightning protection board is abnormal."
        ],
        "confirm": [
          "Panel: E017.0 (U0-62 = 17, Err17). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Driver board/supply fault: check grid voltage; 380 V 3-phase models need 342-418 VAC, 220 V models 198-235.4 VAC.",
          "The contactor is abnormal: Check whether the contactor can be closed or opened by the sound upon power-on.",
          "The lightning protection board is abnormal: If the fault persists after troubleshooting, check whether the lightning protection board is abnormal."
        ],
        "fix": [
          "The driver board and power supply are abnormal: If the mains voltage is normal and the fault persists, replace the drive.",
          "The contactor is abnormal: Replace the contactor.",
          "The lightning protection board is abnormal: Replace the lightning protection board."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.373, E017.0)"
      },
      {
        "code": "E018.0",
        "title": "Current detection circuit fault",
        "symptom": "E018.0 (Err18): output off, TUNE/TC flashes 4x/s, fault relay trips. Current sensing zero drift (checked at undervoltage/stop) over 10% of rated.",
        "causes": [
          "The main circuit is not powered on.",
          "The current sampling of the drive is abnormal."
        ],
        "confirm": [
          "Panel: E018.0 (U0-62 = 18, Err18). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The main circuit is not powered on: Check whether voltage exists on the R/S/T input end with a multimeter.",
          "Current sampling fault: at stop, read U/V/W output current and check if it fluctuates by more than 10% of rated."
        ],
        "fix": [
          "The main circuit is not powered on: Power on the R/S/T input end.",
          "Current sampling fault: fluctuation over 10% of rated current means a bad Hall sensor or sampling circuit; contact Inovance."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.374, E018.0)"
      },
      {
        "code": "E019.0",
        "title": "Motor parameter auto-tuning fault",
        "symptom": "E019.0 (Err19): output off, TUNE/TC flashes 4x/s, fault relay trips. Current too low during stator resistance auto-tune.",
        "causes": [
          "Motor parameters are not set according to the nameplate.",
          "Parameter auto-tuning times out."
        ],
        "confirm": [
          "Panel: E019.0 (U0-62 = 19, Err19). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Motor parameters are not set according to the nameplate: Check whether parameters F1-00 to F1-06 are set according to the motor nameplate.",
          "Auto-tuning timeout: check the motor is connected and whether the drive-to-motor contactor is open."
        ],
        "fix": [
          "Motor parameters are not set according to the nameplate: Set the motor parameters correctly according to the motor nameplate.",
          "Parameter auto-tuning times out: Ensure the drain wire between the drive and the motor is connected firmly."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.374, E019.0)"
      },
      {
        "code": "E021.0",
        "title": "EEPROM read/write failure",
        "symptom": "E021.0 (Err21): output off, TUNE/TC flashes 4x/s, fault relay trips. EEPROM overuse: op too long, write-reads in 1s over F8-58, or cache full.",
        "causes": [
          "The EEPROM chip is damaged."
        ],
        "confirm": [
          "Panel: E021.0 (U0-62 = 21, Err21). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "EEPROM damaged: check if comms write parameters, to RAM or EEPROM addresses, and how often (RAM map in user guide parameter list)."
        ],
        "fix": [
          "The EEPROM chip is damaged: Contact the agent or Inovance for technical support."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.375, E021.0)"
      },
      {
        "code": "E023.0",
        "title": "Drive output short circuited to ground",
        "symptom": "E023.0 (Err23): output off, TUNE/TC flashes 4x/s, fault relay trips. Output phase shorted to ground (ground current over threshold).",
        "causes": [
          "The motor is short circuited to the ground.",
          "IGBT short circuit is reported during self-check."
        ],
        "confirm": [
          "Panel: E023.0 (U0-62 = 23, Err23). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The motor is short circuited to the ground: Check whether each adapter is normal, and measure the impedance to ground with a megger.",
          "IGBT short circuit is reported during self-check: Perform static self-check repeatedly to check whether the fault persists."
        ],
        "fix": [
          "Motor shorted to ground: check each adapter, megger to ground, replace cable or motor as needed. Do not run the motor until fixed.",
          "IGBT short found at self-check: if the fault stays, replace the drive. Do not run the motor until the ground fault is fixed."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.376, E023.0)"
      },
      {
        "code": "E025.0",
        "title": "Motor overheat",
        "symptom": "E025.0 (Err25): output off, TUNE/TC flashes 4x/s, fault relay trips. Sampled motor temperature reached the overheat level.",
        "causes": [
          "The motor temperature is too high."
        ],
        "confirm": [
          "Panel: E025.0 (U0-62 = 25, Err25). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The motor temperature is too high: Check whether the motor temperature exceeds the temperature upper limit."
        ],
        "fix": [
          "Motor too hot: lower the carrier frequency or improve motor cooling; else replace the motor or contact Inovance support."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.376, E025.0)"
      },
      {
        "code": "E026.0",
        "title": "Cumulative operating time reach",
        "symptom": "E026.0 (Err26): output off, TUNE/TC flashes 4x/s, fault relay trips. Total run time >= F8-75 + F8-17 x 3600s.",
        "causes": [
          "The cumulative operating time reaches the setpoint."
        ],
        "confirm": [
          "Panel: E026.0 (U0-62 = 26, Err26). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The cumulative operating time reaches the setpoint: Check whether this condition is met: F7-09 + F7-28 x 3600 ≥ F8-75 + F8-17 x 3600."
        ],
        "fix": [
          "The cumulative operating time reaches the setpoint: Clear the record by parameter initialization (FP-01=2)."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.376, E026.0)"
      },
      {
        "code": "E027.0",
        "title": "User-defined fault 1",
        "symptom": "E027.0 (Err27): output off, TUNE/TC flashes 4x/s, fault relay trips. A DI set to function 44 (group F4 or A1) is active.",
        "causes": [
          "The signal of user-defined fault 1 is input through the multi-functional DI or the virtual I/O."
        ],
        "confirm": [
          "Panel: E027.0 (U0-62 = 27, Err27). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "User fault 1 via DI or virtual I/O: a DI is set to function 44 in group F4 or A1 and is active."
        ],
        "fix": [
          "The signal of user-defined fault 1 is input through the multi-functional DI or the virtual I/O: Reset the operation."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.377, E027.0)"
      },
      {
        "code": "E028.0",
        "title": "User-defined fault 2",
        "symptom": "E028.0 (Err28): output off, TUNE/TC flashes 4x/s, fault relay trips. A DI set to function 45 (group F4 or A1) is active.",
        "causes": [
          "The signal of user-defined fault 2 is input through the multi-functional DI or the virtual I/O terminal."
        ],
        "confirm": [
          "Panel: E028.0 (U0-62 = 28, Err28). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "User fault 2 via DI or virtual I/O: check which DI has function 45 in group F4 or A1 and whether it is active."
        ],
        "fix": [
          "The signal of user-defined fault 2 is input through the multi-functional DI or the virtual I/O terminal: Reset the operation."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.377, E028.0)"
      },
      {
        "code": "E029.0",
        "title": "Cumulative power-on time reach",
        "symptom": "E029.0 (Err29): output off, TUNE/TC flashes 4x/s, fault relay trips. Total power-on time >= F8-74 + F8-16 x 3600s.",
        "causes": [
          "The cumulative power-on duration reaches the setpoint."
        ],
        "confirm": [
          "Panel: E029.0 (U0-62 = 29, Err29). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The cumulative power-on duration reaches the setpoint: Check whether this condition is met: F7-09 + F7-29 x 3600 ≥ F8-74 + F8-16 x 3600."
        ],
        "fix": [
          "The cumulative power-on duration reaches the setpoint: Clear the record by parameter initialization (FP-01=2)."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.377, E029.0)"
      },
      {
        "code": "E030.0",
        "title": "Load loss",
        "symptom": "E030.0 (Err30): output off, TUNE/TC flashes 4x/s, fault relay trips. Running current below F9-64 for the F9-65 time.",
        "causes": [
          "The operation current of the drive is lower than the value of F9-64."
        ],
        "confirm": [
          "Panel: E030.0 (U0-62 = 30, Err30). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Current below F9-64: check whether the load really came off and the output cables are properly connected."
        ],
        "fix": [
          "Current below F9-64: confirm the load is really off, or set F9-64 and F9-65 to suit actual conditions."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.378, E030.0)"
      },
      {
        "code": "E031.0",
        "title": "PID feedback loss during running",
        "symptom": "E031.0 (Err31): output off, TUNE/TC flashes 4x/s, fault relay trips. PID feedback below FA-26 (loss level) longer than FA-27 (loss time).",
        "causes": [
          "The PID feedback is lower than the value of FA-26."
        ],
        "confirm": [
          "Panel: E031.0 (U0-62 = 31, Err31). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Feedback below FA-26: monitor the feedback channel in InoDriverShop and check its values are correct."
        ],
        "fix": [
          "PID feedback below FA-26: check the PID feedback signal and the system feedback error; set FA-26 correctly."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.378, E031.0)"
      },
      {
        "code": "E040.0",
        "title": "Pulse-by-pulse current limit fault",
        "symptom": "E040.0 (Err40): output off, TUNE/TC flashes 4x/s, fault relay trips. Async V/f only: pulse-by-pulse current limit active for 500 ms.",
        "causes": [
          "The load is too heavy or the motor is stalled.",
          "The drive power rating is too low."
        ],
        "confirm": [
          "Panel: E040.0 (U0-62 = 40, Err40). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Load too heavy or motor stalled: check output current in normal running, and whether the motor stops turning at the overload fault.",
          "The drive power rating is too low: The drive power is lower than the motor power."
        ],
        "fix": [
          "The load is too heavy or the motor is stalled: Reduce the load and check the motor and machinery.",
          "The drive power rating is too low: Replace the drive with a higher power rating."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.378, E040.0)"
      },
      {
        "code": "E041.0",
        "title": "Motor switchover fault during running",
        "symptom": "E041.0 (Err41): output off, TUNE/TC flashes 4x/s, fault relay trips. Motor switched over while the drive was running.",
        "causes": [
          "Motor switchover is performed using a terminal during running of the drive."
        ],
        "confirm": [
          "Panel: E041.0 (U0-62 = 41, Err41). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Motor switched by terminal while running: check whether the DI set to function 41 turns on during operation."
        ],
        "fix": [
          "Motor switchover is performed using a terminal during running of the drive: Perform motor switchover after the drive stops."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.379, E041.0)"
      },
      {
        "code": "E045.0",
        "title": "Motor temperature fault",
        "symptom": "E045.0 (Err45): output off, TUNE/TC flashes 4x/s, fault relay trips. Motor temperature via AI above the alarm threshold.",
        "causes": [
          "The cable of the temperature sensor becomes loose.",
          "The motor temperature is too high.",
          "The value of F9-57 (Motor overtemperature protection threshold) is too small."
        ],
        "confirm": [
          "Panel: E045.0 (U0-62 = 45, Err45). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The cable of the temperature sensor becomes loose: Check the wiring of the temperature sensor.",
          "The motor temperature is too high: Check whether the value of U0-34 is higher than F9-57.",
          "The value of F9-57 (Motor overtemperature protection threshold) is too small: Check the value of F9-57 (Motor overtemperature protection threshold)."
        ],
        "fix": [
          "The cable of the temperature sensor becomes loose: Reconnect the cable.",
          "The motor temperature is too high: Increase the carrier frequency or take other measures to cool the motor.",
          "F9-57 (motor overtemp threshold) too low: raise it (90℃ to 100℃ for normal motors)."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.379, E045.0)"
      },
      {
        "code": "E049.0",
        "title": "Voltage overlimit",
        "symptom": "E049.0 (Err49): output off, TUNE/TC flashes 4x/s, fault relay trips. AI1 to AI3 voltage above the set threshold.",
        "causes": [
          "The input voltage of AI1 to AI3 is out of the range set by A6-16 to A6-21."
        ],
        "confirm": [
          "Panel: E049.0 (U0-62 = 49, Err49). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "AI1 to AI3 voltage outside the A6-16 to A6-21 limits: measure the AI1-AI3 inputs and compare with A6-16 to A6-21."
        ],
        "fix": [
          "AI1 to AI3 outside A6-16 to A6-21: bring the input voltage into range, change A6-16 to A6-21, or (a qualified person must decide) disable this fault."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.380, E049.0)"
      },
      {
        "code": "E055.0",
        "title": "Slave fault in master/slave control mode",
        "symptom": "E055.0 (Err55): output off, TUNE/TC flashes 4x/s, fault relay trips. Slave fault passed to the master over CAN.",
        "causes": [
          "The slave is faulty."
        ],
        "confirm": [
          "Panel: E055.0 (U0-62 = 55, Err55). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "The slave is faulty: Rectify the fault according to the slave fault code."
        ],
        "fix": [
          "The slave is faulty: Troubleshoot the problem according to the slave fault code."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.380, E055.0)"
      },
      {
        "code": "E061.0",
        "title": "Braking transistor overload",
        "symptom": "E061.0 (Err61): output off, TUNE/TC flashes 4x/s, fault relay trips. Brake transistor overload per its overload curve.",
        "causes": [
          "The power of the braking resistor is too high (resistance is too low)."
        ],
        "confirm": [
          "Panel: E061.0 (U0-62 = 61, Err61). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Braking resistor power too high (resistance too low): verify the resistor model against the braking resistor section of the user guide."
        ],
        "fix": [
          "The power of the braking resistor is too high (resistance is too low): Use a braking resistor with larger resistance."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.380, E061.0)"
      },
      {
        "code": "E062.0",
        "title": "Braking transistor shoot through",
        "symptom": "E062.0 (Err62): output off, TUNE/TC flashes 4x/s, fault relay trips. Brake transistor >0.375x rated for 4s while off, or >2x max repeatedly.",
        "causes": [
          "The braking module is abnormal."
        ],
        "confirm": [
          "Panel: E062.0 (U0-62 = 62, Err62). Log: F9-14/F9-15/F9-16 type of 1st/2nd/3rd; F9-17/F9-18/F9-19 Hz/A/bus V at 3rd (F9-27..29 2nd, F9-37..39 1st).",
          "Braking module fault: meter the resistor vs its nominal value, check its wiring and the braking unit, watch bus voltage U0-02 for braking."
        ],
        "fix": [
          "Braking module fault: replace or properly connect the braking resistor, or contact Inovance support."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.381, E062.0)"
      },
      {
        "code": "Err20",
        "title": "Encoder fault",
        "symptom": "MD500 closed-loop (FVC) only: output off, TUNE/TC flashes, fault relay trips; panel shows Err20 (encoder fault, F9-48 units digit).",
        "causes": [
          "Encoder is not matched.",
          "Encoder wiring is incorrect.",
          "Encoder is damaged.",
          "PG card is abnormal."
        ],
        "confirm": [
          "Read F9-14 to F9-44 for the recent three faults (type, frequency, current, bus voltage, DI/DO state at the fault)."
        ],
        "fix": [
          "Set the type of encoder correctly.",
          "Check the PG card power supply and phase sequence.",
          "Replace encoder.",
          "Replace PG card."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/19010355-SC/B04/19010355-SC_B04%E3%80%8AMD500%20Series%20General-Purpose%20AC%20Drive%20User%20Guide%E3%80%8B-EN20220107.pdf (MD500 Series General-Purpose AC Drive User Guide B04, 10.5 Faults and Diagnostics, p.299; code from F9-48/F9-50 descriptions)"
      },
      {
        "code": "Err42",
        "title": "Speed error (excessive speed deviation)",
        "symptom": "MD500 closed-loop (FVC) only: output off, TUNE/TC flashes, fault relay trips; Err42 = speed deviation over F9-69 longer than F9-70.",
        "causes": [
          "Encoder parameters are set improperly.",
          "Motor auto-tuning is not performed.",
          "F9-69 (detection level of speed error) and F9-70 (detection time of speed error) are set incorrectly."
        ],
        "confirm": [
          "Read F9-14 to F9-44 for the recent three faults (type, frequency, current, bus voltage, DI/DO state at the fault)."
        ],
        "fix": [
          "Set encoder parameters properly.",
          "Perform motor auto-tuning.",
          "Set F9-69 and F9-70 correctly based on actual condition."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/19010355-SC/B04/19010355-SC_B04%E3%80%8AMD500%20Series%20General-Purpose%20AC%20Drive%20User%20Guide%E3%80%8B-EN20220107.pdf (MD500 Series General-Purpose AC Drive User Guide B04, 10.5 Faults and Diagnostics, p.301; code from F9-48/F9-50 descriptions)"
      },
      {
        "code": "Err43",
        "title": "Motor overspeed",
        "symptom": "MD500 closed-loop (FVC) only: output off, TUNE/TC flashes, fault relay trips; Err43 = motor speed over F9-67 longer than F9-68.",
        "causes": [
          "Encoder parameters are set improperly.",
          "Motor auto-tuning is not performed.",
          "F9-67 (Overspeed detection level) and F9-68 (Overspeed detection time) are set incorrectly."
        ],
        "confirm": [
          "Read F9-14 to F9-44 for the recent three faults (type, frequency, current, bus voltage, DI/DO state at the fault)."
        ],
        "fix": [
          "Set encoder parameters properly.",
          "Perform motor auto-tuning.",
          "Set F9-67 and F9-68 correctly based on the actual situation."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/19010355-SC/B04/19010355-SC_B04%E3%80%8AMD500%20Series%20General-Purpose%20AC%20Drive%20User%20Guide%E3%80%8B-EN20220107.pdf (MD500 Series General-Purpose AC Drive User Guide B04, 10.5 Faults and Diagnostics, p.301; code from F9-48/F9-50 descriptions)"
      }
    ],
    "sources": [
      "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF",
      "https://portal-file.inovance.com/owfile/ProdDoc/SC/19010355-SC/B04/19010355-SC_B04%E3%80%8AMD500%20Series%20General-Purpose%20AC%20Drive%20User%20Guide%E3%80%8B-EN20220107.pdf"
    ]
  },
  {
    "id": "sureservo2-servo-drive",
    "title": "AutomationDirect SureServo2 (SV2A) servo drive",
    "match": {
      "categories": [
        "servoDrive"
      ],
      "family": "SureServo2"
    },
    "normal": [
      {
        "terminals": "R, S, T (main circuit)",
        "state": "power applied, SV2A-2040/2075/2150/2200",
        "meter": "VAC",
        "expected": "1-phase or 3-phase 100-120 VAC or 200-230 VAC, -15% to +10%",
        "pins": [
          [
            "R",
            "S"
          ],
          [
            "S",
            "T"
          ],
          [
            "R",
            "T"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/appxa.pdf p.A-2 Drive Specifications (Permissible Voltage)",
        "liveWork": true
      },
      {
        "terminals": "R, S, T (main circuit)",
        "state": "power applied, SV2A-2300/2550/2750/2F00",
        "meter": "VAC",
        "expected": "3-phase 200-230 VAC, -15% to +10%",
        "pins": [
          [
            "R",
            "S"
          ],
          [
            "S",
            "T"
          ],
          [
            "R",
            "T"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/appxa.pdf p.A-2",
        "liveWork": true
      },
      {
        "terminals": "Drive display, monitor code 14 (P0.002 = 14: Main circuit voltage)",
        "state": "powered",
        "meter": "display",
        "expected": "Main circuit (DC bus) voltage in V; AL002 trips if the DC bus is over 410 V for over 1 s; AL003 when DC bus < P4.024 x sqrt(2)",
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch4.pdf 4.3.5 Monitoring Display; https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf p.11-10/11-11 AL002/AL003"
      },
      {
        "terminals": "CN1 DI to COM (digital input)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "15-24 VDC, 8 mA",
        "pins": [
          [
            "DI1-",
            "COM+"
          ],
          [
            "DI2-",
            "COM+"
          ],
          [
            "DI3-",
            "COM+"
          ],
          [
            "DI4-",
            "COM+"
          ],
          [
            "DI5-",
            "COM+"
          ],
          [
            "DI6-",
            "COM+"
          ],
          [
            "DI7-",
            "COM+"
          ],
          [
            "DI8-",
            "COM+"
          ],
          [
            "DI9-",
            "COM+"
          ],
          [
            "DI10-",
            "COM+"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf p.3-41 wiring diagram, Digital Input Rating"
      },
      {
        "terminals": "CN1 DI to COM (digital input)",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "< 5 VDC, < 0.5 mA",
        "pins": [
          [
            "DI1-",
            "COM+"
          ],
          [
            "DI2-",
            "COM+"
          ],
          [
            "DI3-",
            "COM+"
          ],
          [
            "DI4-",
            "COM+"
          ],
          [
            "DI5-",
            "COM+"
          ],
          [
            "DI6-",
            "COM+"
          ],
          [
            "DI7-",
            "COM+"
          ],
          [
            "DI8-",
            "COM+"
          ],
          [
            "DI9-",
            "COM+"
          ],
          [
            "DI10-",
            "COM+"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf p.3-41"
      },
      {
        "terminals": "CN10 STO_A (pin 3) / /STO_A (pin 4) and STO_B (pin 5) / /STO_B (pin 6)",
        "state": "both channels ON (energized; or factory STO bypass plug SV2-CN10-STO fitted)",
        "meter": "visual",
        "expected": "Drive Ready (torque available)",
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf p.3-36 (CN10 pinout), p.3-39 (STO function table)"
      },
      {
        "terminals": "CN10 STO_A or STO_B",
        "state": "one channel OFF",
        "meter": "visual",
        "expected": "Torque off (STO_A lost / STO_B lost); with Servo On, AL501 or AL502 after one channel is low for 1 s",
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf p.3-39"
      },
      {
        "terminals": "CN10 STO_A and STO_B",
        "state": "both channels OFF (STO mode)",
        "meter": "visual",
        "expected": "Torque off; with Servo On both low for 10 ms -> AL500, servo off",
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf p.3-39"
      },
      {
        "terminals": "CN10 FDBK+ (pin 7) to FDBK- (pin 8)",
        "state": "STO event, both channels open (AL500)",
        "meter": "continuity",
        "expected": "Closed. Opens in STO run state, when only one channel opens, or on internal STO error; non-latching, max 80 VDC 0.5 A.",
        "pins": [
          [
            "FDBK+",
            "FDBK-"
          ]
        ],
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf p.3-36, p.3-40 FDBK behavior"
      }
    ],
    "pairs": [
      {
        "a": "DO5+",
        "b": "DO5-",
        "when": "no alarm (default ALRM on DO5 as B contact)",
        "note": "CN1 DO5+ pin 28/DO5- pin 27: default ALRM (on in alarm). P2.022 default 0x0007, Z = 0 = NC (B). Opto output DO5+->DO5-. p.3-16/3-18, p.8-104, p.8-244 https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf https://cdn.automationdirect.com/static/manuals/sureservo2/ch8.pdf"
      },
      {
        "a": "DO1+",
        "b": "DO1-",
        "when": "servo ready (default SRDY on DO1 as A contact)",
        "note": "CN1 DO1+ pin 7/DO1- pin 6: default SRDY (servo ready). P2.018 default 0x0101, Z = 1 = NO (A). Transistor output DO1+->DO1-. p.3-16/3-18, p.8-104 https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf https://cdn.automationdirect.com/static/manuals/sureservo2/ch8.pdf"
      },
      {
        "a": "FDBK+",
        "b": "FDBK-",
        "when": "STO active (both STO channels off)",
        "note": "CN10 FDBK+ pin 7/FDBK- pin 8: closed when both STO channels open; open when running, if one channel opens, or on internal STO error. p.3-36, p.3-40 https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf"
      }
    ],
    "indicators": [
      {
        "name": "CHARGE LED",
        "state": "on",
        "meaning": "Circuit is powered, or hazardous voltage remains on the drive after power is turned off."
      },
      {
        "name": "7-segment display",
        "state": "shows AL followed by nnn",
        "meaning": "Alarm active; nnn is the alarm code (see Chapter 11 / P0.001)."
      },
      {
        "name": "7-segment display",
        "state": "monitoring symbol for 1 s at power-up, then a value",
        "meaning": "Normal power-up into Monitoring mode (variable set by P0.002)."
      }
    ],
    "faults": [
      {
        "code": "AL001",
        "title": "Overcurrent",
        "symptom": "AL.001 (AL001) ALM, servo OFF: main circuit current over 1.5x the motor max instantaneous current.",
        "causes": [
          "Motor has a short-circuit or fault to ground (frame).",
          "Motor wiring is wrong.",
          "IGBT is abnormal.",
          "Parameter setting is wrong.",
          "Control command setting is wrong."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check motor-to-drive wiring for shorts and exposed metal, and that the wiring order matches the manual.",
          "Check if the target Torque/Speed/Position commanded changes greatly. If so, please modify the rate of change in the command or enable the filter."
        ],
        "fix": [
          "Heat sink temperature abnormal: contact AutomationDirect support. If settings are far above default, reset to factory and re-enter one by one.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-10, AL001; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL002",
        "title": "Overvoltage",
        "symptom": "7-segment display shows AL.002 (AL002); type: alarm (ALM); servo turns OFF. Condition: main circuit voltage exceeds the rated value.",
        "causes": [
          "The input voltage of the main circuit is higher than the rated voltage.",
          "Wrong power input (wrong power system).",
          "Malfunction of the servo drive hardware.",
          "Wrong regen resistor or no external one connected; trips when DC bus stays over 410V for over 1 second."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Measure main-circuit input voltage vs rating (Appendix A) and supply vs spec; if wrong, fix the source or add a series regulator/transformer.",
          "Check if the input voltage of the main circuit is within the rated range. If the issue persists, please contact AutomationDirect technical support.",
          "Check regen resistor wiring, recalculate its value, and set P1.052 and P1.053 correctly."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-10, AL002; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL003",
        "title": "Undervoltage",
        "symptom": "AL.003 (AL003) WARN, servo OFF: main circuit undervoltage, or DC bus below P4.024 x √2. Warning by default; P2.066 [Bit 9] makes it an alarm.",
        "causes": [
          "The input voltage of main circuit is lower than the permissible rated value.",
          "No power is supplied to the main circuit.",
          "Wrong power input (wrong power system)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check that the voltage wiring is correct and the input voltage for the main circuit is normal.",
          "Cycle the servo drive power and use a voltmeter to check the main circuit voltage.",
          "Measure the supply with a voltmeter against spec; confirm the correct source or a series transformer is used."
        ],
        "fix": [
          "AL003 clearing follows P2.066 [Bit2]: 0 = reset with DI.ARST once voltage is normal; 1 = clears itself when voltage is normal."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-11, AL003; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL004",
        "title": "Motor Combination Error",
        "symptom": "7-segment display shows AL.004 (AL004); type: alarm (ALM); servo turns OFF. Condition: wrong motor is used with the servo drive.",
        "causes": [
          "Motor combination error (the servo drive connects to the wrong motor.)",
          "The encoder is loose.",
          "The encoder is damaged."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check and re-install the encoder connector."
        ],
        "fix": [
          "Use the right motor.",
          "If the encoder (motor) is not operating properly, please replace the motor.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-11, AL004; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL005",
        "title": "Regeneration Error",
        "symptom": "7-segment display shows AL.005 (AL005); type: alarm (ALM); servo turns OFF. Condition: an error occurs during regeneration.",
        "causes": [
          "You selected a wrong regeneration resistor or the external regeneration resistor is not connected.",
          "P1.053 (regenerative resistor watts) is not set to 0 when the regenerative resistor is not connected",
          "Parameter setting error (P1.052, P1.053)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Recalculate the regen resistor value and reset P1.052 and P1.053; if the alarm will not clear, contact AutomationDirect support.",
          "Set P1.053 to 0 if not using a regenerative resistor.",
          "Correctly set the parameters for the regenerative resistor, (P1.052) and the regenerative resistor watts (P1.053).",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-11, AL005; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL006",
        "title": "Overload",
        "symptom": "7-segment display shows AL.006 (AL006); type: alarm (ALM); servo turns OFF. Condition: overload of motor and servo drive.",
        "causes": [
          "The load is over the rated range and the servo drive is in a persistent overload condition.",
          "The control system parameter is wrong.",
          "Incorrect wiring of motor and encoder.",
          "Encoder malfunction."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the wiring of UVW and the encoder cables is correct."
        ],
        "fix": [
          "Set P0.002 to 11; if average torque stays over 100%, use a bigger motor or less load (Appendix A). Check vibration and too-fast accel/decel.",
          "Contact AutomationDirect technical support.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-12, AL006; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL007",
        "title": "Excessive Speed Deviation",
        "symptom": "AL.007 (AL007) ALM, servo OFF: speed command vs feedback deviation beyond P2.034.",
        "causes": [
          "A drastic change in speed.",
          "Incorrect setting for P2.034.",
          "Incorrect wiring of the UVW and/or encoder cables."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check and make sure the value of P2.034 (over-speed warning) is correct."
        ],
        "fix": [
          "Use the signal detector to check if the input analog voltage signal is normal. If not, adjust the signal changing rate or enable the filter function.",
          "Ensure correct wiring of the UVW and encoder cables.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-12, AL007; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL008",
        "title": "Abnormal Pulse Command",
        "symptom": "AL.008 (AL008) ALM, servo OFF: pulse command input frequency above the hardware interface limit.",
        "causes": [
          "the pulse command frequency is higher than the rated input frequency."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Use the scope to check if the input frequency is higher than the rated frequency. Correctly set the input pulse frequency.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-12, AL008; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL009",
        "title": "Excessive Position Command Deviation",
        "symptom": "AL.009 (AL009) ALM, servo OFF: position command vs feedback deviation beyond P2.035.",
        "causes": [
          "The maximum position deviation is set too low.",
          "Gain value is set too low.",
          "Torque limit is set too low.",
          "Excessive external load.",
          "Improper setting for the E-gear ratio.",
          "The power cables are loose.",
          "Speed limit is set too low."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the value of the maximum deviation (P2.035 excessive position deviation warning condition).",
          "Check if the gain value is appropriate for the application.",
          "Check if the torque limit setting is appropriate for the application.",
          "Check the external load. Reduce the external load or re-evaluate the motor capacity if necessary.",
          "Check if the settings for P1.044 and P1.045 are appropriate for the application and set the correct values.",
          "Check if the power cables are loose.",
          "Check if the set value of P1.055 (Maximum speed limit) is too low."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-13, AL009; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL010",
        "title": "Voltage error during regeneration",
        "symptom": "AL.010 (AL010) ALM, servo ON: regen voltage held at 400V (wrong/missing external regen resistor), or P1.053 not 0 with no resistor.",
        "causes": [
          "Wrong or missing external regen resistor keeps regen voltage at 400V for a while; or P1.053 (regen resistor W) not 0 with no resistor fitted."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check regen resistor wiring, recalculate its value and set P1.052/P1.053 correctly; if still present, contact AutomationDirect support."
        ],
        "fix": [
          "Set P1.053 to 0 if not using a regenerative resistor.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-13, AL010; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL011",
        "title": "Encoder Error",
        "symptom": "7-segment display shows AL.011 (AL011); type: alarm (ALM); servo turns OFF. Condition: the encoder produces abnormal pulses.",
        "causes": [
          "Encoder wiring is wrong.",
          "Encoder connector is loose.",
          "Poor wiring of the encoder.",
          "Connection to the encoder is cut off due to interference.",
          "Encoder is damaged."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the wiring follows the instructions in the user manual. If not, connect the wiring correctly.",
          "Check if the CN2 connector and the encoder connector are loose. If so, reconnect the connectors.",
          "Inspect both encoder-to-CN2 connections for bad wiring or damaged wires; replace connector and cable if found."
        ],
        "fix": [
          "Set P0.002 to -80; a rising count means noise. Ground the motor (UVW green to heat sink), keep encoder cable away from power, use shielded cable.",
          "If you took all corrective actions but the issue persists, please replace the motor.",
          "How to clear: Re-power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-14, AL011; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL012",
        "title": "Adjustment Error",
        "symptom": "AL.012 (AL012) ALM, servo OFF: calibration value out of limits during electrical calibration.",
        "causes": [
          "The analog input contact is not correctly set to zero.",
          "The detection device is damaged."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the analog input contact is at ground voltage; cycle power; if it persists, contact AutomationDirect."
        ],
        "fix": [
          "How to clear: Remove the connection cable for CN1 and then execute auto calibration."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-14, AL012; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL013",
        "title": "Motor Override",
        "symptom": "7-segment display shows AL.013 (AL013); type: warning (WARN); servo turns OFF. Condition: The Motor Override input is active.",
        "causes": [
          "The Motor Override input is active."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the digital input and make sure it is off."
        ],
        "fix": [
          "How to clear: DI.OVRD"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-14, AL013; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL014",
        "title": "Reverse Limit Error",
        "symptom": "7-segment display shows AL.014 (AL014); type: warning (WARN); servo stays ON. Condition: reverse limit switch is triggered.",
        "causes": [
          "Reverse limit switch is triggered.",
          "Servo system is unstable."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the reverse limit switch and make sure it is off.",
          "Check the parameter setting and the load inertia. If the setting is wrong, please modify the parameter value or re-estimate the motor capacity."
        ],
        "fix": [
          "How to clear: Reset the alarm or switch the servo drive off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-15, AL014; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL015",
        "title": "Forward Limit Error",
        "symptom": "7-segment display shows AL.015 (AL015); type: warning (WARN); servo stays ON. Condition: forward limit switch is activated.",
        "causes": [
          "Forward limit switch is activated.",
          "Servo system is unstable."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the forward limit switch and make sure it is off.",
          "Check the parameter setting and the load inertia. If the setting is wrong, please modify the parameter value or re-estimate the motor capacity."
        ],
        "fix": [
          "How to clear: Reset the alarm or switch the servo drive off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-15, AL015; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL016",
        "title": "IGBT Overheat",
        "symptom": "7-segment display shows AL.016 (AL016); type: alarm (ALM); servo turns OFF. Condition: temperature of IGBT is too high.",
        "causes": [
          "The load is over the rated range and the servo drive is in a persistent overload condition.",
          "Motor has a short-circuit or fault to ground (frame)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is overloaded or over-current. Then try increasing the motor’s capacity or reducing the load.",
          "Check if the wiring of servo drive output is correct."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-15, AL016; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL017",
        "title": "Abnormal EEPROM",
        "symptom": "7-segment display shows AL.017 (AL017); type: alarm (ALM); servo turns OFF. Condition: error occurs when DSP accesses EEPROM.",
        "causes": [
          "Parameter write error or value out of range; happens when restoring defaults with the wrong drive type set.",
          "ROM data damaged or missing; occurs in Servo On state. Contact AutomationDirect support if it appears."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Press SHIFT: panel shows EXGAB (X = 1, 2, 3; G = group; AB = parameter no. in hex). E320A = P2.010, E3610 = P6.016; check that value.",
          "Press SHIFT to see the parameter code. At power-up: value out of range, fix it and cycle power. During operation: parameter write error.",
          "Press SHIFT; E100X shown while restoring defaults means the servo model type setting is wrong; correct it.",
          "Press SHIFT; E0001 at power-up usually means ROM data damaged or missing; contact AutomationDirect support.",
          "To clear: at start-up, reset parameters and cycle power; during operation, reset the alarm."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-16, AL017; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL018",
        "title": "Abnormal Encoder Signal Output",
        "symptom": "AL.018 (AL018) ALM, servo OFF: encoder output frequency above the hardware rated output frequency.",
        "causes": [
          "Pulse resolution of the encoder is set too high.",
          "There is interference or cable damage causing communication error.",
          "Encoder error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the error log (P4.000-P4.005) for AL011, AL024, AL025 or AL026; if found, clear it using that alarm's checks and fixes."
        ],
        "fix": [
          "The setting of P1.076 and P1.046 should follow these requirements: P1.076 > motor speed and Motor speed x P1.046 x 4 < 19.8 x106 60",
          "Set P0.002 to -80; a rising count means noise. Ground the motor (green UVW lead to heat sink), check and separate encoder cable, use shielded cable.",
          "If you do not need to use the OA/OB pulse, set P2.065 [Bit 13] to 1 to disable the detection function for encoder output error (AL018).",
          "How to clear: 1) DI.ARST (alarm reset input) 2) Please contact Automation Direct technical support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-16, AL018; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL019",
        "title": "Serial Communication Error",
        "symptom": "7-segment display shows AL.019 (AL019); type: alarm (ALM); servo turns OFF. Condition: RS-485 communication error.",
        "causes": [
          "Improper setting of the communication parameters.",
          "Incorrect communication address.",
          "Incorrect communication value."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the values of the communication parameters. Then correctly set P3.003 and P3.004 or restore the value to default.",
          "Check and correctly set the communication address.",
          "Check and correctly set the accessing value."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-17, AL019; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL020",
        "title": "Serial Communication Timeout",
        "symptom": "7-segment display shows AL.020 (AL020); type: warning (WARN); servo stays ON. Condition: RS-485 communication error.",
        "causes": [
          "Improper setting of the timeout parameter (P5.003).",
          "Servo drive has not received the communication command for a long time and has timed out (please refer to P5.003)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check and make sure the value for the communication timeout parameter is correct.",
          "Check if the communication cable is loose or broken and is correctly wired."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-17, AL020; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL022",
        "title": "RST Leak Phase",
        "symptom": "AL.022 (AL022) WARN, servo OFF: RST power cable loose or no power. Warning by default; P2.066 [Bit 12] makes it an alarm.",
        "causes": [
          "RST leak phase."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the RST power cable for looseness or no power; on 3kW+ SureServo2 drives one missing phase trips it. Fix wiring, else contact AutomationDirect."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-17, AL022; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL023",
        "title": "Early Overload Warning",
        "symptom": "7-segment display shows AL.023 (AL023); type: warning (WARN); servo stays ON. Condition: Early overload warning",
        "causes": [
          "Early overload warning"
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if your servo drive is overloaded and refer to the corrective actions for AL006 for troubleshooting.",
          "Check if the value of P1.056 is set too low. If yes, please increase the value, which should be over 100 to disable the warning function."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-17, AL023; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL024",
        "title": "Encoder Initial Magnetic Field Error",
        "symptom": "7-segment display shows AL.024 (AL024); type: alarm (ALM); servo turns OFF. Condition: the magnetic field of the encoder U, V, W signal is in error.",
        "causes": [
          "the initial magnetic field of the encoder is in error (Signal U, V, W of the encoder magnetic field is in error.)"
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the servo motor is properly grounded and connect the UVW connector (color green) to the heat sink of the servo drive.",
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder.",
          "External encoder: check wiring for noise; the CN5 feedback noise filter is P1.074. If it persists, contact AutomationDirect support.",
          "How to clear: Re-power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-18, AL024; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL025",
        "title": "Encoder Internal Error",
        "symptom": "7-segment display shows AL.025 (AL025); type: alarm (ALM); servo turns OFF. Condition: internal memory and counter of the encoder are in error.",
        "causes": [
          "Internal encoder error (internal memory and counter are in error).",
          "When applying power, the motor rotates because of inertia of the machinery or other causes."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check grounding: green UVW lead to SureServo2 heat sink, encoder cable away from power/high-current cables, shielded encoder cable."
        ],
        "fix": [
          "Make sure the motor shaft does not move when power is turned on.",
          "How to clear: Cycle the power to the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-18, AL025; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL026",
        "title": "Encoder Unreliable Internal Data",
        "symptom": "7-segment display shows AL.026 (AL026); type: alarm (ALM); servo turns OFF. Condition: internal data error occurs three consecutive times.",
        "causes": [
          "External interference.",
          "Malfunction of encoder hardware."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "To correct the interference, check the following descriptions:",
          "Make sure the servo motor is properly grounded and connect the UVW connector (color green) to the SureServo2 servo drive heat sink.",
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder.",
          "Set P0.002 to -80 from the panel: if >0 and rising, recheck steps 1-3; if 0, contact AutomationDirect support.",
          "How to clear: Re-power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-18, AL026; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL027",
        "title": "Internal Motor Error",
        "symptom": "7-segment display shows AL.027 (AL027); type: alarm (ALM); servo turns OFF. Condition: encoder reset error.",
        "causes": [
          "encoder reset."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the encoder cable is firmly connected.",
          "Check if the power supply for the encoder is stable and make sure to use shielded cable.",
          "Check whether operating temperature is over 95°C; find the cause and do not restart until back in range. If it persists, contact AutomationDirect."
        ],
        "fix": [
          "How to clear: Re-power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-19, AL027; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL028",
        "title": "Encoder Voltage Error or Encoder Internal Error",
        "symptom": "AL.028 (AL028) ALM, servo OFF: charging circuit left in so battery >3.8 V, or encoder signal error.",
        "causes": [
          "Voltage level of the battery is too high.",
          "Internal encoder error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Remove the cause: ground motor (green UVW lead to heat sink), keep encoder cable off power cables, use shielded cable. Else contact AutomationDirect."
        ],
        "fix": [
          "Run over-voltage/over-current checks; fixing clears AL028. CN2 Pin 1 (5V) wired to BAT+ charges the battery: rewire. Battery must be > 3.8 V.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-19, AL028; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL029",
        "title": "Gray Code Error",
        "symptom": "7-segment display shows AL.029 (AL029); type: n/a; . Condition: Absolute position error.",
        "causes": [
          "Absolute position error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Cycle the power to the servo drive to operate the motor. Then check if the alarm occurs again. If the issue persists, please replace the encoder.",
          "How to clear: Re-power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-19, AL029; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL02A",
        "title": "Number of Revolutions of the Encoder is in Error",
        "symptom": "7-segment display shows AL.02A (AL02A); type: alarm (ALM); servo turns OFF. Condition: the number of revolutions of the encoder is in error.",
        "causes": [
          "the internal signal of the encoder is abnormal causing error in the number of revolutions."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Contact AutomationDirect for a new motor.",
          "How to clear: N/A"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-19, AL02A; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL02B",
        "title": "Motor Data Error",
        "symptom": "7-segment display shows AL.02B (AL02B); type: alarm (ALM); servo turns OFF. Condition: Accessing the internal data of the motor is in error.",
        "causes": [
          "Accessing the internal data of the motor is in error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Send your servo motor back to AutomationDirect.",
          "How to clear: N/A"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-20, AL02B; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL02C",
        "title": "Servo drive overload",
        "symptom": "AL.02C (AL02C) ALM, servo ON: 1) over rated load too long 2) bad gain or motion profile 3) motor/encoder miswired 4) encoder damaged.",
        "causes": [
          "1) Drive over rated load for too long; 2) unsuitable gain or motion profile; 3) motor/encoder miswired; 4) motor encoder damaged."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if motor current has stayed above drive rated output for long. a) Check vibration, tune gain. b) If accel/decel time too short, slow it.",
          "Check if the wirings of the motor power cable and the encoder are correct."
        ],
        "fix": [
          "Run Autotune to properly set the system gains.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-20, AL02C; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL030",
        "title": "Motor Collision Error",
        "symptom": "AL.030 (AL030) ALM, servo OFF: motor hit an object; torque reached P1.057 for the P1.058 time.",
        "causes": [
          "Check if the function of motor crash protection (P1.057) is enabled. If so, please set P1.057 to 0.",
          "Check if P1.057 is too low or P1.058 too short; set P1.057 to real torque. Wrong values cause false trips or lost protection."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Cycle power on the servo drive to operate the motor and check if the alarm occurs again. If the issue persists, please replace the encoder.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-20, AL030; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL031",
        "title": "Motor Power Cable Incorrect Wiring or Disconnection",
        "symptom": "AL.031 (AL031) ALM, servo OFF: power cable U, V, W or GND miswired or disconnected.",
        "causes": [
          "Motor U/V/W miswired or open. Open-wire detection: P2.065 Bit 9; miswiring detection: P2.065 Bit 8 (both off by default)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check motor power cable U, V, W, GND is tight; wire and ground per the user manual."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-20, AL031; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL032",
        "title": "Abnormal Encoder Vibration",
        "symptom": "7-segment display shows AL.032 (AL032); type: alarm (ALM); servo turns OFF. Condition: abnormal vibration occurred in the encoder.",
        "causes": [
          "the internal signal or mechanical part of the encoder is abnormal causing the signal returned by the encoder to be in error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor vibration range is within 2.5 G. If the vibration is within the range, send your servo motor back to AutomationDirect."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input) or cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-21, AL032; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL034",
        "title": "Encoder Internal Communication Error",
        "symptom": "AL.034 (AL034) ALM, servo OFF: 1) internal comm error in absolute encoder; 2) internal error in other encoder types.",
        "causes": [
          "encoder internal communication error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the battery wiring. Then wire it again and cycle power on the system.",
          "Check if the battery voltage is within the normal range."
        ],
        "fix": [
          "Internal communication error for the absolute type encoder occurs. Please replace the motor.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-21, AL034; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL035",
        "title": "Encoder Temperature Exceeds the Protective Range",
        "symptom": "7-segment display shows AL.035 (AL035); type: alarm (ALM); servo turns OFF. Condition: encoder temperature is over the maximum of 100°C.",
        "causes": [
          "encoder temperature is over 100°C."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Set P0.002 to -124 for encoder temp; over 100°C: improve cooling or cut load. Over 30°C off motor temp: return motor to distributor.",
          "How to clear: After the temperature detector shows a temperature below 100°C, please cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-21, AL035; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL036",
        "title": "Encoder Alarm Status Error",
        "symptom": "7-segment display shows AL.036 (AL036); type: alarm (ALM); servo turns OFF. Condition: abnormal state occurred in the encoder.",
        "causes": [
          "the encoder sends out an alarm signal, but the alarm status of the encoder read by the servo drive shows no error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is properly grounded. Make sure the power cable (green end) is grounded to the servo drive heat sink.",
          "Check the encoder signal cable connection; keep it away from power and high-current cables.",
          "Check the motor speed and make sure it is within the rated range. If the issue persists, send your servo motor back to AutomationDirect."
        ],
        "fix": [
          "Use shielded cable for the encoder, pull out the shielded mesh, and ground it.",
          "How to clear: DI.ARST (alarm reset input) or cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-21, AL036; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL040",
        "title": "Excessive Deviation of Full Closed-Loop Position Control",
        "symptom": "7-segment display shows AL.040 (AL040); type: alarm (ALM); servo turns OFF. Condition: excessive deviation of full closed-loop position control.",
        "causes": [
          "The setting value of P1.073 is too low.",
          "The connector may be loose or there is a problem when the connector connects to the mechanical parts.",
          "P1.072 takes integers only; if A/B pulses per rev in full-closed loop are not whole, error builds between encoders. Set P1.085 to avoid AL040."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the value for P1.073. If the value is too low, please set a higher value.",
          "Check if the value of P1.085 is set properly."
        ],
        "fix": [
          "Make sure the connector is firmly connected and there is no problem in connecting the mechanical load.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-22, AL040; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL041",
        "title": "CN5 Encoder is Disconnected",
        "symptom": "7-segment display shows AL.041 (AL041); type: alarm (ALM); servo turns OFF. Condition: CN5 communication is cut off.",
        "causes": [
          "CN5 communication is cut off."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the communication circuit of CN5."
        ],
        "fix": [
          "When CN5 is not in use, ensure P1.074.X is set to 0.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-22, AL041; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL042",
        "title": "Analog Input Voltage is Too High",
        "symptom": "AL.042 (AL042) ALM, servo OFF: analog speed command voltage above the P1.083 level.",
        "causes": [
          "Analog input voltage for the speed command is higher than the level specified by P1.083."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the voltage source for the speed command is correct. Check the setting value of P1.083 and set it to 0 when this function is not required."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-22, AL042; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL044",
        "title": "Servo Function Overload Warning",
        "symptom": "AL.044 (AL044) WARN, servo ON: motor control functions overloaded, so PR or E-Cam motion errors.",
        "causes": [
          "Servo function overload warning."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the filter is enabled and see if enabling the filter is necessary."
        ],
        "fix": [
          "Set P2.066 Bit4 to 1 to disable this alarm.",
          "Clear: disable unneeded filters (P1.006-P1.008, P1.068, P1.025-P1.028, P1.089-P1.094, 5 notch, P1.062, P1.057); P2.066 Bit4 = 1, cycle power."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-22, AL044; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL045",
        "title": "E-Gear Ratio Value Error",
        "symptom": "AL.045 (AL045) ALM, servo OFF: E-Gear ratio outside 1/4-262144; appears after power cycle.",
        "causes": [
          "when the servo drive is powered on, E-Gear ratio value is in error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check E-gear ratio is within 1/4-262144; correct P1.044, P1.045 or P2.00-P2.062 and cycle power."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive after the value is corrected."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-23, AL045; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL056",
        "title": "Excessive Motor Speed",
        "symptom": "AL.056 (AL056) ALM, servo OFF: filtered motor speed above P1.111; drive goes to Servo Off at once.",
        "causes": [
          "this alarm is to remind the user that the motor speed has reached the upper limit of the current setting (P1.111)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Find why speed is high: P1.111 too low, wrong bandwidth, or motor parameters not matching the motor."
        ],
        "fix": [
          "Evaluate the motor speed and the condition of the mechanical parts. If allowable, increase the speed and then the set value of P1.111.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-23, AL056; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL057",
        "title": "Feedback Pulse is Lost",
        "symptom": "AL.057 (AL057) ALM, servo OFF: with P2.081 = 1, pulse leakage detected above P2.082.",
        "causes": [
          "Pulse leakage occurs during motor operation.",
          "The pulse signal is interfered by noise."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if pulse leakage has occurred to the motor encoder feedback due to noise interference.",
          "Check if P2.083 is set correctly."
        ],
        "fix": [
          "If noise: (a) ground the motor, power cable green end to drive heat sink; (b) shielded feedback cable away from power and high-current cables.",
          "Square-wave digital encoder: check motor speed does not exceed the 20 MHz hardware input limit (limit x 4 frequency).",
          "Besides removing noise, square-wave encoders can use filter functions; with CN5 as main encoder source, set P1.074.U.",
          "Set the maximum speed limit of the motor with P1.055.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-23, AL057; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL058",
        "title": "Excessive Position Deviation after Initial Magnetic Field Detection is Complete",
        "symptom": "AL.058 (AL058) ALM, servo OFF: position error not reduced after magnetic field detection, e.g. commands sent before servo settled.",
        "causes": [
          "the controller issues commands during initial magnetic field detection."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the controller sends a command right at power-on (scope: Command position); if so, lengthen its post-power-on delay."
        ],
        "fix": [
          "If controller timing cannot change (surge noise etc.), set P2.088 [Bit 4] to 1 to block commands during initial magnetic field detection.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-24, AL058; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL05C",
        "title": "Motor Position Feedback Error",
        "symptom": "7-segment display shows AL.05C (AL05C); type: alarm (ALM); servo turns OFF. Condition: sudden jumps occur to the motor position feedback.",
        "causes": [
          "Encoder feedback is abnormal or the encoder is damaged.",
          "Encoder feedback is interfered."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check feedback: scope Feedback position [PUU] at 16 kHz or 20 kHz, turn the motor by hand and look for sudden jumps.",
          "Check if the feedback signal is interfered, causing sudden jumps to the motor position feedback."
        ],
        "fix": [
          "If main encoder is CN2, check noise-raised comm errors: set P0.017 to -80 and see if P0.009 is non-zero and rising.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-24, AL05C; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL060",
        "title": "Absolute Position is Lost",
        "symptom": "AL.060 (AL060) WARN, servo ON: revolution count lost due to low battery or power loss.",
        "causes": [
          "Voltage level of the battery is too low.",
          "The battery is replaced when the main power of the servo drive is off.",
          "The battery is not installed when the absolute function is enabled.",
          "Poor connection or disconnection of the battery power circuit."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if battery is below 2.9V; replace it, then home again. Absolute coordinate setup: Chapter 10."
        ],
        "fix": [
          "Do not change or remove the battery while SureServo2 main power is off. To re-home, see Chapter 10 (absolute coordinate init).",
          "Install the battery; check battery-to-drive connection and encoder wiring.",
          "Wire battery power to the encoder correctly, then home again; check encoder wiring and battery box connection.",
          "Clear: restore battery power to the encoder and re-establish the absolute origin (Chapter 10)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-25, AL060; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL061",
        "title": "Encoder Undervoltage",
        "symptom": "AL.061 (AL061) WARN, servo ON: absolute encoder battery below 3.1V.",
        "causes": [
          "voltage level of the battery is too low."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Measure the battery voltage and see if it is less than 3.1V. If the voltage is too low, replace the battery when the main power is on."
        ],
        "fix": [
          "How to clear: The alarm is cleared automatically."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-25, AL061; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL062",
        "title": "Number of Turns for the Absolute Encoder Overflows",
        "symptom": "AL.062 (AL062) WARN, servo ON: absolute encoder turn count outside -32768 to +32767.",
        "causes": [
          "motor’s rotation cycle exceeds the allowable range."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor’s number of turns while operating is within the range between -32768 and +32767. If not, please execute homing again."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-25, AL062; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL063",
        "title": "Linear Scale (CN5) Signal Error",
        "symptom": "7-segment display shows AL.063 (AL063); type: warning (WARN); servo stays ON. Condition: An error occurred to the linear scale original signal.",
        "causes": [
          "An error occurred to the linear scale original signal."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check linear scale/read head mounting, then DI.ARST on or cycle power. If it persists with CN5 encoder confirmed OK, return motor to AutomationDirect."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input) or cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-26, AL063; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL064",
        "title": "Encoder Vibration Warning",
        "symptom": "7-segment display shows AL.064 (AL064); type: warning (WARN); servo stays ON. Condition: abnormal vibration occurred in the encoder.",
        "causes": [
          "the internal signal or mechanical part of the encoder is abnormal, so the encoder returns a warning signal."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor vibration range is within 2G. If the vibration is within the range, contact AutomationDirect."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input) or cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-26, AL064; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL066",
        "title": "Number of Turns for the Absolute Encoder Overflows (servo drive)",
        "symptom": "AL.066 (AL066) ALM, servo ON: turn count (P0.051) over half encoder turn range; -32768 to +32767, third-party motors per spec.",
        "causes": [
          "motor’s rotation cycle exceeds the allowable range."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor’s number of turns during operation is within the range specified above. If not, re-establish the absolute origin coordinates."
        ],
        "fix": [
          "How to clear: Re-establish the absolute origin coordinates."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-26, AL066; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL067",
        "title": "Encoder Temperature Warning",
        "symptom": "AL.067 (AL067) WARN, servo ON: encoder temperature over 85°C (warning) but under 100°C protection.",
        "causes": [
          "encoder temperature warning (85°C -- 100°C)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Set P0.002 to -124; compare encoder vs motor temp. Too hot: improve cooling or cut load. Over 30°C apart: contact AutomationDirect support.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-26, AL067; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL06A",
        "title": "Absolute Position is Lost / Absolute Position is not Initialized",
        "symptom": "AL.06A (AL06A) WARN, servo ON: abs position lost: origin not set (1st use, dead battery with power off, E-Gear change) or error. (see source)",
        "causes": [
          "The servo drive is used for the first time, so the absolute origin coordinates are not established.",
          "Absolute position needs power; a drained battery with drive power off loses it.",
          "After the E-Gear ratio is modified, the communication type coordinate system needs to be re-established. An error occurred. Condition:",
          "The encoder cable is damaged, including the exterior and internal wiring.",
          "There is a momentary power failure in the battery power supply.",
          "The absolute motor is in error.",
          "The battery box is used, and J1 and J2 are connected in reverse.",
          "The voltage level of the battery is lower than 2.9V. Cause:",
          "Power supply is unstable due to damage of the encoder cable.",
          "The reason for the momentary power failure may be that the battery box connector is loose or excessive machine vibration.",
          "The absolute encoder of this motor is in error.",
          "J1/J2 reversed: battery cannot charge the buffer capacitor that bridges supply when drive power fails over to battery."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the absolute origin coordinates are established (refer to Section 10.3 for more information).",
          "Check if the wiring is loose. If the wiring is fine, replace the battery box for cross- testing."
        ],
        "fix": [
          "Do not swap the battery with the drive off; replace it while powered so the absolute encoder keeps power.",
          "Re-establish the absolute origin coordinates.",
          "Replace the encoder cable. Use the X-ray to check if the internal wiring is damaged.",
          "Replace the servo motor.",
          "Ensure J1 is connected to the battery and J2 is connected to the servo drive.",
          "How to clear: This alarm is cleared after you complete the initialization of the absolute position."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-27, AL06A; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL06B",
        "title": "The Error Between the Servo Drive Internal Coordinates and the Encoder Coordinates is Too Large",
        "symptom": "AL.06B (AL06B) WARN, servo ON: on battery power, motor turned over half the resolution revolution range.",
        "causes": [
          "the error between the servo drive internal coordinates and the encoder coordinates is too large."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "The mechanical parts are not properly fastened when the machine is being transported causing rotation of the motor.",
          "How to clear: Re-establish the absolute origin coordinates."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-27, AL06B; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL06E",
        "title": "Encoder Type is Unidentifiable",
        "symptom": "7-segment display shows AL.06E (AL06E); type: alarm (ALM); servo turns OFF. Condition: The servo drive cannot identify the encoder type.",
        "causes": [
          "The servo drive cannot identify the encoder type."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check all encoder cable wiring and connections."
        ],
        "fix": [
          "How to clear: If encoder cabling and connectors are OK, replace the motor."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-28, AL06E; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL06F",
        "title": "The Absolute Position is not Established",
        "symptom": "7-segment display shows AL.06F (AL06F); type: warning (WARN); servo stays ON. Condition: the establishment of the absolute position has timed out.",
        "causes": [
          "the process for establishing the absolute position of the servo drive is in error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If the issue persists after you cycle power on the servo drive and re-establish the absolute origin coordinates, contact AutomationDirect.",
          "How to clear: Cycle power on the servo drive and re-establish the absolute origin coordinates."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-28, AL06F; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL070",
        "title": "Encoder Does Not Complete the Command Issued by Servo Drive",
        "symptom": "AL.070 (AL070) WARN, servo ON: barcode write to encoder did not complete.",
        "causes": [
          "Command is not completed when the barcode is written to the encoder."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the wiring is correct and firmly connected. If not, please correctly connect the wiring again."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-28, AL070; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL071",
        "title": "Number of Revoluations of the Encoders is in Error",
        "symptom": "7-segment display shows AL.071 (AL071); type: alarm (ALM); servo turns OFF. Condition: the number of revolutions of the encoder is in error.",
        "causes": [
          "the internal signal of the encoder is abnormal causing error in the number of revolutions of the encoder."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If you executed DI.ARST but the issue persists, contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-28, AL071; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL072",
        "title": "Encoder Overspeed",
        "symptom": "AL.072 (AL072) ALM, servo OFF: encoder overspeed: >8800 rpm on drive power, >10000 rpm on battery; or battery too low.",
        "causes": [
          "1) Over 8800 rpm with encoder on drive power; 2) over 10000 rpm on battery; 3) battery voltage too low."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is well grounded; make sure the power cable is grounded to the heat sink of the servo drive.",
          "Check the motor speed and make sure it is within the rated range.",
          "Measure the battery voltage to see if it is below 3.1 V.",
          "Check if the battery wiring has poor contact. If issue persists, please contact AutomationDirect technical support."
        ],
        "fix": [
          "Make sure the encoder cable is separated from the power supply or any high-current cable to avoid interference.",
          "Use shielded cable for the encoder and pull out the shielded mesh and ground it.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-29, AL072; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL073",
        "title": "Encoder Memory Error",
        "symptom": "AL.073 (AL073) ALM, servo OFF: encoder EEPROM read/write error.",
        "causes": [
          "An error occurs when the encoder is reading data from, or writing data to EEPROM."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is well grounded; make sure the power cable is grounded to the servo drive heat sink.",
          "Check the motor speed and make sure it is within the rated range. If the issue persists, please contact AutomationDirect technical support."
        ],
        "fix": [
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder and pull out the shielded mesh and ground it.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-29, AL073; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL074",
        "title": "Absolute Encoder Single Turn Position Error",
        "symptom": "7-segment display shows AL.074 (AL074); type: alarm (ALM); servo turns OFF. Condition: Absolute encoder single turn position error.",
        "causes": [
          "Absolute encoder single turn position error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is well grounded; make sure the power cable is grounded to the servo drive heat sink.",
          "Check the motor speed and make sure it is within the rated range. If the issue persists, please contact AutomationDirect technical support."
        ],
        "fix": [
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder and pull out the shielded mesh and ground it.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-29, AL074; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL075",
        "title": "Absolute Encoder Position Error",
        "symptom": "7-segment display shows AL.075 (AL075); type: alarm (ALM); servo turns OFF. Condition: Absolute encoder position error.",
        "causes": [
          "Absolute encoder position error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is well grounded; make sure the power cable is grounded to the heat sink of the servo drive.",
          "Check the motor speed and make sure it is within the rated range. If the issue persists, please contact AutomationDirect technical support."
        ],
        "fix": [
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder and pull out the shielded mesh and ground it.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-30, AL075; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL077",
        "title": "Encoder Computing Error",
        "symptom": "7-segment display shows AL.077 (AL077); type: alarm (ALM); servo turns OFF. Condition: Encoder internal error (internal computing error).",
        "causes": [
          "Encoder internal error (internal computing error)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is well grounded; make sure the power cable is grounded to the heat sink of the servo drive.",
          "Check the motor speed and make sure it is within the rated range. If the issue persists, please contact AutomationDirect technical support."
        ],
        "fix": [
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder and pull out the shielded mesh and ground it.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-30, AL077; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL079",
        "title": "Encoder Parameter Error",
        "symptom": "AL.079 (AL079) ALM, servo OFF: encoder not power-cycled after parameter write, so value not updated.",
        "causes": [
          "The encoder is not cycled after the parameter is written, so the parameter value is not updated."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the parameter is written to the encoder. If so, please cycle power on the encoder to update the parameter."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-30, AL079; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL07A",
        "title": "Encoder Z Phase Position is Lost",
        "symptom": "7-segment display shows AL.07A (AL07A); type: alarm (ALM); servo turns OFF. Condition: Encoder Z phase position is in error.",
        "causes": [
          "Encoder Z phase position is in error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Send your servo motor back to AutomationDirect.",
          "How to clear: N/A"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-30, AL07A; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL07B",
        "title": "Encoder Memory Busy",
        "symptom": "7-segment display shows AL.07B (AL07B); type: alarm (ALM); servo turns OFF. Condition: Encoder memory is busy.",
        "causes": [
          "Encoder memory is busy."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is well grounded; make sure the power cable is grounded to the heat sink of the servo drive.",
          "Check the motor speed and make sure it is within the rated range. If the issue persists, please contact AutomationDirect technical support."
        ],
        "fix": [
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder and pull out the shielded mesh and ground it.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-31, AL07B; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL07C",
        "title": "Command to Clear The Absolute Position is Issued When the Motor Speed is Over 200 rpm",
        "symptom": "AL.07C (AL07C) WARN, servo ON: clear-absolute-position command given above 200 rpm.",
        "causes": [
          "The command to clear the absolute position is issued when the motor speed is over 200 rpm."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check for a clear-absolute-position command above 200 rpm; if so, clear the alarm by the proper procedure. Do not send it above 200 rpm."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-31, AL07C; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL07D",
        "title": "Servo Drive Power Is Cycled Before AL07C is Cleared",
        "symptom": "AL.07D (AL07D) ALM, servo OFF: AL07C not cleared before power cycle; motor stops.",
        "causes": [
          "AL07C occurs and is not cleared before the power is cycled on the servo drive, and the motor stops operating."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Use DI.ARST to clear the alarm. Once this alarm is cleared, AL07C occurs. Please follow the checking and troubleshoot methods to clear that alarm.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-31, AL07D; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL07E",
        "title": "Encoder Clearing Procedure Error",
        "symptom": "7-segment display shows AL.07E (AL07E); type: alarm (ALM); servo turns OFF. Condition: The time to clear the encoder exceeds the limit.",
        "causes": [
          "The time to clear the encoder exceeds the limit."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If it persists, set P0.002 to -81 to check encoder comm quality; if OK, clear with DI.ARST.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-31, AL07E; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL07F",
        "title": "Encoder Version Error",
        "symptom": "7-segment display shows AL.07F (AL07F); type: alarm (ALM); servo turns OFF. Condition: The encoder version read by the servo drive is wrong.",
        "causes": [
          "The encoder version read by the servo drive is wrong."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "N/A",
          "How to clear: Replace the motor immediately."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-31, AL07F; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL083",
        "title": "Servo Drive Outputs Excessive Current",
        "symptom": "AL.083 (AL083) ALM, servo OFF: output current above firmware limit in normal run; protects IGBT from overheat/burnout.",
        "causes": [
          "UVW cable is short-circuited.",
          "Motor wiring is wrong.",
          "Interference on the analog signal GND for the servo drive."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check motor power cable and connector; exposed or torn wire can short UVW. Replace the UVW cable and keep conductors covered.",
          "Check analog signal GND is not tied to another ground (noise). Do NOT share a ground between analog signal and GND; wire per Chapter 3."
        ],
        "fix": [
          "Per Chapter 3: with a non-AutomationDirect power cable, verify UVW order; verify UVW wiring between drive and motor.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-32, AL083; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL085",
        "title": "Regeneration Error",
        "symptom": "7-segment display shows AL.085 (AL085); type: alarm (ALM); servo turns OFF. Condition: regeneration control error.",
        "causes": [
          "regenerative resistor is not operating, but the regenerative voltage remains at 400V for a period of time."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check regen resistor wiring, recalculate its value, reset P1.052 and P1.053; if not cleared, contact AutomationDirect support."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-32, AL085; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL086",
        "title": "Regenerative Resistor Overload",
        "symptom": "AL.086 (AL086) ALM, servo OFF: too much capacitor energy dumped to regen resistor, overloading it.",
        "causes": [
          "Incorrect selection of the regenerative resistor or no connection to an external regenerative resistor.",
          "Incorrect parameter settings for P1.052 and P1.053.",
          "Other energy (such as interference) is input to the servo drive or the input voltage is higher than the allowable rated voltage.",
          "Malfunction of the servo drive hardware."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the connection for the regenerative resistor and correctly set the values of P1.052 and P1.053.",
          "Measure supply voltage vs rating (Appendix A); if over range, remove the interference source.",
          "Measure voltage between P3 and terminals; if it differs from DC Bus at P0.002 = 14, the drive may be faulty; contact AutomationDirect.",
          "If still present, scope the input with a differential probe for HF noise; remove the source, use the right supply, or add a series regulator."
        ],
        "fix": [
          "Recheck if regen energy exceeds P1.053; if so, fit a higher-capacity regen resistor.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-33, AL086; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL088",
        "title": "Servo Function Overload Warning",
        "symptom": "AL.088 (AL088) ALM, servo OFF: too many motor control functions enabled.",
        "causes": [
          "Servo function overload warning."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If using a filter, see if using this filter is necessary.",
          "Clear: disable unneeded filters: low-pass P1.006-P1.008, moving P1.068, P1.025-P1.028, P1.089-P1.094, 5 notch sets, P1.062, P1.057."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-33, AL088; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL089",
        "title": "Current Detection Interference",
        "symptom": "7-segment display shows AL.089 (AL089); type: warning (WARN); servo stays ON. Condition: current detection interference.",
        "causes": [
          "current detection in the servo drive is affected by an external interference source."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the environment around the servo drive to see if there is any interference source."
        ],
        "fix": [
          "Clear: remove or move the noise source; P2.112 [Bit 1] = 0 disables AL089. If it persists, contact AutomationDirect support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-33, AL089; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL08A",
        "title": "Auto-tuning Function - Command Error",
        "symptom": "AL.08A (AL08A) WARN, servo ON: no command given when auto-tuning starts.",
        "causes": [
          "When the command source is the controller, neither the controller nor the position register issue the command.",
          "When command source is the servo drive, position 1 and 2 specify the same position.",
          "The signal cable is not connected or incorrectly connected so that the servo drive cannot receive the command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure a command is being issued.",
          "Make sure the wiring between the controller and servo drive is correct.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-34, AL08A; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL08B",
        "title": "Auto-tuning Function - Pause Time is too Short",
        "symptom": "AL.08B (AL08B) WARN, servo ON: pause too short with controller as auto-tune command source; tuning needs calc time.",
        "causes": [
          "pause time in the cycle is too short."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "For a reciprocating motion between two points, pausing is required on the return, which has to be longer than 1 sec.",
          "For rotation in a single direction, pause time is required when the motor rotates a certain number of cycles (> 2 cycles).",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-34, AL08B; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL08C",
        "title": "Auto-tuning Function - Inertia Estimation Error",
        "symptom": "AL.08C (AL08C) WARN, servo ON: inertia estimation error when auto-tuning starts.",
        "causes": [
          "Acceleration/deceleration time is too long.",
          "Rotation speed is too slow.",
          "Inertia of the machine is too large.",
          "Inertia variation is too drastic."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "The acceleration/deceleration time for the motor to rotate from 0 rpm to 3000 rpm must be within 1.5 sec.",
          "The slowest speed must be no less than 200 rpm; above 500 rpm is suggested.",
          "The load inertia must be no more than 50 times the motor inertia.",
          "Avoid applications that require drastic variation in the inertia.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-34, AL08C; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL095",
        "title": "Regenerative Braking Resistor Disconnected",
        "symptom": "AL.095 (AL095) WARN, servo ON: P1.053 not 0 with no external regen resistor or brake; only 5.5 kW+ drives with built-in resistor.",
        "causes": [
          "P1.053 (regen resistor W) not 0 while no external resistor or brake is connected; only 5.5 kW and larger drives with built-in resistors."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If regen braking is needed, connect the regen resistor and verify P1.053.",
          "Without regen brake, set P1.053 to 0; if it persists, contact AutomationDirect support.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-34, AL095; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL099",
        "title": "DSP Firmware Update",
        "symptom": "7-segment display shows AL.099 (AL099); type: alarm (ALM); servo turns OFF. Condition: EEPROM is not reset after DSP firmware is updated.",
        "causes": [
          "EEPROM is not reset after DSP firmware is updated."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the firmware is updated. Set P2.008 to 30 first and then set it to 28. Next, cycle power on the servo drive."
        ],
        "fix": [
          "How to clear: Set P2.008 to 30 and then 28. Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-35, AL099; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL09C",
        "title": "Parameter Reset Failed",
        "symptom": "7-segment display shows AL.09C (AL09C); type: alarm (ALM); servo turns OFF. Condition: the parameter reset process is not complete.",
        "causes": [
          "an error occurred during the parameter reset process, so the reset procedure could not be completed."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the power is cut off during the reset process. Check the power wiring and switch."
        ],
        "fix": [
          "How to clear: Set P2.008 to 30 and then 28. Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-35, AL09C; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL219",
        "title": "Write Parameters: Parameter Cannot Be Written",
        "symptom": "7-segment display shows AL.219 (AL219); type: warning (WARN); servo stays ON. Condition: this parameter is write-protected.",
        "causes": [
          "the parameter write-protected function is enabled."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the parameter and data array protection function (P5.097) is enabled."
        ],
        "fix": [
          "How to clear: Disable the parameter and data array protection function or reset the parameters."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-35, AL219; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL221",
        "title": "A Non-existing Mode is Used",
        "symptom": "AL.221 (AL221) WARN, servo ON: mode does not exist, or command not valid in current mode.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Verify P1.001 and that DI/comm commands suit the current mode; if P1.001 is right and it persists, note the steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-35, AL221; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL223",
        "title": "Some Commands are Not Allowed to be Used When the Servo is in the ERROR or FAULT state",
        "symptom": "AL.223 (AL223) WARN, servo ON: specific command used while servo in ERROR or FAULT state.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-35, AL223; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL21B",
        "title": "Memory Stack is Out of Range",
        "symptom": "AL.21B (AL21B) WARN, servo ON: task control command memory address out of range.",
        "causes": [
          "incorrect use of the command of the firmware."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operatoin steps and contact AutoamtionDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-36, AL21B; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL21D",
        "title": "A Divisor in an Expression is Zero in the Program",
        "symptom": "7-segment display shows AL.21D (AL21D); type: n/a; . Condition: a divisor in an expression is zero in the program.",
        "causes": [
          "programming error of the firmware."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-36, AL21D; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL239",
        "title": "The Argument of the LOOP_CMD Command is Out of Range",
        "symptom": "AL.239 (AL239) WARN, servo ON: LOOP_CMD input argument out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-36, AL239; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL23F",
        "title": "Parameter is Written to a Memory Address that is Out of Range",
        "symptom": "AL.23F (AL23F) WARN, servo ON: parameter write command hit an out-of-range memory address.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-36, AL23F; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL245",
        "title": "PR Positioning Timeout",
        "symptom": "7-segment display shows AL.245 (AL245); type: warning (WARN); servo stays ON. Condition: PR positioning function is triggered.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the conditions for completing the PR commands are not set or not triggered, causing the PR command to register as incomplete."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input) or cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-36, AL245; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL247",
        "title": "The MATT_ACC Command Called a Math Function that is Out of Range",
        "symptom": "AL.247 (AL247) WARN, servo ON: MATH_ACC called a math function ID out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-37, AL247; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL249",
        "title": "PR Path Number is Out of Range",
        "symptom": "7-segment display shows AL.249 (AL249); type: warning (WARN); servo stays ON. Condition: the number of the triggered PR path exceeds the upper limit.",
        "causes": [
          "the number of the triggered PR path is higher than 99."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the PR command jumps to a path exceeding the range.",
          "Check if the PR command format is correct."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input) or cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-37, AL249; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL251",
        "title": "The Argument of the MATH_POWER Command is Out of Range",
        "symptom": "AL.251 (AL251) WARN, servo ON: MATH_POWER argument outside 0-10.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-37, AL251; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL255",
        "title": "The System Object ID is Out of Range when the Object is Used",
        "symptom": "AL.255 (AL255) WARN, servo ON: system object ID out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-37, AL255; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL257",
        "title": "The System Object Function Block ID is Out of Range when a System Object is Used",
        "symptom": "AL.257 (AL257) WARN, servo ON: system object function block ID out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-37, AL257; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL25B",
        "title": "Object Argument Format Error",
        "symptom": "7-segment display shows AL.25B (AL25B); type: n/a; . Condition: when the system object is used, the argument format of the object is in error.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-38, AL25B; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL25F",
        "title": "An Error Occured when the Object Dictionary was Accessed",
        "symptom": "AL.25F (AL25F) WARN, servo ON: object dictionary command value out of range or object missing.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-38, AL25F; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL35F",
        "title": "Emergency Stop During Acceleration",
        "symptom": "AL.35F (AL35F) WARN, servo ON: rising edge of DI(0x47); motor decelerates to 0, then AL3CF.",
        "causes": [
          "The rising edge of DI(0x47) is triggered, and then the motor decelerates to 0 and triggers AL3CF."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if any of the parameters, P2.010–P2.017 and P2.036–P2.040, are set to DI9(0x47) and are triggered."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-38, AL35F; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL422",
        "title": "Write-in Failed Caused by Power Supply Cut-off",
        "symptom": "AL.422 (AL422) ALM, servo OFF: P2.069.Z = 1 (block index coordinate overflow) and power lost; position not stored.",
        "causes": [
          "The load is over the trated range and the servo drive is in a continous overload condition.",
          "After firmware update, the internal variables vary depending on the version.",
          "The servo drive hardware EEPROM is abnormal.",
          "The hardware of the servo drive is short-circuited.",
          "AL520 occurred and cause malfunction of the servo drive."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Set P0.002 to 12; if average load stays over 100%, use a bigger motor or less load (Appendix A load vs time graph).",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-38, AL422; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL500",
        "title": "STO Function Is Enabled",
        "symptom": "7-segment display shows AL.500 (AL500); type: alarm (ALM); servo turns OFF. Condition: Safe torque off function (STO) is enabled.",
        "causes": [
          "Safe torque off function (STO) is enabled."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Safe torque off function (STO) is enabled. Please check why it is enabled.",
          "Clear the alarm: DI.ARST input, 0x6040 Fault Reset, or P0.001 = 0 (AL500, see source)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-39, AL500; alarm list 11.1 p.11-7)",
        "fixIfNoStoWiring": [
          "Fit the CN10 STO short-circuit plug. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "AL501",
        "title": "STO_A Loss (signal loss or signal error)",
        "symptom": "AL.501 (AL501) ALM, servo OFF: STO_A signal lost, or STO_A/STO_B out of sync for over 1sec.",
        "causes": [
          "Loss of STO_A signal or STO_A and STO_B signals are not synchronized for more than 1sec."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the wiring of STO_A is correct.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-39, AL501; alarm list 11.1 p.11-7)"
      },
      {
        "code": "AL502",
        "title": "STO_B Loss (signal loss or signal error)",
        "symptom": "AL.502 (AL502) ALM, servo OFF: STO_B signal lost, or STO_A/STO_B out of sync for over 1 sec.",
        "causes": [
          "Loss of STO_B signal or STO_A and STO_B signals are not synchronized for more than 1 sec."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the wiring of STO_B is correct.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-39, AL502; alarm list 11.1 p.11-7)"
      },
      {
        "code": "AL503",
        "title": "STO Self-diagnostic Error",
        "symptom": "7-segment display shows AL.503 (AL503); type: alarm (ALM); servo turns OFF. Condition: An error occurs during STO self-diagnosis.",
        "causes": [
          "An error occurs during STO self-diagnosis."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the wiring of STO_A and STO_B are correct.",
          "How to clear: If the wiring is correct, it might be that the STO circuit is causing the error."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-39, AL503; alarm list 11.1 p.11-7)"
      },
      {
        "code": "AL510",
        "title": "Internal Parameter Update Program of the Servo Drive is Abnormal",
        "symptom": "AL.510 (AL510) WARN, servo ON: internal parameter update program abnormal.",
        "causes": [
          "Internal parameter update program of the servo drive is abnormal."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If it appears during motor parameter identification, cycle power and run identification again.",
          "How to clear: N/A"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-39, AL510; alarm list 11.1 p.11-7)"
      },
      {
        "code": "AL520",
        "title": "Calculation Program Timeout",
        "symptom": "7-segment display shows AL.520 (AL520); type: alarm (ALM); servo turns OFF. Condition: Servo drive calculation program timeout.",
        "causes": [
          "Servo drive calculation program timeout."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Cycle power on the servo drive.",
          "If the alarm persists, disable the vibration elimination function by setting [Bit 8] and [Bit 9] of P2.094 to 0.",
          "How to clear: N/A"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-40, AL520; alarm list 11.1 p.11-7)"
      },
      {
        "code": "AL521",
        "title": "Vibration Elimination Parameter Error",
        "symptom": "AL.521 (AL521) ALM, servo OFF: vibration elimination (elasticity compensation) value unsuitable.",
        "causes": [
          "The value of vibration suppression (elasticity compensation) is incorrect.",
          "The Bode plot is in error due to other variables while the operation system is analyzing the program."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Perform system analysis again and correctly set the value for the vibration elimination parameter.",
          "Clear: 1) redo system analysis and set vibration elimination correctly; 2) if it persists, disable it via P2.094 [Bit 8] & [Bit 9]."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-40, AL521; alarm list 11.1 p.11-7)"
      },
      {
        "code": "ALF21",
        "title": "Command Error",
        "symptom": "AL.F21 (ALF21) ALM, servo OFF: firmware commands used outside spec.",
        "causes": [
          "servo status mode error. It could occur when servo is in motion status and reconnecting status at the same time."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Record the operation steps and contact AutomationDirect.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-40, ALF21; alarm list 11.1 p.11-7)"
      },
      {
        "code": "AL111",
        "title": "Buffer Overflow Occurs When Receiving SDO",
        "symptom": "7-segment display shows AL.111 (AL111); type: alarm (ALM); servo stays ON. Condition: SDO Rx Buffer overflow (receives more than two SDOs within 1ms).",
        "causes": [
          "SDO Rx Buffer overflow (receives more than two SDOs within 1ms)."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the servo drive (master) receives or sends more than one SDO within 1ms."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-40, AL111; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL112",
        "title": "Buffer Overflow Occurs When Receiving PDO",
        "symptom": "AL.112 (AL112) ALM, servo ON: PDO Rx buffer overflow (over two PDOs of one COBID within 1ms).",
        "causes": [
          "PDO Rx Buffer overflow (receives more than two PDOs of COBID within 1ms)"
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the servo drive (master) receives or sends more than one PDO of COBID within 1ms."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-40, AL112; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL121",
        "title": "Object’s Index Does Not Exist When PDO is Received",
        "symptom": "AL.121 (AL121) ALM, servo ON: PDO from controller has an object index the drive cannot identify.",
        "causes": [
          "PDO from the controller names an object index the drive cannot identify."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the object’s index for PDO mapping for the controller is correct."
        ],
        "fix": [
          "If the index is right, the drive does not support that object; check if it is needed or use another object.",
          "How to clear: NMT: reset node or 0x6040 (Fault Reset).."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-41, AL121; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL122",
        "title": "Object’s Sub-index Does Not Exist When PDO is received",
        "symptom": "AL.122 (AL122) ALM, servo ON: PDO from controller has an object sub-index the drive cannot identify.",
        "causes": [
          "PDO from the controller names an object sub-index the drive cannot identify."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the object’s sub-index for PDO mapping for the controller is correct."
        ],
        "fix": [
          "If the sub-index is right, the drive does not support that object; check if it is needed or use another object.",
          "How to clear: NMT: reset node or 0x6040 (fault reset.)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-41, AL122; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL123",
        "title": "Data Size Error Occurs When PDO is Received",
        "symptom": "AL.123 (AL123) ALM, servo ON: message data length does not match the object length.",
        "causes": [
          "Data length in the message does not match the length of the specified object."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the data length for PDO mapping is changed when the servo drive receives or sends PDO."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-41, AL123; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL124",
        "title": "Data Range Error Occurs When PDO is Received",
        "symptom": "AL.124 (AL124) ALM, servo ON: message data value out of range for the object.",
        "causes": [
          "The data value in the message is out of range for the specified object."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the written range is wrong when the servo drive receives or sends PDO."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-41, AL124; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL125",
        "title": "Object is Read-Only and Write-Protected",
        "symptom": "AL.125 (AL125) ALM, servo ON: object in message is read-only (write-protected).",
        "causes": [
          "The specified object in the message is read-only and write-protected."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the object for the PDO mapping is read-only."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-41, AL125; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL126",
        "title": "Specified Object Does Not Support PDO Mapping",
        "symptom": "AL.126 (AL126) ALM, servo ON: object in message cannot be PDO-mapped.",
        "causes": [
          "The specified object in the message does not support PDO mapping."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the specified object allows PDO mapping when PDO is receiving or sending."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-42, AL126; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL127",
        "title": "PDO is Write-Protected When Servo Drive is On",
        "symptom": "AL.127 (AL127) ALM, servo ON: object in message is write-protected while servo is on.",
        "causes": [
          "The specified object in the message is write-protected when the servo drive is on."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure no PDO is written when servo drive is on.",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-42, AL127; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL128",
        "title": "Error Occurs When Reading PDO from EEPROM",
        "symptom": "AL.128 (AL128) ALM, servo ON: loading defaults from ROM at start-up failed; all CAN objects reset to defaults.",
        "causes": [
          "An error occurs when loading the default value from ROM at start-up. All objects of CAN automatically return to the default value."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "When PDO is receiving or sending, check if the error occurs because the specified object reads from EEPROM.",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-42, AL128; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL129",
        "title": "Error Occurs When Writing PDO to EEPROM",
        "symptom": "AL.129 (AL129) ALM, servo ON: saving parameter values to ROM failed.",
        "causes": [
          "An error occurs when saving the current parameter value into ROM."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "When PDO is receiving or sending, check if the error occurs because the specified object is written to EEPROM.",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-42, AL129; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL130",
        "title": "Accessing address of EEPROM is out of range when using PDO",
        "symptom": "AL.130 (AL130) ALM, servo ON: ROM data exceeds firmware space, likely left by older firmware after an update.",
        "causes": [
          "ROM data larger than firmware allows, probably saved by older firmware before an update."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the addressing in EEPROM exceeds the range for the specified object during PDO receiving or sending."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-42, AL130; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL131",
        "title": "CRC of EEPROM calculation error occurs when using PDO",
        "symptom": "AL.131 (AL131) ALM, servo ON: ROM data damaged; all objects restored to defaults.",
        "causes": [
          "The data in ROM is damaged; all objects are automatically restored to default values."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the object causes an EEPROM CRC error when PDO is sent/received; usually caused by a DSP error."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset) or DI.ARST (alarm reset input)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-43, AL131; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL132",
        "title": "Parameter is write-prohibited when using PDO",
        "symptom": "AL.132 (AL132) ALM, servo ON: comm object tried to write a parameter that is currently write-prohibited.",
        "causes": [
          "When using communication object to write data to the parameter, the parameter is currently write-prohibited."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Please refer to the specified parameter description to write data to the parameter.",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-43, AL132; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL180",
        "title": "Detect the connection between the PLC and comm. card",
        "symptom": "AL.180 (AL180) ALM, servo OFF: no message within P3.067 on EtherNet/IP Explicit or Modbus TCP; can be warning or alarm.",
        "causes": [
          "No data message received in the time duration specified in P3.067 on EtherNet/IP Explicit or Modbus TCP. This can be set as a Warning or an Alarm"
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the communication is normal.",
          "Check if the wiring is correctly connected."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset) or DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-43, AL180; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL185",
        "title": "HSSP command timeout or data checksum error",
        "symptom": "7-segment display shows AL.185 (AL185); type: alarm (ALM); servo turns OFF. Condition: internal communication is cut off.",
        "causes": [
          "Abnormal communication hardware, (internal communication card packet fails for > 5s, or the received packet contains a CRC error 3x in a row).."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the communication cable is intact and firmly connected.",
          "Check the communication quality; it is suggested that you use common grounding and shielded cable."
        ],
        "fix": [
          "For communication type models, check if the value of monitoring variable 120 increases constantly.",
          "Clear: NMT reset node, 0x6040 fault reset, or DI.ARST. Internal alarm, not tied to P3.065 or P3.067."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-43, AL185; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL186",
        "title": "Communication Bus Off",
        "symptom": "7-segment display shows AL.186 (AL186); type: alarm (ALM); servo stays ON. Condition: Transmission error in comms data.",
        "causes": [
          "Transmission error in comms data."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the cable is well connected and whether there is any noise inference. Replace the communication cable or eliminate the noise if necessary."
        ],
        "fix": [
          "There are an excessive number of the slave stations, and the communication cycle is too short. Please lengthen the communication cycle.",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-43, AL186; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL201",
        "title": "Error occurs when loading data",
        "symptom": "7-segment display shows AL.201 (AL201); type: alarm (ALM); servo turns OFF. Condition: an error has occurred when loading data from EEPROM.",
        "causes": [
          "initialization error of comms data."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If the alarm is cleared after cycling power on the servo drive, it means the error occurs at the moment when reading the data.",
          "If it persists after power cycle, EEPROM data is damaged; rewrite correct values, e.g. defaults: set P2.008 to 30 then 28.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-44, AL201; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL22D",
        "title": "Absolute positioning is not allowed when E-Cam is engaged",
        "symptom": "7-segment display shows AL.22D (AL22D); type: alarm (ALM); servo stays ON. Condition: Absolute positioning is performed when the E-Cam is engaged.",
        "causes": [
          "Absolute positioning is performed when the E-Cam is engaged."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the E-Cam is engaged when the servo is performing absolute positioning."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-44, AL22D; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL301",
        "title": "Synchronization failure",
        "symptom": "AL.301 (AL301) WARN, servo ON: drive cannot sync with controller in IP mode.",
        "causes": [
          "synchronization failure."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the communication between the servo drive and the controller is good.",
          "After eliminating any problems that you find, allow the controller to re-send the SYNC signal and ensure that it is sent successfully.",
          "Modify the setting for P3.009 (setting the default value is suggested).",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-44, AL301; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL302",
        "title": "Synchronization signal is sent too soon",
        "symptom": "AL.302 (AL302) WARN, servo ON: comm sync signal arrives too early.",
        "causes": [
          "the synchronization signal is sent too soon."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the setting of synchronization cycle (0x1006) is identical to that of the controller.",
          "Modify the setting of P3.009 (using the default value is suggested).",
          "Ensure the correct time sequence of sending packets from the controller. A drift or delay in packet sending time causes synchronization failure.",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-44, AL302; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL303",
        "title": "Synchronization signal timeout",
        "symptom": "7-segment display shows AL.303 (AL303); type: warning (WARN); servo stays ON. Condition: in IP mode, the synchronization with the controller failed.",
        "causes": [
          "timeout of synchronization signal."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the communication quality is good.",
          "Make sure the setting of synchronization cycle (0x1006) is identical to that of the controller.",
          "Modify the setting of P3.009 (using default value is suggested).",
          "Ensure the correct time sequence for sending packets from the controller. A drift or delay in packet sending time causes synchronization failure.",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-45, AL303; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL304",
        "title": "Invalid IP command",
        "symptom": "7-segment display shows AL.304 (AL304); type: warning (WARN); servo stays ON. Condition: command cannot be sent when in IP mode.",
        "causes": [
          "invalid IP command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "The computing time in IP mode takes too long. Please disable the USB monitoring function.",
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-45, AL304; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL305",
        "title": "SYNC period error",
        "symptom": "7-segment display shows AL.305 (AL305); type: warning (WARN); servo stays ON. Condition: Comms 301 Obj 0x1006 Data Error",
        "causes": [
          "SYNC period error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the value of 0x1006. If it is smaller than or equal to 0, the alarm occurs."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-45, AL305; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL401",
        "title": "NMT reset command is received while servo is on",
        "symptom": "7-segment display shows AL.401 (AL401); type: alarm (ALM); servo turns OFF. Condition: NMT reset command is received while servo drive is on.",
        "causes": [
          "NMT reset command is received while servo drive is on."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the NMT reset command is received while the servo drive is on. Use NMT.reset or 0x6040 (fault reset)."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-45, AL401; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL207",
        "title": "Parameter group of PR Type 8 (Write) is out of range",
        "symptom": "AL.207 (AL207) WARN, servo ON: PR Type 8 (Write) P_Group parameter group out of range.",
        "causes": [
          "the group for PR Type 8 (Write) command source exceeds the range."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Writing parameter using PR procedure: the parameter group of command source exceeds the range. Please check the setting.",
          "How to clear: DI.ARST (alarm reset input) or set P0.001 to 0."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-46, AL207; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL209",
        "title": "Parameter number of PR Type 8 (Write) is out of range",
        "symptom": "7-segment display shows AL.209 (AL209); type: warning (WARN); servo stays ON. Condition: parameter number for PR Type 8 (Write) is out of range.",
        "causes": [
          "parameter number is out of range."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Writing parameter using PR procedure: parameter number of PR Type 8 (Write) is out of range. Please check the setting.",
          "How to clear: DI.ARST (alarm reset input) or set P0.001 to 0."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-46, AL209; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL211",
        "title": "Parameter Format Setting of Type 8 (Write) PR is in Error",
        "symptom": "AL.211 (AL211) WARN, servo ON: PR Type 8 (Write) parameter format setting wrong.",
        "causes": [
          "Incorrect parameter format.",
          "The SureServo2 Pro software version and the firmware version do not match."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the parameter format is correct.",
          "Check if you are using the latest version of the software. If you took the corrective actions but the issue persists, contact AutomationDirect."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-46, AL211; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL213",
        "title": "Parameter setting of PR Type 8 (Write) is in error",
        "symptom": "AL.213 (AL213) WARN, servo ON: PR Type 8 (Write) parameter value incorrect.",
        "causes": [
          "parameter value of PR Type 8 (Write) is in error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the parameter value is within the correct range.",
          "How to clear: DI.ARST (alarm reset input) or set P0.001 to 0."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-46, AL213; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL215",
        "title": "Write parameters: read-only",
        "symptom": "AL.215 (AL215) WARN, servo ON: PR write targets a read-only parameter.",
        "causes": [
          "an error occurs when writing parameters with PR Type 8 (Write) command."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "The specified parameter is read-only.",
          "How to clear: DI.ARST (alarm reset input) or set P0.001 to 0."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-46, AL215; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL217",
        "title": "Write parameters: parameter locked",
        "symptom": "AL.217 (AL217) WARN, servo ON: PR Type 8 (Write) failed: parameter write-protected while servo on, or value out of range.",
        "causes": [
          "PR Type 8 (Write) error: parameter write-protected while servo is on, or value out of range."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Please write the parameters when the servo drive is off and make sure the parameter’s value is within the range.",
          "How to clear: Modify the PR command and the parameter."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-47, AL217; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL231",
        "title": "Monitoring item for PR Write command is out of range",
        "symptom": "AL.231 (AL231) WARN, servo ON: PR Type 8 (Write) Sys_Var monitor value out of range.",
        "causes": [
          "the value for the monitoring item is out of range."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Please check the code range when writing the monitoring code and make sure it is within the allowable range.",
          "How to clear: Reset the alarm or set P0.001 to 0."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-47, AL231; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL235",
        "title": "Absolute positioning command error",
        "symptom": "AL.235 (AL235) WARN, servo ON: position command after feedback position counter overflow.",
        "causes": [
          "feedback position counter overflows."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Incremental: one-way travel overflows FB_PUU, position goes wrong and later positioning errors; check on scope, then home. Absolute: (see source)",
          "Feedback position register (FB_PUU) overflows.",
          "Setting for P1.001.Z changes, but homing has not been completed yet.",
          "E-Gear ratio (P1.044 and P1.045) changes, but homing has not been completed yet.",
          "The function to return to the original point is triggered, but homing has not been completed yet.",
          "On AL060 or AL062, check overflow on the scope, go through steps 1-4 above, and home.",
          "How to clear: Perform homing procedure."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-47, AL235; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL237",
        "title": "Indexing coordinate is undefined",
        "symptom": "AL.237 (AL237) WARN, servo ON: indexing positioning command before index start point defined.",
        "causes": [
          "The servo drive cannot identify this coordinate system."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the indexing coordinate has been defined:"
        ],
        "fix": [
          "Perform the homing procedure before using the indexing function.",
          "After alarm occurs, use DI.ARST or set P0.001 to 0 to clear the alarm.",
          "This alarm is also cleared when you power on the servo.",
          "How to clear: DI.ARST (alarm reset input) or set P0.001 to 0."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-47, AL237; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL283",
        "title": "Software positive limit",
        "symptom": "AL.283 (AL283) WARN, servo ON: command target beyond the software positive limit.",
        "causes": [
          "reaching the software positive limit."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Positive soft limit checks the command, not feedback, so it can trip before the axis gets there. Set a suitable decel time (see P5.003).",
          "How to clear: The alarm is automatically cleared after the motor moves away from the limit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-48, AL283; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL285",
        "title": "Software negative limit",
        "symptom": "AL.285 (AL285) WARN, servo ON: command target below the software negative limit.",
        "causes": [
          "the software negative limit is triggered."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Negative soft limit checks the command, not feedback, so it can trip before the axis gets there. Set a suitable decel time (see P5.003).",
          "How to clear: The alarm is automatically cleared after the motor moves away from the limit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-48, AL285; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL289",
        "title": "Feedback position counter overflows",
        "symptom": "7-segment display shows AL.289 (AL289); type: warning (WARN); servo stays ON. Condition: Feedback position counter overflows.",
        "causes": [
          "Feedback position counter overflows."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Set the gear ratio for the absolute motor total travel and application so the feedback position counter does not overflow.",
          "If P2.069.Z is set to 1 (prevent index coordinate overflow function), please set P2.070 bit 2 to 1.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-48, AL289; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL380",
        "title": "Position offset alarm for DO.MC_OK",
        "symptom": "7-segment display shows AL.380 (AL380); type: warning (WARN); servo stays ON. Condition: DO.MC_OK is on and then goes off.",
        "causes": [
          "DO.MC_OK is on and then goes off."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "See P1.048: DO.MC_OK drops after on because DO.TPOS went off, maybe external force moved the motor after positioning. Disable: P1.048.Y = 0.",
          "How to clear: DI.ARST (alarm reset input) or set P0.001 to 0."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-48, AL380; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL3CF",
        "title": "DI.PFQS input for quick stop and fault (Emergency Stop)",
        "symptom": "AL.3CF (AL3CF) WARN, servo OFF: follows AL35F once the motor has decelerated to 0.",
        "causes": [
          "After AL35F is triggered and the motor has decelerated to 0, this alarm occurs."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if any of the parameters, P2.010–P2.017 and P2.036–P2.040, are set to DI(0x47) and are triggered."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-49, AL3CF; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL3F1",
        "title": "Absolute index coordinate undefined",
        "symptom": "AL.3F1 (AL3F1) ALM, servo OFF: absolute positioning command in comm mode before absolute coordinates exist.",
        "causes": [
          "The absolute coordinate system has not been created.",
          "Overflow occurs since the motor keeps rotating in the same direction."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Create an absolute coordinate system.",
          "Set the coordinate system origin again.",
          "How to clear: Set the origin again."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-49, AL3F1; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL400",
        "title": "Index coordinate error",
        "symptom": "7-segment display shows AL.400 (AL400); type: alarm (ALM); servo turns OFF. Condition: P1.044 x P2.052 x 4 has to be less than 2^31.",
        "causes": [
          "value of P2.052 is set too low and causes the index coordinate error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check P2.052 is within range; too low a value causes index coordinate error; adjust P2.052."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-49, AL400; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL404",
        "title": "Value of PR special filter setting is too high",
        "symptom": "AL.404 (AL404) ALM, servo OFF: PR special filter P1.022 too high, so following error exceeds range.",
        "causes": [
          "following error of internal position exceeds the allowable range."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the setting of P1.022. If the value is too high, the following error exceeds the allowable range faster. Please adjust the value of P1.022."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-49, AL404; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL555",
        "title": "System failure",
        "symptom": "7-segment display shows AL.555 (AL555); type: alarm (ALM); servo turns OFF. Condition: DSP processing error.",
        "causes": [
          "DSP processing error."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If this alarm occurs, please contact AutomationDirect technical support without making any modification.",
          "How to clear: N/A"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-49, AL555; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL809",
        "title": "PR Arithmetic operation parmeter error or secondary platform error",
        "symptom": "AL.809 (AL809) ALM, servo OFF: motion command decode error.",
        "causes": [
          "PR arithmetic parameters must be compiled in SureServo2 Pro before download; editing them via panel or controller without recompiling gives AL809."
        ],
        "confirm": [
          "Check P0.001 (active alarm) and history P4.000 (latest) to P4.004 (N-4) in Parameter mode using SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure you edit PR arithmetic operation parameters through SureServo2 Pro. Do not directly modify these parameters with the panel or controller.",
          "If this alarm occurs when the servo is not in PR mode, please save the parameter file and contact the AutomationDirect technical support.",
          "Advanced: put P5.007 and P0.001 on two scope channels and save the scope capture when the alarm occurs.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-50, AL809; alarm list 11.1 p.11-9)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/sureservo2/ch1.pdf",
      "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf",
      "https://cdn.automationdirect.com/static/manuals/sureservo2/ch4.pdf",
      "https://cdn.automationdirect.com/static/manuals/sureservo2/ch8.pdf",
      "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf",
      "https://cdn.automationdirect.com/static/manuals/sureservo2/appxa.pdf"
    ]
  }
];
