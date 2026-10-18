import type { DeviceFaultProfile } from "../deviceFaults";

/**
 * VFD fault profiles: Allen-Bradley PowerFlex 525, Siemens SINAMICS G120C and V20, Yaskawa GA500, ABB ACS380.
 * Every code from the maker manual fault tables, with the drive's own fault-history parameters in `confirm`.
 * ACS380 relay RA / RB states follow the relay drawing (firmware manual p.33) with the default fault output (see pair note).
 */
export const VFD2_FAULTS: DeviceFaultProfile[] = [
  {
    "id": "powerflex-525-vfd",
    "title": "Allen-Bradley PowerFlex 525 AC drive",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "PowerFlex 525"
    },
    "normal": [
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, 200…240 V AC input class (-15%, +10%)",
        "meter": "VAC",
        "expected": "170…264 V AC",
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
        "note": "Voltage tolerance -15%/+10%, p.169",
        "liveWork": true
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, 380…480 V AC input class (-15%, +10%)",
        "meter": "VAC",
        "expected": "323…528 V AC",
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
        "note": "Voltage tolerance -15%/+10%, p.169",
        "liveWork": true
      },
      {
        "terminals": "b005 [DC Bus Voltage] (keypad)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "Between undervoltage trip (190 V DC @ 200…240 V AC, 390 V DC @ 380…480 V AC) and overvoltage trip (405 V DC / 810 V DC respectively)",
        "note": "Protection specifications p.169; b005 p.78"
      },
      {
        "terminals": "11 (+24V DC) to 04 (Digital Common)",
        "state": "powered",
        "meter": "VDC",
        "expected": "+24 V DC (drive-supplied, max 100 mA)",
        "pins": [
          [
            "11",
            "04"
          ]
        ],
        "note": "Control I/O Terminal Designations p.43"
      },
      {
        "terminals": "01 (Stop) to 04 (Digital Common), SRC wiring",
        "state": "run permitted (stop circuit closed; factory jumper 01-11 fitted)",
        "meter": "VDC",
        "expected": "18…24 V DC (= ON)",
        "pins": [
          [
            "01",
            "04"
          ]
        ],
        "note": "I/O Terminal 01 is always a stop input; digital input SRC levels 18…24 V = ON, 0…6 V = OFF (p.42-43, p.170)"
      },
      {
        "terminals": "01 (Stop) to 04, SRC wiring",
        "state": "stop commanded (stop circuit open)",
        "meter": "VDC",
        "expected": "0…6 V DC (= OFF)",
        "pins": [
          [
            "01",
            "04"
          ]
        ],
        "note": "p.170"
      },
      {
        "terminals": "02 (Start/Run FWD) to 04, SRC wiring",
        "state": "Run FWD / Start input ON",
        "meter": "VDC",
        "expected": "18…24 V DC",
        "pins": [
          [
            "02",
            "04"
          ]
        ],
        "note": "Source Mode (SRC) 18…24V = ON, 0…6V = OFF; 6 mA per input (p.170)"
      },
      {
        "terminals": "02 (Start/Run FWD) to 04, SRC wiring",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "0…6 V DC",
        "pins": [
          [
            "02",
            "04"
          ]
        ],
        "note": "p.170"
      },
      {
        "terminals": "02, 03, 05…08 inputs, SNK wiring",
        "state": "input ON",
        "meter": "VDC",
        "expected": "0…6 V DC (Sink Mode: 0…6V = ON, 18…24V = OFF)",
        "note": "p.170; sink/source set by jumper J5 (SNK/SRC), p.42"
      },
      {
        "terminals": "12 (+10V DC) to 14 (Analog Common)",
        "state": "powered",
        "meter": "VDC",
        "expected": "+10 V DC (max 15 mA, for a 1…10 kohm potentiometer)",
        "pins": [
          [
            "12",
            "14"
          ]
        ],
        "note": "p.44"
      },
      {
        "terminals": "13 (0-10V In) to 14 (Analog Common)",
        "state": "speed reference from 0…10 V (or ±10 V)",
        "meter": "VDC",
        "expected": "0…10 V (input impedance 100 kohm)",
        "pins": [
          [
            "13",
            "14"
          ]
        ],
        "note": "p.44, p.170"
      },
      {
        "terminals": "15 (4-20mA In) to 14",
        "state": "speed reference from 4…20 mA",
        "meter": "mA",
        "expected": "4…20 mA (input impedance 250 ohm)",
        "pins": [
          [
            "15",
            "14"
          ]
        ],
        "note": "p.44, p.170"
      },
      {
        "terminals": "16 (Analog Output) to 14",
        "state": "running, default t088 = OutFreq 0…10",
        "meter": "VDC",
        "expected": "0…10 V proportional to output frequency (or 0/4…20 mA with the jumper set to current)",
        "pins": [
          [
            "16",
            "14"
          ]
        ],
        "note": "p.44"
      },
      {
        "terminals": "S1 (Safety 1) to 04 and S2 (Safety 2) to 04",
        "state": "run permitted (both safety inputs energized)",
        "meter": "VDC",
        "expected": "+24 V DC on both (S+ is the +24 V safety supply, internally tied to terminal 11 and referenced to Digital Common)",
        "pins": [
          [
            "S1",
            "04"
          ],
          [
            "S2",
            "04"
          ]
        ],
        "note": "p.43; under normal drive operation both safety inputs are energized (p.243)"
      },
      {
        "terminals": "S1 to 04 or S2 to 04",
        "state": "Safe Torque Off (either input de-energized)",
        "meter": "VDC",
        "expected": "0 V on the de-energized channel; gate control disabled, motor coasts",
        "pins": [
          [
            "S1",
            "04"
          ],
          [
            "S2",
            "04"
          ]
        ],
        "note": "p.243-244"
      },
      {
        "terminals": "R1 (Relay 1 N.O.) to R2 (Relay 1 Common)",
        "state": "powered, ready, no fault (t076 = 0 \"Ready/Fault\", default)",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "R1",
            "R2"
          ]
        ],
        "note": "Relay switches on power-up; back to shelf state on power loss or fault (t076, p.94-95). Rating 3.0 A @ 30 V DC / 240 V AC resistive (p.171)."
      },
      {
        "terminals": "R5 (Relay 2 Common) to R6 (Relay 2 N.C.)",
        "state": "motor not running (t081 = 2 \"MotorRunning\", default)",
        "meter": "continuity",
        "expected": "closed (opens while the motor is receiving power from the drive)",
        "pins": [
          [
            "R5",
            "R6"
          ]
        ],
        "note": "p.43, p.94-95"
      }
    ],
    "pairs": [
      {
        "a": "R1",
        "b": "R2",
        "when": "powered and ready, no fault (t076 = 0 Ready/Fault, default)",
        "note": "N.O. contact of relay 1; returns to shelf state (open) on fault or power removal (p.43, p.94)."
      },
      {
        "a": "R5",
        "b": "R6",
        "when": "motor not running (t081 = 2 MotorRunning, default)",
        "note": "N.C. contact of relay 2; opens when the motor is receiving power (p.43, p.94)."
      },
      {
        "a": "S+",
        "b": "11",
        "when": "always",
        "note": "S+ Safety +24V is internally tied to the +24V DC source (pin 11) (p.43)."
      }
    ],
    "indicators": [
      {
        "name": "FAULT LED",
        "state": "flashing red",
        "meaning": "Drive is faulted (p.61-62, p.160)."
      },
      {
        "name": "LCD display",
        "state": "flashing fault number (e.g. F005)",
        "meaning": "Drive is indicating a fault; press Esc to regain control of the display; b007 [Fault 1 Code] holds the most recent fault (p.160)."
      },
      {
        "name": "ENET (PowerFlex 525 only)",
        "state": "off",
        "meaning": "Adapter is not connected to the network (p.62)."
      },
      {
        "name": "ENET (PowerFlex 525 only)",
        "state": "steady",
        "meaning": "Adapter is connected to the network and drive is controlled through Ethernet (p.62)."
      },
      {
        "name": "ENET (PowerFlex 525 only)",
        "state": "flashing",
        "meaning": "Adapter is connected to the network but drive is not controlled through Ethernet (p.62)."
      },
      {
        "name": "LINK (PowerFlex 525 only)",
        "state": "off",
        "meaning": "Adapter is not connected to the network (p.62)."
      },
      {
        "name": "LINK (PowerFlex 525 only)",
        "state": "steady",
        "meaning": "Adapter is connected to the network but not transmitting data (p.62)."
      },
      {
        "name": "LINK (PowerFlex 525 only)",
        "state": "flashing",
        "meaning": "Adapter is connected to the network and transmitting data (p.62)."
      },
      {
        "name": "Run indicator",
        "state": "lit with output 0 Hz",
        "meaning": "Drive is running but no value is coming from the speed command source (p.165)."
      }
    ],
    "faults": [
      {
        "code": "F002",
        "title": "Auxiliary Input",
        "symptom": "Drive stops, LCD flashes F002 (Auxiliary Input), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "External trip (Auxiliary) input."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "If a DI is set to 12 \"Aux Fault\" (t062…t068), meter it to 04 (Digital Common): SRC mode 0…6 V = OFF, aux circuit open (p.170; t062 option 12 p.90).",
          "Read b014 [Dig In Status] to see which inputs are on (p.81)."
        ],
        "fix": [
          "Check remote wiring.",
          "Verify communications programming for intentional fault.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F003",
        "title": "Power Loss",
        "symptom": "Drive stops, LCD flashes F003 (Power Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Single-phase operation detected with excessive load."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Meter R/L1-S/L2, S/L2-T/L3, R/L1-T/L3 at input: all in range (e.g. 323…528 V AC for 380…480 V AC -15%/+10%). One low/missing = single-phasing (p.169)."
        ],
        "fix": [
          "Monitor the incoming AC line for low voltage or line power interruption.",
          "Check input fuses.",
          "Reduce load.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F004",
        "title": "UnderVoltage",
        "symptom": "Drive stops, LCD flashes F004 (UnderVoltage), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "DC bus voltage fell below the min value."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Check b005 [DC Bus Voltage] and F651 [Fault 1 BusVolts]. UV trip: 190 V DC (100…120 V / 200…240 V AC in), 390 V DC (380…480 V AC in) (p.169).",
          "Measure the line-to-line input voltage at R/L1, S/L2, T/L3 (p.169)."
        ],
        "fix": [
          "Monitor the incoming AC line for low voltage or line power interruption.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F005",
        "title": "OverVoltage",
        "symptom": "Drive stops, LCD flashes F005 (OverVoltage), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "DC bus voltage exceeded max value."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "b005 [DC Bus Voltage] / F651 [Fault 1 BusVolts]: OV trip 405 V DC (100…120 / 200…240 V AC), 810 V DC (380…480 V AC), 1005 V DC (525…600 V AC), p.169",
          "Note whether the trip happens during deceleration (regeneration) or with the motor stopped (high line) using F631 [Fault 1 Freq]."
        ],
        "fix": [
          "Monitor the AC line for high line voltage or transient conditions.",
          "Bus overvoltage can also be caused by motor regeneration. Extend the decel time or install dynamic brake option.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F006",
        "title": "Motor Stalled",
        "symptom": "Drive stops, LCD flashes F006 (Motor Stalled), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "Drive is unable to accelerate or decelerate motor."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Compare b003 [Output Current] with A484, A485 [Current Limit x] (p.165)."
        ],
        "fix": [
          "Raise P041, A442, A444, A446 [Accel Time x] or cut load so output current stays under A484, A485 [Current Limit x] instead of sitting there too long.",
          "Check for overhauling load.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F007",
        "title": "Motor Overload",
        "symptom": "Drive stops, LCD flashes F007 (Motor Overload), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "Internal electronic overload trip."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Compare b003 [Output Current] / F641 [Fault 1 Current] with P033 [Motor OL Current]."
        ],
        "fix": [
          "An excessive motor load exists. Reduce load so drive output current does not exceed the current set by parameter P033 [Motor OL Current].",
          "Verify A530 [Boost Select] setting.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F008",
        "title": "Heatsink OvrTmp",
        "symptom": "Drive stops, LCD flashes F008 (Heatsink OvrTmp), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "Heatsink/Power Module temperature exceeds a predefined value."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Check for blocked or dirty heatsink fins. Verify that ambient temperature has not exceeded the rated ambient temperature.",
          "Check fan.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F009",
        "title": "CC OvrTmp",
        "symptom": "Drive stops, LCD flashes F009 (CC OvrTmp), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "Control module temperature exceeds a predefined value."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Read b028 [Control Temp] (p.83)."
        ],
        "fix": [
          "Check product ambient temperature.",
          "Check for airflow obstruction.",
          "Check for dirt or debris.",
          "Check fan.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F012",
        "title": "HW OverCurrent",
        "symptom": "Drive stops, LCD flashes F012 (HW OverCurrent), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "The drive output current has exceeded the hardware current limit."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Read F641 [Fault 1 Current] and F631 [Fault 1 Freq]; hardware limit is 200%, instantaneous fault 300% (p.169)."
        ],
        "fix": [
          "Check programming. Check for excess load, improper A530 [Boost Select] setting, DC brake volts set too high or other causes of excess current.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F013",
        "title": "Ground Fault",
        "symptom": "Drive stops; the LCD shows the flashing fault number F013 (Ground Fault) and the FAULT indicator flashes red. Type 1 (auto-reset attempted only once).",
        "causes": [
          "A current path to earth ground has been detected at one or more of the drive output terminals."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Power off and bus discharged: lift motor leads from U/T1, V/T2, W/T3; test each lead and the motor windings to ground for a ground fault."
        ],
        "fix": [
          "Check the motor and external wiring to the drive output terminals for a grounded condition.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F015",
        "title": "Load Loss",
        "symptom": "Drive stops, LCD flashes F015 (Load Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Torque current below A490 [Load Loss Level] for longer than A491 [Load Loss Time]. (Not on PowerFlex 523.)"
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Verify connections between motor and load.",
          "Verify level and time requirements.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F021",
        "title": "Output Ph Loss",
        "symptom": "Drive stops, LCD flashes F021 (Output Ph Loss), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "Output Phase Loss (if enabled). Configure with A557 [Out Phas Loss En]."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "With power removed, check continuity of each motor lead from U/T1, V/T2, W/T3 through the motor windings (all three phases connected)."
        ],
        "fix": [
          "Verify motor wiring.",
          "Verify motor.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F029",
        "title": "Analog In Loss",
        "symptom": "Drive stops, LCD flashes F029 (Analog In Loss), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "An analog input is configured to fault on signal loss. A signal loss has occurred. Configure with t094 [Anlg In V Loss] or t097 [Anlg In mA Loss]."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Meter 13-14 (0…10 V in) or current into 15 (4…20 mA in, 250 ohm): near zero / under 4 mA = signal lost (p.44)."
        ],
        "fix": [
          "Check for broken/loose connections at inputs.",
          "Check parameters.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F033",
        "title": "Auto Rstrt Tries",
        "symptom": "Drive stops, LCD flashes F033 (Auto Rstrt Tries), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Drive unsuccessfully attempted to reset a fault and resume running for the programmed number of A541 [Auto Rstrt Tries]."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Read b007…b009 / F604…F610 fault codes to find the fault that was being auto-reset."
        ],
        "fix": [
          "Correct the cause of the fault and manually clear.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F038",
        "title": "Phase U to Gnd",
        "symptom": "Drive stops, LCD flashes F038 (Phase U to Gnd), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "A phase to ground fault has been detected between the drive and motor in this phase."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "With power removed, disconnect the motor lead from U/T1 and check it and the motor phase to ground for a grounded condition."
        ],
        "fix": [
          "Check the wiring between the drive and motor.",
          "Check motor for grounded phase.",
          "Replace drive if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F039",
        "title": "Phase V to Gnd",
        "symptom": "Drive stops, LCD flashes F039 (Phase V to Gnd), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "A phase to ground fault has been detected between the drive and motor in this phase."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "With power removed, disconnect the motor lead from V/T2 and check it and the motor phase to ground for a grounded condition."
        ],
        "fix": [
          "Check the wiring between the drive and motor.",
          "Check motor for grounded phase.",
          "Replace drive if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F040",
        "title": "Phase W to Gnd",
        "symptom": "Drive stops, LCD flashes F040 (Phase W to Gnd), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "A phase to ground fault has been detected between the drive and motor in this phase."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "With power removed, disconnect the motor lead from W/T3 and check it and the motor phase to ground for a grounded condition."
        ],
        "fix": [
          "Check the wiring between the drive and motor.",
          "Check motor for grounded phase.",
          "Replace drive if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.161 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F041",
        "title": "Phase UV Short",
        "symptom": "Drive stops, LCD flashes F041 (Phase UV Short), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Excessive current has been detected between these two output terminals."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "With power removed and motor leads disconnected, check between the U/T1 and V/T2 leads for a short."
        ],
        "fix": [
          "Check the motor and drive output terminal wiring for a shorted condition.",
          "Replace drive if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F042",
        "title": "Phase UW Short",
        "symptom": "Drive stops, LCD flashes F042 (Phase UW Short), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Excessive current has been detected between these two output terminals."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "With power removed and motor leads disconnected, check between the U/T1 and W/T3 leads for a short."
        ],
        "fix": [
          "Check the motor and drive output terminal wiring for a shorted condition.",
          "Replace drive if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F043",
        "title": "Phase VW Short",
        "symptom": "Drive stops, LCD flashes F043 (Phase VW Short), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Excessive current has been detected between these two output terminals."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "With power removed and motor leads disconnected, check between the V/T2 and W/T3 leads for a short."
        ],
        "fix": [
          "Check the motor and drive output terminal wiring for a shorted condition.",
          "Replace drive if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F048",
        "title": "Params Defaulted",
        "symptom": "Drive stops, LCD flashes F048 (Params Defaulted), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "The drive was commanded to write default values to EEPROM."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Clear the fault or cycle power to the drive.",
          "Program the drive parameters as needed.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F059",
        "title": "Safety Open",
        "symptom": "Drive stops, LCD flashes F059 (Safety Open), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "Both of the safety inputs (Safety 1, Safety 2) are not enabled. Configure with t105 [Safety Open En]. (Not applicable to PowerFlex 523.)"
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Meter S1-04 and S2-04. S+ is the +24 V safety supply (tied to terminal 11, ref. Digital Common): energized channel ~ +24 V, open channel 0 V (p.43)."
        ],
        "fix": [
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159",
        "fixIfNoStoWiring": [
          "Check safety inputs; if unused, S1, S2, S+ jumper fitted and tight. Only if drawings show no STO wiring. Never jumper a wired STO circuit.",
          "Safety unused: protective jumper on S1, S2, S+ fitted and tight (p.243). Only if drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "F063",
        "title": "SW OverCurrent",
        "symptom": "Drive stops, LCD flashes F063 (SW OverCurrent), FAULT LED flashes red. Type 1: auto-reset possible if A541 [Auto Rstrt Tries] > 0.",
        "causes": [
          "Programmed A486, A488 [Shear Pinx Level] has been exceeded for a time period greater than the time programmed in A487, A489 [Shear Pin x Time]."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Verify connections between motor and load.",
          "Verify level and time requirements.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F064",
        "title": "Drive Overload",
        "symptom": "Drive stops, LCD flashes F064 (Drive Overload), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Drive overload rating has been exceeded."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Compare F641 [Fault 1 Current] with the drive rating (Normal Duty 110% for 60 s, Heavy Duty 150% for 60 s, p.170)."
        ],
        "fix": [
          "Reduce load or extend Accel Time.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F070",
        "title": "Power Unit",
        "symptom": "Drive stops, LCD flashes F070 (Power Unit), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Failure has been detected in the drive power section."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Check that max ambient temperature has not been exceeded.",
          "Cycle power.",
          "Replace drive if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F071",
        "title": "DSI Net Loss",
        "symptom": "Drive stops, LCD flashes F071 (DSI Net Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Control over the Modbus or DSI communication link has been interrupted."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Cycle power.",
          "Check communications cabling.",
          "Check Modbus or DSI setting.",
          "Check Modbus or DSI status.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F072",
        "title": "Opt Net Loss",
        "symptom": "Drive stops, LCD flashes F072 (Opt Net Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Control over the network option card's remote network has been interrupted."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Cycle power.",
          "Check communications cabling.",
          "Check network adapter setting.",
          "Check external network status.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F073",
        "title": "EN Net Loss",
        "symptom": "Drive stops, LCD flashes F073 (EN Net Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Control through the embedded EtherNet/IP adapter has been interrupted. (Not applicable to PowerFlex 523.)"
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Check ENET/LINK LEDs: ENET off = adapter not on network; LINK off = not connected, steady = connected but not transmitting (p.62)."
        ],
        "fix": [
          "Cycle power.",
          "Check communications cabling.",
          "Check EtherNet/IP setting.",
          "Check external network status.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F080",
        "title": "Autotune Failure",
        "symptom": "Drive stops, LCD flashes F080 (Autotune Failure), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "The autotune function was either canceled by the user or failed."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Restart procedure.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F081",
        "title": "DSI Comm Loss",
        "symptom": "Drive stops, LCD flashes F081 (DSI Comm Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Communications between the drive and the Modbus or DSI master device have been interrupted."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Cycle power.",
          "Check communications cabling.",
          "Check Modbus or DSI setting.",
          "Check Modbus or DSI status.",
          "Modify using C125 [Comm Loss Action].",
          "Connecting I/O terminals C1 and C2 to ground may improve noise immunity.",
          "Replace wiring, Modbus master device, or control module.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F082",
        "title": "Opt Comm Loss",
        "symptom": "Drive stops, LCD flashes F082 (Opt Comm Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Communications between the drive and the network option card have been interrupted."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Cycle power.",
          "Reinstall option card in drive.",
          "Modify using C125 [Comm Loss Action].",
          "Replace wiring, port expander, option card, or control module.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F083",
        "title": "EN Comm Loss",
        "symptom": "Drive stops, LCD flashes F083 (EN Comm Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Internal communications between the drive and the embedded EtherNet/IP adapter have been interrupted. (Not applicable to PowerFlex 523.)"
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Cycle power.",
          "Check EtherNet/IP setting.",
          "Check drive's Ethernet settings and diagnostic parameters.",
          "Modify using C125 [Comm Loss Action].",
          "Replace wiring, Ethernet switch, or control module.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.162 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F091",
        "title": "Encoder Loss",
        "symptom": "Drive stops, LCD flashes F091 (Encoder Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Requires differential encoder. One of the 2 encoder channel signals is missing. (Not applicable to PowerFlex 523.)"
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Check Wiring.",
          "If P047, P049, P051 [Speed Referencex] = 16 \"Positioning\" and A535 [Motor Fdbk Type] = 5 \"Quad Check\": swap encoder channels or any two motor leads.",
          "Replace encoder.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F094",
        "title": "Function Loss",
        "symptom": "Drive stops, LCD flashes F094 (Function Loss), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "\"Freeze-Fire\" (Function Loss) input is inactive, input to the programmed terminal is open."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Measure the programmed input terminal to 04: in SRC mode 0…6 V = OFF (open), 18…24 V = ON (p.170)."
        ],
        "fix": [
          "Close input to the terminal and cycle power.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F100",
        "title": "Parameter Chksum",
        "symptom": "Drive stops, LCD flashes F100 (Parameter Chksum), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Drive parameter non-volatile storage is corrupted."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Set P053 [Reset To Defalts] to 2 \"Factory Rset\".",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F101",
        "title": "External Storage",
        "symptom": "Drive stops, LCD flashes F101 (External Storage), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "External non-volatile storage has failed."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Set P053 [Reset To Defalts] to 2 \"Factory Rset\".",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F105",
        "title": "C Connect Err",
        "symptom": "Drive stops, LCD flashes F105 (C Connect Err), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Control module was disconnected while drive was powered."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Clear fault and verify all parameter settings. Do not remove or install the control module while power is applied.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F106",
        "title": "Incompat C-P",
        "symptom": "Drive stops, LCD flashes F106 (Incompat C-P), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "The PowerFlex 525 control module does not support power modules with 0.25 HP power rating."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Change to a different power module.",
          "Change to a PowerFlex 523 control module.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F107",
        "title": "Replaced C-P",
        "symptom": "Drive stops, LCD flashes F107 (Replaced C-P), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "The control module could not recognize the power module. Hardware failure."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Change to a different power module.",
          "Replace control module if changing power module does not work.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F109",
        "title": "Mismatch C-P",
        "symptom": "Drive stops, LCD flashes F109 (Mismatch C-P), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "The control module was mounted to a different drive type power module."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Set P053 [Reset To Defalts] to 3 \"Power Reset\".",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F110",
        "title": "Keypad Membrane",
        "symptom": "Drive stops, LCD flashes F110 (Keypad Membrane), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Keypad membrane failure / disconnected."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Cycle power.",
          "Replace control module if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F111",
        "title": "Safety Hardware",
        "symptom": "Drive stops, LCD flashes F111 (Safety Hardware), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Safety input enable hardware malfunction. One of the safety inputs is not enabled. (Not applicable to PowerFlex 523.)"
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145).",
          "Meter S1-04 and S2-04: energized, both read S+ (+24 V). One at 0 V while the other is energized marks the open channel (p.43, p.243)."
        ],
        "fix": [
          "Replace control module if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159",
        "fixIfNoStoWiring": [
          "Check safety inputs; if unused, S1, S2, S+ jumper fitted and tight. Only if drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "F114",
        "title": "uC Failure",
        "symptom": "Drive stops, LCD flashes F114 (uC Failure), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Microprocessor failure."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Cycle power.",
          "Verify grounding requirements. See General Grounding Requirements on page 20 for more information.",
          "Replace control module if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F122",
        "title": "I/O Board Fail",
        "symptom": "Drive stops, LCD flashes F122 (I/O Board Fail), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "Failure has been detected in the drive control and I/O section."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Cycle power.",
          "Replace drive or control module if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F125",
        "title": "Flash Update Req",
        "symptom": "Drive stops, LCD flashes F125 (Flash Update Req), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "The firmware in the drive is corrupt, mismatched, or incompatible with the hardware."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Perform a firmware flash update operation to attempt to load a valid set of firmware.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F126",
        "title": "NonRecoverablErr",
        "symptom": "Drive stops, LCD flashes F126 (NonRecoverablErr), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "A nonrecoverable firmware or hardware error was detected. The drive was automatically stopped and reset."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Clear fault or cycle power to the drive.",
          "Replace drive or control module if fault cannot be cleared.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "code": "F127",
        "title": "DSIFlashUpdatReq",
        "symptom": "Drive stops, LCD flashes F127 (DSIFlashUpdatReq), FAULT LED flashes red. Type 2: cannot reset until the cause is fixed.",
        "causes": [
          "A critical problem with the firmware was detected and the drive is running using backup firmware that only supports DSI communications."
        ],
        "confirm": [
          "Read b007 [Fault 1 Code] (most recent fault; b008, b009 older) on the keypad, PF525 manual p.79 / p.160.",
          "Read F631 [Fault 1 Freq], F641 [Fault 1 Current] and F651 [Fault 1 BusVolts] for the drive state at the trip (p.145)."
        ],
        "fix": [
          "Perform a firmware flash update operation using DSI communications to attempt to load a valid set of firmware.",
          "Fix cause, then clear: Stop (if P045 [Stop Mode] = 0…3), power cycle, A551 [Fault Clear] = 1 or 2, or toggle a DI set to 13 \"Clear Fault\" (p.160)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.163 (Fault Types, Descriptions, and Actions); fault types p.159"
      },
      {
        "title": "Motor does not start (no output voltage to the motor)",
        "symptom": "Start given but no output voltage to the motor; no fault indication.",
        "causes": [
          "No output voltage to the motor.",
          "Improper boost setting at initial startup.",
          "Incorrect programming: P046, P048, P050 [Start Source x] is set incorrectly.",
          "Wrong input wiring: 2-wire needs Run Forward, Run Reverse or Jog; 3-wire needs Start and Stop; a Stop input is always needed.",
          "Incorrect sink/source jumper setting."
        ],
        "confirm": [
          "Check the supply voltage; check all fuses and disconnects.",
          "Verify that I/O Terminal 01 is active (Stop input always required; factory jumper 01-11): measure 01 to 04, SRC mode 18…24 V = ON (p.43, p.170).",
          "Verify that a Start signal is present. If 2-Wire control is used, verify that either the Run Forward or Run Reverse signal is active, but not both.",
          "Verify that safety inputs (Safety 1 and Safety 2) are active.",
          "Check setting for b012 [Control Source]."
        ],
        "fix": [
          "Check the power circuit, the motor connection and the control input signals.",
          "Verify that P046, P048, P050 [Start Source x] matches your configuration.",
          "Verify that A544 [Reverse Disable] is not prohibiting movement.",
          "Set A530 [Boost Select] to 2 \"35.0, VT\" (improper boost at initial startup).",
          "Set the sink/source switch to match wiring scheme."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.164 (Common Symptoms and Corrective Actions, Motor does not Start)",
        "fixIfNoStoWiring": [
          "Wire inputs correctly and/or install jumper. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "title": "Drive does not start from Start or Run inputs wired to the terminal block",
        "symptom": "Terminal-block Start/Run does nothing; drive may show a flashing red status light (faulted).",
        "causes": [
          "Drive is faulted.",
          "Incorrect programming: P046, P048, P050 [Start Source x] or t062, t063 [DigIn TermBlk 02/03] set incorrectly.",
          "Incorrect input wiring.",
          "Incorrect sink/source jumper setting."
        ],
        "confirm": [
          "Look for the flashing red status light / fault number (drive faulted).",
          "Read b014 [Dig In Status] to see whether the Start/Run inputs reach the drive.",
          "Measure 02 (Start/Run FWD) to 04: SRC mode 18…24 V = ON, 0…6 V = OFF (p.170)."
        ],
        "fix": [
          "Clear fault (Stop key if P045 = 0…3, cycle power, A551 [Fault Clear] = 1 or 2, or cycle a digital input set to 13 \"Clear Fault\").",
          "Check parameter settings.",
          "Set switch to match wiring scheme."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.164-165 (Common Symptoms and Corrective Actions)",
        "fixIfNoStoWiring": [
          "Fix wiring/fit jumper; with STO check inputs active; in 2-wire or 3-wire mode check t062, t063. Only if no STO wiring shown. Never jumper wired STO."
        ]
      },
      {
        "title": "Drive does not respond to changes in speed command",
        "symptom": "The drive \"Run\" indicator is lit and output is 0 Hz, or the speed does not follow the reference.",
        "causes": [
          "No value is coming from the source of the command.",
          "Incorrect reference source is being selected by remote device or digital inputs."
        ],
        "confirm": [
          "Check b012 [Control Source] for correct source.",
          "If the source is an analog input, check wiring and use a meter to check for presence of signal (13 to 14: 0…10 V; 15: 4…20 mA).",
          "Check b002 [Commanded Freq] to verify correct command.",
          "Check b014 [Dig In Status] to see if inputs are selecting an alternate source."
        ],
        "fix": [
          "Verify settings for t062, t063, t065-t068 [DigIn TermBlk xx].",
          "Check P047, P049, P051 [Speed Referencex] for the source of the speed reference. Reprogram as necessary.",
          "Verify communications if used."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.165 (Common Symptoms and Corrective Actions)"
      },
      {
        "title": "Drive does not power up",
        "symptom": "Display stays dark when power is applied.",
        "causes": [
          "No input power to drive.",
          "Control module is not connected properly to power module."
        ],
        "confirm": [
          "Check the supply voltage at R/L1, S/L2, T/L3 (e.g. 323…528 V AC for 380…480 V AC -15%/+10%, p.169).",
          "Check all fuses and disconnects."
        ],
        "fix": [
          "Check the power circuit.",
          "Remove power, verify that the control module is properly and fully installed on the power module, reapply power."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf p.166 (Drive does not power up)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf (PowerFlex 520-Series User Manual 520-UM001O-EN-E, Sep 2025: Ch.1 Control I/O p.42-44, Ch.2 Display p.61-62, Ch.3 Parameters, Ch.4 Troubleshooting p.159-166, App.A Specifications p.168-171, App.G Safe Torque Off p.241-245)"
    ]
  },
  {
    "id": "sinamics-g120c-vfd",
    "title": "Siemens SINAMICS G120C converter",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "SINAMICS G120C"
    },
    "normal": [
      {
        "terminals": "L1, L2, L3 (line to line)",
        "state": "power applied, 3 AC 380…480 V (+10%, -20%)",
        "meter": "VAC",
        "expected": "304…528 V AC",
        "pins": [
          [
            "L1",
            "L2"
          ],
          [
            "L2",
            "L3"
          ],
          [
            "L1",
            "L3"
          ]
        ],
        "note": "Table 10-1…10-7, OI p.393",
        "liveWork": true
      },
      {
        "terminals": "9 (+24V OUT) to 28 (GND)",
        "state": "powered (internal 24 V supply)",
        "meter": "VDC",
        "expected": "24 V (max. 100 mA; FSD…FSF terminal strip: max. 200 mA)",
        "pins": [
          [
            "9",
            "28"
          ]
        ],
        "note": "Output voltages, OI p.387; terminal strips FSAA…FSC OI p.82 and FSD…FSF OI p.84 use the same terminal numbers"
      },
      {
        "terminals": "1 (+10V OUT) to 2 (GND)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10 V ± 0.5 V (9.5…10.5 V, max. 10 mA)",
        "pins": [
          [
            "1",
            "2"
          ]
        ],
        "note": "OI p.387"
      },
      {
        "terminals": "31 (+24V IN) to 32 (GND IN)",
        "state": "optional external 24 V supply connected",
        "meter": "VDC",
        "expected": "20.4…28.8 V DC (typ. 0.5 A)",
        "pins": [
          [
            "31",
            "32"
          ]
        ],
        "note": "OI p.387"
      },
      {
        "terminals": "DI 0 (5), DI 2 (7), DI 4 (16) to DI COM1 (69); DI 1 (6), DI 3 (8), DI 5 (17) to DI COM2 (34)",
        "state": "input high (ON)",
        "meter": "VDC",
        "expected": "> 11 V (max. 30 V, 5.5 mA)",
        "pins": [
          [
            "5",
            "69"
          ],
          [
            "7",
            "69"
          ],
          [
            "16",
            "69"
          ],
          [
            "6",
            "34"
          ],
          [
            "8",
            "34"
          ],
          [
            "17",
            "34"
          ]
        ],
        "note": "Digital inputs low < 5 V, high > 11 V (OI p.387); with the internal 24 V supply GND (28) must be connected to DI COM1/DI COM2 (OI p.82)"
      },
      {
        "terminals": "DI x to its DI COM",
        "state": "input low (OFF)",
        "meter": "VDC",
        "expected": "< 5 V",
        "note": "OI p.387"
      },
      {
        "terminals": "AI 0+ (3) to AI 0- (4)",
        "state": "speed setpoint, factory setting (-10 V … 10 V)",
        "meter": "VDC",
        "expected": "-10…+10 V (or 0…20 mA when switched to current)",
        "pins": [
          [
            "3",
            "4"
          ]
        ],
        "note": "Factory settings OI p.86; analog input data OI p.387"
      },
      {
        "terminals": "AO 0+ (12) to GND (13)",
        "state": "running, factory setting actual speed value",
        "meter": "mA",
        "expected": "0…20 mA",
        "pins": [
          [
            "12",
            "13"
          ]
        ],
        "note": "OI p.86, p.387"
      },
      {
        "terminals": "DO 0 NO (19) to DO 0 COM (20)",
        "state": "powered, no fault (factory DO 0 = Fault)",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "19",
            "20"
          ]
        ],
        "note": "Default DO 0 = Fault (OI p.86). r0052.3 is inverted on a DO: relay ON while no fault (OI p.162-163). Relay 30 V DC / max 0.5 A ohmic (OI p.387)."
      },
      {
        "terminals": "DO 0 NC (18) to DO 0 COM (20)",
        "state": "fault active",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "18",
            "20"
          ]
        ],
        "note": "OI p.86, p.162-163"
      },
      {
        "terminals": "DI 4 (16) to DI COM1 (69) and DI 5 (17) to DI COM2 (34)",
        "state": "STO via terminals enabled: STO deselected (run permitted)",
        "meter": "VDC",
        "expected": "> 11 V on both (DI 4 and DI 5 form the fail-safe input F-DI 0; max. 30 V, 5.5 mA)",
        "pins": [
          [
            "16",
            "69"
          ],
          [
            "17",
            "34"
          ]
        ],
        "note": "Safety input OI p.388; only when the STO safety function is enabled"
      }
    ],
    "pairs": [
      {
        "a": "19",
        "b": "20",
        "when": "powered, no fault (DO 0 factory setting Fault)",
        "note": "DO 0 relay NO-COM; the fault signal r0052.3 is inverted on a digital output (OI p.86, p.162-163)."
      },
      {
        "a": "18",
        "b": "20",
        "when": "fault active",
        "note": "DO 0 relay NC-COM (OI p.82, p.86)."
      },
      {
        "a": "2",
        "b": "28",
        "when": "always",
        "note": "All terminals with the reference potential \"GND\" are connected to each other inside the inverter (OI p.82)."
      },
      {
        "a": "2",
        "b": "13",
        "when": "always",
        "note": "GND terminals connected inside the inverter (OI p.82)."
      }
    ],
    "indicators": [
      {
        "name": "RDY LED",
        "state": "on orange",
        "meaning": "Temporary state after the supply voltage is switched on (OI p.338)."
      },
      {
        "name": "RDY LED",
        "state": "on green",
        "meaning": "The inverter is free of faults (OI p.338)."
      },
      {
        "name": "RDY LED",
        "state": "flashing green slowly",
        "meaning": "Commissioning or reset to factory settings (OI p.338)."
      },
      {
        "name": "RDY LED",
        "state": "flashing red quickly",
        "meaning": "A fault is active (OI p.338)."
      },
      {
        "name": "RDY LED",
        "state": "on red",
        "meaning": "Firmware update is active (OI p.338)."
      },
      {
        "name": "RDY LED",
        "state": "flashing red slowly",
        "meaning": "Inverter waits until the power supply is switched off and switched on again after a firmware update (OI p.338)."
      },
      {
        "name": "SAFE LED",
        "state": "on yellow",
        "meaning": "One or more safety functions are enabled, but not active (OI p.338)."
      },
      {
        "name": "SAFE LED",
        "state": "flashing yellow slowly",
        "meaning": "One or more safety functions are active and error-free (OI p.338)."
      },
      {
        "name": "SAFE LED",
        "state": "flashing yellow quickly",
        "meaning": "The inverter has detected a safety function fault and initiated a stop response (OI p.338)."
      },
      {
        "name": "LNK LED (PROFINET)",
        "state": "on green",
        "meaning": "Communication via PROFINET is error-free (OI p.339)."
      },
      {
        "name": "LNK LED (PROFINET)",
        "state": "flashing green slowly",
        "meaning": "Device naming is active (OI p.339)."
      },
      {
        "name": "LNK LED (PROFINET)",
        "state": "off",
        "meaning": "No communication via PROFINET (OI p.339)."
      },
      {
        "name": "BF LED (PROFINET/PROFIBUS)",
        "state": "on green",
        "meaning": "Data exchange between the inverter and control system is active (OI p.339)."
      },
      {
        "name": "BF LED (PROFINET/PROFIBUS)",
        "state": "off",
        "meaning": "Fieldbus interface is not being used (OI p.339)."
      },
      {
        "name": "BF LED (PROFINET/PROFIBUS)",
        "state": "flashing red slowly",
        "meaning": "Fieldbus misconfigured. If RDY also flashes red slowly: inverter is waiting for a power cycle after a firmware update (OI p.339)."
      },
      {
        "name": "BF LED (PROFINET/PROFIBUS)",
        "state": "flashing red quickly",
        "meaning": "No communication with higher-level controller; with RDY flashing red quickly at the same time: incorrect memory card (OI p.340)."
      },
      {
        "name": "BF LED",
        "state": "on red",
        "meaning": "Firmware update failed (OI p.339-340)."
      },
      {
        "name": "BF LED",
        "state": "flashing yellow (variable frequency)",
        "meaning": "Firmware update is active (OI p.339-340)."
      },
      {
        "name": "BF LED (RS485: USS/Modbus)",
        "state": "off",
        "meaning": "Data exchange between the inverter and control system is active; with p2040 = 0 the BF LED remains dark regardless of communication state (OI p.339)."
      },
      {
        "name": "BF LED (RS485: USS/Modbus)",
        "state": "flashing red slowly",
        "meaning": "The fieldbus is active, however, the inverter is not receiving any process data (OI p.339)."
      },
      {
        "name": "BF LED (RS485: USS/Modbus)",
        "state": "flashing red quickly",
        "meaning": "No fieldbus connection is available (OI p.339)."
      },
      {
        "name": "Operator panel (BOP-2/IOP)",
        "state": "shows Fxxxxx",
        "meaning": "Fault; must be acknowledged (OI p.345)."
      },
      {
        "name": "Operator panel (BOP-2/IOP)",
        "state": "shows Axxxxx",
        "meaning": "Alarm; no direct influence on the inverter, disappears when the cause is eliminated (OI p.342)."
      }
    ],
    "faults": [
      {
        "code": "F01000",
        "title": "Internal software error",
        "symptom": "F01000 (Internal software error) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Internal software error"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Replace the inverter.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01001",
        "title": "FloatingPoint exception",
        "symptom": "F01001 (FloatingPoint exception) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "FloatingPoint exception"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Switch off the inverter and switch on again",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01015",
        "title": "Internal software error",
        "symptom": "F01015 (Internal software error) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Internal software error"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Upgrade firmware or contact technical support.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01018",
        "title": "Power-up aborted more than once",
        "symptom": "F01018 (Power-up aborted more than once) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Power-up aborted more than once"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Cycle the inverter power supply off and on.",
          "After this fault the inverter starts up with factory settings.",
          "Commission the inverter again.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A01028",
        "title": "Configuration error",
        "symptom": "A01028 (Configuration error) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Configuration error",
          "Explanation: The parameter assignments on the memory card were made with a different type of module (article no.)."
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check the module parameters and recommission if necessary."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01033",
        "title": "Unit switchover: Reference parameter value invalid",
        "symptom": "F01033 (Unit switchover: Reference parameter value invalid); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Unit switchover: Reference parameter value invalid"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Set the value of the reference parameter to a value other than 0.0 (p0304, p0305, p0310, p0596, p2000, p2001, p2002, p2003, r2004).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01034",
        "title": "Unit switchover: Calculation of the parameter values after reference value change unsuccessful",
        "symptom": "F01034 (Unit switchover: parameter values not recalculated after reference value change); RDY fast red; status word 1 bit 3 (r0052.3) = 1; ack needed.",
        "causes": [
          "Unit switchover: Calculation of the parameter values after reference value change unsuccessful"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Pick a reference value that lets the dependent parameters be computed per unit (p0304, p0305, p0310, p0596, p2000, p2001, p2002, p2003, r2004).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01040",
        "title": "Parameters must be saved",
        "symptom": "F01040 (Parameters must be saved) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Parameters must be saved"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Backup parameter (p0971).",
          "Switch off the inverter and switch on again.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01044",
        "title": "Loading memory data card defective",
        "symptom": "F01044 (Loading memory data card defective); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Loading memory data card defective"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Replace the memory card or the inverter.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01105",
        "title": "CU: Insufficient memory",
        "symptom": "F01105 (CU: Insufficient memory) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "CU: Insufficient memory"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Reduce number of data sets.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01122",
        "title": "Frequency at the probe input too high",
        "symptom": "F01122 (Frequency at the probe input too high); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Frequency at the probe input too high"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Reduce the frequency of the pulses at the probe input.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01205",
        "title": "CU: Time slice overflow",
        "symptom": "F01205 (CU: Time slice overflow) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "CU: Time slice overflow"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Contact technical support.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01250",
        "title": "CU hardware fault",
        "symptom": "F01250 (CU hardware fault) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "CU hardware fault"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Replace the inverter.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01512",
        "title": "An attempt has been made to establish a conversion factor for scaling which does not exist",
        "symptom": "F01512 (conversion factor for scaling does not exist); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "An attempt has been made to establish a conversion factor for scaling which does not exist"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Create scaling or check transfer value.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A01590",
        "title": "Motor maintenance interval elapsed",
        "symptom": "A01590 (Motor maintenance interval elapsed); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Motor maintenance interval elapsed"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Carry out the maintenance."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01600",
        "title": "STOP A initiated",
        "symptom": "F01600 (STOP A initiated) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "STOP A initiated"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "STO via terminals, F-DI 0 = DI 4 + DI 5; measure DI 4 (16)-DI COM1 (69), DI 5 (17)-DI COM2 (34): >11 V STO off, <5 V STO on (OI p.82, p.387-388).",
          "Check the SAFE LED (OI p.338)."
        ],
        "fix": [
          "Select STO and then deselect again.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01625",
        "title": "Sign-of-life error in the Safety data",
        "symptom": "F01625 (Sign-of-life error in the Safety data); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Sign-of-life error in the Safety data"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the electrical cabinet design and cable routing for EMC compliance.",
          "Check whether an impermissible voltage is connected at one of the digital outputs.",
          "Check whether a digital output is loaded with an impermissible current.",
          "Check whether additional faults exist and perform diagnostics if applicable.",
          "Select STO safety function and then deselect again.",
          "Switch off the inverter power supply and switch it on again.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01650",
        "title": "Acceptance test required",
        "symptom": "F01650 (Acceptance test required) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Acceptance test required"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Carry out an acceptance test and create test certificate.",
          "Switch off the Control Unit and switch on again.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.349 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01659",
        "title": "Write task for parameter rejected",
        "symptom": "F01659 (Write task for parameter rejected) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Write task for parameter rejected",
          "Factory reset requested, but safety functions are enabled, so they may not be reset."
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Panel: p0010 = 30 (param reset), p9761 = safety password, p0970 = 5 (reset safety params; drive sets p0970 = 5 when done). Then factory reset again.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01662",
        "title": "Error, internal communications",
        "symptom": "F01662 (Error, internal communications) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Error, internal communications"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the electrical cabinet design and cable routing for EMC compliance.",
          "Check whether an impermissible voltage is connected at one of the digital outputs.",
          "Check whether a digital output is loaded with an impermissible current.",
          "If the checks are unsuccessful: switch off the inverter power supply and switch it on again; upgrade the firmware; contact technical support.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A01666",
        "title": "Static 1 signal at the F-DI for safe acknowledgement",
        "symptom": "A01666 (Static 1 signal at the F-DI for safe acknowledgement); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Static 1 signal at the F-DI for safe acknowledgement"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Set F-DI to a logical 0 signal."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A01698",
        "title": "Commissioning mode active for safety functions",
        "symptom": "A01698 (Commissioning mode active for safety functions); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Commissioning mode active for safety functions"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "This message is withdrawn after the Safety commissioning has ended."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A01699",
        "title": "Switch-off signal path test required",
        "symptom": "A01699 (Switch-off signal path test required); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Switch-off signal path test required"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "After the next time that the \"STO\" function is deselected, the message is withdrawn and the monitoring time is reset."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A01900",
        "title": "PROFIBUS: Configuration telegram faulty",
        "symptom": "A01900 (PROFIBUS: Configuration telegram faulty); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "PROFIBUS: Configuration telegram faulty",
          "Explanation: A PROFIBUS master is attempting to establish a connection with a faulty configuration telegram."
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check the bus configuration on the master and slave side."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A01910",
        "title": "Fieldbus SS setpoint timeout",
        "symptom": "A01910 (Fieldbus SS setpoint timeout); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Fieldbus SS setpoint timeout",
          "Alarm if p2040 ≠ 0 ms and: bus link broken, MODBUS master off, comms error (CRC, parity, logic), or fieldbus monitoring time p2040 set too low."
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Alarm if p2040 ≠ 0 ms and: bus link broken, MODBUS master off, comms error (CRC, parity, logic), or fieldbus monitoring time p2040 set too low."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F01910",
        "title": "Fieldbus SS setpoint timeout",
        "symptom": "F01910 (Fieldbus SS setpoint timeout) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Fieldbus SS setpoint timeout",
          "Alarm if p2040 ≠ 0 ms and: bus link broken, MODBUS master off, comms error (CRC, parity, logic), or fieldbus monitoring time p2040 set too low."
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Alarm if p2040 ≠ 0 ms and: bus link broken, MODBUS master off, comms error (CRC, parity, logic), or fieldbus monitoring time p2040 set too low.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A01920",
        "title": "PROFIBUS: Cyclic connection interrupt",
        "symptom": "A01920 (PROFIBUS: Cyclic connection interrupt); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "PROFIBUS: Cyclic connection interrupt",
          "Explanation: The cyclic connection to PROFIBUS master is interrupted."
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Establish the PROFIBUS connection and activate the PROFIBUS master with cyclic operation."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F03505",
        "title": "Analog input, wire break",
        "symptom": "F03505 (Analog input, wire break) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Analog input, wire break"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Measure the signal at AI 0+ (3) to AI 0- (4); read the measured input current in r0752 (OI p.350)."
        ],
        "fix": [
          "Check the connection to the signal source for interrupts.",
          "Check the level of the signal supplied.",
          "The input current measured by the analog input can be read out in r0752.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A03520",
        "title": "Temperature sensor fault",
        "symptom": "A03520 (Temperature sensor fault) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Temperature sensor fault"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check that the sensor is connected correctly."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A05000",
        "title": "Power Module overtemperature",
        "symptom": "A05000 (Power Module overtemperature); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Power Module overtemperature"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check ambient temperature is within limits, load and duty cycle match the configuration, and cooling has not failed."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A05001",
        "title": "Power Module overtemperature",
        "symptom": "A05001 (Power Module overtemperature); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Power Module overtemperature"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check ambient temperature is within limits, load and duty cycle match the configuration, and cooling has not failed."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A05002",
        "title": "Power Module overtemperature",
        "symptom": "A05002 (Power Module overtemperature); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Power Module overtemperature"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check ambient temperature is within limits, load and duty cycle match the configuration, and cooling has not failed."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A05004",
        "title": "Power Module overtemperature",
        "symptom": "A05004 (Power Module overtemperature); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Power Module overtemperature"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check ambient temperature is within limits, load and duty cycle match the configuration, and cooling has not failed."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A05006",
        "title": "Power Module overtemperature",
        "symptom": "A05006 (Power Module overtemperature); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Power Module overtemperature"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check ambient temperature is within limits, load and duty cycle match the configuration, and cooling has not failed."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.350 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F06310",
        "title": "Supply voltage (p0210) incorrectly parameterized",
        "symptom": "F06310 (Supply voltage (p0210) incorrectly parameterized); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Supply voltage (p0210) incorrectly parameterized"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Measure L1-L2, L2-L3, L1-L3 at the inverter: 3 AC 380…480 V +10%/-20% = 304…528 V AC (OI p.393)."
        ],
        "fix": [
          "Check the parameterized supply voltage and if required change (p0210).",
          "Check the line voltage.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07011",
        "title": "Motor overtemperature",
        "symptom": "F07011 (Motor overtemperature) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Motor overtemperature"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Power off, test sensor 14 (T1 MOTOR)-15 (T2 MOTOR): PTC short < 22 ohm, trip threshold 1650 ohm; KTY84/Pt1000 wire break > 2120 ohm (OI p.387)."
        ],
        "fix": [
          "Reduce the motor load.",
          "Check ambient temperature.",
          "Check sensor's wiring and connection.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07012",
        "title": "I2t motor model overtemperature",
        "symptom": "A07012 (I2t motor model overtemperature); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "I2t motor model overtemperature"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check and if necessary reduce the motor load.",
          "Check the motor's ambient temperature.",
          "Check thermal time constant p0611.",
          "Check overtemperature fault threshold p0605."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07015",
        "title": "Motor temperature sensor alarm",
        "symptom": "A07015 (Motor temperature sensor alarm); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Motor temperature sensor alarm"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344).",
          "Check the sensor at 14 (T1 MOTOR) to 15 (T2 MOTOR) with power removed (OI p.387)."
        ],
        "fix": [
          "Check that the sensor is connected correctly.",
          "Check the parameter assignment (p0601)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07016",
        "title": "Motor temperature sensor fault",
        "symptom": "F07016 (Motor temperature sensor fault) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Motor temperature sensor fault"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Check the sensor at 14 (T1 MOTOR) to 15 (T2 MOTOR) with power removed: KTY84 short < 50 ohm, Pt1000 short < 603 ohm, wire break > 2120 ohm (OI p.387)."
        ],
        "fix": [
          "Make sure that the sensor is connected correctly.",
          "Check the parameterization (p0601).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07086",
        "title": "Unit switchover: Parameter limit violation",
        "symptom": "F07086 (Unit switchover: Parameter limit violation); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Unit switchover: Parameter limit violation"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the adapted parameter values and if required correct.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07088",
        "title": "Unit switchover: Parameter limit violation",
        "symptom": "F07088 (Unit switchover: Parameter limit violation); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Unit switchover: Parameter limit violation"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the adapted parameter values and if required correct.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07320",
        "title": "Automatic restart aborted",
        "symptom": "F07320 (Automatic restart aborted) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Automatic restart aborted"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Increase the number of restart attempts (p1211). The current number of start attempts is shown in r1214.",
          "Increase the wait time in p1212 and/or monitoring time in p1213.",
          "Create ON command (p0840).",
          "Increase the monitoring time of the power unit or switch off (p0857).",
          "Reduce the wait time for resetting the fault counter p1213[1] so that fewer faults are registered in the time interval.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07321",
        "title": "Automatic restart active",
        "symptom": "A07321 (Automatic restart active) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Automatic restart active",
          "Automatic restart (AR) active: the drive switches itself back on when voltage returns and/or pending fault causes are cleared."
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Automatic restart (AR) active: the drive switches itself back on when voltage returns and/or pending fault causes are cleared."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07330",
        "title": "Search current measured too low",
        "symptom": "F07330 (Search current measured too low) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Search current measured too low"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Increase search current (P1202), check motor connection.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07400",
        "title": "VDC_max controller active",
        "symptom": "A07400 (VDC_max controller active) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "VDC_max controller active"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "If the controller should not act: lengthen ramp-down times, or disable VDC_max control (p1240 = 0 vector, p1280 = 0 V/f)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07409",
        "title": "V/f control, current limiting controller active",
        "symptom": "A07409 (V/f control, current limiting controller active); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "V/f control, current limiting controller active"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Alarm clears after any of: raise current limit (p0640), reduce load, lengthen ramp-up time to the speed setpoint."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07426",
        "title": "Technology controller actual value limited",
        "symptom": "F07426 (Technology controller actual value limited); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Technology controller actual value limited"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Adapt the limits to the signal level (p2267, p2268).",
          "Check the actual value scaling (p2264).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07444",
        "title": "PID autotuning is activated",
        "symptom": "A07444 (PID autotuning is activated); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "PID autotuning is activated"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Automatic setting of the PID controller (autotuning) is active (p2350 > 0). The alarm disappears automatically after completion of the autotuning."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07445",
        "title": "PID autotuning canceled",
        "symptom": "F07445 (PID autotuning canceled) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "PID autotuning canceled",
          "The inverter has canceled the automatic setting of the PID controller (autotuning) because of a fault."
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Remedy: Increase p2355 and restart autotuning.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.351 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07801",
        "title": "Motor overcurrent",
        "symptom": "F07801 (Motor overcurrent) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Motor overcurrent"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check current limits (p0640).",
          "V/f control: Check the current limiting controller (p1340 … p1346).",
          "Increase acceleration ramp (p1120) or reduce load.",
          "Check motor and motor cables for short-circuit and ground fault.",
          "Check motor for star-delta connection and rating plate parameterization.",
          "Check power unit / motor combination.",
          "Select flying restart function (p1200) if switched to rotating motor.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07805",
        "title": "Drive: Power unit overload I2t",
        "symptom": "A07805 (Drive: Power unit overload I2t); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Drive: Power unit overload I2t"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Reduce the continuous load.",
          "Adapt the load cycle.",
          "Check the assignment of rated currents of the motor and power unit."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07807",
        "title": "Short-circuit detected",
        "symptom": "F07807 (Short-circuit detected) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Short-circuit detected"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "With power removed, check the motor cable for a phase-phase short and that line and motor cables are not interchanged at the terminals."
        ],
        "fix": [
          "Check the inverter connection on the motor side for any phase-phase short-circuit.",
          "Rule out that line and motor cables have been interchanged.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07850",
        "title": "External alarm 1",
        "symptom": "A07850 (External alarm 1) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "External alarm 1"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344).",
          "Check the signal source set in p2112 (OI p.352)."
        ],
        "fix": [
          "The signal for \"external alarm 1\" has been triggered.",
          "Parameter p2112 defines the signal source of the external alarm.",
          "Remedy: Rectify the cause of this alarm."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07860",
        "title": "External fault 1",
        "symptom": "F07860 (External fault 1) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "External fault 1"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Check the signal at the digital input that is interconnected as external fault 1 (DI to its DI COM: high > 11 V, low < 5 V, OI p.387)."
        ],
        "fix": [
          "Remove the external causes for this fault.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07900",
        "title": "Motor blocked",
        "symptom": "F07900 (Motor blocked) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Motor blocked"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Make sure that the motor can rotate freely.",
          "Check the torque limit: r1538 for a positive direction of rotation; r1539 for a negative direction of rotation.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07901",
        "title": "Motor overspeed",
        "symptom": "F07901 (Motor overspeed) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Motor overspeed"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Activate precontrol of the speed limiting controller (p1401 bit 7 = 1).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07902",
        "title": "Motor stalled",
        "symptom": "F07902 (Motor stalled) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Motor stalled"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check whether the motor data has been parameterized correctly and perform motor identification.",
          "Check the current limits (p0640, r0067, r0289). If the current limits are too low, the drive cannot be magnetized.",
          "Check whether motor cables are disconnected during operation.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07903",
        "title": "Motor speed deviation",
        "symptom": "A07903 (Motor speed deviation) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Motor speed deviation"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Increase p2163 and/or p2166.",
          "Increase the torque, current and power limits."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07910",
        "title": "Motor overtemperature",
        "symptom": "A07910 (Motor overtemperature) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Motor overtemperature"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check the motor load.",
          "Check the motor's ambient temperature.",
          "Check the KTY84 or PT1000 sensor."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07920",
        "title": "Torque/speed too low",
        "symptom": "A07920 (Torque/speed too low) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Torque/speed too low",
          "The torque deviates from the torque/speed envelope curve."
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check the connection between the motor and the load.",
          "Adapt the parameterization corresponding to the load."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07921",
        "title": "Torque/speed too high",
        "symptom": "A07921 (Torque/speed too high) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Torque/speed too high",
          "The torque deviates from the torque/speed envelope curve."
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check the connection between the motor and the load.",
          "Adapt the parameterization corresponding to the load."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07922",
        "title": "Torque/speed out of tolerance",
        "symptom": "A07922 (Torque/speed out of tolerance); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Torque/speed out of tolerance",
          "The torque deviates from the torque/speed envelope curve."
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check the connection between the motor and the load.",
          "Adapt the parameterization corresponding to the load."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07923",
        "title": "Torque/speed too low",
        "symptom": "F07923 (Torque/speed too low) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Torque/speed too low"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the connection between the motor and the load.",
          "Adapt the parameterization corresponding to the load.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F07924",
        "title": "Torque/speed too high",
        "symptom": "F07924 (Torque/speed too high) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Torque/speed too high"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the connection between the motor and the load.",
          "Adapt the parameterization corresponding to the load.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07927",
        "title": "DC braking active",
        "symptom": "A07927 (DC braking active) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "DC braking active"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Not required"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07980",
        "title": "Rotary measurement activated",
        "symptom": "A07980 (Rotary measurement activated); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Rotary measurement activated"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Not required"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07981",
        "title": "No enabling for rotary measurement",
        "symptom": "A07981 (No enabling for rotary measurement); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "No enabling for rotary measurement"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Acknowledge pending faults.",
          "Establish missing enables (see r00002, r0046)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A07991",
        "title": "Motor data identification activated",
        "symptom": "A07991 (Motor data identification activated); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Motor data identification activated"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Switch on the motor and identify the motor data."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.352 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F08501",
        "title": "Setpoint timeout",
        "symptom": "F08501 (Setpoint timeout) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Setpoint timeout"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the PROFINET connection.",
          "Set the controller to RUN mode.",
          "If the error occurs repeatedly, check the monitoring time set (p2044).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F08502",
        "title": "Monitoring time, sign-of-life expired",
        "symptom": "F08502 (Monitoring time, sign-of-life expired); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Monitoring time, sign-of-life expired"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the PROFINET connection.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F08510",
        "title": "Send configuration data not valid",
        "symptom": "F08510 (Send configuration data not valid) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Send configuration data not valid"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the PROFINET configuration",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A08511",
        "title": "Receive configuration data not valid",
        "symptom": "A08511 (Receive configuration data not valid); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Receive configuration data not valid"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check the PROFINET configuration"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A08526",
        "title": "No cyclic connection",
        "symptom": "A08526 (No cyclic connection) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "No cyclic connection"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Activate the control with cyclic operation.",
          "Check the parameters \"Name of Station\" and \"IP of Station\" (r61000, r61001)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A08565",
        "title": "Consistency error affecting adjustable parameters",
        "symptom": "A08565 (Consistency error affecting adjustable parameters); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "Consistency error affecting adjustable parameters"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check: IP address, subnet mask, default gateway correct; no duplicate IP or station name on the network; station name has only valid characters."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F13100",
        "title": "Know-how protection: Copy protection error",
        "symptom": "F13100 (Know-how protection: Copy protection error); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Know-how protection: Copy protection error",
          "The know-how protection and the copy protection for the memory card are active. An error occurred during checking of the memory card."
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Insert a suitable memory card and switch the inverter power supply temporarily off and then on again (POWER ON).",
          "Deactivate the copy protection (p7765).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F13101",
        "title": "Know-how protection: Copy protection cannot be activated",
        "symptom": "F13101 (Know-how protection: Copy protection cannot be activated); RDY fast red; status word 1 bit 3 (r0052.3) = 1; motor usually off, ack.",
        "causes": [
          "Know-how protection: Copy protection cannot be activated"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Insert a valid memory card.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30001",
        "title": "Overcurrent",
        "symptom": "F30001 (Overcurrent) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Overcurrent"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check motor data (recommission if needed), star/delta, V/f rated current motor vs Power Module, line quality, reactor, power cables (see source)",
          "If this doesn't help: V/f operation: increase the acceleration ramp; reduce the load; replace the power unit.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30002",
        "title": "DC-link voltage overvoltage",
        "symptom": "F30002 (DC-link voltage overvoltage) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "DC-link voltage overvoltage"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Measure L1-L2, L2-L3, L1-L3 at the inverter: 3 AC 380…480 V +10%/-20% = 304…528 V AC (OI p.393).",
          "Note whether the trip occurs while braking/ramping down."
        ],
        "fix": [
          "Increase the ramp-down time (p1121).",
          "Set the rounding times (p1130, p1136).",
          "Activate the DC-link voltage controller (p1240, p1280).",
          "Check the line voltage (p0210).",
          "Check the line phases.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30003",
        "title": "DC-link voltage undervoltage",
        "symptom": "F30003 (DC-link voltage undervoltage) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "DC-link voltage undervoltage"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Measure L1-L2, L2-L3, L1-L3 at the inverter: 3 AC 380…480 V +10%/-20% = 304…528 V AC (OI p.393)."
        ],
        "fix": [
          "Check the line voltage (p0210).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.353 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30004",
        "title": "Inverter overtemperature",
        "symptom": "F30004 (Inverter overtemperature) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Inverter overtemperature"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Check that the inverter fan runs."
        ],
        "fix": [
          "Check whether the inverter fan is running.",
          "Check whether the ambient temperature is in the permissible range.",
          "Check whether the motor is overloaded.",
          "Reduce the pulse frequency.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30005",
        "title": "I2t inverter overload",
        "symptom": "F30005 (I2t inverter overload) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "I2t inverter overload"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check the rated currents of the motor and inverter.",
          "Reduce current limit p0640.",
          "When operating with V/f characteristic: Reduce p1341.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30011",
        "title": "Line phase failure",
        "symptom": "F30011 (Line phase failure) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Line phase failure"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Measure L1-L2, L2-L3, L1-L3 at the inverter: 3 AC 380…480 V +10%/-20% = 304…528 V AC (OI p.393).",
          "Check each input fuse for continuity with power removed."
        ],
        "fix": [
          "Check the inverter's input fuses.",
          "Check the motor cables.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30015",
        "title": "Motor cable phase failure",
        "symptom": "F30015 (Motor cable phase failure) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Motor cable phase failure"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "With power removed, check continuity of each motor phase U2, V2, W2 through the motor."
        ],
        "fix": [
          "Check the motor cables.",
          "Increase the ramp-up or ramp-down time (p1120).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30021",
        "title": "Ground fault",
        "symptom": "F30021 (Ground fault) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Ground fault"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "With power removed and motor cable disconnected, check motor cable and motor windings to ground."
        ],
        "fix": [
          "Check the power cable connections.",
          "Check the motor.",
          "Check the current transformer.",
          "Check the cables and contacts of the brake connection (a wire might be broken).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30022",
        "title": "Power Module: Monitoring VCE",
        "symptom": "F30022 (Power Module: Monitoring VCE) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Power Module: Monitoring VCE"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check or replace the inverter.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30027",
        "title": "Time monitoring for DC link pre-charging",
        "symptom": "F30027 (Time monitoring for DC link pre-charging); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Time monitoring for DC link pre-charging"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Measure L1-L2, L2-L3, L1-L3 at the inverter: 3 AC 380…480 V +10%/-20% = 304…528 V AC (OI p.393)."
        ],
        "fix": [
          "Check the line voltage.",
          "Check the line voltage setting (p0210).",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30035",
        "title": "Overtemperature, intake air",
        "symptom": "F30035 (Overtemperature, intake air) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Overtemperature, intake air"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check whether the fan is running.",
          "Check the fan filter elements.",
          "Check whether the ambient temperature is in the permissible range.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30036",
        "title": "Overtemperature, inside area",
        "symptom": "F30036 (Overtemperature, inside area) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Overtemperature, inside area"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Check whether the fan is running.",
          "Check the fan filter elements.",
          "Check whether the ambient temperature is in the permissible range.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30037",
        "title": "Rectifier overtemperature",
        "symptom": "F30037 (Rectifier overtemperature) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Rectifier overtemperature"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "See F30035 and, in addition: check the motor load; check the line phases",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A30049",
        "title": "Internal fan defective",
        "symptom": "A30049 (Internal fan defective) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Internal fan defective"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344).",
          "Check that the internal fan runs."
        ],
        "fix": [
          "Check the internal fan and if required replace."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30052",
        "title": "Incorrect Power Module data",
        "symptom": "F30052 (Incorrect Power Module data) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Incorrect Power Module data"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Replace the inverter or upgrade the inverter firmware.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30053",
        "title": "Error in FPGA data",
        "symptom": "F30053 (Error in FPGA data) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Error in FPGA data"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Replace the inverter.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30059",
        "title": "Internal fan defective",
        "symptom": "F30059 (Internal fan defective) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "Internal fan defective"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "Check that the internal fan runs."
        ],
        "fix": [
          "Check the internal fan and if required replace.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30074",
        "title": "Communications fault between Control Unit and Power Module",
        "symptom": "F30074 (Comms fault between Control Unit and Power Module); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, ack.",
        "causes": [
          "Communications fault between Control Unit and Power Module",
          "Control Unit to Power Module comms error. Possible cause: external 24 V CU supply dipped to ≤95 % of rated for ≤3 ms."
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347).",
          "If an external 24 V supply is used, measure 31 (+24 V IN) to 32 (GND IN): 20.4…28.8 V DC (OI p.387)."
        ],
        "fix": [
          "Control Unit to Power Module comms error. Possible cause: external 24 V CU supply dipped to ≤95 % of rated for ≤3 ms.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A30502",
        "title": "DC link overvoltage",
        "symptom": "A30502 (DC link overvoltage) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "DC link overvoltage"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344).",
          "Measure L1-L2, L2-L3, L1-L3 at the inverter: 3 AC 380…480 V +10%/-20% = 304…528 V AC (OI p.393)."
        ],
        "fix": [
          "Check the device supply voltage (p0210).",
          "Check the line reactor dimensioning"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30662",
        "title": "CU hardware fault",
        "symptom": "F30662 (CU hardware fault) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "CU hardware fault"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Switch off the inverter and switch on again, upgrade the firmware or contact technical support.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30664",
        "title": "CU power up aborted",
        "symptom": "F30664 (CU power up aborted) shown; RDY fast red flash; r0052.3 = 1 (status word 1 bit 3). Motor normally stops; acknowledge to clear.",
        "causes": [
          "CU power up aborted"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Switch off the inverter and switch on again, upgrade the firmware or contact technical support.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "F30850",
        "title": "Software fault in the Power Module",
        "symptom": "F30850 (Software fault in the Power Module); RDY fast red flash; status word 1 bit 3 (r0052.3) = 1; motor usually off, needs ack.",
        "causes": [
          "Software fault in the Power Module"
        ],
        "confirm": [
          "Read r0945 (fault code; [0] = current fault case), r0949 (fault value) and r2131 (actual fault code) on the BOP-2/IOP or in Startdrive (OI p.345-347)."
        ],
        "fix": [
          "Replace the inverter or contact technical support.",
          "Fix cause, then ack: PROFIdrive CW1 bit 7, ack DI (factory DI 2), operator panel or power cycle; HW/FW monitor faults need power cycle (OI p.346)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A30920",
        "title": "Temperature sensor fault",
        "symptom": "A30920 (Temperature sensor fault) on panel; alarm bit 7 of status word 1 (r0052.7). Motor keeps running; alarm clears itself once the cause is gone.",
        "causes": [
          "Temperature sensor fault"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Check that the sensor is connected correctly."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.354 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A50001",
        "title": "PROFINET configuration error",
        "symptom": "A50001 (PROFINET configuration error); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "PROFINET configuration error"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "PROFINET controller is connecting with a bad configuration telegram. Check whether \"Shared Device\" is on (p8929 = 2)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.355 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A50010",
        "title": "PROFINET name of station invalid",
        "symptom": "A50010 (PROFINET name of station invalid); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "PROFINET name of station invalid"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "Correct the name of station (p8920) and activate (p8925 = 2)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.355 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "code": "A50020",
        "title": "PROFINET: Second control missing",
        "symptom": "A50020 (PROFINET: Second control missing); alarm, status word 1 bit 7 (r0052.7); motor runs on, self-clears when cause removed.",
        "causes": [
          "PROFINET: Second control missing"
        ],
        "confirm": [
          "Read r2122 (alarm code), r2124 (alarm value) and r2132 (actual alarm code) (OI p.342-344)."
        ],
        "fix": [
          "\"Shared Device\" is activated (p8929 = 2). However, only the connection to a PROFINET control is present."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.355 (Table 8-8 The most important alarms and faults); faults/alarms p.342-347"
      },
      {
        "title": "Motor cannot be switched on",
        "symptom": "ON command given but the motor does not start; no or unclear message.",
        "causes": [
          "A fault is present.",
          "Inverter not completely commissioned (p0010 ≠ 0).",
          "Inverter not reporting \"ready to start\" (r0052.0 = 0).",
          "Enable signals missing (r0046)."
        ],
        "confirm": [
          "Is a fault present? (RDY LED, r0945)",
          "Has the inverter been completely commissioned p0010 = 0?",
          "Is the inverter reporting the \"ready to start\" status (r0052.0 = 1)?",
          "Is the inverter missing some enable signals (r0046)?",
          "Find the setpoint/command source (DI, AI or fieldbus). For ON/OFF1 meter DI 0 (5) to DI COM1 (69): high > 11 V (OI p.387)."
        ],
        "fix": [
          "Remove the fault cause and acknowledge the fault.",
          "Complete commissioning.",
          "Establish the missing enables."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf p.385 (9.5 If the converter no longer responds)"
      }
    ],
    "sources": [
      "https://cache.industry.siemens.com/dl/files/769/109744769/att_912473/v1/G120C_op_instr_1116_en-US.pdf (SINAMICS G120C Operating Instructions 11/2016, FW V4.7 SP6, A5E34263257B AE: 4.7.10 Terminal strips p.82, 4.7.11 Factory setting p.86, 6.3.2 Digital outputs p.162-163, 8 Alarms, faults and system messages p.337-355, 10.1 Technical data of inputs and outputs p.387-388, 10.5 p.393)"
    ]
  },
  {
    "id": "sinamics-v20-vfd",
    "title": "Siemens SINAMICS V20 inverter",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "SINAMICS V20"
    },
    "normal": [
      {
        "terminals": "L1, L2, L3 (line to line)",
        "state": "power applied, three phase AC 400 V inverters (380…480 V AC, -15%…+10%)",
        "meter": "VAC",
        "expected": "323…528 V AC",
        "pins": [
          [
            "L1",
            "L2"
          ],
          [
            "L2",
            "L3"
          ],
          [
            "L1",
            "L3"
          ]
        ],
        "note": "Line supply characteristics, OI p.293",
        "liveWork": true
      },
      {
        "terminals": "L1 to L2",
        "state": "power applied, single phase AC 230 V inverters (200…240 V AC, ±10%)",
        "meter": "VAC",
        "expected": "180…264 V AC",
        "pins": [
          [
            "L1",
            "L2"
          ]
        ],
        "note": "OI p.293; terminals L1, L2 for 230 V, wiring diagram OI p.39",
        "liveWork": true
      },
      {
        "terminals": "13 (24V) to 14 (0V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 V -15%…+20% (20.4…28.8 V DC), max 50 mA",
        "pins": [
          [
            "13",
            "14"
          ]
        ],
        "note": "User terminals, OI p.43-44"
      },
      {
        "terminals": "1 (10V) to 5 (0V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10 V ±5% (9.5…10.5 V DC), max 11 mA",
        "pins": [
          [
            "1",
            "5"
          ]
        ],
        "note": "OI p.43"
      },
      {
        "terminals": "DI1 (8) … DI4 (11) to DI C (12), PNP mode (reference terminal low)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "≥ 11 V (operating voltage -3…30 V; threshold 0⇒1 max. 11 V)",
        "pins": [
          [
            "8",
            "12"
          ],
          [
            "9",
            "12"
          ],
          [
            "10",
            "12"
          ],
          [
            "11",
            "12"
          ]
        ],
        "note": "OI p.43; characteristic values are inverted for NPN mode"
      },
      {
        "terminals": "DI1 (8) … DI4 (11) to DI C (12), PNP mode",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "≤ 5 V (threshold 1⇒0 min. 5 V)",
        "pins": [
          [
            "8",
            "12"
          ],
          [
            "9",
            "12"
          ],
          [
            "10",
            "12"
          ],
          [
            "11",
            "12"
          ]
        ],
        "note": "OI p.43"
      },
      {
        "terminals": "AI1 (2) to 0V (5)",
        "state": "speed setpoint, voltage mode",
        "meter": "VDC",
        "expected": "-10…+10 V (AI1 bipolar; AI2 (3) 0…10 V); 0…20 mA in current mode",
        "pins": [
          [
            "2",
            "5"
          ],
          [
            "3",
            "5"
          ]
        ],
        "note": "OI p.43"
      },
      {
        "terminals": "AO1 (4) to 0V (5)",
        "state": "running",
        "meter": "mA",
        "expected": "0…20 mA (4…20 mA software selectable), 20 mA into 500 ohm",
        "pins": [
          [
            "4",
            "5"
          ]
        ],
        "note": "OI p.43"
      },
      {
        "terminals": "DO1+ (15) to DO1- (16)",
        "state": "powered, no fault (P0731 = 52.3 default)",
        "meter": "continuity",
        "expected": "closed (transistor output on)",
        "pins": [
          [
            "15",
            "16"
          ]
        ],
        "note": "Fault bit 52.3 inverted on the DO: P0748 = 0 gives low on fault, high with no fault (P0731, OI p.182). DO1 max 100 mA, ±35 V (OI p.44)."
      },
      {
        "terminals": "DO2 NO (18) to DO2 C (19)",
        "state": "warning (alarm) active (P0732 = 52.7 default)",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "18",
            "19"
          ]
        ],
        "note": "P0732 default 52.7, r0747 bit 1 = 1: contacts closed (OI p.182); relay 0.5 A @ 250 V AC / 30 V DC resistive (OI p.44)"
      },
      {
        "terminals": "DO2 NC (17) to DO2 C (19)",
        "state": "no warning active (relay de-energized)",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "17",
            "19"
          ]
        ],
        "note": "Change-over voltage-free relay terminals (OI p.44)"
      }
    ],
    "pairs": [
      {
        "a": "15",
        "b": "16",
        "when": "no fault (DO1, P0731 = 52.3 factory default; fault bit output inverted)",
        "note": "OI p.44, p.182. Connection macros (Cn) can reassign DO1/DO2."
      },
      {
        "a": "18",
        "b": "19",
        "when": "warning active (DO2 relay energized, P0732 = 52.7 factory default)",
        "note": "DO2 NO-C, OI p.44, p.182."
      },
      {
        "a": "17",
        "b": "19",
        "when": "no warning (DO2 relay de-energized)",
        "note": "DO2 NC-C, OI p.44."
      }
    ],
    "indicators": [
      {
        "name": "Status LED",
        "state": "orange",
        "meaning": "Power up (OI p.58)."
      },
      {
        "name": "Status LED",
        "state": "green",
        "meaning": "Ready (no fault) (OI p.58)."
      },
      {
        "name": "Status LED",
        "state": "slow flashing green at 0.5 Hz",
        "meaning": "Commissioning mode (OI p.58)."
      },
      {
        "name": "Status LED",
        "state": "fast flashing red at 2 Hz",
        "meaning": "All faults (OI p.58). Priority: parameter cloning, commissioning mode, faults, ready."
      },
      {
        "name": "Status LED",
        "state": "flashing orange at 1 Hz",
        "meaning": "Parameter cloning (OI p.58)."
      },
      {
        "name": "BOP display",
        "state": "fault icon and \"F\" + number",
        "meaning": "A fault is active; the display transitions to the faults screen (OI p.281)."
      },
      {
        "name": "BOP display",
        "state": "alarm icon and \"A\" + number",
        "meaning": "A warning is active; clears automatically once rectified (OI p.289)."
      }
    ],
    "faults": [
      {
        "code": "F1",
        "title": "Overcurrent",
        "symptom": "Fault icon shows and the display shows F1 (Overcurrent); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Motor power (P0307) does not correspond to the inverter power (r0206).",
          "Motor lead short circuit",
          "Earth faults",
          "r0949 = 0: Hardware reported; r0949 = 1: Software reported; r0949 = 22: Hardware reported"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)",
          "With power removed and the motor cable disconnected, check motor cable and motor for short-circuits and earth faults."
        ],
        "fix": [
          "Motor power (P0307) must correspond to inverter power (r0206).",
          "Cable length limits must not be exceeded.",
          "Motor cable and motor must have no short-circuits or earth faults.",
          "Motor parameters must match the motor in use.",
          "Value of stator resistance (P0350) must be correct.",
          "Motor must not be obstructed or overloaded.",
          "Increase ramp-up time (P1120)",
          "Reduce starting boost level (P1312)",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.282 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F2",
        "title": "Overvoltage",
        "symptom": "Fault icon shows and the display shows F2 (Overvoltage); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Main supply voltage too high",
          "Motor is in regenerative mode",
          "r0949 = 0: Hardware reported; r0949 = 1 or 2: Software reported",
          "Regenerative mode can be caused by fast ramp downs or if the motor is driven by an active load."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)",
          "Meter supply at inverter input: 3 AC 400 V types 380…480 V AC -15%/+10% = 323…528 V AC; 1 AC 230 V types 200…240 V AC ±10% = 180…264 V AC (OI p.293).",
          "Read r0026 (filtered DC-link voltage) (OI p.155)."
        ],
        "fix": [
          "Supply voltage (P0210) must lie within limits indicated on rating plate.",
          "Ramp-down time (P1121) must match inertia of load.",
          "Required braking power must lie within specified limits.",
          "Vdc controller must be enabled (P1240) and parameterized properly.",
          "Higher inertia requires longer ramp times; otherwise, apply braking resistor.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.282 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F3",
        "title": "Undervoltage",
        "symptom": "Fault icon shows and the display shows F3 (Undervoltage); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Main supply failed.",
          "Shock load outside specified limits.",
          "r0949 = 0: Hardware reported; r0949 = 1 or 2: Software reported"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)",
          "Meter supply at inverter input: 3 AC 400 V types 380…480 V AC -15%/+10% = 323…528 V AC; 1 AC 230 V types 200…240 V AC ±10% = 180…264 V AC (OI p.293).",
          "Read r0026 (filtered DC-link voltage) (OI p.155)."
        ],
        "fix": [
          "Check supply voltage.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.283 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F4",
        "title": "Inverter overtemperature",
        "symptom": "Fault icon shows and the display shows F4 (Inverter overtemperature); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Inverter overloaded",
          "Ventilation inadequate",
          "Pulse frequency too high",
          "Surrounding temperature too high",
          "Fan inoperative"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)",
          "Check that the fan turns when the inverter is running."
        ],
        "fix": [
          "Load or load cycle too high?",
          "Motor power (P0307) must match inverter power (r0206)",
          "Pulse frequency must be set to default value",
          "Surrounding temperature too high?",
          "Fan must turn when inverter is running",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.283 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F5",
        "title": "Inverter I2t",
        "symptom": "Fault icon shows and the display shows F5 (Inverter I2t); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Inverter overloaded.",
          "Load cycle too demanding.",
          "Motor power (P0307) exceeds inverter power capability (r0206)."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Load cycle must lie within specified limits.",
          "Motor power (P0307) must match inverter power (r0206)",
          "Note: F5 cannot be cleared until the inverter overload utilization (r0036) is lower than the inverter I2t warning (P0294).",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.283 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F6",
        "title": "Chip temperature rise exceeds critical levels",
        "symptom": "Fault icon shows and the display shows F6 (Chip temperature rise exceeds critical levels); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Load at start-up is too high",
          "Load step is too high",
          "Ramp-up rate is too fast"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Load or load step too high?",
          "Increase ramp-up time (P1120).",
          "Motor power (P0307) must match inverter power (r0206).",
          "Use setting P0290 = 0 or 2 for preventing F6.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.283 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F11",
        "title": "Motor overtemperature",
        "symptom": "Fault icon shows and the display shows F11 (Motor overtemperature); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Motor overloaded",
          "Can trip with small motors (≤ 250 W, 4or 2-pole) run below 15 Hz, even with motor temperature in limits."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Load or load step too high?",
          "Motor nominal overtemperatures (P0626 - P0628) must be correct",
          "Motor temperature warning level (P0604) must match",
          "Small motors: if current is within rating-plate nominal and real motor temperature is in limits, set P0335 = 1.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.283 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F12",
        "title": "Inverter temperature signal lost",
        "symptom": "Fault icon shows and the display shows F12 (Inverter temperature signal lost); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Wire breakage of inverter temperature (heat sink) sensor."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "The V20 fault/alarm list gives no remedy text for this code (see the source page); use the cause and the confirm steps.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.283 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F20",
        "title": "DC ripple too high",
        "symptom": "Fault icon shows and the display shows F20 (DC ripple too high); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "The calculated DC ripple level has exceeded the safe threshold. This is commonly caused by loss of one of the mains input phases."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)",
          "Meter input: 3 AC 400 V 380…480 V AC -15%/+10% = 323…528 V AC; 1 AC 230 V 200…240 V AC ±10% = 180…264 V AC (OI p.293). Often lost phase on 3-phase."
        ],
        "fix": [
          "Check the mains supply wiring.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.284 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F35",
        "title": "Maximum number of auto restart attempts exceeded",
        "symptom": "Fault icon, display F35 (max auto restart attempts exceeded); status LED flashes red fast at 2 Hz; inverter trips.",
        "causes": [
          "Auto restart attempts exceed value of P1211."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "The V20 fault/alarm list gives no remedy text for this code (see the source page); use the cause and the confirm steps.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.284 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F41",
        "title": "Motor data identification failure",
        "symptom": "Fault icon shows and the display shows F41 (Motor data identification failure); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Motor data identification failed.",
          "r0949 = 0: No load applied",
          "r0949 = 1: Current limit level reached during identification.",
          "r0949 = 2: Identified stator resistance less than 0.1% or greater than 100%.",
          "r0949 = 30: Current controller at voltage limit",
          "r0949 = 40: Inconsistency of identified dataset, at least one identification failed"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "r0949 = 0: is the motor connected to the inverter?",
          "r0949 = 1 - 49: are the motor data in P0304 - P0311 correct?",
          "Check what type of motor wiring is required (star, delta).",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.284 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F51",
        "title": "Parameter EEPROM fault",
        "symptom": "Fault icon shows and the display shows F51 (Parameter EEPROM fault); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Read or write failure while access to EEPROM. This can also be caused by the EEPROM being full, too many parameters have been changed.",
          "r0949: 1 EEPROM full; 1000/2000/3000 + block: read fail/timeout/CRC; 4000/5000/6000: write fail/timeout/verify; 7000/8000; 9000 (see source)"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Must be power-cycled to cancel this bug as some parameters may not be read correct.",
          "Factory reset and new parameterization, if power-cycle does not remove fault.",
          "Change some parameters back to default values if the EEPROM is full, then power-cycle.",
          "Change inverter.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.284 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F52",
        "title": "Inverter software fault",
        "symptom": "Fault icon shows and the display shows F52 (Inverter software fault); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Inverter info read fail or invalid (r0949 = 1…54: identity/version/data/CRC/serial; 1000…6000 + addr: read/write fail, wrong time, invalid)."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Power-cycle inverter",
          "Contact service department or change inverter",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.285 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F60",
        "title": "Asic timeout",
        "symptom": "Fault icon shows and the display shows F60 (Asic timeout); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Internal communications failure.",
          "r0949 = 0 HW link fail; 1 SW link fail; 6 feedback not disabled when reading inverter data; 7 disable-feedback message not sent during download.",
          "Communication failure due to EMC problems"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Check inverter.",
          "Fault appears sporadically: check - and if necessary - improve EMC",
          "Use EMC filter",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.286 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F61",
        "title": "MMC/SD card parameter cloning failed",
        "symptom": "Fault icon shows and the display shows F61 (MMC/SD card parameter cloning failed); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Parameter cloning failed.",
          "r0949 = 0: MMC/SD card not connected or incorrect card type or the card failed to initialize for automatic cloning",
          "r0949 = 1: Inverter data cannot write to the card.",
          "r0949 = 2: Parameter cloning file not available",
          "r0949 = 3: The MMC/SD card cannot read the file",
          "r0949 = 4: Reading data from the clone file failed (e.g., reading failed, data or checksum wrong)"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "r0949 = 0: Use an MMC/SD card with FAT16 or FAT32 format, or fit an MMC/SD card to the inverter.",
          "r0949 = 1: Check the MMC/SD card (e.g., is the card memory full?) - format the card again to FAT16 or FAT32.",
          "r0949 = 2: Put the correct named file in the correct directory /USER/SINAMICS/DATA.",
          "r0949 = 3: Make sure file is accessible - recreate file if possible.",
          "r0949 = 4: File has been changed - recreate file.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.286 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F62",
        "title": "Parameter cloning contents invalid",
        "symptom": "Fault icon shows and the display shows F62 (Parameter cloning contents invalid); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "File exists but the contents are not valid control word corruption."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Recopy and ensure operation completes.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.286 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F63",
        "title": "Parameter cloning contents incompatible",
        "symptom": "Fault icon shows and the display shows F63 (Parameter cloning contents incompatible); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "File exists but was not the correct inverter type."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Ensure clone from compatible inverter type.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.286 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F64",
        "title": "Inverter attempted to do an automatic clone during startup",
        "symptom": "Fault icon, display F64 (inverter tried an automatic clone at startup); status LED flashes red fast at 2 Hz; inverter trips.",
        "causes": [
          "No Clone00.bin file in the correct directory /USER/SINAMICS/DATA."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "If an automatic clone is required: Insert the MMC/SD card with correct file and power-cycle.",
          "If no automatic clone is required: Remove the card if not needed and power-cycle; reset P8458 = 0 and power-cycle.",
          "Note: Fault can only be cleared by a power-cycle.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F71",
        "title": "USS setpoint fault",
        "symptom": "Fault icon shows and the display shows F71 (USS setpoint fault); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "No setpoint values from USS during telegram off time"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Check USS master",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F72",
        "title": "USS/MODBUS setpoint fault",
        "symptom": "Fault icon shows and the display shows F72 (USS/MODBUS setpoint fault); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "No setpoint values from USS/MODBUS during telegram off time"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Check USS/MODBUS master",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F80",
        "title": "Signal lost on analog input",
        "symptom": "Fault icon shows and the display shows F80 (Signal lost on analog input); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Broken wire",
          "Signal out of limits"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)",
          "Measure AI1 (2) or AI2 (3) to 0V (5): AI1 -10…10 V, AI2 0…10 V, or 0…20 mA in current mode (OI p.43); 0 V / 0 mA indicates a broken wire."
        ],
        "fix": [
          "The V20 fault/alarm list gives no remedy text for this code (see the source page); use the cause and the confirm steps.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F85",
        "title": "External fault",
        "symptom": "Fault icon shows and the display shows F85 (External fault); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "External fault triggered via command input via control word 2, bit 13."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)",
          "Check which source is set in P2106 and measure that digital input to DI C (OI p.43)."
        ],
        "fix": [
          "Check P2106.",
          "Disable control word 2 bit 13 as command source.",
          "Disable the terminal input for fault trigger only if nothing protective (guard, thermistor) is wired to it; a qualified person must decide.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F100",
        "title": "Watchdog reset",
        "symptom": "Fault icon shows and the display shows F100 (Watchdog reset); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Software Error"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Contact service department or change inverter.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F101",
        "title": "Stack overflow",
        "symptom": "Fault icon shows and the display shows F101 (Stack overflow); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Software error or processor failure."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Contact service department or change inverter.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F221",
        "title": "PID feedback below minimum value",
        "symptom": "Fault icon shows and the display shows F221 (PID feedback below minimum value); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "PID feedback below minimum value P2268."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Change value of P2268.",
          "Adjust feedback gain.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F222",
        "title": "PID feedback above maximum value",
        "symptom": "Fault icon shows and the display shows F222 (PID feedback above maximum value); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "PID feedback above maximum value P2267."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Change value of P2267.",
          "Adjust feedback gain.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F350",
        "title": "Configuration vector for the inverter failed",
        "symptom": "Fault icon shows and the display shows F350 (Configuration vector for the inverter failed); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "At startup the configuration (SZL) vector is wrong or the hardware does not match it, so the inverter trips.",
          "r0949 = 1/2/11/12: Internal failure (no hardware/software configuration vector, inverter code not supported, software vector not possible)",
          "r0949 = 13: Wrong power module fitted.",
          "r0949 > 1000: Internal failure - wrong I/O board fitted."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "Internal failures cannot be fixed.",
          "r0949 = 13 - Make sure the right power module is fitted.",
          "Note: Fault needs power-cycle to be acknowledged.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.287 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F395",
        "title": "Acceptance test/confirmation pending",
        "symptom": "Fault icon shows and the display shows F395 (Acceptance test/confirmation pending); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "This fault occurs after a startup clone. It can also be caused by a faulty read from the EEPROM, see F51 for more details.",
          "A startup clone could have changed and might not match the application. This parameter set needs to be checked before the inverter can start a motor.",
          "r0949 = 3/4: Inverter data change; r0949 = 5: Startup clone via an MMC/SD card has been performed; r0949 = 10: Previous startup clone was aborted"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "The current parameter set needs to be checked and confirmed by clearing the fault.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.288 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F410",
        "title": "Cavitation protection failure",
        "symptom": "Fault icon shows and the display shows F410 (Cavitation protection failure); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Cavitation risk: too little fluid flow through the pump, which can cause heat build-up and pump damage."
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "If cavitation is not occurring, reduce the cavitation threshhold P2361, or increase the cavitation protection delay.",
          "Ensure sensor feedback is working.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.288 (8.1 Faults, Fault code list)"
      },
      {
        "code": "F452",
        "title": "Load monitoring trip",
        "symptom": "Fault icon shows and the display shows F452 (Load monitoring trip); status LED fast flashing red at 2 Hz; the inverter trips.",
        "causes": [
          "Load conditions on motor indicate belt failure or mechanical fault.",
          "r0949 = 0: trip low torque / speed; r0949 = 1: trip high torque / speed"
        ],
        "confirm": [
          "r0947 = fault code (r0947[0] newest, up to 8 per buffer), r0949 = value (OI p.190-192). BOP fault screen: hold > 2 s = status at fault (OI p.281-282)"
        ],
        "fix": [
          "No breakage, seizure or obstruction of inverter train.",
          "Apply lubrication if required.",
          "If using an external speed sensor, check P2192, P2182, P2183, P2184 for correct function.",
          "If using a specific torque / speed range, check parameters P2182…P2190 and P2192.",
          "Clear/acknowledge the fault on the BOP or externally if the inverter has been set up so (OI p.281)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.288 (8.1 Faults, Fault code list)"
      },
      {
        "code": "A501",
        "title": "Current limit",
        "symptom": "Alarm icon shows and the display shows A501 (Current limit); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Motor power does not correspond to the inverter power",
          "Motor leads are too long",
          "Earth faults",
          "Small motors (120 W) under FCC and light load may cause a high current"
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "See F1.",
          "Use V/f operation for very small motors"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.289 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A502",
        "title": "Overvoltage limit",
        "symptom": "Alarm icon shows and the display shows A502 (Overvoltage limit); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Overvoltage limit is reached. This warning can occur during ramp down, if the Vdc controller is disabled (P1240 = 0)."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "If this warning is displayed permanently, check inverter input voltage."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.289 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A503",
        "title": "Undervoltage limit",
        "symptom": "Alarm icon shows and the display shows A503 (Undervoltage limit); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Main supply failed.",
          "Main supply and consequently DC-link voltage (r0026) below specified limit."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289).",
          "Meter supply at inverter input: 3 AC 400 V types 380…480 V AC -15%/+10% = 323…528 V AC; 1 AC 230 V types 200…240 V AC ±10% = 180…264 V AC (OI p.293)."
        ],
        "fix": [
          "Check main supply voltage."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.289 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A504",
        "title": "Inverter overtemperature",
        "symptom": "Alarm icon shows and the display shows A504 (Inverter overtemperature); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Heat sink temp, chip junction temp or junction temp change over warning level; pulse and/or output frequency reduced (per P0290)."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Note: r0037[0]: Heat sink temperature; r0037[1]: Chip junction temperature (includes heat sink)",
          "Surrounding temperature must lie within specified limits",
          "Load conditions and load steps must be appropriate",
          "Fan must turn when inverter is running"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.289 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A505",
        "title": "Inverter I2t",
        "symptom": "Alarm icon shows and the display shows A505 (Inverter I2t); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Warning level exceeded, current will be reduced if parameterized (P0610 = 1)."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Check that load cycle lies within specified limits."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.289 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A506",
        "title": "IGBT junction temperature rise warning",
        "symptom": "Alarm icon, display A506 (IGBT junction temperature rise warning). Alarms cannot be acknowledged; they clear once fixed.",
        "causes": [
          "Overload warning. Difference between heat sink and IGBT junction temperature exceeds warning limits."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Check that load steps and shock loads lie within specified limits."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.289 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A507",
        "title": "Inverter temperature signal lost",
        "symptom": "Alarm icon shows and the display shows A507 (Inverter temperature signal lost); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Inverter heat sink temperature signal loss. Possible sensor fallen off."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Contact service department or change inverter."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.289 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A511",
        "title": "Motor overtemperature I2t",
        "symptom": "Alarm icon shows and the display shows A511 (Motor overtemperature I2t); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Motor overloaded.",
          "Load cycles or load steps too high."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "P0604 motor temperature warning threshold",
          "P0625 motor surrounding temperature",
          "Verify rating-plate data; if wrong, redo quick commissioning. Run motor identification (P1900 = 2) for accurate equivalent-circuit data.",
          "Check if motor weight (P0344) is reasonable. Change if necessary.",
          "With P0626, P0627, and P0628 the standard overtemperature can be changed, if the motor is not a SIEMENS standard motor."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.290 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A535",
        "title": "Braking resistor overload",
        "symptom": "Alarm icon shows and the display shows A535 (Braking resistor overload); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "The braking energy is too large.",
          "The braking resistor is not suited for the application."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Reduce the braking energy.",
          "Use a braking resistor with a higher rating."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.290 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A541",
        "title": "Motor data identification active",
        "symptom": "Alarm icon shows and the display shows A541 (Motor data identification active); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Motor data identification (P1900) selected or running."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "The V20 fault/alarm list gives no remedy text for this code (see the source page); use the cause and the confirm steps."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.290 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A600",
        "title": "RTOS overrun warning",
        "symptom": "Alarm icon shows and the display shows A600 (RTOS overrun warning); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Internal time slice overrun"
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Contact service department."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.290 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A910",
        "title": "Vdc_max controller deactivated",
        "symptom": "Alarm icon shows and the display shows A910 (Vdc_max controller deactivated); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Occurs if main supply voltage (P0210) is permanently too high.",
          "if motor is driven by an active load, causing motor to go into regenerative mode.",
          "at very high load inertias, when ramping down.",
          "If A910 appears in standby (pulses off) and ON is then given, the Vdc_max controller (A911) stays inactive until A910 is cleared."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Input voltage must lie within range.",
          "Load must be match.",
          "In certain cases apply braking resistor."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.290 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A911",
        "title": "Vdc_max controller active",
        "symptom": "Alarm icon shows and the display shows A911 (Vdc_max controller active); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "The Vdc_max controller works to keep the DC-link voltage (r0026) below the level specified in r1242."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Supply voltage must lie within limits indicated on rating plate.",
          "Ramp-down time (P1121) must match inertia of load.",
          "Higher inertia requires longer ramp times; otherwise, apply braking resistor."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.290 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A912",
        "title": "Vdc_min controller active",
        "symptom": "Alarm icon shows and the display shows A912 (Vdc_min controller active); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "The Vdc_min controller will be activated if the DC-link voltage (r0026) falls below the level specified in r1246.",
          "Motor kinetic energy holds up the DC link, so the drive decelerates; brief mains dips need not cause an undervoltage trip.",
          "Note that this warning may also occur on fast ramp-ups."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "The V20 fault/alarm list gives no remedy text for this code (see the source page); use the cause and the confirm steps."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.291 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A921",
        "title": "Analog output parameters not set properly",
        "symptom": "Alarm icon, display A921 (analog output parameters set wrong). Alarms cannot be acknowledged; they clear once fixed.",
        "causes": [
          "Analog output parameters (P0777 and P0779) should not be set to identical values, since this would produce illogical results."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Parameter settings for output identical",
          "Parameter settings for input identical",
          "Parameter settings for output do not correspond to analog output type",
          "Set P0777 and P0779 to different values."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.291 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A922",
        "title": "No load applied to inverter",
        "symptom": "Alarm icon shows and the display shows A922 (No load applied to inverter); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "No Load is applied to the inverter. As a result, some functions may not work as under normal load conditions."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Check that motor is connected to inverter."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.291 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A923",
        "title": "Both JOG left and JOG right are requested",
        "symptom": "Alarm icon, display A923 (JOG left and JOG right both requested). Alarms cannot be acknowledged; they clear once fixed.",
        "causes": [
          "Both JOG right and JOG left (P1055 / P1056) have been requested. This freezes the RFG output frequency at its current value."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Do not press JOG right and left simultaneously."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.291 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A930",
        "title": "Cavitation protection warn",
        "symptom": "Alarm icon shows and the display shows A930 (Cavitation protection warn); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Conditions exist for possible cavitation damage."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "See F410."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.291 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A936",
        "title": "PID autotuning active",
        "symptom": "Alarm icon shows and the display shows A936 (PID autotuning active); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "PID autotuning (P2350) selected or running"
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "Warning disappears when PID autotuning has finished."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.291 (8.2 Alarms, Alarm code list)"
      },
      {
        "code": "A952",
        "title": "Load monitoring warning",
        "symptom": "Alarm icon shows and the display shows A952 (Load monitoring warning); alarms cannot be acknowledged and clear automatically when rectified.",
        "causes": [
          "Load conditions on motor indicate belt failure or mechanical fault."
        ],
        "confirm": [
          "Read r2110 (warning number) (OI p.237); the alarm icon shows and the display shows the code preceded by \"A\" (OI p.289)."
        ],
        "fix": [
          "See F452."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf p.291 (8.2 Alarms, Alarm code list)"
      }
    ],
    "sources": [
      "https://cache.industry.siemens.com/dl/files/056/104426056/att_70877/v1/v20_operating_instructions_complete_en-US_en-US.pdf (SINAMICS V20 Inverter Operating Instructions 09/2014, A5E34559884: 4.2 Terminal description p.43-44, 5.1.6 LED states p.58, parameter list p.155-237, 8 Faults and alarms p.281-291, A Technical specifications p.293)"
    ]
  },
  {
    "id": "yaskawa-ga500-vfd",
    "title": "Yaskawa GA500 AC drive",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "GA500"
    },
    "normal": [
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, 400 V class (three-phase 380…480 V AC, -15%…+10%)",
        "meter": "VAC",
        "expected": "323…528 V AC",
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
        "note": "Input power supply voltage TR p.141; permitted voltage fluctuation -15% to +10%, specification tables TR p.351",
        "liveWork": true
      },
      {
        "terminals": "R/L1, S/L2, T/L3 (line to line)",
        "state": "power applied, 200 V class (three-phase 200…240 V AC, -15%…+10%)",
        "meter": "VAC",
        "expected": "170…264 V AC",
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
        "note": "TR p.141, p.351",
        "liveWork": true
      },
      {
        "terminals": "U1-07 [DC Bus Voltage] (keypad)",
        "state": "powered, no fault",
        "meter": "display",
        "expected": "Above Uv1 (~190 V 200 V class, 380 V 400 V class), below ov (~410 V / 820 V). DC supply: 270…340 V DC (200 V class), 513…679 V DC (400 V class).",
        "note": "TR p.141, p.351, Table 12.37 p.598; U1-07 p.464"
      },
      {
        "terminals": "SP (+24 Vdc) to SN (0 V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "+24 V DC MFDI power supply (maximum 150 mA)",
        "pins": [
          [
            "SP",
            "SN"
          ]
        ],
        "note": "Table 3.5, TR p.93"
      },
      {
        "terminals": "+V to AC",
        "state": "powered",
        "meter": "VDC",
        "expected": "10.5 V (allowable current 20 mA maximum)",
        "pins": [
          [
            "+V",
            "AC"
          ]
        ],
        "note": "TR p.93"
      },
      {
        "terminals": "A1 to AC",
        "state": "frequency reference, H3-01 = 0-10 V",
        "meter": "VDC",
        "expected": "0…10 V = 0…100% (or -10…+10 V), input impedance min. 15 kohm",
        "pins": [
          [
            "A1",
            "AC"
          ]
        ],
        "note": "TR p.93"
      },
      {
        "terminals": "A2 to AC",
        "state": "frequency reference, current input (DIP switch S1, H3-09)",
        "meter": "mA",
        "expected": "4…20 mA (or 0…20 mA), input impedance 250 ohm",
        "pins": [
          [
            "A2",
            "AC"
          ]
        ],
        "note": "TR p.93"
      },
      {
        "terminals": "S1…S7 MFDI",
        "state": "input ON",
        "meter": "visual",
        "expected": "photocoupler input 24 V, 6 mA; check with U1-10 [Input Terminal Status]",
        "note": "Sinking mode internal supply: jumper SC-SP; sourcing mode internal supply: jumper SC-SN (never both) (TR p.93); U1-10 TR p.465"
      },
      {
        "terminals": "H1-HC and H2-HC",
        "state": "normal operation (Safe Disable inputs ON)",
        "meter": "continuity",
        "expected": "both circuits closed (factory jumpers H1-HC, H2-HC, or closed safety contacts); 24 V, 6 mA signal",
        "pins": [
          [
            "H1",
            "HC"
          ],
          [
            "H2",
            "HC"
          ]
        ],
        "note": "TR p.93, Table 5.29 p.215; do not close HC to SN"
      },
      {
        "terminals": "H1-HC or H2-HC",
        "state": "Safe Torque Off",
        "meter": "continuity",
        "expected": "open (OFF: coasting motor); keypad SToF (one channel) or STo (both), minimum OFF time 3 ms",
        "pins": [
          [
            "H1",
            "HC"
          ],
          [
            "H2",
            "HC"
          ]
        ],
        "note": "TR p.93, p.214-215"
      },
      {
        "terminals": "MA to MC",
        "state": "fault",
        "meter": "continuity",
        "expected": "closed (N.O. output, Fault)",
        "pins": [
          [
            "MA",
            "MC"
          ]
        ],
        "note": "Table 3.6 TR p.94; relay 30 V DC / 250 V AC, 10 mA…1 A"
      },
      {
        "terminals": "MB to MC",
        "state": "no fault",
        "meter": "continuity",
        "expected": "closed (N.C. output, Fault)",
        "pins": [
          [
            "MB",
            "MC"
          ]
        ],
        "note": "TR p.94"
      },
      {
        "terminals": "PS to AC",
        "state": "external 24 V control supply used",
        "meter": "VDC",
        "expected": "21.6…26.4 V DC (700 mA)",
        "pins": [
          [
            "PS",
            "AC"
          ]
        ],
        "note": "Table 3.8 TR p.94"
      }
    ],
    "pairs": [
      {
        "a": "MA",
        "b": "MC",
        "when": "fault",
        "note": "Fault relay N.O. contact (Table 3.6, TR p.94)."
      },
      {
        "a": "MB",
        "b": "MC",
        "when": "no fault",
        "note": "Fault relay N.C. contact (Table 3.6, TR p.94)."
      },
      {
        "a": "P1",
        "b": "C1",
        "when": "during run (default)",
        "note": "Photocoupler output 1 default During RUN, 48 V, 2…50 mA (TR p.94)."
      },
      {
        "a": "P2",
        "b": "C2",
        "when": "speed agree 1 (default)",
        "note": "Photocoupler output 2 default Speed agree 1 (TR p.94)."
      }
    ],
    "indicators": [
      {
        "name": "ALM/ERR LED",
        "state": "illuminated",
        "meaning": "The drive detects a fault (TR p.125)."
      },
      {
        "name": "ALM/ERR LED",
        "state": "off",
        "meaning": "There are no drive faults or alarms (TR p.125)."
      },
      {
        "name": "ALM/ERR LED",
        "state": "flashing",
        "meaning": "Alarm, operation error (oPE) or Auto-Tuning error; also flashes with SToF (one Safe Disable channel open) (TR p.125, p.215)."
      },
      {
        "name": "READY LED",
        "state": "illuminated",
        "meaning": "The drive is operating or is ready for operation (TR p.125)."
      },
      {
        "name": "READY LED",
        "state": "off",
        "meaning": "The drive detects a fault, or there is no fault and the drive received a Run command but cannot run (e.g. Programming Mode) (TR p.125)."
      },
      {
        "name": "READY LED",
        "state": "flashing",
        "meaning": "The drive is in STo [Safe Torque OFF] condition (TR p.125)."
      },
      {
        "name": "READY LED",
        "state": "flashing quickly",
        "meaning": "The main circuit voltage is not within the nameplate specifications and the external 24 V supply is the only power to the drive (TR p.125)."
      },
      {
        "name": "RUN LED",
        "state": "illuminated",
        "meaning": "The drive is in normal operation (TR p.126)."
      },
      {
        "name": "RUN LED",
        "state": "off",
        "meaning": "The drive is stopped (TR p.126)."
      },
      {
        "name": "RUN LED",
        "state": "flashing",
        "meaning": "Decelerating to stop, or Run command with 0 Hz reference without zero speed control (TR p.126)."
      },
      {
        "name": "RUN LED",
        "state": "flashing quickly",
        "meaning": "Run via MFDI in LOCAL/outside Drive Mode, Fast Stop, safety cut output, STOP pressed in REMOTE, or powered with Run active and b1-17 = 0 (TR p.126)."
      },
      {
        "name": "LO/RE LED",
        "state": "illuminated",
        "meaning": "The keypad controls the Run command (LOCAL Mode) (TR p.125)."
      },
      {
        "name": "LO/RE LED",
        "state": "off",
        "meaning": "Control circuit terminal or serial transmission controls the Run command (REMOTE Mode) (TR p.125)."
      },
      {
        "name": "keypad display",
        "state": "SToF (flashing)",
        "meaning": "One of H1-HC / H2-HC open (TR p.215)."
      },
      {
        "name": "keypad display",
        "state": "STo (flashing)",
        "meaning": "Both H1-HC and H2-HC open: Safe Torque Off (TR p.215)."
      }
    ],
    "faults": [
      {
        "code": "bAT",
        "title": "Keypad Battery Low Voltage",
        "symptom": "bAT [Keypad Battery Low Voltage]: ALM/ERR on, output off, MA-MC closes (MB-MC opens). Alarm (7.5): H2-01 to H2-03 = 10 on; o4-24 (see source)",
        "causes": [
          "The keypad battery voltage is low."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Replace the keypad battery.",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.264 (7.4 Fault); p.286 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "bCE",
        "title": "Bluetooth Communication Fault",
        "symptom": "bCE (Bluetooth keypad + phone): ALM/ERR on, output off, MA-MC closes (MB-MC opens); o2-27 stop. Alarm (7.5): H2-01 to H2-03 = 10 (see source)",
        "causes": [
          "The smartphone or tablet with DriveWizard Mobile installed is too far from the keypad.",
          "Radio waves from a different device are causing interference with communications between the smartphone or tablet and keypad.",
          "Radio waves from a different device are causing interference with the communication between the smartphone or tablet and keypad."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Keep the smartphone/tablet within 10 m (32.8 ft) of the keypad. bCE may still occur within 10 m, depending on the device.",
          "Make sure that no device around the keypad uses the same radio bandwidth (2400 MHz to 2480 MHz), and prevent radio interference.",
          "Keep the smartphone/tablet within 10 m (32.8 ft) of the keypad. bCE may still occur within 10 m, depending on the device.",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.264 (7.4 Fault); p.286 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "boL",
        "title": "BrakingTransistor Overload Fault",
        "symptom": "boL [BrakingTransistor Overload Fault]: ALM/ERR on, output off, MA-MC closes (MB-MC opens). Alarm (7.5): H2-01 to H2-03 = 10 on (see source)",
        "causes": [
          "The duty cycle of the braking transistor is high (the regeneration power or repetition frequency is high).",
          "You enabled the protective function for the braking transistor when you have a regenerative converter.",
          "The braking transistor in the drive is broken."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Add a regenerative converter, or lengthen the decel time.",
          "Only with a regenerative converter fitted: set L8-55 = 0 [Internal DB TransistorProtection Selection = Disable].",
          "Replace the drive.",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.264 (7.4 Fault); p.286 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "bUS",
        "title": "Option Communication Error",
        "symptom": "bUS (Run/ref on option card): ALM/ERR on, MA-MC closes (MB-MC opens), stop per F6-01 [Communication Error Selection]. Alarm (7.5): H2-01 to H2-03 = 10",
        "causes": [
          "The drive did not receive a signal from the controller.",
          "The communications cable wiring is incorrect.",
          "There is a short-circuit in the communications cable or the communications cable is not connected.",
          "Electrical interference caused a communication data error.",
          "The option is incorrectly installed to the drive.",
          "The option is damaged.",
          "The option card is incorrectly installed to the drive.",
          "The option card is damaged."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Correct wiring errors.",
          "Fix shorts and connect the cables; replace a defective comms cable.",
          "Reduce noise: check control/power/ground wiring and contactors (SPD if needed); shielded cable, shield grounded; route comms apart (see source)",
          "Correctly install the option to the drive.",
          "If the fault continues and the wiring is correct, replace the option.",
          "Correctly install the option card to the drive.",
          "If the alarm continues and the wiring is correct, replace the option card.",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.264 (7.4 Fault); p.286 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "CE",
        "title": "Modbus Communication Error",
        "symptom": "CE [Modbus Communication Error]: no good data for H5-09; ALM/ERR on, MA-MC closes, stop per H5-04. Alarm (7.5): H2-01 to H2-03 = 10 (see source)",
        "causes": [
          "The communications cable wiring is incorrect.",
          "There is a short circuit in the communications cable or the communications cable is not connected.",
          "Electrical interference caused a communication data error.",
          "There is a short-circuit in the communications cable or the communications cable is not connected.",
          "The communication protocol is not compatible.",
          "The value set in H5-09 [CE Detection Time] is too small for the communications cycle.",
          "The controller software or hardware is causing a communication problem."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Correct wiring errors.",
          "Fix shorts and connect the cables; replace a defective comms cable.",
          "Reduce noise: check control/power/ground wiring and contactors (SPD if needed); shielded cable, shield grounded; route comms apart (see source)",
          "Check the H5-xx settings against the controller-side settings and resolve any mismatch in comm conditions.",
          "Adjust the controller software settings, or raise H5-09.",
          "Examine the controller and remove the cause of the problem.",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.264 (7.4 Fault); p.287 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "CF",
        "title": "Control Fault",
        "symptom": "CF [Control Fault]: torque ref over torque limit 3 seconds or more during ramp to stop. ALM/ERR on, output off, MA-MC closes (MB-MC opens).",
        "causes": [
          "Motor parameters are set incorrectly",
          "The torque limit setting is too low.",
          "The load inertia is too large.",
          "The drive is trying to ramp to stop a machine that cannot do ramp to stop or on a machine for which deceleration is not necessary.",
          "The motor and drive are connected incorrectly.",
          "Line-to-line Resistance Tuning is not done.",
          "The drive received a Run command while the motor was coasting."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Correctly set the motor parameters and do Auto-Tuning again.",
          "Adjust L7-01 to L7-04 [Torque Limit].",
          "Adjust C1-02, C1-04, C1-06, C1-08 [Deceleration Times]. Set frequency ref to min output frequency; drop Run once decel ends.",
          "Correctly set b1-03 [Stopping Method Selection].",
          "Correct wiring errors.",
          "Do Stationary Auto-Tuning for Line-to-Line Resistance.",
          "Change the sequence so Run is given only once the motor has fully stopped, or set b3-01 = 1 (speed search at start enabled).",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.265 (7.4 Fault)"
      },
      {
        "code": "CoF",
        "title": "Current Offset Fault",
        "symptom": "Keypad shows CoF [Current Offset Fault]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "The drive starts operation while the induced voltage stays in the motor (during coasting to a stop or after fast deceleration).",
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Avoid restart while motor holds induced voltage; set b3-01 = 1 [Speed Search at Start]; or terminal speed search H1-xx = 61, 62 (same 1 and 2 on PM).",
          "Clear with a Fault Reset or by powering down the drive; replace the drive if the fault persists.",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.265 (7.4 Fault)"
      },
      {
        "code": "CP1",
        "title": "Comparator 1 Limit Error",
        "symptom": "CP1 (H2-01 to H2-03 = 66 Comparator1): ALM/ERR on, MA-MC closes (MB-MC opens); H2-33 sets stop/enable. Alarm (7.5): H2-xx = 10 on.",
        "causes": [
          "H2-20 [Comparator 1 Monitor Selection] value fell inside H2-21 [Comparator 1 Lower Limit] to H2-22 [Comparator 1 Upper Limit]."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the monitor value and remove the cause of the fault.",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.265 (7.4 Fault); p.287 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "CP2",
        "title": "Comparator 2 Limit Error",
        "symptom": "CP2 (H2-01 to H2-03 = 67 Comparator2): ALM/ERR on, MA-MC closes (MB-MC opens); H2-35 sets stop/enable. Alarm (7.5): H2-xx = 10 on.",
        "causes": [
          "H2-26 [Comparator 2 Monitor Selection] value went outside H2-27 [Comparator 2 Lower Limit] to H2-28 [Comparator 2 Upper Limit]."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the monitor value and remove the cause of the fault.",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.265 (7.4 Fault); p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "CPF00",
        "title": "Control Circuit Error",
        "symptom": "Keypad: CPF00 [Control Circuit Error]; ALM/ERR LED on; output shuts off; MA-MC closes (MB-MC opens). No fault trace for this fault.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault stays, replace the control board or the drive (ask Yaskawa or your sales rep about board replacement).",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.266 (7.4 Fault)"
      },
      {
        "code": "CPF01",
        "title": "Control Circuit Error",
        "symptom": "Keypad: CPF01 [Control Circuit Error]; ALM/ERR LED on; output shuts off; MA-MC closes (MB-MC opens). No fault trace for this fault.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 [Current Fault], U2-02 [Previous Fault], U2-03…U2-20 [Fault Trace] (Hz/A/V at trip), U3-01 [1st MostRecent Fault]… (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault stays, replace the control board or the drive (ask Yaskawa or your sales rep about board replacement).",
          "Fix the cause, then reset: keypad RESET, an MFDI with H1-xx = 14 [Fault Reset] (default S4) turned ON, or power the drive off and on (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.266 (7.4 Fault)"
      },
      {
        "code": "CPF02",
        "title": "Control Circuit Error",
        "symptom": "CPF02 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.266 (7.4 Fault)"
      },
      {
        "code": "CPF03",
        "title": "Control Circuit Error",
        "symptom": "CPF03 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.266 (7.4 Fault)"
      },
      {
        "code": "CPF06",
        "title": "Control Circuit Error (EEPROM memory Data Error)",
        "symptom": "CPF06 [Control Circuit Error (EEPROM memory Data Error)] trip (ALM/ERR LED on, MA-MC closes). Bad data written to drive EEPROM. No fault trace.",
        "causes": [
          "The drive power supply was de-energized while a communication option entered a parameter Write command.",
          "An EEPROM peripheral circuit error occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Set A1-03 = 2220, 3330 [Initialize Parameters = 2-Wire Initialization, 3-Wire Initialization] and initialize the drive.",
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.266 (7.4 Fault)"
      },
      {
        "code": "CPF08",
        "title": "Control Circuit Error",
        "symptom": "CPF08 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.266 (7.4 Fault)"
      },
      {
        "code": "CPF11",
        "title": "Control Circuit Error",
        "symptom": "CPF11 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.266 (7.4 Fault)"
      },
      {
        "code": "CPF12",
        "title": "Control Circuit Error",
        "symptom": "CPF12 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.267 (7.4 Fault)"
      },
      {
        "code": "CPF13",
        "title": "Control Circuit Error",
        "symptom": "CPF13 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.267 (7.4 Fault)"
      },
      {
        "code": "CPF14",
        "title": "Control Circuit Error",
        "symptom": "CPF14 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.267 (7.4 Fault)"
      },
      {
        "code": "CPF16",
        "title": "Control Circuit Error",
        "symptom": "CPF16 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.267 (7.4 Fault)"
      },
      {
        "code": "CPF17",
        "title": "Control Circuit Error",
        "symptom": "CPF17 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.267 (7.4 Fault)"
      },
      {
        "code": "CPF18",
        "title": "Control Circuit Error",
        "symptom": "CPF18 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.267 (7.4 Fault)"
      },
      {
        "code": "CPF19",
        "title": "Control Circuit Error",
        "symptom": "CPF19 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.267 (7.4 Fault)"
      },
      {
        "code": "CPF20",
        "title": "Control Circuit Error",
        "symptom": "CPF20 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.267 (7.4 Fault)"
      },
      {
        "code": "CPF21",
        "title": "Control Circuit Error",
        "symptom": "CPF21 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault)"
      },
      {
        "code": "CPF22",
        "title": "Control Circuit Error",
        "symptom": "CPF22 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault)"
      },
      {
        "code": "CPF23",
        "title": "Control Circuit Error",
        "symptom": "CPF23 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault)"
      },
      {
        "code": "CPF24",
        "title": "Control Circuit Error (Drive Unit Signal Fault)",
        "symptom": "CPF24 [Control Circuit Error (Drive Unit Signal Fault)] trip (ALM/ERR LED on, MA-MC closes). No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault)"
      },
      {
        "code": "CPF25",
        "title": "Terminal Board not Connected",
        "symptom": "Keypad shows CPF25 [Terminal Board not Connected]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "The terminal board is not correctly connected to the drive."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Check that the terminal board is connected."
        ],
        "fix": [
          "Power down the drive, reconnect the terminal board to it correctly, then power it up again.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault)"
      },
      {
        "code": "CPF38",
        "title": "Control Circuit Error",
        "symptom": "CPF38 [Control Circuit Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault)"
      },
      {
        "code": "dCE1",
        "title": "Communication Error1",
        "symptom": "dCE1 [Communication Error1] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred temporarily due to noise."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Eliminate the noise source; if the fault persists, replace the control board or the drive.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault)"
      },
      {
        "code": "dCE2",
        "title": "Communication Error2",
        "symptom": "dCE2 [Communication Error2] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "A drive hardware problem occurred temporarily due to noise."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Eliminate the noise source; if the fault persists, replace the control board or the drive.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault)"
      },
      {
        "code": "dEv",
        "title": "Speed Deviation",
        "symptom": "dEv [Speed Deviation]: speed error > F1-10 for > F1-11; stops per F1-04. Fault (LED on, output off) or alarm (LED flashes, H2-xx = 10).",
        "causes": [
          "The load is too heavy.",
          "Acceleration and deceleration times are set too short.",
          "The dEv detection level settings are incorrect.",
          "The load is locked up.",
          "The holding brake is stopping the motor.",
          "The load is too large.",
          "The acceleration/deceleration times are too short."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Decrease the load.",
          "Increase the values set in C1-01 to C1-08 [Acceleration/ Deceleration Time].",
          "Adjust F1-10 [Speed Deviation Detection Level] and F1-11 [Speed Deviation Detect DelayTime].",
          "Examine the machine.",
          "Release the holding brake.",
          "Increase the values set in C1-01 to C1-08 [Acceleration/ Deceleration Times].",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.268 (7.4 Fault); p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "dv7",
        "title": "Polarity Judge Timeout",
        "symptom": "dv7 [Polarity Judge Timeout] trip (ALM/ERR LED on, MA-MC closes). Polarity not found within the preset time.",
        "causes": [
          "There is a disconnection in the motor coil winding.",
          "The screws on the drive output terminals are loose."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Measure the motor line-to-line resistance and replace the motor if a coil is disconnected.",
          "Tighten the terminal screws to the correct tightening torque.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.269 (7.4 Fault)"
      },
      {
        "code": "dWF1",
        "title": "EEPROM Memory DWEZ Data Error",
        "symptom": "dWF1 [EEPROM Memory DWEZ Data Error] trip (ALM/ERR LED on, MA-MC closes). DriveWorksEZ program saved in EEPROM is corrupt.",
        "causes": [
          "There is an error in the EEPROM peripheral circuit.",
          "There is a problem with the EEPROM data."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Initialize the drive with A1-03 = 2220 or 3330 (2-Wire / 3-Wire Initialization), then upload the DriveWorksEZ project again.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.269 (7.4 Fault)"
      },
      {
        "code": "dWF2",
        "title": "DriveWorksEZ Fault 2",
        "symptom": "Keypad shows dWF2 [DriveWorksEZ Fault 2]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "There was a fault in the DriveWorksEZ program."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the DriveWorksEZ program and remove the cause of the fault. This is not a drive fault.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.269 (7.4 Fault)"
      },
      {
        "code": "dWF3",
        "title": "DriveWorksEZ Fault 3",
        "symptom": "Keypad shows dWF3 [DriveWorksEZ Fault 3]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "There was a fault in the DriveWorksEZ program."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the DriveWorksEZ program and remove the cause of the fault. This is not a drive fault.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.269 (7.4 Fault)"
      },
      {
        "code": "dWFL",
        "title": "DriveWorksEZ Fault",
        "symptom": "Keypad shows dWFL [DriveWorksEZ Fault]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "There was a fault in the DriveWorksEZ program."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the DriveWorksEZ program and remove the cause of the fault. This is not a drive fault.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.269 (7.4 Fault)"
      },
      {
        "code": "E5",
        "title": "MECHATROLINK Watchdog Timer Err",
        "symptom": "E5 [MECHATROLINK Watchdog Timer Err]: motor stops per F6-25. Shown as fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "The drive detected a watchdog circuit exception while it received data from the controller."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Check the MECHATROLINK cable. If frequent, fix wiring and noise per MECHATROLINK-II guide MMATDEP011 / MECHATROLINK-III manual MMATDEP018.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.269 (7.4 Fault); p.289 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF0",
        "title": "Option Card External Fault",
        "symptom": "EF0 [Option Card External Fault]: external device alarm active; stop per F6-03. Shown as fault, or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "The communication option received an external fault from the controller.",
          "A programming error occurred on the controller side.",
          "The communication option card received an external fault from the controller."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input from the controller.",
          "Examine the operation of the controller program.",
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input from the controller.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.269 (7.4 Fault); p.289 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF1",
        "title": "External Fault (Terminal S1)",
        "symptom": "EF1 [External Fault (Terminal S1)]: fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "MFDI terminal S1 caused an external fault through an external device.",
          "The wiring is incorrect.",
          "External Fault [H1-01 = 20 to 2B] is set to MFDI terminal S1, but the terminal is not in use.",
          "External Fault [H1-01 = 2C to 2F] is set to MFDI terminal S1, but the terminal is not in use."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure terminal S1 input: View U1-10 [Input Terminal Status] (TR p.465) to see whether S1 (set to External Fault, H1-01) is active."
        ],
        "fix": [
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input on the MFDI.",
          "Correctly connect the signal line to MFDI terminal S1.",
          "Correctly set the MFDI.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.270 (7.4 Fault); p.289 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF2",
        "title": "External Fault (Terminal S2)",
        "symptom": "EF2 [External Fault (Terminal S2)]: fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "MFDI terminal S2 caused an external fault through an external device.",
          "The wiring is incorrect.",
          "External Fault [H1-02 = 20 to 2B] is set to MFDI terminal S2, but the terminal is not in use.",
          "External Fault [H1-02 = 2C to 2F] is set to MFDI terminal S2, but the terminal is not in use."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure terminal S2 input: View U1-10 [Input Terminal Status] (TR p.465) to see whether S2 (set to External Fault, H1-02) is active."
        ],
        "fix": [
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input on the MFDI.",
          "Correctly connect the signal line to MFDI terminal S2.",
          "Correctly set the MFDI.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.270 (7.4 Fault); p.289 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF3",
        "title": "External Fault (Terminal S3)",
        "symptom": "EF3 [External Fault (Terminal S3)]: fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "MFDI terminal S3 caused an external fault through an external device.",
          "The wiring is incorrect.",
          "External Fault [H1-03 = 20 to 2B] is set to MFDI terminal S3, but the terminal is not in use.",
          "External Fault [H1-03 = 2C to 2F] is set to MFDI terminal S3, but the terminal is not in use."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure terminal S3 input: View U1-10 [Input Terminal Status] (TR p.465) to see whether S3 (set to External Fault, H1-03) is active."
        ],
        "fix": [
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input on the MFDI.",
          "Correctly connect the signal line to MFDI terminal S3.",
          "Correctly set the MFDI.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.270 (7.4 Fault); p.289 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF4",
        "title": "External Fault (Terminal S4)",
        "symptom": "EF4 [External Fault (Terminal S4)]: fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "MFDI terminal S4 caused an external fault through an external device.",
          "The wiring is incorrect.",
          "External Fault [H1-04 = 20 to 2B] is set to MFDI terminal S4, but the terminal is not in use.",
          "External Fault [H1-04 = 2C to 2F] is set to MFDI terminal S4, but the terminal is not in use."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure terminal S4 input: View U1-10 [Input Terminal Status] (TR p.465) to see whether S4 (set to External Fault, H1-04) is active."
        ],
        "fix": [
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input on the MFDI.",
          "Correctly connect the signal line to MFDI terminal S4.",
          "Correctly set the MFDI.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.270 (7.4 Fault); p.289 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF5",
        "title": "External Fault (Terminal S5)",
        "symptom": "EF5 [External Fault (Terminal S5)]: fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "MFDI terminal S5 caused an external fault through an external device.",
          "The wiring is incorrect.",
          "External Fault [H1-05 = 20 to 2B] is set to MFDI terminal S5, but the terminal is not in use.",
          "External Fault [H1-05 = 2C to 2F] is set to MFDI terminal S5, but the terminal is not in use."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure terminal S5 input: View U1-10 [Input Terminal Status] (TR p.465) to see whether S5 (set to External Fault, H1-05) is active."
        ],
        "fix": [
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input on the MFDI.",
          "Correctly connect the signal line to MFDI terminal S5.",
          "Correctly set the MFDI.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.270 (7.4 Fault); p.290 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF6",
        "title": "External Fault (Terminal S6)",
        "symptom": "EF6 [External Fault (Terminal S6)]: fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "MFDI terminal S6 caused an external fault through an external device.",
          "The wiring is incorrect.",
          "External Fault [H1-06 = 20 to 2B] is set to MFDI terminal S6, but the terminal is not in use.",
          "External Fault [H1-06 = 2C to 2F] is set to MFDI terminal S6, but the terminal is not in use."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure terminal S6 input: View U1-10 [Input Terminal Status] (TR p.465) to see whether S6 (set to External Fault, H1-06) is active."
        ],
        "fix": [
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input on the MFDI.",
          "Correctly connect the signal line to MFDI terminal S6.",
          "Correctly set the MFDI.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.270 (7.4 Fault); p.290 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF7",
        "title": "External Fault (Terminal S7)",
        "symptom": "EF7 [External Fault (Terminal S7)]: fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "MFDI terminal S7 caused an external fault through an external device.",
          "The wiring is incorrect.",
          "External Fault [H1-07 = 20 to 2B] is set to MFDI terminal S7, but the terminal is not in use.",
          "External Fault [H1-07 = 2C to 2F] is set to MFDI terminal S7, but the terminal is not in use."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure terminal S7 input: View U1-10 [Input Terminal Status] (TR p.465) to see whether S7 (set to External Fault, H1-07) is active."
        ],
        "fix": [
          "Locate the device that raised the external fault and fix its cause; then clear the external fault input on the MFDI.",
          "Correctly connect the signal line to MFDI terminal S7.",
          "Correctly set the MFDI.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.271 (7.4 Fault); p.290 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "Err",
        "title": "EEPROM Write Error",
        "symptom": "Keypad shows Err [EEPROM Write Error]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "There was a problem with the EEPROM hardware.",
          "Electrical interference corrupted the data while it was writing to the EEPROM of the drive."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Press ENTER, then enter the parameters again.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.271 (7.4 Fault)"
      },
      {
        "code": "FbH",
        "title": "Excessive PID Feedback",
        "symptom": "FbH [Excessive PID Feedback]: PID feedback > b5-36 for > b5-37; stop per b5-12. Fault, or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "The FbH detection level is set incorrectly.",
          "There is a problem with the PID feedback wiring.",
          "The feedback sensor is not operating correctly.",
          "A fault occurred in the feedback input circuit of the drive."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Adjust b5-36 [PID High Feedback Detection Lvl] and b5-37 [PID High Feedback Detection Time].",
          "Correct errors with the PID control wiring.",
          "Examine the sensors on the control device side.",
          "Replace the control board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative.",
          "Replace the board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.271 (7.4 Fault); p.290 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "FbL",
        "title": "PID Feedback Loss",
        "symptom": "FbL [PID Feedback Loss]: PID feedback past b5-13 (alarm note: below) for > b5-14; stop per b5-12. Fault or alarm (H2-01 to H2-03 = 10).",
        "causes": [
          "The FbL detection level is set incorrectly.",
          "There is a problem with the PID feedback wiring.",
          "The feedback sensor is not operating correctly.",
          "A fault occurred in the feedback input circuit of the drive."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Check the PID feedback signal at the MFAI terminal (A1 or A2 to AC) with U1-13, U1-14 [Terminal A1, A2 Input Voltage]."
        ],
        "fix": [
          "Adjust b5-13 [PID Feedback Loss Detection Lvl] and b5-14 [PID Feedback Loss Detection Time].",
          "Correct errors with the PID control wiring.",
          "Examine the sensors on the control device side.",
          "Replace the control board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative.",
          "Replace the board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.271 (7.4 Fault); p.290 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "GF",
        "title": "Ground Fault",
        "symptom": "GF [Ground Fault] trip (ALM/ERR LED on, MA-MC closes). Ground current > 50% of rated on output side. L5-08 disables auto restart.",
        "causes": [
          "Overheating caused damage to the motor or the motor insulation is not satisfactory.",
          "Motor cable shorted to ground, or higher cable/ground stray capacitance raising leakage current.",
          "There was a problem with the drive hardware."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "With power removed, measure the insulation resistance between the motor main circuit cable and the ground terminal and of the motor (TR fault table)."
        ],
        "fix": [
          "Measure the motor insulation resistance, and replace the motor if there is electrical conduction or unserviceable insulation.",
          "Check motor cable for damage/shorts; replace it if it conducts to ground. Cable > 100 m: lower carrier frequency. Reduce stray capacitance.",
          "Replace the control board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.271 (7.4 Fault)"
      },
      {
        "code": "LF",
        "title": "Output Phase Loss",
        "symptom": "LF [Output Phase Loss] trip (ALM/ERR LED on, MA-MC closes). Phase lost on output side; L8-07 enables/disables LF detection.",
        "causes": [
          "The motor main circuit cable is disconnected.",
          "There is a disconnection in the motor coil winding.",
          "The screws on the drive output terminals are loose.",
          "The rated output current of the motor is less than 5% of the drive rated current.",
          "You are trying to use a single-phase motor.",
          "The output transistor in the drive is damaged."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "With power removed, check continuity of each motor phase from U/T1, V/T2, W/T3 through the motor (TR fault table)."
        ],
        "fix": [
          "Connect motor main circuit cable wiring. Correct wiring errors in the main circuit drive input power.",
          "If a coil is disconnected, measure the motor Line-to-Line Resistance and replace the motor.",
          "Tighten the terminal screws to the correct tightening torque.",
          "Examine the drive capacity or the motor output to be applied.",
          "The drive cannot operate a single-phase motor.",
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.272 (7.4 Fault)"
      },
      {
        "code": "LF2",
        "title": "Output Current Imbalance",
        "symptom": "LF2 [Output Current Imbalance] trip (ALM/ERR LED on, MA-MC closes). PM motor 3-phase output current unbalanced.",
        "causes": [
          "Phase loss occurred in the wiring on the output side of the drive.",
          "The output terminal screws of the drive are loose.",
          "There is not balance between the three phases of the PM motor impedance.",
          "The drive output circuit is broken."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine for wiring errors or disconnected wires on the output side of the drive, and repair problems.",
          "Tighten the terminal screws to the correct tightening torque.",
          "Measure line-to-line resistance of each motor phase; all three should match and wiring be correct. Otherwise replace the motor.",
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.272 (7.4 Fault)"
      },
      {
        "code": "LSo",
        "title": "Low Speed Motor Step-Out",
        "symptom": "LSo [Low Speed Motor Step-Out] trip: step-out at low speed (e.g. wrong initial polarity, no motor code). Lower L8-93 to L8-95 for faster detection.",
        "causes": [
          "The motor code set incorrectly.",
          "The load is too large.",
          "An external force on the load side caused the motor to move at start.",
          "The drive incorrectly detected the motor magnetic pole position.",
          "The setting of n8-84 [Polarity Detection Current] is too low.",
          "Incorrect values set in L8-93 [Low Speed Pull-out DetectionTime], L8-94 [Low Speed Pull-out Detect Level], and L8-95 [Low Speed Pull-out Amount].",
          "The drive incorrectly detected the motor magnetic pole position."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Set E5-01 [PM Motor Code Selection] to match the motor; for special motors set E5xx from the motor test report.",
          "Reduce the load, or fit a larger-capacity drive and motor.",
          "Find and repair problems on the load side that cause the motor to rotate from the load side.",
          "Set b3-01 = 1 (speed search at start). If U6-57 < 819, raise n8-84 (polarity detection current); ask the motor maker for max values.",
          "Increase the n8-84 setting from the default. Consult the motor manufacturer for information about maximum setting values.",
          "Increase the values set in L8-93 to L8-95.",
          "If you are using an IPM motor, do High Frequency Injection Auto- Tuning.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.272 (7.4 Fault)"
      },
      {
        "code": "nSE",
        "title": "Node Setup Error",
        "symptom": "Keypad shows nSE [Node Setup Error]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "The H1-xx = 47 [Node Setup (CANopen)] terminal was activated during run.",
          "The drive received a Run command while the Node Setup function was active."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Stop the drive when the Node Setup function is in use.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.272 (7.4 Fault)"
      },
      {
        "code": "oC",
        "title": "Overcurrent",
        "symptom": "oC [Overcurrent] trip (ALM/ERR LED on, MA-MC closes). Drive sensors saw output current above the overcurrent level.",
        "causes": [
          "The load is too heavy.",
          "Overheating caused damage to the motor or the motor insulation is not satisfactory.",
          "The motor main circuit cable is contacting ground to make a short circuit.",
          "A short circuit or ground fault on the drive output side caused damage to the output transistor of the drive.",
          "The acceleration time is too short.",
          "The drive is trying to operate a specialized motor or a motor that is larger than the maximum applicable motor output of the drive.",
          "A magnetic contactor was switched at the output.",
          "The V/f pattern settings are incorrect.",
          "The torque compensation gain is too large.",
          "Electrical interference caused a problem.",
          "The gain during overexcitation operation is too large.",
          "The drive received a Run command while the motor was coasting.",
          "In PM Control Methods, the setting of the motor code is incorrect.",
          "At start or low speed (10% or less) with n8-57 = 1 (HFI overlap) in PM control: HFI gain too high.",
          "The control method is set incorrectly for the motor.",
          "The motor main circuit cable is too long.",
          "Speed search does not complete at start when you set A1-02 = 8 [EZ Vector Control] and use an induction motor.",
          "An overcurrent occurred during overexcitation deceleration.",
          "When you use an IE3 premium efficiency motor."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure motor current; power off, test motor insulation and check B1 / - to U/T1, V/T2, W/T3 for shorts (TR fault table)."
        ],
        "fix": [
          "Measure motor current; if above drive rating, use a larger drive. Reduce load or upsize the drive to avoid sudden current jumps.",
          "Measure the motor insulation resistance, and replace the motor if there is electrical conduction or unserviceable insulation.",
          "Check motor cable for damage and repair shorts. Measure cable-to-ground resistance; replace the cable if it conducts.",
          "Check for shorts between B1 or - and U/T1, V/T2, W/T3. If shorted, contact Yaskawa or a sales rep.",
          "Calculate accel torque from inertia and accel time. Raise C1-01/C1-03/C1-05/C1-07 or C2-01 to C2-04 (S-curve), or use a larger drive.",
          "Compare nameplate and drive: drive rated current must exceed motor rated current; otherwise use a larger drive.",
          "Set the operation sequence to not turn ON or OFF the magnetic contactor while the drive is outputting voltage.",
          "Check V/f ratio; lower voltage if too high for the frequency. Adjust E1-04 to E1-10 (motor 2: E3-04 to E3-10).",
          "Decrease the value set in C4-01 [Torque Compensation Gain] to make sure that the motor does not stall.",
          "Examine the control circuit lines, main circuit lines, and ground wiring, and decrease the effects of electrical interference.",
          "Note when the fault occurs. If during overexcitation, lower n3-13 (OEB gain) and consider motor flux saturation.",
          "Give Run only after the motor fully stops, or enable speed search: b3-01 = 1, or MFDI H1-xx = 61/62 (from Fmax/Fref).",
          "Enter the correct PM motor code in E5-01; for special motors set E5xx from the motor test report.",
          "Set E5-xx correctly or run Rotational Auto-Tuning. Lower n8-41 (HFI P gain) in 0.5 steps; keep n8-41 > 0.0 for IPM motors.",
          "Set A1-02 [Control Method Selection] correctly.",
          "Fit a larger-capacity drive, or lower C6-02 (carrier frequency) or set C6-02 = B.",
          "When E9-01 = 0 [Motor Type Selection = Induction (IM)], set b3- 24 = 2 [Speed Search Method Selection = Current Detection Speed Search].",
          "Lower n3-13 (overexcitation braking, OEB, gain) or n3-21 (HSB current suppression level).",
          "Adjust: b3-03 (search decel time), L2-03 (min baseblock time), L2-04 (V/f recovery ramp) to 2 × default each.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.273 (7.4 Fault)"
      },
      {
        "code": "oC2",
        "title": "Overcurrent2",
        "symptom": "oC2 [Overcurrent2] trip (ALM/ERR LED on, MA-MC closes). Drive sensors saw output current above the overcurrent level.",
        "causes": [
          "With A1-02 = 5, 6 or 8 (OLV/PM, AOLV/PM, EZOLV), output current exceeds L8-27 [Overcurrent Detection Gain]."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Correct the value set in L8-27.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.274 (7.4 Fault)"
      },
      {
        "code": "oFA00",
        "title": "Option Not Compatible with Port",
        "symptom": "oFA00 [Option Not Compatible with Port] trip (ALM/ERR LED on, MA-MC closes). No fault trace.",
        "causes": [
          "The option connected to connector CN5 is not compatible."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Connect a correct option.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.274 (7.4 Fault)"
      },
      {
        "code": "oFA01",
        "title": "Option Fault/Connection Error",
        "symptom": "oFA01 [Option Fault/Connection Error] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens.",
        "causes": [
          "You changed the option card connected to connector CN5 during operation."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power down the drive; seat the option card correctly in the drive connector as its manual describes.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.274 (7.4 Fault)"
      },
      {
        "code": "oFA03",
        "title": "Option Card Error Occurred at Option Port CN5",
        "symptom": "oFA03 [Option Card Error Occurred at Option Port CN5] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off, reseat the option card in its connector, then power on. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.274 (7.4 Fault)"
      },
      {
        "code": "oFA04",
        "title": "Option Card Error Occurred at Option Port CN5",
        "symptom": "oFA04 [Option Card Error Occurred at Option Port CN5] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off, reseat the option card in its connector, then power on. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.274 (7.4 Fault)"
      },
      {
        "code": "oFA05",
        "title": "Option Card Error Occurred at Option Port CN5",
        "symptom": "oFA05 [Option Card Error Occurred at Option Port CN5] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off, reseat the option card in its connector, then power on. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.274 (7.4 Fault)"
      },
      {
        "code": "oFA06",
        "title": "Option Card Error Occurred at Option Port CN5",
        "symptom": "oFA06 [Option Card Error Occurred at Option Port CN5] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off, reseat the option card in its connector, then power on. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.274 (7.4 Fault)"
      },
      {
        "code": "oFA10",
        "title": "Option Card Error Occurred at Option Port CN5",
        "symptom": "oFA10 [Option Card Error Occurred at Option Port CN5] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.275 (7.4 Fault)"
      },
      {
        "code": "oFA11",
        "title": "Option Card Error Occurred at Option Port CN5",
        "symptom": "oFA11 [Option Card Error Occurred at Option Port CN5] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.275 (7.4 Fault)"
      },
      {
        "code": "oFA12",
        "title": "Option Card Connection Error (CN5)",
        "symptom": "oFA12 [Option Card Connection Error (CN5)] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens.",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.275 (7.4 Fault)"
      },
      {
        "code": "oFA13",
        "title": "Option Card Connection Error (CN5)",
        "symptom": "oFA13 [Option Card Connection Error (CN5)] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens.",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.275 (7.4 Fault)"
      },
      {
        "code": "oFA14",
        "title": "Option Card Connection Error (CN5)",
        "symptom": "oFA14 [Option Card Connection Error (CN5)] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens.",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.275 (7.4 Fault)"
      },
      {
        "code": "oFA15",
        "title": "Option Card Connection Error (CN5)",
        "symptom": "oFA15 [Option Card Connection Error (CN5)] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens.",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.275 (7.4 Fault)"
      },
      {
        "code": "oFA16",
        "title": "Option Card Connection Error (CN5)",
        "symptom": "oFA16 [Option Card Connection Error (CN5)] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens.",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.275 (7.4 Fault)"
      },
      {
        "code": "oFA17",
        "title": "Option Card Connection Error (CN5)",
        "symptom": "oFA17 [Option Card Connection Error (CN5)] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens.",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.275 (7.4 Fault)"
      },
      {
        "code": "oFA30",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA30 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.276 (7.4 Fault)"
      },
      {
        "code": "oFA31",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA31 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.276 (7.4 Fault)"
      },
      {
        "code": "oFA32",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA32 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.276 (7.4 Fault)"
      },
      {
        "code": "oFA33",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA33 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.276 (7.4 Fault)"
      },
      {
        "code": "oFA34",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA34 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.276 (7.4 Fault)"
      },
      {
        "code": "oFA35",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA35 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.276 (7.4 Fault)"
      },
      {
        "code": "oFA36",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA36 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.276 (7.4 Fault)"
      },
      {
        "code": "oFA37",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA37 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.276 (7.4 Fault)"
      },
      {
        "code": "oFA38",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA38 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.277 (7.4 Fault)"
      },
      {
        "code": "oFA39",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA39 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.277 (7.4 Fault)"
      },
      {
        "code": "oFA40",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA40 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.277 (7.4 Fault)"
      },
      {
        "code": "oFA41",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA41 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.277 (7.4 Fault)"
      },
      {
        "code": "oFA42",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA42 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.277 (7.4 Fault)"
      },
      {
        "code": "oFA43",
        "title": "Communication Option Card Connection Error (CN5)",
        "symptom": "oFA43 [Communication Option Card Connection Error (CN5)] trip (ALM/ERR LED on, MA-MC closes).",
        "causes": [
          "A fault occurred in the option card."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power off and reseat the option card in its connector. If it persists, replace the option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.277 (7.4 Fault)"
      },
      {
        "code": "oH",
        "title": "Heatsink Overheat",
        "symptom": "oH [Heatsink Overheat]: heatsink temp > L8-02; stop per L8-03. Shown as fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "The ambient temperature is high and the heatsink temperature of the drive is more than the value set in L8-02 [Overheat Alarm Level].",
          "The load is too heavy.",
          "The internal cooling fan of the drive stopped.",
          "The ambient temperature is high and the heatsink temperature is more than the L8-02 [Overheat Alarm Level].",
          "There is not sufficient airflow around the drive.",
          "The internal cooling fan or fans have stopped."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Measure ambient temp. Improve panel airflow, add a fan or air conditioner, and remove nearby heat sources.",
          "Measure output current; reduce the load or lower C6-02 (carrier frequency selection).",
          "Replace the cooling fan using this manual's procedure, then set o4-03 = 0 (fan operation time 0 h).",
          "Measure ambient temp. Improve airflow around the drive, add a fan or air conditioner, and remove nearby heat sources.",
          "Keep the installation clearance from the manual and good panel airflow. Clear dust/debris blocking the cooling fan or airflow.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.277 (7.4 Fault); p.292 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "oH1",
        "title": "Heatsink Overheat",
        "symptom": "oH1 [Heatsink Overheat] trip (ALM/ERR LED on, MA-MC closes). Heatsink above oH1 level (set by o2-04). L5-08 disables auto restart.",
        "causes": [
          "The ambient temperature is high and the heatsink temperature of the drive is more than the oH1 detection level.",
          "The load is too heavy."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Measure ambient temp. Improve panel airflow, add a fan or air conditioner, and remove nearby heat sources.",
          "Measure output current; reduce the load or lower C6-02 (carrier frequency selection).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.278 (7.4 Fault)"
      },
      {
        "code": "oH3",
        "title": "Motor Overheat (PTC Input)",
        "symptom": "oH3 [Motor Overheat (PTC Input)]: H3-02/H3-10 = E, PTC on A1/A2 over level; stop per L1-03. Fault, or alarm (H2-01 to H2-03 = 10).",
        "causes": [
          "The thermistor wiring that detects motor temperature is defective.",
          "A fault occurred on the machine. Example: The machine is locked.",
          "The motor has overheated."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Check the PTC input (MFAI set to motor PTC) and the motor temperature (TR fault table)."
        ],
        "fix": [
          "Correct wiring errors.",
          "Examine the machine and remove the cause of the fault",
          "Reduce load; raise C1-01 to C1-08; set E2-01 to nameplate FLA; fix motor cooling; adjust E1-04 to E1-10 (E3-04 to E3-10), E1-08/E1-10 (see source)",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.278 (7.4 Fault); p.292 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "oH4",
        "title": "Motor Overheat Fault (PTC Input)",
        "symptom": "oH4 [Motor Overheat Fault (PTC Input)] trip (ALM/ERR LED on, MA-MC closes). PTC on A1/A2 above fault level (H3-02, H3-10 = E).",
        "causes": [
          "The motor has overheated."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Check the PTC input (MFAI set to motor PTC) and the motor temperature (TR fault table)."
        ],
        "fix": [
          "Reduce load; raise C1-01 to C1-08; set E2-01 to nameplate FLA; fix motor cooling; adjust E1-04 to E1-10 (E3-04 to E3-10), E1-08/E1-10 (see source)",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.278 (7.4 Fault)"
      },
      {
        "code": "oL1",
        "title": "Motor Overload",
        "symptom": "oL1 [Motor Overload] trip (ALM/ERR LED on, MA-MC closes). Electronic thermal motor protection tripped; L5-07 disables auto restart.",
        "causes": [
          "The load is too large.",
          "The acceleration/deceleration times or cycle times are too short.",
          "Overload occurred while running at low speed.",
          "L1-01 [Motor Overload (oL1) Protection] is set incorrectly.",
          "The V/f pattern does not fit the motor qualities.",
          "E1-06 [Base Frequency] is set incorrectly.",
          "One drive is operating more than one motor.",
          "The electronic thermal protector qualities and the motor overload properties do not match.",
          "The electronic thermal protector is operating at an incorrect level.",
          "There is increased motor loss from overexcitation operation.",
          "The speed search-related parameters are set incorrectly.",
          "Phase loss in the input power supply is causing the output current to change.",
          "The motor main circuit cable is too long."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Decrease the load. Note: Reset oL1 when U4-16 [Motor oL1 Level] < 100.",
          "Check accel/decel times and start/stop cycle; raise C1-01 to C1-08.",
          "Cut load at low speed or speed up; for frequent low-speed use, fit a larger or drive-rated motor. General motors may overload there below rated amps.",
          "Set L1-01 in as specified by the motor qualities for a drive-dedicated motor.",
          "Check V/f ratio. Adjust E1-04 to E1-10 (motor 2: E3-04 to E3-10); lower E1-08 and E1-10, but too low cuts low-speed overload margin.",
          "Set E1-06 to the rated frequency shown on the motor nameplate.",
          "Set L1-01 = 0 [Motor Overload (oL1) Protection = Disabled], connect thermal overload relay to each motor to prevent damage to the motor.",
          "Set L1-01 (motor overload oL1 protection) to suit the motor, and fit a thermal overload relay on the motor.",
          "Set E2-01 [Motor Rated Current (FLA)] correctly to the value specified by the motor nameplate.",
          "Lower n3-13 (OEB gain), set L3-04 ≠ 4 (no overexcitation stall prevention), or set n3-23 = 0 (overexcitation braking off).",
          "Review speed search parameters, adjust b3-03 (decel time), and set b3-24 = 1 (speed estimation) after Auto-Tuning.",
          "Make sure that there is no phase loss, and repair problems.",
          "Fit a larger-capacity drive, or lower C6-02 (carrier frequency) or set C6-02 = B.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.278 (7.4 Fault)"
      },
      {
        "code": "oL2",
        "title": "Drive Overload",
        "symptom": "oL2 [Drive Overload] trip (ALM/ERR LED on, MA-MC closes). Electronic thermal drive protection tripped; L5-07 disables auto restart.",
        "causes": [
          "The load is too large.",
          "The acceleration/deceleration times or cycle times are too short.",
          "The V/f pattern does not fit the motor qualities.",
          "The drive capacity is too small.",
          "Overload occurred while running at low speed.",
          "The torque compensation gain is too large.",
          "The speed search-related parameters are set incorrectly.",
          "Phase loss in the input power supply is causing the output current to change.",
          "Overload occurred during overexcitation deceleration."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Decrease the load.",
          "Check accel/decel times and start/stop cycle; raise C1-01 to C1-08.",
          "Check V/f ratio. Adjust E1-04 to E1-10 (motor 2: E3-04 to E3-10); lower E1-08 and E1-10, but too low cuts low-speed overload margin.",
          "Replace the drive with a larger capacity model.",
          "Reduce load at low speed, use a larger drive, or lower C6-02 (carrier frequency).",
          "Decrease the value set in C4-01 [Torque Compensation Gain] to make sure that the motor does not stall.",
          "Review speed search parameters, adjust b3-03 (decel time), and set b3-24 = 1 (speed estimation) after Auto-Tuning.",
          "Fix wiring errors on the main-circuit input power; check for phase loss and repair it.",
          "Lower n3-13 (overexcitation braking, OEB, gain) or n3-21 (HSB current suppression level).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.279 (7.4 Fault)"
      },
      {
        "code": "oL3",
        "title": "Overtorque Detection 1",
        "symptom": "oL3 [Overtorque Detection 1]: output current > L6-02 for > L6-03; L6-01 sets action; L5-07 blocks auto restart. Fault or alarm (H2-xx = 10).",
        "causes": [
          "A fault occurred on the machine. Example: The machine is locked.",
          "The parameters are incorrect for the load."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the machine and remove the cause of the fault.",
          "Adjust L6-02 [Torque Detection Level 1] and L6-03 [Torque Detection Time 1] settings.",
          "Examine the machine and remove the cause of the fault",
          "Adjust L6-02 [Torque Detection Level 1] and L6-03 [Torque Detection Time 1].",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.280 (7.4 Fault); p.292 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "oL4",
        "title": "Overtorque Detection 2",
        "symptom": "oL4 [Overtorque Detection 2]: output current > L6-05 for > L6-06; L6-04 sets action; L5-07 blocks auto restart. Fault or alarm (H2-xx = 10).",
        "causes": [
          "A fault occurred on the machine. Example: The machine is locked.",
          "The parameters are incorrect for the load."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the machine and remove the cause of the fault.",
          "Adjust L6-05 [Torque Detection Level 2] and L6-06 [Torque Detection Time 2] settings.",
          "Examine the machine and remove the cause of the fault",
          "Adjust L6-05 [Torque Detection Level 2] and L6-06 [Torque Detection Time 2].",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.280 (7.4 Fault); p.293 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "oL5",
        "title": "Mechanical Weakening Detection 1",
        "symptom": "oL5 [Mechanical Weakening Detection 1]: stop per L6-08. Shown as fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "The drive detected overtorque as specified by the conditions for mechanical weakening detection set in L6-08 [Mechanical Fatigue Detect Select]."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Do a deterioration diagnostic test on the machine side.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.280 (7.4 Fault); p.293 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "oL7",
        "title": "High Slip Braking Overload",
        "symptom": "oL7 [High Slip Braking Overload] trip (ALM/ERR LED on, MA-MC closes). Output frequency constant longer than n3-04.",
        "causes": [
          "The load inertia is too large. An external force on the load side rotated the motor. Something is preventing deceleration on the load side.",
          "The value set in n3-04 [HSB Overload Time] is too small."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Without High Slip Braking, decrease decel times C1-02, C1-04, C1-06, C1-08. A braking resistor lets you shorten decel time.",
          "Raise n3-04, or fit a motor thermal overload relay and set n3-04 = 1200 s (its maximum).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.280 (7.4 Fault)"
      },
      {
        "code": "oPr",
        "title": "Keypad Connection Fault",
        "symptom": "oPr [Keypad Connection Fault] trip (ALM/ERR LED on, MA-MC closes). Needs o2-06 = 1 and b1-02 = 0 (keypad run) or LOCAL mode.",
        "causes": [
          "The keypad is not securely connected to the connector on the drive.",
          "The connection cable between the drive and the keypad is disconnected."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the connection between the keypad and the drive.",
          "Unplug and refit the keypad; replace its cable if damaged.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.280 (7.4 Fault)"
      },
      {
        "code": "oS",
        "title": "Overspeed",
        "symptom": "oS [Overspeed]: motor speed > F1-08 for > F1-09; stop per F1-03. Shown as fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "There is overshoot.",
          "There is an incorrect number of PG pulses set in the drive.",
          "The oS detection level is set incorrectly.",
          "At start or low speed (10% or less) with n8-57 = 1 (HFI overlap) in PM control: HFI gain too high."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Lower C5-01 (ASR P gain 1), raise C5-02 (ASR I time 1). Adjust pulse train gain with H6-02 to H6-05.",
          "Set H6-02 [Terminal RP Frequency Scaling] to the pulse train frequency during 100% reference (maximum motor rotation speed).",
          "Adjust F1-08 [Overspeed Detection Level] and F1-09 [Overspeed Detection Delay Time].",
          "Set E5-xx correctly or run Rotational Auto-Tuning. Lower n8-41 (HFI P gain) in 0.5 steps; keep n8-41 > 0.0 for IPM motors.",
          "Lower C5-01 (ASR P gain 1), raise C5-02 (ASR I time 1). Adjust pulse train gain with H6-02 to H6-05.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.281 (7.4 Fault); p.293 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "ov",
        "title": "Overvoltage",
        "symptom": "ov [Overvoltage]: DC bus > ~410 V (200 V class) / ~820 V (400 V). Fault if running (L5-08 blocks auto restart); alarm (H2-xx = 10) if stopped.",
        "causes": [
          "The deceleration time is too short and too much regenerative energy is flowing back into the drive.",
          "The acceleration time is too short.",
          "The braking load is too large.",
          "There are surge voltages in the input power supply.",
          "Output cable or motor shorted to ground; ground current charges the main circuit capacitor via the supply.",
          "ov during speed search, power loss recovery, auto restart, or with an IE3 premium motor: speed search parameters wrong.",
          "The power supply voltage is too high.",
          "The braking resistor or braking resistor unit wiring is incorrect.",
          "Electrical interference caused a drive malfunction.",
          "The load inertia is set incorrectly.",
          "The Short Circuit Braking function used in OLV/PM control method.",
          "There is motor hunting.",
          "Speed search does not complete at start when you set A1-02 = 8 [EZ Vector Control] and use an induction motor."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Read U1-07 [DC Bus Voltage]: the ov detection level is approx. 410 V (200 V class) / 820 V (400 V class) (TR p.351, p.598).",
          "Measure R/L1-S/L2, S/L2-T/L3, R/L1-T/L3: 200 V class 200…240 V AC, 400 V class 380…480 V AC, permitted fluctuation -15%…+10% (TR p.141, p.351)."
        ],
        "fix": [
          "Raise decel times C1-02, C1-04, C1-06 or C1-08; add a dynamic braking option; run Deceleration Rate Tuning.",
          "Avoid sudden accel. Raise C1-01, C1-03, C1-05 or C1-07 and C2-02 (S-curve at accel end). Set L3-11 = 1 (OV suppression).",
          "Connect a dynamic braking option to the drive.",
          "Add a DC link choke. Switching phase-advancing capacitors or thyristor converters on the same supply can cause input surges.",
          "Find and clear ground faults in the motor cable, terminals and motor terminal box, then power the drive up again.",
          "Check speed search params; set b3-19 ≠ 0; Stationary Auto-Tune line-to-line R, then b3-24 = 1; set b3-03, L2-03, L2-04 to 2 × default.",
          "Decrease the power supply voltage to match the drive rated voltage.",
          "Correct wiring errors in the connection to the braking resistor or braking resistor unit.",
          "Check control, main and ground wiring for noise. Rule out a magnetic contactor as noise source; add a surge protective device if needed.",
          "Check load inertia settings for KEB, OV suppression and decel stall prevention; set L3-25 [Load Inertia Ratio] to match the machine.",
          "Connect a braking resistor to the drive.",
          "Adjust n1-02 (hunting prevention gain), n2-02/n2-03 (AFR times), and n8-45/n8-47 (speed feedback gain, pull-in comp filter).",
          "When E9-01 = 0 [Motor Type Selection = Induction (IM)], set b3- 24 = 2 [Speed Search Method Selection = Current Detection Speed Search].",
          "Reduce noise on control, main and ground wiring; check the magnetic contactor; add an SPD if needed. Set L5-01 ≠ 0 (auto-restart tries).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.281 (7.4 Fault); p.293 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "PE1",
        "title": "PLC Faults",
        "symptom": "Keypad shows PE1 [PLC Faults]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "The communication option detected a fault."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Refer to the manual for the communication option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.282 (7.4 Fault)"
      },
      {
        "code": "PE2",
        "title": "PLC Faults",
        "symptom": "Keypad shows PE2 [PLC Faults]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "The communication option detected a fault."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Refer to the manual for the communication option card.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.282 (7.4 Fault)"
      },
      {
        "code": "PF",
        "title": "Input Phase Loss",
        "symptom": "PF [Input Phase Loss]: DC bus varies irregularly without regen; L8-05 enables/disables PF. Fault, or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "There is a phase loss in the drive input power.",
          "There is loose wiring in the drive input power terminals.",
          "The drive input power voltage is changing too much.",
          "There is unsatisfactory balance between voltage phases.",
          "The main circuit capacitors have become unserviceable.",
          "Loose wiring in the input power terminals.",
          "Unsatisfactory balance between voltage phases."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Measure R/L1-S/L2, S/L2-T/L3, R/L1-T/L3: 200 V class 200…240 V AC, 400 V class 380…480 V AC, permitted fluctuation -15%…+10% (TR p.141, p.351).",
          "Check the input terminal screws R/L1, S/L2, T/L3 for tightness."
        ],
        "fix": [
          "Correct errors with the wiring for main circuit drive input power.",
          "Tighten the terminal screws to the correct tightening torque.",
          "Check input power and stabilize it. If power is good, check the main-circuit magnetic contactor.",
          "Stabilise the supply. Only after confirming the supply is correct; a qualified person must decide: L8-05 = 0 (phase-loss off).",
          "Check U4-05 (capacitor maintenance); if > 90%, or input power is fine and the fault stays, replace control board or drive (contact Yaskawa).",
          "Correct all wiring errors with the main circuit power supply.",
          "Tighten the screws to the correct tightening torque.",
          "Check the supply voltage for problems and stabilize the drive input power.",
          "Check supply voltage and stabilize it. If voltage is good, check the main-circuit magnetic contactor.",
          "Check U4-05; if > 90%, replace the capacitor (contact Yaskawa). Check supply voltage, power-cycle; if alarm stays, replace board or drive.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.282 (7.4 Fault); p.293 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "PGo",
        "title": "Encoder (PG) Feedback Loss",
        "symptom": "PGo [Encoder (PG) Feedback Loss]: no encoder pulses within F1-14; stop per F1-02. Fault, or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "The holding brake is stopping the motor.",
          "The encoder cable is disconnected or wired incorrectly.",
          "The encoder is not receiving power."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Release the holding brake.",
          "Examine for wiring errors or disconnected wires in the encoder cable, and repair problems.",
          "Examine the encoder power supply.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.282 (7.4 Fault); p.294 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "rF",
        "title": "Braking Resistor Fault",
        "symptom": "Keypad shows rF [Braking Resistor Fault]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "The resistance of the dynamic braking option connected to the drive is too low.",
          "A regenerative converter or regenerative unit is connected to the drive."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Use a dynamic braking option that fits the model and duty rating of the drive.",
          "Only with a regenerative converter fitted: set L8-55 = 0 [Internal DB TransistorProtection = Disable].",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.282 (7.4 Fault)"
      },
      {
        "code": "rH",
        "title": "Braking Resistor Overheat",
        "symptom": "rH [Braking Resistor Overheat] trip: braking duty above resistor rating (load, NOT surface temp) sets it. L8-01 enables/disables rH.",
        "causes": [
          "The deceleration time is too short and excessive regenerative energy is flowing back into the drive.",
          "The duty cycle is too high.",
          "The braking load is too heavy.",
          "The braking resistor is not sufficient."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Check load, decel time and speed; reduce load; raise C1-02, C1-04, C1-06 or C1-08; use a higher-power dynamic braking option.",
          "Examine the duty cycle. Note: When L8-01 = 1 [3% ERF DB Resistor Protection = Enabled], the maximum braking duty cycle is 3%.",
          "Recalculate braking load and power and reduce the load; use a braking resistor with more braking capacity.",
          "Use the braking resistor specifications to select a sufficient braking resistor.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.283 (7.4 Fault)"
      },
      {
        "code": "rr",
        "title": "Dynamic Braking Transistor Fault",
        "symptom": "rr [Dynamic Braking Transistor Fault] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens.",
        "causes": [
          "The drive control circuit is damaged. There is a malfunction in the internal braking transistor of the drive."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.283 (7.4 Fault)"
      },
      {
        "code": "SC",
        "title": "Short Circuit/IGBT Failure",
        "symptom": "SC [Short Circuit/IGBT Failure] trip (ALM/ERR LED on, MA-MC closes). Output short or ground fault, or IGBT failure.",
        "causes": [
          "Overheating caused damage to the motor or the motor insulation is not satisfactory.",
          "The motor main circuit cable is contacting ground to make a short circuit.",
          "A short circuit or ground fault on the drive output side caused damage to the output transistor of the drive.",
          "When A1-02 = 5, 6 [Control Method Selection = OLV/PM or AOLV/PM], the output current is more than the value set in L8-27 [Overcurrent Detection Gain]."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "With power removed, check the motor cable and motor for short circuits and ground faults (TR fault table)."
        ],
        "fix": [
          "Measure the motor insulation resistance, and replace the motor if there is electrical conduction or unserviceable insulation.",
          "Check motor cable for damage and repair shorts. Measure cable-to-ground resistance; replace the cable if it conducts.",
          "Check for shorts between B1 or - and U/T1, V/T2, W/T3. If shorted, contact Yaskawa or a sales rep.",
          "Set L8-27 correctly.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.283 (7.4 Fault)"
      },
      {
        "code": "SCF",
        "title": "Safety Circuit Fault",
        "symptom": "Keypad shows SCF [Safety Circuit Fault]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "The safety circuit is broken."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Replace the control board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.283 (7.4 Fault)"
      },
      {
        "code": "SEr",
        "title": "Speed Search Retries Exceeded",
        "symptom": "SEr [Speed Search Retries Exceeded] trip (ALM/ERR LED on, MA-MC closes). Speed search restarts exceeded b3-19.",
        "causes": [
          "The speed search-related parameters are set incorrectly.",
          "The motor is coasting in the opposite direction of the Run command."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Lower b3-10 (estimation gain), raise b3-17 (retry current) and b3-18 (retry time), then redo Auto-Tuning.",
          "Set b3-14 = 1 [Bi-directional Speed Search = Enabled].",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.283 (7.4 Fault)"
      },
      {
        "code": "STPo",
        "title": "Motor Step-Out Detected",
        "symptom": "Keypad shows STPo [Motor Step-Out Detected]; ALM/ERR LED illuminated; the drive output shuts off and the fault relay MA-MC closes (MB-MC opens).",
        "causes": [
          "The motor code is set incorrectly for PM Control Methods.",
          "The load is too large.",
          "The load inertia is too large.",
          "The acceleration/deceleration times are too short.",
          "Speed response is too slow."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Set E5-01 [PM Motor Code Selection] to match the motor; for special motors set E5xx from the motor test report.",
          "Raise n8-55 (inertia ratio) and n8-51 (accel pull-in); if STPo occurs in decel, set n8-79 below n8-51. Cut load or upsize drive/motor.",
          "Increase the value set in n8-55.",
          "Lengthen C1-01 to C1-08 (accel/decel times) or raise C2-01 (S-curve time at accel start).",
          "Increase the value set in n8-55.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.284 (7.4 Fault)"
      },
      {
        "code": "TiM",
        "title": "Keypad Time Not Set",
        "symptom": "TiM [Keypad Time Not Set]: o4-24 enables/disables TiM. Shown as fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "There is a battery in the keypad, but the date and time are not set."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Use the keypad to set the date and time.",
          "Set the date and time with the keypad.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.284 (7.4 Fault); p.294 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "UL3",
        "title": "Undertorque Detection 1",
        "symptom": "UL3 [Undertorque Detection 1]: output current < L6-02 for > L6-03; L6-01 sets action. Fault, or alarm (H2-01 to H2-03 = 10).",
        "causes": [
          "A fault occurred on the machine. Example: There is a broken pulley belt.",
          "The parameters are incorrect for the load."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the machine and remove the cause of the fault.",
          "Adjust L6-02 [Torque Detection Level 1] and L6-03 [Torque Detection Time 1] settings.",
          "Examine the machine and remove the cause of the fault",
          "Adjust L6-02 [Torque Detection Level 1] and L6-03 [Torque Detection Time 1].",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.284 (7.4 Fault); p.295 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "UL4",
        "title": "Undertorque Detection 2",
        "symptom": "UL4 [Undertorque Detection 2]: output current < L6-05 for > L6-06; L6-04 sets action. Fault, or alarm (H2-01 to H2-03 = 10).",
        "causes": [
          "A fault occurred on the machine. Example: There is a broken pulley belt.",
          "The parameters are incorrect for the load."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the machine and remove the cause of the fault.",
          "Adjust L6-05 [Torque Detection Level 2] and L6-06 [Torque Detection Time 2] settings.",
          "Examine the machine and remove the cause of the fault",
          "Adjust L6-05 [Torque Detection Level 2] and L6-06 [Torque Detection Time 2].",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.284 (7.4 Fault); p.295 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "UL5",
        "title": "Mechanical Weakening Detection 2",
        "symptom": "UL5 [Mechanical Weakening Detection 2]: stop per L6-08. Shown as fault (LED on, output off) or alarm (LED flashes, H2-01 to H2-03 = 10).",
        "causes": [
          "The drive detected undertorque as specified by the conditions for mechanical weakening detection set in L6-08 [Mechanical Fatigue Detect Select]."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Examine the machine for deterioration.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.284 (7.4 Fault); p.295 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "Uv1",
        "title": "DC Bus Undervoltage",
        "symptom": "Uv1 [DC Bus Undervoltage] trip: bus < L2-05 running; ~190 V (200 V class), ~380 V (400 V), ~350 V if E1-01 < 400. No trace; L5-08 no auto restart.",
        "causes": [
          "There is a phase loss in the drive input power.",
          "There is loose wiring in the drive input power terminals.",
          "The drive input power voltage is changing too much.",
          "There was a loss of power.",
          "The main circuit capacitors have become unserviceable.",
          "The relay or contactor on the soft-charge bypass relay is damaged."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)",
          "Read U1-07 [DC Bus Voltage]: the Uv1 detection level is approx. 190 V (200 V class) / 380 V (400 V class, E1-01 ≥ 400 V) (TR p.285, p.598).",
          "Measure R/L1-S/L2, S/L2-T/L3, R/L1-T/L3: 200 V class 200…240 V AC, 400 V class 380…480 V AC, permitted fluctuation -15%…+10% (TR p.141, p.351)."
        ],
        "fix": [
          "Correct errors with the wiring for main circuit drive input power.",
          "Tighten the terminal screws to the correct tightening torque.",
          "Check input power and stabilize it. If power is good, check the main-circuit magnetic contactor.",
          "Use a better power supply.",
          "Check U4-05 (capacitor maintenance); if > 90%, replace the control board or drive (contact Yaskawa or a sales rep).",
          "U4-06 shows soft-charge bypass relay life. If > 90%, replace the board or drive (contact Yaskawa or a sales rep).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.284 (7.4 Fault)"
      },
      {
        "code": "Uv2",
        "title": "Control Power Undervoltage",
        "symptom": "Uv2 [Control Power Undervoltage] trip (ALM/ERR LED on, MA-MC closes). Control supply voltage dropped. No fault trace.",
        "causes": [
          "The value set in L2-02 [Power Loss Ride Through Time] increased and the momentary power loss recovery unit is not connected to the drive.",
          "There was a problem with the drive hardware."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Connect the momentary power loss recovery unit to the drive.",
          "Power-cycle the drive. If the fault remains, replace the control board or the drive (contact Yaskawa or a sales rep for the board).",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.285 (7.4 Fault)"
      },
      {
        "code": "Uv3",
        "title": "Soft Charge Answerback Fault",
        "symptom": "Uv3 [Soft Charge Answerback Fault] fault: ALM/ERR LED on, output off, relay MA-MC closes / MB-MC opens. No fault trace.",
        "causes": [
          "There is damage to the relay or contactor on the softcharge bypass relay.",
          "Air inside the drive is too hot."
        ],
        "confirm": [
          "Read U2-01 (current), U2-02 (previous), U2-03…U2-20 trace (freq, current, voltage at trip), history U3-01 (1st most recent)... (TR p.307, p.466-468)"
        ],
        "fix": [
          "Power-cycle; if the fault stays, replace control board or drive. If U4-06 (soft-charge relay life) > 90%, replace board or drive (ask Yaskawa).",
          "Decrease the ambient temperature of the drive.",
          "Once the cause is fixed, reset: RESET key, MFDI with H1-xx = 14 [Fault Reset] ON (default S4), or power-cycle the drive (TR p.307)."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.285 (7.4 Fault)"
      },
      {
        "code": "AEr",
        "title": "Station Address Setting Error",
        "symptom": "AEr [Station Address Setting Error] alarm: ALM/ERR LED flashes; MFDO set H2-01 to H2-03 = 10 [Alarm] turns on.",
        "causes": [
          "The node address for the communication option is not in the permitted setting range."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Set the node/station address: F6-10 for CC-Link, F6-20 for MECHATROLINK, F6-35 for CANopen."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.286 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "bb",
        "title": "Baseblock",
        "symptom": "bb [Baseblock] alarm: ALM/ERR LED flashes. No minor-fault output (H2-xx = 10) for this alarm.",
        "causes": [
          "An external baseblock command was entered through MFDI terminal S1 to S7, and the drive output stopped as shown by an external baseblock command."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Examine the external sequence and timing of the baseblock command input."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.286 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "bUSy",
        "title": "Busy",
        "symptom": "Keypad shows bUSy [Busy] (minor fault/alarm); ALM/ERR LED flashes; an MFDO set to H2-xx = 10 [Alarm] activates unless the note says otherwise.",
        "causes": [
          "You set the drive to use MEMOBUS/Modbus communications to change parameters, but you used the keypad to change parameters.",
          "You tried to change a parameter while the drive was changing setting."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Use MEMOBUS/Modbus communications to enter the enter command, then use the keypad to change the parameter.",
          "Wait until the process is complete."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.287 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "CALL",
        "title": "Serial Comm Transmission Error",
        "symptom": "CALL [Serial Comm Transmission Error]: control data from controller not received at power-up. ALM/ERR flashes; H2-01 to H2-03 = 10 on.",
        "causes": [
          "The communications cable wiring is incorrect.",
          "There is a short-circuit in the communications cable or the communications cable is not connected.",
          "A programming error occurred on the controller side.",
          "The communications circuitry is damaged.",
          "The termination resistor setting for MEMOBUS/ Modbus communications is incorrect."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Correct wiring errors.",
          "Fix the shorted or broken section of the cable; replace a defective comms cable.",
          "Examine communications at start-up and correct programming errors.",
          "Run a self-diagnostics check; if it persists, replace the control board or drive (contact Yaskawa or a sales rep).",
          "On the last drive in a MEMOBUS/Modbus network, set DIP switch S2 to the ON position to enable the termination resistor."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.287 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "CrST",
        "title": "Cannot Reset",
        "symptom": "Keypad shows CrST [Cannot Reset] (minor fault/alarm); ALM/ERR LED flashes; an MFDO set to H2-xx = 10 [Alarm] activates unless the note says otherwise.",
        "causes": [
          "The drive received a fault reset command when a Run command was active."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Turn off the Run command then de-energize and re-energize the drive."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "CyC",
        "title": "MECHATROLINK CommCycleSettingErr",
        "symptom": "CyC [MECHATROLINK CommCycleSettingErr] alarm: ALM/ERR LED flashes; MFDO set H2-01 to H2-03 = 10 [Alarm] turns on.",
        "causes": [
          "The communications cycle setting of the controller is not in the permitted range of the MECHATROLINK interface option."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Set the communications cycle of the controller in the permitted range of the MECHATROLINK interface option."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "CyPo",
        "title": "Cycle Power to Accept Changes",
        "symptom": "CyPo [Cycle Power to Accept Changes] alarm: ALM/ERR LED flashes; MFDO H2-xx = 10 [Alarm] turns on.",
        "causes": [
          "Although F6-15 = 1 [Comm. Option Parameters Reload = Reload Now], the drive does not update the communication option parameters."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Re-energize the drive to update the communication option parameters."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "dnE",
        "title": "Drive Disabled",
        "symptom": "dnE [Drive Disabled] alarm: ALM/ERR LED flashes; MFDO set H2-01 to H2-03 = 10 [Alarm] turns on.",
        "causes": [
          "A terminal set for H1-xx = 6A [Drive Enable] turned OFF."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Examine the operation sequence."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "dWA2",
        "title": "DriveWorksEZ Alarm 2",
        "symptom": "dWA2 [DriveWorksEZ Alarm 2] alarm: ALM/ERR LED flashes; MFDO set H2-01 to H2-03 = 10 [Alarm] turns on.",
        "causes": [
          "There was an error in the DriveWorksEZ program."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Examine the DriveWorksEZ program and remove the cause of the fault. This is not a drive fault."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "dWA3",
        "title": "DriveWorksEZ Alarm 3",
        "symptom": "dWA3 [DriveWorksEZ Alarm 3] alarm: ALM/ERR LED flashes; MFDO set H2-01 to H2-03 = 10 [Alarm] turns on.",
        "causes": [
          "There was an error in the DriveWorksEZ program."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Examine the DriveWorksEZ program and remove the cause of the fault. This is not a drive fault."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "dWAL",
        "title": "DriveWorksEZ Alarm",
        "symptom": "dWAL [DriveWorksEZ Alarm] alarm: ALM/ERR LED flashes; MFDO set H2-01 to H2-03 = 10 [Alarm] turns on.",
        "causes": [
          "There was an error in the DriveWorksEZ program."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Examine the DriveWorksEZ program and remove the cause of the fault. This is not a drive fault."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.288 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EF",
        "title": "FWD/REV Run Command Input Error",
        "symptom": "EF [FWD/REV Run Command Input Error] alarm: ALM/ERR flashes, H2-01 to H2-03 = 10 output ON; motor ramps to stop.",
        "causes": [
          "A forward command and a reverse command were input at the same time for longer than 0.5 s."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Examine the forward and reverse command sequence and correct the problem."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.289 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "EP24v",
        "title": "External Power 24V Supply",
        "symptom": "EP24v [External Power 24V Supply] alarm: ALM/ERR flashes, no alarm output (H2-xx = 10). o2-26 enables/disables EP24v detection.",
        "causes": [
          "The voltage of the main circuit power supply decreased, and the 24 V power supply is supplying power to the drive."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Check the main circuit supply; switch it ON to run the drive."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.290 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "HCA",
        "title": "High Current Alarm",
        "symptom": "HCA [High Current Alarm]: output current > 150% of rated (overcurrent alarm level). ALM/ERR flashes; H2-01 to H2-03 = 10 output on.",
        "causes": [
          "The load is too heavy.",
          "The acceleration time is too short.",
          "The drive is trying to operate a specialized motor or a motor that is larger than the maximum applicable motor output of the drive.",
          "The current level temporarily increased because of speed search after a momentary power loss or while trying to Auto Restart."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Reduce the load where starts and stops repeat, or fit a larger-capacity drive.",
          "Calculate accel torque from inertia and accel time. Raise C1-01/C1-03/C1-05/C1-07 or C2-01 to C2-04 (S-curve), or use a larger drive.",
          "Compare nameplate and drive: drive rated current must exceed motor rated current; otherwise use a larger drive.",
          "Speed search or Auto Restart can raise current and show this alarm briefly. No action needed to clear it."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.291 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "L24v",
        "title": "Loss of External Power 24 Supply",
        "symptom": "L24v [Loss of External Power 24 Supply] alarm: ALM/ERR flashes, no alarm output (H2-xx = 10). o2-23 enables/disables L24v.",
        "causes": [
          "The voltage of the backup 24 V power supply has decreased. The main circuit power supply is operating correctly."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Check the external 24 V supply wiring for breaks or errors and repair; check the supply itself."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.291 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "LoG",
        "title": "Log Com Error",
        "symptom": "LoG [Log Com Error] alarm: ALM/ERR flashes; output set H2-01 to H2-03 = 6A [Data Logger Error] turns ON (not H2-xx = 10).",
        "causes": [
          "There is not a micro SD in the keypad.",
          "USB connected; > 1000 log files; micro SD card full; line number data in a log file edited; keypad-drive comm error while logging."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Put a micro SD card in the keypad.",
          "Set o5-01 = 0 [Log Start/Stop Selection = OFF]."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.291 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "LT-1",
        "title": "Cooling Fan Maintenance Time",
        "symptom": "LT-1 [Cooling Fan Maintenance Time] alarm: ALM/ERR flashes; at end of est. life, H2-01 to H2-03 = 2F [Maintenance Notification] ON.",
        "causes": [
          "The cooling fan is at 90% of its expected performance life."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Replace the cooling fan per the manual, then set o4-03 = 0 (0 h) to reset fan operation time."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.291 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "LT-2",
        "title": "Capacitor Maintenance Time",
        "symptom": "LT-2 [Capacitor Maintenance Time] alarm: ALM/ERR flashes; at end of est. life, H2-01 to H2-03 = 2F [Maintenance Notification] ON.",
        "causes": [
          "The capacitors for the main circuit and control circuit are at 90% of expected performance life."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Replace the board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.291 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "LT-3",
        "title": "SoftChargeBypassRelay MainteTime",
        "symptom": "LT-3 [SoftChargeBypassRelay MainteTime] alarm: ALM/ERR flashes; at end of life, H2-01 to H2-03 = 2F [Maintenance Notification] ON.",
        "causes": [
          "The soft charge bypass relay is at 90% of its expected performance life."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Replace the board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.291 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "LT-4",
        "title": "IGBT Maintenance Time (50%)",
        "symptom": "Keypad: LT-4 [IGBT Maintenance Time (50%)], minor alarm, ALM/ERR flashes. Life expired: output with H2-01 to H2-03 = 2F turns ON.",
        "causes": [
          "The IGBT is at 50% of its expected performance life."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Check the load, carrier frequency, and output frequency."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.292 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "oH2",
        "title": "External Overheat (H1-XX=B)",
        "symptom": "Keypad: oH2 [External Overheat (H1-XX=B)], minor alarm, ALM/ERR flashes; output with H2-01 to H2-03 = 10 [Alarm] turns ON.",
        "causes": [
          "An external device sent an oH2."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Find the external device signalling overheat and remove the cause, then clear oH2 [H1-xx = B] on MFDI terminals S1 to S7."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.292 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "ovEr",
        "title": "Too Many Parameters Changed",
        "symptom": "Keypad: ovEr [Too Many Parameters Changed], minor alarm, ALM/ERR flashes; MFDO with H2-xx = 10 [Alarm] turns ON unless noted.",
        "causes": [
          "You tried to change more than 150 parameters."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Return parameters with no effect on operation to default. Max 150 changed; with dependent parameters ovEr can appear below 150."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.293 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "PASS",
        "title": "Modbus Communication Test",
        "symptom": "Keypad: PASS [Modbus Communication Test], minor alarm, ALM/ERR flashes; MFDO with H2-xx = 10 [Alarm] turns ON unless noted.",
        "causes": [
          "The MEMOBUS/Modbus communications test is complete."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "The PASS display will turn off after communications test mode is cleared."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.293 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "rUn",
        "title": "Motor Switch during Run",
        "symptom": "Keypad: rUn [Motor Switch during Run], minor alarm, ALM/ERR flashes; output with H2-01 to H2-03 = 10 [Alarm] turns ON.",
        "causes": [
          "The drive received a Motor 2 Selection [H1-xx = 16] during run."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Make sure that the drive receives the Motor 2 Selection while the drive is stopped."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.294 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "SE",
        "title": "Modbus Test Mode Error",
        "symptom": "Keypad: SE [Modbus Test Mode Error], minor alarm, ALM/ERR flashes; output with H2-01 to H2-03 = 10 [Alarm] turns ON.",
        "causes": [
          "MEMOBUS/Modbus communications selfdiagnostics [H1-xx = 67] was done while the drive was running."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Stop the drive and do MEMOBUS/Modbus communications selfdiagnostics."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.294 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "SToF",
        "title": "Safe Torque OFF Hardware",
        "symptom": "Keypad: SToF [Safe Torque OFF Hardware], minor alarm, ALM/ERR flashes; output with H2-01 to H2-03 = 10 [Alarm] turns ON.",
        "causes": [
          "One of the two terminals H1-HC and H2-HC received the Safe Disable input signal.",
          "The Safe Disable input signal is wired incorrectly.",
          "There is internal damage to one Safe Disable channel."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125).",
          "Measure / check terminals H1-HC and H2-HC: both circuits closed = normal operation; one open = SToF, both open = STo (TR p.215, Table 5.29)."
        ],
        "fix": [
          "Make sure that the Safe Disable signal is input from an external source to terminals H1-HC or H2-HC.",
          "Replace the board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.294 (7.5 Minor Faults/Alarms)",
        "fixIfNoStoWiring": [
          "Safe Disable unused: jumper H1-HC and H2-HC. Only if the drawings show no STO wiring. Never jumper a wired STO circuit."
        ]
      },
      {
        "code": "TrPC",
        "title": "IGBT Maintenance Time (90%)",
        "symptom": "Keypad: TrPC [IGBT Maintenance Time (90%)], minor alarm, ALM/ERR flashes; output with H2-01 to H2-03 = 10 [Alarm] turns ON.",
        "causes": [
          "The IGBT is at 90% of its expected performance life."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125)."
        ],
        "fix": [
          "Replace the IGBT or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.294 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "Uv",
        "title": "DC Bus Undervoltage",
        "symptom": "Keypad: Uv [DC Bus Undervoltage] while stopped: DC bus < L2-05 (Uv1), inrush contactor open, or low control power. H2-01 to H2-03 = 10 ON.",
        "causes": [
          "The drive input power voltage is changing too much.",
          "A phase loss occurred in the drive input power.",
          "There is loose wiring in the drive input power terminals.",
          "There was a loss of power.",
          "The main circuit capacitors have deteriorated.",
          "The drive input power transformer is too small and voltage drops when the power is switched on.",
          "Air inside the drive is too hot.",
          "The Charge LED is broken."
        ],
        "confirm": [
          "Read the code on the keypad; the ALM/ERR LED flashes for an alarm (TR p.125).",
          "View U1-07 [DC Bus Voltage] to see the power supply voltage (TR p.310).",
          "Measure R/L1-S/L2, S/L2-T/L3, R/L1-T/L3: 200 V class 200…240 V AC, 400 V class 380…480 V AC, permitted fluctuation -15%…+10% (TR p.141, p.351)."
        ],
        "fix": [
          "Match supply voltage to drive rating and stabilize input power. If supply is OK, check the main-circuit magnetic contactor.",
          "Correct errors with the wiring for main circuit drive input power.",
          "Examine for loose screws and tighten them as specified by the tightening torque values in the manual.",
          "Use a better power supply.",
          "Read U4-05 [CapacitorMaintenance]; if over 90%, replace the control board or drive (contact Yaskawa for board replacement).",
          "Check for the alarm when MCCB, leakage breaker (ELCB/GFCI/RCM/RCD) or contactor closes; check supply transformer capacity.",
          "Measure the ambient temperature of the drive.",
          "Replace the board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.295 (7.5 Minor Faults/Alarms)"
      },
      {
        "code": "oPE01",
        "title": "Drive Capacity Setting Error",
        "symptom": "Keypad: oPE01 [Drive Capacity Setting Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "The value set in o2-04 [Drive Model (KVA) Selection] does not agree with the drive model."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Set o2-04 to the correct value."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.296 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE02",
        "title": "Parameter Range Setting Error",
        "symptom": "Keypad: oPE02 [Parameter Range Setting Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "Parameter settings are not in the applicable setting range.",
          "Set E2-01 ≤ E2-03 [Motor Rated Current (FLA) ≤ Motor No-Load Current]."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Show U1-18 [oPE Fault Parameter] to find out-of-range parameters and correct them. Other oPExx errors take priority over oPE02.",
          "Make sure that E2-01 > E2-03. Note: If it is necessary to set E2-01 < E2-03, first lower the value set in E2-03, and then set E2-01."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.296 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE03",
        "title": "Multi-Function Input Setting Err",
        "symptom": "Keypad: oPE03 [Multi-Function Input Setting Err], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "Conflicting settings between H1-01 to H1-07 [terminals S1 to S8] and H7-01 to H7-04 [virtual inputs 1 to 4].",
          "The settings for MFDIs overlap. Note: This does not include H1-xx = 20 to 2F [MFDI Function Select = External Fault] and [Reserved].",
          "Paired MFDI functions not both set in H1-xx/H7-01 to H7-04: 10 and 11 [Up/Down], 75 and 76 [Up 2/Down 2], 42 and 43 [2-wire seq 2].",
          "Two or more conflicting MFDI groups set (H1-xx/H7-01 to H7-04): 10/11, 75/76, A [ramp hold], 1E [ref hold], 44 to 46 (d7-01 to d7-03).",
          "Mutually exclusive MFDI commands set together (H1-xx/H7-01 to H7-04), e.g. 61 and 62, 65/66/7A/7B and 68, 16 and 1A, 40/41 and 42/43 (see source)",
          "Both N.O. and N.C. Fast Stop selected in H1-xx: setting values 15 [Fast Stop (N.O.)] and 17 [Fast Stop (N.C.)].",
          "With H1-xx = 2 [Ext Ref 1/2]: b1-15 = 4 [Pulse Train Input] but H6-01 ≠ 0 [RP not set to Frequency Reference].",
          "With H1-xx = 2 [Ext Ref 1/2]: b1-15 = 3 or b1-16 = 3 [Option PCB] set but no option card connected.",
          "With H1-xx = 2 [Ext Ref 1/2]: b1-15 = 1 [Analog Input] but H3-02 ≠ 0 or H3-10 ≠ 0 [A1/A2 not Frequency Reference].",
          "Conflicting settings: H1-xx ≠ 6A (Drive Enable) together with H2-xx = 38 (Drive Enabled).",
          "Conflicting settings: H6-01 ≠ 3 (PG speed feedback, V/F control) together with H1-xx = 7E (reverse rotation identifier).",
          "Conflicting settings: H1-xx = 75/76 (Up 2/Down 2 command) together with H3-01, H3-09 = 1 (terminal A1, A2 signal level).",
          "Select = 0 to +10V(Without Limit)]"
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Correct the parameter settings.",
          "Set the parameters correctly to prevent MFDI function overlap.",
          "e MFDI pairs.",
          "Remove the function settings that are not in use.",
          "the function settings that are not in use.",
          "Remove one of the function settings.",
          "Set H6-01 = 0.",
          "Connect an input option to the drive.",
          "Set H3-02 = 0 or H3-10 = 0.",
          "Correct the parameter settings.",
          "Correct the parameter settings.",
          "Remove one of the function settings."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.296 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE05",
        "title": "Run Cmd/Freq Ref Source Sel Err",
        "symptom": "Keypad: oPE05 [Run Cmd/Freq Ref Source Sel Err], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "The setting to assign the Run command or frequency reference to an option card or the pulse train input is incorrect.",
          "b1-01 = 3 or b1-02 = 3 [Option PCB] selected but no option card is connected to the drive.",
          "Conflicting settings: b1-01 = 4 (pulse train input) with H6-01 ≠ 0 (terminal RP pulse train not used as frequency reference)."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Correct the parameter settings.",
          "Connect an option card to the drive.",
          "Set H6-01 = 0."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.297 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE07",
        "title": "Analog Input Selection Error",
        "symptom": "Keypad: oPE07 [Analog Input Selection Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "The settings for H3-02 and H3-10 [MFAI Function Select] and H7-30 [Virtual Analog Input Selection] overlap.",
          "PID feedback assigned twice: H3-02, H3-10, H7-30 = B and H6-01 = 1 [RP pulse = PID Feedback] set together.",
          "Conflicting settings: H3-02, H3-10, H7-30 = C (PID setpoint) together with H6-01 = 2 (PID setpoint value).",
          "Conflicting settings: H3-02, H3-10, H7-30 = C together with b5-18 = 1 (PID setpoint selection enabled).",
          "Conflicting settings: H6-01 = 2 and b5-18 = 1 at the same time."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Set H3-02, H3-10 and H7-30 without overlap. Only values 0 [Frequency Reference] and F/1F [Not Used] may repeat across inputs.",
          "Remove the function settings that are not in use."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.298 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE08",
        "title": "Parameter Selection Error",
        "symptom": "Keypad: oPE08 [Parameter Selection Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "A function was set that is not compatible with th control method selected in A1-02 [Control Method Selection].",
          "A1-02 = 2 [OLV] with n2-02 > n2-03 [AFR time 1 > time 2] or C4-02 > C4-06 [torque comp delay > motor 2 delay].",
          "A1-02 = 0 [V/f] with H6-01 = 3 [RP = Speed Feedback] and H1-xx = 16 [Motor 2 Selection] both set.",
          "When A1-02 = 5 [OLV/PM], you set E5-02 to E5-07 [PM Motor Parameters] = 0.",
          "A1-02 = 5, 6 [OLV/PM, AOLV/PM] with E5-09 = 0.0 and E5-24 = 0.0 [PM back-EMF constants both zero].",
          "When A1-02 = 5, 6, you set E5-09 ≠ 0 and E5-24 ≠",
          "A1-02 = 6 with n8-57 = 0 [HFI Overlap disabled] and E1-09 [Min Output Freq] below 5% of E1-06.",
          "With A1-02 = 6: n8-35 = 0 (initial pole detection by pull-in) set together with n8-57 = 1 (enabled).",
          "A1-02 = 8 [EZOLV] with E9-01 = 1, 2 [PM or SynRM motor] and b3-24 = 2 [Speed Search Current Detection 2]."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Press ENTER to show U1-18 [oPE Fault Parameter], find out-of-range parameters and fix them. Other oPExx errors outrank oPE02.",
          "Set n2-02 < n2-03 and C4-02 < C4-06.",
          "Correct the parameter settings. Note: You cannot use Speed Feedback (V/F Control) with the Motor Switch function.",
          "Set E5-01 [PM Motor Code Selection] to match the motor; for special motors set E5xx from the motor test report.",
          "Set E5-09 or E5-24 to the correct value.",
          "Set E5-09 = 0 or E5-24 = 0.",
          "Correct the parameter settings.",
          "Correct the parameter settings. -",
          "When E9-01 = 1 or 2, set b3-24 = 1 [Speed Estimation]."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.298 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE09",
        "title": "PID Control Selection Fault",
        "symptom": "Keypad shows oPE09 (PID control selection fault): invalid PID function choice with b5-01 = 1 to 4; drive won't run; no fault/alarm outputs.",
        "causes": [
          "b5-15 ≠ 0.0 [PID sleep level ≠ 0.0 Hz] together with b1-03 = 2, 3 [DC injection stop or coast with timer].",
          "b5-01 = 1, 2 [PID enabled] together with d2-02 ≠ 0.0 [Frequency Reference Lower Limit ≠ 0.0%].",
          "b5-01 = 1, 2 [PID enabled] together with b5-11 = 1 [PID Output Reverse = Negative Output Accepted].",
          "b5-01 = 3, 4 [PID Trim modes] together with d2-02 ≠ 0.0 [lower limit set]."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Set b5-15 ≠ 0.0; set b1-03 = 0 or 1 (ramp to stop or coast to stop).",
          "Correct the parameter settings.",
          "Correct the parameter settings.",
          "Correct the parameter settings."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.299 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE10",
        "title": "V/f Data Setting Error",
        "symptom": "Keypad: oPE10 [V/f Data Setting Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "V/f points out of order. Need motor 1: E1-09 ≤ E1-07 < E1-06 ≤ E1-11 ≤ E1-04; motor 2: E3-09 ≤ E3-07 < E3-06 ≤ E3-11 ≤ E3-04."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Set the parameters correctly to satisfy the conditions."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.299 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE11",
        "title": "Carrier Frequency Setting Error",
        "symptom": "Keypad: oPE11 [Carrier Frequency Setting Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "C6-05 > 6 with C6-04 > C6-03 (lower > upper limit), or C6-02 to C6-05 out of range. If C6-05 < 7, C6-04 is ignored and C6-03 used."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Set C6-02 to C6-05 correctly."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.299 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE13",
        "title": "Pulse Monitor Selection Error",
        "symptom": "Keypad: oPE13 [Pulse Monitor Selection Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "H6-06 = 101, 102, 105, or 116 [Terminal MP Monitor Selection = Frequency Reference, Output",
          "Frequency, Motor Speed, Output Frequency after Soft Starter] has not been set when H6-07 = 0 [Terminal MP Frequency Scaling = 0 Hz]."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Set H6-06 correctly."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.299 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE16",
        "title": "Energy Saving Constants Error",
        "symptom": "Keypad: oPE16 [Energy Saving Constants Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "The Energy Saving parameters are not set in the applicable setting range."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Make sure that E5-xx is set correctly as specified by the motor nameplate data."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.299 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "oPE33",
        "title": "Digital Output Selection Error",
        "symptom": "Keypad: oPE33 [Digital Output Selection Error], parameter error; drive will not run until fixed; no fault/alarm outputs.",
        "causes": [
          "H2-60 ≠ F [MA/MB/MC secondary function used] while H2-01 = 1xx [inverse output] is also set.",
          "H2-63 ≠ F [P1 secondary function used] while H2-02 = 1xx [inverse output] is also set.",
          "H2-66 ≠ F [P2 secondary function used] while H2-03 = 1xx [inverse output] is also set.",
          "Comparator limits reversed: H2-21 > H2-22 (comparator 1) or H2-27 > H2-28 (comparator 2)."
        ],
        "confirm": [
          "Push the key to show U1-18 [oPE Fault Parameter] to find the parameter that caused the error (TR p.296)."
        ],
        "fix": [
          "Clear H2-01 to H2-03 = 1xx [inverse output]. Inverse output cannot be used when logic outputs H2-60, H2-63, H2-66 ≠ F are in use.",
          "Set H2-21 ≤ H2-22 and H2-27 ≤ H2-28."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.300 (7.6 Parameter Setting Errors)"
      },
      {
        "code": "End1",
        "title": "Excessive Rated Voltage Setting",
        "symptom": "Keypad shows End1 [Excessive Rated Voltage Setting] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The torque reference was more than 20% during Auto-Tuning or the no-load current that was measured after Auto-Tuning is more than 80%."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify motor nameplate data and re-run Auto-Tuning. If motor can be uncoupled, re-run Rotational Auto-Tuning; if not, use the tuning results."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.301 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "End2",
        "title": "Iron Core Saturation Coefficient",
        "symptom": "Keypad shows End2 [Iron Core Saturation Coefficient] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The motor nameplate data entered during Auto- Tuning is incorrect.",
          "Auto-Tuning results were not in the applicable parameter setting range, and E2-07 or E2-08 [Motor Saturation Coefficient 2] have temporary values."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify the motor nameplate data entered, then redo Auto-Tuning with the correct nameplate values.",
          "Inspect and repair damaged motor wiring. If the motor can be uncoupled from the load, re-run Rotational Auto-Tuning."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.301 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "End3",
        "title": "Rated Current Setting Alarm",
        "symptom": "Keypad shows End3 [Rated Current Setting Alarm] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The rated current value is incorrect."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Do Auto-Tuning again and set the correct rated current shown on the motor nameplate."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.301 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "End4",
        "title": "Adjusted Slip Calculation Error",
        "symptom": "Keypad shows End4 [Adjusted Slip Calculation Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "Tuning result out of range: rated slip after Stationary Auto-Tuning 0.2 Hz or lower, or slip after E2-08 compensation out of range.",
          "The secondary resistor measurement results were not in the applicable range."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify nameplate data and re-run Rotational Auto-Tuning. If motor cannot be uncoupled from load, use Stationary Auto-Tuning 2."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.301 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "End5",
        "title": "Resistance Tuning Error",
        "symptom": "Keypad shows End5 [Resistance Tuning Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The Auto-Tuning results of the Line-to-Line Resistance were not in the applicable range."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify the motor nameplate data entered; inspect and repair damaged motor wiring."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.301 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "End6",
        "title": "Leakage Inductance Alarm",
        "symptom": "Keypad shows End6 [Leakage Inductance Alarm] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The Auto-Tuning results were not in the applicable parameter setting range.",
          "A1-02 [Control Method Selection] setting is not applicable."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Make sure that the input motor nameplate data is correct, and do Auto-Tuning again.",
          "Check A1-02; verify the motor nameplate data entered and redo Auto-Tuning."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.301 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "End7",
        "title": "No-Load Current Alarm",
        "symptom": "Keypad shows End7 [No-Load Current Alarm] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The Auto-Tuning results of the motor no-load current value were not in the applicable range.",
          "Auto-Tuning results were less than 5% of the motor rated current."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Examine and repair damaged motor wiring.",
          "Make sure that the input motor nameplate data is correct, and do Auto-Tuning again."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.301 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "End8",
        "title": "HFI Alarm",
        "symptom": "Keypad shows End8 [HFI Alarm] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "Inductance saliency ratio (E5-07/E5-06) too low, or the drive cannot find the n8-36 value (HFI frequency level for L tuning)."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Set E5-xx or auto-tune, redo HFI Tuning. With n8-35 = 1/n8-57 = 1, noise below 10%: raise n8-41 by 0.5 (>0.0 IPM). End8 sets both to 0 (see source)"
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.302 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "End9",
        "title": "Initial Pole Detection Alarm",
        "symptom": "Keypad shows End9 [Initial Pole Detection Alarm] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The drive cannot calculate the correct value for n8-84 [Polarity Detection Current] during High Frequency Injection Tuning."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Set E5-xx or auto-tune, redo HFI Tuning. With n8-35 = 1/n8-57 = 1, no reverse at start; noise below 10%: n8-41 +0.5. End9 sets both to 0 (see source)"
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.302 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-01",
        "title": "Motor Data Error",
        "symptom": "Keypad shows Er-01 [Motor Data Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The motor nameplate data entered during Auto- Tuning is incorrect.",
          "The combination of the motor rated power and motor rated current do not match.",
          "The combination of the motor rated current that was entered during Auto-Tuning and E2-03 [Motor No- Load Current] do not match.",
          "The combination of the setting values of Motor Base Frequency and Motor Base Speed do not match."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify the motor nameplate data entered, then redo Auto-Tuning with the correct nameplate values.",
          "Check the drive capacity vs motor output pairing; redo Auto-Tuning with the correct motor rated power and rated current.",
          "Check motor rated and no-load current; set E2-03 correctly; redo Auto-Tuning with the correct motor rated current.",
          "Do Auto-Tuning again, and correctly set the Motor Base Frequency and Motor Base Speed."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.302 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-02",
        "title": "Drive in an Alarm State",
        "symptom": "Keypad shows Er-02 [Drive in an Alarm State] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The motor nameplate data entered during Auto- Tuning is incorrect.",
          "You did Auto-Tuning while the drive had a minor fault or alarm.",
          "There is a defective motor cable or cable connection.",
          "The load is too large.",
          "The drive detected a minor fault during Auto-Tuning."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify the nameplate data entered for Auto-Tuning, then redo Auto-Tuning with correct values.",
          "Clear the minor fault or alarm and do Auto-Tuning again.",
          "Examine and repair motor wiring.",
          "Reduce the load; inspect the machine, e.g. for a locked motor shaft.",
          "Stop Auto-Tuning, read the minor fault code and clear its cause, then run Auto-Tuning again."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.302 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-03",
        "title": "STOP Button was Pressed",
        "symptom": "Keypad shows Er-03 [STOP Button was Pressed] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "During Auto-Tuning,"
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Auto-Tuning did not complete correctly. Do Auto-Tuning again. was pushed."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.302 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-04",
        "title": "Line-to-Line Resistance Error",
        "symptom": "Keypad shows Er-04 [Line-to-Line Resistance Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The Auto-Tuning results were not in the applicable parameter setting range. Auto-Tuning did not complete in a pre-set length of time.",
          "There is a defective motor cable or cable connection.",
          "The motor nameplate data entered during Auto- Tuning is incorrect."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Inspect and repair motor wiring; uncouple the machine from the motor and redo Rotational Auto-Tuning.",
          "Verify the motor nameplate data entered, then redo Auto-Tuning with the correct nameplate values."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.303 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-05",
        "title": "No-Load Current Error",
        "symptom": "Keypad shows Er-05 [No-Load Current Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The Auto-Tuning results were not in the applicable parameter setting range. Auto-Tuning did not complete in a pre-set length of time.",
          "The motor nameplate data entered during Auto- Tuning is incorrect.",
          "Rotational Auto-Tuning was done with a load that was more than 30% of the rating connected to the motor."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Inspect and repair motor wiring; uncouple the machine from the motor and redo Rotational Auto-Tuning.",
          "Verify the motor nameplate data entered, then redo Auto-Tuning with the correct nameplate values.",
          "Uncouple the load and redo Rotational Auto-Tuning; if not possible keep load under 30% of rating. Release any motor brake while tuning."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.303 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-08",
        "title": "Rated Slip Error",
        "symptom": "Keypad shows Er-08 [Rated Slip Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The motor nameplate data entered during Auto- Tuning is incorrect.",
          "Auto-Tuning did not complete in a pre-set length of time. The Auto-Tuning results were not in the applicable parameter setting range.",
          "Rotational Auto-Tuning was done with a load that was more than 30% of the rating connected to the motor."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify the motor nameplate data entered, then redo Auto-Tuning with the correct nameplate values.",
          "Inspect and repair motor wiring; if the machine is coupled to the motor during Rotational Auto-Tuning, uncouple it.",
          "Uncouple the load and redo Rotational Auto-Tuning; if not possible keep load under 30% of rating. Release any motor brake while tuning."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.303 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-09",
        "title": "Acceleration Error",
        "symptom": "Keypad shows Er-09 [Acceleration Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The motor did not accelerate for the specified acceleration time.",
          "The value of L7-01 or L7-02 [Forward/Reverse Torque Limit] is small.",
          "Rotational Auto-Tuning was done with a load that was more than 30% of the rating connected to the",
          "motor."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Raise C1-01 (accel time 1), then uncouple the machine from the motor and redo Rotational Auto-Tuning.",
          "Increase the value set in L7-01 or L7-02.",
          "Uncouple the machine from the motor and redo Rotational Auto-Tuning.",
          "If the load cannot be uncoupled, keep it under 30% of motor rating. Release any motor brake during Rotational Auto-Tuning."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.303 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-10",
        "title": "Motor Direction Error",
        "symptom": "Keypad shows Er-10 [Motor Direction Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "There is defective drive and motor wiring.",
          "There is defective drive and encoder wiring. The machine pulled the motor to rotate in the opposite direction.",
          "When the torque reference is 100% or higher, the sign of the speed reference was opposite of the detected speed."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Examine and repair motor wiring.",
          "Examine and repair the wiring to the encoder. Disconnect the machine from the motor and do Rotational Auto- Tuning again."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.303 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-11",
        "title": "Motor Speed Error",
        "symptom": "Keypad shows Er-11 [Motor Speed Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The torque reference during acceleration is too high (100%)."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Raise C1-01 (accel time 1); uncouple the machine from the motor and redo Rotational Auto-Tuning."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.303 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-12",
        "title": "Current Detection Error",
        "symptom": "Keypad shows Er-12 [Current Detection Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "There is a phase loss in the drive input power. (U/T1, V/T2, W/T3)",
          "The current exceeded the current rating of the drive. The output current is too low.",
          "You tried Auto-Tuning without a motor connected to the drive.",
          "There was a current detection signal error."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Examine and repair motor wiring.",
          "Check motor wiring for wire-to-wire shorts; close any contactors between drive and motor; else replace control board or drive (contact Yaskawa).",
          "Connect the motor and do Auto-Tuning.",
          "Replace the control board or the drive. For information about replacing the control board, contact Yaskawa or your nearest sales representative."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-13",
        "title": "Leakage Inductance Alarm",
        "symptom": "Keypad shows Er-13 [Leakage Inductance Alarm] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The motor rated current value is incorrect.",
          "The drive could not complete tuning for leakage inductance in fewer than 300 seconds."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Correctly set the rated current indicated on the motor nameplate and perform Auto-Tuning again.",
          "Examine and repair motor wiring."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-14",
        "title": "Motor Speed Error 2",
        "symptom": "Keypad shows Er-14 [Motor Speed Error 2] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The motor speed was more than two times the amplitude of speed reference during Inertia Tuning."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Decrease the value set in C5-01 [ASR Proportional Gain 1]."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-15",
        "title": "Torque Saturation Error",
        "symptom": "Keypad shows Er-15 [Torque Saturation Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "During Inertia Tuning, the output torque was more than the value set in L7-01 to L7-04 [Torque Limit]."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Raise L7-01 to L7-04 [Torque Limit] as far as possible. Reduce test signal amplitude, retune; if still failing, reduce test frequency and retune."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-16",
        "title": "Inertia ID Error",
        "symptom": "Keypad shows Er-16 [Inertia ID Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The inertia found by the drive was too small or too large during Inertia Tuning (10% or less, or 50000% or more)."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Reduce Inertia Tuning test signal amplitude first, then frequency, retuning after each. Set motor inertia per motor data and retune."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-17",
        "title": "Reverse Prohibited Error",
        "symptom": "Keypad shows Er-17 [Reverse Prohibited Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "b1-04 = 1 [Reverse Operation Selection = Reverse Disabled] Note: You cannot do Inertia Tuning if the drive cannot rotate the motor in reverse."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Allow reverse on the machine, set b1-04 = 0 (reverse enabled), then rerun Inertia Tuning."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-18",
        "title": "Back EMF Error",
        "symptom": "Keypad shows Er-18 [Back EMF Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The result of the induced voltage tuning was not in the applicable range."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify the motor nameplate data entered, then redo Auto-Tuning with the correct nameplate values."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-19",
        "title": "PM Inductance Error",
        "symptom": "Keypad shows Er-19 [PM Inductance Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The Auto-Tuning results of the PM motor inductance were not in the applicable range."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify the motor nameplate data entered, then redo Auto-Tuning with the correct nameplate values."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-20",
        "title": "Stator Resistance Error",
        "symptom": "Keypad shows Er-20 [Stator Resistance Error] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The Auto-Tuning results of the PM Motor Stator Resistance were not in the applicable range."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Verify the motor nameplate data entered, then redo Auto-Tuning with the correct nameplate values."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      },
      {
        "code": "Er-25",
        "title": "HighFreq Inject Param Tuning Err",
        "symptom": "Keypad shows Er-25 [HighFreq Inject Param Tuning Err] during or after Auto-Tuning; the motor coasts to stop; no fault/alarm output signals.",
        "causes": [
          "The motor data is incorrect."
        ],
        "confirm": [
          "Read the Auto-Tuning error on the keypad and compare the entered motor nameplate data with the motor (TR p.301)."
        ],
        "fix": [
          "Repeat Stationary Auto-Tuning. If Er-25 returns afterward, the motor may not support HFI control; contact Yaskawa."
        ],
        "source": "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf p.304 (7.7 Auto-Tuning Errors)"
      }
    ],
    "sources": [
      "https://www.yaskawa.com/delegate/getAttachment?documentId=SIEPC71061752&cmd=documents&documentName=SIEPC71061752.pdf (YASKAWA SIEPC71061752C GA500 Drive Technical Reference: 3.5 Control Circuit Wiring p.92-95, 4.2 Keypad p.125-126, test run checks p.141, 5.6 Safe Disable Input p.210-216, 7.4-7.7 Fault / Minor Faults / oPE / Auto-Tuning errors p.264-304, 7.9 p.307, specifications p.351, monitors U1/U2/U3 p.464-468, Table 12.37 p.598)"
    ]
  },
  {
    "id": "abb-acs380-vfd",
    "title": "ABB ACS380 machinery drive",
    "match": {
      "categories": [
        "vfd"
      ],
      "family": "ACS380"
    },
    "normal": [
      {
        "terminals": "L1, L2, L3 (line to line)",
        "state": "power applied, ACS380-04xx-xxxx-4 (3-phase 380…480 V AC -15%…+10%)",
        "meter": "VAC",
        "expected": "323…528 V AC",
        "pins": [
          [
            "L1",
            "L2"
          ],
          [
            "L2",
            "L3"
          ],
          [
            "L1",
            "L3"
          ]
        ],
        "note": "Electrical power network specification, HW p.174",
        "liveWork": true
      },
      {
        "terminals": "L1, L2, L3 (line to line)",
        "state": "power applied, ACS380-04xx-xxxx-2 (3-phase 200…240 V AC -15%…+10%)",
        "meter": "VAC",
        "expected": "170…264 V AC",
        "pins": [
          [
            "L1",
            "L2"
          ],
          [
            "L2",
            "L3"
          ],
          [
            "L1",
            "L3"
          ]
        ],
        "note": "HW p.174",
        "liveWork": true
      },
      {
        "terminals": "+24V to DGND",
        "state": "powered",
        "meter": "VDC",
        "expected": "+24 V DC ±10% (21.6…26.4 V), max. 250 mA",
        "pins": [
          [
            "+24V",
            "DGND"
          ]
        ],
        "note": "Auxiliary voltage output, HW p.177; default I/O HW p.85"
      },
      {
        "terminals": "DI1…DI4 to DCOM",
        "state": "input ON (default: DI1 Start, DI2 Reverse, DI3/DI4 speed selection)",
        "meter": "VDC",
        "expected": "12…24 V DC (max. 30 V DC), input impedance 2 kohm, PNP and NPN",
        "pins": [
          [
            "DI1",
            "DCOM"
          ],
          [
            "DI2",
            "DCOM"
          ],
          [
            "DI3",
            "DCOM"
          ],
          [
            "DI4",
            "DCOM"
          ]
        ],
        "note": "HW p.177; default macro HW p.85, FW p.32"
      },
      {
        "terminals": "+10V to AGND",
        "state": "powered",
        "meter": "VDC",
        "expected": "10 V DC ±1% (9.9…10.1 V), max. load current 10 mA",
        "pins": [
          [
            "+10V",
            "AGND"
          ]
        ],
        "note": "Potentiometer reference value, HW p.177"
      },
      {
        "terminals": "AI1 to AGND",
        "state": "speed/frequency reference (default 0…10 V)",
        "meter": "VDC",
        "expected": "0…10 V DC (11 V max.) or 0…20 mA (22 mA max.) when configured for current",
        "pins": [
          [
            "AI1",
            "AGND"
          ]
        ],
        "note": "HW p.177; default I/O HW p.86"
      },
      {
        "terminals": "AO to AGND",
        "state": "running (default: output frequency 0…20 mA)",
        "meter": "mA",
        "expected": "0…20 mA into max. 500 ohm",
        "pins": [
          [
            "AO",
            "AGND"
          ]
        ],
        "note": "HW p.86, p.177"
      },
      {
        "terminals": "S1 to SGND and S2 to SGND",
        "state": "run permitted (both STO circuits closed; factory connection S+ to S1, S2)",
        "meter": "VDC",
        "expected": "15…25 V (maximum 24 V +10%)",
        "pins": [
          [
            "S1",
            "SGND"
          ],
          [
            "S2",
            "SGND"
          ]
        ],
        "note": "STO interface input voltage range HW p.178; both circuits must be closed for the drive to start (HW p.86, FW p.33)"
      },
      {
        "terminals": "RC to RB",
        "state": "powered, no fault (10.24 RO1 source = Fault (-1), default)",
        "meter": "continuity",
        "expected": "closed (relay energized; lamp on RB lit in the default diagram)",
        "pins": [
          [
            "RC",
            "RB"
          ]
        ],
        "note": "Default macro \"Relay output 1: No fault [Fault (-1)]\" and diagram FW p.33; 10.24 default FW p.158; relay 1 Form C, 250 V AC / 30 V DC, 2 A (HW p.178)"
      },
      {
        "terminals": "RC to RA",
        "state": "fault active or drive unpowered (relay de-energized)",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "RC",
            "RA"
          ]
        ],
        "note": "FW p.33 diagram (RA-RC drawn closed in the de-energized state)"
      }
    ],
    "pairs": [
      {
        "a": "RC",
        "b": "RB",
        "when": "no fault (RO1 energized, 10.24 RO1 source = Fault (-1) default)",
        "note": "Per the ABB standard macro diagram, FW p.33; RO1 is Form C (NO + NC), HW p.178."
      },
      {
        "a": "RC",
        "b": "RA",
        "when": "fault active (RO1 de-energized)",
        "note": "FW p.33 diagram."
      },
      {
        "a": "DGND",
        "b": "AGND",
        "when": "always",
        "note": "Terminals DGND, AGND and SGND are internally connected to same reference potential (FW p.33)."
      },
      {
        "a": "DGND",
        "b": "SGND",
        "when": "always",
        "note": "FW p.33."
      }
    ],
    "indicators": [
      {
        "name": "Status LED (panel)",
        "state": "steady green",
        "meaning": "Normal operation (HW p.45)."
      },
      {
        "name": "Status LED (panel)",
        "state": "blinking green",
        "meaning": "Active warning (HW p.45; FW p.26: \"The panel LED starts to blink green to indicate an active warning\")."
      },
      {
        "name": "Status LED (panel)",
        "state": "steady red",
        "meaning": "Active fault (HW p.45)."
      },
      {
        "name": "Status LED (panel)",
        "state": "blinking red",
        "meaning": "Active fault, set power to off to reset (HW p.45)."
      },
      {
        "name": "Control panel",
        "state": "shows fault code and name (e.g. 2310 Overcurrent)",
        "meaning": "Fault latched, drive tripped; see Fault messages (FW p.500, p.518)."
      },
      {
        "name": "Control panel",
        "state": "shows warning code and name (e.g. A2B1 Overcurrent)",
        "meaning": "Warning; does not latch, drive continues (FW p.500, p.502)."
      }
    ],
    "faults": [
      {
        "code": "64FF",
        "title": "Fault reset",
        "symptom": "Event 64FF Fault reset is recorded in the event log (pure event / informative).",
        "causes": [
          "A fault has been reset from the panel, Drive Ccomposer PC tool, fieldbus or I/O."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Event.",
          "Informative only."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.502 (Fault tracing, Warning messages)"
      },
      {
        "code": "A2B1",
        "title": "Overcurrent",
        "symptom": "The panel shows warning A2B1 Overcurrent; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Output current over internal limit: real overcurrent, earth fault, or supply phase loss."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "With power removed and the motor cable disconnected, measure the insulation resistance of motor and motor cable."
        ],
        "fix": [
          "Check motor load.",
          "Check accel times in groups 23 (speed), 26 (torque) or 28 (frequency) and scaling 46.01, 46.02, 46.03.",
          "Check motor and motor cable (including phasing and delta/star connection).",
          "Check for an earth fault in motor or motor cables by measuring the insulation resistances of motor and motor cable.",
          "See chapter Electrical installation, section Checking the insulation of the assembly in the hardware manual of the drive.",
          "Check there are no contactors opening and closing in motor cable.",
          "Check that the start-up data in parameter group 99 Motor data corresponds to the motor rating plate.",
          "Check that there are no power factor correction capacitors or surge absorbers in motor cable."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.502 (Fault tracing, Warning messages)"
      },
      {
        "code": "A2B3",
        "title": "Earth leakage",
        "symptom": "The panel shows warning A2B3 Earth leakage; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Drive has detected load unbalance typically due to earth fault in motor or motor cable."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "With power removed and the motor cable disconnected, measure the insulation resistance of motor and motor cable."
        ],
        "fix": [
          "Check there are no power factor correction capacitors or surge absorbers in motor cable.",
          "Check for an earth fault in motor or motor cables by measuring the insulation resistances of motor and motor cable.",
          "See chapter Electrical installation, section Checking the insulation of the assembly in the hardware manual of the drive.",
          "If an earth fault is found, fix or change the motor cable and/or motor.",
          "If no earth fault can be detected, contact your local ABB representative."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.503 (Fault tracing, Warning messages)"
      },
      {
        "code": "A2B4",
        "title": "Short circuit",
        "symptom": "The panel shows warning A2B4 Short circuit; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Short-circuit in motor cable(s) or motor."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "With power removed, check motor and motor cable for a short circuit between phases."
        ],
        "fix": [
          "Check motor and motor cable for cabling errors.",
          "Check motor and motor cable (including phasing and delta/star connection).",
          "Check for an earth fault in motor or motor cables by measuring the insulation resistances of motor and motor cable.",
          "See chapter Electrical installation, section Checking the insulation of the assembly in the hardware manual of the drive.",
          "Check there are no power factor correction capacitors or surge absorbers in motor cable."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.503 (Fault tracing, Warning messages)"
      },
      {
        "code": "A2BA",
        "title": "IGBT overload",
        "symptom": "The panel shows warning A2BA IGBT overload; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Excessive IGBT junction to case temperature. This warning protects the IGBT(s) and can be activated by a short circuit in the motor cable."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check motor cable.",
          "Check ambient conditions.",
          "Check air flow and fan operation.",
          "Check heatsink fins for dust pick-up.",
          "Check motor power against drive power."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.503 (Fault tracing, Warning messages)"
      },
      {
        "code": "A3A1",
        "title": "DC link overvoltage",
        "symptom": "The panel shows warning A3A1 DC link overvoltage; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Intermediate circuit DC voltage too high (when the drive is stopped)."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Measure L1-L2, L2-L3, L1-L3. ACS380-04xx-xxxx-4: 3-phase 380…480 V AC -15%…+10% = 323…528 V AC; -2: 200…240 V AC = 170…264 V AC (HW p.174)"
        ],
        "fix": [
          "Check the supply voltage setting (parameter 95.01 Supply voltage).",
          "Note that the wrong setting of the parameter may cause the motor to rush uncontrollably, or may overload the brake chopper or resistor."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.504 (Fault tracing, Warning messages)"
      },
      {
        "code": "A3A2",
        "title": "DC link undervoltage",
        "symptom": "The panel shows warning A3A2 DC link undervoltage; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Intermediate circuit DC voltage too low (when the drive is stopped)."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Measure L1-L2, L2-L3, L1-L3. ACS380-04xx-xxxx-4: 3-phase 380…480 V AC -15%…+10% = 323…528 V AC; -2: 200…240 V AC = 170…264 V AC (HW p.174)"
        ],
        "fix": [
          "Check the supply voltage setting (parameter 95.01 Supply voltage).",
          "Note that the wrong setting of the parameter may cause the motor to rush uncontrollably, or may overload the brake chopper or resistor."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.504 (Fault tracing, Warning messages)"
      },
      {
        "code": "A3AA",
        "title": "DC not charged",
        "symptom": "The panel shows warning A3AA DC not charged; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "The voltage of the intermediate DC circuit has not yet risen to operating level."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Measure L1-L2, L2-L3, L1-L3. ACS380-04xx-xxxx-4: 3-phase 380…480 V AC -15%…+10% = 323…528 V AC; -2: 200…240 V AC = 170…264 V AC (HW p.174)"
        ],
        "fix": [
          "Check the supply voltage.",
          "If the problem persists, contact your local ABB representative."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.504 (Fault tracing, Warning messages)"
      },
      {
        "code": "A490",
        "title": "Incorrect temperature sensor setup",
        "symptom": "Panel warning A490 Incorrect temperature sensor setup; status LED blinks green; motor keeps running (warning does not latch).",
        "causes": [
          "Sensor type mismatch."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the settings of temperature source parameters 35.11 and 35.21."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.504 (Fault tracing, Warning messages)"
      },
      {
        "code": "A491",
        "title": "External temperature 1",
        "symptom": "The panel shows warning A491 External temperature 1; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Measured temperature 1 has exceeded warning limit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the value of parameter 35.02 Measured temperature 1.",
          "Check the cooling of the motor (or other equipment whose temperature is being measured).",
          "Check the value of 35.13 Temperature 1 warning limit."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.504 (Fault tracing, Warning messages)"
      },
      {
        "code": "A492",
        "title": "External temperature 2",
        "symptom": "The panel shows warning A492 External temperature 2; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Measured temperature 2 has exceeded warning limit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the value of parameter 35.03 Measured temperature 2.",
          "Check the cooling of the motor (or other equipment whose temperature is being measured).",
          "Check the value of 35.23 Temperature 2 warning limit."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.504 (Fault tracing, Warning messages)"
      },
      {
        "code": "A4A1",
        "title": "IGBT overtemperature",
        "symptom": "The panel shows warning A4A1 IGBT overtemperature; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Estimated drive IGBT temperature is excessive."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check ambient conditions.",
          "Check air flow and fan operation.",
          "Check heatsink fins for dust pick-up.",
          "Check motor power against drive power."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.504 (Fault tracing, Warning messages)"
      },
      {
        "code": "A4A9",
        "title": "Cooling",
        "symptom": "The panel shows warning A4A9 Cooling; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Drive module temperature is excessive."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check ambient temperature.",
          "If it exceeds 50 °C /122 °F, ensure that load current does not exceed derated load capacity of drive.",
          "See chapter Technical data, section Derating in the hardware manual of the drive.",
          "Check drive module cooling air flow and fan operation.",
          "Check inside of cabinet and heatsink of drive module for dust pick-up. Clean whenever necessary."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.505 (Fault tracing, Warning messages)"
      },
      {
        "code": "A4B0",
        "title": "Excess temperature",
        "symptom": "The panel shows warning A4B0 Excess temperature; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Power unit module temperature is excessive."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check ambient conditions.",
          "Check air flow and fan operation.",
          "Check heatsink fins for dust pick-up.",
          "Check motor power against drive power."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.505 (Fault tracing, Warning messages)"
      },
      {
        "code": "A4B1",
        "title": "Excess temperature difference",
        "symptom": "The panel shows warning A4B1 Excess temperature difference; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "High temperature difference between the IGBTs of different phases."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the motor cabling.",
          "Check cooling of drive module(s)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.505 (Fault tracing, Warning messages)"
      },
      {
        "code": "A4F6",
        "title": "IGBT temperature",
        "symptom": "The panel shows warning A4F6 IGBT temperature; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Drive IGBT temperature is excessive."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check ambient conditions.",
          "Check air flow and fan operation.",
          "Check heatsink fins for dust pick-up.",
          "Check motor power against drive power."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.505 (Fault tracing, Warning messages)"
      },
      {
        "code": "A580",
        "title": "PU communication",
        "symptom": "The panel shows warning A580 PU communication; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Communication errors detected between the drive control unit and the power unit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the connections between the drive control unit and the power unit.",
          "Check the value of parameter 95.04 Control board supply."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.505 (Fault tracing, Warning messages)"
      },
      {
        "code": "A591",
        "title": "Drive HW initialization",
        "symptom": "The panel shows warning A591 Drive HW initialization; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Initialization of the drive hardware. Aux code 0000: Drive hardware setup is initializing. 0001: Initializing HW settings for the first time."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the auxiliary code.",
          "Wait for the setup to initialize."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.505 (Fault tracing, Warning messages)"
      },
      {
        "code": "A5A0",
        "title": "Safe torque off",
        "symptom": "The panel shows warning A5A0 Safe torque off; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "STO active: a safety signal at connector STO is lost. Programmable via 31.22 STO indication run/stop."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Measure S1-SGND and S2-SGND: 15…25 V (max 24 V +10%) on both when STO closed; 0 V on a channel = that circuit open (HW p.178, FW p.33)."
        ],
        "fix": [
          "Check safety circuit connections.",
          "See the STO chapter in the drive hardware manual and parameter 31.22 STO indication run/stop (page 284).",
          "Check the value of parameter 95.04 Control board supply."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A5EA",
        "title": "Measurement circuit temperature",
        "symptom": "Panel warning A5EA Measurement circuit temperature; status LED blinks green; motor keeps running (warning does not latch).",
        "causes": [
          "Problem with internal temperature measurement of the drive."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Contact your local ABB representative."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A5EB",
        "title": "PU board powerfail",
        "symptom": "The panel shows warning A5EB PU board powerfail; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Power unit power supply failure."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Contact your local ABB representative."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A5EC",
        "title": "PU communication internal",
        "symptom": "The panel shows warning A5EC PU communication internal; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Communication errors detected between the drive control unit and the power unit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the connections between the drive control unit and the power unit."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A5ED",
        "title": "Measurement circuit ADC",
        "symptom": "The panel shows warning A5ED Measurement circuit ADC; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Measurement circuit fault."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Contact your local ABB representative."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A5EE",
        "title": "Measurement circuit DFF",
        "symptom": "The panel shows warning A5EE Measurement circuit DFF; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Measurement circuit fault."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Contact your local ABB representative."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A5EF",
        "title": "PU state feedback",
        "symptom": "The panel shows warning A5EF PU state feedback; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "State feedback from output phases does not match control signals."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Contact your local ABB representative."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A5F0",
        "title": "Charging feedback",
        "symptom": "The panel shows warning A5F0 Charging feedback; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Charging feedback signal missing."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the feedback signal coming from the charging system."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A686",
        "title": "Checksum mismatch",
        "symptom": "The panel shows warning A686 Checksum mismatch; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "The calculated parameter checksum does not match any enabled reference checksum. Programmable warning: 96.54 Checksum action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check that all necessary approved (reference) checksums (96.71…96.72) are enabled in 96.55 Checksum control word.",
          "Check the parameter configuration. Using 96.55 Checksum control word, enable a checksum parameter and copy the actual checksum into that parameter."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.506 (Fault tracing, Warning messages)"
      },
      {
        "code": "A687",
        "title": "Checksum configuration",
        "symptom": "The panel shows warning A687 Checksum configuration; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "An action has been defined for a parameter checksum mismatch but the feature has not been configured."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Contact your local ABB representative for configuring the feature, or disable the feature in 96.54 Checksum action."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.507 (Fault tracing, Warning messages)"
      },
      {
        "code": "A6A4",
        "title": "Motor nominal value",
        "symptom": "The panel shows warning A6A4 Motor nominal value; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Wrong motor data or drive undersized. Aux: 0001 slip too small, 0002 sync/nominal speed mismatch, 0004 current, 0005 voltage limits (see source)"
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the settings of the motor configuration parameters in groups 98 and 99.",
          "Check that the drive is sized correctly for the motor."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.507 (Fault tracing, Warning messages)"
      },
      {
        "code": "A6A5",
        "title": "No motor data",
        "symptom": "The panel shows warning A6A5 No motor data; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Parameters in group 99 have not been set."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check that all the required parameters in group 99 have been set.",
          "Note: It is normal for this warning to appear during the start-up and continue until the motor data is entered."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.507 (Fault tracing, Warning messages)"
      },
      {
        "code": "A6A6",
        "title": "Voltage category unselected",
        "symptom": "The panel shows warning A6A6 Voltage category unselected; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "The voltage category has not been defined."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Set voltage category in parameter 95.01 Supply voltage."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.507 (Fault tracing, Warning messages)"
      },
      {
        "code": "A6B0",
        "title": "User lock is open",
        "symptom": "The panel shows warning A6B0 User lock is open; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "The user lock is open, ie. user lock configuration parameters 96.100…96.102 are visible."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Close the user lock by entering an invalid pass code in parameter 96.02 Pass code.",
          "See section User lock (page 120)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.507 (Fault tracing, Warning messages)"
      },
      {
        "code": "A6D1",
        "title": "FBA A parameter conflict",
        "symptom": "The panel shows warning A6D1 FBA A parameter conflict; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "The drive does not have a functionality requested by a PLC, or requested functionality has not been activated."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check PLC programming.",
          "Check settings of parameter groups 50 Fieldbus adapter (FBA)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.508 (Fault tracing, Warning messages)"
      },
      {
        "code": "A6E5",
        "title": "AI parametrization",
        "symptom": "The panel shows warning A6E5 AI parametrization; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "The current/voltage hardware setting of an analog input does not correspond to parameter settings."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the event log for an auxiliary code. The code identifies the analog input whose settings are in conflict.",
          "Adjust parameter 12.15/12.25.",
          "Hardware setting changes take effect only after control board reboot (power cycle or 96.08 Control board boot)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.508 (Fault tracing, Warning messages)"
      },
      {
        "code": "A6E6",
        "title": "ULC configuration",
        "symptom": "The panel shows warning A6E6 ULC configuration; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "User load curve error. Aux: 0000 speed points, 0001 frequency points inconsistent; 0002 underload above overload; 0003 overload below underload."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the auxiliary code.",
          "Check that each speed point (parameters 37.11…37.15) has a higher value than the previous point.",
          "Check that each frequency point (37.16…37.20) has a higher value than the previous point.",
          "Check that each overload point (37.31…37.35) has a higher value than the corresponding underload point (37.21…37.25)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.508 (Fault tracing, Warning messages)"
      },
      {
        "code": "A780",
        "title": "Motor stall",
        "symptom": "The panel shows warning A780 Motor stall; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Motor is operating in stall region because of e.g. excessive load or insufficient motor power. Programmable warning: 31.24 Stall function."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check motor load and drive ratings.",
          "Check fault function parameters."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.508 (Fault tracing, Warning messages)"
      },
      {
        "code": "A783",
        "title": "Motor overload",
        "symptom": "The panel shows warning A783 Motor overload; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Motor current is too high."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the motor, and the machinery coupled to motor, for overload.",
          "Adjust the parameters used for the motor overload function (35.51…35.53) and 35.55…35.56."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.508 (Fault tracing, Warning messages)"
      },
      {
        "code": "A784",
        "title": "Motor disconnect",
        "symptom": "The panel shows warning A784 Motor disconnect; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "All three output phases are disconnected from motor."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check if parameter 95.26 enables the use of a motor disconnect switch.",
          "Otherwise check that every switch between drive and motor is closed and all drive-motor cables are connected and secure.",
          "If no issue was detected and drive output was actually connected to motor, contact ABB."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.509 (Fault tracing, Warning messages)"
      },
      {
        "code": "A791",
        "title": "Brake resistor",
        "symptom": "The panel shows warning A791 Brake resistor; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Brake resistor broken or not connected."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check that a brake resistor has been connected.",
          "Check the condition of the brake resistor."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.509 (Fault tracing, Warning messages)"
      },
      {
        "code": "A793",
        "title": "BR excess temperature",
        "symptom": "The panel shows warning A793 BR excess temperature; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Brake resistor temperature has exceeded warning limit defined by parameter 43.12 Brake resistor warning limit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Stop drive.",
          "Let resistor cool down.",
          "Check resistor overload protection function settings (parameter group 43 Brake chopper).",
          "Check warning limit setting, parameter 43.12 Brake resistor warning limit.",
          "Check that the resistor has been dimensioned correctly.",
          "Check that braking cycle meets allowed limits."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.509 (Fault tracing, Warning messages)"
      },
      {
        "code": "A794",
        "title": "BR data",
        "symptom": "The panel shows warning A794 BR data; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Brake resistor data has not been given."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the resistor data settings (parameters 43.08…43.10)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.509 (Fault tracing, Warning messages)"
      },
      {
        "code": "A79C",
        "title": "BC IGBT excess temperature",
        "symptom": "The panel shows warning A79C BC IGBT excess temperature; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Brake chopper IGBT temperature has exceeded internal warning limit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Let chopper cool down.",
          "Check for excessive ambient temperature.",
          "Check for cooling fan failure.",
          "Check for obstructions in the air flow.",
          "Check the dimensioning and cooling of the cabinet.",
          "Check resistor overload protection function settings (parameters 43.06…43.10).",
          "Check minimum allowed resistor value for the chopper being used.",
          "Check that braking cycle meets allowed limits.",
          "Check that drive supply AC voltage is not excessive."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.509 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7A1",
        "title": "Mechanical brake closing failed",
        "symptom": "Panel warning A7A1 Mechanical brake closing failed; status LED blinks green; motor keeps running (warning does not latch).",
        "causes": [
          "Mechanical brake control warning."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check mechanical brake connection.",
          "Check mechanical brake settings in parameter group 44 Mechanical brake control.",
          "Check that acknowledgment signal matches the actual status of the brake."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.510 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7A5",
        "title": "Mechanical brake opening not allowed",
        "symptom": "Panel warning A7A5 Mechanical brake opening not allowed; status LED blinks green; motor keeps running (warning does not latch).",
        "causes": [
          "Open conditions of mechanical brake cannot be fulfilled (e.g., brake has been prevented from opening by parameter 44.11)"
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check mechanical brake settings in parameter group 44 Mechanical brake control (especially 44.11).",
          "Check that the acknowledgment signal (if used) matches the actual status of the brake."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.510 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7AB",
        "title": "Extension I/O configuration failure",
        "symptom": "Panel warning A7AB Extension I/O configuration failure; status LED blinks green; motor keeps running (warning does not latch).",
        "causes": [
          "I/O module missing or parameters conflict with the fitted module, e.g. module removed while outputs are still assigned to its signals."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Make sure that the I/O module is connected to the device and no parameters are connected to nonexisting I/O parameters.",
          "Match installed options to 07.35, 07.36 (Drive configuration) and 15.01 (Extension module type). See Automatic option configuration, page 23."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.510 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7AC",
        "title": "I/O module internal error",
        "symptom": "The panel shows warning A7AC I/O module internal error; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Calibration data is not stored in the IO module. Analog signals are not working with full accuracy."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Replace the IO module."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.510 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7B0",
        "title": "Motor speed feedback",
        "symptom": "The panel shows warning A7B0 Motor speed feedback; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Motor speed feedback has failed and drive continues operation with open loop control. Programmable warning: 90.45 Motor feedback fault."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the settings of the parameters in groups 90 Feedback selection, 91 Encoder module settings and 92 Encoder 1 configuration.",
          "Check encoder installation."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.510 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7C1",
        "title": "FBA A communication",
        "symptom": "The panel shows warning A7C1 FBA A communication; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Cyclic link lost between drive and FBA A, or between PLC and FBA A. Programmable via 50.02 FBA A comm loss func."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check status of fieldbus communication.",
          "See user documentation of fieldbus interface.",
          "Check settings of parameter groups 50 Fieldbus adapter (FBA), 51 FBA A settings, 52 FBA A data in and 53 FBA A data out.",
          "Check cable connections.",
          "Check if communication master is able to communicate."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.511 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7CE",
        "title": "EFB comm loss",
        "symptom": "The panel shows warning A7CE EFB comm loss; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Communication break in embedded fieldbus (EFB) communication. Programmable warning: 58.14 Communication loss action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the status of the fieldbus master (online/offline/error etc.).",
          "Check cable connections to the EIA-485/X5 terminals 29, 30 and 31 on the control unit."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.511 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7E1",
        "title": "Encoder",
        "symptom": "The panel shows warning A7E1 Encoder; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Encoder fault (90.45). Aux: 0001 cable; 10000…1FFFD resolver problem; 1FFFE BRES-01 fault on initial position read; 1FFFF BRES-01 faulted."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the auxiliary code.",
          "Check the encoder cable connection.",
          "If the encoder was working previously, check the encoder, encoder cable, and encoder interface module for damage.",
          "Check the resolver cable connection. If it worked before, inspect resolver, cable and interface module for damage.",
          "Cycle the power to the drive.",
          "Check the connection of the resolver interface module."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.511 (Fault tracing, Warning messages)"
      },
      {
        "code": "A7EE",
        "title": "Panel loss",
        "symptom": "The panel shows warning A7EE Panel loss; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Panel or PC tool set as active control location stopped communicating. Programmable via 49.05 Communication loss action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Check the panel cable/connector."
        ],
        "fix": [
          "Check PC tool or control panel connection.",
          "Check control panel connector.",
          "Check mounting platform if being used.",
          "Disconnect and reconnect the control panel."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.512 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8A0",
        "title": "AI supervision",
        "symptom": "The panel shows warning A8A0 AI supervision; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "An analog signal is outside the limits specified for the analog input. Programmable warning: 12.03 AI supervision function."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Measure AI1 / AI2 to AGND at the terminals (HW p.177)."
        ],
        "fix": [
          "Check signal level at the analog input.",
          "Check the wiring connected to the input.",
          "Check the minimum and maximum limits of the input in parameter group 12 Standard AI."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.512 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8A1",
        "title": "RO life warning",
        "symptom": "The panel shows warning A8A1 RO life warning; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "The relay has changed states more than the recommended number of times. Aux code 0001: Relay output 1."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Change the control board or stop using relay output 1."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.512 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8A2",
        "title": "RO toggle warning",
        "symptom": "The panel shows warning A8A2 RO toggle warning; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Relay output toggling too fast (e.g. fast frequency signal); relay will soon reach end of life. Aux 0001: relay output 1."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Replace the signal connected to the relay output source with a less frequently changing signal.",
          "Select a different signal with parameter 10.24 RO1 source."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.512 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8B0",
        "title": "Signal supervision",
        "symptom": "The panel shows warning A8B0 Signal supervision; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Warning generated by a signal supervision function. (parameter 32.07 Supervision 1 Programmable warning: 32.06 Supervision 1 action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the source of the warning signal)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.512 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8B1",
        "title": "Signal supervision",
        "symptom": "The panel shows warning A8B1 Signal supervision; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Warning generated by a signal supervision function. (parameter 32.17 Supervision 2 Programmable warning: 32.16 Supervision 2 action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the source of the warning signal)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.512 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8B2",
        "title": "Signal supervision",
        "symptom": "The panel shows warning A8B2 Signal supervision; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Warning generated by a signal supervision function. (parameter 32.27 Supervision 3 Programmable warning: 32.26 Supervision 3 action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the source of the warning signal)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.512 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8B3",
        "title": "Signal supervision",
        "symptom": "The panel shows warning A8B3 Signal supervision; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Warning generated by a signal supervision function. (parameter 32.37 Supervision 4 Programmable warning: 32.36 Supervision 4 action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the source of the warning signal)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.512 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8B4",
        "title": "Signal supervision",
        "symptom": "The panel shows warning A8B4 Signal supervision; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Warning generated by a signal supervision function. (parameter 32.47 Supervision 5 Programmable warning: 32.46 Supervision 5 action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the source of the warning signal)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8B5",
        "title": "Signal supervision",
        "symptom": "The panel shows warning A8B5 Signal supervision; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Warning generated by a signal supervision function. (parameter 32.57 Supervision 6 Programmable warning: 32.56 Supervision 6 action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the source of the warning signal)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8C0",
        "title": "ULC invalid speed table",
        "symptom": "The panel shows warning A8C0 ULC invalid speed table; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "User load curve: X-axis points (speed) are not valid."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check that points fulfill conditions.",
          "See parameter 37.11 ULC speed table point 1."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8C1",
        "title": "ULC overload warning",
        "symptom": "The panel shows warning A8C1 ULC overload warning; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "User load curve: Signal has been too long over the overload curve."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "See parameter 37.03 ULC overload actions."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8C4",
        "title": "ULC underload warning",
        "symptom": "The panel shows warning A8C4 ULC underload warning; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "User load curve: Signal has been too long under the underload curve."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "See parameter 37.04 ULC underload actions."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8C5",
        "title": "ULC invalid underload table",
        "symptom": "The panel shows warning A8C5 ULC invalid underload table; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "User load curve: Underload curve points are not valid."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check that points fulfill conditions.",
          "See parameter 37.21 ULC underload point 1."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8C6",
        "title": "ULC invalid overload table",
        "symptom": "The panel shows warning A8C6 ULC invalid overload table; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "User load curve: Overload curve points are not valid."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check that points fulfill conditions.",
          "See parameter 37.31 ULC overload point 1."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A8C8",
        "title": "ULC invalid frequency table",
        "symptom": "The panel shows warning A8C8 ULC invalid frequency table; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "User load curve: X-axis points (frequency) are not valid."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check that points fulfill conditions. - 500.0 Hz < 37.16 < 37.17 < 37.18 < 37.19 < 37.20 < 500.0 Hz.",
          "See parameter 37.16 ULC frequency table point 1."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A981",
        "title": "External warning 1",
        "symptom": "The panel shows warning A981 External warning 1; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "External device 1 fault. Programmable warning, set by 31.01 (event 1 source) and 31.02 (event 1 type)."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.01 External event 1 source."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A982",
        "title": "External warning 2",
        "symptom": "The panel shows warning A982 External warning 2; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "External device 2 fault. Programmable warning, set by 31.03 (event 2 source) and 31.04 (event 2 type)."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.03 External event 2 source."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A983",
        "title": "External warning 3",
        "symptom": "The panel shows warning A983 External warning 3; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "External device 3 fault. Programmable warning, set by 31.05 (event 3 source) and 31.06 (event 3 type)."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.05 External event 3 source."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.513 (Fault tracing, Warning messages)"
      },
      {
        "code": "A984",
        "title": "External warning 4",
        "symptom": "The panel shows warning A984 External warning 4; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "External device 5 fault. Programmable warning, set by 31.07 (event 4 source) and 31.08 (event 4 type)."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.07 External event 4 source."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.514 (Fault tracing, Warning messages)"
      },
      {
        "code": "A985",
        "title": "External warning 5",
        "symptom": "The panel shows warning A985 External warning 5; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "External device 5 fault. Programmable warning, set by 31.09 (event 5 source) and 31.10 (event 5 type)."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.09 External event 5 source."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.514 (Fault tracing, Warning messages)"
      },
      {
        "code": "AF88",
        "title": "Season configuration warning",
        "symptom": "The panel shows warning AF88 Season configuration warning; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "You have configured a season which starts before increasing start dates, see the previous season."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Configure the seasons with parameters 34.60 Season 1 start date…34.63 Season 4 start date."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.514 (Fault tracing, Warning messages)"
      },
      {
        "code": "AF90",
        "title": "Speed controller autotuning",
        "symptom": "The panel shows warning AF90 Speed controller autotuning; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Autotune interrupted. Aux 0000 stopped early; 0001 not ready; 0002 torque not reached before max speed; 0003-0005 accel/decel failed (see source)"
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the auxiliary code (format XXXX YYYY). Repeat autotune until successful.",
          "Make sure the prerequisites of the autotune run are fulfilled (see section Before activating the autotune routine).",
          "Adjust torque step (parameter 25.38) and speed step (25.39) as the aux code indicates. Restart the drive."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.514 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFAA",
        "title": "Autoreset",
        "symptom": "The panel shows warning AFAA Autoreset; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "A fault is about to be autoreset."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Informative warning.",
          "See the settings in parameter group 31 Fault functions."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFE1",
        "title": "Emergency stop (off2)",
        "symptom": "The panel shows warning AFE1 Emergency stop (off2); status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Drive has received an emergency stop (mode selection off2) command."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check that it is safe to continue operation. Then return emergency stop push button to normal position."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFE2",
        "title": "Emergency stop (off1 or off3)",
        "symptom": "The panel shows warning AFE2 Emergency stop (off1 or off3); status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Drive has received an emergency stop (mode selection off1 or off3) command."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Restart drive.",
          "If the emergency stop was unintentional, check the source selected by parameter 21.05 Emergency stop source."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFEA",
        "title": "Enable start signal missing",
        "symptom": "The panel shows warning AFEA Enable start signal missing; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "No enable start signal received."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the setting of (and the source selected by) parameter 20.19 Enable start signal."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFE9",
        "title": "Start delay",
        "symptom": "The panel shows warning AFE9 Start delay; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "The start delay is active and the drive will start the motor after a predefined delay."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Informative warning.",
          "See parameter 21.22 Start delay."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFEB",
        "title": "Run enable missing",
        "symptom": "The panel shows warning AFEB Run enable missing; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "No run enable signal is received."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Check the signal at the digital input selected in 20.12 Run enable 1 source (DI to DCOM: 12…24 V DC when on, HW p.177)."
        ],
        "fix": [
          "Check setting of parameter 20.12 Run enable 1 source.",
          "Switch signal on (e.g. in the fieldbus Control Word) or check wiring of selected source."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFEC",
        "title": "External power signal missing",
        "symptom": "The panel shows warning AFEC External power signal missing; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "95.04 Control board supply is set to External 24V but no voltage is connected to the control unit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Measure the external supply at +24V to DGND: +24 V DC ±10% (HW p.177)."
        ],
        "fix": [
          "Check the external 24 V DC power supply to the control unit, or change the setting of parameter 95.04."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFED",
        "title": "Enable to rotate",
        "symptom": "The panel shows warning AFED Enable to rotate; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Signal enable to rotate has not been received within a fixed time delay of 240s."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Switch enable to rotate signal on (eg. in digital inputs).",
          "Check the setting of (and source selected by) parameter 20.22 Enable to rotate."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFF6",
        "title": "Identification run",
        "symptom": "The panel shows warning AFF6 Identification run; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Motor ID run will occur at next start."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Informative warning."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.515 (Fault tracing, Warning messages)"
      },
      {
        "code": "AFF7",
        "title": "Autophasing",
        "symptom": "The panel shows warning AFF7 Autophasing; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Autophasing will occur at next start."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Informative warning."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.516 (Fault tracing, Warning messages)"
      },
      {
        "code": "B5A0",
        "title": "STO event",
        "symptom": "Event B5A0 STO event is recorded in the event log (pure event / informative).",
        "causes": [
          "STO active: a safety signal at connector STO is lost. Programmable event via 31.22 STO indication run/stop."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501).",
          "Measure S1-SGND and S2-SGND: 15…25 V (max 24 V +10%) on both when STO closed; 0 V on a channel = that circuit open (HW p.178, FW p.33)."
        ],
        "fix": [
          "Check safety circuit connections.",
          "See the STO chapter in the drive hardware manual and parameter 31.22 STO indication run/stop (page 284)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.516 (Fault tracing, Warning messages)"
      },
      {
        "code": "B686",
        "title": "Checksum mismatch",
        "symptom": "Event B686 Checksum mismatch is recorded in the event log (pure event / informative).",
        "causes": [
          "The calculated parameter checksum does not match any enabled reference checksum. Programmable event: 96.54 Checksum action."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "See A686 Checksum mismatch (page 506)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.516 (Fault tracing, Warning messages)"
      },
      {
        "code": "D200",
        "title": "Brake slip at standstill2",
        "symptom": "The panel shows warning D200 Brake slip at standstill2; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Brake is slipping when the motor is not running."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the mechanical brake.",
          "Check the parameter settings in group 76.31 Motor speed match."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.516 (Fault tracing, Warning messages)"
      },
      {
        "code": "D201",
        "title": "Forward slow down limit",
        "symptom": "The panel shows warning D201 Forward slow down limit; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Slowdown command is active in the forward (up) direction based on the selection in parameter 76.05 Forward slow down limit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Run the motor in the opposite direction and deactivate the Slowdown command, or let the drive run with the limited speed reference."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.516 (Fault tracing, Warning messages)"
      },
      {
        "code": "D202",
        "title": "Reverse slow down limit",
        "symptom": "The panel shows warning D202 Reverse slow down limit; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Slowdown command is active in the reverse (down) direction based on the selection in parameter 76.07 Reverse slow down limit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Run the motor in the opposite direction and deactivate the Slowdown command, or let the drive run with the limited speed reference."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.516 (Fault tracing, Warning messages)"
      },
      {
        "code": "D205",
        "title": "Forward stop limit",
        "symptom": "The panel shows warning D205 Forward stop limit; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Stop limit command is active based on the selection in parameter 76.04 Forward stop limit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the wiring of the forward stop limit connection.",
          "Run the motor in the opposite direction and deactivate the forward stop limit command."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.516 (Fault tracing, Warning messages)"
      },
      {
        "code": "D206",
        "title": "Reverse stop limit",
        "symptom": "The panel shows warning D206 Reverse stop limit; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Stop limit command is active in the reverse direction based on the selection of 76.06 Reverse stop limit."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the wiring of the reverse stop limit connection.",
          "Run the motor in the opposite direction and deactivate the reverse stop limit command."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.516 (Fault tracing, Warning messages)"
      },
      {
        "code": "D208",
        "title": "Joystick reference check",
        "symptom": "The panel shows warning D208 Joystick reference check; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Speed ref beyond +/- 10% of joystick min/max scaling while zero input 20.214 is active and delay 20.215 has elapsed."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the wiring of the joystick zero position input.",
          "Check the wiring of the analog input reference signal of the joystick."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.517 (Fault tracing, Warning messages)"
      },
      {
        "code": "D209",
        "title": "Joystick zero position",
        "symptom": "The panel shows warning D209 Joystick zero position; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Drive does not accept a start command because of a wrong state of the joystick zero position input (20.214 Joystick zero position)."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the wiring of the joystick zero position input."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.517 (Fault tracing, Warning messages)"
      },
      {
        "code": "D20A",
        "title": "Fast stop",
        "symptom": "The panel shows warning D20A Fast stop; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Fast stop command (20.210 Fast stop input) is activated."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Deactivate the Fast stop command."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.517 (Fault tracing, Warning messages)"
      },
      {
        "code": "D20B",
        "title": "Power on acknowledge",
        "symptom": "The panel shows warning D20B Power on acknowledge; status LED blinks green; the drive continues to operate the motor (warnings do not latch).",
        "causes": [
          "Power on acknowledge circuit is open."
        ],
        "confirm": [
          "Read 04.06 Active warning 1 (04.07, 04.08) and 04.16 Latest warning (04.17, 04.18); the event log shows the auxiliary code (FW p.136, p.500-501)."
        ],
        "fix": [
          "Check the wiring and the setting of parameter 20.212 Power on acknowledge."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.517 (Fault tracing, Warning messages)"
      },
      {
        "code": "2281",
        "title": "Calibration",
        "symptom": "Drive trips and the motor stops; the panel shows fault 2281 Calibration; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Phase current measurement offset too big, or U2 vs W2 current reading differs too much (updated at current calibration)."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Try performing the current calibration again.",
          "If the fault persists, contact your local ABB representative.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.518 (Fault tracing, Fault messages)"
      },
      {
        "code": "2310",
        "title": "Overcurrent",
        "symptom": "Drive trips and the motor stops; the panel shows fault 2310 Overcurrent; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Output current over internal limit: real overcurrent, earth fault, or supply phase loss."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Read 05.83 Motor current at fault and the auxiliary code (ZZ bits 0-2 = phase U, V, W; bit 7 = SW overcurrent).",
          "Power off, disconnect motor cable, then megger motor and motor cable insulation (HW: Checking the insulation of the assembly)."
        ],
        "fix": [
          "Decode aux code XXXYYYZZ: in ZZ, bit 7 = 1 means SW overcurrent; bits 0/1/2 = phase U/V/W. E.g. 0x83 = SW overcurrent on U and V.",
          "If there is no aux code, this indicates that hardware overcurrent is triggered.",
          "Check motor load.",
          "Check accel times in groups 23 (speed), 26 (torque) or 28 (frequency) and scaling 46.01, 46.02, 46.03.",
          "Check motor and motor cable (including phasing and delta/star connection).",
          "Check there are no contactors opening and closing in motor cable.",
          "Check that the start-up data in parameter group 99 Motor data corresponds to the motor rating plate.",
          "Check that there are no power factor correction capacitors or surge absorbers in motor cable.",
          "Check for an earth fault in motor or motor cables by measuring the insulation resistances of motor and motor cable.",
          "See chapter Electrical installation, section Checking the insulation of the assembly in the hardware manual of the drive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.519 (Fault tracing, Fault messages)"
      },
      {
        "code": "2330",
        "title": "Earth leakage",
        "symptom": "Drive trips and the motor stops; the panel shows fault 2330 Earth leakage; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Drive has detected load unbalance typically due to earth fault in motor or motor cable. Programmable fault: 31.20 Earth fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "With power removed and the motor cable disconnected, measure the insulation resistance of motor and motor cable."
        ],
        "fix": [
          "Check there are no power factor correction capacitors or surge absorbers in motor cable.",
          "Check for an earth fault in motor or motor cables by measuring the insulation resistances of motor and motor cable.",
          "Try scalar control (99.04 Motor control mode) if allowed. If no earth fault is found, contact ABB.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.520 (Fault tracing, Fault messages)"
      },
      {
        "code": "2340",
        "title": "Short circuit",
        "symptom": "Drive trips and the motor stops; the panel shows fault 2340 Short circuit; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Short-circuit in motor cable(s) or motor. Aux code 0x0080 indicates that the state feedback from output phases does not match the control signals."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "With power removed, check motor and motor cable for a short circuit between phases."
        ],
        "fix": [
          "Check motor and motor cable for cabling errors.",
          "Check there are no power factor correction capacitors or surge absorbers in motor cable.",
          "Cycle the power to the drive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.520 (Fault tracing, Fault messages)"
      },
      {
        "code": "2381",
        "title": "IGBT overload",
        "symptom": "Drive trips and the motor stops; the panel shows fault 2381 IGBT overload; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Excessive IGBT junction to case temperature. This fault protects the IGBT(s) and can be activated by a short circuit in the motor cable."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check motor cable.",
          "Check ambient conditions.",
          "Check air flow and fan operation.",
          "Check heatsink fins for dust pick-up.",
          "Check motor power against drive power.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.520 (Fault tracing, Fault messages)"
      },
      {
        "code": "3130",
        "title": "Input phase loss",
        "symptom": "Drive trips and the motor stops; the panel shows fault 3130 Input phase loss; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Intermediate circuit DC voltage is oscillating due to missing input power line phase or a blown fuse."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Measure L1-L2, L2-L3, L1-L3. ACS380-04xx-xxxx-4: 3-phase 380…480 V AC -15%…+10% = 323…528 V AC; -2: 200…240 V AC = 170…264 V AC (HW p.174)",
          "Check each input fuse with power removed."
        ],
        "fix": [
          "Check input power line fuses.",
          "Check for loose power cable connections.",
          "Check for input power supply imbalance.",
          "If supply phases are properly connected and the drive still trips, it is reasonable to enable parameter 97.48 DC bus voltage stabilizer.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.520 (Fault tracing, Fault messages)"
      },
      {
        "code": "3181",
        "title": "Cross connection",
        "symptom": "Drive trips and the motor stops; the panel shows fault 3181 Cross connection; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Supply and motor cables swapped (input power on motor terminals). Programmable via 31.23 Wiring or earth fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check input power connections.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.520 (Fault tracing, Fault messages)"
      },
      {
        "code": "3210",
        "title": "DC link overvoltage",
        "symptom": "Drive trips and the motor stops; the panel shows fault 3210 DC link overvoltage; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Excessive intermediate circuit DC voltage."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Read 05.82 DC voltage at fault.",
          "Measure L1-L2, L2-L3, L1-L3. ACS380-04xx-xxxx-4: 3-phase 380…480 V AC -15%…+10% = 323…528 V AC; -2: 200…240 V AC = 170…264 V AC (HW p.174)"
        ],
        "fix": [
          "Check that overvoltage control is on (parameter 30.30 Overvoltage control).",
          "Check that the supply voltage matches the nominal input voltage of the drive.",
          "Check the supply line for static or transient overvoltage.",
          "Check brake chopper and resistor (if present).",
          "Check deceleration time.",
          "Use coast-to-stop function (if applicable).",
          "Retrofit drive with brake chopper and brake resistor.",
          "Check that the brake resistor is dimensioned properly and the resistance is between acceptable range for the drive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.521 (Fault tracing, Fault messages)"
      },
      {
        "code": "3220",
        "title": "DC link undervoltage",
        "symptom": "Drive trips and the motor stops; the panel shows fault 3220 DC link undervoltage; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Intermediate circuit DC voltage is not sufficient because of a missing supply phase, blown fuse or fault in the rectifier bridge."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Read 05.82 DC voltage at fault.",
          "Measure L1-L2, L2-L3, L1-L3. ACS380-04xx-xxxx-4: 3-phase 380…480 V AC -15%…+10% = 323…528 V AC; -2: 200…240 V AC = 170…264 V AC (HW p.174)"
        ],
        "fix": [
          "Check supply cabling, fuses and switchgear.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.521 (Fault tracing, Fault messages)"
      },
      {
        "code": "3381",
        "title": "Output phase loss",
        "symptom": "Drive trips and the motor stops; the panel shows fault 3381 Output phase loss; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Motor phase not connected. In scalar mode only detected above 10% of motor nominal frequency. Programmable via 31.19 Motor phase loss."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "With power removed, check continuity of each motor phase from T1/U, T2/V, T3/W through the motor."
        ],
        "fix": [
          "Connect motor cable.",
          "In scalar mode with motor nominal current below 1/6 of drive nominal output current, set 31.19 Motor phase loss = No action.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.521 (Fault tracing, Fault messages)"
      },
      {
        "code": "3385",
        "title": "Autophasing",
        "symptom": "Drive trips and the motor stops; the panel shows fault 3385 Autophasing; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Autophasing routine (see section Autophasing on page 53) has failed."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Try other autophasing modes (see parameter 21.13 Autophasing mode) if possible.",
          "Check that the motor ID run has been successfully completed.",
          "Clear parameter 98.15 Position offset user.",
          "Check that the encoder is not slipping on the motor shaft.",
          "Check that the motor is not already turning when the autophasing routine starts.",
          "Check the setting of parameter 99.03 Motor type.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.522 (Fault tracing, Fault messages)"
      },
      {
        "code": "4110",
        "title": "Control board temperature",
        "symptom": "Drive trips and the motor stops; the panel shows fault 4110 Control board temperature; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Control board temperature is too high."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check proper cooling of the drive.",
          "Check the auxiliary cooling fan.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.522 (Fault tracing, Fault messages)"
      },
      {
        "code": "4210",
        "title": "IGBT overtemperature",
        "symptom": "Drive trips and the motor stops; the panel shows fault 4210 IGBT overtemperature; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Estimated drive IGBT temperature is excessive."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check ambient conditions.",
          "Check air flow and fan operation.",
          "Check heatsink fins for dust pick-up.",
          "Check motor power against drive power.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.522 (Fault tracing, Fault messages)"
      },
      {
        "code": "4290",
        "title": "Cooling",
        "symptom": "Drive trips and the motor stops; the panel shows fault 4290 Cooling; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Drive module temperature is excessive."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check ambient temperature.",
          "If it exceeds 50 °C /122 °F, ensure that load current does not exceed derated load capacity of drive.",
          "See chapter Technical data, section Derating in the hardware manual of the drive.",
          "Check drive module cooling air flow and fan operation.",
          "Check inside of cabinet and heatsink of drive module for dust pick-up. Clean whenever necessary.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.522 (Fault tracing, Fault messages)"
      },
      {
        "code": "42F1",
        "title": "IGBT temperature",
        "symptom": "Drive trips and the motor stops; the panel shows fault 42F1 IGBT temperature; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Drive IGBT temperature is excessive."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check ambient conditions.",
          "Check air flow and fan operation.",
          "Check heatsink fins for dust pick-up.",
          "Check motor power against drive power.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.522 (Fault tracing, Fault messages)"
      },
      {
        "code": "4310",
        "title": "Excess temperature",
        "symptom": "Drive trips and the motor stops; the panel shows fault 4310 Excess temperature; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Power unit module temperature is excessive."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check ambient conditions.",
          "Check air flow and fan operation.",
          "Check heatsink fins for dust pick-up.",
          "Check motor power against drive power.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.523 (Fault tracing, Fault messages)"
      },
      {
        "code": "4380",
        "title": "Excess temperature difference",
        "symptom": "Drive trips, motor stops; panel fault 4380 Excess temperature difference; status LED steady red (blinking red: power off to reset).",
        "causes": [
          "High temperature difference between the IGBTs of different phases."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the motor cabling.",
          "Check cooling of drive module(s).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.523 (Fault tracing, Fault messages)"
      },
      {
        "code": "4981",
        "title": "External temperature 1",
        "symptom": "Drive trips and the motor stops; the panel shows fault 4981 External temperature 1; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Measured temperature 1 has exceeded fault limit."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the value of parameter 35.02 Measured temperature 1.",
          "Check the cooling of the motor (or other equipment whose temperature is being measured).",
          "Check the value of parameter 35.12 Temperature 1 fault limit.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.523 (Fault tracing, Fault messages)"
      },
      {
        "code": "4982",
        "title": "External temperature 2",
        "symptom": "Drive trips and the motor stops; the panel shows fault 4982 External temperature 2; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Measured temperature 2 has exceeded fault limit."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the value of parameter 35.03 Measured temperature 2.",
          "Check the cooling of the motor (or other equipment whose temperature is being measured).",
          "Check the value of parameter 35.22 Temperature 2 fault limit.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.523 (Fault tracing, Fault messages)"
      },
      {
        "code": "5090",
        "title": "STO hardware failure",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5090 STO hardware failure; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "STO hardware diagnostics has detected hardware failure."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Contact your local ABB representative for hardware replacement.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.523 (Fault tracing, Fault messages)"
      },
      {
        "code": "5091",
        "title": "Safe torque off",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5091 Safe torque off; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "STO active: safety signal at connector STO broke during start or run. Programmable fault via 31.22 STO indication run/stop."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Measure S1-SGND and S2-SGND: 15…25 V (max 24 V +10%) on both when STO closed; 0 V on a channel = that circuit open (HW p.178, FW p.33)."
        ],
        "fix": [
          "Check safety circuit connections.",
          "See the STO chapter in the drive hardware manual and parameter 31.22 STO indication run/stop (page 284).",
          "Check the value of parameter 95.04 Control board supply.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.523 (Fault tracing, Fault messages)"
      },
      {
        "code": "5092",
        "title": "PU logic error",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5092 PU logic error; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Power unit memory has cleared."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Contact your local ABB representative.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.523 (Fault tracing, Fault messages)"
      },
      {
        "code": "5093",
        "title": "Rating ID mismatch",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5093 Rating ID mismatch; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "The hardware of the drive does not match the information stored in the memory. This may occur e.g. after a firmware update."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Cycle the power to the drive. You may have to be repeat this.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.523 (Fault tracing, Fault messages)"
      },
      {
        "code": "5094",
        "title": "Measurement circuit temperature",
        "symptom": "Drive trips, motor stops; panel fault 5094 Measurement circuit temperature; status LED steady red (blinking red: power off to reset).",
        "causes": [
          "Problem with internal temperature measurement of the drive."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Contact your local ABB representative.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "5098",
        "title": "I/O communication loss",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5098 I/O communication loss; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Communication failure to standard I/O."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Try resetting the fault or cycle the power to the drive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "50A0",
        "title": "Fan",
        "symptom": "Drive trips and the motor stops; the panel shows fault 50A0 Fan; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Cooling fan stuck or disconnected."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Check that the cooling fan turns."
        ],
        "fix": [
          "Check fan operation and connection.",
          "Replace fan if faulty.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "5681",
        "title": "PU communication",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5681 PU communication; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Communication errors detected between the drive control unit and the power unit."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the connection between the drive control unit and the power unit.",
          "Check the value of parameter 95.04 Control board supply.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "5682",
        "title": "Power unit lost",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5682 Power unit lost; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Connection between the drive control unit and the power unit is lost."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the connection between the control unit and the power unit.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "5690",
        "title": "PU communication internal",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5690 PU communication internal; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Internal communication error."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "This is an internal control system failure.",
          "If reset or re-powering of the drive unit does not help, or this fault appears frequently, please replace the drive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "5691",
        "title": "Measurement circuit ADC",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5691 Measurement circuit ADC; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Measurement circuit fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "This is an internal control system failure.",
          "If reset or re-powering of the drive unit does not help, or this fault appears frequently, please replace the drive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "5692",
        "title": "PU board powerfail",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5692 PU board powerfail; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Power unit power supply failure."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "This is an internal control system failure.",
          "If reset or re-powering of the drive unit does not help, or this fault appears frequently, please replace the drive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "5693",
        "title": "Measurement circuit DFF",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5693 Measurement circuit DFF; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Measurement circuit fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "This is an internal control system failure.",
          "If reset or re-powering of the drive unit does not help, or this fault appears frequently, please replace the drive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "5697",
        "title": "Charging feedback",
        "symptom": "Drive trips and the motor stops; the panel shows fault 5697 Charging feedback; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Charging feedback signal missing."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the feedback signal coming from the charging system.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "6181",
        "title": "FPGA version incompatible",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6181 FPGA version incompatible; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Firmware and FPGA versions are incompatible."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Reboot the control unit (using parameter 96.08 Control board boot) or by cycling power.",
          "If the problem persists, contact your local ABB representative",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.524 (Fault tracing, Fault messages)"
      },
      {
        "code": "6200",
        "title": "Checksum mismatch",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6200 Checksum mismatch; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "The calculated parameter checksum does not match any enabled reference checksum. Programmable event: 96.54 Checksum action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "See A686 Checksum mismatch (page 506).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.525 (Fault tracing, Fault messages)"
      },
      {
        "code": "6306",
        "title": "FBA A mapping file",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6306 FBA A mapping file; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fieldbus adapter A mapping file read error."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Contact your local ABB representative.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.525 (Fault tracing, Fault messages)"
      },
      {
        "code": "6481",
        "title": "Task overload",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6481 Task overload; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Internal fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Reboot the control unit (using parameter 96.08 Control board boot) or by cycling power.",
          "If the problem persists, contact your local ABB representative",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.525 (Fault tracing, Fault messages)"
      },
      {
        "code": "6487",
        "title": "Stack overflow",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6487 Stack overflow; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Internal fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Reboot the control unit (using parameter 96.08 Control board boot) or by cycling power.",
          "If the problem persists, contact your local ABB representative",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.525 (Fault tracing, Fault messages)"
      },
      {
        "code": "64A1",
        "title": "Internal file load",
        "symptom": "Drive trips and the motor stops; the panel shows fault 64A1 Internal file load; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "File read error."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Reboot the control unit (using parameter 96.08 Control board boot) or by cycling power.",
          "If the problem persists, contact your local ABB representative",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.525 (Fault tracing, Fault messages)"
      },
      {
        "code": "64A6",
        "title": "Adaptive program",
        "symptom": "Drive trips and the motor stops; the panel shows fault 64A6 Adaptive program; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Adaptive program fault. Aux 000A/000E corrupt or missing block; 000C block input missing; 0011 too large; 0012 empty; 001C/001E/0023/0024 (see source)"
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the auxiliary code.",
          "Restore the template program or download the program to the drive.",
          "Check the inputs of the block.",
          "Remove blocks until the error stops. Correct the program and download it to the drive.",
          "Edit the program to correct the parameter reference, or use an existing block.",
          "Check for other sources affecting the target parameter.",
          "Adapt the program to current block library and firmware version. Other codes: contact your local ABB representative, quoting the auxiliary code.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.525 (Fault tracing, Fault messages)"
      },
      {
        "code": "64B2",
        "title": "User set fault",
        "symptom": "Drive trips and the motor stops; the panel shows fault 64B2 User set fault; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "User parameter set load failed: set does not exist, is incompatible with control program, or drive powered off during load."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Ensure that a valid user parameter set exists.",
          "Reload if uncertain.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.526 (Fault tracing, Fault messages)"
      },
      {
        "code": "64E1",
        "title": "Kernel overload",
        "symptom": "Drive trips and the motor stops; the panel shows fault 64E1 Kernel overload; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Operating system error."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Reboot the control unit (using parameter 96.08 Control board boot) or by cycling power.",
          "If the problem persists, contact your local ABB representative",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.526 (Fault tracing, Fault messages)"
      },
      {
        "code": "6581",
        "title": "Parameter system",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6581 Parameter system; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Parameter load or save failed."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Try forcing a save using parameter 96.07 Parameter save manually. Retry.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.526 (Fault tracing, Fault messages)"
      },
      {
        "code": "65A1",
        "title": "FBA A parameter conflict",
        "symptom": "Drive trips and the motor stops; the panel shows fault 65A1 FBA A parameter conflict; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "The drive does not have a functionality requested by PLC, or requested functionality has not been activated."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check PLC programming.",
          "Check settings of parameter groups 50 Fieldbus adapter (FBA) and 51 FBA A settings.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.526 (Fault tracing, Fault messages)"
      },
      {
        "code": "6681",
        "title": "EFB comm loss",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6681 EFB comm loss; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Communication break in embedded fieldbus (EFB) communication. Programmable fault: 58.14 Communication loss action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the status of the fieldbus master (online/offline/error etc.).",
          "Check cable connections to the EIA-485/X5 terminals 29, 30 and 31 on the control unit.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.526 (Fault tracing, Fault messages)"
      },
      {
        "code": "6682",
        "title": "EFB config file",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6682 EFB config file; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Embedded fieldbus (EFB) configuration file could not be read."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Contact your local ABB representative.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.526 (Fault tracing, Fault messages)"
      },
      {
        "code": "6683",
        "title": "EFB invalid parameterization",
        "symptom": "Drive trips, motor stops; panel fault 6683 EFB invalid parameterization; status LED steady red (blinking red: power off to reset).",
        "causes": [
          "Embedded fieldbus (EFB) parameter settings inconsistent or not compatible with selected protocol."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the settings in parameter group 58 Embedded fieldbus.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.526 (Fault tracing, Fault messages)"
      },
      {
        "code": "6684",
        "title": "EFB load fault",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6684 EFB load fault; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Embedded fieldbus (EFB) protocol firmware could not be loaded. Version mismatch between EFB protocol firmware and drive firmware."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Contact your local ABB representative.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "6685",
        "title": "EFB fault 2",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6685 EFB fault 2; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fault reserved for the EFB protocol application."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the documentation of the protocol.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "6686",
        "title": "EFB fault 3",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6686 EFB fault 3; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fault reserved for the EFB protocol application."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the documentation of the protocol.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "6882",
        "title": "Text 32-bit table overflow",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6882 Text 32-bit table overflow; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Internal fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Reset the fault.",
          "Contact your local ABB representative if the fault persists.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "6885",
        "title": "Text file overflow",
        "symptom": "Drive trips and the motor stops; the panel shows fault 6885 Text file overflow; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Internal fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Reset the fault.",
          "Contact your local ABB representative if the fault persists.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "7081",
        "title": "Control panel loss",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7081 Control panel loss; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Control panel or PC tool selected as active control location for drive has ceased communicating. Programmable fault: 49.05 Communication loss action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Check the panel cable/connector."
        ],
        "fix": [
          "Check PC tool or control panel connection.",
          "Check control panel connector.",
          "Disconnect and reconnect the control panel.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "7082",
        "title": "I/O module comm loss",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7082 I/O module comm loss; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "IO module to drive communication faulty. Aux 0001…000A: front option module; 000B…0014: side option module."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the IO module installation.",
          "Check the front option module installation.",
          "Check the side option module installation.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "7086",
        "title": "I/O module AI Over voltage",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7086 I/O module AI Over voltage; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "AI overvoltage: AI switched to voltage mode; it returns to mA mode by itself once the signal is back within limits."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Measure the AI signal to AGND: voltage mode 0…10 V (11 V max), current mode 0…20 mA (22 mA max) (HW p.177)."
        ],
        "fix": [
          "Check AI signal levels.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "7087",
        "title": "I/O module configuration",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7087 I/O module configuration; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Unsupported I/O config. Aux 0001: BIO-01 S1/S2 DIP switch changed after power-up; 0002: S1/S2 set so DO1 is on both pins."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the auxiliary code.",
          "Reboot control unit either by cycling the power or through parameter 96.08 Control board boot to activate new DIP switch position.",
          "Change S1/S2 DIP switch positions to a supported combination, see parameter 05.99 BIO-01 DIP switch status.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.527 (Fault tracing, Fault messages)"
      },
      {
        "code": "7121",
        "title": "Motor stall",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7121 Motor stall; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Motor is operating in stall region because of e.g. excessive load or insufficient motor power. Programmable fault: 31.24 Stall function."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check motor load and drive ratings.",
          "Check fault function parameters.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.528 (Fault tracing, Fault messages)"
      },
      {
        "code": "7122",
        "title": "Motor overload",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7122 Motor overload; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Motor current is too high."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the motor, and the machinery coupled to motor, for overload.",
          "Adjust the parameters used for the motor overload function (35.51…35.53) and 35.55…35.56.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.528 (Fault tracing, Fault messages)"
      },
      {
        "code": "7181",
        "title": "Brake resistor",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7181 Brake resistor; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Brake resistor broken or not connected."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check that a brake resistor has been connected.",
          "Check the condition of the brake resistor.",
          "Check the dimensioning of the brake resistor.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.528 (Fault tracing, Fault messages)"
      },
      {
        "code": "7183",
        "title": "BR excess temperature",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7183 BR excess temperature; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Brake resistor temperature has exceeded fault limit defined by parameter 43.11 Brake resistor fault limit."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Stop drive.",
          "Let resistor cool down.",
          "Check resistor overload protection function settings (parameter group 43 Brake chopper).",
          "Check fault limit setting, parameter 43.11 Brake resistor fault limit.",
          "Check that braking cycle meets allowed limits.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.528 (Fault tracing, Fault messages)"
      },
      {
        "code": "7184",
        "title": "Brake resistor wiring",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7184 Brake resistor wiring; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Brake resistor short circuit or brake chopper control fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check brake chopper and brake resistor connection.",
          "Ensure brake resistor is not damaged.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.528 (Fault tracing, Fault messages)"
      },
      {
        "code": "7191",
        "title": "BC short circuit",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7191 BC short circuit; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Short circuit in brake chopper IGBT."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Ensure brake resistor is connected and not damaged.",
          "Check the electrical specifications of the brake resistor against chapter Resistor braking in the hardware manual of the drive.",
          "Replace brake chopper (if replaceable).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.528 (Fault tracing, Fault messages)"
      },
      {
        "code": "7192",
        "title": "BC IGBT excess temperature",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7192 BC IGBT excess temperature; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Brake chopper IGBT temperature has exceeded internal fault limit."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Let chopper cool down.",
          "Check for excessive ambient temperature.",
          "Check for cooling fan failure.",
          "Check for obstructions in the air flow.",
          "Check resistor overload protection function settings (parameter group 43 Brake chopper).",
          "Check that braking cycle meets allowed limits.",
          "Check that drive supply AC voltage is not excessive.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.529 (Fault tracing, Fault messages)"
      },
      {
        "code": "71A2",
        "title": "Mechanical brake closing failed",
        "symptom": "Drive trips, motor stops; panel fault 71A2 Mechanical brake closing failed; status LED steady red (blinking red: power off to reset).",
        "causes": [
          "Brake control fault, e.g. brake acknowledge not as expected while closing. Programmable via 44.17 Brake fault function."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check mechanical brake connection.",
          "Check mechanical brake settings in parameter group 44 Mechanical brake control.",
          "Check that the acknowledgment signal matches the actual status of the brake.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.529 (Fault tracing, Fault messages)"
      },
      {
        "code": "71A3",
        "title": "Mechanical brake opening failed",
        "symptom": "Drive trips, motor stops; panel fault 71A3 Mechanical brake opening failed; status LED steady red (blinking red: power off to reset).",
        "causes": [
          "Brake control fault, e.g. brake acknowledge not as expected while opening. Programmable via 44.17 Brake fault function."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check mechanical brake connection.",
          "Check mechanical brake settings in parameter group 44 Mechanical brake control.",
          "Check that acknowledgment signal matches actual status of brake.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.529 (Fault tracing, Fault messages)"
      },
      {
        "code": "71A5",
        "title": "Mechanical brake opening not allowed",
        "symptom": "Drive trips, motor stops; panel fault 71A5 Mechanical brake opening not allowed; status LED steady red (blinking red: power off to reset).",
        "causes": [
          "Open conditions of mechanical brake cannot be fulfilled (e.g., the brake has been prevented from opening by parameter 44.11)."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check mechanical brake settings in parameter group 44 Mechanical brake control (especially 44.11).",
          "Check that the acknowledgment signal (if used) matches the actual status of the brake.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.529 (Fault tracing, Fault messages)"
      },
      {
        "code": "7301",
        "title": "Motor speed feedback",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7301 Motor speed feedback; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "No speed feedback, or encoder speed far from estimate. Aux 4 = drift; aux 3FC = wrong feedback config. Programmable via 90.45."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the parameter 90.41 setting and the actual source selected.",
          "Check electrical connection of the encoder and pulse sin/cos nr.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.529 (Fault tracing, Fault messages)"
      },
      {
        "code": "7310",
        "title": "Overspeed",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7310 Overspeed; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Motor above max allowed speed: wrong min/max speed, too little braking torque, or load change under torque reference."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check minimum/maximum speed settings, parameters 30.11 Minimum speed and 30.12 Maximum speed.",
          "Check adequacy of motor braking torque.",
          "Check applicability of torque control.",
          "Check need for brake chopper and resistor(s).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.530 (Fault tracing, Fault messages)"
      },
      {
        "code": "7381",
        "title": "Encoder",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7381 Encoder; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Encoder feedback fault. Programmable fault: 90.45 Motor feedback fault."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "See A7E1 Encoder (page 511).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.530 (Fault tracing, Fault messages)"
      },
      {
        "code": "73F0",
        "title": "Overfrequency",
        "symptom": "Drive trips and the motor stops; the panel shows fault 73F0 Overfrequency; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Max output frequency exceeded (aux 00FA): wrong min/max frequency, or motor rushes from high supply voltage or wrong 95.01 setting."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check minimum/maximum frequency settings, parameters 30.13 Minimum frequency and 30.14 Maximum frequency.",
          "Check adequacy of motor braking torque.",
          "Check applicability of torque control.",
          "Check need for brake chopper and resistor(s).",
          "Check actual supply voltage against 95.01 Supply voltage. For other aux codes contact ABB with the aux code.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.530 (Fault tracing, Fault messages)"
      },
      {
        "code": "73B0",
        "title": "Emergency ramp failed",
        "symptom": "Drive trips and the motor stops; the panel shows fault 73B0 Emergency ramp failed; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Emergency stop did not finish within expected time. 31.32 Emergency ramp supervision"
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the settings of parameters and 31.33 Emergency ramp supervision delay.",
          "Check the predefined ramp times (23.11…23.15 for mode Off1, 23.23 for mode Off3).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.531 (Fault tracing, Fault messages)"
      },
      {
        "code": "7510",
        "title": "FBA A communication",
        "symptom": "Drive trips and the motor stops; the panel shows fault 7510 FBA A communication; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Cyclic link lost between drive and FBA A, or between PLC and FBA A. Programmable fault via 50.02 FBA A comm loss func."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check status of fieldbus communication.",
          "See user documentation of fieldbus interface.",
          "Check settings of parameter groups 50 Fieldbus adapter (FBA), 51 FBA A settings, 52 FBA A data in and 53 FBA A data out.",
          "Check cable connections.",
          "Check if communication master is able to communicate.",
          "If a fieldbus module (e.g. FPBA) was swapped for another option (e.g. BMIO), restore factory defaults (96.06).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.531 (Fault tracing, Fault messages)"
      },
      {
        "code": "8001",
        "title": "ULC underload fault",
        "symptom": "Drive trips and the motor stops; the panel shows fault 8001 ULC underload fault; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "User load curve: Signal has been too long under the underload curve."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "See parameter 37.04 ULC underload actions.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.531 (Fault tracing, Fault messages)"
      },
      {
        "code": "8002",
        "title": "ULC overload fault",
        "symptom": "Drive trips and the motor stops; the panel shows fault 8002 ULC overload fault; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "User load curve: Signal has been too long over the overload curve."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "See parameter 37.03 ULC overload actions.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.531 (Fault tracing, Fault messages)"
      },
      {
        "code": "80A0",
        "title": "AI supervision",
        "symptom": "Drive trips and the motor stops; the panel shows fault 80A0 AI supervision; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Analog input signal outside its set limits. Programmable via 12.03 AI supervision function."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Measure AI1 to AGND (0…10 V or 0…20 mA as configured) at the terminals (HW p.177)."
        ],
        "fix": [
          "Check the wiring connected to the input.",
          "Check the minimum and maximum limits of the input in parameter group 12 Standard AI.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.531 (Fault tracing, Fault messages)"
      },
      {
        "code": "80B0",
        "title": "Signal supervision",
        "symptom": "Drive trips and the motor stops; the panel shows fault 80B0 Signal supervision; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fault generated by the signal supervision 1 function. Programmable fault: 32.06 Supervision 1 action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the source of the fault (parameter 32.07 Supervision 1 signal).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.531 (Fault tracing, Fault messages)"
      },
      {
        "code": "80B1",
        "title": "Signal supervision",
        "symptom": "Drive trips and the motor stops; the panel shows fault 80B1 Signal supervision; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fault generated by the signal supervision 2 function. Programmable fault: 32.16 Supervision 2 action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the source of the fault (parameter 32.17 Supervision 2 signal).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.531 (Fault tracing, Fault messages)"
      },
      {
        "code": "80B2",
        "title": "Signal supervision",
        "symptom": "Drive trips and the motor stops; the panel shows fault 80B2 Signal supervision; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fault generated by the signal supervision 3 function. Programmable fault: 32.26 Supervision 3 action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the source of the fault (parameter 32.27 Supervision 3 signal).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "80B3",
        "title": "Signal supervision",
        "symptom": "Drive trips and the motor stops; the panel shows fault 80B3 Signal supervision; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fault generated by the signal supervision 4 function. Programmable fault: 32.36 Supervision 4 action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the source of the fault (parameter 32.37 Supervision 4 signal).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "80B4",
        "title": "Signal supervision",
        "symptom": "Drive trips and the motor stops; the panel shows fault 80B4 Signal supervision; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fault generated by the signal supervision 5 function. Programmable fault: 32.46 Supervision 5 action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the source of the fault (parameter 32.47 Supervision 5 signal).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "80B5",
        "title": "Signal supervision",
        "symptom": "Drive trips and the motor stops; the panel shows fault 80B5 Signal supervision; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Fault generated by the signal supervision 6 function. Programmable fault: 32.56 Supervision 6 action."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the source of the fault (parameter 32.57 Supervision 6 signal).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "9081",
        "title": "External fault 1",
        "symptom": "Drive trips and the motor stops; the panel shows fault 9081 External fault 1; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "External device 1 fault. Programmable fault, set by 31.01 (event 1 source) and 31.02 (event 1 type)."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Measure the digital input selected in 31.01 External event 1 source to DCOM (12…24 V DC when on, HW p.177)."
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.01 External event 1 source.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "9082",
        "title": "External fault 2",
        "symptom": "Drive trips and the motor stops; the panel shows fault 9082 External fault 2; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "External device 2 fault. Programmable fault, set by 31.03 (event 2 source) and 31.04 (event 2 type)."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.03 External event 2 source.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "9083",
        "title": "External fault 3",
        "symptom": "Drive trips and the motor stops; the panel shows fault 9083 External fault 3; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "External device 3 fault. Programmable fault, set by 31.05 (event 3 source) and 31.06 (event 3 type)."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.05 External event 3 source.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "9084",
        "title": "External fault 4",
        "symptom": "Drive trips and the motor stops; the panel shows fault 9084 External fault 4; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "External device 5 fault. Programmable fault, set by 31.07 (event 4 source) and 31.08 (event 4 type)."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.07 External event 4 source.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "9085",
        "title": "External fault 5",
        "symptom": "Drive trips and the motor stops; the panel shows fault 9085 External fault 5; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "External device 5 fault. Programmable fault, set by 31.09 (event 5 source) and 31.10 (event 5 type)."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the external device.",
          "Check setting of parameter 31.09 External event 5 source.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "FA81",
        "title": "Safe torque off 1",
        "symptom": "Drive trips and the motor stops; the panel shows fault FA81 Safe torque off 1; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Safe torque off function is active, ie. STO circuit 1 is broken."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Measure S1-SGND and S2-SGND: 15…25 V (max 24 V +10%) on both when STO closed; 0 V on a channel = that circuit open (HW p.178, FW p.33)."
        ],
        "fix": [
          "Check safety circuit connections.",
          "See the STO chapter in the drive hardware manual and parameter 31.22 STO indication run/stop (page 284).",
          "Check the value of parameter 95.04 Control board supply.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "FA82",
        "title": "Safe torque off 2",
        "symptom": "Drive trips and the motor stops; the panel shows fault FA82 Safe torque off 2; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Safe torque off function is active, ie. STO circuit 2 is broken."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)",
          "Measure S1-SGND and S2-SGND: 15…25 V (max 24 V +10%) on both when STO closed; 0 V on a channel = that circuit open (HW p.178, FW p.33)."
        ],
        "fix": [
          "Check safety circuit connections.",
          "See the STO chapter in the drive hardware manual and parameter 31.22 STO indication run/stop (page 284).",
          "Check the value of parameter 95.04 Control board supply.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.532 (Fault tracing, Fault messages)"
      },
      {
        "code": "FF61",
        "title": "ID run",
        "symptom": "Drive trips and the motor stops; the panel shows fault FF61 ID run; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "ID run failed. Aux 0001/0002/0003 current, speed, torque limit too low; 0004 calib timeout; 0005-0011 internal/accel; 0012 motor too big (see source)"
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the nominal motor values in parameter group 99 Motor data.",
          "Check that no external control system is connected to the drive.",
          "Cycle the power to the drive (and its control unit, if powered separately).",
          "Check that no operation limits prevent the completion of the ID run.",
          "Restore parameters to default settings and try again.",
          "Check that the motor shaft is not locked.",
          "Aux 0001: 30.17 > 99.06; 0002: 30.12 > 0.55×99.09 > 0.50×sync speed, 30.11 < 0, supply > 0.66×99.07; 0003: torque limit > 100% (99.12) (see source)",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.533 (Fault tracing, Fault messages)"
      },
      {
        "code": "FF81",
        "title": "FB A force trip",
        "symptom": "Drive trips and the motor stops; the panel shows fault FF81 FB A force trip; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "A fault trip command has been received through fieldbus adapter A."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the fault information provided by the PLC.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.534 (Fault tracing, Fault messages)"
      },
      {
        "code": "FF8E",
        "title": "EFB force trip",
        "symptom": "Drive trips and the motor stops; the panel shows fault FF8E EFB force trip; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "A fault trip command has been received through the embedded fieldbus interface."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the fault information provided by the PLC.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.534 (Fault tracing, Fault messages)"
      },
      {
        "code": "D100",
        "title": "Torque prove",
        "symptom": "Drive trips and the motor stops; the panel shows fault D100 Torque prove; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Not enough torque during torque proving: premagnetizing time wrong or too short (21.01 Vector start mode = Const time, 21.02 Magnetization time)."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the motor and motor cables.",
          "Check that the parameter settings are as follows: not fixed. Enter an appropriate value.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.535 (Fault tracing, Fault messages)"
      },
      {
        "code": "D101",
        "title": "Brake slip",
        "symptom": "Drive trips and the motor stops; the panel shows fault D101 Brake slip; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Brake slipped during Torque proving."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the brake.",
          "Check whether the brake is slipping when it is in the closed state.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.535 (Fault tracing, Fault messages)"
      },
      {
        "code": "D102",
        "title": "Brake safe closure",
        "symptom": "Drive trips and the motor stops; the panel shows fault D102 Brake safe closure; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Start command on, speed below 44.208 Safety close speed, and 44.209 Safety close delay has elapsed."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check whether it is necessary to drive the application at a low speed.",
          "If not, set 44.208 and 44.209 to suit. Trolley or long-travel only, a qualified person must decide: disable Brake safe closure (44.207).",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.535 (Fault tracing, Fault messages)"
      },
      {
        "code": "D105",
        "title": "Speed match",
        "symptom": "Drive trips and the motor stops; the panel shows fault D105 Speed match; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Speed beyond steady-state (76.32) or ramping (76.33) deviation level for longer than 76.34 Speed match fault delay."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the torque and current limit settings.",
          "If an encoder is used, check the encoder settings.d205",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.535 (Fault tracing, Fault messages)"
      },
      {
        "code": "D108",
        "title": "Stop limits I/O error",
        "symptom": "Drive trips and the motor stops; the panel shows fault D108 Stop limits I/O error; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Both the forward stop limit and reverse stop limit inputs are active simultaneously."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Check the forward stop limit and reverse stop limit wiring.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.535 (Fault tracing, Fault messages)"
      },
      {
        "code": "D10A",
        "title": "Brake not selected",
        "symptom": "Drive trips and the motor stops; the panel shows fault D10A Brake not selected; status LED steady red (blinking red = set power off to reset).",
        "causes": [
          "Mechanical brake control was inactive when the Conical motor control function was enabled."
        ],
        "confirm": [
          "Read 04.01 (04.02, 04.03), 04.11/04.12/04.13, 05.80…05.88 at fault (05.81 Hz, 05.82 DC V, 05.83 A); aux code in event log (FW p.136-141, p.500-501)"
        ],
        "fix": [
          "Activate mechanical brake control with parameter 44.06 Brake control enable.",
          "Once the cause is fixed, reset via panel, Drive Composer, fieldbus or the DI in 31.11; some faults need a reboot (power cycle or 96.08) (FW p.500)."
        ],
        "source": "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf p.535 (Fault tracing, Fault messages)"
      }
    ],
    "sources": [
      "https://library.e.abb.com/public/8e19de8ea8b34ae68f22cf7bc83329da/AMCK219x_en.pdf (ACS380 machinery control program firmware manual 3AXD50000029275 Rev H: Control macros p.32-33, parameters 04/05 p.136-141, 10.24 p.158, 8 Fault tracing p.499-536)",
      "https://library.e.abb.com/public/2a86caefc9a646d6ba6be02a51401d7c/EN_ACS380_HW_H.pdf (ACS380 hardware manual 3AXD50000029274 Rev H: status LED p.45, default I/O connection diagram p.85-86, electrical power network p.174, control connection data p.177-178)"
    ]
  }
];
