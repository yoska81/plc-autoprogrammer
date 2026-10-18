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
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-11"
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS20/GS20X 230 V class (200-240 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "170-265 VAC (GS20X: 170-264 VAC)",
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-12 to 1-14, 1-18, 1-19"
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS20/GS20X 460 V class 3-phase (380-480 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "323-528 VAC",
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-15, 1-16, 1-20"
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS20 575 V class 3-phase (500-600 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "425-660 VAC",
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-17"
      },
      {
        "terminals": "Keypad user display U (P00.04 = 3, default: DC bus voltage)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "DC bus above the low-voltage level P06.00 (180 VDC 120/230 V class, 360 VDC 460 V, 450 VDC 575 V) and below the over-voltage trip level (410 VDC 120/230 V, 820 VDC 460 V, 1116 VDC 575 V)",
        "note": "Lv/ov levels from https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf Fault Codes table (LvA-LvS and ovA-ovS entries); P00.04 setting 3 = DC Bus Voltage, P06.34 = DC bus voltage at malfunction (https://cdn.automationdirect.com/static/manuals/gs20m/ch4.pdf p.4-31)"
      },
      {
        "terminals": "+24V to DCM",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC ±10% (21.6-26.4 VDC), 100 mA max",
        "note": "Control terminal specifications, https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31"
      },
      {
        "terminals": "DI1-DI7 input (e.g. FWD (DI1)) to DCM, Source mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": ">= 11 VDC (activation current 3.3 mA)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31; DCM is the digital control common"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Source mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "<= 5 VDC (cut-off voltage)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Sink mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": "<= 13 VDC (activation current 3.3 mA)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Sink mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": ">= 19 VDC (cut-off voltage)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-31"
      },
      {
        "terminals": "+10V to ACM",
        "state": "powered",
        "meter": "VDC",
        "expected": "10.5 ±0.5 VDC (10.0-11.0 VDC), 20 mA max (potentiometer supply)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-32"
      },
      {
        "terminals": "AI1 to ACM",
        "state": "voltage-mode speed reference",
        "meter": "VDC",
        "expected": "0-10 VDC = 0 to maximum output frequency (P01.00)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-32"
      },
      {
        "terminals": "STO1 to SCM and STO2 to SCM",
        "state": "run permitted (STO cut-off mode; default STO1/STO2 jumpered to +24V)",
        "meter": "VDC",
        "expected": "11-30 VDC on both channels (rated 24 VDC ±10%, 6.67 mA)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-33"
      },
      {
        "terminals": "STO1 to SCM or STO2 to SCM",
        "state": "safe torque off active",
        "meter": "VDC",
        "expected": "0-5 VDC on either channel; drive output stops within 20 ms",
        "note": "https://cdn.automationdirect.com/static/manuals/gs20m/ch2.pdf p.2-33"
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
        "meaning": "Drive tripped on that fault; see the Fault Codes table (ch6). STOP/RESET resets after the cause is cleared; faults that cannot be reset by RESET are listed in the fault records (MENU)."
      }
    ],
    "faults": [
      {
        "code": "ocA",
        "title": "Over-current during acceleration",
        "symptom": "Drive trips; keypad shows ocA, fault ID 1 in the fault record.",
        "causes": [
          "Output current exceeds three times of the rated current during acceleration. When ocA occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocA error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 1 = ocA.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check acceleration time. If too short: a) Increase the acceleration time b) Increase the acceleration time of S-curve c) Set auto-acceleration and auto-deceleration parameter (P01.44) d) Set over-current stall prevention function (P06.03) e) Replace the drive with a larger capacity model.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check if the output current during the whole working process exceeds the AC motor drive’s rated current. If yes, replace the AC motor drive with a larger capacity model.",
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
          "In the case of hardware failure, the ocA occurs due to the short circuit or ground fault at the output side of the drive. a) Check for possible short circuits between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "Output current exceeds three times of the rated current during deceleration. When ocd occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocd error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 2 = ocd.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the deceleration time is too short. If so: a) Increase the deceleration time b) Increase the deceleration time of S-curve c) Set auto-acceleration and auto-deceleration parameter (P01.44) d) Set over-current stall prevention function (P06.03) e) Replace the drive with a larger capacity model",
          "Check if the mechanical brake of the motor activates too early.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check if the output current during the whole working process exceeds the AC motor drive’s rated current. If yes, replace the AC motor drive with a larger capacity model.",
          "Check the impulsive change of the load and reduce the load or increase the capacity of AC motor drive as needed.",
          "Verify the motor capacity, the rated current on the motor’s nameplate should ≤ the rated current of the drive.",
          "If using an ON/OFF controller at the (U/V/W) drive output, check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it is too long, increase the AC motor drive’s capacity or install AC reactor(s) on the output side (U/V/W).",
          "In the case of a hardware error, the ocd occurs due to the short circuit or ground fault at the output side of the drive. a) Check for possible short circuits between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuits occurs, contact AutomationDirect Technical Support.",
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
          "Output current exceeds three times of the rated current during constant speed. When ocn occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocn error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 3 = ocn.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for possible shaft lock, burnout or aging insulation of the motor. a) Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check for impulsive change of the load, and reduce the load or increase the capacity of AC motor drive.",
          "Check motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive)",
          "If using an ON/OFF controller at the drive output, check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "In the case of hardware failure, the ocn may occur due to a short circuit or ground fault at the output side of the drive. a) Check for possible short circuit between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V, and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuits occurs, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-27, ocn ID 3)"
      },
      {
        "code": "GFF",
        "title": "Ground fault",
        "symptom": "Drive trips; keypad shows GFF, fault ID 4 in the fault record.",
        "causes": [
          "When the drive detects grounding short circuit on the output terminals (U/V/W), the drive closes the gate of the output immediately, the motor runs freely, and the display shows a GFF error."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 4 = GFF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for motor burnout or aging insulation. a) Check the motor insulation value with megger. b) Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the cable for short circuits and replace the cable if needed.",
          "If the motor cable length exceeds 100 m, decrease the setting value for the carrier frequency and take remedies to reduce stray capacitance.",
          "Verify the grounding and wiring of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Over-current or hardware failure in current detection at stop. Cycle the power after ocS occurs. If the hardware failure occurs, the display shows cd1, cd2 or cd3.",
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
          "DC bus over-voltage during acceleration. When ovA occurs, the drive closes the gate of the output, the motor runs freely, and the display shows an ovA error.",
          "Trip condition (Action Level): 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 7 = ovA.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Check acceleration. If too slow: a) Decrease the acceleration time b) Use a braking unit or DC bus c) Replace the drive with a larger capacity model.",
          "Check the setting for stall prevention level. If the value is lower than no-load current, adjust it to be higher than no-load current.",
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "Check for regenerative voltage of motor inertia. If regenerative voltage is being generated: a) Use over-voltage stall prevention function (P06.01) b) Use auto-acceleration and auto-deceleration setting (P01.44) c) Use a braking unit or DC bus",
          "Check if the over-voltage Fault occurs after acceleration stops, which indicates acceleration time is too short. Do the following: a) Increase the acceleration time b) Set P06.01 over-voltage stall prevention c) Increase the setting value for P01.25 S-curve acceleration arrival time 2",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is a ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "DC bus over-voltage during deceleration. When ovd occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ovd error.",
          "Trip condition (Action Level): 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 8 = ovd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Deceleration time may be too short, resulting in too much regenerative energy. a) Increase the setting value of P01.13, P01.15, P01.17 and P01.19 (deceleration time) b) Connect a braking resistor, braking unit or DC bus on the drive. c) Reduce the braking frequency. d) Replace the drive with a larger capacity model. e) Use S-curve acceleration/deceleration. f) Use over-voltage stall prevention (P06.01). g) Use auto-acceleration and auto-deceleration (P01.44). h) Adjust the braking level (P07.01 or the bolt position of the braking unit).",
          "Verify that the setting for stall prevention level is larger than no-load current",
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "DC bus over-voltage at constant speed. When ovn occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ovn error.",
          "Trip condition (Action Level): 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 9 = ovn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Check for impulsive change of the load, then do the following: a) Connect a brake resistor, braking unit or DC bus to the drive. b) Reduce the load. c) Replace the drive with a larger capacity model. d) Adjust the braking level (P07.01 or bolt position of the brake unit).",
          "Verify the stall prevention level setting is higher than no-load current.",
          "Check for regenerative voltage, then enable over-voltage stall prevention function (P06.01) or use a braking unit or DC bus",
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "Trip condition (Action Level): 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 10 = ovS.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC 575V series: 1116VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "Trip condition (Action Level): P06.00 (120V/230V series = 180VDC 460V series = 360VDC 575V series = 450VDC); action time: Immediately act when the DC bus voltage is lower than P06.00"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 11 = LvA.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 (120V/230V series = 180VDC 460V series = 360VDC 575V series = 450VDC)."
        ],
        "fix": [
          "Improve power supply condition.",
          "Adjust voltage to the power range of the drive",
          "Check the power system and increase the capacity of power equipment if needed.",
          "The load may be too heavy. If so: a) Reduce the load. b) Increase the drive capacity. c) Increase the acceleration time.",
          "Check the DC bus and install DC reactor(s).",
          "Check for a short circuit plate or DC reactor installed between terminal +1 and +2. Connect short circuit plate or DC reactor between terminal +1 and +2.",
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
          "Trip condition (Action Level): P06.00 (120V/230V series = 180VDC 460V series = 360VDC 575V series = 450VDC); action time: Immediately act when the DC bus voltage is lower than P06.00"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 12 = Lvd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 (120V/230V series = 180VDC 460V series = 360VDC 575V series = 450VDC)."
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
          "Trip condition (Action Level): P06.00 (120V/230V series = 180VDC 460V series = 360VDC 575V series = 450VDC); action time: Immediately act when the DC bus voltage is lower than P06.00"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 13 = Lvn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 (120V/230V series = 180VDC 460V series = 360VDC 575V series = 450VDC)."
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
          "Trip condition (Action Level): P06.00 (120V/230V series = 180VDC 460V series = 360VDC 575V series = 450VDC); action time: Immediately act when the DC bus voltage is lower than P06.00"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 14 = LvS.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: P06.00 (120V/230V series = 180VDC 460V series = 360VDC 575V series = 450VDC)."
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
          "Trip condition (Action Level): When DC bus ripple is higher than the protection level, and the output current exceeds 50% of the rated current, the drive starts counting. When the counting value reaches the upper limit, an orP error occurs.; action time: The action time varies with different output current."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 15 = orP.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: When DC bus ripple is higher than the protection level, and the output current exceeds 50% of the rated current, the drive starts counting. When the counting value reaches the upper limit, an orP error occurs.."
        ],
        "fix": [
          "Verify the wiring of the main circuit power is installed correctly.",
          "Check that a single-phase power supply is not being used with a three-phase model. Choose the model whose power matches the voltage.",
          "Power voltage changes can trigger this fault. If the main circuit power works normally, verify the main circuit. Cycle the power after checking the power, if orP error still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): Depending on the model power, model default of P06.15 +5°C. When the setting for P06.15 is higher than the oH1 level, oH1 error occurs instead of oH1 warning. An IGBT overheating error occurs, and the drive stops.; action time: Immediately when limit is reached."
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
          "Trip condition (Action Level): NTC broken or wiring failure; action time: When the IGBT temperature is higher than the protection level, and detection time exceeds 100 ms, the tH1o protection activates."
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
          "The AC motor drive detects excessive drive output current. Overload capacity: • Variable Torque (VT): Sustains for one minute when the drive outputs 120% of the drive’s rated output current. Sustains for three seconds when the drive outputs 150% of the drive’s rated output current. • Constant Torque (CT): Sustains for one minute when the drive outputs 150% of the drive’s rated output current. Sustains for three seconds when the drive outputs 200% of the drive’s rated output current.",
          "Trip condition (Action Level): Based on overload curve and derating curve.; action time: When the load is higher than the protection level and exceeds allowable time, the oL protection activates."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 21 = oL.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
          "Replace the drive with a larger capacity model.",
          "If the oL only occurs during low-speed operations: a) Reduce the load during low-speed operation. b) Increase the drive capacity. c) Decrease the carrier frequency of P00.17.",
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
          "Trip condition (Action Level): Start counting when the output current > 150% of the motor 1 rated current; action time: P06.14 (If the output current is larger than 105% of the motor 1 rated current again within 60 sec., the counting time reduces and is less than P06.14)"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 22 = EoL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "Trip condition (Action Level): Start counting when the output current > 150% of the motor 2 rated current PTC input value > P06.30 setting (Default = 50%) PT100 RTD input value > P06.57 setting (default = 7V); action time: P06.28 (If the output current is larger than 105% of the motor 2 rated current again within 60 sec., the counting time reduces and is less than P06.28) Immediately act Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 23 = EoL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.35–P01.42 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "Verify ambient temperature and change the installation location if there are heating devices in the surroundings, or install/add cooling fan or air conditioner to lower the ambient temperature.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Verify duration of low speed operation. a) Decrease low-speed operation time. b) Change to dedicated motor for the drive. c) Increase the motor capacity.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Verify V/F voltage and adjust settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection between PTC thermistor and the heat protection.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Verify ambient temperature and change the installation location if there are heating devices in the surroundings, or install/add cooling fan or air conditioner to lower the ambient temperature.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Verify duration of low speed operation. a) Decrease low-speed operation time. b) Change to dedicated motor for the drive. c) Increase the motor capacity.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Verify V/F voltage and adjust settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection of PT100 RTD.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Fault setting parameter: N/A P06.29 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning P06.29 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset When P06.29=0, oH3 is a “Warning”. The “Warning” is automatically cleared. When P06.29=1 or 2, oH3 is a “Fault”. You must reset manually. When P06.29=0 and the temperature < P06.56, oH3 is automatically cleared. When P06.29=1 or 2, oH3 is a “Fault”. You must reset manually.; Reset in five seconds after the fault is cleared Immediately reset Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, EoL2 ID 23)"
      },
      {
        "code": "ot1",
        "title": "Over torque 1",
        "symptom": "Drive trips; keypad shows ot1, fault ID 26 in the fault record.",
        "causes": [
          "When the output current exceeds the over-torque detection level (P06.07) and exceeds over-torque detection time (P06.08), and when P06.06 or P06.09 is set to 2 or 4, the ot1 error displays.",
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
          "Adjust the V/F curve (Motor 1, P01.01–P01.08), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed).",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Very speed tracking settings and correct the parameter settings as needed. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P06.06 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P06.06=1 or 3, ot1 is a “Warning”. The warning is automatically cleared when the output current < (Pr.06-07 – 5%) When P06.06=2 or 4, ot1 is a “Fault”. You must reset manually.; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-35, ot1 ID 26)"
      },
      {
        "code": "ot2",
        "title": "Over torque 2",
        "symptom": "Drive trips; keypad shows ot2, fault ID 27 in the fault record.",
        "causes": [
          "When the output current exceeds the over-torque detection level (P06.10) and exceeds over-torque detection time (P06.11), and when P06.09 is set to 2 or 4, the ot2 error displays.",
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
          "Adjust the V/F curve (Motor 1, P01.35–P01.42), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed).",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Very speed tracking settings and correct the parameter settings as needed. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P06.09 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P06.09=1 or 3, ot2 is a “Warning”. The warning is automatically cleared when the output current < (P06.10 – 5%). When P06.09=2 or 4, ot2 is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P06.73 setting is: 0: No function 1: Fault and coast to stop 2: Fault and ramp to stop by the 2nd deceleration time 3: Warn and continue operation",
          "Reset: When P06.73=3, uC is a “Warning”. The warning is automatically cleared when the output current > (P06.71+0.1A). When P06.73=1 or 2, uC is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P08.09 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: Warn and operate at last frequency",
          "Reset: When P08.09=3 or 4, AFE is a “Warning”. When the feedback signal is > 4 mA, the ”Warning” is automatically cleared. When P08.09=1 or 2, AFE is a “Fault”. You must reset manually.; Immediately reset."
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
          "Under PG mode, when the motor frequency exceeds the encoder observer stall level (P10.10) and starts to count, the fault time is longer than the detection time of encoder observer stall (P10.11), then PGF3 fault occurs.",
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
          "Under PG mode, when the motor frequency exceeds encoder observer slip range (P10.13) and starts to count, the fault time is longer than the detection time of encoder observer slip (P10.14), PGF4 fault occurs.",
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
          "Reset: Auto: When P10.15=0, PGF4 is a “Warning”. When the deviation between the output frequency and motor frequency is smaller than the encoder observer slip range, the warning is automatically cleared. Manual: When P10.15=1 or 2, PGF4 is a “Fault” and you must reset manaully.; Immediately reset."
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
          "Fault setting parameter: P03.19 setting is: 0: Disable 1: Continue operation at the last frequency (warning, ANL is displayed on the keypad) 2: Decelerate to stop (warning, ANL is displayed on the keypad) 3: Stop immediately and display ACE",
          "Reset: When P03.19=1 or 2, ACE is a “Warning”. When analog input signal is > 4 mA, the warning is automatically cleared. When P03.19=3, ACE is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P07.20 setting is: 0: Coast to stop 1: Stop by the 1st deceleration time 2: Stop by the 2nd deceleration time 3: Stop by the 3rd deceleration time 4: Stop by the 4th deceleration time 5: System deceleration 6: Automatic deceleration (P01.46)",
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
          "If you forget the password, do the following steps: a) Step 1: Input 9999 and press ENTER. b) Step 2: Repeat step 1. Input 9999 and press ENTER. (You need to finish step 1 and step 2 within 10 seconds. If you don’t finish the two steps in 10 seconds, try again.)",
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
          "Verify the wiring and grounding of the communication circuit. It is recommended to separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Fault setting parameter: P09.02 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning, no fault, and continue operation",
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
          "Trip condition (Action Level): 1) ydc occurs when the confirmation signals of Y-connection and Δ-connection are conducted at the same time. 2) If any of confirmation signals is not conducted within P05.25, ydc occurs.; action time: P05.25"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 61 = ydc."
        ],
        "fix": [
          "Check if the electromagnetic valve works normally during switch. If not, replace it.",
          "Check if related parameters are all set up and set correctly.",
          "Check the wiring of the Y-Δ switch function.",
          "Reset: Manual reset; Can be reset only when the confirmation signal of Y-connection is conducted if it is Y-connection, or when the confirmation signal of Δ-connection is conducted if it is Δ-connection.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-41, ydc ID 61)"
      },
      {
        "code": "dEb",
        "title": "Deceleration energy backup error",
        "symptom": "Drive trips; keypad shows dEb, fault ID 62 in the fault record.",
        "causes": [
          "When P07.13 is not 0, and the power is suddenly off, causing the DC bus voltage lower than the dEb action level, the dEb function acts and the motor ramps to stop. Then dEb displays on the keypad.",
          "Trip condition (Action Level): When P07.13 is not 0, and the DC bus voltage is lower than the level of dEb.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 62 = dEb.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: When P07.13 is not 0, and the DC bus voltage is lower than the level of dEb.."
        ],
        "fix": [
          "Check that the power system is not unstable or off.",
          "If another large load operates in the same power system: a) Replace power system with a larger capacity model. b) Ensure the large load system is on a different power system.",
          "Reset: When P07.13=2 (dEb with auto-acceleration / auto-deceleration, the drive outputs the frequency after the power is restored): dEb is automatically cleared. When P07.13=1 (dEb with auto-acceleration / auto-deceleration, the drive does not output the frequency after the power is restored): The drive stops when dEb acts and the rotation speed becomes 0 Hz, then the drive can be reset manually.; Auto: The fault is automatically cleared. Manual: When the drive decelerates to 0 Hz.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, dEb ID 62)"
      },
      {
        "code": "oSL",
        "title": "Over slip error",
        "symptom": "Drive trips; keypad shows oSL, fault ID 63 in the fault record.",
        "causes": [
          "On the basis of the maximum slip limit set via P10.29, the speed deviation is abnormal. When the motor drive outputs at constant speed, F>H or F<H exceeds the level set via P07.29, and it exceeds the time set via P07.30, oSL shows. oSL occurs in induction motors only.",
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
          "Reset: P07.31=0 is a warning. When the motor drive outputs at constant speed, and F>H or F<H does not exceed the level set via P07.29 anymore, oSL warning will be cleared automatically. When P07.31=1 or 2, oSL is an error, and it needs to reset manually.; Immediately reset."
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
          "Verify the STO1 and SCM1 short circuit lines are connected. Re- connect the short circuit line if needed. Ensure all wiring is correct.",
          "Verify the connections at the drive control terminals.",
          "If issue still persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-42, SrL1 ID 72)"
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
          "Reset: When P06.44=1 and after STo error is cleared, it automatically resets. When P06.44=0 and after STo error is cleared, reset it manually.; Reset only after STo error is cleared.."
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
          "Verify the STO2 and SCM2 short circuit lines are connected. Re- connect the short circuit line if needed. Ensure all wiring is correct.",
          "Verify the connections at the drive control terminals.",
          "If the issue persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, SrL2 ID 77)"
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
          "Verify the STO1 and SCM1 or STO2 and SCM2 short circuit lines are connected. Re-connect the short circuit line if needed. Ensure all wiring is correct.",
          "Verify the connections at the drive control terminals.",
          "If the issue persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-43, SrL3 ID 78)"
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
          "The Aoc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "The boc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "The coc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 82 = oPL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL1 fault still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 83 = oPL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL2 fault still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 84 = oPL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL3 fault still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P09.31=-1 – -10 (there is no -9), when the internal communication between Slave and Master is abnormal, ictE fault occurs.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 111 = ictE."
        ],
        "fix": [
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "When the output current exceeds the over-torque detection level (P14.75) and exceeds over-torque detection time (P14.76), and when P14.74 is set to 2 or 4, the ot3 error displays.",
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
          "Verify V/F voltage and adjust the V/F curve (Motor 3, P01.54–P01.61), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Replace motor with a larger capacity motor.",
          "Check for overload during low-speed operation and decrease the loading during low-speed operation or increase the motor capacity.",
          "Verify torque compensation and adjust P07.73 torque compensation gain until the output current decreases and the motor does not stall.",
          "Correct the parameter settings for speed tracking. Start the speed tracking function. Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P14.74 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P14.74=1 or 3, ot3 is a “Warning”. The warning is automatically cleared when the output current < P14.75. When P14.74=2 or 4, ot3 is a “Fault”. You must reset manually.; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-48, ot3 ID 128)"
      },
      {
        "code": "ot4",
        "title": "Over-torque 4",
        "symptom": "Drive trips; keypad shows ot4, fault ID 129 in the fault record.",
        "causes": [
          "When the output current exceeds the over-torque detection level (P14.78) and exceeds over-torque detection time (P14.79), and when P14.77 is set to 2 or 4, the ot4 error displays.",
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
          "Verify V/F voltage and adjust the V/F curve (Motor 3, P01.63–P01.70), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Replace motor with a larger capacity motor.",
          "Check for overload during low-speed operation and decrease the loading during low-speed operation or increase the motor capacity.",
          "Verify torque compensation and adjust P07.75 torque compensation gain until the output current decreases and the motor does not stall.",
          "Correct the parameter settings for speed tracking. Start the speed tracking function. Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P14.77 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P14.77=1 or 3, ot3 is a “Warning”. The warning is automatically cleared when the output current < P14.75. When P14.77=2 or 4, ot3 is a “Fault”. You must reset manually.; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs20m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-48, ot4 ID 129)"
      },
      {
        "code": "EoL3",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows EoL3, fault ID 134 in the fault record.",
        "causes": [
          "Electronic thermal relay 3 protection. The drive coasts to stop once it activates.",
          "Trip condition (Action Level): Start counting when output current > 150% of the motor 3 rated current.; action time: P14.81 (If the output current is larger than 105% of the motor 3 rated current again within 60 sec., the counting time reduces and is less than P14.81)"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 134 = EoL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.54–P01.61 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "Trip condition (Action Level): Start counting when the output current > 150% of the motor 4 rated current.; action time: P14.83 (If the output current is larger than 105% of motor 4 rated current again within 60 sec., the counting time reduces and is less than P14.83)"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 135 = EoL4.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.62–P01.70 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "If an electromagnetic contactor is used as an open state on the output side of the drive (U/V/W), verify that the three phases of the electromagnetic valve are all closed.",
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
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-11"
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS10 230 V class 1-/3-phase (200-240 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "170-265 VAC",
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-12 to 1-14"
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS10 460 V class 3-phase (380-480 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "323-528 VAC",
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-15, 1-16"
      },
      {
        "terminals": "Keypad user display U (P00.04 = 3, default: DC bus voltage)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "DC bus above the low-voltage level P06.00 (180 VDC 120/230 V class, 360 VDC 460 V) and below the over-voltage trip level (410 VDC 120/230 V, 820 VDC 460 V)",
        "note": "Lv/ov levels from https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf Fault Codes table (LvA-LvS and ovA-ovS entries); P00.04 setting 3 = DC Bus Voltage, P06.34 = DC bus voltage at malfunction (https://cdn.automationdirect.com/static/manuals/gs10m/ch4.pdf p.4-27)"
      },
      {
        "terminals": "+24V to DCM",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC ±10% (21.6-26.4 VDC), 100 mA max",
        "note": "Control terminal specifications, https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23"
      },
      {
        "terminals": "DI1-DI5 input (e.g. FWD (DI1)) to DCM, Source mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": ">= 11 VDC (activation current 3.3 mA)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23; DCM is the digital control common"
      },
      {
        "terminals": "DI1-DI5 input to DCM, Source mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "<= 5 VDC (cut-off voltage)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23"
      },
      {
        "terminals": "DI1-DI5 input to DCM, Sink mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": "<= 13 VDC (activation current 3.3 mA)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23"
      },
      {
        "terminals": "DI1-DI5 input to DCM, Sink mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": ">= 19 VDC (cut-off voltage)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23"
      },
      {
        "terminals": "+10V to ACM",
        "state": "powered",
        "meter": "VDC",
        "expected": "10.5 ±0.5 VDC (10.0-11.0 VDC), 20 mA max (potentiometer supply)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23/2-24"
      },
      {
        "terminals": "AI (AI-V voltage mode) to ACM",
        "state": "voltage-mode speed reference",
        "meter": "VDC",
        "expected": "0-10 VDC = 0 to maximum output frequency (P01.00)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs10m/ch2.pdf p.2-23/2-24"
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
        "meaning": "Drive tripped on that fault; see the Fault Codes table (ch6). STOP/RESET resets after the cause is cleared; faults that cannot be reset by RESET are listed in the fault records (MENU)."
      }
    ],
    "faults": [
      {
        "code": "ocA",
        "title": "Over-current during acceleration",
        "symptom": "Drive trips; keypad shows ocA, fault ID 1 in the fault record.",
        "causes": [
          "Output current exceeds three times of the rated current during acceleration. When ocA occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocA error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 1 = ocA.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check acceleration time. If too short: a) Increase the acceleration time b) Increase the acceleration time of S-curve c) Set auto-acceleration and auto-deceleration parameter (P01.44) d) Set over-current stall prevention function (P06.03) e) Replace the drive with a larger capacity model.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check if the output current during the whole working process exceeds the AC motor drive’s rated current. If yes, replace the AC motor drive with a larger capacity model.",
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
          "In the case of hardware failure, the ocA occurs due to the short circuit or ground fault at the output side of the drive. a) Check for possible short circuits between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "Output current exceeds three times of the rated current during deceleration. When ocd occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocd error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 2 = ocd.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the deceleration time is too short. If so: a) Increase the deceleration time b) Increase the deceleration time of S-curve c) Set auto-acceleration and auto-deceleration parameter (P01.44) d) Set over-current stall prevention function (P06.03) e) Replace the drive with a larger capacity model",
          "Check if the mechanical brake of the motor activates too early.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check if the output current during the whole working process exceeds the AC motor drive’s rated current. If yes, replace the AC motor drive with a larger capacity model.",
          "Check the impulsive change of the load and reduce the load or increase the capacity of AC motor drive as needed.",
          "Verify the motor capacity, the rated current on the motor’s nameplate should ≤ the rated current of the drive.",
          "If using an ON/OFF controller at the (U/V/W) drive output, check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it is too long, increase the AC motor drive’s capacity or install AC reactor(s) on the output side (U/V/W).",
          "In the case of a hardware error, the ocd occurs due to the short circuit or ground fault at the output side of the drive. a) Check for possible short circuits between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuits occurs, contact AutomationDirect Technical Support.",
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
          "Output current exceeds three times of the rated current during constant speed. When ocn occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocn error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 3 = ocn.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for possible shaft lock, burnout or aging insulation of the motor. a) Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check for impulsive change of the load, and reduce the load or increase the capacity of AC motor drive.",
          "Check motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive)",
          "If using an ON/OFF controller at the drive output, check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "In the case of hardware failure, the ocn may occur due to a short circuit or ground fault at the output side of the drive. a) Check for possible short circuit between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V, and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuits occurs, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-19, ocn ID 3)"
      },
      {
        "code": "GFF",
        "title": "Ground fault",
        "symptom": "Drive trips; keypad shows GFF, fault ID 4 in the fault record.",
        "causes": [
          "When the drive detects grounding short circuit on the output terminals (U/V/W), the drive closes the gate of the output immediately, the motor runs freely, and the display shows a GFF error."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 4 = GFF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for motor burnout or aging insulation. a) Check the motor insulation value with megger. b) Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the cable for short circuits and replace the cable if needed.",
          "If the motor cable length exceeds 100 m, decrease the setting value for the carrier frequency and take remedies to reduce stray capacitance.",
          "Verify the grounding and wiring of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Over-current or hardware failure in current detection at stop. Cycle the power after ocS occurs. If the hardware failure occurs, the display shows cd1, cd2 or cd3.",
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
          "DC bus over-voltage during acceleration. When ovA occurs, the drive closes the gate of the output, the motor runs freely, and the display shows an ovA error.",
          "Trip condition (Action Level): 120V/230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 7 = ovA.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Check acceleration. If too slow: a) Decrease the acceleration time b) Use a braking unit or DC bus c) Replace the drive with a larger capacity model.",
          "Check the setting for stall prevention level. If the value is lower than no-load current, adjust it to be higher than no-load current.",
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "Check for regenerative voltage of motor inertia. If regenerative voltage is being generated: a) Use over-voltage stall prevention function (P06.01) b) Use auto-acceleration and auto-deceleration setting (P01.44) c) Use a braking unit or DC bus",
          "Check if the over-voltage Fault occurs after acceleration stops, which indicates acceleration time is too short. Do the following: a) Increase the acceleration time b) Set P06.01 over-voltage stall prevention c) Increase the setting value for P01.25 S-curve acceleration arrival time 2",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is a ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "DC bus over-voltage during deceleration. When ovd occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ovd error.",
          "Trip condition (Action Level): 120V/230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 8 = ovd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Deceleration time may be too short, resulting in too much regenerative energy. a) Increase the setting value of P01.13, P01.15, P01.17 and P01.19 (deceleration time) b) Connect a braking resistor, braking unit or DC bus on the drive. c) Reduce the braking frequency. d) Replace the drive with a larger capacity model. e) Use S-curve acceleration/deceleration. f) Use over-voltage stall prevention (P06.01). g) Use auto-acceleration and auto-deceleration (P01.44). h) Adjust the braking level (P07.01 or the bolt position of the braking unit).",
          "Verify that the setting for stall prevention level is larger than no-load current",
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "DC bus over-voltage at constant speed. When ovn occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ovn error.",
          "Trip condition (Action Level): 120V/230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 9 = ovn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Check for impulsive change of the load, then do the following: a) Connect a brake resistor, braking unit or DC bus to the drive. b) Reduce the load. c) Replace the drive with a larger capacity model. d) Adjust the braking level (P07.01 or bolt position of the brake unit).",
          "Verify the stall prevention level setting is higher than no-load current.",
          "Check for regenerative voltage, then enable over-voltage stall prevention function (P06.01) or use a braking unit or DC bus",
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "Trip condition (Action Level): 120V/230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 10 = ovS.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 120V/230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "Trip condition (Action Level): P06.00 (120V/230V series = 180VDC 460V series = 360VDC; action time: Immediately act when the DC bus voltage is lower than P06.00"
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
          "Check for a short circuit plate or DC reactor installed between terminal +1 and +2. Connect short circuit plate or DC reactor between terminal +1 and +2.",
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
          "Trip condition (Action Level): P06.00 (120V/230V series = 180VDC 460V series = 360VDC; action time: Immediately act when the DC bus voltage is lower than P06.00"
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
          "Trip condition (Action Level): P06.00 (120V/230V series = 180VDC 460V series = 360VDC; action time: Immediately act when the DC bus voltage is lower than P06.00"
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
          "Trip condition (Action Level): P06.00 (120V/230V series = 180VDC 460V series = 360VDC; action time: Immediately act when the DC bus voltage is lower than P06.00"
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
          "Trip condition (Action Level): When DC bus ripple is higher than the protection level, and the output current exceeds 50% of the rated current, the drive starts counting. When the counting value reaches the upper limit, an orP error occurs.; action time: The action time varies with different output current."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 15 = orP.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: When DC bus ripple is higher than the protection level, and the output current exceeds 50% of the rated current, the drive starts counting. When the counting value reaches the upper limit, an orP error occurs.."
        ],
        "fix": [
          "Verify the wiring of the main circuit power is installed correctly.",
          "Check that a single-phase power supply is not being used with a three-phase model. Choose the model whose power matches the voltage.",
          "Power voltage changes can trigger this fault. If the main circuit power works normally, verify the main circuit. Cycle the power after checking the power, if orP error still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): Depending on the model power, model default of P06.15 +5°C. When the setting for P06.15 is higher than the oH1 level, oH1 error occurs instead of oH1 warning. An IGBT overheating error occurs, and the drive stops.; action time: Immediately when limit is reached."
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
          "Trip condition (Action Level): NTC broken or wiring failure; action time: When the IGBT temperature is higher than the protection level, and detection time exceeds 100 ms, the tH1o protection activates."
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
          "The AC motor drive detects excessive drive output current. Overload capacity: • Variable Torque (VT): Sustains for one minute when the drive outputs 120% of the drive’s rated output current. Sustains for three seconds when the drive outputs 150% of the drive’s rated output current. • Constant Torque (CT): Sustains for one minute when the drive outputs 150% of the drive’s rated output current. Sustains for three seconds when the drive outputs 200% of the drive’s rated output current.",
          "Trip condition (Action Level): Based on overload curve and derating curve.; action time: When the load is higher than the protection level and exceeds allowable time, the oL protection activates."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 21 = oL.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
          "Replace the drive with a larger capacity model.",
          "If the oL only occurs during low-speed operations: a) Reduce the load during low-speed operation. b) Increase the drive capacity. c) Decrease the carrier frequency of P00.17.",
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
          "Trip condition (Action Level): Start counting when the output current > 150% of the motor 1 rated current; action time: P06.14 (If the output current is larger than 105% of the motor 1 rated current again within 60 sec., the counting time reduces and is less than P06.14)"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 22 = EoL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "Trip condition (Action Level): Start counting when the output current > 150% of the motor 2 rated current PTC input value > P06.30 setting (Default = 50%) PT100 RTD input value > P06.57 setting (default = 7V); action time: P06.28 (If the output current is larger than 105% of the motor 2 rated current again within 60 sec., the counting time reduces and is less than P06.28) Immediately act Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 23 = EoL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.35–P01.42 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "Verify ambient temperature and change the installation location if there are heating devices in the surroundings, or install/add cooling fan or air conditioner to lower the ambient temperature.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Verify duration of low speed operation. a) Decrease low-speed operation time. b) Change to dedicated motor for the drive. c) Increase the motor capacity.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Verify V/F voltage and adjust settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection between PTC thermistor and the heat protection.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Verify ambient temperature and change the installation location if there are heating devices in the surroundings, or install/add cooling fan or air conditioner to lower the ambient temperature.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Verify duration of low speed operation. a) Decrease low-speed operation time. b) Change to dedicated motor for the drive. c) Increase the motor capacity.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Verify V/F voltage and adjust settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection of PT100 RTD.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Fault setting parameter: N/A P06.29 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning P06.29 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset When P06.29=0, oH3 is a “Warning”. The “Warning” is automatically cleared. When P06.29=1 or 2, oH3 is a “Fault”. You must reset manually. When P06.29=0 and the temperature < P06.56, oH3 is automatically cleared. When P06.29=1 or 2, oH3 is a “Fault”. You must reset manually.; Reset in five seconds after the fault is cleared Immediately reset Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-25, EoL2 ID 23)"
      },
      {
        "code": "ot1",
        "title": "Over torque 1",
        "symptom": "Drive trips; keypad shows ot1, fault ID 26 in the fault record.",
        "causes": [
          "When the output current exceeds the over-torque detection level (P06.07) and exceeds over-torque detection time (P06.08), and when P06.06 or P06.09 is set to 2 or 4, the ot1 error displays.",
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
          "Adjust the V/F curve (Motor 1, P01.01–P01.08), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed).",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Very speed tracking settings and correct the parameter settings as needed. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P06.06 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P06.06=1 or 3, ot1 is a “Warning”. The warning is automatically cleared when the output current < (Pr.06-07 – 5%) When P06.06=2 or 4, ot1 is a “Fault”. You must reset manually.; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-27, ot1 ID 26)"
      },
      {
        "code": "ot2",
        "title": "Over torque 2",
        "symptom": "Drive trips; keypad shows ot2, fault ID 27 in the fault record.",
        "causes": [
          "When the output current exceeds the over-torque detection level (P06.10) and exceeds over-torque detection time (P06.11), and when P06.09 is set to 2 or 4, the ot2 error displays.",
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
          "Adjust the V/F curve (Motor 1, P01.35–P01.42), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed).",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Very speed tracking settings and correct the parameter settings as needed. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P06.09 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P06.09=1 or 3, ot2 is a “Warning”. The warning is automatically cleared when the output current < (P06.10 – 5%). When P06.09=2 or 4, ot2 is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P06.73 setting is: 0: No function 1: Fault and coast to stop 2: Fault and ramp to stop by the 2nd deceleration time 3: Warn and continue operation",
          "Reset: When P06.73=3, uC is a “Warning”. The warning is automatically cleared when the output current > (P06.71+0.1A). When P06.73=1 or 2, uC is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P08.09 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: Warn and operate at last frequency",
          "Reset: When P08.09=3 or 4, AFE is a “Warning”. When the feedback signal is > 4 mA, the ”Warning” is automatically cleared. When P08.09=1 or 2, AFE is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P03.19 setting is: 0: Disable 1: Continue operation at the last frequency (warning, ANL is displayed on the keypad) 2: Decelerate to stop (warning, ANL is displayed on the keypad) 3: Stop immediately and display ACE",
          "Reset: When P03.19=1 or 2, ACE is a “Warning”. When analog input signal is > 4 mA, the warning is automatically cleared. When P03.19=3, ACE is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P07.20 setting is: 0: Coast to stop 1: Stop by the 1st deceleration time 2: Stop by the 2nd deceleration time 3: Stop by the 3rd deceleration time 4: Stop by the 4th deceleration time 5: System deceleration 6: Automatic deceleration (P01.46)",
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
          "If you forget the password, do the following steps: a) Step 1: Input 9999 and press ENTER. b) Step 2: Repeat step 1. Input 9999 and press ENTER. (You need to finish step 1 and step 2 within 10 seconds. If you don’t finish the two steps in 10 seconds, try again.)",
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
          "Verify the wiring and grounding of the communication circuit. It is recommended to separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Fault setting parameter: P09.02 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning, no fault, and continue operation",
          "Reset: Manual reset; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-32, CE10 ID 58)"
      },
      {
        "code": "oSL",
        "title": "Over slip error",
        "symptom": "Drive trips; keypad shows oSL, fault ID 63 in the fault record.",
        "causes": [
          "On the basis of the maximum slip limit set via P10.29, the speed deviation is abnormal. When the motor drive outputs at constant speed, F>H or F<H exceeds the level set via P07.29, and it exceeds the time set via P07.30, oSL shows. oSL occurs in induction motors only.",
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
          "Reset: P07.31=0 is a warning. When the motor drive outputs at constant speed, and F>H or F<H does not exceed the level set via P07.29 anymore, oSL warning will be cleared automatically. When P07.31=1 or 2, oSL is an error, and it needs to reset manually.; Immediately reset."
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
          "Check if bypass pin jumper is correctly installed.",
          "If STO fault still exists after cycling the power, please contact ADC\"",
          "Reset: Auto: When P06.44=1 and after STO error is cleared, it automatically resets. Manual: When P06.44=0 and after STO error is cleared, reset it manually.; Reset only after STO error is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs10m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, Sto ID 76)"
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
          "The Aoc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "The boc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "The coc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 82 = oPL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL1 fault still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 83 = oPL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL2 fault still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 84 = oPL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL3 fault still exists, contact AutomationDirect Technical Support.",
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
          "If an electromagnetic contactor is used as an open state on the output side of the drive (U/V/W), verify that the three phases of the electromagnetic valve are all closed.",
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
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-14 to 1-17"
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, GS30 460 V class 3-phase (380-480 VAC -15%/+10%)",
        "meter": "VAC",
        "expected": "323-528 VAC",
        "note": "Operating voltage range from the model specification tables, ch1.pdf p.1-18 to 1-20"
      },
      {
        "terminals": "Keypad user display U (P00.04 = 3, default: DC bus voltage)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "DC bus above the low-voltage level P06.00 (180 VDC 230 V class, 360 VDC 460 V) and below the over-voltage trip level (410 VDC 230 V, 820 VDC 460 V)",
        "note": "Lv/ov levels from https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf Fault Codes table (LvA-LvS and ovA-ovS entries); P00.04 setting 3 = DC Bus Voltage, P06.34 = DC bus voltage at malfunction (https://cdn.automationdirect.com/static/manuals/gs30m/ch4.pdf p.4-33)"
      },
      {
        "terminals": "+24V to DCM",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC ±10% (21.6-26.4 VDC), 100 mA max",
        "note": "Control terminal specifications, https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30"
      },
      {
        "terminals": "DI1-DI7 input (e.g. FWD (DI1)) to DCM, Source mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": ">= 11 VDC (activation current 3.3 mA)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30; DCM is the digital control common"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Source mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "<= 5 VDC (cut-off voltage)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Sink mode",
        "state": "input ON (activated)",
        "meter": "VDC",
        "expected": "<= 13 VDC (activation current 3.3 mA)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30"
      },
      {
        "terminals": "DI1-DI7 input to DCM, Sink mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": ">= 19 VDC (cut-off voltage)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-30"
      },
      {
        "terminals": "+10V to ACM",
        "state": "powered",
        "meter": "VDC",
        "expected": "10.5 ±0.5 VDC (10.0-11.0 VDC), 20 mA max (potentiometer supply)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-31"
      },
      {
        "terminals": "AI1 to ACM",
        "state": "voltage-mode speed reference",
        "meter": "VDC",
        "expected": "0-10 VDC = 0 to maximum output frequency (P01.00)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-31"
      },
      {
        "terminals": "STO1 to SCM and STO2 to SCM",
        "state": "run permitted (STO cut-off mode; default STO1/STO2 jumpered to +24V)",
        "meter": "VDC",
        "expected": "11-30 VDC on both channels (rated 24 VDC ±10%, 6.67 mA)",
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-32"
      },
      {
        "terminals": "STO1 to SCM or STO2 to SCM",
        "state": "safe torque off active",
        "meter": "VDC",
        "expected": "0-5 VDC on either channel; drive output stops within 20 ms",
        "note": "https://cdn.automationdirect.com/static/manuals/gs30m/ch2.pdf p.2-32"
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
        "meaning": "Drive tripped on that fault; see the Fault Codes table (ch6). STOP/RESET resets after the cause is cleared; faults that cannot be reset by RESET are listed in the fault records (MENU)."
      }
    ],
    "faults": [
      {
        "code": "ocA",
        "title": "Over-current during acceleration",
        "symptom": "Drive trips; keypad shows ocA, fault ID 1 in the fault record.",
        "causes": [
          "Output current exceeds three times of the rated current during acceleration. When ocA occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocA error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 1 = ocA.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check acceleration time. If too short: a) Increase the acceleration time b) Increase the acceleration time of S-curve c) Set auto-acceleration and auto-deceleration parameter (P01.44) d) Set over-current stall prevention function (P06.03) e) Replace the drive with a larger capacity model.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check if the output current during the whole working process exceeds the AC motor drive’s rated current. If yes, replace the AC motor drive with a larger capacity model.",
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
          "In the case of hardware failure, the ocA occurs due to the short circuit or ground fault at the output side of the drive. a) Check for possible short circuits between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "Output current exceeds three times of the rated current during deceleration. When ocd occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocd error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 2 = ocd.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check if the deceleration time is too short. If so: a) Increase the deceleration time b) Increase the deceleration time of S-curve c) Set auto-acceleration and auto-deceleration parameter (P01.44) d) Set over-current stall prevention function (P06.03) e) Replace the drive with a larger capacity model",
          "Check if the mechanical brake of the motor activates too early.",
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check if the output current during the whole working process exceeds the AC motor drive’s rated current. If yes, replace the AC motor drive with a larger capacity model.",
          "Check the impulsive change of the load and reduce the load or increase the capacity of AC motor drive as needed.",
          "Verify the motor capacity, the rated current on the motor’s nameplate should ≤ the rated current of the drive.",
          "If using an ON/OFF controller at the (U/V/W) drive output, check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust the P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If it is too long, increase the AC motor drive’s capacity or install AC reactor(s) on the output side (U/V/W).",
          "In the case of a hardware error, the ocd occurs due to the short circuit or ground fault at the output side of the drive. a) Check for possible short circuits between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuits occurs, contact AutomationDirect Technical Support.",
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
          "Output current exceeds three times of the rated current during constant speed. When ocn occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ocn error.",
          "Trip condition (Action Level): 300% of the rated current; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 3 = ocn.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for possible shaft lock, burnout or aging insulation of the motor. a) Check the motor insulation value with megger. Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the motor cable and remove causes of any short circuits, or replace the cable before turning on the power.",
          "Check for impulsive change of the load, and reduce the load or increase the capacity of AC motor drive.",
          "Check motor capacity (the rated current on the motor’s nameplate should ≤ the rated current of the drive)",
          "If using an ON/OFF controller at the drive output, check the action timing of the contactor and make sure it is not turned ON/OFF when the drive outputs the voltage.",
          "Adjust the V/F curve settings and frequency/voltage. When the fault occurs, and the frequency voltage is too high, reduce the voltage.",
          "Adjust P07.26 torque compensation gain until the output current reduces and the motor does not stall.",
          "Verify the wiring of the control circuit and the wiring/grounding of the main circuit to prevent interference.",
          "Check the length of the motor cable. If too long: a) Increase the AC motor drive’s capacity. b) Install AC reactor(s) on the output side (U/V/W).",
          "In the case of hardware failure, the ocn may occur due to a short circuit or ground fault at the output side of the drive. a) Check for possible short circuit between terminals with the electric meter: b) B1 corresponds to U, V and W; DC- corresponds to U, V, and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. c) If short circuits occurs, contact AutomationDirect Technical Support.",
          "Reset: Manual reset; Reset in five seconds after the fault is cleared."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-28, ocn ID 3)"
      },
      {
        "code": "GFF",
        "title": "Ground fault",
        "symptom": "Drive trips; keypad shows GFF, fault ID 4 in the fault record.",
        "causes": [
          "When the drive detects grounding short circuit on the output terminals (U/V/W), the drive closes the gate of the output immediately, the motor runs freely, and the display shows a GFF error."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 4 = GFF.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction).",
          "Check for motor burnout or aging insulation. a) Check the motor insulation value with megger. b) Replace the motor if the insulation is poor."
        ],
        "fix": [
          "Check the cable for short circuits and replace the cable if needed.",
          "If the motor cable length exceeds 100 m, decrease the setting value for the carrier frequency and take remedies to reduce stray capacitance.",
          "Verify the grounding and wiring of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Over-current or hardware failure in current detection at stop. Cycle the power after ocS occurs. If the hardware failure occurs, the display shows cd1, cd2 or cd3.",
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
          "DC bus over-voltage during acceleration. When ovA occurs, the drive closes the gate of the output, the motor runs freely, and the display shows an ovA error.",
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
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "Check for regenerative voltage of motor inertia. If regenerative voltage is being generated: a) Use over-voltage stall prevention function (P06.01) b) Use auto-acceleration and auto-deceleration setting (P01.44) c) Use a braking unit or DC bus",
          "Check if the over-voltage Fault occurs after acceleration stops, which indicates acceleration time is too short. Do the following: a) Increase the acceleration time b) Set P06.01 over-voltage stall prevention c) Increase the setting value for P01.25 S-curve acceleration arrival time 2",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is a ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "DC bus over-voltage during deceleration. When ovd occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ovd error.",
          "Trip condition (Action Level): 230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 8 = ovd.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Deceleration time may be too short, resulting in too much regenerative energy. a) Increase the setting value of P01.13, P01.15, P01.17 and P01.19 (deceleration time) b) Connect a braking resistor, braking unit or DC bus on the drive. c) Reduce the braking frequency. d) Replace the drive with a larger capacity model. e) Use S-curve acceleration/deceleration. f) Use over-voltage stall prevention (P06.01). g) Use auto-acceleration and auto-deceleration (P01.44). h) Adjust the braking level (P07.01 or the bolt position of the braking unit).",
          "Verify that the setting for stall prevention level is larger than no-load current",
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "DC bus over-voltage at constant speed. When ovn occurs, the drive closes the gate of the output immediately, the motor runs freely, and the display shows an ovn error.",
          "Trip condition (Action Level): 230V series: 410VDC 460V series: 820VDC; action time: Immediately act when the DC bus voltage is higher than the level"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 9 = ovn.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: 230V series: 410VDC 460V series: 820VDC.",
          "Check if the input voltage is within the rated AC motor drive input voltage range, and check for possible voltage spikes."
        ],
        "fix": [
          "Check for impulsive change of the load, then do the following: a) Connect a brake resistor, braking unit or DC bus to the drive. b) Reduce the load. c) Replace the drive with a larger capacity model. d) Adjust the braking level (P07.01 or bolt position of the brake unit).",
          "Verify the stall prevention level setting is higher than no-load current.",
          "Check for regenerative voltage, then enable over-voltage stall prevention function (P06.01) or use a braking unit or DC bus",
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "If the phase-in capacitor or active power supply unit acts in the same power system, the input voltage may surge abnormally in a short time. In this case, install an AC reactor.",
          "The ground short circuit current charges the capacitor in the main circuit through the power. Check if there is ground fault on the motor cable, wiring box, or its internal terminals.",
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
          "Trip condition (Action Level): P06.00 230V series = 180VDC 460V series = 360VDC; action time: Immediately act when the DC bus voltage is lower than P06.00"
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
          "Check for a short circuit plate or DC reactor installed between terminal +1 and +2. Connect short circuit plate or DC reactor between terminal +1 and +2.",
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
          "Trip condition (Action Level): P06.00 230V series = 180VDC 460V series = 360VDC; action time: Immediately act when the DC bus voltage is lower than P06.00"
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
          "Trip condition (Action Level): P06.00 230V series = 180VDC 460V series = 360VDC; action time: Immediately act when the DC bus voltage is lower than P06.00"
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
          "Trip condition (Action Level): P06.00 230V series = 180VDC 460V series = 360VDC; action time: Immediately act when the DC bus voltage is lower than P06.00"
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
          "Trip condition (Action Level): When DC bus ripple is higher than the protection level, and the output current exceeds 50% of the rated current, the drive starts counting. When the counting value reaches the upper limit, an orP error occurs.; action time: The action time varies with different output current."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 15 = orP.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: When DC bus ripple is higher than the protection level, and the output current exceeds 50% of the rated current, the drive starts counting. When the counting value reaches the upper limit, an orP error occurs.."
        ],
        "fix": [
          "Verify the wiring of the main circuit power is installed correctly.",
          "Check that a single-phase power supply is not being used with a three-phase model. Choose the model whose power matches the voltage.",
          "Power voltage changes can trigger this fault. If the main circuit power works normally, verify the main circuit. Cycle the power after checking the power, if orP error still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): Depending on the model power, model default of P06.15 +5°C. When the setting for P06.15 is higher than the oH1 level, oH1 error occurs instead of oH1 warning. An IGBT overheating error occurs, and the drive stops.; action time: Immediately when limit is reached."
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
          "Trip condition (Action Level): Refer to the overheat setpoint for each model.; action time: The oH2 fault occurs when the temperature sensor of key components detects the temperature is higher than the protection level for 100ms."
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
          "Reset: Manual reset; The drive auto-resets when the temperature sensor of key components detects the temperature is lower than oH2 error level by 10ºC."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-33, oH2 ID 17)"
      },
      {
        "code": "tH1o",
        "title": "IGBT temperature detection failure",
        "symptom": "Drive trips; keypad shows tH1o, fault ID 18 in the fault record.",
        "causes": [
          "IGBT hardware failure in temperature detection",
          "Trip condition (Action Level): NTC broken or wiring failure; action time: When the IGBT temperature is higher than the protection level, and detection time exceeds 100 ms, the tH1o protection activates."
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
          "Trip condition (Action Level): NTC broken or wiring failure; action time: When the IGBT temperature is higher than the protection level, and detection time exceeds 100 ms, the tH2o protection activates."
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
          "The AC motor drive detects excessive drive output current. Overload capacity: • Variable Torque (VT): Sustains for one minute when the drive outputs 120% of the drive’s rated output current. Sustains for three seconds when the drive outputs 150% of the drive’s rated output current. • Constant Torque (CT): Sustains for one minute when the drive outputs 150% of the drive’s rated output current. Sustains for three seconds when the drive outputs 200% of the drive’s rated output current.",
          "Trip condition (Action Level): Based on overload curve and derating curve.; action time: When the load is higher than the protection level and exceeds allowable time, the oL protection activates."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 21 = oL.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
          "Replace the drive with a larger capacity model.",
          "If the oL only occurs during low-speed operations: a) Reduce the load during low-speed operation. b) Increase the drive capacity. c) Decrease the carrier frequency of P00.17.",
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
          "Trip condition (Action Level): Start counting when the output current > 150% of the motor 1 rated current; action time: P06.14 (If the output current is larger than 105% of the motor 1 rated current again within 60 sec., the counting time reduces and is less than P06.14)"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 22 = EoL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "Trip condition (Action Level): Start counting when the output current > 150% of the motor 2 rated current PTC input value > P06.30 setting (Default = 50%) PT100 RTD input value > P06.57 setting (default = 7V); action time: P06.28 (If the output current is larger than 105% of the motor 2 rated current again within 60 sec., the counting time reduces and is less than P06.28) Immediately act Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 23 = EoL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.35–P01.42 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "Verify ambient temperature and change the installation location if there are heating devices in the surroundings, or install/add cooling fan or air conditioner to lower the ambient temperature.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Verify duration of low speed operation. a) Decrease low-speed operation time. b) Change to dedicated motor for the drive. c) Increase the motor capacity.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Verify V/F voltage and adjust settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection between PTC thermistor and the heat protection.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Check if motor is locked and remove the motor shaft lock.",
          "Verify load and decrease the loading or replace motor with a higher capacity model if load is too high.",
          "Verify ambient temperature and change the installation location if there are heating devices in the surroundings, or install/add cooling fan or air conditioner to lower the ambient temperature.",
          "Check the cooling system and ensure it’s working normally.",
          "Verify the motor fan is working and replace the fan if needed.",
          "Verify duration of low speed operation. a) Decrease low-speed operation time. b) Change to dedicated motor for the drive. c) Increase the motor capacity.",
          "Verify accel/decel time and increase setting values for P01.12–P01.19 (accel./ decel. time) if working cycle is too short.",
          "Verify V/F voltage and adjust settings for P01.01–P01.08 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Verify the motor rated current matches the motor nameplate and configure the correct rated current value of the motor if needed.",
          "Check the connection of PT100 RTD.",
          "Verify stall prevention is set correctly and adjust the value if needed.",
          "Check for unbalanced three-phase motor impedance. Replace the motor if needed.",
          "Verify harmonics and reduce harmonics if too high.",
          "Fault setting parameter: N/A P06.29 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning P06.29 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning",
          "Reset: Manual reset When P06.29=0, oH3 is a “Warning”. The “Warning” is automatically cleared. When P06.29=1 or 2, oH3 is a “Fault”. You must reset manually. When P06.29=0 and the temperature < P06.56, oH3 is automatically cleared. When P06.29=1 or 2, oH3 is a “Fault”. You must reset manually.; Reset in five seconds after the fault is cleared Immediately reset Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-35, EoL2 ID 23)"
      },
      {
        "code": "ot1",
        "title": "Over torque 1",
        "symptom": "Drive trips; keypad shows ot1, fault ID 26 in the fault record.",
        "causes": [
          "When the output current exceeds the over-torque detection level (P06.07) and exceeds over-torque detection time (P06.08), and when P06.06 or P06.09 is set to 2 or 4, the ot1 error displays.",
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
          "Adjust the V/F curve (Motor 1, P01.01–P01.08), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed).",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.26 torque compensation gain until the current reduces and the motor does not stall.",
          "Very speed tracking settings and correct the parameter settings as needed. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P06.06 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P06.06=1 or 3, ot1 is a “Warning”. The warning is automatically cleared when the output current < (Pr.06-07 – 5%) When P06.06=2 or 4, ot1 is a “Fault”. You must reset manually.; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-37, ot1 ID 26)"
      },
      {
        "code": "ot2",
        "title": "Over torque 2",
        "symptom": "Drive trips; keypad shows ot2, fault ID 27 in the fault record.",
        "causes": [
          "When the output current exceeds the over-torque detection level (P06.10) and exceeds over-torque detection time (P06.11), and when P06.09 is set to 2 or 4, the ot2 error displays.",
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
          "Adjust the V/F curve (Motor 1, P01.35–P01.42), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed).",
          "If error occurs during low-speed operation: a) Decrease low-speed operation time. b) Increase the motor capacity.",
          "Adjust P07.71 torque compensation gain until the current reduces and the motor does not stall.",
          "Very speed tracking settings and correct the parameter settings as needed. a) Start the speed tracking function. b) Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P06.09 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P06.09=1 or 3, ot2 is a “Warning”. The warning is automatically cleared when the output current < (P06.10 – 5%). When P06.09=2 or 4, ot2 is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P06.73 setting is: 0: No function 1: Fault and coast to stop 2: Fault and ramp to stop by the 2nd deceleration time 3: Warn and continue operation",
          "Reset: When P06.73=3, uC is a “Warning”. The warning is automatically cleared when the output current > (P06.71+0.1A). When P06.73=1 or 2, uC is a “Fault”. You must reset manually.; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-38, uC ID 28)"
      },
      {
        "code": "Lit",
        "title": "Limit error",
        "symptom": "Drive trips; keypad shows Lit, fault ID 29 in the fault record.",
        "causes": [
          "This code occurs when the motor drive is running under speed mode (not IMFOCPG/ PMFOCPG) and the negative running limit or the positive running limit of the DIx terminals is enabled.",
          "Trip condition (Action Level): When under the speed mode (not FOCPG), negative running limit or positive running limit is enabled.; action time: Immediately acts."
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
          "Fault setting parameter: P08.09 setting is: 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: Warn and operate at last frequency",
          "Reset: When P08.09=3 or 4, AFE is a “Warning”. When the feedback signal is > 4 mA, the ”Warning” is automatically cleared. When P08.09=1 or 2, AFE is a “Fault”. You must reset manually.; Immediately reset."
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
          "Under PG mode, when the motor frequency exceeds the encoder observer stall level (P10.10) and starts to count, the fault time is longer than the detection time of encoder observer stall (P10.11), then PGF3 fault occurs.",
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
          "Under PG mode, when the motor frequency exceeds encoder observer slip range (P10.13) and starts to count, the fault time is longer than the detection time of encoder observer slip (P10.14), PGF4 fault occurs.",
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
          "Reset: Auto: When P10.15=0, PGF4 is a “Warning”. When the deviation between the output frequency and motor frequency is smaller than the encoder observer slip range, the warning is automatically cleared. Manual: When P10.15=1 or 2, PGF4 is a “Fault” and you must reset manaully.; Immediately reset."
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
          "Fault setting parameter: P03.19 setting is: 0: Disable 1: Continue operation at the last frequency (warning, ANL is displayed on the keypad) 2: Decelerate to stop (warning, ANL is displayed on the keypad) 3: Stop immediately and display ACE",
          "Reset: When P03.19=1 or 2, ACE is a “Warning”. When analog input signal is > 4 mA, the warning is automatically cleared. When P03.19=3, ACE is a “Fault”. You must reset manually.; Immediately reset."
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
          "Fault setting parameter: P07.20 setting is: 0: Coast to stop 1: Stop by the 1st deceleration time 2: Stop by the 2nd deceleration time 3: Stop by the 3rd deceleration time 4: Stop by the 4th deceleration time 5: System deceleration 6: Automatic deceleration (P01.46)",
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
          "If you forget the password, do the following steps: a) Step 1: Input 9999 and press ENTER. b) Step 2: Repeat step 1. Input 9999 and press ENTER. (You need to finish step 1 and step 2 within 10 seconds. If you don’t finish the two steps in 10 seconds, try again.)",
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
          "Verify the wiring and grounding of the communication circuit. It is recommended to separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
          "Check if the setting for P09.04 is the same as the setting for the upper unit.",
          "Check the cable and replace it if necessary.",
          "Fault setting parameter: P09.02 0: Warn and continue operation 1: Fault and ramp to stop 2: Fault and coast to stop 3: No warning, no fault, and continue operation",
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
          "Trip condition (Action Level): 1) ydc occurs when the confirmation signals of Y-connection and Δ-connection are conducted at the same time. 2) If any of confirmation signals is not conducted within P05.25, ydc occurs.; action time: P05.25"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 61 = ydc."
        ],
        "fix": [
          "Check if the electromagnetic valve works normally during switch. If not, replace it.",
          "Check if related parameters are all set up and set correctly.",
          "Check the wiring of the Y-Δ switch function.",
          "Reset: Manual reset; Can be reset only when the confirmation signal of Y-connection is conducted if it is Y-connection, or when the confirmation signal of Δ-connection is conducted if it is Δ-connection.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-44, ydc ID 61)"
      },
      {
        "code": "dEb",
        "title": "Deceleration energy backup error",
        "symptom": "Drive trips; keypad shows dEb, fault ID 62 in the fault record.",
        "causes": [
          "When P07.13 is not 0, and the power is suddenly off, causing the DC bus voltage lower than the dEb action level, the dEb function acts and the motor ramps to stop. Then dEb displays on the keypad.",
          "Trip condition (Action Level): When P07.13 is not 0, and the DC bus voltage is lower than the level of dEb.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 62 = dEb.",
          "Read P06.34 (DC bus voltage at malfunction) and compare with the trip level: When P07.13 is not 0, and the DC bus voltage is lower than the level of dEb.."
        ],
        "fix": [
          "Check that the power system is not unstable or off.",
          "If another large load operates in the same power system: a) Replace power system with a larger capacity model. b) Ensure the large load system is on a different power system.",
          "Reset: When P07.13=2 (dEb with auto-acceleration / auto-deceleration, the drive outputs the frequency after the power is restored): dEb is automatically cleared. When P07.13=1 (dEb with auto-acceleration / auto-deceleration, the drive does not output the frequency after the power is restored): The drive stops when dEb acts and the rotation speed becomes 0 Hz, then the drive can be reset manually.; Auto: The fault is automatically cleared. Manual: When the drive decelerates to 0 Hz.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-44, dEb ID 62)"
      },
      {
        "code": "oSL",
        "title": "Over slip error",
        "symptom": "Drive trips; keypad shows oSL, fault ID 63 in the fault record.",
        "causes": [
          "On the basis of the maximum slip limit set via P10.29, the speed deviation is abnormal. When the motor drive outputs at constant speed, F>H or F<H exceeds the level set via P07.29, and it exceeds the time set via P07.30, oSL shows. oSL occurs in induction motors only.",
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
          "Reset: P07.31=0 is a warning. When the motor drive outputs at constant speed, and F>H or F<H does not exceed the level set via P07.29 anymore, oSL warning will be cleared automatically. When P07.31=1 or 2, oSL is an error, and it needs to reset manually.; Immediately reset."
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
          "Verify the STO1 and SCM1 short circuit lines are connected. Re- connect the short circuit line if needed. Ensure all wiring is correct.",
          "Verify the connections at the drive control terminals.",
          "If issue still persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, SrL1 ID 72)"
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
          "Reset: When P06.44=1 and after STo error is cleared, it automatically resets. When P06.44=0 and after STo error is cleared, reset it manually.; Reset only after STo error is cleared.."
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
          "Verify the STO2 and SCM2 short circuit lines are connected. Re- connect the short circuit line if needed. Ensure all wiring is correct.",
          "Verify the connections at the drive control terminals.",
          "If the issue persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, SrL2 ID 77)"
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
          "Verify the STO1 and SCM1 or STO2 and SCM2 short circuit lines are connected. Re-connect the short circuit line if needed. Ensure all wiring is correct.",
          "Verify the connections at the drive control terminals.",
          "If the issue persists, contact AutomationDirect Technical Support.",
          "Reset: Hardware failure, and cannot reset. Cycle the power.."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-46, SrL3 ID 78)"
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
          "The Aoc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "The Aoc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "The Aoc may occur due to a short circuit or ground fault at the output side of the drive. Check for possible short circuits between terminals with an electric meter: a) B1 corresponds to U, V and W; DC- corresponds to U, V and W; the terminal shown by a symbol in the manual (not extractable; likely the ground terminal, see the manual page) corresponds to U, V and W. b) If short circuit occurs, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 82 = oPL1.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL1 fault still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 83 = oPL2.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL2 fault still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P06.47; action time: P06.46 P06.48: Use the setting value of P06.48 first. If DC braking function activates, use that of P06.46."
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 84 = oPL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Check for unbalanced three-phase motor impedance. If unbalanced, replace the motor.",
          "Verify motor is wired correctly. Check the cable condition and replace the cable if necessary.",
          "Ensure a single-phase motor is not being used with a three-phase drive",
          "Check the flat cable of the control board. Re-do the wiring and test again if the flat cable is loose. If the fault still exists, contact AutomationDirect Technical Support.",
          "Verify that the three-phase current is balanced with a current clamp meter. If it is balanced and the oPL3 fault still exists, contact AutomationDirect Technical Support.",
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
          "Trip condition (Action Level): P09.31=-1 – -10 (there is no -9), when the internal communication between Slave and Master is abnormal, ictE fault occurs.; action time: Immediately act"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 111 = ictE."
        ],
        "fix": [
          "Verify the wiring and grounding of the communication circuit. Separate the communication circuit from the main circuit, or wire in 90 degree for effective anti-interference performance.",
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
          "When the output current exceeds the over-torque detection level (P14.75) and exceeds over-torque detection time (P14.76), and when P14.74 is set to 2 or 4, the ot3 error displays.",
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
          "Verify V/F voltage and adjust the V/F curve (Motor 3, P01.54–P01.61), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Replace motor with a larger capacity motor.",
          "Check for overload during low-speed operation and decrease the loading during low-speed operation or increase the motor capacity.",
          "Verify torque compensation and adjust P07.73 torque compensation gain until the output current decreases and the motor does not stall.",
          "Correct the parameter settings for speed tracking. Start the speed tracking function. Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P14.74 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P14.74=1 or 3, ot3 is a “Warning”. The warning is automatically cleared when the output current < P14.75. When P14.74=2 or 4, ot3 is a “Fault”. You must reset manually.; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-51, ot3 ID 128)"
      },
      {
        "code": "ot4",
        "title": "Over-torque 4",
        "symptom": "Drive trips; keypad shows ot4, fault ID 129 in the fault record.",
        "causes": [
          "When the output current exceeds the over-torque detection level (P14.78) and exceeds over-torque detection time (P14.79), and when P14.77 is set to 2 or 4, the ot4 error displays.",
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
          "Verify V/F voltage and adjust the V/F curve (Motor 3, P01.63–P01.70), especially the setting value for the mid-point voltage (if the mid-point voltage is set too small, the load capacity decreases at low-speed).",
          "Replace motor with a larger capacity motor.",
          "Check for overload during low-speed operation and decrease the loading during low-speed operation or increase the motor capacity.",
          "Verify torque compensation and adjust P07.75 torque compensation gain until the output current decreases and the motor does not stall.",
          "Correct the parameter settings for speed tracking. Start the speed tracking function. Adjust the maximum current for P07.09 speed tracking.",
          "Fault setting parameter: P14.77 setting is: 0: No function 1: Continue operation after over-torque detection during constant speed operation 2: Stop after over-torque detection during constant speed operation 3: Continue operation after over-torque detection during RUN 4: Stop after over-torque detection during RUN",
          "Reset: When P14.77=1 or 3, ot3 is a “Warning”. The warning is automatically cleared when the output current < P14.75. When P14.77=2 or 4, ot3 is a “Fault”. You must reset manually.; Immediately reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gs30m/ch6.pdf (Chapter 6 Maintenance and Troubleshooting, Fault Codes table, p.6-52, ot4 ID 129)"
      },
      {
        "code": "EoL3",
        "title": "Internal communication error",
        "symptom": "Drive trips; keypad shows EoL3, fault ID 134 in the fault record.",
        "causes": [
          "Electronic thermal relay 3 protection. The drive coasts to stop once it activates.",
          "Trip condition (Action Level): Start counting when output current > 150% of the motor 3 rated current.; action time: P14.81 (If the output current is larger than 105% of the motor 3 rated current again within 60 sec., the counting time reduces and is less than P14.81)"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 134 = EoL3.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.54–P01.61 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "Trip condition (Action Level): Start counting when the output current > 150% of the motor 4 rated current.; action time: P14.83 (If the output current is larger than 105% of motor 4 rated current again within 60 sec., the counting time reduces and is less than P14.83)"
        ],
        "confirm": [
          "Read fault record P06.17 (Fault record 1, most recent; P06.18-P06.22 older): value 135 = EoL4.",
          "Read P06.35 (output current at malfunction) and P06.32 (output frequency at malfunction)."
        ],
        "fix": [
          "Reduce the load.",
          "Increase the setting value for P01.12–P01.19 (accel./decel. time)",
          "Adjust the settings for P01.62–P01.70 (V/F curve), especially the setting value for the mid-point voltage (if the mid-point voltage is set too low, the load capacity decreases at low speed). Refer to the V/F curve selection of P01.43.",
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
          "If an electromagnetic contactor is used as an open state on the output side of the drive (U/V/W), verify that the three phases of the electromagnetic valve are all closed.",
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
        "note": "MD290 User Guide B06, Table 4-2/4-3 Electrical specifications: https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF"
      },
      {
        "terminals": "R, S, T (line to line)",
        "state": "power applied, 200-240 VAC models",
        "meter": "VAC",
        "expected": "170-264 VAC (-15%/+10%)",
        "note": "MD290 User Guide B06, chapter 4 Technical data"
      },
      {
        "terminals": "Operating panel bus voltage (U0 monitoring)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "Between undervoltage threshold A5-06 (default 350 V) and overvoltage threshold A5-09 (default 820 V); outside these the drive reports Err09 / Err05-Err07",
        "note": "MD290 User Guide B06, 7.6.2 Setting of Undervoltage/Overvoltage Threshold, p.326 (400 V class defaults)"
      },
      {
        "terminals": "+24V to COM",
        "state": "powered",
        "meter": "VDC",
        "expected": "+24 V supply for DIs/DOs and sensors, 200 mA max",
        "note": "MD290 User Guide B06, Table 5-36 control terminal functions, p.185"
      },
      {
        "terminals": "DI1-DI5 to OP",
        "state": "input ON",
        "meter": "VDC",
        "expected": "Operating voltage range 9-30 V (input impedance 1.39 kOhm; DI5 1.03 kOhm). OP is jumpered to +24V by default (internal supply).",
        "note": "MD290 User Guide B06, Table 5-36, p.185"
      },
      {
        "terminals": "+10V to GND",
        "state": "powered",
        "meter": "VDC",
        "expected": "+10 V, 10 mA max (potentiometer 1-5 kOhm)",
        "note": "MD290 User Guide B06, Table 5-36, p.185"
      },
      {
        "terminals": "AI1 to GND",
        "state": "speed reference",
        "meter": "VDC",
        "expected": "0-10 VDC (input impedance 22 kOhm)",
        "note": "MD290 User Guide B06, Table 5-36, p.185"
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E002.0 (Err02). Mechanism: This fault occurs when the transient current outputted exceeds 2.5 x 1.414 x rated current of the drive during acceleration.",
        "causes": [
          "The output circuit of the AC drive is grounded or short-circuited.",
          "The acceleration time is too short under abrupt acceleration conditions.",
          "The overcurrent stall suppression parameters are set improperly.",
          "The manual torque boost or V/f curve is improper.",
          "The motor is started while rotating.",
          "The drive suffers external interference."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E002.0; U0-62 current fault = 2, i.e. Err02). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The output circuit of the AC drive is grounded or short-circuited: 1. Check whether short circuit occurs at the output terminals U/V/W with a multimeter. 2. Check whether power cables are short-circuited with a multimeter. 3. Check whether the motor resistance is symmetric with a multimeter. 4. Check whether three-phase output grounding points are available. Detect the impedance to ground with a tramegger.",
          "The acceleration time is too short under abrupt acceleration conditions: Check whether the acceleration/deceleration time is appropriate. Increase the acceleration/deceleration time parameters F0-17 and F0-18 to test whether the output current decreases.",
          "The overcurrent stall suppression parameters are set improperly: Check whether the overcurrent stall suppression function (F3-19) is enabled and whether the overcurrent stall suppression current (F3-18) is set properly.",
          "The manual torque boost or V/f curve is improper: Check whether the manual torque boost coefficient (F3-01) is excessively high or whether the V/f curve is modified in the V/f mode.",
          "The motor is started while rotating: Check whether the motor is started while rotating.",
          "The drive suffers external interference: 1. Check whether devices that cause significant interference are in operation on the site. 2. Check whether the power supply is normal upon the fault."
        ],
        "fix": [
          "The output circuit of the AC drive is grounded or short-circuited: 1. If the power cable is short-circuited, replace the output cable. 2. If the motor resistance is not symmetrical, replace the motor.",
          "The acceleration time is too short under abrupt acceleration conditions: Increase the acceleration time (F0–17).",
          "The overcurrent stall suppression parameters are set improperly: 1. Ensure that the overcurrent stall suppression function is enabled (F3-19 = 1). 2. If the value of F3-18 is excessively high, change it to a value between 120% and 160%. 3. If the value of F3-20 is excessively low, change it to a value between 20 and 40.",
          "The manual torque boost or V/f curve is improper: Adjust the manual torque boost or V/f curve.",
          "The motor is started while rotating: Select the flying start mode or start the motor after it stops.",
          "The drive suffers external interference: 1. Check if the current upon the fault reaches the overcurrent threshold (F3–18) in the fault log. 2. If not, the fault may be caused by external interference. In this case, remove the external interference to clear the fault. 3. If no external interference source is found, the driver board or Hall device may be faulty. Contact the manufacturers to replace them."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.361, E002.0)"
      },
      {
        "code": "E003.0",
        "title": "Overcurrent during deceleration",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E003.0 (Err03). Mechanism: This fault occurs when the transient current outputted exceeds 2.5 x 1.414 x rated current of the drive during deceleration.",
        "causes": [
          "The output circuit of the AC drive is grounded or short-circuited.",
          "The control mode is FVC or SVC but parameter auto-tuning is not performed.",
          "The deceleration time is too short under abrupt deceleration conditions.",
          "The overcurrent stall suppression parameters are set improperly.",
          "The braking unit or braking resistor is not installed.",
          "The drive suffers external interference."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E003.0; U0-62 current fault = 3, i.e. Err03). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The output circuit of the AC drive is grounded or short-circuited: 1. Check whether short circuit occurs at the output terminals U/V/W with a multimeter. 2. Check whether power cables are short-circuited with a multimeter. 3. Check whether the motor resistance is symmetric with a multimeter. 4. Check whether three-phase output grounding points are available. Detect the impedance to ground with a tramegger.",
          "The control mode is FVC or SVC but parameter auto-tuning is not performed: Check whether parameter auto-tuning has been performed. Set F1-37 to select different types of auto-tuning mode based on the motor type.",
          "The deceleration time is too short under abrupt deceleration conditions: Check whether the acceleration/deceleration time is appropriate. Increase the acceleration/deceleration time parameters F0-17 and F0-18 to test whether the output current decreases.",
          "The overcurrent stall suppression parameters are set improperly: Check whether the overcurrent stall suppression function (F3-19) is enabled and whether the overcurrent stall suppression current (F3-18) is set properly.",
          "The braking unit or braking resistor is not installed: Check whether the braking unit and braking resistor are installed.",
          "The drive suffers external interference: 1. Check whether devices that cause significant interference are in operation on the site. 2. Check whether the power supply is normal upon the fault."
        ],
        "fix": [
          "The output circuit of the AC drive is grounded or short-circuited: 1. If the power cable is short-circuited, replace the output cable. 2. If the motor resistance is not symmetrical, replace the motor.",
          "The control mode is FVC or SVC but parameter auto-tuning is not performed: Set the motor parameters according to the motor nameplate and perform motor parameter auto-tuning.",
          "The deceleration time is too short under abrupt deceleration conditions: Increase the deceleration time (F0-18).",
          "The overcurrent stall suppression parameters are set improperly: 1. Ensure that the overcurrent stall suppression function is enabled (F3-19 = 1). 2. If the value of F3-18 is excessively high, change it to a value between 120% and 150%. 3. If the value of F3-20 is excessively low, change it to a value between 20 and 40.",
          "The braking unit or braking resistor is not installed: Install the braking unit and braking resistor.",
          "The drive suffers external interference: 1. Check if the current upon the fault reaches the overcurrent threshold (F3–18) in the fault log. 2. If not, the fault may be caused by external interference. In this case, remove the external interference to clear the fault. 3. If no external interference source is found, the driver board or Hall device may be faulty. Contact the manufacturers to replace them."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.363, E003.0)"
      },
      {
        "code": "E004.0",
        "title": "Overcurrent during operation at a constant speed",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E004.0 (Err04). Mechanism: This fault occurs when the transient current outputted exceeds 2.5 x 1.414 x rated current of the drive during operation at a constant speed.",
        "causes": [
          "The output circuit of the AC drive is grounded or short-circuited.",
          "The overcurrent stall suppression parameters are set improperly.",
          "The drive power rating is too low.",
          "The drive suffers external interference."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E004.0; U0-62 current fault = 4, i.e. Err04). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The output circuit of the AC drive is grounded or short-circuited: 1. Check whether short circuit occurs at the output terminals U/V/W with a multimeter. 2. Check whether power cables are short-circuited with a multimeter. 3. Check whether the motor resistance is symmetric with a multimeter. 4. Check whether three-phase output grounding points are available. Detect the impedance to ground with a tramegger.",
          "The overcurrent stall suppression parameters are set improperly: Check whether the overcurrent stall suppression function (F3-19) is enabled and whether the overcurrent stall suppression current (F3-18) is set properly.",
          "The drive power rating is too low: Check whether the power of the drive meets the requirements of the working conditions.",
          "The drive suffers external interference: 1. Check whether devices that cause significant interference are in operation on the site. 2. Check whether the power supply is normal upon the fault."
        ],
        "fix": [
          "The output circuit of the AC drive is grounded or short-circuited: Check whether the motor is short-circuited or disconnected.",
          "The overcurrent stall suppression parameters are set improperly: 1. Ensure that the overcurrent stall suppression function is enabled (F3-19 = 1). 2. If the value of F3-18 is excessively high, change it to a value between 120% and 150%. 3. If the value of F3-20 is excessively low, change it to a value between 20 and 40.",
          "The drive power rating is too low: If the running current exceeds the rated current of the motor or the rated output current of the drive during stable running, replace the drive with one of a higher power rating.",
          "The drive suffers external interference: 1. Check if the current upon the fault reaches the overcurrent threshold (F3–18) in the fault log. 2. If not, the fault may be caused by external interference. In this case, remove the external interference to clear the fault. 3. If no external interference source is found, the driver board or Hall device may be faulty. Contact the manufacturers to replace them."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.364, E004.0)"
      },
      {
        "code": "E005.0",
        "title": "Overvoltage during acceleration",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E005.0 (Err05). Mechanism: The bus voltage is higher than the overvoltage threshold set by A5-09 (unit: V) during acceleration.",
        "causes": [
          "The input grid voltage is excessively high.",
          "External force drives the motor during acceleration.",
          "The overvoltage suppression parameters are set improperly.",
          "The braking unit or braking resistor is not installed.",
          "The acceleration time is too short."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E005.0; U0-62 current fault = 5, i.e. Err05). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The input grid voltage is excessively high: Check whether the input grid voltage is excessively high with a multimeter. Normal range: The input voltage of the three-phase 380 V model ranges from 342 VAC to 418 VAC. The input voltage of the three-phase 220 V model ranges from 198 VAC to 235.4 VAC.",
          "External force drives the motor during acceleration: Check whether the external force drives the motor during acceleration.",
          "The overvoltage suppression parameters are set improperly: 1. Check whether the overvoltage stall suppression function (F3-23) is enabled. 2. Check whether the overvoltage suppression action voltage (F3-22) is proper.",
          "The braking unit or braking resistor is not installed: Check whether the braking unit and braking resistor are installed.",
          "The acceleration time is too short: Check whether the acceleration time (F0-17) is too short (less than 50% of the default value of F0-17), resulting in overmodulation and eventually overvoltage."
        ],
        "fix": [
          "The input grid voltage is excessively high: Adjust the voltage until it is within the normal range.",
          "External force drives the motor during acceleration: 1. Remove the external force or install a braking resistor. 2. The maximum rising frequency during overvoltage suppression (F3-26) is too low. Adjust it to a value between 5 Hz and 15 Hz when external force is applied.",
          "The overvoltage suppression parameters are set improperly: 1. Ensure that the overvoltage stall suppression function (F3-23) is enabled. 2. If the value of F3-22 (Overvoltage suppression action voltage) is too high, change it to a value between 770 V and 700 V. 3. If the value of F3-24 (Overvoltage suppression gain) is too low, change it to a value between 30 and 50.",
          "The braking unit or braking resistor is not installed: Install the braking unit and braking resistor.",
          "The acceleration time is too short: Increase the acceleration time (F0-17)."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.365, E005.0)"
      },
      {
        "code": "E006.0",
        "title": "Overvoltage during deceleration",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E006.0 (Err06). Mechanism: The bus voltage is higher than the overvoltage threshold set by A5-09 (unit: V) during deceleration.",
        "causes": [
          "The overvoltage suppression parameters are set improperly.",
          "External force drives the motor during deceleration.",
          "The deceleration time is too short.",
          "The braking unit or braking resistor is not installed."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E006.0; U0-62 current fault = 6, i.e. Err06). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The overvoltage suppression parameters are set improperly: 1. Check whether the overvoltage stall suppression function (F3-23) is enabled. 2. Check whether the overvoltage suppression action voltage (F3-22) is proper.",
          "External force drives the motor during deceleration: Check whether the external force drives the motor during deceleration.",
          "The deceleration time is too short: Check whether the deceleration time (F0-18) is too short (less than 50% of the default deceleration time), resulting in excessive generating energy and eventually overvoltage.",
          "The braking unit or braking resistor is not installed: Check whether the braking unit and braking resistor are installed."
        ],
        "fix": [
          "The overvoltage suppression parameters are set improperly: 1. Ensure that the overvoltage stall suppression function (F3-23) is enabled. 2. If the value of F3-22 (Overvoltage suppression action voltage) is too high, change it to a value between 770 V and 700 V. 3. If the value of F3-24 (Overvoltage suppression gain) is too low, change it to a value between 30 and 50.",
          "External force drives the motor during deceleration: 1. Remove the external force or install a braking resistor. 2. The maximum rising frequency during overvoltage suppression (F3-26) is too low. Adjust it to a value between 5 Hz and 15 Hz when external force is applied.",
          "The deceleration time is too short: Increase the deceleration time.",
          "The braking unit or braking resistor is not installed: Install the braking unit and braking resistor."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.366, E006.0)"
      },
      {
        "code": "E007.0",
        "title": "Overvoltage during operation at a constant speed",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E007.0 (Err07). Mechanism: The bus voltage is higher than the overvoltage threshold set by A5-09 (unit: V) during operation at a constant speed.",
        "causes": [
          "The overvoltage suppression parameters are set improperly.",
          "External force drives the motor during running."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E007.0; U0-62 current fault = 7, i.e. Err07). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The overvoltage suppression parameters are set improperly: 1. Check whether the overvoltage stall suppression function (F3-23) is enabled. 2. Check whether the overvoltage suppression action voltage (F3-22) is proper.",
          "External force drives the motor during running: Check whether the external force drives the motor during deceleration."
        ],
        "fix": [
          "The overvoltage suppression parameters are set improperly: 1. Ensure that the overvoltage stall suppression function (F3-23) is enabled. 2. If the value of F3-22 (Overvoltage suppression action voltage) is too high, change it to a value between 770 V and 700 V. 3. If the value of F3-24 (Overvoltage suppression gain) is too low, change it to a value between 30 and 50. 4. If the value of F3-26 (Maximum frequency rise threshold for overvoltage suppression) is too low, change it to a value between 5 Hz and 20 Hz.",
          "External force drives the motor during running: 1. Remove the external force or install a braking resistor. 2. The maximum rising frequency during overvoltage suppression (F3-26) is too low. Adjust it to a value between 5 Hz and 15 Hz when external force is applied."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.367, E007.0)"
      },
      {
        "code": "E008.0",
        "title": "Pre-charge resistor fault",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E008.0 (Err08). Mechanism: The relay closes for many times within a short period of time with power ON.",
        "causes": [
          "The input voltage is not within the permissible range, leading to frequent open/close of the contactor."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E008.0; U0-62 current fault = 8, i.e. Err08). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The input voltage is not within the permissible range, leading to frequent open/close of the contactor: 1. Check whether the input grid voltage or power supply is between 342 VAC and 418 VAC. 2. Check that the input power supply does not power on or off repeatedly. 3. Check whether the input grid voltage fluctuates greatly."
        ],
        "fix": [
          "The input voltage is not within the permissible range, leading to frequent open/close of the contactor: Adjust the voltage to a value within the normal range to ensure that bus voltage fluctuation does not cause frequent open/close of the contactor."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.368, E008.0)"
      },
      {
        "code": "E009.0",
        "title": "Undervoltage",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E009.0 (Err09). Mechanism: The bus voltage is lower than the undervoltage threshold set by A5-06 (unit: V).",
        "causes": [
          "An instantaneous power failure occurs.",
          "The input voltage of the drive is beyond the allowed range.",
          "The bus voltage is abnormal.",
          "The rectifier, the inverter driver board, or the inverter control board is faulty."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E009.0; U0-62 current fault = 9, i.e. Err09). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "An instantaneous power failure occurs: 1. Check whether the input grid voltage or power supply is between 342 VAC and 418 VAC. 2. Check whether voltage dip occurs.",
          "The input voltage of the drive is beyond the allowed range: Check whether the input grid or power supply is within the normal range: 342 VAC to 418 VAC.",
          "The bus voltage is abnormal: Use a voltage measurement device or InoDriverShop to measure the bus voltage and check whether oscillation exists.",
          "The rectifier, the inverter driver board, or the inverter control board is faulty: 1. Check whether the effective value of the DC bus voltage is about 1.414 times the effective value of the input voltage with a multimeter. If the difference is significant, an error exists. 2. On the basis of step 1, check whether the bus voltage of the drive is consistent with the bus voltage detected by the multimeter. If the difference is significant, an error exists."
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E010.0 (Err10). Mechanism: The drive is considered to be overloaded when the overload time is reached based on the overload curve of the drive.",
        "causes": [
          "The carrier frequency is set too high.",
          "The load is too heavy or the motor is stalled."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E010.0; U0-62 current fault = 10, i.e. Err10). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The carrier frequency is set too high: Check whether F0-15 (Carrier frequency) is set to a value higher than the default value.",
          "The load is too heavy or the motor is stalled: 1. Check whether the load (output current) is too heavy during normal operation. 2. When an overload fault occurs, check whether the motor is stalled (the motor does not rotate). 3. Check whether the output cable is cracked."
        ],
        "fix": [
          "The carrier frequency is set too high: Reduce the value of F0-15 (Carrier frequency).",
          "The load is too heavy or the motor is stalled: 1. Reduce the load and perform testing again. 2. Eliminate the risk of motor stall and perform testing again. If the fault persists, contact Inovance technical support. 3. Perform parameter auto-tuning again. 4. Check whether the cable is short-circuited and or in poor contact due to surface crack."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.369, E010.0)"
      },
      {
        "code": "E011.0",
        "title": "Motor overload",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E011.0 (Err11). Mechanism: The motor is considered to be overloaded when the overload time is met based on the motor overload curve.",
        "causes": [
          "F9-01 (Motor overload protection gain) is set incorrectly.",
          "The load is too heavy or the motor is stalled."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E011.0; U0-62 current fault = 11, i.e. Err11). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "F9-01 (Motor overload protection gain) is set incorrectly: Check whether the value of F9-01 (Motor overload protection gain) is lower than 1.0. The default value is 1.0.",
          "The load is too heavy or the motor is stalled: 1. Check whether the load (output current) is too heavy during normal operation. 2. When an overload fault occurs, check whether the motor is stalled (the motor does not rotate)."
        ],
        "fix": [
          "F9-01 (Motor overload protection gain) is set incorrectly: Set the value of F9-01 properly. If you increase the value of F9-01, the motor overload time is prolonged.",
          "The load is too heavy or the motor is stalled: Reduce the load and check the motor and machinery."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.370, E011.0)"
      },
      {
        "code": "E012.0",
        "title": "Input phase loss",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E012.0 (Err12). Mechanism: If the input phase loss signal is active, the input phase loss occurs.",
        "causes": [
          "The three-phase input power supply is abnormal.",
          "The driver board, lightning protection board, main control board, or rectifier bridge is faulty."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E012.0; U0-62 current fault = 12, i.e. Err12). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The three-phase input power supply is abnormal: Check whether the input grid voltage or power supply is between 342 VAC and 418 VAC.",
          "The driver board, lightning protection board, main control board, or rectifier bridge is faulty: Use a voltage detection device to check whether the three-phase grid is unbalanced."
        ],
        "fix": [
          "The three-phase input power supply is abnormal: Check and eliminate faults in peripheral circuits.",
          "The driver board, lightning protection board, main control board, or rectifier bridge is faulty: 1. Troubleshoot the cause for unbalanced grid voltage or perform derating during use. 2. If the fault persists, contact Inovance technical support."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.370, E012.0)"
      },
      {
        "code": "E013.0",
        "title": "Output phase loss",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E013.0 (Err13). Mechanism: The average value of three-phase output current is detected when the operating frequency is higher than 0.8 Hz. The ratio of the maximum phase output current to the minimum phase output current is larger than 7.",
        "causes": [
          "The motor is faulty.",
          "The drain wire between the drive and the motor is abnormal.",
          "The three-phase outputs of the AC drive are unbalanced during motor running.",
          "The driver board or the IGBT module is abnormal."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E013.0; U0-62 current fault = 13, i.e. Err13). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The motor is faulty: Check whether open circuit occurs on U/V/W phase of the motor.",
          "The drain wire between the drive and the motor is abnormal: Check whether the drain wire between the drive output end and the motor end is proper.",
          "The three-phase outputs of the AC drive are unbalanced during motor running: Check whether the effective values of the three-phase output current of the AC drive are consistent.",
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E014.0 (Err14). Mechanism: The heatsink temperature exceeds the overtemperature threshold, leading to a drive overheat fault.",
        "causes": [
          "The ambient temperature is excessively high.",
          "The air duct is blocked.",
          "The fan is damaged.",
          "The thermistor is damaged.",
          "Product components are damaged."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E014.0; U0-62 current fault = 14, i.e. Err14). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The ambient temperature is excessively high: 1. Check whether the ambient temperature exceeds 40℃. 2. Check whether the drive is derated (derated 1.5% for every additional 1℃) if the temperature is between 40℃ and 50℃.",
          "The air duct is blocked: Check whether the air duct of the drive or in the environment is blocked.",
          "The fan is damaged: Check whether the fan stops.",
          "The thermistor is damaged: Stop the drive for more than 1 h and check whether the temperature rises or does not fall.",
          "Product components are damaged: If the fault persists, the internal components of the drive may be damaged."
        ],
        "fix": [
          "The ambient temperature is excessively high: 1. Lower the ambient temperature to a value below 40°C. 2. Derate the drive if the temperature is between 40℃ and 50℃.",
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E015.0 (Err15). Mechanism: The DI terminal should be normally open, but it is detected to be closed. The DI terminal should be normally closed, but it is detected to be open.",
        "causes": [
          "An external fault signal is input through the multi-functional DI (NO).",
          "An external fault signal is input using the virtual I/O terminal (NO)."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E015.0; U0-62 current fault = 15, i.e. Err15). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "An external fault signal is input through the multi-functional DI (NO): Check the parameter of the DI terminal (group F4) to see which DI is assigned with function 11, and check whether the corresponding physical DI is closed.",
          "An external fault signal is input using the virtual I/O terminal (NO): Check the parameter of the DI terminal (group F4) to see which DI is set to function 33, and check whether the corresponding physical DI is disconnected."
        ],
        "fix": [
          "An external fault signal is input through the multi-functional DI (NO): Eliminate external faults and ensure that restart is allowed under the mechanical condition.",
          "An external fault signal is input using the virtual I/O terminal (NO): Check that the virtual I/O parameters in group A1 are set correctly and reset the device."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.372, E015.0)"
      },
      {
        "code": "E016.0",
        "title": "Communication fault",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E016.0 (Err16). Mechanism: The MD290 supports the following protocols: Modbus-RTU, PROFINET, EtherCAT, PROFIBUS DP, CANopen and CANlink. This section describes all communication-related faults. 1. If the time interval between the current communication and the next communication exceeds the value of FD-04 (Modbus communication interruption detection time) or the value of FD-08 (Expansion communication interruption detection time), the drive reports a communication fault. 2. When connection to the slave is abnormal, the master reports a communication fault during running.",
        "causes": [
          "The host controller does not work properly.",
          "The communication cable is faulty.",
          "F0-28 (Communication protocol selection) is set incorrectly.",
          "Communication parameters in group FD are set improperly."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E016.0; U0-62 current fault = 16, i.e. Err16). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The host controller does not work properly: Check whether the program of the host controller is correct, whether the configuration file is correct according to the current communication protocol, and whether the wiring is secure and correct.",
          "The communication cable is faulty: Check whether the network cable and differential signal cable are abnormal.",
          "F0-28 (Communication protocol selection) is set incorrectly: Check whether F0-28 (Communication protocol selection) is set correctly as follows: 0: Modbus protocol; 1: Non-Modbus protocol",
          "Communication parameters in group FD are set improperly: Check whether the values of FD-00 (Baud rate), FD-01 (Modbus data format), FD-02 (local address) set through the drive are consistent with those set through the host controller."
        ],
        "fix": [
          "The host controller does not work properly: Contact after-sales engineers to check the host controller software, obtain the correct configuration file, and check the wiring.",
          "The communication cable is faulty: 1. Check that the cable is intact. 2. Connect the communication cable properly.",
          "F0-28 (Communication protocol selection) is set incorrectly: Set the communication expansion card correctly.",
          "Communication parameters in group FD are set improperly: Ensure the values of FD-00 (Baud rate), FD-01 (Modbus data format), FD-02 (local address) set through the drive are consistent with those set through the host controller."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.373, E016.0)"
      },
      {
        "code": "E017.0",
        "title": "Contactor fault",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E017.0 (Err17). Mechanism: The pre-charge contactor is considered to be faulty when abnormal signals are detected continuously for 1s based on hardware contactor exception signal detection.",
        "causes": [
          "The driver board and power supply are abnormal.",
          "The contactor is abnormal.",
          "The lightning protection board is abnormal."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E017.0; U0-62 current fault = 17, i.e. Err17). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The driver board and power supply are abnormal: Check whether the input grid voltage is normal. The input voltage of the three-phase 380 V model ranges from 342 VAC to 418 VAC. The input voltage of the three-phase 220 V model ranges from 198 VAC to 235.4 VAC.",
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E018.0 (Err18). Mechanism: Zero drift is detected only in the undervoltage and stop state. If zero drift detection value is greater than 10% of the rated current, the current sampling is considered abnormal.",
        "causes": [
          "The main circuit is not powered on.",
          "The current sampling of the drive is abnormal."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E018.0; U0-62 current fault = 18, i.e. Err18). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The main circuit is not powered on: Check whether voltage exists on the R/S/T input end with a multimeter.",
          "The current sampling of the drive is abnormal: In the stop state, check the three-phase output UVW current and check whether the current fluctuation exceeds 10% of the rated current."
        ],
        "fix": [
          "The main circuit is not powered on: Power on the R/S/T input end.",
          "The current sampling of the drive is abnormal: If the current fluctuation exceeds 10% of the rated current, the Hall sensor or current sampling circuit is damaged. Contact Inovance for technical support."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.374, E018.0)"
      },
      {
        "code": "E019.0",
        "title": "Motor parameter auto-tuning fault",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E019.0 (Err19). Mechanism: The current is low during stator resistance auto-tuning.",
        "causes": [
          "Motor parameters are not set according to the nameplate.",
          "Parameter auto-tuning times out."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E019.0; U0-62 current fault = 19, i.e. Err19). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "Motor parameters are not set according to the nameplate: Check whether parameters F1-00 to F1-06 are set according to the motor nameplate.",
          "Parameter auto-tuning times out: 1. Check whether the motor is connected. 2. Check whether the contactor between the drive and the motor are open."
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E021.0 (Err21). Mechanism: 1. The continuous operation time on the EEPROM exceeds the threshold defined internally. 2. The continuous read operation time on the EEPROM exceeds the threshold defined internally. 3. The continuous write operation time on the EEPROM exceeds the threshold defined internally. 4. The number of write-read operations on the EEPROM within 1s exceeds the value of F8- 58. 5. The EEPROM internal cache queue length exceeds the length defined internally.",
        "causes": [
          "The EEPROM chip is damaged."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E021.0; U0-62 current fault = 21, i.e. Err21). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The EEPROM chip is damaged: Check whether parameters are operated through communication, and then check whether the RAM address or EEPROM address is operated. Note: For mapping of RAM addresses of each group of parameters, see the parameter list section in the user guide. If parameters are written through communication, check whether the write operation is performed frequently."
        ],
        "fix": [
          "The EEPROM chip is damaged: Contact the agent or Inovance for technical support."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.375, E021.0)"
      },
      {
        "code": "E023.0",
        "title": "Drive output short circuited to ground",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E023.0 (Err23). Mechanism: The drive output is short-circuited to ground when the current between the output phase and ground exceeds the designed threshold.",
        "causes": [
          "The motor is short circuited to the ground.",
          "IGBT short circuit is reported during self-check."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E023.0; U0-62 current fault = 23, i.e. Err23). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The motor is short circuited to the ground: Check whether each adapter is normal, and measure the impedance to ground with a megger.",
          "IGBT short circuit is reported during self-check: Perform static self-check repeatedly to check whether the fault persists."
        ],
        "fix": [
          "The motor is short circuited to the ground: Check whether each adapter is normal, and measure the impedance to ground with a megger. Replace the cable or motor if you have to. Note: Do not run the motor before the short circuit to ground fault is rectified.",
          "IGBT short circuit is reported during self-check: If the fault persists, replace the drive. Note: Do not run the motor before the short circuit to ground fault is rectified."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.376, E023.0)"
      },
      {
        "code": "E025.0",
        "title": "Motor overheat",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E025.0 (Err25). Mechanism: The motor temperature is detected through sampling to determine whether the motor is overheated. The fault is triggered after the overheat temperature is reached.",
        "causes": [
          "The motor temperature is too high."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E025.0; U0-62 current fault = 25, i.e. Err25). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The motor temperature is too high: Check whether the motor temperature exceeds the temperature upper limit."
        ],
        "fix": [
          "The motor temperature is too high: 1. Reduce the carrier frequency or take other heat dissipation measures for the motor. 2. Replace the motor. 3. Contact technical support engineers of Inovance."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.376, E025.0)"
      },
      {
        "code": "E026.0",
        "title": "Cumulative operating time reach",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E026.0 (Err26). Mechanism: This fault is reported when the cumulative operating time is longer than or equal to F8-75 + F8-17 x 3600s.",
        "causes": [
          "The cumulative operating time reaches the setpoint."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E026.0; U0-62 current fault = 26, i.e. Err26). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E027.0 (Err27). Mechanism: A DI terminal is assigned with function 44 through a parameter in group F4 or group A1 and the DI terminal is enabled.",
        "causes": [
          "The signal of user-defined fault 1 is input through the multi-functional DI or the virtual I/O."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E027.0; U0-62 current fault = 27, i.e. Err27). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The signal of user-defined fault 1 is input through the multi-functional DI or the virtual I/O: A DI terminal is assigned with function 44 through a parameter in group F4 or group A1 and the DI terminal is enabled."
        ],
        "fix": [
          "The signal of user-defined fault 1 is input through the multi-functional DI or the virtual I/O: Reset the operation."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.377, E027.0)"
      },
      {
        "code": "E028.0",
        "title": "User-defined fault 2",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E028.0 (Err28). Mechanism: A DI terminal is assigned with function 45 through a parameter in group F4 or group A1 and the DI terminal is enabled.",
        "causes": [
          "The signal of user-defined fault 2 is input through the multi-functional DI or the virtual I/O terminal."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E028.0; U0-62 current fault = 28, i.e. Err28). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The signal of user-defined fault 2 is input through the multi-functional DI or the virtual I/O terminal: A DI terminal is assigned with function 45 through a parameter in group F4 or group A1 and the DI terminal is enabled."
        ],
        "fix": [
          "The signal of user-defined fault 2 is input through the multi-functional DI or the virtual I/O terminal: Reset the operation."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.377, E028.0)"
      },
      {
        "code": "E029.0",
        "title": "Cumulative power-on time reach",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E029.0 (Err29). Mechanism: This fault is reported when the cumulative power-on time is longer than or equal to F8-74 + F8-16 x 3600s.",
        "causes": [
          "The cumulative power-on duration reaches the setpoint."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E029.0; U0-62 current fault = 29, i.e. Err29). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E030.0 (Err30). Mechanism: In the running state, the current is lower than the value of F9-64 for the time set by F9-65.",
        "causes": [
          "The operation current of the drive is lower than the value of F9-64."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E030.0; U0-62 current fault = 30, i.e. Err30). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The operation current of the drive is lower than the value of F9-64: Check whether the load is actually disconnected, and whether the cables (such as output cables) are connected properly."
        ],
        "fix": [
          "The operation current of the drive is lower than the value of F9-64: Check that the load is disconnected or ensure that F9-64 and F9-65 are set properly based on the actual conditions."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.378, E030.0)"
      },
      {
        "code": "E031.0",
        "title": "PID feedback loss during running",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E031.0 (Err31). Mechanism: If the PID feedback keeps lower than the value of FA-26 (Detection level of PID feedback loss) after the time defined by FA-27 (Detection time of PID feedback loss) elapses, the drive reports this fault.",
        "causes": [
          "The PID feedback is lower than the value of FA-26."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E031.0; U0-62 current fault = 31, i.e. Err31). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The PID feedback is lower than the value of FA-26: Monitor the feedback channel through the InoDriverShop to check whether the values in the feedback channel are correct."
        ],
        "fix": [
          "The PID feedback is lower than the value of FA-26: 1. Check the PID feedback signal and analyze the system feedback error. 2. Set FA-26 properly."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.378, E031.0)"
      },
      {
        "code": "E040.0",
        "title": "Pulse-by-pulse current limit fault",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E040.0 (Err40). Mechanism: The pulse-by-pulse current limit fault is only applied in the V/f control mode of the asynchronous motor. After the current exceeds the pulse-by-pulse current limit threshold and the pulse-by-pulse current limit lasts for 500 ms, the fault is reported.",
        "causes": [
          "The load is too heavy or the motor is stalled.",
          "The drive power rating is too low."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E040.0; U0-62 current fault = 40, i.e. Err40). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The load is too heavy or the motor is stalled: 1. Check whether the load (output current) is too large during normal operation. 2. When an overload fault occurs, the motor is stalled (the motor does not rotate).",
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E041.0 (Err41). Mechanism: This fault is reported when the motor is switched over when the drive is running.",
        "causes": [
          "Motor switchover is performed using a terminal during running of the drive."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E041.0; U0-62 current fault = 41, i.e. Err41). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "Motor switchover is performed using a terminal during running of the drive: Check whether the DI assigned with function 41 is enabled during operation."
        ],
        "fix": [
          "Motor switchover is performed using a terminal during running of the drive: Perform motor switchover after the drive stops."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.379, E041.0)"
      },
      {
        "code": "E045.0",
        "title": "Motor temperature fault",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E045.0 (Err45). Mechanism: The motor temperature transmitted through the AI is higher than the set motor temperature alarm threshold.",
        "causes": [
          "The cable of the temperature sensor becomes loose.",
          "The motor temperature is too high.",
          "The value of F9-57 (Motor overtemperature protection threshold) is too small."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E045.0; U0-62 current fault = 45, i.e. Err45). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The cable of the temperature sensor becomes loose: Check the wiring of the temperature sensor.",
          "The motor temperature is too high: Check whether the value of U0-34 is higher than F9-57.",
          "The value of F9-57 (Motor overtemperature protection threshold) is too small: Check the value of F9-57 (Motor overtemperature protection threshold)."
        ],
        "fix": [
          "The cable of the temperature sensor becomes loose: Reconnect the cable.",
          "The motor temperature is too high: Increase the carrier frequency or take other measures to cool the motor.",
          "The value of F9-57 (Motor overtemperature protection threshold) is too small: Increase the motor overtemperature protection threshold (90℃ to 100℃ for normal motors)."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.379, E045.0)"
      },
      {
        "code": "E049.0",
        "title": "Voltage overlimit",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E049.0 (Err49). Mechanism: The voltage transmitted through AI1 to AI3 is higher than the set voltage threshold.",
        "causes": [
          "The input voltage of AI1 to AI3 is out of the range set by A6-16 to A6-21."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E049.0; U0-62 current fault = 49, i.e. Err49). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The input voltage of AI1 to AI3 is out of the range set by A6-16 to A6-21: Check whether the input voltage of AI1 to AI3 is out of the range set by A6-16 to A6-21."
        ],
        "fix": [
          "The input voltage of AI1 to AI3 is out of the range set by A6-16 to A6-21: 1. Adjust the input voltage of AI1 to AI3 to the value within the allowed range. 2. Change the values of A6-16 to A6-21. 3. Disable the fault report function."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.380, E049.0)"
      },
      {
        "code": "E055.0",
        "title": "Slave fault in master/slave control mode",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E055.0 (Err55). Mechanism: When a fault occurs on the slave, the fault signal is transmitted to the master through the CAN bus. The master reports the fault.",
        "causes": [
          "The slave is faulty."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E055.0; U0-62 current fault = 55, i.e. Err55). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
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
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E061.0 (Err61). Mechanism: Determine whether the braking transistor is overloaded based on the overload curve.",
        "causes": [
          "The power of the braking resistor is too high (resistance is too low)."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E061.0; U0-62 current fault = 61, i.e. Err61). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The power of the braking resistor is too high (resistance is too low): Check whether the braking resistor model is correct. For details, see the section on the braking resistor in the user guide."
        ],
        "fix": [
          "The power of the braking resistor is too high (resistance is too low): Use a braking resistor with larger resistance."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.380, E061.0)"
      },
      {
        "code": "E062.0",
        "title": "Braking transistor shoot through",
        "symptom": "Drive stops output, TUNE/TC indicator flashes quickly (4 times per second, faulty state), fault relay acts; fault E062.0 (Err62). Mechanism: 1. This fault is reported when the braking transistor is turned off and the braking transistor current exceeds 0.375 times the rated current of the braking transistor for 4s consecutively. 2. This fault is reported when the braking transistor current exceeds two times the maximum current of the braking transistor several times.",
        "causes": [
          "The braking module is abnormal."
        ],
        "confirm": [
          "Operating panel shows the fault (code list E062.0; U0-62 current fault = 62, i.e. Err62). Read F9-14/F9-15/F9-16 (types of the 1st/2nd/3rd fault) and F9-17/F9-18/F9-19 (frequency/current/bus voltage upon the 3rd fault; F9-27..29 2nd, F9-37..39 1st).",
          "The braking module is abnormal: 1. Use a multimeter to measure the resistance of the braking resistor and check whether it is consistent with the nominal value of the braking resistor. If the deviation is too large, the braking resistor is damaged. 2. Check whether the braking resistor is connected properly and whether the braking unit operates properly. 3. Check the bus voltage (U0-02) through the InoDriverShop or the operating panel to determine whether the braking voltage is active."
        ],
        "fix": [
          "The braking module is abnormal: 1. Replace the braking resistor. 2. Connect the braking resistor properly. 3. Contact technical support engineers of Inovance."
        ],
        "source": "https://portal-file.inovance.com/owfile/ProdDoc/SC/PS00000462_PDF_EN/B06/MD290%20Series%20General-Purpose%20AC%20Drive%20User%20Guide-EN-B06.PDF (MD290 Series General-Purpose AC Drive User Guide B06, 8.3 Description of Fault Codes, p.381, E062.0)"
      },
      {
        "code": "Err20",
        "title": "Encoder fault",
        "symptom": "MD500 (closed-loop/FVC) only: drive stops output, TUNE/TC indicator flashes, fault relay acts; panel shows Err20. F9-48 units position lists Encoder fault (Err20).",
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
        "symptom": "MD500 (closed-loop/FVC) only: drive stops output, TUNE/TC indicator flashes, fault relay acts; panel shows Err42. Detected when speed deviation exceeds F9-69 for longer than F9-70.",
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
        "symptom": "MD500 (closed-loop/FVC) only: drive stops output, TUNE/TC indicator flashes, fault relay acts; panel shows Err43. Detected when motor speed exceeds F9-67 for longer than F9-68.",
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
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/appxa.pdf p.A-2 Drive Specifications (Permissible Voltage)"
      },
      {
        "terminals": "R, S, T (main circuit)",
        "state": "power applied, SV2A-2300/2550/2750/2F00",
        "meter": "VAC",
        "expected": "3-phase 200-230 VAC, -15% to +10%",
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/appxa.pdf p.A-2"
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
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf p.3-41 wiring diagram, Digital Input Rating"
      },
      {
        "terminals": "CN1 DI to COM (digital input)",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "< 5 VDC, < 0.5 mA",
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
        "expected": "Closed; open when STO circuit is in the running state, and stays open if only one channel opens or on an internal STO error (non-latching; 80 VDC 0.5 A max)",
        "note": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch3.pdf p.3-36, p.3-40 FDBK behavior"
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
        "symptom": "7-segment display shows AL.001 (AL001); type: alarm (ALM); servo turns OFF. Condition: main circuit current is over 1.5 times of the maximum instantaneous current of the motor.",
        "causes": [
          "Motor has a short-circuit or fault to ground (frame).",
          "Motor wiring is wrong.",
          "IGBT is abnormal.",
          "Parameter setting is wrong.",
          "Control command setting is wrong."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the connection between the motor and servo drive and make sure that the wire is not short-circuited. Do not expose the metal part of the wiring. Check if you have followed the wiring sequence of the motor and servo drive as described in this manual.",
          "Check if the target Torque/Speed/Position commanded changes greatly. If so, please modify the rate of change in the command or enable the filter."
        ],
        "fix": [
          "If the temperature of the heat sink is abnormal, please contact AutomationDirect technical support. Check if the setting value is much greater than the default. It is suggested that you reset the servo drive to the factory default settings and then modify the settings one by one.",
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
          "Incorrect selection of the regenerative resistor or no connection to an external regenerative resistor. This will occur if the DC bus voltage is over 410V for over 1 second."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Use a voltmeter to check if the input voltage of the main circuit is within the rated range (refer to Appendix A Specifications). Use the right voltage source or connect the regulator in series. Use a voltmeter to check if the power system complies with the specifications. If not, use the right voltage source or connect the transformer in series.",
          "Check if the input voltage of the main circuit is within the rated range. If the issue persists, please contact AutomationDirect technical support.",
          "Check the connection for the regenerative resistor, re-calculate the value for the regenerative resistor, and correctly set the values of P1.052 and P1.053."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-10, AL002; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL003",
        "title": "Undervoltage",
        "symptom": "7-segment display shows AL.003 (AL003); type: warning (WARN); servo turns OFF. Condition: 1) Main circuit voltage is below the rated value. By default, AL003 is defined as a warning. To define it as an alarm, set P2.066 [Bit 9]. 2) The DC Bus voltage is below P4.024 x √2",
        "causes": [
          "The input voltage of main circuit is lower than the permissible rated value.",
          "No power is supplied to the main circuit.",
          "Wrong power input (wrong power system)."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check that the voltage wiring is correct and the input voltage for the main circuit is normal.",
          "Cycle the servo drive power and use a voltmeter to check the main circuit voltage.",
          "Use a voltmeter to check if the power system complies with the specifications. Check if using the right voltage source or the transformer is connected in series."
        ],
        "fix": [
          "How to clear: AL003 is cleared according to the setting of P2.066 [Bit2] 1) If P2.066 [Bit2] is set to 0, use DI.ARST (alarm reset input) to clear the alarm after the voltage is back in the normal range. 2) If P2.066 [Bit2] is set to 1, the alarm is automatically cleared once the voltage is back in the normal range."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Re-calculate the value for the regenerative resistor and reset the value of P1.052 and P1.053. If you cannot clear the alarm, please contact AutomationDirect technical support.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the wiring of UVW and the encoder cables is correct."
        ],
        "fix": [
          "Set P0.002 to 11 to monitor the servo drive status. Check if the average torque [%] is continuously over 100%. If so, please increase the motor capacity or reduce the load. Refer to Load and operation time in Appendix A for more details. • Check if there is any mechanical vibration. • Acceleration/deceleration constant is set too high.",
          "Contact AutomationDirect technical support.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-12, AL006; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL007",
        "title": "Excessive Speed Deviation",
        "symptom": "7-segment display shows AL.007 (AL007); type: alarm (ALM); servo turns OFF. Condition: deviation from the Speed command and the feedback speed exceeds the allowable range (P2.034).",
        "causes": [
          "A drastic change in speed.",
          "Incorrect setting for P2.034.",
          "Incorrect wiring of the UVW and/or encoder cables."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.008 (AL008); type: alarm (ALM); servo turns OFF. Condition: the input frequency for the pulse command is over the allowable value for the hardware interface.",
        "causes": [
          "the pulse command frequency is higher than the rated input frequency."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.009 (AL009); type: alarm (ALM); servo turns OFF. Condition: Deviation of position command and feedback exceeds the allowable range (P2.035).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.010 (AL010); type: alarm (ALM); servo stays ON. Condition: 1) When the regenerative resistor is incorrectly selected or no external regenerative resistor is connected, the regenerative voltage remains at 400V for a period of time during regeneration. 2) P1.053 (Regenerative resistor watts) is not set to 0 when the regenerative resistor is not connected.",
        "causes": [
          "1) When the regenerative resistor is incorrectly selected or no external regenerative resistor is connected, the regenerative voltage remains at 400V for a period of time during regeneration. 2) P1.053 (Regenerative resistor watts) is not set to 0 when the regenerative resistor is not connected."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the connection for the regenerative resistor, re-calculate the value for the regenerative resistor, and correctly set the values of P1.052 and P1.053. If the issue persists, please contact AutomationDirect technical support."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the wiring follows the instructions in the user manual. If not, connect the wiring correctly.",
          "Check if the CN2 connector and the encoder connector are loose. If so, reconnect the connectors.",
          "Check both of the connections between the encoder and CN2 of the servo drive to see if there is any poor wiring or damaged wires. If so, please replace the connector and cable."
        ],
        "fix": [
          "Please check the communication error status by setting P0.002 to -80. If the value continuously increases, it means there is interference. Please check the following: • Make sure the servo motor is well grounded. Please connect the ground of UVW connector (Green) to the heat sink of the servo drive. • Check if the connection for the encoder signal cable is normal. Make sure that you separate the encoder signal cable from the main power circuit cable to avoid interference. • Use shielded cable for the encoder.",
          "If you took all corrective actions but the issue persists, please replace the motor.",
          "How to clear: Re-power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-14, AL011; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL012",
        "title": "Adjustment Error",
        "symptom": "7-segment display shows AL.012 (AL012); type: alarm (ALM); servo turns OFF. Condition: the calibration value exceeds the allowable value during electric calibration.",
        "causes": [
          "The analog input contact is not correctly set to zero.",
          "The detection device is damaged."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the voltage at the analog input contact is the same as the ground voltage. Reset the power supply. If the issue persists, please contact Automation Direct."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Parameter writing error or the value exceeds the permissible range. This error occurs when parameters are restored to the default and servo drive type is incorrect.",
          "Data in ROM is damaged or there is no data in ROM. This occurs when the system is in Servo On status. If this alarm occurs, please contact AutomationDirect technical support."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Press the SHIFT key on the panel and “EXGAB” is displayed. X = 1, 2, 3 G = Group No. of the parameter AB = Parameter No. in hexadecimal format If the panel displays E320A, this is parameter P2.010; if E3610 is displayed, this is P6.016. Please check the value for the displayed parameter.",
          "Press the SHIFT key to display the parameter code. If this alarm occurs when power is supplied to the drive, it means a parameter value has exceeded the range. You can modify the value and then cycle the power. If the error occurs during normal operation, it means an error occurred when writing the parameter.",
          "Press the SHIFT key on the panel and E100X is displayed. If this alarm occurs while parameters are being restored to the default, it means the servo model type setting is incorrect. Please correct it.",
          "Press the SHIFT key on the panel and E0001 is displayed. If this alarm occurs while power is being supplied, it is usually because the data in ROM is damaged or there is no data in the ROM. Please contact AutomationDirect technical support.",
          "How to clear: If this alarm occurs when the drive is started, please reset the parameters and then cycle the power. If the alarm occurs during operation, please reset the alarm."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-16, AL017; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL018",
        "title": "Abnormal Encoder Signal Output",
        "symptom": "7-segment display shows AL.018 (AL018); type: alarm (ALM); servo turns OFF. Condition: output frequency of the encoder is higher than the rated output frequency of the hardware.",
        "causes": [
          "Pulse resolution of the encoder is set too high.",
          "There is interference or cable damage causing communication error.",
          "Encoder error."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the error log (P4.000—P4.005) and see if an alarm has occurred (AL011, AL024, AL025, and AL026). Use the checking methods and corrective actions to clear the alarm if any of them occurs."
        ],
        "fix": [
          "The setting of P1.076 and P1.046 should follow these requirements: P1.076 > motor speed and Motor speed x P1.046 x 4 < 19.8 x106 60",
          "Please check the communication error status by setting P0.002 to -80. If the value continuously increases, it means there is interference. Please check the following: • Make sure the servo motor is properly grounded and connect the UVW connector (color green) to the heat sink of the servo drive. • Check if the connection of encoder signal cable is normal. Make sure that you separate the encoder signal cable from the main power circuit cable to avoid interference. • Use shielded cable for the encoder.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.022 (AL022); type: warning (WARN); servo turns OFF. Condition: RST power cable is loose or there is no power. The default setting of AL022 is a warning. To set AL022 as an alarm, you can set P2.066 [Bit 12].",
        "causes": [
          "RST leak phase."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the RST power cable is loose or there is no power. For 3kW (or above) SureServo2 servo drives, the alarm occurs when one single phase is not connected to the power supply. Correctly connect the power to the servo drive. If the issue persists, please contact AutomationDirect technical support."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure the servo motor is properly grounded and connect the UVW connector (color green) to the heat sink of the servo drive.",
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder.",
          "If using an external encoder, check the wiring noise interference. For the noise filter of the CN5 position feedback signal connector, refer to P1.074. If the issue persists, please contact AutomationDirect technical support.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check grounding and connections: • Make sure the servo motor is properly grounded and connect the UVW connector (color green) to the SureServo2 servo drive heat sink. • Make sure the encoder cable is separated from the power supply or any high- current cables to avoid interference. • Use shielded cable for the encoder."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "To correct the interference, check the following descriptions:",
          "Make sure the servo motor is properly grounded and connect the UVW connector (color green) to the SureServo2 servo drive heat sink.",
          "Make sure the encoder cable is separated from the power supply or any high-current cables to avoid interference.",
          "Use shielded cable for the encoder.",
          "Set P0.002 to -80 by using the panel to monitor the communication error status. If the value is greater than 0 and the value increases continuously, please check steps 1—3 again. If the value is 0, contact AutomationDirect technical support.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the encoder cable is firmly connected.",
          "Check if the power supply for the encoder is stable and make sure to use shielded cable.",
          "Check if the operation temperature is over 95°C. Identify the cause for the high temperature and do not restart operation before the temperature falls back into the allowable range. If issue persists, please contact Automation Direct technical support."
        ],
        "fix": [
          "How to clear: Re-power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-19, AL027; alarm list 11.1 p.11-3)"
      },
      {
        "code": "AL028",
        "title": "Encoder Voltage Error or Encoder Internal Error",
        "symptom": "7-segment display shows AL.028 (AL028); type: alarm (ALM); servo turns OFF. Condition: servo drive charging circuit is not removed so the battery voltage is higher than the specification (>3.8 V) or the encoder signal is in error.",
        "causes": [
          "Voltage level of the battery is too high.",
          "Internal encoder error."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check and remove the cause for the alarm. If the issue persists, please contact AutomationDirect technical support. • Make sure the servo motor is properly grounded and connect the UVW connector (color green) to the servo drive heat sink. • Make sure the encoder cable is separated from the power supply or any high- current cables to avoid interference. • Use shielded cable for the encoder. If issue persists, please contact AutomationDirect technical support."
        ],
        "fix": [
          "Follow the testing procedure for over-voltage/over-current and troubleshoot. This automatically clears AL028. • Check the servo drive charging circuit. Avoid incorrect wiring; if Pin 1 (5V) of CN2 is connected to BAT+, it means the power (5V) of the servo drive is being charged to the battery. • Check if the battery is correctly installed (voltage > 3.8 V).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.02C (AL02C); type: alarm (ALM); servo stays ON. Condition: 1) The servo drive has exceeded the rated load for a continuous time. 2) The gain parameter of the control system or the motion profile setting is inappropriate. 3) Incorrect wiring of the motor and encoder. 4) Motor encoder is damaged or defective.",
        "causes": [
          "1) The servo drive has exceeded the rated load for a continuous time. 2) The gain parameter of the control system or the motion profile setting is inappropriate. 3) Incorrect wiring of the motor and encoder. 4) Motor encoder is damaged or defective."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the monitoring variable “motor current (ampere)” has exceeded the rated output current of the servo drive for a long period of time. a) Check if there is mechanical vibration and adjust the control gain parameter appropriately. b) If the acceleration/deceleration time setting is too short, reduce the acceleration/ deceleration speed setting.",
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
        "symptom": "7-segment display shows AL.030 (AL030); type: alarm (ALM); servo turns OFF. Condition: when the motor hits the device, the torque reaches the value of P1.057 and lasts for the time set by P1.058.",
        "causes": [
          "Check if the function of motor crash protection (P1.057) is enabled. If so, please set P1.057 to 0.",
          "Check if the value of P1.057 is set too low and the time set by P1.058 is too short. Please set P1.057 according to the actual torque. Incorrect values might inadvertently trigger the signal or lose the protection function."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.031 (AL031); type: alarm (ALM); servo turns OFF. Condition: incorrect wiring or disconnection of the power cable U, V, W, and GND.",
        "causes": [
          "Incorrect wiring or disconnection of motor power cable U, V, W. The switch for cut-off detection is set by P2.065 Bit 9, which default is set to disable. The switch for wiring error detection is set by P2.065 Bit 8, which is disabled by default."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor power cable (U, V, W, GND) is firmly connected. Please connect wiring and ground properly by following the instructions in this user manual."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.034 (AL034); type: alarm (ALM); servo turns OFF. Condition: 1) Internal communication error for the absolute type encoder. 2) Internal error for the other type of encoder.",
        "causes": [
          "encoder internal communication error."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Set P0.002 to -124 in order to read the temperature and check if it is below 100°C. If the encoder temperature is higher than 100°C, please improve the heat dissipation or reduce the operating load. If the temperature difference between the motor and the displayed temperature value is over 30°C, please send the motor back to the distributor.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the motor is properly grounded. Make sure the power cable (green end) is grounded to the servo drive heat sink.",
          "Check if the connection for the encoder signal cable is normal. Make sure the encoder signal cable is separated from the power supply or any high-current cables to avoid interference.",
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
          "The input value for P1.072 can only be an integer. However, when the motor runs a cycle, if the number of A/B pulses in a full-closed loop is not an integer, the position error between the motor encoder and the auxiliary encoder accumulates. Thus, you need to set P1.085 to avoid triggering AL040."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.042 (AL042); type: alarm (ALM); servo turns OFF. Condition: Analog input voltage for the speed command is higher than the level specified by P1.083.",
        "causes": [
          "Analog input voltage for the speed command is higher than the level specified by P1.083."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.044 (AL044); type: warning (WARN); servo stays ON. Condition: when the motor controlling function of servo drive is overloaded, the motion control function is affected, causing PR or E-Cam operation to be in error.",
        "causes": [
          "Servo function overload warning."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the filter is enabled and see if enabling the filter is necessary."
        ],
        "fix": [
          "Set P2.066 Bit4 to 1 to disable this alarm.",
          "How to clear: 1) Disable the filter if it is not required, such as the low-pass filter (P1.006 – P1.008), moving filter (P1.068), low-frequency vibration suppression (P1.025 – P1.028), vibration elimination (P1.089 – P1.094), or Notch filter (5 sets), percentage of friction compensation (P1.062), and motor hard stop (torque percentage)(P1.057). 2) Set P2.066 Bit4 to 1 and cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-22, AL044; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL045",
        "title": "E-Gear Ratio Value Error",
        "symptom": "7-segment display shows AL.045 (AL045); type: alarm (ALM); servo turns OFF. Condition: when the value of the E-Gear ratio exceeds the range (1/4–262144), this alarm occurs once power to the servo drive is cycled.",
        "causes": [
          "when the servo drive is powered on, E-Gear ratio value is in error."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the value for the E-gear ratio is within the allowable range (1/4–262144). Correct the value in P1.044, P1.045, or P2.00-P2.062 and then cycle power on the servo drive."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive after the value is corrected."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-23, AL045; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL056",
        "title": "Excessive Motor Speed",
        "symptom": "7-segment display shows AL.056 (AL056); type: alarm (ALM); servo turns OFF. Condition: when the filtered motor speed exceeds the setting of P1.111, the servo drive immediately switches to the Servo Off state and displays this alarm.",
        "causes": [
          "this alarm is to remind the user that the motor speed has reached the upper limit of the current setting (P1.111)."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the reason for the high motor speed, such as the set value of P1.111 is too small, the bandwidth is not set properly, or the motor parameter setting does not match the motor specification."
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
        "symptom": "7-segment display shows AL.057 (AL057); type: alarm (ALM); servo turns OFF. Condition: when P2.081 is set to 1, the servo drive will detect if there is pulse leakage. When the pulse leakage exceeds the set value of P2.082, this alarm is triggered.",
        "causes": [
          "Pulse leakage occurs during motor operation.",
          "The pulse signal is interfered by noise."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if pulse leakage has occurred to the motor encoder feedback due to noise interference.",
          "Check if P2.083 is set correctly."
        ],
        "fix": [
          "If there is interference, check the following items: (a) Check if the motor is properly grounded. Make sure the power cable (green end) is grounded to the servo drive heat sink. (b) Use shielded cable for the feedback signal cable. Make sure the signal cable is separated from the power supply or any high-current cables to avoid interference.",
          "If the encoder feedback type is a square-wave digital signal, check if the motor speed is too fast and exceeds the maximum limit of 20 MHz that the hardware can receive (the limit multiplied by 4 times the frequency).",
          "In addition to eliminating the noise interference, if the encoder type is a square wave digital signal, you can also filter the noise by setting the applicable filter functions. When the main encoder signal source is CN5, set P1. 074.U.",
          "Set the maximum speed limit of the motor with P1.055.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-23, AL057; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL058",
        "title": "Excessive Position Deviation after Initial Magnetic Field Detection is Complete",
        "symptom": "7-segment display shows AL.058 (AL058); type: alarm (ALM); servo turns OFF. Condition: 1) After the initial magnetic field detection is complete, the servo system then attempts, but fails to reduce the existing position error. 2) If the controller issues commands when the servo system is not fully settled, the position error might thus be greater and cannot be reduced.",
        "causes": [
          "the controller issues commands during initial magnetic field detection."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the controller has issued a command immediately when it is powered on. Use the software scope and select [Command position] to monitor whether there is a command issued. If so, increase the delay time for the controller to issue the command after it is powered on."
        ],
        "fix": [
          "If the controller time sequence cannot be modified due to surge interference or other factors when powered on, set P2.088 [Bit 4] to 1 to prohibit the servo from receiving controller commands during the initial magnetic field detection.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the feedback signal is abnormal. Use the software scope and select Feedback position [PUU] as the input signal for the channel and sample at 16 kHz or 20 kHz, and then operate the motor manually to monitor whether the feedback value has discontinuous sudden jumps.",
          "Check if the feedback signal is interfered, causing sudden jumps to the motor position feedback."
        ],
        "fix": [
          "If the source of the main encoder is CN2, check if the communication error rate is increased due to interference. For example, check the communication error rate by setting P0.017 to -80 and monitor whether the value of P0.009 is not 0 and continuously increases.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-24, AL05C; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL060",
        "title": "Absolute Position is Lost",
        "symptom": "7-segment display shows AL.060 (AL060); type: warning (WARN); servo stays ON. Condition: losing number of revolutions because of low battery voltage or loss of the power.",
        "causes": [
          "Voltage level of the battery is too low.",
          "The battery is replaced when the main power of the servo drive is off.",
          "The battery is not installed when the absolute function is enabled.",
          "Poor connection or disconnection of the battery power circuit."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the battery voltage is below 2.9V; execute homing after changing the battery. Please refer to Chapter 10 Absolute servo system for more details about initializing the absolute coordinate system."
        ],
        "fix": [
          "Do not change or remove the battery when the SureServo2 servo drive’s main power is off. To execute homing again, please refer to Chapter 10 for absolute coordinate initialization.",
          "Please follow the instructions below: • Install the battery. • Check the connection between the battery power source and the servo drive. • Check the encoder wiring.",
          "Connect or correct the wiring so that the battery power is supplied to the encoder and then execute homing again. • Check the encoder wiring. • Check the connection between the battery box and servo drive.",
          "How to clear: Connect or reconnect the wiring so that the battery power is supplied to the encoder and then re-establish the absolute origin coordinates. Refer to Chapter 10 for more information on the absolute servo system."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-25, AL060; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL061",
        "title": "Encoder Undervoltage",
        "symptom": "7-segment display shows AL.061 (AL061); type: warning (WARN); servo stays ON. Condition: voltage level of the absolute encoder battery is lower than the allowable value (3.1V).",
        "causes": [
          "voltage level of the battery is too low."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.062 (AL062); type: warning (WARN); servo stays ON. Condition: the number of turns for the absolute encoder exceeds the range: -32768 to +32767.",
        "causes": [
          "motor’s rotation cycle exceeds the allowable range."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the linear scale and read head are installed correctly, and then set DI.ARST to On or cycle power on the servo drive. If the issue persists and you have ensured the CN5 encoder is correct, send your servo motor back to AutomationDirect."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.066 (AL066); type: alarm (ALM); servo stays ON. Condition: the number of turns for the encoder absolute position (P0.051) exceeds half the number of turns for the encoder resolution. 1) The number of turns for a motor is -32768 to +32767. 2) For third-party motors, calculate the number of turns based on the motor specifications.",
        "causes": [
          "motor’s rotation cycle exceeds the allowable range."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.067 (AL067); type: warning (WARN); servo stays ON. Condition: the encoder temperature is over 85°C (warning level), but still under 100°C, which is within the protective range.",
        "causes": [
          "encoder temperature warning (85°C -- 100°C)."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Set P0.002 to -124 and check if the encoder temperature is identical to the motor temperature. If the encoder temperature is too high, please improve the heat dissipation or reduce the operating load. If the temperature difference between the encoder and motor is over 30°C, please contact AutomationDirect technical support.",
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-26, AL067; alarm list 11.1 p.11-4)"
      },
      {
        "code": "AL06A",
        "title": "Absolute Position is Lost / Absolute Position is not Initialized",
        "symptom": "7-segment display shows AL.06A (AL06A); type: warning (WARN); servo stays ON. Condition: There are two conditions that may cause the loss of absolute position. One is the absolute coordinates are not established. When the absolute origin coordinates are established, the origin is lost after power cycling of the servo drive. The other is an error occurred. After the absolute origin coordinates are established, AL06A still occurs after power cycling of the servo drive. Coordinates are not established. Condition: 1) The servo drive is used for the first time. 2) The battery is drained and the power supply of the servo drive is cut off. 3) When the servo is used with an absolute motor, the user issues an absolute position command after the first use or modification of the E-Gear ratio.",
        "causes": [
          "The servo drive is used for the first time, so the absolute origin coordinates are not established.",
          "Retaining the absolute position requires power supply, so when the battery is drained and the power supply of the servo drive is cut off, the absolute position of the servo is lost.",
          "After the E-Gear ratio is modified, the communication type coordinate system needs to be re-established. An error occurred. Condition:",
          "The encoder cable is damaged, including the exterior and internal wiring.",
          "There is a momentary power failure in the battery power supply.",
          "The absolute motor is in error.",
          "The battery box is used, and J1 and J2 are connected in reverse.",
          "The voltage level of the battery is lower than 2.9V. Cause:",
          "Power supply is unstable due to damage of the encoder cable.",
          "The reason for the momentary power failure may be that the battery box connector is loose or excessive machine vibration.",
          "The absolute encoder of this motor is in error.",
          "If J1 and J2 are connected in reverse, the battery cannot charge the capacitor. The capacitor functions as a buffer to supply power when the power supply of the servo drive power is switched to the battery due to a main power failure."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the absolute origin coordinates are established (refer to Section 10.3 for more information).",
          "Check if the wiring is loose. If the wiring is fine, replace the battery box for cross- testing."
        ],
        "fix": [
          "Avoid replacing the battery when the servo drive is powered off. It is suggested to replace the battery when the servo drive is powered on, so the absolute encoder has continuous power supply.",
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
        "symptom": "7-segment display shows AL.06B (AL06B); type: warning (WARN); servo stays ON. Condition: when the absolute motor is powered by the battery, the number of motor rotations exceeds half the number of revolutions of the resolution.",
        "causes": [
          "the error between the servo drive internal coordinates and the encoder coordinates is too large."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.070 (AL070); type: warning (WARN); servo stays ON. Condition: Command is not completed when the barcode is written to the encoder.",
        "causes": [
          "Command is not completed when the barcode is written to the encoder."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.072 (AL072); type: alarm (ALM); servo turns OFF. Condition: 1) When encoder is powered by the servo drive: over 8800 rpm; 2) When encoder is powered by the battery: over 10000 rpm. 3) Voltage level of the battery is too low.",
        "causes": [
          "1) When encoder is powered by the servo drive: over 8800 rpm; 2) When encoder is powered by the battery: over 10000 rpm. 3) Voltage level of the battery is too low."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.073 (AL073); type: alarm (ALM); servo turns OFF. Condition: An error occurs when the encoder is reading data from, or writing data to EEPROM.",
        "causes": [
          "An error occurs when the encoder is reading data from, or writing data to EEPROM."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.079 (AL079); type: alarm (ALM); servo turns OFF. Condition: The encoder is not cycled after the parameter is written, so the parameter value is not updated.",
        "causes": [
          "The encoder is not cycled after the parameter is written, so the parameter value is not updated."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.07C (AL07C); type: warning (WARN); servo stays ON. Condition: The command to clear the absolute position is issued when the motor speed is over 200 rpm.",
        "causes": [
          "The command to clear the absolute position is issued when the motor speed is over 200 rpm."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if a command to clear the absolute position is issued while motor speed is over 200 rpm. If so, follow the procedure for clearing the absolute position to clear this alarm. Do not issue a command to clear the absolute position when the motor speed is over 200 rpm."
        ],
        "fix": [
          "How to clear: Cycle power on the servo drive."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-31, AL07C; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL07D",
        "title": "Servo Drive Power Is Cycled Before AL07C is Cleared",
        "symptom": "7-segment display shows AL.07D (AL07D); type: alarm (ALM); servo turns OFF. Condition: AL07C occurs and is not cleared before the power is cycled on the servo drive, and the motor stops operating.",
        "causes": [
          "AL07C occurs and is not cleared before the power is cycled on the servo drive, and the motor stops operating."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If the issue persists, set P0.002 to -81 to check the communication quality with the encoder. If communication is normal, use DI.ARST to clear this alarm.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.083 (AL083); type: alarm (ALM); servo turns OFF. Condition: during general operation, this alarm occurs when the servo drive outputs current that is over the allowable level specified by the firmware. This alarm protects IGBT from overheating or burning out because of the high current.",
        "causes": [
          "UVW cable is short-circuited.",
          "Motor wiring is wrong.",
          "Interference on the analog signal GND for the servo drive."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the connection between the motor power cable and its connector. If metal wire is exposed or the wire is torn, the UVW cable can short-circuit. In this case, please replace the UVW cable and prevent the metal conductor from being exposed.",
          "Check if the analog signal GND is mistakenly connected to another ground signal (incorrect connection can cause interference). DO NOT use a common ground for the analog signal and GND. Follow the wiring instructions in Chapter 3."
        ],
        "fix": [
          "Refer to Chapter 3 Wiring and check the following: • If you do not use the AutomationDirect standard power cable, make sure the UVW wiring sequence is correct. • Make sure the UVW wiring between the servo drive and the motor is correctly connected.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the connections for the regenerative resistor, re-calculate the value for the regenerative resistor, and reset the value of P1.052 and P1.053. If this does not clear the alarm, please contact AutomationDirect technical support."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-32, AL085; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL086",
        "title": "Regenerative Resistor Overload",
        "symptom": "7-segment display shows AL.086 (AL086); type: alarm (ALM); servo turns OFF. Condition: excessive energy in the capacitor of the servo drive is released to the regenerative resistor causing overload of the resistor.",
        "causes": [
          "Incorrect selection of the regenerative resistor or no connection to an external regenerative resistor.",
          "Incorrect parameter settings for P1.052 and P1.053.",
          "Other energy (such as interference) is input to the servo drive or the input voltage is higher than the allowable rated voltage.",
          "Malfunction of the servo drive hardware."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the connection for the regenerative resistor and correctly set the values of P1.052 and P1.053.",
          "Use a voltmeter to measure if the input voltage from the power supply is within the allowable rated voltage (refer to Appendix A Specifications). If the input voltage exceeds the rated range, remove the interference source.",
          "Measure the voltage between P3 and terminals. If it does not match the displayed DC Bus voltage when you enter monitoring code 14 to P0.002, the servo drive may be malfunctioning. Contact AutomationDirect.",
          "If you took the above actions and the issue persists, use a scope with a differential carbon rod to measure whether the input voltage has high-frequency signal interference. If there is interference, remove the interference source, use the right voltage source, or connect the regulator in series."
        ],
        "fix": [
          "Re-assess whether the regenerative energy exceeds the value of P1.053. If the regenerative energy exceeds the set value, replace the regenerative resistor with a regenerative resistor that has a higher capacity.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-33, AL086; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL088",
        "title": "Servo Function Overload Warning",
        "symptom": "7-segment display shows AL.088 (AL088); type: alarm (ALM); servo turns OFF. Condition: too many motor control functions on the servo drive are enabled.",
        "causes": [
          "Servo function overload warning."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If using a filter, see if using this filter is necessary.",
          "How to clear: Disable the filter if not required, such as low-pass filter (P1.006 — P1.008), moving filter (P1.068), low-frequency vibration suppression (P1.025 — P1.028), vibration elimination (elasticity compensation) (P1.089 — P1.094), or Notch filter (5 sets), percentage of friction compensation (P1.062), and motor hard stop - torque percentage (P1.057)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check the environment around the servo drive to see if there is any interference source."
        ],
        "fix": [
          "How to clear: Remove or reposition the interference source. Set P2.112 [Bit 1] to 0 to disable AL089. If the issue persists, please contact AutomationDirect technical support."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-33, AL089; alarm list 11.1 p.11-5)"
      },
      {
        "code": "AL08A",
        "title": "Auto-tuning Function - Command Error",
        "symptom": "7-segment display shows AL.08A (AL08A); type: warning (WARN); servo stays ON. Condition: no command is issued when the servo drive starts the auto-tuning procedure.",
        "causes": [
          "When the command source is the controller, neither the controller nor the position register issue the command.",
          "When command source is the servo drive, position 1 and 2 specify the same position.",
          "The signal cable is not connected or incorrectly connected so that the servo drive cannot receive the command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.08B (AL08B); type: warning (WARN); servo stays ON. Condition: the pause time is too short when the controller is the command source in the auto-tuning procedure. The auto-tuning algorithm requires a certain amount of time to perform the calculation. The tuning result is affected if the pause time is too short.",
        "causes": [
          "pause time in the cycle is too short."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.08C (AL08C); type: warning (WARN); servo stays ON. Condition: inertia estimation error occurs when the servo drive starts the auto-tuning procedure.",
        "causes": [
          "Acceleration/deceleration time is too long.",
          "Rotation speed is too slow.",
          "Inertia of the machine is too large.",
          "Inertia variation is too drastic."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.095 (AL095); type: warning (WARN); servo stays ON. Condition: The value of P1.053 (wattage of regenerative resistor) is not 0 and the external regenerative resistor or the brake is not connected. Only servo drives of 5.5 kW or above that have built-in regenerative resistors show this alarm.",
        "causes": [
          "The value of P1.053 (wattage of regenerative resistor) is not 0 and the external regenerative resistor or the brake is not connected. Only servo drives of 5.5 kW or above that have built-in regenerative resistors show this alarm."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If the regenerative brake is required for dynamic braking, please connect the regenerative resistor. Once you connect the resistor, make sure that the value of P1.053 is correct.",
          "If not using the regenerative brake, set P1.053 (wattage of regenerative resistor) to 0. If the issue persists, please contact AutomationDirect technical support.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.221 (AL221); type: warning (WARN); servo stays ON. Condition: the drive is set for a non-existent Mode or a command was issued that is not valid in the current mode.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Verify there is a proper setting in P1.001 and that any DI or communication commands that are being triggered are relevant to the current operating mode. If P1.001 is correct and this problem persists, record the steps that lead to this issue and contact AutomationDirect.",
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-35, AL221; alarm list 11.1 p.11-6)"
      },
      {
        "code": "AL223",
        "title": "Some Commands are Not Allowed to be Used When the Servo is in the ERROR or FAULT state",
        "symptom": "7-segment display shows AL.223 (AL223); type: warning (WARN); servo stays ON. Condition: the servo is in the ERROR or FAULT state when a specific command is used.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.21B (AL21B); type: warning (WARN); servo stays ON. Condition: when a tack control command is used, the memory address it out of range.",
        "causes": [
          "incorrect use of the command of the firmware."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.239 (AL239); type: warning (WARN); servo stays ON. Condition: when the LOOP_CMD command is used, the input argument it out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.23F (AL23F); type: warning (WARN); servo stays ON. Condition: when the command for writing the parameter is used, the parameter is written to the memory address that is out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.247 (AL247); type: warning (WARN); servo stays ON. Condition: the function ID of the math function called by the MATH_ACC command is out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.251 (AL251); type: warning (WARN); servo stays ON. Condition: when the MATH_POWER command is used, the argument is not within the range of 0–10.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.255 (AL255); type: warning (WARN); servo stays ON. Condition: when the system object is used, the object ID is out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.257 (AL257); type: warning (WARN); servo stays ON. Condition: when the system object is used, the object function block ID is out of range.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.25F (AL25F); type: warning (WARN); servo stays ON. Condition: when an object dictionary command is used, an error occurs because the value is out of range or the object dictionary does not exist.",
        "causes": [
          "incorrect use of firmware command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.35F (AL35F); type: warning (WARN); servo stays ON. Condition: The rising edge of DI(0x47) is triggered, and then the motor decelerates to 0 and triggers AL3CF.",
        "causes": [
          "The rising edge of DI(0x47) is triggered, and then the motor decelerates to 0 and triggers AL3CF."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.422 (AL422); type: alarm (ALM); servo turns OFF. Condition: if P2.069.Z is set to 1 (prevent indexing coordinate overflow = yes) and the power supply is cut off, the motor fails to store the current position.",
        "causes": [
          "The load is over the trated range and the servo drive is in a continous overload condition.",
          "After firmware update, the internal variables vary depending on the version.",
          "The servo drive hardware EEPROM is abnormal.",
          "The hardware of the servo drive is short-circuited.",
          "AL520 occurred and cause malfunction of the servo drive."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Set P0.002 to 12 for monitoring if the average load rate (%) is continuously over 100%. If so, increase the motor capacity or reduce the load. Refer to Appendix A for graph of load and operating time.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Safe torque off function (STO) is enabled. Please check why it is enabled.",
          "How to clear: 1) Use DI.ARST (alarm reset input) or 0x6040.Fault Reset, or set P0.001 to 0. 2) If not using STO, plug the short circuit device into CN10 or wiring to short circuit the block. Follow the instructions in Section 3.11.3 for the STO wiring."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-39, AL500; alarm list 11.1 p.11-7)"
      },
      {
        "code": "AL501",
        "title": "STO_A Loss (signal loss or signal error)",
        "symptom": "7-segment display shows AL.501 (AL501); type: alarm (ALM); servo turns OFF. Condition: Loss of STO_A signal or STO_A and STO_B signals are not synchronized for more than 1sec.",
        "causes": [
          "Loss of STO_A signal or STO_A and STO_B signals are not synchronized for more than 1sec."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.502 (AL502); type: alarm (ALM); servo turns OFF. Condition: Loss of STO_B signal or STO_A and STO_B signals are not synchronized for more than 1 sec.",
        "causes": [
          "Loss of STO_B signal or STO_A and STO_B signals are not synchronized for more than 1 sec."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.510 (AL510); type: warning (WARN); servo stays ON. Condition: Internal parameter update program of the servo drive is abnormal.",
        "causes": [
          "Internal parameter update program of the servo drive is abnormal."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If this alarm occurs when the motor parameter identification function is executed, cycle power on the servo drive and re-execute the motor parameter identification function.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.521 (AL521); type: alarm (ALM); servo turns OFF. Condition: the value for the vibration elimination parameter (elasticity compensation) is not appropriate.",
        "causes": [
          "The value of vibration suppression (elasticity compensation) is incorrect.",
          "The Bode plot is in error due to other variables while the operation system is analyzing the program."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Perform system analysis again and correctly set the value for the vibration elimination parameter.",
          "How to clear: 1) Perform system analysis again and correctly set the value for the vibration elimination parameter. 2) If the issue persists, please disable the vibration elimination function P2.094 [Bit 8] & [Bit 9]."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-40, AL521; alarm list 11.1 p.11-7)"
      },
      {
        "code": "ALF21",
        "title": "Command Error",
        "symptom": "7-segment display shows AL.F21 (ALF21); type: alarm (ALM); servo turns OFF. Condition: the use of the firmware commands does not comply with the specifications.",
        "causes": [
          "servo status mode error. It could occur when servo is in motion status and reconnecting status at the same time."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.112 (AL112); type: alarm (ALM); servo stays ON. Condition: PDO Rx Buffer overflow (receives more than two PDOs of COBID within 1ms)",
        "causes": [
          "PDO Rx Buffer overflow (receives more than two PDOs of COBID within 1ms)"
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.121 (AL121); type: alarm (ALM); servo stays ON. Condition: When the servo drive receives the PDO from the controller, the specified object’s index number is incorrect so that the servo drive cannot identify it.",
        "causes": [
          "When the servo drive receives the PDO from the controller, the specified object’s index number is incorrect so that the servo drive cannot identify it."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the object’s index for PDO mapping for the controller is correct."
        ],
        "fix": [
          "If the index number is correct, it means this specified object is not supported by the servo drive. Please check if it is necessary to use this object, or if you can substitute a different object.",
          "How to clear: NMT: reset node or 0x6040 (Fault Reset).."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-41, AL121; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL122",
        "title": "Object’s Sub-index Does Not Exist When PDO is received",
        "symptom": "7-segment display shows AL.122 (AL122); type: alarm (ALM); servo stays ON. Condition: When the servo drive receives the PDO from the controller, the specified object’s sub- index number is incorrect so that the servo drive cannot identify it.",
        "causes": [
          "When the servo drive receives the PDO from the controller, the specified object’s sub- index number is incorrect so that the servo drive cannot identify it."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the object’s sub-index for PDO mapping for the controller is correct."
        ],
        "fix": [
          "If the sub-index number is correct, it means this specified object is not supported by the servo drive. Please check if it is necessary to use this object, or if you can substitute a different object.",
          "How to clear: NMT: reset node or 0x6040 (fault reset.)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-41, AL122; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL123",
        "title": "Data Size Error Occurs When PDO is Received",
        "symptom": "7-segment display shows AL.123 (AL123); type: alarm (ALM); servo stays ON. Condition: Data length in the message does not match the length of the specified object.",
        "causes": [
          "Data length in the message does not match the length of the specified object."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.124 (AL124); type: alarm (ALM); servo stays ON. Condition: The data value in the message is out of range for the specified object.",
        "causes": [
          "The data value in the message is out of range for the specified object."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.125 (AL125); type: alarm (ALM); servo stays ON. Condition: The specified object in the message is read-only and write-protected.",
        "causes": [
          "The specified object in the message is read-only and write-protected."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.126 (AL126); type: alarm (ALM); servo stays ON. Condition: The specified object in the message does not support PDO mapping.",
        "causes": [
          "The specified object in the message does not support PDO mapping."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.127 (AL127); type: alarm (ALM); servo stays ON. Condition: The specified object in the message is write-protected when the servo drive is on.",
        "causes": [
          "The specified object in the message is write-protected when the servo drive is on."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.128 (AL128); type: alarm (ALM); servo stays ON. Condition: An error occurs when loading the default value from ROM at start-up. All objects of CAN automatically return to the default value.",
        "causes": [
          "An error occurs when loading the default value from ROM at start-up. All objects of CAN automatically return to the default value."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.129 (AL129); type: alarm (ALM); servo stays ON. Condition: An error occurs when saving the current parameter value into ROM.",
        "causes": [
          "An error occurs when saving the current parameter value into ROM."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.130 (AL130); type: alarm (ALM); servo stays ON. Condition: The quantity of the data in the ROM is greater than the allowable space specified by the firmware. It is probably because the firmware has been updated, but the data in the ROM was stored by the old version of the firmware.",
        "causes": [
          "The quantity of the data in the ROM is greater than the allowable space specified by the firmware. It is probably because the firmware has been updated, but the data in the ROM was stored by the old version of the firmware."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.131 (AL131); type: alarm (ALM); servo stays ON. Condition: The data in ROM is damaged; all objects are automatically restored to default values.",
        "causes": [
          "The data in ROM is damaged; all objects are automatically restored to default values."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the specified object causes a CRC calculation error in EEPROM when PDO is being received or sent. Usually, this alarm is caused by an error in DSP."
        ],
        "fix": [
          "How to clear: NMT: reset node or 0x6040 (fault reset) or DI.ARST (alarm reset input)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-43, AL131; alarm list 11.1 p.11-8)"
      },
      {
        "code": "AL132",
        "title": "Parameter is write-prohibited when using PDO",
        "symptom": "7-segment display shows AL.132 (AL132); type: alarm (ALM); servo stays ON. Condition: When using communication object to write data to the parameter, the parameter is currently write-prohibited.",
        "causes": [
          "When using communication object to write data to the parameter, the parameter is currently write-prohibited."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.180 (AL180); type: alarm (ALM); servo turns OFF. Condition: No data message received in the time duration specified in P3.067 on EtherNet/IP Explicit or Modbus TCP. This can be set as a Warning or an Alarm",
        "causes": [
          "No data message received in the time duration specified in P3.067 on EtherNet/IP Explicit or Modbus TCP. This can be set as a Warning or an Alarm"
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the communication cable is intact and firmly connected.",
          "Check the communication quality; it is suggested that you use common grounding and shielded cable."
        ],
        "fix": [
          "For communication type models, check if the value of monitoring variable 120 increases constantly.",
          "How to clear: NMT: reset node or 0x6040 (fault reset) or DI.ARST (alarm reset input) (NOTE: This is an internal alarm and is not dependent on P3.065 or P3.067)"
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "If the alarm is cleared after cycling power on the servo drive, it means the error occurs at the moment when reading the data.",
          "If the issue persists after cycling power on the servo drive, it means the data in the EEPROM is damaged and you need to write the correct value again. See the following methods: • To write the default value, set P2.008 to 30 and then 28",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.301 (AL301); type: warning (WARN); servo stays ON. Condition: the servo drive fails to synchronize with the controller in IP mode.",
        "causes": [
          "synchronization failure."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.302 (AL302); type: warning (WARN); servo stays ON. Condition: when using comms, the synchronization signal is received too soon.",
        "causes": [
          "the synchronization signal is sent too soon."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.207 (AL207); type: warning (WARN); servo stays ON. Condition: parameter group for PR Type 8 (Write), P_Group, is out of range.",
        "causes": [
          "the group for PR Type 8 (Write) command source exceeds the range."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.211 (AL211); type: warning (WARN); servo stays ON. Condition: parameter format setting of Type 8 (Write) PR command is in error.",
        "causes": [
          "Incorrect parameter format.",
          "The SureServo2 Pro software version and the firmware version do not match."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.213 (AL213); type: warning (WARN); servo stays ON. Condition: when using PR Type 8 (Write) to write parameters, the parameter value is incorrect.",
        "causes": [
          "parameter value of PR Type 8 (Write) is in error."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.215 (AL215); type: warning (WARN); servo stays ON. Condition: write parameters using PR procedure: the parameter is read-only.",
        "causes": [
          "an error occurs when writing parameters with PR Type 8 (Write) command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.217 (AL217); type: warning (WARN); servo stays ON. Condition: write parameters using PR procedure: the parameter is write-protected when the servo drive is on or the parameter’s value exceeds the range. Condition: an error occurs when writing parameters with PR Type 8 (Write) command.",
        "causes": [
          "write parameters using PR procedure: the parameter is write-protected when the servo drive is on or the parameter’s value exceeds the range. Condition: an error occurs when writing parameters with PR Type 8 (Write) command."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.231 (AL231); type: warning (WARN); servo stays ON. Condition: the value of the monitoring item for PR Type 8 (Write), Sys_Var, exceeds the range.",
        "causes": [
          "the value for the monitoring item is out of range."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.235 (AL235); type: warning (WARN); servo stays ON. Condition: execute a position command after the feedback position counter overflows.",
        "causes": [
          "feedback position counter overflows."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Incremental system: When the motor keeps operating in one direction, this leads to overflow of the position feedback register (FB_PUU), and the coordinate system cannot display the correct position. Executing a positioning command after overflow results in an error. Please use the scope to check if the feedback position has overflowed and then execute the homing procedure. Absolute system: This error occurs when executing the absolute positioning command in the following situations:",
          "Feedback position register (FB_PUU) overflows.",
          "Setting for P1.001.Z changes, but homing has not been completed yet.",
          "E-Gear ratio (P1.044 and P1.045) changes, but homing has not been completed yet.",
          "The function to return to the original point is triggered, but homing has not been completed yet.",
          "When AL060 or AL062 occurs, please use the scope to check if the feedback position has overflowed. Check steps 1—4 above and perform the homing procedure.",
          "How to clear: Perform homing procedure."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-47, AL235; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL237",
        "title": "Indexing coordinate is undefined",
        "symptom": "7-segment display shows AL.237 (AL237); type: warning (WARN); servo stays ON. Condition: using the indexing function and execute positioning command before defining the start point of the indexing coordinate.",
        "causes": [
          "The servo drive cannot identify this coordinate system."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.283 (AL283); type: warning (WARN); servo stays ON. Condition: the target position specified by the command exceeds the software positive limit.",
        "causes": [
          "reaching the software positive limit."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "When you enable the software positive limit function, this alarm is determined by the command instead of by the feedback position. The alarm may occur while the actual position is still within the allowable range. The software positive limit is determined by the Position command instead of the actual feedback position because the command is sent before the feedback is received. That is, the actual position may have not reached the limit when the limit protection has been triggered. To fix this, you can set a proper deceleration time to satisfy the application requirement. Please see description for P5.003.",
          "How to clear: The alarm is automatically cleared after the motor moves away from the limit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-48, AL283; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL285",
        "title": "Software negative limit",
        "symptom": "7-segment display shows AL.285 (AL285); type: warning (WARN); servo stays ON. Condition: target position specified by the command is less than the software negative limit.",
        "causes": [
          "the software negative limit is triggered."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "The software negative limit is determined by the Position command instead of the actual feedback position because the command is sent before the feedback is received. That is, the actual position may have not reached the limit when the limit protection has been triggered. To fix this, you can set a proper deceleration time for the application. Please refer to the description for P5.003.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Please set the gear ratio according to the total traveling distance of the absolute motor and the actual application requirements to avoid the feedback position counter overflow.",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Please refer to the description of P1.048. After DO.MC_OK is on, DO.MC_OK goes off because DO.TPOS turns off. There might be an external force causing the position deviation of the motor after positioning is completed. You can disable this alarm by setting P1.048.Y to 0.",
          "How to clear: DI.ARST (alarm reset input) or set P0.001 to 0."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-48, AL380; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL3CF",
        "title": "DI.PFQS input for quick stop and fault (Emergency Stop)",
        "symptom": "7-segment display shows AL.3CF (AL3CF); type: warning (WARN); servo turns OFF. Condition: After AL35F is triggered and the motor has decelerated to 0, this alarm occurs.",
        "causes": [
          "After AL35F is triggered and the motor has decelerated to 0, this alarm occurs."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
        "symptom": "7-segment display shows AL.3F1 (AL3F1); type: alarm (ALM); servo turns OFF. Condition: in communication mode, an absolute positioning command is issued before absolute coordinate system is created.",
        "causes": [
          "The absolute coordinate system has not been created.",
          "Overflow occurs since the motor keeps rotating in the same direction."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
          "Check if the value of P2.052 is within the allowable setting range. If the setting value is too low, an index coordinate error occurs. Please adjust the value of P2.052."
        ],
        "fix": [
          "How to clear: DI.ARST (alarm reset input)"
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sureservo2/ch11.pdf (Chapter 11 Troubleshooting, 11.2 Causes and Corrective Actions, p.11-49, AL400; alarm list 11.1 p.11-9)"
      },
      {
        "code": "AL404",
        "title": "Value of PR special filter setting is too high",
        "symptom": "7-segment display shows AL.404 (AL404); type: alarm (ALM); servo turns OFF. Condition: the value of the PR special filter (P1.022) is set too high so that the following error exceeds the range.",
        "causes": [
          "following error of internal position exceeds the allowable range."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf).",
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
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
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
        "symptom": "7-segment display shows AL.809 (AL809); type: alarm (ALM); servo turns OFF. Condition: an error occurs when the servo drive decodes the motion command.",
        "causes": [
          "The PR arithmetic operation parameters have to be compiled by the SureServo2 Pro software before being downloaded to the servo drive. Directly editing the PR arithmetic operation parameters through the panel or controller without recompiling the parameters in SureServo2 Pro triggers AL809."
        ],
        "confirm": [
          "Read P0.001 (current drive alarm code) and the fault records P4.000 (Fault record N, most recent) to P4.004 (N-4) in Parameter mode with SET (ch4.pdf 4.4.1, ch8.pdf)."
        ],
        "fix": [
          "Make sure you edit PR arithmetic operation parameters through SureServo2 Pro. Do not directly modify these parameters with the panel or controller.",
          "If this alarm occurs when the servo is not in PR mode, please save the parameter file and contact the AutomationDirect technical support.",
          "For advanced users: you can save the scope screenshot when the alarm occurs. Set P5.007 and P0.001 for the two channels to monitor the status and save the scope.",
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
