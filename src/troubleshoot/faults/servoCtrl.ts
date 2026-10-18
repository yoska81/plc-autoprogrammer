import type { DeviceFaultProfile } from "../deviceFaults";

/**
 * Servo drive and controller fault profiles: Allen-Bradley Kinetix 5100, Siemens SINAMICS V90 (PTI 400 V, PN),
 * Micro820 / Micro850 and 2085 I/O, CompactLogix 5380 (major faults, I/O fault codes) and Compact 5000 I/O,
 * Unitronics UniStream, Vision, Jazz. Codes as the maker prints them (Kinetix with a space: 'E 001').
 */
export const SERVO_CTRL_FAULTS: DeviceFaultProfile[] = [
  {
    "id": "kinetix-5100-servo-drive",
    "title": "Allen-Bradley Kinetix 5100 (2198-Exxxx-ERS) servo drive",
    "match": {
      "categories": [
        "servoDrive"
      ],
      "family": "Kinetix 5100"
    },
    "normal": [
      {
        "terminals": "L1, L2, L3 (mains AC input power)",
        "state": "power applied, 200V-class 2198-E1004/E1007/E1015/E1020-ERS",
        "meter": "VAC",
        "expected": "95…132V rms single-phase, or 170…253V rms single-phase or three-phase",
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
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.28 Table 2"
      },
      {
        "terminals": "L1, L2, L3 (mains AC input power)",
        "state": "power applied, 200V-class 2198-E2030/E2055/E2075/E2150-ERS",
        "meter": "VAC",
        "expected": "170…253V rms three-phase",
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
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.28 Table 2"
      },
      {
        "terminals": "L1, L2, L3 (mains AC input power)",
        "state": "power applied, 400V-class 2198-E4xxx-ERS",
        "meter": "VAC",
        "expected": "342…528V rms three-phase",
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
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.28 Table 2"
      },
      {
        "terminals": "L1C to L2C (control power, 200V-class)",
        "state": "control power applied",
        "meter": "VAC",
        "expected": "95…132V AC (120V nom) single-phase, or 170…253V AC (200…230V nom) single-phase",
        "pins": [
          [
            "L1C",
            "L2C"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.71 Control Power"
      },
      {
        "terminals": "24V+ to 24V- (control power, 400V-class)",
        "state": "control power applied",
        "meter": "VDC",
        "expected": "21.6…26.4V DC (24V nom)",
        "pins": [
          [
            "24V+",
            "24V-"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.72 Control Power, p.54 Table 19"
      },
      {
        "terminals": "INPUTx to DCOM (I/O connector, digital inputs INPUT1…INPUT10)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "15…26.4V (magnitude; polarity depends on sink/source wiring), 6 mA max at 26.4V",
        "pins": [
          [
            "INPUT1",
            "DCOM"
          ],
          [
            "INPUT2",
            "DCOM"
          ],
          [
            "INPUT3",
            "DCOM"
          ],
          [
            "INPUT4",
            "DCOM"
          ],
          [
            "INPUT5",
            "DCOM"
          ],
          [
            "INPUT6",
            "DCOM"
          ],
          [
            "INPUT7",
            "DCOM"
          ],
          [
            "INPUT8",
            "DCOM"
          ],
          [
            "INPUT9",
            "DCOM"
          ],
          [
            "INPUT10",
            "DCOM"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.59 Table 25 Digital Input Specifications; pinout p.55 Table 21"
      },
      {
        "terminals": "INPUTx to DCOM (digital inputs)",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "–1.0…5.0V",
        "pins": [
          [
            "INPUT1",
            "DCOM"
          ],
          [
            "INPUT2",
            "DCOM"
          ],
          [
            "INPUT3",
            "DCOM"
          ],
          [
            "INPUT4",
            "DCOM"
          ],
          [
            "INPUT5",
            "DCOM"
          ],
          [
            "INPUT6",
            "DCOM"
          ],
          [
            "INPUT7",
            "DCOM"
          ],
          [
            "INPUT8",
            "DCOM"
          ],
          [
            "INPUT9",
            "DCOM"
          ],
          [
            "INPUT10",
            "DCOM"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.59 Table 25"
      },
      {
        "terminals": "OUTPUTx+ to OUTPUTx– (digital outputs OUTPUT1…OUTPUT6, open collector/emitter)",
        "state": "output ON",
        "meter": "VDC",
        "expected": "1.5V max across the output transistor at 40 mA (40 mA max ON current)",
        "pins": [
          [
            "OUTPUT1+",
            "OUTPUT1-"
          ],
          [
            "OUTPUT2+",
            "OUTPUT2-"
          ],
          [
            "OUTPUT3+",
            "OUTPUT3-"
          ],
          [
            "OUTPUT4+",
            "OUTPUT4-"
          ],
          [
            "OUTPUT5+",
            "OUTPUT5-"
          ],
          [
            "OUTPUT6+",
            "OUTPUT6-"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.61 Table 27 Digital Output Signal Specifications"
      },
      {
        "terminals": "OUTPUTx+ to OUTPUTx– (digital outputs)",
        "state": "output OFF",
        "meter": "VDC",
        "expected": "up to the external supply voltage, 30V max across the transistor; OFF current 0.1 mA max",
        "pins": [
          [
            "OUTPUT1+",
            "OUTPUT1-"
          ],
          [
            "OUTPUT2+",
            "OUTPUT2-"
          ],
          [
            "OUTPUT3+",
            "OUTPUT3-"
          ],
          [
            "OUTPUT4+",
            "OUTPUT4-"
          ],
          [
            "OUTPUT5+",
            "OUTPUT5-"
          ],
          [
            "OUTPUT6+",
            "OUTPUT6-"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.61 Table 27"
      },
      {
        "terminals": "S1 to S1C (STO_A) and S2 to S2C (STO_B), STO connector",
        "state": "safety enable inputs energized (drive ready, torque permitted)",
        "meter": "VDC",
        "expected": "11…30V DC (7.34 mA max per input)",
        "pins": [
          [
            "S1",
            "S1C"
          ],
          [
            "S2",
            "S2C"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.418 Table 130; pinout p.415 Table 128; with the factory bypass jumpers fitted the inputs are fed from SB+/SB–"
      },
      {
        "terminals": "S1 to S1C (STO_A) and S2 to S2C (STO_B)",
        "state": "STO demanded (safe torque off)",
        "meter": "VDC",
        "expected": "5V DC max (OFF); both OFF > 10 ms gives E 500, one OFF > 1 s gives E 501 / E 502",
        "pins": [
          [
            "S1",
            "S1C"
          ],
          [
            "S2",
            "S2C"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.411-412, p.418 Table 130"
      },
      {
        "terminals": "SS+ to SS– (STO safety status / feedback output)",
        "state": "no STO fault",
        "meter": "continuity",
        "expected": "open (no continuity)",
        "pins": [
          [
            "SS+",
            "SS-"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.414 Table 126; feedback output ON 40 mA max, 1.5V @ 40 mA (Table 130)"
      },
      {
        "terminals": "SS+ to SS–",
        "state": "STO fault E 500 (both STO inputs off)",
        "meter": "continuity",
        "expected": "closed (continuity); open for E 501, E 502, E 503. With ID252 (P2.093) = XX2X the state latches",
        "pins": [
          [
            "SS+",
            "SS-"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.414 Table 126"
      },
      {
        "terminals": "COMMAND1 / COMMAND2 to AGND (analog torque / speed command)",
        "state": "analog command in use",
        "meter": "VDC",
        "expected": "–10…+10V",
        "pins": [
          [
            "COMMAND1",
            "AGND"
          ],
          [
            "COMMAND2",
            "AGND"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.63 Table 28"
      },
      {
        "terminals": "DC bus (CHARGE LED)",
        "state": "powered or recently powered",
        "meter": "LED",
        "expected": "CHARGE LED steady orange when DC bus voltage is above 50V DC; measure the DC bus before working on the drive",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.449-450 Table 143"
      },
      {
        "terminals": "Status display",
        "state": "configured, not enabled / enabled",
        "meter": "display",
        "expected": "boot shows 'Kinetix 5100', then StoP (configured, not enabled), RUN (enabled / servo on), Stdby (not configured)",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf p.118, p.121 Device Information Screen"
      }
    ],
    "pairs": [
      {
        "a": "SS+",
        "b": "SS-",
        "when": "STO fault E 500 (both STO inputs off)",
        "note": "Open with no STO fault and for E 501/E 502/E 503; latches if ID252 (P2.093) = XX2X (UM004 p.414 Table 126)"
      },
      {
        "a": "OUTPUT1+",
        "b": "OUTPUT1-",
        "when": "output ON",
        "note": "Optically isolated open-collector/emitter transistor, 1.5V @ 40 mA max when ON (UM004 p.60-61)"
      },
      {
        "a": "OUTPUT2+",
        "b": "OUTPUT2-",
        "when": "output ON",
        "note": "Optically isolated open-collector/emitter transistor, 1.5V @ 40 mA max when ON (UM004 p.60-61)"
      },
      {
        "a": "OUTPUT3+",
        "b": "OUTPUT3-",
        "when": "output ON",
        "note": "Optically isolated open-collector/emitter transistor, 1.5V @ 40 mA max when ON (UM004 p.60-61)"
      },
      {
        "a": "OUTPUT4+",
        "b": "OUTPUT4-",
        "when": "output ON",
        "note": "Optically isolated open-collector/emitter transistor, 1.5V @ 40 mA max when ON (UM004 p.60-61)"
      },
      {
        "a": "OUTPUT5+",
        "b": "OUTPUT5-",
        "when": "output ON",
        "note": "Optically isolated open-collector/emitter transistor, 1.5V @ 40 mA max when ON (UM004 p.60-61)"
      },
      {
        "a": "OUTPUT6+",
        "b": "OUTPUT6-",
        "when": "output ON",
        "note": "Optically isolated open-collector/emitter transistor, 1.5V @ 40 mA max when ON (UM004 p.60-61)"
      }
    ],
    "indicators": [
      {
        "name": "MOD",
        "state": "steady off",
        "meaning": "No power"
      },
      {
        "name": "MOD",
        "state": "steady green",
        "meaning": "Device operational (I/O connection established; standalone: drive booted)"
      },
      {
        "name": "MOD",
        "state": "flashing green",
        "meaning": "Standby: device not configured (I/O mode)"
      },
      {
        "name": "MOD",
        "state": "flashing red",
        "meaning": "Major recoverable or minor recoverable fault (an incorrect configuration can be a major recoverable fault)"
      },
      {
        "name": "MOD",
        "state": "steady red",
        "meaning": "Major unrecoverable fault"
      },
      {
        "name": "MOD",
        "state": "flashing green/red",
        "meaning": "Self-test at power-up"
      },
      {
        "name": "NET",
        "state": "steady off",
        "meaning": "No power or no IP address"
      },
      {
        "name": "NET",
        "state": "steady green",
        "meaning": "Connected: IP address configured, at least one CIP connection, Exclusive Owner not timed out"
      },
      {
        "name": "NET",
        "state": "flashing green",
        "meaning": "Not connected: IP address configured but no CIP connections"
      },
      {
        "name": "NET",
        "state": "flashing red",
        "meaning": "Connection timeout: Exclusive Owner connection timed out"
      },
      {
        "name": "NET",
        "state": "steady red",
        "meaning": "Duplicate IP address detected"
      },
      {
        "name": "NET",
        "state": "flashing green/red",
        "meaning": "Self-test"
      },
      {
        "name": "CHARGE",
        "state": "steady off",
        "meaning": "No power"
      },
      {
        "name": "CHARGE",
        "state": "steady orange",
        "meaning": "DC bus voltage above 50V DC"
      },
      {
        "name": "Status display",
        "state": "shows E followed by the code",
        "meaning": "Fault (E nnn); servo off per MotorStopMode ID675 (P1.032)"
      },
      {
        "name": "Status display",
        "state": "shows A followed by the code",
        "meaning": "Warning (minor fault, A nnn); clears automatically when the cause is corrected"
      },
      {
        "name": "Status display",
        "state": "Stdby",
        "meaning": "Passed boot and self-test but not configured"
      },
      {
        "name": "Status display",
        "state": "StoP",
        "meaning": "Configured but not enabled / servo off"
      },
      {
        "name": "Status display",
        "state": "RUN",
        "meaning": "Enabled / servo on"
      }
    ],
    "faults": [
      {
        "code": "E 001",
        "title": "Over current",
        "symptom": "Drive display shows E 001 (Over current); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. Current is 1.5 times more than the drive's rated peak current output.",
        "causes": [
          "The drive output is short-circuited.",
          "Motor wiring error.",
          "IGBT error.",
          "Control parameter setting error.",
          "Unreasonable command issued."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the wiring connection between the drive and motor.",
          "Check that the wires are not short-circuited.",
          "Check that the wiring steps are all correct when connecting the motor to the drive.",
          "Check whether the setting value is greater than the default value.",
          "Check that the command is within a reasonable acceleration time."
        ],
        "fix": [
          "Correct the wiring and avoid exposing any conductors.",
          "Follow the wiring instructions in the user manual.",
          "The temperature of heat sink is abnormal.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Reset to the default settings and then gradually adjust the value.",
          "Increase the acceleration time.",
          "Apply a filter for a smooth command.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 001); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 002",
        "title": "Over voltage",
        "symptom": "Drive display shows E 002 (Over voltage); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The main circuit voltage is higher than the rated voltage.",
        "causes": [
          "The input voltage of main circuit is higher than the rated allowable voltage.",
          "The drive may be damaged."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the main input voltage."
        ],
        "fix": [
          "Apply the correct voltage.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 002); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 003",
        "title": "Under voltage",
        "symptom": "Drive display shows E 003 (Under voltage); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. Voltage of the main circuit is lower than the rated voltage.",
        "causes": [
          "The input voltage of main circuit is lower than the allowable voltage.",
          "No voltage is supplied to the power circuit."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the main input voltage.",
          "Check the input voltage wiring.",
          "Check the main input voltage.",
          "Check the input voltage wiring."
        ],
        "fix": [
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 003); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 004",
        "title": "Motor combination error",
        "symptom": "Drive display shows E 004 (Motor combination error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Drive and motor combination error.",
        "causes": [
          "The wrong motor is connected to the servo drive."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Connect to the right motor.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 004); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 005",
        "title": "Regeneration error",
        "symptom": "Drive display shows E 005 (Regeneration error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "The shunt resistor is not connected or its value is too low.",
          "ID158 (P1.053) ShuntResistorPower is not set to zero when the shunt resistor is not connected. The regenerative switch transistor may be short-circuited.",
          "Wrong parameter setting."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the connection of the shunt resistor.",
          "Check if the regenerative switch transistor is short-circuited.",
          "Check the settings of parameters ID157 (P1.052) ShuntResistorValue and ID158 (P1.053) ShuntResistorPower."
        ],
        "fix": [
          "Connect the shunt resistor or recalculate the value of the shunt resistor.",
          "Set parameterID158 (P1.053) ShuntResistorPower to zero when the shunt resistor is not in use.",
          "Set the correct value.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 005); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 006",
        "title": "Motor overload",
        "symptom": "Drive display shows E 006 (Motor overload); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Motor ratings have been exceeded.",
          "Control parameters are inappropriate.",
          "Wiring between the motor and encoder is incorrect.",
          "The motor encoder is malfunctioning."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check for mechanical vibration.",
          "Check the acceleration or deceleration settings.",
          "Check the wiring between the motor and the encoder."
        ],
        "fix": [
          "Set parameter ID102 (P0 - 002) LEDMonitorSelection to 12 and check if the average torque % is over 100% all of the time.",
          "Change the motor or reduce the load.",
          "Adjust the tuning parameters.",
          "Reduce the acceleration or deceleration settings.",
          "Correct the wiring.",
          "If the motor encoder is malfunctioning, contact your distributor or Rockwell Automation representative.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 006); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 007",
        "title": "Excessive deviation of speed command",
        "symptom": "Drive display shows E 007 (Excessive deviation of speed command); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The speed of the motor exceeds the maximum set speed.",
        "causes": [
          "Abnormal analog command.",
          "Inappropriate parameter setting.",
          "Excessive command."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check whether the setting of ID218 (P2.034) VelocityErrorTolerance is too small (the over-speed warning condition).",
          "Check the command speed."
        ],
        "fix": [
          "Use the scope to check the analog voltage signal.",
          "Use the analog filter to smooth the command speed.",
          "Set ID218 (P2.034) VelocityErrorTolerance (the overspeed warning condition) correctly.",
          "Command speed too aggressive.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 007); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 008",
        "title": "Abnormal pulse command",
        "symptom": "Drive display shows E 008 (Abnormal pulse command); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "The pulse command frequency is higher than the rated input frequency."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Use the scope to check if the input frequency is higher than the rated input frequency.",
          "Correct the input pulse frequency setting.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 008); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 009",
        "title": "Excessive deviation of position command",
        "symptom": "Drive display shows E 009 (Excessive deviation of position command); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The deviation of the posistion command exceeds the allowable setting value.",
        "causes": [
          "Parameter ID219 (P2.035) PositionErrorTolerance is set too small.",
          "The tuning parameters are set inappropriately.",
          "The torque limit is too low.",
          "Excessive external load."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the setting value of ID219 (P2.035) PositionErrorTolerance (the warning condition of excessive position deviation).",
          "Check the value of the tuning parameters.",
          "Check the torque limit value.",
          "Check the external load."
        ],
        "fix": [
          "Increase the setting value of ID219 (P2.035) PositionErrorTolerance.",
          "Correct the value of the tuning parameters.",
          "Correctly adjust the torque limit value.",
          "Reduce the external load or re-evaluate the motor capacity.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 009); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 011",
        "title": "Encoder error",
        "symptom": "Drive display shows E 011 (Encoder error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. The encoder has an abnormal pulse.",
        "causes": [
          "The encoder is wired incorrectly.",
          "The encoder connector is loose.",
          "The encoder is damaged."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the wiring to the encoder by following the instructions in the user manual.",
          "Check the drive connector and the motor encoder connectors.",
          "Check the motor and encoder for damage."
        ],
        "fix": [
          "Correct the wiring.",
          "Correct the connectors.",
          "Replace the motor.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 011); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 012",
        "title": "Analog input calibration error",
        "symptom": "Drive display shows E 012 (Analog input calibration error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The calibration value exceeds the allowable value during electronic calibration.",
        "causes": [
          "The analog input port is incorrectly set to zero.",
          "The measurement device is damaged."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check grounding signals."
        ],
        "fix": [
          "Correctly connect the analog input port to ground.",
          "Reset the power supply.",
          "Contact your distributor or Rockwell Automation representative.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 012); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 013",
        "title": "Emergency stop",
        "symptom": "Drive display shows E 013 (Emergency stop); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The emergency stop button is activated.",
        "causes": [
          "The emergency stop button is activated."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the emergency stop button is activated."
        ],
        "fix": [
          "Deactivate the emergency stop by using the DI.EMGS signal.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 013); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 014",
        "title": "Reverse limit warning",
        "symptom": "Drive display shows A 014 (Reverse limit warning); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "The reverse limit switch is activated.",
          "The servo system is unstable."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the limit switch is activated.",
          "Check the control parameter and inertia ratio."
        ],
        "fix": [
          "Move the axis away from the reverse limit switch.",
          "Re-adjust the parameter or re-evaluate the motor capacity.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 014); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 015",
        "title": "Forward limit warning",
        "symptom": "Drive display shows A 015 (Forward limit warning); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "The forward limit switch is activated.",
          "The servo system is unstable."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the limit switch is activated.",
          "Check the control parameter and inertia ratio."
        ],
        "fix": [
          "Move the axis away from the forward limit switch.",
          "Re-adjust the parameter or re-evaluate the motor capacity.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 015); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 016",
        "title": "IGBT overheat",
        "symptom": "Drive display shows E 016 (IGBT overheat); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The temperature of the IGBT is too high.",
        "causes": [
          "The load is greater than the drive rating and excessive use.",
          "The drive output is short-circuited."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check for overloading or if the motor current is too high.",
          "Check the drive output wiring."
        ],
        "fix": [
          "Change the motor or reduce loading.",
          "Correct the wiring.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 016); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 017",
        "title": "Abnormal EEPROM",
        "symptom": "Drive display shows E 017 (Abnormal EEPROM); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. An EEPROM error has occurred.",
        "causes": [
          "An EEPROM error has occurred."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Contact your distributor or Rockwell Automation representative.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 017); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 018",
        "title": "Abnormal pulse output",
        "symptom": "Drive display shows E 018 (Abnormal pulse output); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "An error in the encoder.",
          "The output pulse exceeds the allowable hardware range.",
          "Interference or cable damage."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if E 011, E 024, E025, or E 026 are present in the fault history. See ID274 (P4.000) …ID 278 (P4.005) FaultRecordNx.",
          "Check that the value of ID175 (P1.076) MaxEncoderOutputSpeed is less than the motor speed or that (Motor Speed/60)x(MaxEncoderOutputSpeed x4) > (19.8 x 106).",
          "Check that the motor is properly grounded.",
          "Check whether the encoder cable is separated from the power supply or the high-current circuit.",
          "Check whether shielded cables are used."
        ],
        "fix": [
          "If a fault exists, correct the fault.",
          "Set ID102 (P0.002) LEDMonitorSelection to 112. If interference is present, the value increments.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 018); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 022",
        "title": "Input voltage phase loss",
        "symptom": "Drive display shows E 022 (Input voltage phase loss); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "The input voltage is abnormal."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check RST wiring."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 022); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 024",
        "title": "Encoder Hall sensor effect error",
        "symptom": "Drive display shows E 024 (Encoder Hall sensor effect error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Error in the U, V, W magnetic field of the encoder signal.",
        "causes": [
          "The motor is not properly grounded.",
          "Interference or cable damage.",
          "The Hall sensor is not wired."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check that feedback cable is separated from the power supply or the high-current cables.",
          "Check whether shielded cables were used.",
          "Verify that the Hall sensor is wired."
        ],
        "fix": [
          "Use shielding mesh.",
          "Contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 024); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 025",
        "title": "Internal encoder error",
        "symptom": "Drive display shows E 025 (Internal encoder error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "The motor is not properly grounded.",
          "Interference or cable damage."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check that feedback cable is separated from the power supply or the high-current cables.",
          "Check whether shielded cables were used."
        ],
        "fix": [
          "Wire the motor grounding cable.",
          "Use shielding mesh.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 025); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 027",
        "title": "Encoder reset error",
        "symptom": "Drive display shows E 027 (Encoder reset error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. An internal encoder error has occurred.",
        "causes": [
          "The motor is not properly grounded.",
          "Interference or cable damage."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check that feedback cable is separated from the power supply or the high-current cables.",
          "Check whether shielded cables were used."
        ],
        "fix": [
          "Wire the motor grounding cable.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 027); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 028",
        "title": "Encoder overvoltage error",
        "symptom": "Drive display shows E 028 (Encoder overvoltage error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Battery is over voltage."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check whether the voltage of the installed battery is greater than 3.8 V."
        ],
        "fix": [
          "Replace the battery.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 028); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 029",
        "title": "Gray Code error",
        "symptom": "Drive display shows E 029 (Gray Code error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Encoder error occurred.",
        "causes": [
          "An absolute position error occurred."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Cycle power and check if the fault re-occurs.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 029); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 02C",
        "title": "Drive overload",
        "symptom": "Drive display shows E 02C (Drive overload); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "The drive rating has been exceeded.",
          "The control parameters are set inappropriately.",
          "The accel/decel settings are inappropriate.",
          "Wiring between the motor and encoder is incorrect.",
          "The motor controller is malfunctioning."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check for mechanical vibration.",
          "Check the acceleration or deceleration settings.",
          "Check the wiring between the motor and the encoder."
        ],
        "fix": [
          "Set parameter ID102 (P0 - 002) LEDMonitorSelection to 113 and check if the average torque is over 100% all of the time. When the monitored value is higher than 100%, then fault E02C occurs.",
          "Change the drive or the motor or reduce the load.",
          "Adjust the tuning parameters.",
          "Reduce the acceleration or deceleration settings.",
          "Correct the wiring.",
          "If the motor encoder is malfunctioning, contact your distributor or Rockwell Automation representative.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 02C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 030",
        "title": "Exceed torque limit",
        "symptom": "Drive display shows E 030 (Exceed torque limit); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. Torque limit or time setting exceeded.",
        "causes": [
          "Parameter ID162 (P1.057) CrashProtectionTorqueThreshold is not set correctly.",
          "Parameter ID162 (P1.057) CrashProtectionTorqueThreshold and ID163 (P1.058) CrashProtectionFilterTime are not set correctly."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check whether ID162 (P1.057) CrashProtectionTorqueThreshold is not set to 0.",
          "Check the values of ID162 (P1.057) and ID163 (P1.058)."
        ],
        "fix": [
          "Set ID162 (P1.057) to 0 if it is not in use.",
          "Set ID162 (P1.057) and ID (P1.058) to a higher value.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 030); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 031",
        "title": "Incorrect or disconnected motor power cable wiring",
        "symptom": "Drive display shows E 031 (Incorrect or disconnected motor power cable wiring); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Incorrect or disconnected motor power cable wiring."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check motor power cable wiring."
        ],
        "fix": [
          "Correct the motor power cable wiring.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 031); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 034",
        "title": "Encoder communication error",
        "symptom": "Drive display shows E 034 (Encoder communication error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Internal communication error of the encoder (absolute or other encoder)."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Change the motor.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 034); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 035",
        "title": "Encoder over temperature",
        "symptom": "Drive display shows E 035 (Encoder over temperature); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Encoder temperature exceeded the maximum of 100°C (212°F)."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Set ID102 (P0.002) LEDMonitorSelection to 114 to read the temperature and check if it is below 100°C (212°F).",
          "If the encoder temperature is higher than 100°C (212°F), improve the heat dissipation to lower the temperature.",
          "If the temperature difference between the motor and the displayed temperature value is over 30˚C (86 °F) , contact your distributor or Rockwell Automation representative.",
          "Restart the system when the TLP motor temperature is below 100°C (212°F).",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 035); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 040",
        "title": "Excessive deviation of full closed-loop position control",
        "symptom": "Drive display shows E 040 (Excessive deviation of full closed-loop position control); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "ID172 (P1.073) MotorAndAuxFeedbackErrorLimit is set too small.",
          "Connection problem."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the value of ID172 (P1.073) is too small.",
          "Check whether the connector is loose or there is any mechanism connection problem."
        ],
        "fix": [
          "Increase the value of ID172 (P1.073).",
          "Fix the connection.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 040); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 041",
        "title": "Auxiliary feedback error",
        "symptom": "Drive display shows E 041 (Auxiliary feedback error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Wiring issue with auxiliary feedback."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the wiring for the auxiliary feedback."
        ],
        "fix": [
          "Correct the wiring, if necessary.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 041); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 042",
        "title": "Analog input voltage error",
        "symptom": "Drive display shows E 042 (Analog input voltage error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "The analog input voltage is higher than the value of ID176 (P1.083) AbnormalAnalogInputVoltageLevel over 50ms."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if analog input voltage is higher than the value of ID176 (P1.083) AbnormalAnalogInputVoltageLevel."
        ],
        "fix": [
          "Correct the analog input source or the value of ID176 (P1.083) AbnormalAnalogInputVoltageLevel setting.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 042); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 045",
        "title": "E-Gear ratio setting error",
        "symptom": "Drive display shows E 045 (E-Gear ratio setting error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "E-Gear ratio exceeds the allowable range (0.25…262144)"
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the E-gear ratio parameter is within the allowable range."
        ],
        "fix": [
          "Adjust the parameter value to within the allowable range.",
          "Cycle power to the drive.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 045); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 050",
        "title": "Auto detection of motor parameters is complete",
        "symptom": "Drive display shows E 050 (Auto detection of motor parameters is complete); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "When executing motor analyzer or test commutation, this fault occurs when the auto detection is complete."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Cycle power or reset the drive.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 050); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 052",
        "title": "Initial magnetic field detection error",
        "symptom": "Drive display shows E 052 (Initial magnetic field detection error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The drive could not detect a magnetic field when using self sense.",
        "causes": [
          "The motor move distance is too large during the magnetic field detection.",
          "The motor brake is not released or motor is not rotating smoothly, or the motion platform cannot work because the set screw has not been pulled out."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor parameter ID599 (PM.003) EncoderType is set correctly.",
          "Check whether the feedback signal is abnormal.",
          "Check whether the moving distance is too large during the initial magnetic field detection when the motor is powered on.",
          "Check for interference and verify that shielded cable is used for the feedback signal.",
          "Make sure that the motor and mechanism can operate properly.",
          "Check whether the friction between the motor and mechanism is too large."
        ],
        "fix": [
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 052); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 055",
        "title": "Motor magnetic field error",
        "symptom": "Drive display shows E 055 (Motor magnetic field error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "The drive detects the motor’s current magnetic field position and compares it with that of the Hall sensor. When the deviation between the two is too big, this alarm occurs."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if noise is interfering with the encoder feedback, causing pulse loss.",
          "Check if the Hall sensor is malfunctioning."
        ],
        "fix": [
          "Assuming that the feedback type of the encoder is a square wave digital signal, check if the motor speed is too fast and exceeds the hardware limit of 20 MHz (the limit of quadruple frequency).",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 055); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 058",
        "title": "Excessive deviation of initial magnetic pole position detection when power on",
        "symptom": "Drive display shows E 058 (Excessive deviation of initial magnetic pole position detection when power on); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The controller issued commands during initial magnetic field detection.",
        "causes": [
          "After the initial magnetic field detection is complete, the servo system then attempts, but fails to reduce the existing position error.",
          "If the controller issues commands when the servo system is not fully settled, the position error might therefore be greater and cannot be reduced."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the controller has issued the command immediately when it is powered on. Use the software scope and select 'Command position' to monitor whether there is a command issued. If so, increase the delay time for the controller to issue the command after it is powered on."
        ],
        "fix": [
          "If the controller time sequence cannot be modified due to surge interference or other factors when powered on, set ID682 (P2.088) [bit4] to 1 to prohibit the servo from receiving controller commands during the initial magnetic field detection.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 058); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 05C",
        "title": "Motor position feedback error",
        "symptom": "Drive display shows E 05C (Motor position feedback error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. A sharp change of motor feedback position occurred.",
        "causes": [
          "Encoder feedback is abnormal or the encoder is damaged.",
          "The encoder feedback signal experienced interference."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check whether the feedback signal is abnormal. Rotate the motor by hand and observe whether feedback signal has an abnormally large change.",
          "Check for interference and verify that shielded cable is used for the feedback signal."
        ],
        "fix": [
          "Clear the fault.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 05C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 05D",
        "title": "Motor UVW offset error",
        "symptom": "Drive display shows E 05D (Motor UVW offset error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          ""
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check whether PM.003, PM.004 and PM.028 are set correctly.",
          "Check whether motor can be rotated by hand.",
          "Check whether the friction between the motor and the mechanism is too large.",
          "Check whether feedback signal is abnormal.",
          "Check whether the interference exist and shielded cable for the feedback signal cable is used"
        ],
        "fix": [
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 05D); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 060",
        "title": "Absolution position lost",
        "symptom": "Drive display shows A 060 (Absolution position lost); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "Absolute position is not initialized.",
          "Battery undervoltage."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the absolute position was initialized.",
          "Check battery and replace, if necessary."
        ],
        "fix": [
          "Conduct the homing procedure to initialize the absolute position.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 060); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 061",
        "title": "Encoder under voltage",
        "symptom": "Drive display shows A 061 (Encoder under voltage); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "The battery is undervoltage."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check battery and replace, if necessary."
        ],
        "fix": [
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 061); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 065",
        "title": "Absolute position cannot sync with EEPROM data",
        "symptom": "Drive display shows A 065 (Absolute position cannot sync with EEPROM data); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red. The drive cannot compute the absolute position reliably when booting up.",
        "causes": [
          "The drive cannot compute the absolute position reliably when booting up."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the motor has moved more than 1/4 multi-turn."
        ],
        "fix": [
          "This fault is cleared automatically when absolute position is initialized.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 065); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 068",
        "title": "Error transmitting absolute data via I/O",
        "symptom": "Drive display shows A 068 (Error transmitting absolute data via I/O); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "Sequence error occurred.",
          "Read time out occurred."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the time between switching ON DO ABSR and switching ON ABSQ exceeds 200 ms."
        ],
        "fix": [
          "Correct the I/O reading sequence by switching DI.ABSQ off until DO.ABSR is off and switching DI.ABSQ on once DO.ABSR is on.",
          "After switching DO.ABSR (the absolute position data is ready) on, read DO.ABSD and switch DI.ABSQ on within 200 ms to inform the servo drive that data reading is complete.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 068); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 069",
        "title": "Wrong motor encoder type",
        "symptom": "Drive display shows E 069 (Wrong motor encoder type); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Wrong motor encoder type selected",
        "causes": [
          "Incremental motor does not support absolute function.",
          "Absolute encoder function required."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that ID242 (P2.069) AbsoluteSystemSetting is set for an incremental motor.",
          "Check the motor encoder type."
        ],
        "fix": [
          "Set ID242 (P2.069) AbsoluteSystemSetting to 0 for an incremental motor.",
          "Change motor to an absolute encoder type.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 069); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 06A",
        "title": "Absolute position is not initialized",
        "symptom": "Drive display shows A 06A (Absolute position is not initialized); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "The motor is being used for the first time or absolute position was lost due to a battery change."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the absolute position was initialized."
        ],
        "fix": [
          "Initialize the absolute postion.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 06A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 071",
        "title": "TLP Motor encoder MT error",
        "symptom": "Drive display shows E 071 (TLP Motor encoder MT error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. TLP motor MT error due to lower encoder voltage.",
        "causes": [
          "The encoder entered the non-operation state and it is unable to serve as an encoder. This occurs when the higher voltage between the built-in backup capacitor in the encoder or the external battery becomes 2.76V or less."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Replace the motor if the fault continues.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 071); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 072",
        "title": "Encoder overspeed",
        "symptom": "Drive display shows E 072 (Encoder overspeed); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. The encoder exceeded 8800 rpm.",
        "causes": [
          "The motor is not grounded properly.",
          "Interference or cable damage.",
          "The motor speed is not within range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check that the encoder cable is separated from the power supply or the high-current circuit.",
          "Check whether shielded cables are used.",
          "Check whether motor speed is within range."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 072); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 073",
        "title": "Encoder memory error",
        "symptom": "Drive display shows E 073 (Encoder memory error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. An error has occurred when the encoder was reading or writing data in EEPROM.",
        "causes": [
          "The motor is not grounded properly.",
          "Interference or cable damage.",
          "The motor speed is not within range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check that the encoder cable is separated from the power supply or the high-current circuit.",
          "Check whether shielded cables are used.",
          "Check whether motor speed is within range."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 073); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 074",
        "title": "Absolute encoder single-turn position error",
        "symptom": "Drive display shows E 074 (Absolute encoder single-turn position error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. A single-turn position error on the absolute encoder occurred.",
        "causes": [
          "The motor is not grounded properly.",
          "Interference or cable damage.",
          "The motor speed is not within range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check that the encoder cable is separated from the power supply or the high-current circuit.",
          "Check whether shielded cables are used.",
          "Check whether motor speed is within range."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 074); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 075",
        "title": "Absolute encoder multi-turn position error",
        "symptom": "Drive display shows E 075 (Absolute encoder multi-turn position error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. A multi-turn position error occurred on the absolute encoder.",
        "causes": [
          "The motor is not grounded properly.",
          "Interference or cable damage.",
          "The motor speed is not within range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check whether the encoder cable is separated from the power supply or the high-current circuit.",
          "Check whether shielded cables are used.",
          "Check whether motor speed is within range."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 075); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 077",
        "title": "Encoder computing error",
        "symptom": "Drive display shows E 077 (Encoder computing error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. A computing error occurred on the encoder.",
        "causes": [
          "The motor is not grounded properly.",
          "Interference or cable damage.",
          "The motor speed is not within range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check whether the encoder cable is separated from the power supply or the high-current circuit.",
          "Check whether shielded cables are used.",
          "Check whether motor speed is within range."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 077); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 07B",
        "title": "Encoder memory is busy",
        "symptom": "Drive display shows E 07B (Encoder memory is busy); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "The motor is not grounded properly.",
          "Interference or cable damage.",
          "The motor speed is not within range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check that the motor is properly grounded.",
          "Check whether the encoder cable is separated from the power supply or the high-current circuit.",
          "Check whether shielded cables are used.",
          "Check whether motor speed is within range."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 07B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 07C",
        "title": "Clearing absolute position is issued when motor speed is over 200 rpm",
        "symptom": "Drive display shows A 07C (Clearing absolute position is issued when motor speed is over 200 rpm); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "The command for clearing absolute position was issued when motor speed is over 200 rpm."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Follow the procedure for clearing absolute position to clear this warning or set ID244 (P2.071) ResetAbsolutePosition to 1.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 07C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 07D",
        "title": "A 07C fault not cleared",
        "symptom": "Drive display shows E 07D (A 07C fault not cleared); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "A 07C was not cleared."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Clear the fault.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 07D); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 07E",
        "title": "Encoder clearing procedure error",
        "symptom": "Drive display shows E 07E (Encoder clearing procedure error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "The clearing procedure for the encoder exceeded the limit."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Set ID102 (P0.002) LEDMonitorSelection to -80 to check the quality of encoder communication.",
          "Clear the fault.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 07E); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 07F",
        "title": "Encoder version error",
        "symptom": "Drive display shows E 07F (Encoder version error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "The encoder version read by the drive is wrong."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Replace the motor.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 07F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 083",
        "title": "Excessive over current",
        "symptom": "Drive display shows E 083 (Excessive over current); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. Servo drive output exceeds 95% of hardware overcurrent.",
        "causes": [
          "The drive output is short-circuited.",
          "Motor wiring is incorrect.",
          "Unreasonable acceleration time command."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the wiring connections between drive and motor.",
          "Check if the wire is short-circuited.",
          "Check that the wiring steps are all correct when connecting the motor to the drive.",
          "Check if the command is using a reasonable acceleration time."
        ],
        "fix": [
          "Eliminate the short-circuit and verify that the metal conductor is not exposed.",
          "Follow the wiring description from the user manual.",
          "Reduce the steepness of the command or apply a filter to smooth the command.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 083); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 085",
        "title": "Shunt resistor error",
        "symptom": "Drive display shows E 085 (Shunt resistor error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "The shunt resistor is not in operation, but the DC bus voltage remains 400V over 110 ms."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the shunt resistor connection."
        ],
        "fix": [
          "Re-calculate the value for shunt resistor, and reset the value of ID157 (P1.052) ShuntResistorValue and ID158 (P1.053) ShuntResistorPower.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 085); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 089",
        "title": "Current detection interference",
        "symptom": "Drive display shows A 089 (Current detection interference); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "External interference has been detected by the drive."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check for a source of interference."
        ],
        "fix": [
          "Remove the source of interference.",
          "Set ID266 (P2.112) SpecialFunctionConfiguration4, Bit 1 to 0 to disable the warning.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 089); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 08A",
        "title": "Auto-tuning command error",
        "symptom": "Drive display shows E 08A (Auto-tuning command error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. Command issued error during the auto-tuning procedure.",
        "causes": [
          "The external source command was not issued.",
          "Cable connection error.",
          "Position 1 and Position 2 were the same when the command was issued."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the external source command.",
          "Check the cable connection."
        ],
        "fix": [
          "Reconfigure Position 1 and Position 2.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 08A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 08B",
        "title": "Dwell time too short",
        "symptom": "Drive display shows E 08B (Dwell time too short); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "The dwell time is set too short during the autotuning procedure."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Setting the dwell time is required. Increase the dwell time to more than 1 second.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 08B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 08C",
        "title": "Inertia estimation error",
        "symptom": "Drive display shows E 08C (Inertia estimation error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. An inertia estimation error occurred during the auto-tuning procedure.",
        "causes": [
          "Acceleration/deceleration time was too long.",
          "Speed is too slow.",
          "Inertia mismatch.",
          "Inertia variation is too vigorous."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Verify that the acceleration/deceleration time for motor to start from 0 … 3000 rpm is within 1.5 sec.",
          "Verify that load inertia is not more than 50 times the motor inertia."
        ],
        "fix": [
          "The recommended speed setting is 500 rpm. The lowest possible speed setting is 200 rpm.",
          "Resize the system requirements.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 08C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 099",
        "title": "DSP parameter value is out of range.",
        "symptom": "Drive display shows E 099 (DSP parameter value is out of range.); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "The DSP parameter is out of range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check whether the firmware is updated."
        ],
        "fix": [
          "Update the firmware.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 099); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 09C",
        "title": "Parameter reset failure",
        "symptom": "Drive display shows E 09C (Parameter reset failure); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Parameter reset was not successful."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Perform the parameter reset again.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 09C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 207",
        "title": "Download parameter or data array (PR mode) group out of range",
        "symptom": "Drive display shows E 207 (Download parameter or data array (PR mode) group out of range); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Group is out of range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check parameter group and value."
        ],
        "fix": [
          "Clear the fault.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 207); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 209",
        "title": "Download parameter or data array (PR mode) number out of range",
        "symptom": "Drive display shows E 209 (Download parameter or data array (PR mode) number out of range); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Number is out of range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check parameter number and value."
        ],
        "fix": [
          "Clear the fault.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 209); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 213",
        "title": "Download parameter or data array (PR mode) data out of range",
        "symptom": "Drive display shows E 213 (Download parameter or data array (PR mode) data out of range); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Data is out of range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check parameter value."
        ],
        "fix": [
          "Clear the fault.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 213); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 215",
        "title": "Download to read only parameters",
        "symptom": "Drive display shows E 215 (Download to read only parameters); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Writing to read only parameters."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Verify that parameter is read only."
        ],
        "fix": [
          "Clear the fault.",
          "Adjust the PR command and parameters.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 215); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 217",
        "title": "Downloading parameter which is not allowed to write during servo-on",
        "symptom": "Drive display shows E 217 (Downloading parameter which is not allowed to write during servo-on); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Downloading to a parameter that cannot be written to while the servo is on."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check whether the drive status is servo on."
        ],
        "fix": [
          "Clear the fault.",
          "Adjust the PR command and parameters.",
          "Execute the command when the drive status is servo off.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 217); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 219",
        "title": "Downloading parameter which is locked",
        "symptom": "Drive display shows E 219 (Downloading parameter which is locked); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Downloading to parameter which is locked"
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check whether parameter protection is enabled."
        ],
        "fix": [
          "Clear the fault.",
          "Adjust the PR command and parameters.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 219); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 21F",
        "title": "Downloading invalid value to parameter",
        "symptom": "Drive display shows E 21F (Downloading invalid value to parameter); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Downloading an invalid value to a parameter"
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the parameter value."
        ],
        "fix": [
          "Clear the fault.",
          "Adjust the PR command and parameter",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 21F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 231",
        "title": "Download parameter or data array (PR mode) monitored item out of range",
        "symptom": "Drive display shows E 231 (Download parameter or data array (PR mode) monitored item out of range); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Monitored item is out of range."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check monitored item range."
        ],
        "fix": [
          "Clear the fault.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 231); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 235",
        "title": "Absolute move command error",
        "symptom": "Drive display shows E 235 (Absolute move command error); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. 1. This fault occurs if you execute the absolute move command in the following situation: a. ID117 (P1.001.Z) ControlMode has changed and the homing procedure was not executed. b.The E-gear ratio is modified by using [ID151 (P1.044) GearRatioFollowerCountsN1 and ID152 (P1.045) GearRatioMasterCounts] and the homing procedure was not executed. c. The homing procedure was not completed before the command was triggered. d. A 060 (Absolute Position Lost) or A 065 (Absolute Position Cannot Synch with EEPROM Data) or and A 06A (Absolute position is not initialized) occurred. 2. Incremental type: PR mode continuously operates in one direction and causes feedback register (FB_PUU) overflows. The coordinate system cannot reflect the correct position. The error occurs if the absolute positioning command is issued at during this time period. 3. Absolute type: The error occurs in following situations: a.Feedback register (FB_PUU) overflows. b. After ID117 (P1.001.Z) ControlMode is modified, the system neither returns to the original point nor conducts homing procedure. c. The system does not conduct the homing procedure after the E-gear ratio is modified by using [ID151 (P1.044) GearRatioFollowerCountsN1 and ID152 (P1.045) GearRatioMasterCounts] . d. Returning to the original point is triggered while the homing procedure is not complete. e. A 060 or A 062 or A 065 or A 06A occur.",
        "causes": [
          "1. This fault occurs if you execute the absolute move command in the following situation: a. ID117 (P1.001.Z) ControlMode has changed and the homing procedure was not executed. b.The E-gear ratio is modified by using [ID151 (P1.044) GearRatioFollowerCountsN1 and ID152 (P1.045) GearRatioMasterCounts] and the homing procedure was not executed. c. The homing procedure was not completed before the command was triggered. d. A 060 (Absolute Position Lost) or A 065 (Absolute Position Cannot Synch with EEPROM Data) or and A 06A (Absolute position is not initialized) occurred. 2. Incremental type: PR mode continuously operates in one direction and causes feedback register (FB_PUU) overflows. The coordinate system cannot reflect the correct position. The error occurs if the absolute positioning command is issued at during this time period. 3. Absolute type: The error occurs in following situations: a.Feedback register (FB_PUU) overflows. b. After ID117 (P1.001.Z) ControlMode is modified, the system neither returns to the original point nor conducts homing procedure. c. The system does not conduct the homing procedure after the E-gear ratio is modified by using [ID151 (P1.044) GearRatioFollowerCountsN1 and ID152 (P1.045) GearRatioMasterCounts] . d. Returning to the original point is triggered while the homing procedure is not complete. e. A 060 or A 062 or A 065 or A 06A occur."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Conduct homing procedure.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 235); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 237",
        "title": "Indexing mode cannot start",
        "symptom": "Drive display shows E 237 (Indexing mode cannot start); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Homing is not defined."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Define a homing function.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 237); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 245",
        "title": "Motion Wait Event Timeout",
        "symptom": "Drive display shows E 245 (Motion Wait Event Timeout); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. The needed signal was not received when a specific motion event was executed.",
        "causes": [
          "The motion event could not be completed due to a missing signal."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 245); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 249",
        "title": "The number of PR commands exceeds the range",
        "symptom": "Drive display shows E 249 (The number of PR commands exceeds the range); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. 1. The range of PR command must be between 0 and 99.",
        "causes": [
          "1. The range of PR command must be between 0 and 99."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Clear the fault.",
          "Re-adjust the PR commands and parameters within the limits.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 249); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 283",
        "title": "Software positive limit",
        "symptom": "Drive display shows A 283 (Software positive limit); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red. Software positive limit activated.",
        "causes": [
          "Software positive limit is reached."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Clear the fault.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 283); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 285",
        "title": "Software negative limit",
        "symptom": "Drive display shows A 285 (Software negative limit); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red. Software negative limit activated.",
        "causes": [
          "Software negative limit is reached."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Clear the fault.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 285); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 289",
        "title": "Feedback position [PUU] counter overflow",
        "symptom": "Drive display shows A 289 (Feedback position [PUU] counter overflow); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "Feedback position [PUU] counter overflowed."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check Gear Ratio settings."
        ],
        "fix": [
          "Clear the fault.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 289); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 35F",
        "title": "Emergency stop during deceleration",
        "symptom": "Drive display shows A 35F (Emergency stop during deceleration); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "An emergency stop was triggered on the rising-edge of DI:PFQS [0x47], then the motor decelerated to 0 and triggered an E 3CF fault."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the parameter settings caused DI:PRQS [0x47] to be triggered by mistake."
        ],
        "fix": [
          "Cycle control power.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 35F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 3CF",
        "title": "Emergency stop",
        "symptom": "Drive display shows E 3CF (Emergency stop); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "An A 35F Emergency stop during deceleration warning occurred and the motor has decelerated to 0."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if the parameter settings caused DI:PRQS [0x47] to be triggered by mistake."
        ],
        "fix": [
          "Cycle control power.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 3CF); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 380",
        "title": "Position deviation fault of DO:MC_OK",
        "symptom": "Drive display shows A 380 (Position deviation fault of DO:MC_OK); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red. See the description of parameter ID155 (P1.048) ToSpeedAction.",
        "causes": [
          "After DO.MC_OK turns ON, then DO.TPOS turns OFF causing the deviation fault.",
          "Deviation was caused by the external force after position completed."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "See the description of parameter ID155 (P1.048) ToSpeedAction.",
          "Clear the fault by using the DI.ARST command or set ID101 (P0.001) FltWarnCode to 0.",
          "Clear the fault by using the DI.ARST signal.",
          "Set ID155.Y (P1.048.Y) to 0.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 380); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 400",
        "title": "ID234 (P2.052) value incorrect",
        "symptom": "Drive display shows E 400 (ID234 (P2.052) value incorrect); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "The value of ID 234 (P2.052) IndexingCoordinatesScale is too small."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Adjust the value of ID 234 (P2.052) IndexingCoordinatesScale so that it is greater than 1.05 x [ID8 (PM.032) MotorMaxSpeed] rpm x [ID600 (PM.004) EncoderResolution/60000 (0.1)rpm] x [ID152 (P1.045) GearRatioMasterCounts /ID151 (P1.044) GearRatioFollowerCountsN1]",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 400); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 422",
        "title": "EEPROM write fail on power off",
        "symptom": "Drive display shows E 422 (EEPROM write fail on power off); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "EEPROM damaged."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Replace the drive.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 422); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 425",
        "title": "Control voltage phase difference",
        "symptom": "Drive display shows E 425 (Control voltage phase difference); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Input voltage is not within AC 50…60 Hz."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the control input voltage supply."
        ],
        "fix": [
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 425); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 500",
        "title": "STO enabled",
        "symptom": "Drive display shows E 500 (STO enabled); Major Recoverable Fault; servo turns OFF; MOD LED flashing red. The safe torque off function (STO) is enabled.",
        "causes": [
          "STO is enabled."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check if STO is activated.",
          "Check STO wiring."
        ],
        "fix": [
          "If STO is not used, check bypass wiring.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 500); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 501",
        "title": "STO_A signal loss",
        "symptom": "Drive display shows E 501 (STO_A signal loss); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "STO_A signal is OFF and is not synchronized with STO_B for more than 1 second."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check STO_A wiring."
        ],
        "fix": [
          "Correct STO_A wiring.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 501); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 502",
        "title": "STO_B signal loss",
        "symptom": "Drive display shows E 502 (STO_B signal loss); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "STO_B signal is OFF and is not synchronized with STO_A for more than 1 second."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check STO_B wiring."
        ],
        "fix": [
          "Correct STO_B wiring.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 502); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 503",
        "title": "STO self-diagnostic error",
        "symptom": "Drive display shows E 503 (STO self-diagnostic error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. An error occured during STO self-diagnosis.",
        "causes": [
          "Incorrect wiring."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Correct the wiring by following the information in the user manual.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 503); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 510",
        "title": "Low speed of DSP processing data",
        "symptom": "Drive display shows A 510 (Low speed of DSP processing data); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          ""
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 510); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 555",
        "title": "Malfunction of the system",
        "symptom": "Drive display shows E 555 (Malfunction of the system); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "A DSP processing error occurred."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 555); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 600",
        "title": "Boot failure",
        "symptom": "Drive display shows E 600 (Boot failure); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Wrong drive firmware or hardware damaged: • FPGA DSP initial error • EEPROM error • DSP memory error • EEPROM FAT error • Critical parameter error • DI/DO default setting error"
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Cycle power.",
          "Update the firmware.",
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 600); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 601",
        "title": "Duplicate IP address",
        "symptom": "Drive display shows E 601 (Duplicate IP address); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. The IP address is already in use. Cause: 1. Incorrect IP address setting.",
        "causes": [
          "The IP address is already in use. Cause: 1. Incorrect IP address setting."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Set an IP address that is not already in use on the network.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 601); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 602",
        "title": "Control connection loss fault",
        "symptom": "Drive display shows E 602 (Control connection loss fault); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Communication with the controller has been lost.",
        "causes": [
          "Faulty Ethernet cable.",
          "Ethernet cable disconnected.",
          "The controller lost power."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check Ethernet cable.",
          "Check Ethernet cable connection.",
          "Check controller operation."
        ],
        "fix": [
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 602); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 603",
        "title": "Invalid I/O command data warning",
        "symptom": "Drive display shows A 603 (Invalid I/O command data warning); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "The user input invalid command data during I/O mode, so the controller sent an invalid I/O command."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Send a valid I/O command.",
          "Cycle control power.",
          "Clear the fault.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 603); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 604",
        "title": "Watchdog fault",
        "symptom": "Drive display shows E 604 (Watchdog fault); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. The processor failed to update within the time limit.",
        "causes": [
          "Incorrect drive firmware or damage to the hardware."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Cycle control power.",
          "Update drive firmware.",
          "If the condition persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 604); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 605",
        "title": "Internal communication warning",
        "symptom": "Drive display shows A 605 (Internal communication warning); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "Drive internal communication has an error."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Re-send the previous command.",
          "Cycle control power.",
          "If the condition persists, contact your distributor or Rockwell Automation representative.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 605); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "A 606",
        "title": "Sensor not assigned fault",
        "symptom": "Drive display shows A 606 (Sensor not assigned fault); Minor Recoverable Fault (Warning); servo stays ON; MOD LED flashing red.",
        "causes": [
          "Homing was attempted without a sensor assigned."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Assign a sensor to a digital input to clear the fault automatically.",
          "Warning (A nnn): clears automatically when the cause is corrected (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', A 606); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 607",
        "title": "Internal communication fault",
        "symptom": "Drive display shows E 607 (Internal communication fault); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "An error in internal communication occurred multiple times."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Cycle control power.",
          "If the condition persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 607); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 60A",
        "title": "Catalog number match error",
        "symptom": "Drive display shows E 60A (Catalog number match error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Catalog number setting is incorrect."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Correct catalog number setting.",
          "If the condition persists, replace the motor.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 60A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 60B",
        "title": "Motor selection match error",
        "symptom": "Drive display shows E 60B (Motor selection match error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Motor Selection setting is incorrect.",
          "Issue with 3rd party sin/cos encoder wiring"
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Correct motor selection setting.",
          "If the condition persists, replace the motor.",
          "Correct encoder wiring issue.",
          "If the condition persists, replace motor.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 60B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 60C",
        "title": "Internal fault",
        "symptom": "Drive display shows E 60C (Internal fault); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Drive entered an infinite loop due to an internal unknown fault."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Cycle control power.",
          "If the condition persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 60C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 60E",
        "title": "Position overflow",
        "symptom": "Drive display shows E 60E (Position overflow); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          "Feedback position counter (PUU) overflowed and executed the absolute move command."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "Perform the homing procedure.",
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 60E); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 611",
        "title": "Feedback serial comms",
        "symptom": "Drive display shows E 611 (Feedback serial comms); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Communication was not established with an intelligent encoder.",
        "causes": [
          "Incorrect motor selected.",
          "Motor encoder wiring is incorrect.",
          "Motor vibration is affecting communication."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Verify motor selection.",
          "Verify that motor supports automatic identification.",
          "Check the motor encoder wiring.",
          "Check the feedback shield connection."
        ],
        "fix": [
          "Reduce shock and vibration to the motor.",
          "Replace the motor or encoder.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 611); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 612",
        "title": "Feedback filter",
        "symptom": "Drive display shows E 612 (Feedback filter); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Excessive levels of noise have been detected by the digital feedback filter.",
        "causes": [
          "The motor feedback wiring is open, shorted, or missing."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check system grounding."
        ],
        "fix": [
          "Use shielded, twisted-pair cables.",
          "Route feedback away from potential noise sources.",
          "Replace the motor or encoder.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 612); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 613",
        "title": "AUX Feedback Filter",
        "symptom": "Drive display shows E 613 (AUX Feedback Filter); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Excessive levels of noise have been detected by the digital feedback filter.",
        "causes": [
          "The aux feedback wiring is open, shorted, or missing."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check system grounding."
        ],
        "fix": [
          "Use shielded, twisted-pair cables.",
          "Route feedback away from potential noise sources.",
          "Replace the motor or encoder.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 613); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 615",
        "title": "Motor data range error",
        "symptom": "Drive display shows E 615 (Motor data range error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red. Data within a motor data blob is out of range.",
        "causes": [
          "Faulty intelligent encoder or incorrect motor file."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check the validity of the motion database."
        ],
        "fix": [
          "Cycle power or reset the drive.",
          "If the issue persists, replace the motor.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 615); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 619",
        "title": "MP motor overspeed on power on",
        "symptom": "Drive display shows E 619 (MP motor overspeed on power on); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "Drive is powered on when motor speed is over 8000 rpm."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Verify that motor speed is less than 8000 rpm before drive is power on."
        ],
        "fix": [
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 619); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 61A",
        "title": "Z phase lost protect",
        "symptom": "Drive display shows E 61A (Z phase lost protect); Major Recoverable Fault; servo turns OFF; MOD LED flashing red.",
        "causes": [
          ""
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check Motor Z phase signal.",
          "Check Homing method."
        ],
        "fix": [
          "Major recoverable fault: clear with DI.ARST input, Reset Module in Logix Designer, Fault Reset in KNX5100C, ID101 (P0.001) FltWarnCode = 0, or the raC_xxx_K5100_MAFR AOI (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 61A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E 809",
        "title": "PR arithmetic operation parameter error or secondary platform error",
        "symptom": "Drive display shows E 809 (PR arithmetic operation parameter error or secondary platform error); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "A DSP processing error occurred."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452)."
        ],
        "fix": [
          "If the issue persists, contact your distributor or Rockwell Automation representative.",
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E 809); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "code": "E D10",
        "title": "Incremental position loss",
        "symptom": "Drive display shows E D10 (Incremental position loss); Major Unrecoverable Fault; servo turns OFF; MOD LED steady red.",
        "causes": [
          "The motor feedback wiring is open, shorted, or missing."
        ],
        "confirm": [
          "Read the code on the drive display (fault shows E followed by the code, warning shows A) and the fault record ID274 (P4.000) FaultRecordN, or Fault Information in KNX5100C (UM004 p.118, p.127, p.452).",
          "Check motor and encoder wiring."
        ],
        "fix": [
          "Major unrecoverable fault: cycle power to clear; if the issue persists, contact Rockwell Automation (UM004 p.454 Clear Faults)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (2198-RD001 Kinetix 5100 Fault Codes, sheet 'Kinetix 5100', E D10); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, ch.16 p.449-454)"
      },
      {
        "title": "Axis or system is unstable",
        "symptom": "Axis or system is unstable (oscillates, erratic movement).",
        "causes": [
          "Position feedback device incorrect or open",
          "Unintentionally in torque mode",
          "Motor tuning limits set too high",
          "Position loop gain or position controller accel/decel rate improperly set",
          "Improper grounding or shielding transmitting noise into feedback or velocity command lines",
          "Motor select limit incorrectly set (motor not matched to axis module)",
          "Mechanical resonance"
        ],
        "confirm": [
          "Check the drive display for a fault code first (E nnn / A nnn); these conditions do not always produce a code (UM004 p.455).",
          "Check motor power wiring U, V, W and the motor feedback (MFB) connector wiring."
        ],
        "fix": [
          "Check wiring.",
          "Check which primary operation mode was programmed.",
          "Run Tune by using KNX5100C software or the LED panel (Tuning Process p.200).",
          "Check wiring and ground.",
          "Notch filter or output filter can be required."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, Table 144 General Troubleshooting, p.455-456)"
      },
      {
        "title": "Motor does not respond to a command",
        "symptom": "Motor does not respond to a command.",
        "causes": [
          "Motor wiring is open",
          "Motor cable shield connection is improper",
          "Motor has malfunctioned",
          "Coupling between motor and machine has broken",
          "Primary operation mode set incorrectly",
          "Velocity or torque limits set incorrectly",
          "Brake connector not wired",
          "The axis cannot be enabled until stopping time has expired"
        ],
        "confirm": [
          "Check the drive display for a fault code first (E nnn / A nnn); these conditions do not always produce a code (UM004 p.455).",
          "Check motor power wiring U, V, W and the motor feedback (MFB) connector wiring."
        ],
        "fix": [
          "Check the wiring; check feedback and cable shield connections.",
          "Repair or replace the motor.",
          "Check and correct the mechanics.",
          "Check and properly set the limits.",
          "Check the brake wiring.",
          "Disable the axis, wait for 1.5 seconds, and then enable the axis."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, Table 144 General Troubleshooting, p.455-456)"
      },
      {
        "title": "No rotation",
        "symptom": "Motor shaft does not rotate.",
        "causes": [
          "Motor connections loose or open",
          "Foreign matter lodged in the motor",
          "Motor load excessive",
          "Bearings worn",
          "Motor brake engaged (if supplied)",
          "Motor not connected to the load"
        ],
        "confirm": [
          "Check the drive display for a fault code first (E nnn / A nnn); these conditions do not always produce a code (UM004 p.455).",
          "Check motor power wiring U, V, W and the motor feedback (MFB) connector wiring."
        ],
        "fix": [
          "Check motor wiring and connections.",
          "Remove foreign matter.",
          "Verify the servo system sizing.",
          "Check brake wiring and function; return the motor for repair if needed.",
          "Check the coupling."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, Table 144 General Troubleshooting, p.455-456)"
      },
      {
        "title": "Erratic operation, motor locks into position or runs without control",
        "symptom": "Motor locks into position, runs without control, or with reduced torque.",
        "causes": [
          "Motor power phases U and V, U and W, or V and W reversed"
        ],
        "confirm": [
          "Check the drive display for a fault code first (E nnn / A nnn); these conditions do not always produce a code (UM004 p.455).",
          "Check motor power wiring U, V, W and the motor feedback (MFB) connector wiring."
        ],
        "fix": [
          "Check and correct motor power wiring."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, Table 144 General Troubleshooting, p.455-456)"
      },
      {
        "title": "Motor overheating",
        "symptom": "Motor overheating.",
        "causes": [
          "Duty cycle excessive",
          "Rotor partially demagnetized causing excessive motor current",
          "Motor tuning limits set too high"
        ],
        "confirm": [
          "Check the drive display for a fault code first (E nnn / A nnn); these conditions do not always produce a code (UM004 p.455).",
          "Check motor power wiring U, V, W and the motor feedback (MFB) connector wiring."
        ],
        "fix": [
          "Change the command profile to reduce acceleration/deceleration, or increase time.",
          "Return the motor for repair.",
          "Run Tune by using KNX5100C software or the LED panel."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (2198-UM004D, Table 144 General Troubleshooting, p.455-456)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2198-um004_-en-p.pdf (Kinetix 5100 EtherNet/IP Indexing Servo Drives User Manual 2198-UM004D-EN-P, Dec 2022: p.28, p.50-72, p.118-127, p.410-418, p.449-456)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/2198-rd001_-en-p.xlsx (Kinetix 5100 Servo Drive Fault Codes Reference Data 2198-RD001, sheet Kinetix 5100)"
    ]
  },
  {
    "id": "sinamics-v90-pti-400v-servo-drive",
    "title": "Siemens SINAMICS V90 pulse train (PTI) servo drive, 400 V variant (6SL3210-5FE…-…UA0)",
    "match": {
      "categories": [
        "servoDrive"
      ],
      "family": "SINAMICS V90",
      "partNumber": "^6SL3210-5FE.*UA\\d$"
    },
    "normal": [
      {
        "terminals": "L1, L2, L3 (line supply)",
        "state": "power applied",
        "meter": "VAC",
        "expected": "3-phase 380 VAC to 480 VAC, 50/60 Hz, -15% to +10%",
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
        "note": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf p.37 Technical data - servo drives"
      },
      {
        "terminals": "+24 V to M (X6 24 V power supply)",
        "state": "control power applied",
        "meter": "VDC",
        "expected": "24 VDC, -15% to +20% without brake; -10% to +10% with brake; max 1.6 A without / 3.6 A with brake power",
        "pins": [
          [
            "+24V",
            "M"
          ]
        ],
        "note": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf p.37, p.92 (X6 pin assignment)"
      },
      {
        "terminals": "B+ to B- (X7 motor holding brake, drive side)",
        "state": "brake supply",
        "meter": "VDC",
        "expected": "24 V ± 10% input voltage tolerance",
        "pins": [
          [
            "B+",
            "B-"
          ]
        ],
        "note": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf p.97 Motor holding brake - X7"
      },
      {
        "terminals": "STO 1 / STO 2 (X6)",
        "state": "run permitted",
        "meter": "visual",
        "expected": "STO1 and STO2 both high level: motor can run. Factory setting: STO1, STO+ and STO2 short-connected by a jumper; both low: drive starts but motor cannot run; one high one low: alarm and motor coasts down",
        "note": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf p.92, p.194-195 Behaviors of the STO function"
      },
      {
        "terminals": "X8-13 (DI9, EMGS)",
        "state": "ready to run",
        "meter": "visual",
        "expected": "EMGS = 1 (high); DI9 is permanently assigned to EMGS",
        "note": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf p.60, p.134"
      },
      {
        "terminals": "X8-7 / X8-8 (DI3 CWL, DI4 CCWL, factory setting)",
        "state": "normal operation",
        "meter": "visual",
        "expected": "1 = condition for operation; 1→0 = emergency stop (OFF3)",
        "note": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf p.61-62"
      }
    ],
    "indicators": [
      {
        "name": "RDY",
        "state": "off",
        "meaning": "24 V control board power supply is missing"
      },
      {
        "name": "RDY",
        "state": "green, continuously lit",
        "meaning": "Drive in servo on state"
      },
      {
        "name": "RDY",
        "state": "red, continuously lit",
        "meaning": "Drive in servo off state or startup state"
      },
      {
        "name": "RDY",
        "state": "red, flashing 1 Hz",
        "meaning": "Alarm or fault present"
      },
      {
        "name": "RDY",
        "state": "red and orange alternating every 0.5 s",
        "meaning": "Servo drive is being located (identification)"
      },
      {
        "name": "COM",
        "state": "off",
        "meaning": "Communication with PC not active"
      },
      {
        "name": "COM",
        "state": "green, flashing 0.5 Hz",
        "meaning": "Communication with PC active"
      },
      {
        "name": "COM",
        "state": "green, flashing 2 Hz",
        "meaning": "SD card operating (read or write)"
      },
      {
        "name": "COM",
        "state": "red, continuously lit",
        "meaning": "Communication with PC in error"
      },
      {
        "name": "BOP display",
        "state": "shows Fxxxx",
        "meaning": "Fault (needs acknowledgement); faults are displayed before alarms"
      },
      {
        "name": "BOP display",
        "state": "shows Axxxx",
        "meaning": "Alarm (self-acknowledging)"
      }
    ],
    "faults": [
      {
        "code": "F1000",
        "title": "Internal software error",
        "symptom": "BOP shows F1000 (Internal software error); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "An internal software error has occurred."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Evaluate fault buffer."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade firmware to later version.",
          "Contact the Hotline.",
          "Replace the Control Unit.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.255, F1000)"
      },
      {
        "code": "F1001",
        "title": "FloatingPoint exception",
        "symptom": "BOP shows F1001 (FloatingPoint exception); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "An exception occurred during an operation with the FloatingPoint data type."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade firmware to the latest version.",
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.255, F1001)"
      },
      {
        "code": "F1002",
        "title": "Internal software error",
        "symptom": "BOP shows F1002 (Internal software error); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "An internal software error has occurred."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade firmware to the latest version.",
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.255, F1002)"
      },
      {
        "code": "F1003",
        "title": "Acknowledgement delay when accessing the memory",
        "symptom": "BOP shows F1003 (Acknowledgement delay when accessing the memory); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "A memory area was accessed that does not return a \"READY\"."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on).",
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.255, F1003)"
      },
      {
        "code": "F1015",
        "title": "Internal software error",
        "symptom": "BOP shows F1015 (Internal software error); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "An internal software error has occurred."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade firmware to the latest version.",
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.255, F1015)"
      },
      {
        "code": "F1018",
        "title": "Booting has been interrupted several times",
        "symptom": "BOP shows F1018 (Booting has been interrupted several times); RDY LED flashes red at 1 Hz; reaction NONE; acknowledgement POWER ON.",
        "causes": [
          "Module booting was interrupted several times. As a consequence, the module boots with the factory setting. Possible reasons for booting being interrupted:",
          "Power supply interrupted.",
          "CPU crashed.",
          "Parameterization invalid. After this fault is output, then the module is booted with the factory settings."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on). After switching on, the module reboots from the valid parameterization (if available).",
          "Restore the valid parameterization Examples:",
          "Carry out a first commissioning, save, carry out a POWER ON (switch-off/switch-on).",
          "Load another valid parameter backup (e.g. from the memory card), save, carry out a POWER ON (switch-off/switch-on). Note: If the fault situation is repeated, then this fault is again output after several interrupted boots.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.255, F1018)"
      },
      {
        "code": "F1030",
        "title": "Sign-of-life failure for master control",
        "symptom": "BOP shows F1030 (Sign-of-life failure for master control); RDY LED flashes red at 1 Hz; reaction OFF3; acknowledgement IMMEDIATELY.",
        "causes": [
          "For active PC master control, no sign-oflife was received within the monitoring time."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.256, F1030)"
      },
      {
        "code": "F1611",
        "title": "SI CU: Defect detected",
        "symptom": "BOP shows F1611 (SI CU: Defect detected); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The drive-integrated \"Safety Integrated\" (SI) function on the Control Unit (CU) has detected an error and initiated an STO"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade software.",
          "Replace the Control Unit.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.256, F1611)"
      },
      {
        "code": "F7011",
        "title": "Motor overtemperature",
        "symptom": "BOP shows F7011 (Motor overtemperature); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "Motor overloaded",
          "Motor surrounding temperature too high",
          "Wire breakage or sensor not connected",
          "Motor temperature model incorrectly parameterized"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the surrounding temperature and the motor ventilation.",
          "Check the wiring and the connection.",
          "Check the motor temperature model parameters."
        ],
        "fix": [
          "Reduce the motor load.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.256, F7011)"
      },
      {
        "code": "F7085",
        "title": "Open-loop/closedloop control parameters changed",
        "symptom": "BOP shows F7085 (Open-loop/closedloop control parameters changed); RDY LED flashes red at 1 Hz; reaction NONE; acknowledgement IMMEDIATELY.",
        "causes": [
          "Open-loop/closed-loop control parameters have had to be changed for the following reasons:",
          "As a result of other parameters, they have exceeded the dynamic limits.",
          "They cannot be used due to the fact that the hardware detected not having certain features."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "It is not necessary to change the parameters as they have already been correctly limited.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.256, F7085)"
      },
      {
        "code": "F7403",
        "title": "Lower DC link voltage threshold reached",
        "symptom": "BOP shows F7403 (Lower DC link voltage threshold reached); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The DC link voltage monitoring is active and the lower DC link voltage threshold was reached in the \"Operation\" state."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the line supply voltage.",
          "Check the infeed."
        ],
        "fix": [
          "Reduce the lower DC link threshold.",
          "Switch out (disable) the DC link voltage monitoring.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.256, F7403)"
      },
      {
        "code": "F7404",
        "title": "Upper DC link voltage threshold reached",
        "symptom": "BOP shows F7404 (Upper DC link voltage threshold reached); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The DC link voltage monitoring is active and the upper DC link voltage threshold was reached in the \"Operation\" state."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the line supply voltage.",
          "Check the infeed module or the brake module."
        ],
        "fix": [
          "Increase the upper DC link voltage threshold.",
          "Switch out (disable) the DC link voltage monitoring.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.256, F7404)"
      },
      {
        "code": "F7410",
        "title": "Current controller output limited",
        "symptom": "BOP shows F7410 (Current controller output limited); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The condition \"I_act = 0 and Uq_set_1 longer than 16 ms at its limit\" is present and can be caused by the following:",
          "Motor not connected or motor contactor open.",
          "No DC link voltage present.",
          "Motor Module defective."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the DC link voltage.",
          "Check the Motor Module."
        ],
        "fix": [
          "Connect the motor or check the motor contactor.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.256, F7410)"
      },
      {
        "code": "F7412",
        "title": "Commutation angle incorrect (motor model)",
        "symptom": "BOP shows F7412 (Commutation angle incorrect (motor model)); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement IMMEDIATELY.",
        "causes": [
          "An incorrect commutation angle was detected that can result in a positive coupling in the speed controller. Possible causes:",
          "The motor encoder is incorrectly adjusted with respect to the magnet position.",
          "The motor encoder is damaged.",
          "Data to calculate the motor model has been incorrectly set.",
          "Pole position identification might have calculated an incorrect value when activated.",
          "The motor encoder speed signal is faulted.",
          "The control loop is instable due to incorrect parameterization."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "If the encoder mounting was changed, readjust the encoder.",
          "Replace the defective motor encoder.",
          "Correctly set the motor stator resistance, cable resistance and motor-stator leakage inductance. Calculate the cable resistance from the cross-section and length, check the inductance and stator resistance using the motor data sheet, measure the stator resistance, e.g. using a multimeter - and if required, again identify the values using the stationary motor data identification.",
          "With pole position identification activated, check the procedure for pole position identification and force a new pole position identification procedure by means of de-selection followed by selection.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.257, F7412)"
      },
      {
        "code": "F7430",
        "title": "Changeover to openloop torque controlled operation not possible",
        "symptom": "BOP shows F7430 (Changeover to openloop torque controlled operation not possible); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "For encoderless operation, the converter cannot change over to closed-loop torquecontrolled operation."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder cable connection."
        ],
        "fix": [
          "Do not attempt to change over to closed-loop torque-controlled operation.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.257, F7430)"
      },
      {
        "code": "F7431",
        "title": "Changeover to encoderless operation not possible",
        "symptom": "BOP shows F7431 (Changeover to encoderless operation not possible); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "For closed-loop torque control, the converter cannot change over to encoderless operation."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder cable connection."
        ],
        "fix": [
          "Do not attempt to change over to encoderless operation.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.257, F7431)"
      },
      {
        "code": "F7442",
        "title": "LR: Multiturn does not match the modulo range Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7442 (LR: Multiturn does not match the modulo range Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "The ratio between the multiturn resolution and the modulo range (p29246) is not an integer number. This results in the adjustment being set back, as the position actual value cannot be reproduced after power-off/power-on."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Make the ration between the multiturn resolution and the modulo range an integer number. The ratio v is calculated as follows: v = (4096 * p29247 * p29248) / (p29249 * p29246)",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.257, F7442)"
      },
      {
        "code": "F7443",
        "title": "Reference point coordinate not in the permissible range Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7443 (Reference point coordinate not in the permissible range Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "The reference point coordinate received when adjusting the encoder via connector input p2599 lies outside the half of the encoder range and cannot be set as actual axis position."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Set the reference point coordinate to a lower value than specified in the fault value. See also: p2599 (EPOS reference point coordinate value. For a motor with an absolute encoder, the maximum permissible encoder range is calculated by the formula (4096xp29247)/2.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.257, F7443)"
      },
      {
        "code": "F7450",
        "title": "Standstill monitoring has responded",
        "symptom": "BOP shows F7450 (Standstill monitoring has responded); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "After the standstill monitoring time expired, the drive left the standstill window.",
          "Position loop gain too low.",
          "Position loop gain too high (instability/oscillation).",
          "Mechanical overload.",
          "Connecting cable, motor/drive converter incorrect (phase missing, interchange)."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the causes and resolve."
        ],
        "fix": [
          "Check the causes and resolve.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.258, F7450)"
      },
      {
        "code": "F7452",
        "title": "Following error too high",
        "symptom": "BOP shows F7452 (Following error too high); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The difference between the position setpoint and position actual value (following error dynamic model) is greater than the tolerance (p2546).",
          "The value of p2546 is too small.",
          "The gain of position loop is too small.",
          "The drive torque or accelerating capacity exceeded.",
          "Position measuring system fault.",
          "Position control sense incorrect.",
          "Mechanical system locked.",
          "Excessively high traversing velocity or excessively high position reference value (setpoint) differences."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the causes and resolve."
        ],
        "fix": [
          "Check the causes and resolve.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.258, F7452)"
      },
      {
        "code": "F7453",
        "title": "Position actual value preprocessing error",
        "symptom": "BOP shows F7453 (Position actual value preprocessing error); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "An error has occurred during the position actual value preprocessing."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder for the position actual value preprocessing."
        ],
        "fix": [
          "Check the encoder for the position actual value preprocessing.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.258, F7453)"
      },
      {
        "code": "F7458",
        "title": "EPOS: Reference cam not found Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7458 (EPOS: Reference cam not found Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "After starting the search for reference, the axis moved through the maximum permissible distance to seach for the reference cam without actually finding the reference cam."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the \"reference cam\" input.",
          "Check the maximum permissible distance to the reference cam (p2606). See also: p2606 (EPOS search for reference reference cam maximum distance)"
        ],
        "fix": [
          "Check the \"reference cam\" input.",
          "Check the maximum permissible distance to the reference cam (p2606). See also: p2606 (EPOS search for reference reference cam maximum distance)",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.258, F7458)"
      },
      {
        "code": "F7459",
        "title": "Zero mark not detected",
        "symptom": "BOP shows F7459 (Zero mark not detected); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "After leaving the reference cam, the axis has traversed the maximum permissible distance (p2609) between the reference cam and the zero mark without finding the zero mark."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder regarding zero mark.",
          "Check the maximum permissible distance between the reference cam and zero mark (p2609)."
        ],
        "fix": [
          "Use an external encoder zero mark (equivalent zero mark).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.258, F7459)"
      },
      {
        "code": "F7460",
        "title": "EPOS: End of reference cam not found Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7460 (EPOS: End of reference cam not found Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "During the search for reference, when the axis reached the zero mark it also reached the end of the traversing range without detecting an edge at the binector input \"reference cam\". Maximum traversing range: -2147483648 [LU] ... -2147483647 [LU]"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the \"reference cam\" input."
        ],
        "fix": [
          "Repeat the search for reference.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.259, F7460)"
      },
      {
        "code": "F7475",
        "title": "EPOS: Target position < start of traversing range Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7475 (EPOS: Target position < start of traversing range Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "The target position for relative traversing lies outside the traversing range."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the target position.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.259, F7475)"
      },
      {
        "code": "F7476",
        "title": "EPOS: Target position > end of the traversing range Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7476 (EPOS: Target position > end of the traversing range Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "The target position for relative traversing lies outside the traversing range."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the target position.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.259, F7476)"
      },
      {
        "code": "F7481",
        "title": "EPOS: Axis position < software limit switch minus Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7481 (EPOS: Axis position < software limit switch minus Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "The actual position of the axis is less than the position of the software limit switch minus."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the target position.",
          "Change software limit switch minus (CI: p2580).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.259, F7481)"
      },
      {
        "code": "F7482",
        "title": "EPOS: Axis position > software limit switch plus Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7482 (EPOS: Axis position > software limit switch plus Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "The actual position of the axis is greater than the position of the software limit switch plus."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the target position.",
          "Change software limit switch plus (CI: p2581).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.259, F7482)"
      },
      {
        "code": "F7490",
        "title": "Enable signal withdrawn while traversing",
        "symptom": "BOP shows F7490 (Enable signal withdrawn while traversing); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "For a standard assignment, another fault may have occurred as a result of withdrawing the enable signals.",
          "The drive is in the \"switching on inhibited\" state (for a standard assignment)."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the assignment to enable the basic positioning function."
        ],
        "fix": [
          "Set the enable signals or check the cause of the fault that first occurred and then result (for a standard assignment).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.259, F7490)"
      },
      {
        "code": "F7491",
        "title": "STOP cam minus reached",
        "symptom": "BOP shows F7491 (STOP cam minus reached); RDY LED flashes red at 1 Hz; reaction OFF3; acknowledgement IMMEDIATELY.",
        "causes": [
          "The STOP cam minus was reached. For a positive traversing direction, the STOP cam minus was reached, i.e. the wiring of the STOP cam is incorrect."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the wiring of the STOP cam."
        ],
        "fix": [
          "Leave the STOP cam minus in the positive traversing direction and return the axis to the valid traversing range.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.259, F7491)"
      },
      {
        "code": "F7492",
        "title": "STOP cam plus reached",
        "symptom": "BOP shows F7492 (STOP cam plus reached); RDY LED flashes red at 1 Hz; reaction OFF3; acknowledgement IMMEDIATELY.",
        "causes": [
          "The STOP cam plus was reached. For a negative traversing direction, the STOP cam plus was reached, i.e. the wiring of the STOP cam is incorrect."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the wiring of the STOP cam."
        ],
        "fix": [
          "Leave the STOP cam plus in the negative traversing direction and return the axis to the valid traversing range.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.259, F7492)"
      },
      {
        "code": "F7493",
        "title": "LR: Overflow of the value range for position actual value Reaction: OFF1 (OFF2, OFF3)",
        "symptom": "BOP shows F7493 (LR: Overflow of the value range for position actual value Reaction: OFF1 (OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY.",
        "causes": [
          "The value range (-2147483648 ... 2147483647) for the position actual value representation was exceeded. When the overflow occurs, the \"referenced\" or \"adjustment absolute measuring system\" status is reset.",
          "The position actual value (r2521) has exceeded the value range.",
          "The encoder position actual value has",
          "exceeded the value range.",
          "The maximum encoder value times the factor to convert the absolute position from increments to length units (LU) has exceeded the value range for displaying the position actual value."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "If required, reduce the traversing range or position resolution p29247. Note for case = 3: If the value for the maximum possible absolute position (LU) is greater than 4294967296, then it is not possible to make an adjustment due to an overflow. For rotary encoders, the maximum possible absolute position (LU) is calculated as follows: Motor encoder without position tracking:",
          "IPOS: p29247 * p29248 * 4096 / p29249 for multiturn encoders",
          "PTI: 1048576 * p29012[X] * 4096 / p29013 for multiturn encoders",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.260, F7493)"
      },
      {
        "code": "F7599",
        "title": "Encoder 1: Adjustment not possible Reaction: OFF1 (NONE, OFF2, OFF3)",
        "symptom": "BOP shows F7599 (Encoder 1: Adjustment not possible Reaction: OFF1 (NONE, OFF2, OFF3)); RDY LED flashes red at 1 Hz; acknowledgement IMMEDIATELY F7800 Drive: No power unit present Reaction: NONE Acknowledgement: IMMEDIATELY.",
        "causes": [
          "The maximum encoder value times the factor to convert the absolute position from increments to length units (LU) has exceeded the value range (-2147483648 ... 2147483647) for displaying the position actual value. The power unit parameters cannot be read or no parameters are stored in the power unit."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "If the value for the maximum possible absolute position (LU) is greater than 4294967296, then it is not possible to make an adjustment due to an overflow. For rotary encoders, the maximum possible absolute position (LU) is calculated as follows: Motor encoder without position tracking:",
          "IPOS: p29247 * p29248 * 4096 / p29249 for multiturn encoders",
          "PTI: 1048576 * p29012[X] * 4096 / p29013 for multiturn encoders",
          "Carry out a POWER ON (power off/on) for all components.",
          "Change the module.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.260, F7599)"
      },
      {
        "code": "F7801",
        "title": "Motor overcurrent",
        "symptom": "BOP shows F7801 (Motor overcurrent); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The permissible motor limit current was exceeded.",
          "Effective current limit set too low.",
          "Current controller not correctly set.",
          "Motor was braked with an excessively high stall torque correction factor.",
          "Up ramp was set too short or the load is too high.",
          "Short-circuit in the motor cable or ground fault.",
          "Motor current does not match the current of Motor Module."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the motor and motor cables for short-circuit and ground fault.",
          "Check the Motor Module and motor combination."
        ],
        "fix": [
          "Reduce the stall torque correction factor.",
          "Increase the up ramp or reduce the load.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.260, F7801)"
      },
      {
        "code": "F7802",
        "title": "Infeed or power unit not ready",
        "symptom": "BOP shows F7802 (Infeed or power unit not ready); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "After an internal power-on command, the infeed or drive does not signal ready because of one of the following reasons:",
          "Monitoring time is too short.",
          "DC link voltage is not present.",
          "Associated infeed or drive of the signaling component is defective."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Ensure that there is a DC link voltage. Check the DC link busbar. Enable the infeed."
        ],
        "fix": [
          "Replace the associated infeed or drive of the signaling component.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.261, F7802)"
      },
      {
        "code": "F7815",
        "title": "Power unit has been changed",
        "symptom": "BOP shows F7815 (Power unit has been changed); RDY LED flashes red at 1 Hz; reaction NONE; acknowledgement IMMEDIATELY.",
        "causes": [
          "The code number of the actual power unit does not match the saved number."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Connect the original power unit and power up the Control Unit again (POWER ON).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.261, F7815)"
      },
      {
        "code": "F7900",
        "title": "Motor blocked/speed controller at its limit",
        "symptom": "BOP shows F7900 (Motor blocked/speed controller at its limit); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The servo motor has been operating at the torque limit longer than 1s and below the speed threshold of 120 rpm . This signal can also be initiated if the speed actual value is oscillating and the speed controller output repeatedly goes to its limit."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check whether the servo motor can rotate freely or not.",
          "Check the torque limit.",
          "Check the inversion of the actual value.",
          "Check the motor encoder connection.",
          "Check the encoder pulse number."
        ],
        "fix": [
          "Check whether the servo motor can rotate freely or not.",
          "Check the torque limit.",
          "Check the inversion of the actual value.",
          "Check the motor encoder connection.",
          "Check the encoder pulse number.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.261, F7900)"
      },
      {
        "code": "F7901",
        "title": "Motor overspeed",
        "symptom": "BOP shows F7901 (Motor overspeed); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The maximumly permissible speed has been exceeded."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check and correct the maximum speed (p1082). Check if there are any peaks of actual speed. If the value of the peak is especially large, contact the hotline."
        ],
        "fix": [
          "Check and correct the maximum speed (p1082). Check if there are any peaks of actual speed. If the value of the peak is especially large, contact the hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.261, F7901)"
      },
      {
        "code": "F7995",
        "title": "Motor identification failure",
        "symptom": "BOP shows F7995 (Motor identification failure); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "For incremental motor, needs pole position identification when first SON. If motor already in run (i.e. by external force) position identification may failure."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Stop motor before SON.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.261, F7995)"
      },
      {
        "code": "F30001",
        "title": "Power unit: Overcurrent",
        "symptom": "BOP shows F30001 (Power unit: Overcurrent); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit has detected an overcurrent condition.",
          "Closed-loop control is incorrectly parameterized.",
          "Controller parameters are not proper.",
          "Motor has a short-circuit or fault to ground (frame).",
          "Power cables are not correctly connected.",
          "Power cables exceed the maximum permissible length.",
          "Power unit defective.",
          "Line phase interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the motor data - if required, carry out commissioning.",
          "Check the motor circuit configuration (star-delta).",
          "Check the power cable connections.",
          "Check the power cables for short-circuit or ground fault.",
          "Check the length of the power cables.",
          "Check the line supply phases.",
          "Check the external braking resistor connection."
        ],
        "fix": [
          "Modify speed loop Kp (p29120), position loop Kv (p29110).",
          "Replace power unit.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.261, F30001)"
      },
      {
        "code": "F30002",
        "title": "DC link voltage, overvoltage",
        "symptom": "BOP shows F30002 (DC link voltage, overvoltage); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit has detected overvoltage in the DC link.",
          "Motor regenerates too much energy.",
          "Device connection voltage too high.",
          "Line phase interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the device supply voltage.",
          "Check the line supply phases."
        ],
        "fix": [
          "Increase the ramp-down time.",
          "Activate the DC link voltage controller.",
          "Use a braking resistor.",
          "Increase the current limit of the infeed or use a larger module.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.262, F30002)"
      },
      {
        "code": "F30003",
        "title": "DC link voltage, undervoltage",
        "symptom": "BOP shows F30003 (DC link voltage, undervoltage); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit has detected an undervoltage condition in the DC link.",
          "Line supply failure",
          "Line supply voltage below the permissible value.",
          "Line supply infeed failed or interrupted.",
          "Line phase interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the line supply voltage",
          "Check the line supply infeed and observe the fault messages relating to it (if there are any)",
          "Check the line supply phases.",
          "Check the line supply voltage setting."
        ],
        "fix": [
          "Check the line supply voltage",
          "Check the line supply infeed and observe the fault messages relating to it (if there are any)",
          "Check the line supply phases.",
          "Check the line supply voltage setting.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.262, F30003)"
      },
      {
        "code": "F30004",
        "title": "Drive heat sink overtemperature",
        "symptom": "BOP shows F30004 (Drive heat sink overtemperature); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The temperature of the power unit heat sink has exceeded the permissible limit value.",
          "Insufficient cooling, fan failure.",
          "Overload.",
          "Surrounding temperature too high.",
          "Pulse frequency too high."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check whether the fan is running.",
          "Check the fan elements.",
          "Check whether the surrounding temperature is in the permissible range.",
          "Check the motor load."
        ],
        "fix": [
          "Reduce the pulse frequency if this is higher than the rated pulse frequency.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.262, F30004)"
      },
      {
        "code": "F30005",
        "title": "Power unit: Overload I2t",
        "symptom": "BOP shows F30005 (Power unit: Overload I2t); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit was overloaded.",
          "The permissible rated power unit current was exceeded for an inadmissibly long time.",
          "The permissible load duty cycle was not maintained."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the motor and power unit rated currents."
        ],
        "fix": [
          "Reduce the continuous load.",
          "Adapt the load duty cycle.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.262, F30005)"
      },
      {
        "code": "F30011",
        "title": "Line phase failure in main circuit",
        "symptom": "BOP shows F30011 (Line phase failure in main circuit); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "At the power unit, the DC link voltage ripple has exceeded the permissible limit value. Possible causes:",
          "A line phase has failed.",
          "The 3 line phases are inadmissibly unsymmetrical.",
          "The fuse of a phase of a main circuit has ruptured.",
          "A motor phase has failed."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the main circuit fuses.",
          "Check whether a single-phase load is distorting the line voltages.",
          "Check the motor feeder cables."
        ],
        "fix": [
          "Check the main circuit fuses.",
          "Check whether a single-phase load is distorting the line voltages.",
          "Check the motor feeder cables.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.262, F30011)"
      },
      {
        "code": "F30015",
        "title": "Phase failure motor cable",
        "symptom": "BOP shows F30015 (Phase failure motor cable); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "A phase failure in the motor feeder cable was detected. The signal can also be output in the following case: The motor is correctly connected, however the closed-speed control is instable and therefore an oscillating torque is generated."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the motor feeder cables.",
          "Check the speed controller settings."
        ],
        "fix": [
          "Check the motor feeder cables.",
          "Check the speed controller settings.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.263, F30015)"
      },
      {
        "code": "F30021",
        "title": "Ground fault",
        "symptom": "BOP shows F30021 (Ground fault); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "Power unit has detected a ground fault.",
          "Ground fault in the power cables.",
          "Winding fault or ground fault at the motor."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the power cable connections.",
          "Check the motor."
        ],
        "fix": [
          "Check the power cable connections.",
          "Check the motor.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.263, F30021)"
      },
      {
        "code": "F30027",
        "title": "Precharging DC link time monitoring",
        "symptom": "BOP shows F30027 (Precharging DC link time monitoring); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit DC link was not able to be pre-charged within the expected time. There is no line supply voltage connected.",
          "The line contactor/line side switch has not been closed.",
          "The line supply voltage is too low.",
          "The pre-charging resistors are overheated as there were too many precharging operations per time unit",
          "The pre-charging resistors are overheated as the DC link capacitance is too high.",
          "The pre-charging resistors are overheated.",
          "The pre-charging resistors are overheated as the line contactor was closed during the DC link fast discharge through the Braking Module.",
          "The DC link has either a ground fault or a short-circuit.",
          "The pre-charging circuit is possibly defective."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the line supply voltage at the input terminals."
        ],
        "fix": [
          "Check the line supply voltage at the input terminals.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.263, F30027)"
      },
      {
        "code": "F30036",
        "title": "Internal overtemperature",
        "symptom": "BOP shows F30036 (Internal overtemperature); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The temperature inside the drive converter has exceeded the permissible temperature limit.",
          "Insufficient cooling, fan failure.",
          "Overload.",
          "Surrounding temperature too high."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check whether the fan is running.",
          "Check the fan elements.",
          "Check whether the surrounding temperature is in the permissible range. Notice: This fault can only be acknowledged once the permissible temperature limit minus 5 K has been fallen below."
        ],
        "fix": [
          "Check whether the fan is running.",
          "Check the fan elements.",
          "Check whether the surrounding temperature is in the permissible range. Notice: This fault can only be acknowledged once the permissible temperature limit minus 5 K has been fallen below.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.263, F30036)"
      },
      {
        "code": "F30050",
        "title": "24 V supply overvoltage",
        "symptom": "BOP shows F30050 (24 V supply overvoltage); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "The voltage monitor signals an overvoltage fault on the module."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the 24 V power supply."
        ],
        "fix": [
          "Replace the module if necessary.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.264, F30050)"
      },
      {
        "code": "F31100",
        "title": "Zero mark distance error",
        "symptom": "BOP shows F31100 (Zero mark distance error); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "The measured zero mark distance does not correspond to the parameterized zero mark distance. For distance-coded encoders, the zero mark distance is determined from zero marks detected pairs. This means that if a zero mark is missing, depending on the pair generation, this cannot result in a fault and also has no effect in the system."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check that the encoder cables are routed in compliance with EMC.",
          "Check the plug connections"
        ],
        "fix": [
          "Replace the encoder or encoder cable",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.264, F31100)"
      },
      {
        "code": "F31101",
        "title": "Zero mark failed",
        "symptom": "BOP shows F31101 (Zero mark failed); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "The 1.5 x parameterized zero mark distance was exceeded."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check that the encoder cables are routed in compliance with EMC.",
          "Check the plug connections."
        ],
        "fix": [
          "Replace the encoder or encoder cable.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.264, F31101)"
      },
      {
        "code": "F31110",
        "title": "Serial communications error",
        "symptom": "BOP shows F31110 (Serial communications error); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "Serial communication protocol transfer error between the encoder and evaluation module."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder cable and shielding connection."
        ],
        "fix": [
          "Replace the encoder cable/encoder.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.264, F31110)"
      },
      {
        "code": "F31112",
        "title": "Error bit set in the serial protocol",
        "symptom": "BOP shows F31112 (Error bit set in the serial protocol); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "The encoder sends a set error bit via the serial protocol."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder cable and shielding connection."
        ],
        "fix": [
          "Replace the encoder cable/encoder.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.264, F31112)"
      },
      {
        "code": "F31117",
        "title": "Inversion error signals A/B/R",
        "symptom": "BOP shows F31117 (Inversion error signals A/B/R); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "For a square-wave encoder (bipolar, double ended) signals A*, B* and R* are not inverted with respect to signals A, B and R."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder and cable and the connection of them."
        ],
        "fix": [
          "Does the encoder supply signals and the associated inverted signals?",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.264, F31117)"
      },
      {
        "code": "F31130",
        "title": "Zero mark and position error from the coarse synchronization",
        "symptom": "BOP shows F31130 (Zero mark and position error from the coarse synchronization); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "After initializing the pole position using track C/D, Hall signals or pole position identification routine, the zero mark was detected outside the permissible range. For distance-coded encoders, the test is carried out after passing 2 zero marks. Fine synchronization was not carried out."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check that the encoder cables are routed in compliance with EMC.",
          "Check the plug connections",
          "Check the connection of track C or D."
        ],
        "fix": [
          "If the Hall sensor is used as an equivalent for track C/D, check the connection.",
          "Replace the encoder or encoder cable.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.264, F31130)"
      },
      {
        "code": "F31150",
        "title": "Initialization error",
        "symptom": "BOP shows F31150 (Initialization error); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "Encoder functionality is not operating correctly."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder type used (incremental/absolute) and the encoder cable."
        ],
        "fix": [
          "If relevant, note additional fault messages that describe the fault in detail.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.264, F31150)"
      },
      {
        "code": "F52903",
        "title": "Fault inconsistence between fault status and fault buffer",
        "symptom": "BOP shows F52903 (Fault inconsistence between fault status and fault buffer); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "Fault status and fault number buffer are inconsistent."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Repower on.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52903)"
      },
      {
        "code": "F52904",
        "title": "Control mode change",
        "symptom": "BOP shows F52904 (Control mode change); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "When the control mode is changed, the drive must be saved and restarted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Save and restart the drive.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52904)"
      },
      {
        "code": "F52911",
        "title": "Positive torque limitation value error",
        "symptom": "BOP shows F52911 (Positive torque limitation value error); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "One of positive torque limitation values (P29050) becomes less than 0."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Configure all of positive torque limitation values (P29050) not less than 0.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52911)"
      },
      {
        "code": "F52912",
        "title": "Negative torque limitation value error",
        "symptom": "BOP shows F52912 (Negative torque limitation value error); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "One of negative torque limitation values (P29051) becomes greater than 0."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Configure all of negative torque limitation values (P29051) not greater than 0.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52912)"
      },
      {
        "code": "F52931",
        "title": "Gear box limit",
        "symptom": "BOP shows F52931 (Gear box limit); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The electronic gear ratio (p29012[x] / p29013[x]) exceeds the range from 0.02 to 200."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Adjust the electronic gear ratio within the permissible range from 0.02 to 200.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52931)"
      },
      {
        "code": "F52933",
        "title": "PTO gear box limit",
        "symptom": "BOP shows F52933 (PTO gear box limit); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The electronic gear ratio (p29031[0] / p29032[0]) exceeds the range from 0.02 to 200."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Adjust the electronic gear ratio within the permissible range from 0.02 to 200.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52933)"
      },
      {
        "code": "F52980",
        "title": "Absolute encoder motor changed",
        "symptom": "BOP shows F52980 (Absolute encoder motor changed); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The servo motor with absolute encoder is changed. Actual motor ID is different from commissioned motor ID."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "The servo motor will be automatically configured after the acknowledgement of this fault.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52980)"
      },
      {
        "code": "F52981",
        "title": "Absolute encoder motor mismatched",
        "symptom": "BOP shows F52981 (Absolute encoder motor mismatched); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "Connected absolute encoder motor cannot be operated. The servo drive in use does not support the Motor ID."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Use a suitable absolute encoder motor.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52981)"
      },
      {
        "code": "F52983",
        "title": "No encoder detected",
        "symptom": "BOP shows F52983 (No encoder detected); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The servo drive in use does not support encoderless operation."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the encoder cable connection between the servo drive and the servo motor."
        ],
        "fix": [
          "Use a servo motor with encoder.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.265, F52983)"
      },
      {
        "code": "F52984",
        "title": "Incremental motor not configured",
        "symptom": "BOP shows F52984 (Incremental motor not configured); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "encoder",
          "Commissioning of the servo motor has failed.",
          "The incremental encoder motor is connected but fails to commission."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Configure the motor ID by setting the parameter p29000.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.266, F52984)"
      },
      {
        "code": "F52985",
        "title": "Absolute encoder motor wrong",
        "symptom": "BOP shows F52985 (Absolute encoder motor wrong); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "Motor ID is downloaded wrong during manufacture.",
          "The software of the servo drive does not support the Motor ID."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Update the firmware.",
          "Use a correct absolute encoder motor.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.266, F52985)"
      },
      {
        "code": "F52987",
        "title": "Absolute encoder replaced",
        "symptom": "BOP shows F52987 (Absolute encoder replaced); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY Alarm list Alarm.",
        "causes": [
          "Incorrect absolute encoder data. Cause"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Contact the Hotline. Remedy",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 Operating Instructions 01/2015 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.266, F52987)"
      },
      {
        "code": "A1009",
        "title": "Control module overtemperature",
        "symptom": "BOP shows A1009 (Control module overtemperature); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The temperature of the control module (Control Unit) has exceeded the specified limit value."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the air intake for the Control Unit.",
          "Check the Control Unit fan. Note: The alarm automatically disappears after the limit value has been undershot."
        ],
        "fix": [
          "Check the air intake for the Control Unit.",
          "Check the Control Unit fan. Note: The alarm automatically disappears after the limit value has been undershot."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.266, A1009)"
      },
      {
        "code": "A1019",
        "title": "Writing to the removable data medium unsuccessful",
        "symptom": "BOP shows A1019 (Writing to the removable data medium unsuccessful); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The write access to the removable data medium was unsuccessful."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Remove and check the removable data medium. Then run the data backup again."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.266, A1019)"
      },
      {
        "code": "A1032",
        "title": "All parameters must be saved",
        "symptom": "BOP shows A1032 (All parameters must be saved); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The parameters of an individual drive object were saved, although there is still no backup of all drive system parameters. The saved object-specific parameters are not loaded the next time that the system powers up. For the system to successfully power up, all of the parameters must have been completely backed up."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Save all parameters."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.266, A1032)"
      },
      {
        "code": "A1045",
        "title": "Configuring data invalid",
        "symptom": "BOP shows A1045 (Configuring data invalid); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "An error was detected when evaluating the parameter files saved in the non-volatile memory. Because of this, under certain circumstances, several of the saved parameter values were not able to be accepted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Save the parameterization in SINAMICS VASSISTANT using the \"Copy RAM to ROM\" function or on the BOP. This overwrites the incorrect parameter files in the non-volatile memory – and the alarm is withdrawn."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.266, A1045)"
      },
      {
        "code": "A1920",
        "title": "Drive Bus: Receive setpoints after To",
        "symptom": "BOP shows A1920 (Drive Bus: Receive setpoints after To); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Output data of Drive Bus master (setpoints) received at the incorrect instant in time within the Drive Bus clock cycle."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check bus configuration.",
          "Check parameters for clock cycle synchronization (ensure To > Tdx). Note: To: Time of setpoint acceptance Tdx: Data exchange time"
        ],
        "fix": [
          "Check bus configuration.",
          "Check parameters for clock cycle synchronization (ensure To > Tdx). Note: To: Time of setpoint acceptance Tdx: Data exchange time"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.266, A1920)"
      },
      {
        "code": "A1932",
        "title": "Drive Bus clock cycle synchronization missing for DSC",
        "symptom": "BOP shows A1932 (Drive Bus clock cycle synchronization missing for DSC); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "There is no clock synchronization or clock synchronous sign of life and DSC is selected. Note: DSC: Dynamic Servo Control"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Set clock synchronization across the bus configuration and transfer clock synchronous sign-of-life."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A1932)"
      },
      {
        "code": "A5000",
        "title": "Drive heat sink overtemperature",
        "symptom": "BOP shows A5000 (Drive heat sink overtemperature); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Cause: The alarm threshold for overtemperature at the inverter heat sink has been reached. If the temperature of the heat sink increases by an additional 5 K, then fault F30004 is initiated."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the following:"
        ],
        "fix": [
          "Is the surrounding temperature within the defined limit values?",
          "Have the load conditions and the load duty cycle been appropriately dimensioned?",
          "Has the cooling failed?"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A5000)"
      },
      {
        "code": "A7012",
        "title": "Motor temperature model 1/3 overtemperature",
        "symptom": "BOP shows A7012 (Motor temperature model 1/3 overtemperature); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The motor temperature model 1/3 identified that the alarm threshold was exceeded."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the motor load and reduce it if required.",
          "Check the motor surrounding temperature."
        ],
        "fix": [
          "Check the motor load and reduce it if required.",
          "Check the motor surrounding temperature."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7012)"
      },
      {
        "code": "A7441",
        "title": "LR: Save the position offset of the absolute encoder adjustment",
        "symptom": "BOP shows A7441 (LR: Save the position offset of the absolute encoder adjustment); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The status of the absolute encoder adjustment has changed. In order to permanently save the determined position offset (p2525) it must be saved."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Not necessary. This alarm automatically disappears after the offset has been saved."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7441)"
      },
      {
        "code": "A7456",
        "title": "EPOS: Setpoint velocity limited",
        "symptom": "BOP shows A7456 (EPOS: Setpoint velocity limited); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The actual setpoint velocity is greater than the parameterized maximum velocity and is therefore limited."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Decrease the actual setpoint velocity."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7456)"
      },
      {
        "code": "A7461",
        "title": "EPOS: Reference point not set",
        "symptom": "BOP shows A7461 (EPOS: Reference point not set); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "When starting a traversing block/direct setpoint input, a reference point is not set."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Reference the system (search for reference, flying referencing, set reference point)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7461)"
      },
      {
        "code": "A7469",
        "title": "EPOS: Traversing block < target position < software limit switch minus",
        "symptom": "BOP shows A7469 (EPOS: Traversing block < target position < software limit switch minus); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "In the traversing block the specified absolute target position lies outside the range limited by the software limit switch minus."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the traversing block.",
          "Change software limit switch minus (p2580)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7469)"
      },
      {
        "code": "A7470",
        "title": "EPOS: Traversing block > target position > software limit switch plus",
        "symptom": "BOP shows A7470 (EPOS: Traversing block > target position > software limit switch plus); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "In the traversing block the specified absolute target position lies outside the range limited by the software limit switch plus."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the traversing block.",
          "Change software limit switch plus (p2581)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7470)"
      },
      {
        "code": "A7471",
        "title": "EPOS: Traversing block target position outside the modulo range",
        "symptom": "BOP shows A7471 (EPOS: Traversing block target position outside the modulo range); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "In the traversing block the target position lies outside the modulo range."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "In the traversing block, correct the target position.",
          "Change the modulo range (p29246)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7471)"
      },
      {
        "code": "A7472",
        "title": "EPOS: Traversing block ABS_POS/ABS_N EG not possible",
        "symptom": "BOP shows A7472 (EPOS: Traversing block ABS_POS/ABS_N EG not possible); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "In the traversing block the positioning mode ABS_POS or ABS_NEG were parameterized with the modulo correction not activated."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the traversing block."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7472)"
      },
      {
        "code": "A7473",
        "title": "EPOS: Beginning of traversing range reached",
        "symptom": "BOP shows A7473 (EPOS: Beginning of traversing range reached); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "When traversing, the axis has moved to the traversing range limit."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Move away in the positive direction."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.267, A7473)"
      },
      {
        "code": "A7474",
        "title": "EPOS: End of traversing range reached",
        "symptom": "BOP shows A7474 (EPOS: End of traversing range reached); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "When traversing, the axis has moved to the traversing range limit."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Move away in the negative direction."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7474)"
      },
      {
        "code": "A7477",
        "title": "EPOS: Target position < software limit switch minus",
        "symptom": "BOP shows A7477 (EPOS: Target position < software limit switch minus); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "In the actual traversing operation, the target position is less than the software limit switch minus."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the target position.",
          "Change software limit switch minus (CI: p2580)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7477)"
      },
      {
        "code": "A7478",
        "title": "EPOS: Target position > software limit switch plus",
        "symptom": "BOP shows A7478 (EPOS: Target position > software limit switch plus); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "In the actual traversing operation, the target position is greater than the software limit switch plus."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the target position.",
          "Change software limit switch plus (CI: p2581)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7478)"
      },
      {
        "code": "A7479",
        "title": "EPOS: Software limit switch minus reached",
        "symptom": "BOP shows A7479 (EPOS: Software limit switch minus reached); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The axis is at the position of the software limit switch minus. An active traversing block was interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the target position.",
          "Change software limit switch minus (CI: p2580)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7479)"
      },
      {
        "code": "A7480",
        "title": "EPOS: Software limit switch plus reached",
        "symptom": "BOP shows A7480 (EPOS: Software limit switch plus reached); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The axis is at the position of the software limit switch plus. An active traversing block was interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Correct the target position.",
          "Change software limit switch plus (CI: p2581)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7480)"
      },
      {
        "code": "A7496",
        "title": "SON enable missing",
        "symptom": "BOP shows A7496 (SON enable missing); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "In the PTI mode or a compound mode with PTI, the drive is in the servo off state."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Enable servo on for the drive."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7496)"
      },
      {
        "code": "A7576",
        "title": "Encoderless operation due to a fault active",
        "symptom": "BOP shows A7576 (Encoderless operation due to a fault active); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Encoderless operation is active due to a fault."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Remove the cause of a possible encoder fault.",
          "Carry out a POWER ON (power off/on) for all components."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7576)"
      },
      {
        "code": "A7585",
        "title": "P-TRG or CLR active",
        "symptom": "BOP shows A7585 (P-TRG or CLR active); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "In the PTI mode or a compound mode with PTI, the P-TRG or CLR function is activated. I2t"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "In the PTI mode, deactivate the P-TRG or CLR function; in the compound mode with PTI, do not switch to other modes."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7585)"
      },
      {
        "code": "A7805",
        "title": "Power unit overload I2t",
        "symptom": "BOP shows A7805 (Power unit overload I2t); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Alarm threshold for overload of the power unit exceeded."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the assignment of the rated currents of the motor and motor module."
        ],
        "fix": [
          "Reduce the continuous load.",
          "Adapt the load duty cycle."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7805)"
      },
      {
        "code": "A7965",
        "title": "Save required",
        "symptom": "BOP shows A7965 (Save required); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The angular commutation offset was re-defined and has still not been saved. In order to permanently accept the new value, it must be saved in a non-volatile fashion."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "This alarm automatically disappears after the data has been saved."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7965)"
      },
      {
        "code": "A7971",
        "title": "Angular commutation offset determination activated",
        "symptom": "BOP shows A7971 (Angular commutation offset determination activated); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The automatic determination of the angular commutation offset (encoder adjustment) is activated. The automatic determination is carried out at the next power-on command."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "The alarm automatically disappears after determination."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7971)"
      },
      {
        "code": "A7991",
        "title": "Motor data identification activated",
        "symptom": "BOP shows A7991 (Motor data identification activated); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The motor data ident. routine is activated. The motor data identification routine is carried out at the next power-on command."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "The alarm automatically disappears after the motor data identification routine has been successfully completed. If a POWER ON or a warm restart is performed with motor data identification selected, the motor data identification request will be lost. If motor data identification is required, it will need to be selected again manually following ramp-up."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.268, A7991)"
      },
      {
        "code": "A30016",
        "title": "Load supply switched off",
        "symptom": "BOP shows A30016 (Load supply switched off); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The DC link voltage is too low."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the line supply if necessary."
        ],
        "fix": [
          "Switch on the load supply."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.269, A30016)"
      },
      {
        "code": "A30031",
        "title": "Hardware current limiting in phase U",
        "symptom": "BOP shows A30031 (Hardware current limiting in phase U); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Hardware current limit for phase U responded. The pulsing in this phase is inhibited for one pulse period.",
          "Closed-loop control is incorrectly parameterized.",
          "Fault in the motor or in the power cables.",
          "The power cables exceed the maximum permissible length.",
          "Motor load too high.",
          "Power unit defective. Note: Alarm A30031 is always output if, for a Power Module, the hardware current limiting of phase U, V or W responds."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check the motor data. As an alternative, run a motor data identification.",
          "Check the motor circuit configuration (star-delta)",
          "Check the motor load.",
          "Check the power cable connections.",
          "Check the power cables for short-circuit or ground fault.",
          "Check the length of the power cables."
        ],
        "fix": [
          "Check the motor data. As an alternative, run a motor data identification.",
          "Check the motor circuit configuration (star-delta)",
          "Check the motor load.",
          "Check the power cable connections.",
          "Check the power cables for short-circuit or ground fault.",
          "Check the length of the power cables."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.269, A30031)"
      },
      {
        "code": "A31411",
        "title": "Absolute encoder signals internal alarms",
        "symptom": "BOP shows A31411 (Absolute encoder signals internal alarms); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The absolute encoder fault word includes alarm bits that have been set."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Replace the encoder."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.269, A31411)"
      },
      {
        "code": "A31412",
        "title": "Error bit set in the serial protocol",
        "symptom": "BOP shows A31412 (Error bit set in the serial protocol); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The encoder sends a set error bit via the serial protocol."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics).",
          "Check that the encoder cables are routed in compliance with EMC.",
          "Check the plug connections."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Replace the encoder."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.269, A31412)"
      },
      {
        "code": "A52900",
        "title": "Failure during data copying",
        "symptom": "BOP shows A52900 (Failure during data copying); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Copying is halted.",
          "The SD card was plugged out.",
          "The drive is not in the stop state."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Re-plug in the SD card.",
          "Make sure the drive is in the stop state."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.269, A52900)"
      },
      {
        "code": "A52901",
        "title": "Braking resistor reaches alarm threshold",
        "symptom": "BOP shows A52901 (Braking resistor reaches alarm threshold); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The heat capacity reaches the threshold (p29005) of the braking resistor capacity."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Change the external braking resistor.",
          "Increase deceleration time."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.269, A52901)"
      },
      {
        "code": "A52902",
        "title": "Emergency missing",
        "symptom": "BOP shows A52902 (Emergency missing); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Implement servo on when the emergency input (EMGS) is switched off."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Switch on the emergency input (EMGS) and then implement servo on."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.269, A52902)"
      },
      {
        "code": "A52932",
        "title": "PTO max limit",
        "symptom": "BOP shows A52932 (PTO max limit); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "For incremental encoder, when PTO frequency exceeds 280K, drive will output A52932 to remind that exceed limitation. For absolute encoder, when PTO frequency exceeds 120K, drive will output A52932 to remind that exceed limitation."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 Operating Instructions 01/2015 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Change PTO ratio."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90 Operating Instructions 01/2015, ch.11.2 List of faults and alarms, p.269, A52932)"
      }
    ],
    "sources": [
      "https://cache.industry.siemens.com/dl/files/837/108586837/att_825118/v1/SINAMICS_V90_Operating_Instructions_012015_en-US.pdf (SINAMICS V90, SIMOTICS S-1FL6 Operating Instructions 01/2015, 6SL3298-0AV60-0BP0: p.37, p.59-68, p.92-97, p.193-195, ch.11 p.251-269)"
    ]
  },
  {
    "id": "sinamics-v90-pn-servo-drive",
    "title": "Siemens SINAMICS V90 PROFINET (PN) servo drive, 200 V and 400 V variants (6SL3210-5F…-…UF.)",
    "match": {
      "categories": [
        "servoDrive"
      ],
      "family": "SINAMICS V90",
      "partNumber": "UF\\d$"
    },
    "normal": [
      {
        "terminals": "L1, L2, L3 (line supply), 200 V variant",
        "state": "power applied",
        "meter": "VAC",
        "expected": "FSB/FSC: 1-phase or 3-phase 200 VAC to 240 VAC; FSD: 3-phase 200 VAC to 240 VAC; 50/60 Hz, -15% to +10%",
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
        "note": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf p.50 Specific technical data"
      },
      {
        "terminals": "L1, L2, L3 (line supply), 400 V variant",
        "state": "power applied",
        "meter": "VAC",
        "expected": "3-phase 380 VAC to 480 VAC, 50/60 Hz, -15% to +10%",
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
        "note": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf p.50"
      },
      {
        "terminals": "+24 V to M (24 V power supply/STO connector)",
        "state": "control power applied",
        "meter": "VDC",
        "expected": "24 VDC, -15% to +20% without brake; -10% to +10% with brake; max 1.5 A without / 3.5 A with brake power",
        "pins": [
          [
            "+24V",
            "M"
          ]
        ],
        "note": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf p.92"
      },
      {
        "terminals": "B+ to B- (motor holding brake, drive side, 400 V variant only)",
        "state": "brake released (MBR low level, motor can run)",
        "meter": "VDC",
        "expected": "24 V (input voltage tolerance 24 V ± 10%)",
        "pins": [
          [
            "B+",
            "B-"
          ]
        ],
        "note": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf p.98-99"
      },
      {
        "terminals": "B+ to B- (400 V variant)",
        "state": "brake engaged (MBR high level)",
        "meter": "VDC",
        "expected": "0 V",
        "pins": [
          [
            "B+",
            "B-"
          ]
        ],
        "note": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf p.99"
      },
      {
        "terminals": "X8 BK+ / BK- (pins 17/18, 200 V variant brake control signal to external relay)",
        "state": "brake release / engage",
        "meter": "visual",
        "expected": "Brake release: brake control on, relay with current, motor brake open (can run). Engagement: brake control off, relay without current. Never use the same supply for the brake 24 VDC and the brake control signal",
        "note": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf p.84, p.99-101"
      },
      {
        "terminals": "STO 1 / STO 2",
        "state": "run permitted",
        "meter": "visual",
        "expected": "Both high level: motor can run; both low: drive starts but motor cannot run; one high, one low: fault F1611 and motor coasts down (OFF2). STO1, STO+ and STO2 are short-connected at the factory",
        "note": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf p.92-93, p.162-163"
      },
      {
        "terminals": "X8 DI1…DI4 to DI_COM (pins 1-4 to 6/7)",
        "state": "wiring",
        "meter": "visual",
        "expected": "Digital inputs support PNP and NPN wiring; defaults DI1 = RESET, DI2 = TLIM; EMGS (if assigned): 0 = emergency stop, 1 = ready to run",
        "note": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf p.84-86"
      }
    ],
    "indicators": [
      {
        "name": "RDY",
        "state": "off",
        "meaning": "24 V control board power supply is missing"
      },
      {
        "name": "RDY",
        "state": "green, continuously lit",
        "meaning": "Drive in servo on state"
      },
      {
        "name": "RDY",
        "state": "red, continuously lit",
        "meaning": "Drive in servo off state or startup state"
      },
      {
        "name": "RDY",
        "state": "red, flashing 1 Hz",
        "meaning": "Alarm or fault present"
      },
      {
        "name": "BOP display",
        "state": "shows Fxxxx",
        "meaning": "Fault (needs acknowledgement); faults are displayed before alarms"
      },
      {
        "name": "BOP display",
        "state": "shows Axxxx",
        "meaning": "Alarm (self-acknowledging)"
      },
      {
        "name": "RDY",
        "state": "green and yellow alternating at 2 Hz",
        "meaning": "Drive identification"
      },
      {
        "name": "COM",
        "state": "green, continuously lit",
        "meaning": "PROFINET communication working with IRT"
      },
      {
        "name": "COM",
        "state": "green, flashing 0.5 Hz",
        "meaning": "PROFINET communication working with RT"
      },
      {
        "name": "COM",
        "state": "green, flashing 2 Hz",
        "meaning": "Micro SD card/SD card operating (read or write)"
      },
      {
        "name": "COM",
        "state": "red, continuously lit",
        "meaning": "PROFINET communication in error or not connected"
      },
      {
        "name": "Link (X150 port, green)",
        "state": "lit / off",
        "meaning": "lit: 100 Mbit/s link; off: no or faulty connection"
      },
      {
        "name": "Activity (X150 port, orange)",
        "state": "lit / off",
        "meaning": "lit: data exchange; off: no data exchange"
      }
    ],
    "faults": [
      {
        "code": "F1000",
        "title": "Internal software error",
        "symptom": "BOP shows F1000 (Internal software error); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "An internal software error has occurred."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Evaluate fault buffer."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade firmware to later version.",
          "Contact the Hotline.",
          "Replace the Control Unit.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.208, F1000)"
      },
      {
        "code": "F1001",
        "title": "FloatingPoint exception",
        "symptom": "BOP shows F1001 (FloatingPoint exception); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "An exception occurred during an operation with the FloatingPoint data type."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade firmware to the latest version.",
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.208, F1001)"
      },
      {
        "code": "F1002",
        "title": "Internal software error",
        "symptom": "BOP shows F1002 (Internal software error); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "An internal software error has occurred."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade firmware to the latest version.",
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.208, F1002)"
      },
      {
        "code": "F1003",
        "title": "Acknowledgement delay when accessing the memory",
        "symptom": "BOP shows F1003 (Acknowledgement delay when accessing the memory); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "A memory area was accessed that does not return a \"READY\"."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on).",
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.208, F1003)"
      },
      {
        "code": "F1015",
        "title": "Internal software error",
        "symptom": "BOP shows F1015 (Internal software error); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "An internal software error has occurred."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade firmware to the latest version.",
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.208, F1015)"
      },
      {
        "code": "F1018",
        "title": "Booting has been interrupted several times",
        "symptom": "BOP shows F1018 (Booting has been interrupted several times); RDY LED flashes red at 1 Hz; reaction NONE; acknowledgement POWER ON.",
        "causes": [
          "Module booting was interrupted several times. As a consequence, the module boots with the factory setting. Possible reasons for booting being interrupted:",
          "Power supply interrupted.",
          "CPU crashed.",
          "Parameterization invalid. After this fault is output, then the module is booted with the factory settings."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on). After switching on, the module reboots from the valid parameterization (if available).",
          "Restore the valid parameterization Examples:",
          "Carry out a first commissioning, save, carry out a POWER ON (switch-off/switch-on).",
          "Load another valid parameter backup (e.g. from the memory card), save, carry out a POWER ON (switch-off/switch-on). Note: If the fault situation is repeated, then this fault is again output after several interrupted boots.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.208, F1018)"
      },
      {
        "code": "F1030",
        "title": "Sign-of-life failure for master control",
        "symptom": "BOP shows F1030 (Sign-of-life failure for master control); RDY LED flashes red at 1 Hz; reaction OFF3; acknowledgement IMMEDIATELY.",
        "causes": [
          "For active PC master control, no sign-oflife was received within the monitoring time."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.209, F1030)"
      },
      {
        "code": "F1611",
        "title": "SI CU: Defect detected",
        "symptom": "BOP shows F1611 (SI CU: Defect detected); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The drive-integrated \"Safety Integrated\" (SI) function on the Control Unit (CU) has detected an error and initiated an STO"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Upgrade software.",
          "Replace the Control Unit.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.209, F1611)"
      },
      {
        "code": "F1910",
        "title": "Fieldbus: setpoint timeout",
        "symptom": "BOP shows F1910 (Fieldbus: setpoint timeout); RDY LED flashes red at 1 Hz; reaction OFF3; acknowledgement IMMEDIATELY.",
        "causes": [
          "The reception of setpoints from the fieldbus interface (Modbus/USS) has been interrupted.",
          "Bus connection interrupted.",
          "Controller switched off.",
          "Controller set into the STOP state."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Restore the bus connection and set the controller to RUN.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.209, F1910)"
      },
      {
        "code": "F1911",
        "title": "PROFIdrive: Clock cycle synchronous operation clock cycle failure",
        "symptom": "BOP shows F1911 (PROFIdrive: Clock cycle synchronous operation clock cycle failure); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The global control telegram to synchronize the clock cycles has failed - for several DP clock cycles or has violated the time grid specified in the parameterizing telegram over several consecutive DP clock cycles (refer to the bus cycle time, Tdp and Tpllw)."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the physical bus configuration (cable, connector, terminating resistor, shielding, etc.).",
          "Check whether communication was briefly or permanently interrupted.",
          "Check the bus and controller for utilization level (e.g. bus cycle time Tdp was set too short)."
        ],
        "fix": [
          "Check the physical bus configuration (cable, connector, terminating resistor, shielding, etc.).",
          "Check whether communication was briefly or permanently interrupted.",
          "Check the bus and controller for utilization level (e.g. bus cycle time Tdp was set too short).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.209, F1911)"
      },
      {
        "code": "F1912",
        "title": "PROFIdrive: Clock cycle synchronous operation sign-of-life failure",
        "symptom": "BOP shows F1912 (PROFIdrive: Clock cycle synchronous operation sign-of-life failure); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The maximum permissible number of errors in the controller sign-of-life (clock synchronous operation) has been exceeded in cyclic operation."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check whether the controller correctly sends the sign-of-life (e.g. create a trace with STW2.12...STW2.15 and trigger signal ZSW1.3).",
          "Check the permissible telegram failure rate (p0925).",
          "Check the bus and controller for utilization level (e.g. bus cycle time was set too short)."
        ],
        "fix": [
          "Physically check the bus (cables, connectors, terminating resistor, shielding, etc).",
          "Correct the interconnection of the controller sign-of-life.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.209, F1912)"
      },
      {
        "code": "F7011",
        "title": "Motor overtemperature",
        "symptom": "BOP shows F7011 (Motor overtemperature); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "Motor overloaded",
          "Motor surrounding temperature too high",
          "Wire breakage or sensor not connected",
          "Motor temperature model incorrectly parameterized"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the surrounding temperature and the motor ventilation.",
          "Check the wiring and the connection.",
          "Check the motor temperature model parameters."
        ],
        "fix": [
          "Reduce the motor load.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.209, F7011)"
      },
      {
        "code": "F7085",
        "title": "Open-loop/closedloop control parameters changed",
        "symptom": "BOP shows F7085 (Open-loop/closedloop control parameters changed); RDY LED flashes red at 1 Hz; reaction NONE; acknowledgement IMMEDIATELY.",
        "causes": [
          "Open-loop/closed-loop control parameters have had to be changed for the following reasons:",
          "As a result of other parameters, they have exceeded the dynamic limits.",
          "They cannot be used due to the fact that the hardware detected not having certain features."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "It is not necessary to change the parameters as they have already been correctly limited.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.210, F7085)"
      },
      {
        "code": "F7090",
        "title": "Drive: Upper torque limit less than the lower torque limit",
        "symptom": "BOP shows F7090 (Drive: Upper torque limit less than the lower torque limit); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The upper torque limit is lower than the lower torque limit."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "The upper torque limit (p29050) must be ≥ lower torque limit (p29051)",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.210, F7090)"
      },
      {
        "code": "F7093",
        "title": "Drive: Test signal error",
        "symptom": "BOP shows F7093 (Drive: Test signal error); RDY LED flashes red at 1 Hz; reaction OFF3; acknowledgement IMMEDIATELY.",
        "causes": [
          "The limit rotation of the motor (p29027) is inappropriate."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Modify the value of parameter p29027.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.210, F7093)"
      },
      {
        "code": "F7220",
        "title": "Drive: Master control by PLC missing",
        "symptom": "BOP shows F7220 (Drive: Master control by PLC missing); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The \"master control by PLC\" signal was missing in operation.",
          "Input for \"master control by PLC\" is incorrect.",
          "The higher-level control has withdrawn the \"master control by PLC\" signal.",
          "Data transfer via the fieldbus (master/drive) was interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the input for \"master control by PLC\".",
          "Check the \"master control by PLC\" signal and, if required, switch in.",
          "Check the data transfer via the fieldbus (master/drive)."
        ],
        "fix": [
          "Check the input for \"master control by PLC\".",
          "Check the \"master control by PLC\" signal and, if required, switch in.",
          "Check the data transfer via the fieldbus (master/drive).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.210, F7220)"
      },
      {
        "code": "F7403",
        "title": "Lower DC link voltage threshold reached",
        "symptom": "BOP shows F7403 (Lower DC link voltage threshold reached); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The DC link voltage monitoring is active and the lower DC link voltage threshold was reached in the \"Operation\" state."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the line supply voltage.",
          "Check the infeed."
        ],
        "fix": [
          "Reduce the lower DC link threshold.",
          "Switch out (disable) the DC link voltage monitoring.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.210, F7403)"
      },
      {
        "code": "F7404",
        "title": "Upper DC link voltage threshold reached",
        "symptom": "BOP shows F7404 (Upper DC link voltage threshold reached); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The DC link voltage monitoring is active and the upper DC link voltage threshold was reached in the \"Operation\" state."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the line supply voltage.",
          "Check the infeed module or the brake module."
        ],
        "fix": [
          "Increase the upper DC link voltage threshold.",
          "Switch out (disable) the DC link voltage monitoring.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.210, F7404)"
      },
      {
        "code": "F7410",
        "title": "Current controller output limited",
        "symptom": "BOP shows F7410 (Current controller output limited); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The condition \"I_act = 0 and Uq_set_1 longer than 16 ms at its limit\" is present and can be caused by the following:",
          "Motor not connected or motor contactor open.",
          "No DC link voltage present.",
          "Motor Module defective."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the DC link voltage.",
          "Check the Motor Module."
        ],
        "fix": [
          "Connect the motor or check the motor contactor.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.211, F7410)"
      },
      {
        "code": "F7412",
        "title": "Commutation angle incorrect (motor model)",
        "symptom": "BOP shows F7412 (Commutation angle incorrect (motor model)); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement IMMEDIATELY.",
        "causes": [
          "An incorrect commutation angle was detected that can result in a positive coupling in the speed controller. Possible causes:",
          "The motor encoder is incorrectly adjusted with respect to the magnet position.",
          "The motor encoder is damaged.",
          "Data to calculate the motor model has been incorrectly set.",
          "Pole position identification might have calculated an incorrect value when activated.",
          "The motor encoder speed signal is faulted.",
          "The control loop is instable due to incorrect parameterization."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "If the encoder mounting was changed, readjust the encoder.",
          "Replace the defective motor encoder.",
          "Correctly set the motor stator resistance, cable resistance and motor-stator leakage inductance. Calculate the cable resistance from the cross-section and length, check the inductance and stator resistance using the motor data sheet, measure the stator resistance, e.g. using a multimeter - and if required, again identify the values using the stationary motor data identification.",
          "With pole position identification activated, check the procedure for pole position identification and force a new pole position identification procedure by means of de-selection followed by selection.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.211, F7412)"
      },
      {
        "code": "F7420",
        "title": "Drive: Current setpoint filter natural frequency > Shannon frequecy",
        "symptom": "BOP shows F7420 (Drive: Current setpoint filter natural frequency > Shannon frequecy); RDY LED flashes red at 1 Hz.",
        "causes": [
          "One of the filter natural frequencies is greater than the Shannon frequency."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Reduce the numerator or denominator natural frequency of the current setpoint filter involved.",
          "Switch out the filter involved (p1656).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.211, F7420)"
      },
      {
        "code": "F7453",
        "title": "Position actual value preprocessing error",
        "symptom": "BOP shows F7453 (Position actual value preprocessing error); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "An error has occurred during the position actual value preprocessing."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the encoder for the position actual value preprocessing."
        ],
        "fix": [
          "Check the encoder for the position actual value preprocessing.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.211, F7453)"
      },
      {
        "code": "F7490",
        "title": "Enable signal withdrawn while traversing",
        "symptom": "BOP shows F7490 (Enable signal withdrawn while traversing); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "For a standard assignment, another fault may have occurred as a result of withdrawing the enable signals.",
          "The drive is in the \"switching on inhibited\" state (for a standard assignment)."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the assignment to enable the basic positioning function."
        ],
        "fix": [
          "Set the enable signals or check the cause of the fault that first occurred and then result (for a standard assignment).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.211, F7490)"
      },
      {
        "code": "F7575",
        "title": "Drive: Motor encoder not ready",
        "symptom": "BOP shows F7575 (Drive: Motor encoder not ready); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY F7800 Drive: No power unit present Reaction: NONE Acknowledgement: IMMEDIATELY.",
        "causes": [
          "The motor encoder signals that it is not ready.",
          "Initialization of motor encoder was unsuccessful.",
          "The function \"parking encoder\" is active (encoder control word G1_STW.14 = 1). The power unit parameters cannot be read or no parameters are stored in the power unit."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Evaluate other queued faults via motor encoder."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Change the module.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.211, F7575)"
      },
      {
        "code": "F7801",
        "title": "Motor overcurrent",
        "symptom": "BOP shows F7801 (Motor overcurrent); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The permissible motor limit current was exceeded.",
          "Effective current limit set too low.",
          "Current controller not correctly set.",
          "Motor was braked with an excessively high stall torque correction factor.",
          "Up ramp was set too short or the load is too high.",
          "Short-circuit in the motor cable or ground fault.",
          "Motor current does not match the current of Motor Module."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the motor and motor cables for short-circuit and ground fault.",
          "Check the Motor Module and motor combination."
        ],
        "fix": [
          "Reduce the stall torque correction factor.",
          "Increase the up ramp or reduce the load.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.212, F7801)"
      },
      {
        "code": "F7802",
        "title": "Infeed or power unit not ready",
        "symptom": "BOP shows F7802 (Infeed or power unit not ready); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "After an internal power-on command, the infeed or drive does not signal ready because of one of the following reasons:",
          "Monitoring time is too short.",
          "DC link voltage is not present.",
          "Associated infeed or drive of the signaling component is defective."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Ensure that there is a DC link voltage. Check the DC link busbar. Enable the infeed."
        ],
        "fix": [
          "Replace the associated infeed or drive of the signaling component.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.212, F7802)"
      },
      {
        "code": "F7815",
        "title": "Power unit has been changed",
        "symptom": "BOP shows F7815 (Power unit has been changed); RDY LED flashes red at 1 Hz; reaction NONE; acknowledgement IMMEDIATELY.",
        "causes": [
          "The code number of the actual power unit does not match the saved number."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Connect the original power unit and power up the Control Unit again (POWER ON).",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.212, F7815)"
      },
      {
        "code": "F7900",
        "title": "Motor blocked/speed controller at its limit",
        "symptom": "BOP shows F7900 (Motor blocked/speed controller at its limit); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The servo motor has been operating at the torque limit longer than 1s and below the speed threshold of 120 rpm . This signal can also be initiated if the speed actual value is oscillating and the speed controller output repeatedly goes to its limit."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check whether the servo motor can rotate freely or not.",
          "Check the torque limit.",
          "Check the inversion of the actual value.",
          "Check the motor encoder connection.",
          "Check the encoder pulse number."
        ],
        "fix": [
          "Check whether the servo motor can rotate freely or not.",
          "Check the torque limit.",
          "Check the inversion of the actual value.",
          "Check the motor encoder connection.",
          "Check the encoder pulse number.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.212, F7900)"
      },
      {
        "code": "F7901",
        "title": "Motor overspeed",
        "symptom": "BOP shows F7901 (Motor overspeed); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The maximumly permissible speed has been exceeded.",
          "The speed limit has been exceeded."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check and correct the maximum speed (p1082).",
          "Check and correct the speed limit (p29070, p29071), and the DI signal SLIM.",
          "Check if there are any peaks of actual speed. If the value of the peak is especially large, contact the hotline."
        ],
        "fix": [
          "Check and correct the maximum speed (p1082).",
          "Check and correct the speed limit (p29070, p29071), and the DI signal SLIM.",
          "Check if there are any peaks of actual speed. If the value of the peak is especially large, contact the hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.212, F7901)"
      },
      {
        "code": "F7995",
        "title": "Motor identification failure",
        "symptom": "BOP shows F7995 (Motor identification failure); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "For incremental motor, needs pole position identification when the motor is servo on for the first time. If the motor already in run (i.e. by external force) position identification may failure."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Stop the motor before servo on.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.213, F7995)"
      },
      {
        "code": "F8501",
        "title": "PROFIdrive: Setpoint timeout",
        "symptom": "BOP shows F8501 (PROFIdrive: Setpoint timeout); RDY LED flashes red at 1 Hz; reaction OFF3; acknowledgement IMMEDIATELY.",
        "causes": [
          "The reception of setpoints from the PROFINET has been interrupted.",
          "PROFINET connection interrupted.",
          "Controller switched off.",
          "Controller set into the STOP state.",
          "PROFINET defective."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Restore the PROFINET connection and set the controller to RUN.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.213, F8501)"
      },
      {
        "code": "F30001",
        "title": "Power unit: Overcurrent",
        "symptom": "BOP shows F30001 (Power unit: Overcurrent); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit has detected an overcurrent condition.",
          "Closed-loop control is incorrectly parameterized.",
          "Controller parameters are not proper.",
          "Motor has a short-circuit or fault to ground (frame).",
          "Power cables are not correctly connected.",
          "Power cables exceed the maximum permissible length.",
          "Power unit defective.",
          "Line phase interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the motor data - if required, carry out commissioning.",
          "Check the motor circuit configuration (star-delta).",
          "Check the power cable connections.",
          "Check the power cables for short-circuit or ground fault.",
          "Check the length of the power cables.",
          "Check the line supply phases.",
          "Check the external braking resistor connection."
        ],
        "fix": [
          "Modify speed loop Kp (p29120), position loop Kv (p29110).",
          "Replace power unit.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.213, F30001)"
      },
      {
        "code": "F30002",
        "title": "DC link voltage, overvoltage",
        "symptom": "BOP shows F30002 (DC link voltage, overvoltage); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit has detected overvoltage in the DC link.",
          "Motor regenerates too much energy.",
          "Device connection voltage too high.",
          "Line phase interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the device supply voltage.",
          "Check the line supply phases."
        ],
        "fix": [
          "Increase the ramp-down time.",
          "Activate the DC link voltage controller.",
          "Use a braking resistor.",
          "Increase the current limit of the infeed or use a larger module.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.213, F30002)"
      },
      {
        "code": "F30003",
        "title": "DC link voltage, undervoltage",
        "symptom": "BOP shows F30003 (DC link voltage, undervoltage); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit has detected an undervoltage condition in the DC link.",
          "Line supply failure",
          "Line supply voltage below the permissible value.",
          "Line supply infeed failed or interrupted.",
          "Line phase interrupted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the line supply voltage",
          "Check the line supply infeed and observe the fault messages relating to it (if there are any)",
          "Check the line supply phases.",
          "Check the line supply voltage setting."
        ],
        "fix": [
          "Check the line supply voltage",
          "Check the line supply infeed and observe the fault messages relating to it (if there are any)",
          "Check the line supply phases.",
          "Check the line supply voltage setting.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.213, F30003)"
      },
      {
        "code": "F30004",
        "title": "Drive heat sink overtemperature",
        "symptom": "BOP shows F30004 (Drive heat sink overtemperature); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The temperature of the power unit heat sink has exceeded the permissible limit value.",
          "Insufficient cooling, fan failure.",
          "Overload.",
          "Surrounding temperature too high.",
          "Pulse frequency too high."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check whether the fan is running.",
          "Check the fan elements.",
          "Check whether the surrounding temperature is in the permissible range.",
          "Check the motor load."
        ],
        "fix": [
          "Reduce the pulse frequency if this is higher than the rated pulse frequency.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.214, F30004)"
      },
      {
        "code": "F30005",
        "title": "Power unit: Overload I2t",
        "symptom": "BOP shows F30005 (Power unit: Overload I2t); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit was overloaded.",
          "The permissible rated power unit current was exceeded for an inadmissibly long time.",
          "The permissible load duty cycle was not maintained."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the motor and power unit rated currents."
        ],
        "fix": [
          "Reduce the continuous load.",
          "Adapt the load duty cycle.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.214, F30005)"
      },
      {
        "code": "F30011",
        "title": "Line phase failure in main circuit",
        "symptom": "BOP shows F30011 (Line phase failure in main circuit); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "At the power unit, the DC link voltage ripple has exceeded the permissible limit value. Possible causes:",
          "A line phase has failed.",
          "The 3 line phases are inadmissibly unsymmetrical.",
          "The fuse of a phase of a main circuit has ruptured.",
          "A motor phase has failed."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the main circuit fuses.",
          "Check whether a single-phase load is distorting the line voltages.",
          "Check the motor feeder cables."
        ],
        "fix": [
          "Check the main circuit fuses.",
          "Check whether a single-phase load is distorting the line voltages.",
          "Check the motor feeder cables.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.214, F30011)"
      },
      {
        "code": "F30015",
        "title": "Phase failure motor cable",
        "symptom": "BOP shows F30015 (Phase failure motor cable); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "A phase failure in the motor feeder cable was detected. The signal can also be output in the following case: The motor is correctly connected, however the closed-speed control is instable and therefore an oscillating torque is generated."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the motor feeder cables.",
          "Check the speed controller settings."
        ],
        "fix": [
          "Check the motor feeder cables.",
          "Check the speed controller settings.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.214, F30015)"
      },
      {
        "code": "F30021",
        "title": "Ground fault",
        "symptom": "BOP shows F30021 (Ground fault); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "Power unit has detected a ground fault.",
          "Ground fault in the power cables.",
          "Winding fault or ground fault at the motor."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the power cable connections.",
          "Check the motor."
        ],
        "fix": [
          "Check the power cable connections.",
          "Check the motor.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.214, F30021)"
      },
      {
        "code": "F30027",
        "title": "Precharging DC link time monitoring",
        "symptom": "BOP shows F30027 (Precharging DC link time monitoring); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The power unit DC link was not able to be pre-charged within the expected time. There is no line supply voltage connected.",
          "The line contactor/line side switch has not been closed.",
          "The line supply voltage is too low.",
          "The pre-charging resistors are overheated as there were too many precharging operations per time unit",
          "The pre-charging resistors are overheated as the DC link capacitance is too high.",
          "The pre-charging resistors are overheated.",
          "The pre-charging resistors are overheated as the line contactor was closed during the DC link fast discharge through the Braking Module.",
          "The DC link has either a ground fault or a short-circuit.",
          "The pre-charging circuit is possibly defective."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the line supply voltage at the input terminals."
        ],
        "fix": [
          "Check the line supply voltage at the input terminals.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.215, F30027)"
      },
      {
        "code": "F30036",
        "title": "Internal overtemperature",
        "symptom": "BOP shows F30036 (Internal overtemperature); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "The temperature inside the drive converter has exceeded the permissible temperature limit.",
          "Insufficient cooling, fan failure.",
          "Overload.",
          "Surrounding temperature too high."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check whether the fan is running.",
          "Check the fan elements.",
          "Check whether the surrounding temperature is in the permissible range. Notice: This fault can only be acknowledged once the permissible temperature limit minus 5 K has been fallen below."
        ],
        "fix": [
          "Check whether the fan is running.",
          "Check the fan elements.",
          "Check whether the surrounding temperature is in the permissible range. Notice: This fault can only be acknowledged once the permissible temperature limit minus 5 K has been fallen below.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.215, F30036)"
      },
      {
        "code": "F30050",
        "title": "24 V supply overvoltage",
        "symptom": "BOP shows F30050 (24 V supply overvoltage); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement POWER ON.",
        "causes": [
          "The voltage monitor signals an overvoltage fault on the module."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the 24 V power supply."
        ],
        "fix": [
          "Replace the module if necessary.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.215, F30050)"
      },
      {
        "code": "F31100",
        "title": "Zero mark distance error",
        "symptom": "BOP shows F31100 (Zero mark distance error); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "The measured zero mark distance does not correspond to the parameterized zero mark distance. For distance-coded encoders, the zero mark distance is determined from zero marks detected pairs. This means that if a zero mark is missing, depending on the pair generation, this cannot result in a fault and also has no effect in the system."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check that the encoder cables are routed in compliance with EMC.",
          "Check the plug connections"
        ],
        "fix": [
          "Replace the encoder or encoder cable",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.215, F31100)"
      },
      {
        "code": "F31101",
        "title": "Zero mark failed",
        "symptom": "BOP shows F31101 (Zero mark failed); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "The 1.5 x parameterized zero mark distance was exceeded."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check that the encoder cables are routed in compliance with EMC.",
          "Check the plug connections."
        ],
        "fix": [
          "Replace the encoder or encoder cable.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.216, F31101)"
      },
      {
        "code": "F31110",
        "title": "Serial communications error",
        "symptom": "BOP shows F31110 (Serial communications error); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "Serial communication protocol transfer error between the encoder and evaluation module."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the encoder cable and shielding connection."
        ],
        "fix": [
          "Replace the encoder cable/encoder.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.216, F31110)"
      },
      {
        "code": "F31111",
        "title": "Encoder 1: Absolute encoder internal error",
        "symptom": "BOP shows F31111 (Encoder 1: Absolute encoder internal error); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "The absolute encoder fault word supplies fault bits that have been set."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the encoder cable connection and make sure the cables are routed in compliance with EMC.",
          "Check the motor temperature."
        ],
        "fix": [
          "Replace the encoder battery (for batterypowered encoder only).",
          "Replace the motor/encoder.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.216, F31111)"
      },
      {
        "code": "F31112",
        "title": "Error bit set in the serial protocol",
        "symptom": "BOP shows F31112 (Error bit set in the serial protocol); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "The encoder sends a set error bit via the serial protocol."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Refer to F31111.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.216, F31112)"
      },
      {
        "code": "F31117",
        "title": "Inversion error signals A/B/R",
        "symptom": "BOP shows F31117 (Inversion error signals A/B/R); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "For a square-wave encoder (bipolar, double ended) signals A*, B* and R* are not inverted with respect to signals A, B and R."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the encoder and cable and the connection of them."
        ],
        "fix": [
          "Does the encoder supply signals and the associated inverted signals?",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.216, F31117)"
      },
      {
        "code": "F31130",
        "title": "Zero mark and position error from the coarse synchronization",
        "symptom": "BOP shows F31130 (Zero mark and position error from the coarse synchronization); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "After initializing the pole position using track C/D, Hall signals or pole position identification routine, the zero mark was detected outside the permissible range. For distance-coded encoders, the test is carried out after passing 2 zero marks. Fine synchronization was not carried out."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check that the encoder cables are routed in compliance with EMC.",
          "Check the plug connections",
          "Check the connection of track C or D."
        ],
        "fix": [
          "If the Hall sensor is used as an equivalent for track C/D, check the connection.",
          "Replace the encoder or encoder cable.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.216, F31130)"
      },
      {
        "code": "F31150",
        "title": "Initialization error",
        "symptom": "BOP shows F31150 (Initialization error); RDY LED flashes red at 1 Hz; reaction ENCODER; acknowledgement PULSE INHIBIT.",
        "causes": [
          "Encoder functionality is not operating correctly."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the encoder type used (incremental/absolute) and the encoder cable."
        ],
        "fix": [
          "If relevant, note additional fault messages that describe the fault in detail.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.216, F31150)"
      },
      {
        "code": "F52903",
        "title": "Fault inconsistence between fault status and fault buffer",
        "symptom": "BOP shows F52903 (Fault inconsistence between fault status and fault buffer); RDY LED flashes red at 1 Hz; reaction OFF2; acknowledgement IMMEDIATELY.",
        "causes": [
          "Fault status and fault number buffer are inconsistent."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Repower on.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.216, F52903)"
      },
      {
        "code": "F52980",
        "title": "Absolute encoder motor changed",
        "symptom": "BOP shows F52980 (Absolute encoder motor changed); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The servo motor with absolute encoder is changed. Actual motor ID is different from commissioned motor ID."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "The servo motor will be automatically configured after the acknowledgement of this fault.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.217, F52980)"
      },
      {
        "code": "F52981",
        "title": "Absolute encoder motor mismatched",
        "symptom": "BOP shows F52981 (Absolute encoder motor mismatched); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "Connected absolute encoder motor cannot be operated. The servo drive in use does not support the Motor ID."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Use a suitable absolute encoder motor.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.217, F52981)"
      },
      {
        "code": "F52983",
        "title": "No encoder detected",
        "symptom": "BOP shows F52983 (No encoder detected); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "The servo drive in use does not support encoderless operation."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the encoder cable connection between the servo drive and the servo motor."
        ],
        "fix": [
          "Use a servo motor with encoder.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.217, F52983)"
      },
      {
        "code": "F52984",
        "title": "Incremental encoder motor not configured",
        "symptom": "BOP shows F52984 (Incremental encoder motor not configured); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "Commissioning of the servo motor has failed.",
          "The incremental encoder motor is connected but fails to commission."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Configure the motor ID by setting the parameter p29000.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.217, F52984)"
      },
      {
        "code": "F52985",
        "title": "Absolute encoder motor wrong",
        "symptom": "BOP shows F52985 (Absolute encoder motor wrong); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "Motor ID is downloaded wrong during manufacture.",
          "The firmware of the servo drive does not support the Motor ID."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Update the firmware.",
          "Use a correct absolute encoder motor.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.217, F52985)"
      },
      {
        "code": "F52987",
        "title": "Absolute encoder replaced",
        "symptom": "BOP shows F52987 (Absolute encoder replaced); RDY LED flashes red at 1 Hz; reaction OFF1; acknowledgement IMMEDIATELY.",
        "causes": [
          "Incorrect absolute encoder data."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Contact the Hotline.",
          "Acknowledge with the BOP, the RESET signal (DI) or SINAMICS V-ASSISTANT once the cause is removed; POWER ON acknowledgement needs a power cycle (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.217, F52987)"
      },
      {
        "code": "A1009",
        "title": "Control module overtemperature",
        "symptom": "BOP shows A1009 (Control module overtemperature); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The temperature of the control module (Control Unit) has exceeded the specified limit value."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the air intake for the Control Unit.",
          "Check the Control Unit fan. Note: The alarm automatically disappears after the limit value has been undershot."
        ],
        "fix": [
          "Check the air intake for the Control Unit.",
          "Check the Control Unit fan. Note: The alarm automatically disappears after the limit value has been undershot."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.218, A1009)"
      },
      {
        "code": "A1019",
        "title": "Writing to the removable data medium unsuccessful",
        "symptom": "BOP shows A1019 (Writing to the removable data medium unsuccessful); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The write access to the removable data medium was unsuccessful."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Remove and check the removable data medium. Then run the data backup again."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.218, A1019)"
      },
      {
        "code": "A1032",
        "title": "All parameters must be saved",
        "symptom": "BOP shows A1032 (All parameters must be saved); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The parameters of an individual drive object were saved, although there is still no backup of all drive system parameters. The saved object-specific parameters are not loaded the next time that the system powers up. For the system to successfully power up, all of the parameters must have been completely backed up."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Save all parameters."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.218, A1032)"
      },
      {
        "code": "A1045",
        "title": "Configuring data invalid",
        "symptom": "BOP shows A1045 (Configuring data invalid); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "An error was detected when evaluating the parameter files saved in the non-volatile memory. Because of this, under certain circumstances, several of the saved parameter values were not able to be accepted."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Save the parameterization using the \"Copy RAM to ROM\" function on the BOP. This overwrites the incorrect parameter files in the non-volatile memory – and the alarm is withdrawn."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.218, A1045)"
      },
      {
        "code": "A1902",
        "title": "PROFIdrive: Clock cycle synchronous operation parameterization not permissible",
        "symptom": "BOP shows A1902 (PROFIdrive: Clock cycle synchronous operation parameterization not permissible); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Parameterization for isochronous operation is not permissible."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Adapt the bus parameterization Tdp, Ti, To.",
          "Adapt the sampling time for the current controller or speed controller.",
          "Reduce Tdx by using fewer bus participants or shorter telegrams."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.218, A1902)"
      },
      {
        "code": "A1920",
        "title": "Drive Bus: Receive setpoints after To",
        "symptom": "BOP shows A1920 (Drive Bus: Receive setpoints after To); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Output data of Drive Bus master (setpoints) received at the incorrect instant in time within the Drive Bus clock cycle."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check bus configuration.",
          "Check parameters for clock cycle synchronization (ensure To > Tdx). Note: To: Time of setpoint acceptance Tdx: Data exchange time"
        ],
        "fix": [
          "Check bus configuration.",
          "Check parameters for clock cycle synchronization (ensure To > Tdx). Note: To: Time of setpoint acceptance Tdx: Data exchange time"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.218, A1920)"
      },
      {
        "code": "A1932",
        "title": "Drive Bus clock cycle synchronization missing for DSC",
        "symptom": "BOP shows A1932 (Drive Bus clock cycle synchronization missing for DSC); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "There is no clock synchronization or clock synchronous sign of life and DSC is selected. Note: DSC: Dynamic Servo Control"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Set clock synchronization across the bus configuration and transfer clock synchronous sign-of-life."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.218, A1932)"
      },
      {
        "code": "A1940",
        "title": "PROFIdrive: clock cycle synchronism not reached",
        "symptom": "BOP shows A1940 (PROFIdrive: clock cycle synchronism not reached); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The bus is in the data exchange state and clock synchronous operation has been selected using the parameterizing telegram. It was not possible to synchronize to the clock cycle specified by the master.",
          "The master does not send a clock synchronous global control telegram although clock synchronous operation was selected when configuring the bus.",
          "The master is using another clock synchronous DP clock cycle than was transferred to the slave in the parameterizing telegram.",
          "At least one drive object has a pulse enable (not controlled from PROFIdrive either)."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the master application and bus configuration.",
          "Check the consistency between the clock cycle input when configuring the slave and clock cycle setting at the master.",
          "Check that no drive object has a pulse enable. Only enable the pulses after synchronizing the PROFIdrive."
        ],
        "fix": [
          "Check the master application and bus configuration.",
          "Check the consistency between the clock cycle input when configuring the slave and clock cycle setting at the master.",
          "Check that no drive object has a pulse enable. Only enable the pulses after synchronizing the PROFIdrive."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.219, A1940)"
      },
      {
        "code": "A1944",
        "title": "PROFIdrive: Sign-oflife synchronism not reached",
        "symptom": "BOP shows A1944 (PROFIdrive: Sign-oflife synchronism not reached); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The bus is in the data exchange state and clock synchronous operation has been selected using the parameterizing telegram. Synchronization with the master sign-of-life (STW2.12...STW2.15) could not be completed because the sign-of-life is changing differently to how it was configured in the Tmapc time grid."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Ensure that the master correctly increments the sign-of-life in the master application clock cycle Tmapc."
        ],
        "fix": [
          "Ensure that the master correctly increments the sign-of-life in the master application clock cycle Tmapc."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.219, A1944)"
      },
      {
        "code": "A5000",
        "title": "Drive heat sink overtemperature",
        "symptom": "BOP shows A5000 (Drive heat sink overtemperature); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The alarm threshold for overtemperature at the inverter heat sink has been reached. If the temperature of the heat sink increases by an additional 5 K, then fault F30004 is initiated."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the following:"
        ],
        "fix": [
          "Is the surrounding temperature within the defined limit values?",
          "Have the load conditions and the load duty cycle been appropriately dimensioned?",
          "Has the cooling failed?"
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.219, A5000)"
      },
      {
        "code": "A7012",
        "title": "Motor temperature model 1/3 overtemperature",
        "symptom": "BOP shows A7012 (Motor temperature model 1/3 overtemperature); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The motor temperature model 1/3 identified that the alarm threshold was exceeded."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the motor load and reduce it if required.",
          "Check the motor surrounding temperature."
        ],
        "fix": [
          "Check the motor load and reduce it if required.",
          "Check the motor surrounding temperature."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.219, A7012)"
      },
      {
        "code": "A7530",
        "title": "Drive: Drive Data Set DDS not present",
        "symptom": "BOP shows A7530 (Drive: Drive Data Set DDS not present); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The selected drive data set is not available. The drive data set was not changed over."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Select the existing drive data set.",
          "Set up additional drive data sets."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.219, A7530)"
      },
      {
        "code": "A7565",
        "title": "Drive: Encoder error in PROFIdrive encoder interface 1",
        "symptom": "BOP shows A7565 (Drive: Encoder error in PROFIdrive encoder interface 1); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "An encoder error was signaled for encoder 1 via the PROFIdrive encoder interface (G1_ZSW.15)."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Acknowledge the encoder error using the encoder control word (G1_STW.15 = 1)."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.219, A7565)"
      },
      {
        "code": "A7576",
        "title": "Encoderless operation due to a fault active",
        "symptom": "BOP shows A7576 (Encoderless operation due to a fault active); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Encoderless operation is active due to a fault."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Remove the cause of a possible encoder fault.",
          "Carry out a POWER ON (power off/on) for all components."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.219, A7576)"
      },
      {
        "code": "A7582",
        "title": "Position actual value preprocessing error",
        "symptom": "BOP shows A7582 (Position actual value preprocessing error); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "An error has occurred during the position actual vaule preprocessing. I2t"
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the encoder for the position actual value preprocessing."
        ],
        "fix": [
          "Check the encoder for the position actual value preprocessing."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A7582)"
      },
      {
        "code": "A7805",
        "title": "Power unit overload I2t",
        "symptom": "BOP shows A7805 (Power unit overload I2t); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Alarm threshold for overload of the power unit exceeded."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the assignment of the rated currents of the motor and motor module."
        ],
        "fix": [
          "Reduce the continuous load.",
          "Adapt the load duty cycle."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A7805)"
      },
      {
        "code": "A7965",
        "title": "Save required",
        "symptom": "BOP shows A7965 (Save required); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The angular commutation offset was redefined and has still not been saved. In order to permanently accept the new value, it must be saved in a non-volatile fashion."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "This alarm automatically disappears after the data has been saved."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A7965)"
      },
      {
        "code": "A7971",
        "title": "Angular commutation offset determination activated",
        "symptom": "BOP shows A7971 (Angular commutation offset determination activated); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The automatic determination of the angular commutation offset (encoder adjustment) is activated. The automatic determination is carried out at the next power-on command."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "The alarm automatically disappears after determination."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A7971)"
      },
      {
        "code": "A7991",
        "title": "Motor data identification activated",
        "symptom": "BOP shows A7991 (Motor data identification activated); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The motor data ident. routine is activated. The motor data identification routine is carried out at the next power-on command."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "The alarm automatically disappears after the motor data identification routine has been successfully completed. If a POWER ON or a warm restart is performed with motor data identification selected, the motor data identification request will be lost. If motor data identification is required, it will need to be selected again manually following ramp-up."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A7991)"
      },
      {
        "code": "A8511",
        "title": "PROFIdrive: Receive configuration data invalid",
        "symptom": "BOP shows A8511 (PROFIdrive: Receive configuration data invalid); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The drive unit did not accept the receive configuration data."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the receive configuration data."
        ],
        "fix": [
          "Check the receive configuration data."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A8511)"
      },
      {
        "code": "A8526",
        "title": "PROFIdrive: No cyclic connection",
        "symptom": "BOP shows A8526 (PROFIdrive: No cyclic connection); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "There is no cyclic connection to the control."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the parameters \"Name of Station\" and \"IP of Station\" (r8930, r8931)."
        ],
        "fix": [
          "Establish the cyclic connection and activate the control with cyclic operation."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A8526)"
      },
      {
        "code": "A8565",
        "title": "PROFIdrive: Receive configuration data invalid",
        "symptom": "BOP shows A8565 (PROFIdrive: Receive configuration data invalid); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "A consistency error was detected when activating the configuration. Note: Currently set configuration has not been activated."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the required interface configuration, correct if necessary."
        ],
        "fix": [
          "Check the required interface configuration, correct if necessary."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A8565)"
      },
      {
        "code": "A30016",
        "title": "Load supply switched off",
        "symptom": "BOP shows A30016 (Load supply switched off); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The DC link voltage is too low."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the line supply if necessary."
        ],
        "fix": [
          "Switch on the load supply."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.220, A30016)"
      },
      {
        "code": "A30031",
        "title": "Hardware current limiting in phase U",
        "symptom": "BOP shows A30031 (Hardware current limiting in phase U); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Hardware current limit for phase U responded. The pulsing in this phase is inhibited for one pulse period.",
          "Closed-loop control is incorrectly parameterized.",
          "Fault in the motor or in the power cables.",
          "The power cables exceed the maximum permissible length.",
          "Motor load too high.",
          "Power unit defective. Note: Alarm A30031 is always output if, for a Power Module, the hardware current limiting of phase U, V or W responds."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the motor data. As an alternative, run a motor data identification.",
          "Check the motor circuit configuration (star-delta)",
          "Check the motor load.",
          "Check the power cable connections.",
          "Check the power cables for short-circuit or ground fault.",
          "Check the length of the power cables."
        ],
        "fix": [
          "Check the motor data. As an alternative, run a motor data identification.",
          "Check the motor circuit configuration (star-delta)",
          "Check the motor load.",
          "Check the power cable connections.",
          "Check the power cables for short-circuit or ground fault.",
          "Check the length of the power cables."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.221, A30031)"
      },
      {
        "code": "A31411",
        "title": "Encoder 1: Absolute encoder signals internal alarms",
        "symptom": "BOP shows A31411 (Encoder 1: Absolute encoder signals internal alarms); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The absolute encoder fault word includes alarm bits that have been set."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check the encoder cable connection and make sure the cables are routed in compliance with EMC.",
          "Check the motor temperature."
        ],
        "fix": [
          "Replace the encoder battery (for batterypowered encoder only).",
          "Replace the motor/encoder."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.221, A31411)"
      },
      {
        "code": "A31412",
        "title": "Error bit set in the serial protocol",
        "symptom": "BOP shows A31412 (Error bit set in the serial protocol); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The encoder sends a set error bit via the serial protocol."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics).",
          "Check that the cables are routed in compliance with EMC.",
          "Check the plug connections."
        ],
        "fix": [
          "Carry out a POWER ON (power off/on) for all components.",
          "Replace the encoder."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.221, A31412)"
      },
      {
        "code": "A52900",
        "title": "Failure during data copying",
        "symptom": "BOP shows A52900 (Failure during data copying); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Copying is halted.",
          "The micro SD card/SD card was plugged out.",
          "The drive is not in the stop state."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Re-plug in the micro SD card/SD card.",
          "Make sure the drive is in the stop state."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.221, A52900)"
      },
      {
        "code": "A52901",
        "title": "Braking resistor reaches alarm threshold",
        "symptom": "BOP shows A52901 (Braking resistor reaches alarm threshold); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "The heat capacity reaches the threshold (p29005) of the braking resistor capacity."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Change the external braking resistor.",
          "Increase deceleration time."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.221, A52901)"
      },
      {
        "code": "A52902",
        "title": "Emergency missing",
        "symptom": "BOP shows A52902 (Emergency missing); RDY LED flashes red at 1 Hz. Alarm: self-acknowledging when the cause is gone.",
        "causes": [
          "Implement servo on when the emergency input (EMGS) is switched off."
        ],
        "confirm": [
          "Read the fault/alarm on the BOP 6-digit display (faults have display priority over alarms) and the RDY LED (SINAMICS V90 PN Operating Instructions 04/2016 ch.11.1 Diagnostics)."
        ],
        "fix": [
          "Switch on the emergency input (EMGS) and then implement servo on."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90 PN Operating Instructions 04/2016, ch.11.2 List of faults and alarms, p.221, A52902)"
      }
    ],
    "sources": [
      "https://cache.industry.siemens.com/dl/files/880/109737880/att_884436/v1/SINAMICS_V90_PN_200V_400V_OPI_en-US_en-US.pdf (SINAMICS V90, SIMOTICS S-1FL6 Operating Instructions PROFINET interface 04/2016, A5E37208830: p.50, p.84-103, p.162-163, ch.11 p.203-221)"
    ]
  },
  {
    "id": "micro800-controller-error-codes",
    "title": "Allen-Bradley Micro800 controller (Micro820 / Micro850) fault types and error codes",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "Micro8"
    },
    "normal": [],
    "indicators": [
      {
        "name": "FAULT",
        "state": "off",
        "meaning": "No fault detected"
      },
      {
        "name": "FAULT",
        "state": "flashing red",
        "meaning": "Recoverable fault: clear it in Connected Components Workbench without a power cycle"
      },
      {
        "name": "FAULT",
        "state": "steady red",
        "meaning": "Nonrecoverable fault that requires a power cycle; then read the fault log and clear the fault"
      }
    ],
    "faults": [
      {
        "code": "0xF000",
        "title": "The controller was unexpectedly reset due to a noisy environment or an internal hardware f",
        "symptom": "Fault log / Diagnostics shows error code 0xF000 (Recoverable); FAULT LED flashing red. The controller was unexpectedly reset due to a noisy environment or an internal hardware failure. If _SYSVA_USER_DATA_LOST is set, the user program is recovered but user data is cleared; if not, the controller program is cleared.",
        "causes": [
          "The controller was unexpectedly reset due to a noisy environment or an internal hardware failure. If _SYSVA_USER_DATA_LOST is set, the user program is recovered but user data is cleared; if not, the controller program is cleared."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Check wiring to eliminate any noise.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.315; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF001",
        "title": "The controller program has been cleared",
        "symptom": "Fault log / Diagnostics shows error code 0xF001 (Recoverable); FAULT LED flashing red. The controller program has been cleared: a power-down occurred during program download or data transfer from the memory module, the cable was removed during program download, or the RAM integrity test failed.",
        "causes": [
          "The controller program has been cleared: a power-down occurred during program download or data transfer from the memory module, the cable was removed during program download, or the RAM integrity test failed."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Transfer the program using the memory module restore utility.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.315; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF002",
        "title": "The controller hardware watchdog was activated",
        "symptom": "Fault log / Diagnostics shows error code 0xF002 (Nonrecoverable); FAULT LED steady red (needs a power cycle). The controller hardware watchdog was activated (program scan more than 3 seconds). If _SYSVA_USER_DATA_LOST is set, user data is cleared; if not, the program is cleared.",
        "causes": [
          "The controller hardware watchdog was activated (program scan more than 3 seconds). If _SYSVA_USER_DATA_LOST is set, user data is cleared; if not, the program is cleared."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: steady red = nonrecoverable fault that requires a power cycle (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Nonrecoverable Faults: 1. Cycle power to the controller. 2. The controller goes to recoverable fault; optionally save the fault log. 3. Clear the recoverable fault in Connected Components Workbench. 4. If the program is lost, build and download it again. 5. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.315; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF003",
        "title": "The memory module hardware faulted, the memory module connection faulted, or the memory mo",
        "symptom": "Fault log / Diagnostics shows error code 0xF003 (Recoverable); FAULT LED flashing red. The memory module hardware faulted, the memory module connection faulted, or the memory module is incompatible with the controller firmware revision.",
        "causes": [
          "The memory module hardware faulted, the memory module connection faulted, or the memory module is incompatible with the controller firmware revision."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Remove the memory module and plug it in again.",
          "Obtain a new memory module.",
          "Upgrade the controller firmware revision to be compatible with the memory module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.315; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF004",
        "title": "A failure occurred during the memory module data transfer",
        "symptom": "Fault log / Diagnostics shows error code 0xF004 (Recoverable); FAULT LED flashing red. A failure occurred during the memory module data transfer.",
        "causes": [
          "A failure occurred during the memory module data transfer."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Attempt the data transfer again; if the error persists, replace the memory module.",
          "For Embedded RTC failure, restart the controller.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.315; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF005",
        "title": "The user program failed an integrity check while the controller was in Run mode",
        "symptom": "Fault log / Diagnostics shows error code 0xF005 (Recoverable); FAULT LED flashing red. The user program failed an integrity check while the controller was in Run mode.",
        "causes": [
          "The user program failed an integrity check while the controller was in Run mode."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Check wiring.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.315; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF006",
        "title": "The user program is incompatible with the controller's firmware revision",
        "symptom": "Fault log / Diagnostics shows error code 0xF006 (Recoverable); FAULT LED flashing red. The user program is incompatible with the controller's firmware revision.",
        "causes": [
          "The user program is incompatible with the controller's firmware revision."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Contact your local Rockwell Automation technical support representative.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.315; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF010",
        "title": "The user program contains a function/function block that is not supported by the controlle",
        "symptom": "Fault log / Diagnostics shows error code 0xF010 (Recoverable); FAULT LED flashing red. The user program contains a function/function block that is not supported by the controller.",
        "causes": [
          "The user program contains a function/function block that is not supported by the controller."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Contact your local Rockwell Automation technical support representative.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.315; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF014",
        "title": "A memory module memory error occurred",
        "symptom": "Fault log / Diagnostics shows error code 0xF014 (Recoverable); FAULT LED flashing red. A memory module memory error occurred.",
        "causes": [
          "A memory module memory error occurred."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Reprogram the memory module; if the error persists, replace the memory module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF015",
        "title": "An unexpected software error occurred",
        "symptom": "Fault log / Diagnostics shows error code 0xF015 (Nonrecoverable); FAULT LED steady red (needs a power cycle). An unexpected software error occurred.",
        "causes": [
          "An unexpected software error occurred."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: steady red = nonrecoverable fault that requires a power cycle (UM002 p.314-315)."
        ],
        "fix": [
          "Check wiring.",
          "See Corrective Actions for Nonrecoverable Faults: 1. Cycle power to the controller. 2. The controller goes to recoverable fault; optionally save the fault log. 3. Clear the recoverable fault in Connected Components Workbench. 4. If the program is lost, build and download it again. 5. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF016",
        "title": "An unexpected hardware error occurred",
        "symptom": "Fault log / Diagnostics shows error code 0xF016 (Nonrecoverable); FAULT LED steady red (needs a power cycle). An unexpected hardware error occurred.",
        "causes": [
          "An unexpected hardware error occurred."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: steady red = nonrecoverable fault that requires a power cycle (UM002 p.314-315)."
        ],
        "fix": [
          "Check wiring.",
          "See Corrective Actions for Nonrecoverable Faults: 1. Cycle power to the controller. 2. The controller goes to recoverable fault; optionally save the fault log. 3. Clear the recoverable fault in Connected Components Workbench. 4. If the program is lost, build and download it again. 5. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF017",
        "title": "An unexpected software error occurred due to an unexpected hardware interrupt",
        "symptom": "Fault log / Diagnostics shows error code 0xF017 (Nonrecoverable); FAULT LED steady red (needs a power cycle). An unexpected software error occurred due to an unexpected hardware interrupt (user program or user data may be cleared).",
        "causes": [
          "An unexpected software error occurred due to an unexpected hardware interrupt (user program or user data may be cleared)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: steady red = nonrecoverable fault that requires a power cycle (UM002 p.314-315)."
        ],
        "fix": [
          "Check wiring.",
          "See Corrective Actions for Nonrecoverable Faults: 1. Cycle power to the controller. 2. The controller goes to recoverable fault; optionally save the fault log. 3. Clear the recoverable fault in Connected Components Workbench. 4. If the program is lost, build and download it again. 5. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF018",
        "title": "An unexpected software error occurred due to SPI communication failure",
        "symptom": "Fault log / Diagnostics shows error code 0xF018 (Nonrecoverable); FAULT LED steady red (needs a power cycle). An unexpected software error occurred due to SPI communication failure (user program or user data may be cleared).",
        "causes": [
          "An unexpected software error occurred due to SPI communication failure (user program or user data may be cleared)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: steady red = nonrecoverable fault that requires a power cycle (UM002 p.314-315)."
        ],
        "fix": [
          "Check wiring.",
          "See Corrective Actions for Nonrecoverable Faults: 1. Cycle power to the controller. 2. The controller goes to recoverable fault; optionally save the fault log. 3. Clear the recoverable fault in Connected Components Workbench. 4. If the program is lost, build and download it again. 5. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF019",
        "title": "An unexpected software error occurred due to memory or other controller resource issue",
        "symptom": "Fault log / Diagnostics shows error code 0xF019 (Nonrecoverable); FAULT LED steady red (needs a power cycle). An unexpected software error occurred due to memory or other controller resource issue.",
        "causes": [
          "An unexpected software error occurred due to memory or other controller resource issue."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: steady red = nonrecoverable fault that requires a power cycle (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Nonrecoverable Faults: 1. Cycle power to the controller. 2. The controller goes to recoverable fault; optionally save the fault log. 3. Clear the recoverable fault in Connected Components Workbench. 4. If the program is lost, build and download it again. 5. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF01A",
        "title": "The controller was unexpectedly reset during Run Mode Change",
        "symptom": "Fault log / Diagnostics shows error code 0xF01A (Recoverable); FAULT LED flashing red. The controller was unexpectedly reset during Run Mode Change (RMC) due to a noisy environment or an internal hardware failure (user program or user data may be cleared).",
        "causes": [
          "The controller was unexpectedly reset during Run Mode Change (RMC) due to a noisy environment or an internal hardware failure (user program or user data may be cleared)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF020",
        "title": "The base hardware is faulted or is incompatible with the controller's firmware revision",
        "symptom": "Fault log / Diagnostics shows error code 0xF020 (Recoverable); FAULT LED flashing red. The base hardware is faulted or is incompatible with the controller's firmware revision.",
        "causes": [
          "The base hardware is faulted or is incompatible with the controller's firmware revision."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF021",
        "title": "The I/O configuration in the user program is invalid or does not exist in the controller",
        "symptom": "Fault log / Diagnostics shows error code 0xF021 (Recoverable); FAULT LED flashing red. The I/O configuration in the user program is invalid or does not exist in the controller.",
        "causes": [
          "The I/O configuration in the user program is invalid or does not exist in the controller."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF022",
        "title": "The user program in the memory module is incompatible with the controller's firmware revis",
        "symptom": "Fault log / Diagnostics shows error code 0xF022 (Recoverable); FAULT LED flashing red. The user program in the memory module is incompatible with the controller's firmware revision.",
        "causes": [
          "The user program in the memory module is incompatible with the controller's firmware revision."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Replace the memory module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF023",
        "title": "The controller program has been cleared",
        "symptom": "Fault log / Diagnostics shows error code 0xF023 (Nonrecoverable); FAULT LED steady red (needs a power cycle). The controller program has been cleared: a power down occurred during program download or transfer from the memory module, or the Flash Integrity Test failed (Micro810 only).",
        "causes": [
          "The controller program has been cleared: a power down occurred during program download or transfer from the memory module, or the Flash Integrity Test failed (Micro810 only)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: steady red = nonrecoverable fault that requires a power cycle (UM002 p.314-315)."
        ],
        "fix": [
          "Download or transfer the program.",
          "See Corrective Actions for Nonrecoverable Faults: 1. Cycle power to the controller. 2. The controller goes to recoverable fault; optionally save the fault log. 3. Clear the recoverable fault in Connected Components Workbench. 4. If the program is lost, build and download it again. 5. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF030",
        "title": "Power down information in persistent memory may not be written properly due to a noisy env",
        "symptom": "Fault log / Diagnostics shows error code 0xF030 (Recoverable); FAULT LED flashing red. Power down information in persistent memory may not be written properly due to a noisy environment or an internal hardware failure (user program or user data may be cleared).",
        "causes": [
          "Power down information in persistent memory may not be written properly due to a noisy environment or an internal hardware failure (user program or user data may be cleared)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF031",
        "title": "Power down information in persistent memory may not be written properly due to a noisy env",
        "symptom": "Fault log / Diagnostics shows error code 0xF031 (Recoverable); FAULT LED flashing red. Power down information in persistent memory may not be written properly due to a noisy environment or an internal hardware failure (user program or user data may be cleared).",
        "causes": [
          "Power down information in persistent memory may not be written properly due to a noisy environment or an internal hardware failure (user program or user data may be cleared)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF032",
        "title": "Power down information in persistent memory may not be written properly due to a noisy env",
        "symptom": "Fault log / Diagnostics shows error code 0xF032 (Recoverable); FAULT LED flashing red. Power down information in persistent memory may not be written properly due to a noisy environment or an internal hardware failure (user program or user data may be cleared).",
        "causes": [
          "Power down information in persistent memory may not be written properly due to a noisy environment or an internal hardware failure (user program or user data may be cleared)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF033",
        "title": "Power down information in persistent memory may not be written properly due to a noisy env",
        "symptom": "Fault log / Diagnostics shows error code 0xF033 (Recoverable); FAULT LED flashing red. Power down information in persistent memory may not be written properly due to a noisy environment or an internal hardware failure (user program or user data may be cleared).",
        "causes": [
          "Power down information in persistent memory may not be written properly due to a noisy environment or an internal hardware failure (user program or user data may be cleared)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF050",
        "title": "The embedded I/O configuration in the user program is invalid",
        "symptom": "Fault log / Diagnostics shows error code 0xF050 (Recoverable); FAULT LED flashing red. The embedded I/O configuration in the user program is invalid.",
        "causes": [
          "The embedded I/O configuration in the user program is invalid."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF100",
        "title": "General configuration error in the motion configuration downloaded from Connected Componen",
        "symptom": "Fault log / Diagnostics shows error code 0xF100 (Recoverable); FAULT LED flashing red. General configuration error in the motion configuration downloaded from Connected Components Workbench, such as number of axes or motion execution interval configured out of range.",
        "causes": [
          "General configuration error in the motion configuration downloaded from Connected Components Workbench, such as number of axes or motion execution interval configured out of range."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the axes configuration in the user program.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF110",
        "title": "Motion resource missing, such as Motion_DIAG variable not defined",
        "symptom": "Fault log / Diagnostics shows error code 0xF110 (Recoverable); FAULT LED flashing red. Motion resource missing, such as Motion_DIAG variable not defined.",
        "causes": [
          "Motion resource missing, such as Motion_DIAG variable not defined."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the axes configuration in the user program.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF12z",
        "title": "Motion configuration for axis z cannot be supported by this controller model, or the axis ",
        "symptom": "Fault log / Diagnostics shows error code 0xF12z (Recoverable); FAULT LED flashing red. Motion configuration for axis z cannot be supported by this controller model, or the axis configuration has a resource conflict with another motion axis configured earlier (z = logic axis ID 0…3).",
        "causes": [
          "Motion configuration for axis z cannot be supported by this controller model, or the axis configuration has a resource conflict with another motion axis configured earlier (z = logic axis ID 0…3)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Remove all axes and reconfigure motion with the guidance from the User Manual.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.316; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF15z",
        "title": "Motion engine logic error",
        "symptom": "Fault log / Diagnostics shows error code 0xF15z (Recoverable); FAULT LED flashing red. Motion engine logic error (firmware logic issue or memory crash) for one axis detected during motion engine cyclic operation (z = logic axis ID 0…3).",
        "causes": [
          "Motion engine logic error (firmware logic issue or memory crash) for one axis detected during motion engine cyclic operation (z = logic axis ID 0…3)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF210",
        "title": "The expansion I/O terminator is missing",
        "symptom": "Fault log / Diagnostics shows error code 0xF210 (Recoverable); FAULT LED flashing red. The expansion I/O terminator is missing.",
        "causes": [
          "The expansion I/O terminator is missing."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Power off the controller, attach the expansion I/O terminator (2085-ECR) on the last expansion I/O module, power on the controller.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF230",
        "title": "The maximum number of expansion I/O modules has been exceeded",
        "symptom": "Fault log / Diagnostics shows error code 0xF230 (Recoverable); FAULT LED flashing red. The maximum number of expansion I/O modules has been exceeded.",
        "causes": [
          "The maximum number of expansion I/O modules has been exceeded."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Power off the controller, check that the number of expansion I/O modules is not more than four, power on the controller.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF250",
        "title": "There is a nonrecoverable error and the expansion I/O modules could not be detected",
        "symptom": "Fault log / Diagnostics shows error code 0xF250 (Recoverable); FAULT LED flashing red. There is a nonrecoverable error and the expansion I/O modules could not be detected.",
        "causes": [
          "There is a nonrecoverable error and the expansion I/O modules could not be detected."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF26z",
        "title": "An expansion I/O master fault is detected on the system",
        "symptom": "Fault log / Diagnostics shows error code 0xF26z (Recoverable); FAULT LED flashing red. An expansion I/O master fault is detected on the system (z = expansion I/O slot number; z = 0: slot cannot be identified).",
        "causes": [
          "An expansion I/O master fault is detected on the system (z = expansion I/O slot number; z = 0: slot cannot be identified)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF27z",
        "title": "A nonrecoverable communication fault has occurred on the expansion I/O module",
        "symptom": "Fault log / Diagnostics shows error code 0xF27z (Recoverable); FAULT LED flashing red. A nonrecoverable communication fault has occurred on the expansion I/O module (z = slot number).",
        "causes": [
          "A nonrecoverable communication fault has occurred on the expansion I/O module (z = slot number)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Replace the slot number z module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF28z",
        "title": "Expansion I/O communication rate error",
        "symptom": "Fault log / Diagnostics shows error code 0xF28z (Recoverable); FAULT LED flashing red. Expansion I/O communication rate error (z = slot number).",
        "causes": [
          "Expansion I/O communication rate error (z = slot number)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Replace the slot number z module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF29z",
        "title": "A module fault is detected on your expansion I/O module",
        "symptom": "Fault log / Diagnostics shows error code 0xF29z (Recoverable); FAULT LED flashing red. A module fault is detected on your expansion I/O module (z = slot number).",
        "causes": [
          "A module fault is detected on your expansion I/O module (z = slot number)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Replace the slot number z module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF2Az",
        "title": "Expansion I/O power failure",
        "symptom": "Fault log / Diagnostics shows error code 0xF2Az (Recoverable); FAULT LED flashing red. Expansion I/O power failure (z = slot number).",
        "causes": [
          "Expansion I/O power failure (z = slot number)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Replace the slot number z module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF2Bz",
        "title": "Expansion I/O configuration fault",
        "symptom": "Fault log / Diagnostics shows error code 0xF2Bz (Recoverable); FAULT LED flashing red. Expansion I/O configuration fault (z = slot number).",
        "causes": [
          "Expansion I/O configuration fault (z = slot number)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the expansion I/O module configuration in the user program to match the actual hardware configuration.",
          "Check the expansion I/O module operation and condition.",
          "Replace the expansion I/O module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF300",
        "title": "The memory module is present but empty and a restore operation is requested",
        "symptom": "Fault log / Diagnostics shows error code 0xF300 (Recoverable); FAULT LED flashing red. The memory module is present but empty and a restore operation is requested.",
        "causes": [
          "The memory module is present but empty and a restore operation is requested."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Check that there is a valid project in the memory module.",
          "Download a user program and use the backup function to the memory module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF301",
        "title": "The memory module's project is not compatible with the controller",
        "symptom": "Fault log / Diagnostics shows error code 0xF301 (Recoverable); FAULT LED flashing red. The memory module's project is not compatible with the controller.",
        "causes": [
          "The memory module's project is not compatible with the controller."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Check that the user program has the correct controller catalog configured.",
          "Download a user program and use the backup function to the memory module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF302",
        "title": "The password is mismatched between memory module and controller",
        "symptom": "Fault log / Diagnostics shows error code 0xF302 (Recoverable); FAULT LED flashing red. The password is mismatched between memory module and controller (does not apply to firmware revision 10 and later).",
        "causes": [
          "The password is mismatched between memory module and controller (does not apply to firmware revision 10 and later)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Check that the user program in the memory module has the correct password.",
          "Use Connected Components Workbench to enter the correct password and perform the restore again.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF303",
        "title": "The memory module is not present and restore operation is requested",
        "symptom": "Fault log / Diagnostics shows error code 0xF303 (Recoverable); FAULT LED flashing red. The memory module is not present and restore operation is requested.",
        "causes": [
          "The memory module is not present and restore operation is requested."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Check that the memory module is present.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF0Az",
        "title": "The plug-in I/O module experienced an error during operation",
        "symptom": "Fault log / Diagnostics shows error code 0xF0Az (Recoverable); FAULT LED flashing red. The plug-in I/O module experienced an error during operation (z = plug-in slot number; z = 0: slot cannot be identified).",
        "causes": [
          "The plug-in I/O module experienced an error during operation (z = plug-in slot number; z = 0: slot cannot be identified)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Check the condition and operation of the plug-in I/O module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.317; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF0Bz",
        "title": "The plug-in I/O module configuration does not match the actual I/O configuration detected",
        "symptom": "Fault log / Diagnostics shows error code 0xF0Bz (Recoverable); FAULT LED flashing red. The plug-in I/O module configuration does not match the actual I/O configuration detected (z = plug-in slot).",
        "causes": [
          "The plug-in I/O module configuration does not match the actual I/O configuration detected (z = plug-in slot)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the plug-in I/O module configuration in the user program to match the actual hardware.",
          "Check the condition and operation of the plug-in I/O module.",
          "Replace the plug-in I/O module.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF0Dz",
        "title": "When power was applied to the plug-in I/O module or the plug-in I/O module was removed, a ",
        "symptom": "Fault log / Diagnostics shows error code 0xF0Dz (Recoverable); FAULT LED flashing red. When power was applied to the plug-in I/O module or the plug-in I/O module was removed, a hardware error occurred (z = plug-in slot).",
        "causes": [
          "When power was applied to the plug-in I/O module or the plug-in I/O module was removed, a hardware error occurred (z = plug-in slot)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the plug-in I/O module configuration in the user program.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF0Ez",
        "title": "The plug-in I/O module configuration does not match the actual I/O configuration detected",
        "symptom": "Fault log / Diagnostics shows error code 0xF0Ez (Recoverable); FAULT LED flashing red. The plug-in I/O module configuration does not match the actual I/O configuration detected (z = plug-in slot).",
        "causes": [
          "The plug-in I/O module configuration does not match the actual I/O configuration detected (z = plug-in slot)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the plug-in I/O module configuration in the user program.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF830",
        "title": "An error occurred in the EII configuration",
        "symptom": "Fault log / Diagnostics shows error code 0xF830 (Recoverable); FAULT LED flashing red. An error occurred in the EII configuration.",
        "causes": [
          "An error occurred in the EII configuration."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Review and change the EII configuration in the controller properties.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF840",
        "title": "An error occurred in the HSC configuration",
        "symptom": "Fault log / Diagnostics shows error code 0xF840 (Recoverable); FAULT LED flashing red. An error occurred in the HSC configuration.",
        "causes": [
          "An error occurred in the HSC configuration."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Review and change the configuration in the controller properties (manual text: EII configuration).",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF850",
        "title": "An error occurred in the STI configuration",
        "symptom": "Fault log / Diagnostics shows error code 0xF850 (Recoverable); FAULT LED flashing red. An error occurred in the STI configuration.",
        "causes": [
          "An error occurred in the STI configuration."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Review and change the configuration in the controller properties (manual text: EII configuration).",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF860",
        "title": "A data overflow occurred",
        "symptom": "Fault log / Diagnostics shows error code 0xF860 (Recoverable); FAULT LED flashing red. A data overflow occurred (ladder, structured text or function block diagram execution encountered a divide-by-zero).",
        "causes": [
          "A data overflow occurred (ladder, structured text or function block diagram execution encountered a divide-by-zero)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the program to verify that there is no data overflow.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF870",
        "title": "An index address was out of data space",
        "symptom": "Fault log / Diagnostics shows error code 0xF870 (Recoverable); FAULT LED flashing red. An index address was out of data space.",
        "causes": [
          "An index address was out of data space."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the program so no index accesses an array element beyond the array boundaries.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF0878",
        "title": "An index used to access a bit is beyond the boundaries of the data type it is used on",
        "symptom": "Fault log / Diagnostics shows error code 0xF0878 (Recoverable); FAULT LED flashing red. An index used to access a bit is beyond the boundaries of the data type it is used on.",
        "causes": [
          "An index used to access a bit is beyond the boundaries of the data type it is used on."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the program so no index accesses a bit beyond the boundaries of the data type.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF880",
        "title": "A data conversion error occurred",
        "symptom": "Fault log / Diagnostics shows error code 0xF880 (Recoverable); FAULT LED flashing red. A data conversion error occurred.",
        "causes": [
          "A data conversion error occurred."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the program to verify that there is no data conversion error.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF888",
        "title": "The call stack cannot support the sequence of calls to function blocks in the project",
        "symptom": "Fault log / Diagnostics shows error code 0xF888 (Recoverable); FAULT LED flashing red. The call stack cannot support the sequence of calls to function blocks in the project (too many blocks within another block).",
        "causes": [
          "The call stack cannot support the sequence of calls to function blocks in the project (too many blocks within another block)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Change the project to reduce the quantity of blocks being called within a block.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF898",
        "title": "An error occurred in the user interrupt configuration for the plug-in I/O module",
        "symptom": "Fault log / Diagnostics shows error code 0xF898 (Recoverable); FAULT LED flashing red. An error occurred in the user interrupt configuration for the plug-in I/O module.",
        "causes": [
          "An error occurred in the user interrupt configuration for the plug-in I/O module."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the user interrupt configuration for the plug-in I/O module to match the actual hardware configuration.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.318; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF8A0",
        "title": "The TOW parameters are invalid",
        "symptom": "Fault log / Diagnostics shows error code 0xF8A0 (Recoverable); FAULT LED flashing red. The TOW parameters are invalid.",
        "causes": [
          "The TOW parameters are invalid."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the program to verify that there are no invalid parameters.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.319; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF8A1",
        "title": "The DOY parameters are invalid",
        "symptom": "Fault log / Diagnostics shows error code 0xF8A1 (Recoverable); FAULT LED flashing red. The DOY parameters are invalid.",
        "causes": [
          "The DOY parameters are invalid."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Correct the program to verify that there are no invalid parameters.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.319; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xF8A3",
        "title": "Major fault on the controller when a Class 1 connection to the controller fails while in R",
        "symptom": "Fault log / Diagnostics shows error code 0xF8A3 (Recoverable); FAULT LED flashing red. Major fault on the controller when a Class 1 connection to the controller fails while in Run mode.",
        "causes": [
          "Major fault on the controller when a Class 1 connection to the controller fails while in Run mode."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Determine which Ethernet module has a faulted connection and correct the fault condition.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.319; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xFE60",
        "title": "An unknown major fault on the controller; the extended fault code is 0x0000",
        "symptom": "Fault log / Diagnostics shows error code 0xFE60 (Recoverable); FAULT LED flashing red. An unknown major fault on the controller; the extended fault code is 0x0000.",
        "causes": [
          "An unknown major fault on the controller; the extended fault code is 0x0000."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.319; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xFFzz",
        "title": "A user-created fault from Connected Components Workbench has occurred",
        "symptom": "Fault log / Diagnostics shows error code 0xFFzz (Recoverable); FAULT LED flashing red. A user-created fault from Connected Components Workbench has occurred (zz = last byte of the program number).",
        "causes": [
          "A user-created fault from Connected Components Workbench has occurred (zz = last byte of the program number)."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.319; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xD00F",
        "title": "A hardware type",
        "symptom": "Fault log / Diagnostics shows error code 0xD00F (Recoverable); FAULT LED flashing red. A hardware type (for example, embedded I/O) was selected in the user program configuration but did not match the actual hardware base.",
        "causes": [
          "A hardware type (for example, embedded I/O) was selected in the user program configuration but did not match the actual hardware base."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.319; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      },
      {
        "code": "0xD011",
        "title": "The program scan time exceeded the watchdog timeout value",
        "symptom": "Fault log / Diagnostics shows error code 0xD011 (Recoverable); FAULT LED flashing red. The program scan time exceeded the watchdog timeout value.",
        "causes": [
          "The program scan time exceeded the watchdog timeout value."
        ],
        "confirm": [
          "In Connected Components Workbench connect to the controller, right-click it in Project Organizer > Diagnose > Fault > Get Fault Log, and read the error code (UM002 p.320 Retrieve a Fault Log).",
          "Check the FAULT status LED: flashing red = recoverable fault (UM002 p.314-315)."
        ],
        "fix": [
          "Determine if the program is caught in a loop and correct the problem (for example a Structured Text For loop whose upper limit equals the maximum value of the variable).",
          "If the program is designed to scan longer than 3 seconds, increase the watchdog timeout in system variable _SYSVA_TCYWDG, then build and download.",
          "Correct the program, build and download it using Connected Components Workbench, then put the controller into Run mode.",
          "See Corrective Actions for Recoverable Faults: 1. Optionally save the fault log from Connected Components Workbench. 2. Clear the recoverable fault using Connected Components Workbench. 3. If the problem persists, contact technical support with the fault log (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E Appendix D, Table 126 List of Error Codes for Micro800 Controllers, p.319; corrective actions p.320); same list in https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (2080-UM005H Table 64, p.150-155)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (Micro830, Micro850, and Micro870 Programmable Controllers User Manual 2080-UM002S-EN-E, Apr 2026, Appendix D p.313-320)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (Micro820 Programmable Controllers User Manual 2080-UM005H-EN-E, Sep 2025, Appendix B p.149-155)"
    ]
  },
  {
    "id": "micro850-controller",
    "title": "Allen-Bradley Micro850 (2080-L50E) controller: power, embedded I/O, status LEDs",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "Micro850"
    },
    "normal": [
      {
        "terminals": "+DC24 to -DC24 (output terminal block, terminals 1-2)",
        "state": "powered",
        "meter": "VDC",
        "expected": "21.4…26.4V DC Class 2",
        "pins": [
          [
            "+DC24",
            "-DC24"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.14 General Specifications - Micro850; terminal names https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf p.51-53. Do not connect -DC24 to earth/chassis ground"
      },
      {
        "terminals": "I-xx to its input common COM0 / COM1 (24V DC sink/source inputs, QBB/QWB/QVB)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "standard DC input 10…30.0V DC @ 30 °C (10…26.4V DC @ 65 °C), 8.5 mA nom @ 24V; high-speed DC input 16.8…30.0V DC @ 30 °C. Polarity depends on sinking/sourcing wiring",
        "pins": [
          [
            "I-00",
            "COM0"
          ],
          [
            "I-01",
            "COM0"
          ],
          [
            "I-02",
            "COM0"
          ],
          [
            "I-03",
            "COM0"
          ],
          [
            "I-04",
            "COM0"
          ],
          [
            "I-05",
            "COM0"
          ],
          [
            "I-06",
            "COM0"
          ],
          [
            "I-07",
            "COM0"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.15 Input Specifications - Micro850; wiring https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf p.51-53 (24-point: COM0 for I-00…I-07, COM1 for I-08…I-13)"
      },
      {
        "terminals": "I-xx to COM0 / COM1 (DC inputs)",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "5V DC max; off-state current 1.5 mA max",
        "pins": [
          [
            "I-00",
            "COM0"
          ],
          [
            "I-08",
            "COM1"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.15"
      },
      {
        "terminals": "+CM0 to -CM0 (QBB/QVB DC output supply)",
        "state": "output group powered",
        "meter": "VDC",
        "expected": "10…26.4V DC (high-speed outputs 10.8V DC min)",
        "pins": [
          [
            "+CM0",
            "-CM0"
          ],
          [
            "+CM1",
            "-CM1"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.16 Output Specifications - Micro850; terminals https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf p.52"
      },
      {
        "terminals": "+CM0 to O-00 (QBB 24V DC source outputs)",
        "state": "output ON",
        "meter": "VDC",
        "expected": "on-state voltage drop 1V max at max load current (high-speed 1.5V); 1.0 A max @ 30 °C, 0.3 A @ 65 °C per point",
        "pins": [
          [
            "+CM0",
            "O-00"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.16"
      },
      {
        "terminals": "CMx to O-xx (QWB/AWB relay outputs)",
        "state": "output ON",
        "meter": "continuity",
        "expected": "contact closed; rated 5V…125V DC / 5V…265V AC, 2.0 A max per point, 5 A per common",
        "pins": [
          [
            "CM0",
            "O-00"
          ],
          [
            "CM1",
            "O-01"
          ],
          [
            "CM2",
            "O-02"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.16 Relay Output Specifications - Micro850; 24-point terminals https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf p.51"
      }
    ],
    "pairs": [
      {
        "a": "CM0",
        "b": "O-00",
        "when": "output O-00 ON",
        "note": "2080-L50E-24QWB/24AWB relay output (UM002 p.51 wiring diagram; TD001 p.16)"
      },
      {
        "a": "CM1",
        "b": "O-01",
        "when": "output O-01 ON",
        "note": "24-point relay controllers"
      },
      {
        "a": "CM2",
        "b": "O-02",
        "when": "output O-02 ON",
        "note": "24-point relay controllers"
      },
      {
        "a": "+CM0",
        "b": "O-00",
        "when": "output O-00 ON",
        "note": "2080-L50E-24QBB/48QBB 24V DC source output (UM002 p.52-53; TD001 p.16)"
      },
      {
        "a": "+CM0",
        "b": "O-01",
        "when": "output O-01 ON",
        "note": "QBB source outputs"
      }
    ],
    "indicators": [
      {
        "name": "Input status (one per input)",
        "state": "off / on",
        "meaning": "off: input not energized; on: input energized (terminal status)"
      },
      {
        "name": "POWER",
        "state": "off",
        "meaning": "No input power, or power error condition"
      },
      {
        "name": "POWER",
        "state": "green",
        "meaning": "Power on"
      },
      {
        "name": "RUN",
        "state": "off",
        "meaning": "Not executing the user program"
      },
      {
        "name": "RUN",
        "state": "green",
        "meaning": "Executing the user program in run mode"
      },
      {
        "name": "RUN",
        "state": "flashing green",
        "meaning": "Memory backup/restore in progress"
      },
      {
        "name": "FAULT",
        "state": "red / flashing red",
        "meaning": "red: nonrecoverable fault (power cycle); flashing red: recoverable fault"
      },
      {
        "name": "FORCE",
        "state": "amber",
        "meaning": "Force conditions are active (off: no forces)"
      },
      {
        "name": "Serial communications",
        "state": "green (blinks)",
        "meaning": "Traffic through RS-232/RS-485 (blinks only when transmitting)"
      },
      {
        "name": "Output status (one per output)",
        "state": "off / on",
        "meaning": "off: output not energized; on: output energized (logic status)"
      },
      {
        "name": "Module status",
        "state": "steady green / flashing green",
        "meaning": "Device operational / standby"
      },
      {
        "name": "Module status",
        "state": "flashing red / steady red",
        "meaning": "Minor fault (minor and major recoverable) / major fault (nonrecoverable)"
      },
      {
        "name": "Module status",
        "state": "flashing green and red",
        "meaning": "Power-on self test (POST)"
      },
      {
        "name": "Network status",
        "state": "steady off",
        "meaning": "Not powered or no IP address"
      },
      {
        "name": "Network status",
        "state": "flashing green",
        "meaning": "IP address configured, no Ethernet application connected"
      },
      {
        "name": "Network status",
        "state": "steady green",
        "meaning": "At least one EtherNet/IP session established"
      },
      {
        "name": "Network status",
        "state": "steady red",
        "meaning": "Duplicate IP address detected (ACD enabled)"
      }
    ],
    "faults": [
      {
        "title": "Input LED never turns on (DC input)",
        "symptom": "Sensor operates but the input status LED stays off and the tag does not change.",
        "causes": [
          "Input common COM0/COM1 not wired to the correct supply side for the chosen sinking/sourcing configuration",
          "Input voltage below the on-state range",
          "Open wire"
        ],
        "confirm": [
          "Measure I-xx to its COMx with the sensor active: 10…30V DC means ON for standard inputs (16.8V min for high-speed inputs); 5V DC or less is OFF (TD001 p.15)."
        ],
        "fix": [
          "Wire the common per the DC Input Configuration (sinking: -DC to COMx; sourcing: +DC to COMx) in the controller wiring diagram (UM002 p.51-53)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf (2080-TD001E p.15); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S p.51-53)"
      },
      {
        "title": "Controller not running (RUN LED off)",
        "symptom": "POWER on, RUN off.",
        "causes": [
          "Controller in program mode",
          "Fault present (FAULT LED red or flashing red)"
        ],
        "confirm": [
          "Check the FAULT LED and read the fault log in Connected Components Workbench (UM002 p.314, p.320)."
        ],
        "fix": [
          "Clear the fault per its error code and put the controller into Run mode (UM002 p.320)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S Appendix D p.313-320)"
      },
      {
        "title": "No power (POWER LED off)",
        "symptom": "POWER LED off.",
        "causes": [
          "No input power or power error condition"
        ],
        "confirm": [
          "Measure +DC24 to -DC24: expect 21.4…26.4V DC (TD001 p.14)."
        ],
        "fix": [
          "Restore a 24V DC Class 2 supply within range."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (p.314 Status Indicator Description); https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf (p.14)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (2080-UM002S-EN-E: p.51-53 wiring diagrams, Appendix D p.313-320)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf (Micro800 Programmable Controllers Technical Data 2080-TD001E-EN-P, Sep 2025, p.14-16)"
    ]
  },
  {
    "id": "micro820-controller",
    "title": "Allen-Bradley Micro820 (2080-LC20 / 2080-L20E) controller: power, embedded I/O, status LEDs",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "Micro820"
    },
    "normal": [
      {
        "terminals": "+DC24 to -DC24 (output terminal block)",
        "state": "powered",
        "meter": "VDC",
        "expected": "20.4…26.4 V DC, Class 2",
        "pins": [
          [
            "+DC24",
            "-DC24"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.10 General Specifications - Micro820; terminals https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf p.40-43. The -DC24 terminals on the input and output blocks are internally shorted; do not earth -DC24"
      },
      {
        "terminals": "I-04…I-11 to COM0 (isolated 24V DC sink/source inputs, QBB/QWB)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "10…30V DC @ 30 °C (10…26.4V DC @ 65 °C), 8.5 mA @ 24V DC",
        "pins": [
          [
            "I-04",
            "COM0"
          ],
          [
            "I-05",
            "COM0"
          ],
          [
            "I-06",
            "COM0"
          ],
          [
            "I-07",
            "COM0"
          ],
          [
            "I-08",
            "COM0"
          ],
          [
            "I-09",
            "COM0"
          ],
          [
            "I-10",
            "COM0"
          ],
          [
            "I-11",
            "COM0"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.12 DC Input Specifications; https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf p.40-44 (Table 13 names the common CM0, diagrams label it COM0)"
      },
      {
        "terminals": "I-04…I-11 to COM0",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "5V DC max (1.5 mA max off-state current)",
        "pins": [
          [
            "I-04",
            "COM0"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.12"
      },
      {
        "terminals": "I-00…I-03 to -DC24 (non-isolated inputs shared with analog, 24V DC sink only)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "9.8…26.4V DC (OFF: 5V DC max)",
        "pins": [
          [
            "I-00",
            "-DC24"
          ],
          [
            "I-01",
            "-DC24"
          ],
          [
            "I-02",
            "-DC24"
          ],
          [
            "I-03",
            "-DC24"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.12; https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf p.40-41"
      },
      {
        "terminals": "+CM0 to -CM0 / +CM1 to -CM1 (QBB 24V DC source outputs supply)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10…26.4V DC user supply",
        "pins": [
          [
            "+CM0",
            "-CM0"
          ],
          [
            "+CM1",
            "-CM1"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.12 DC Output Specifications - QBB; terminals https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf p.43"
      },
      {
        "terminals": "+CMx to O-xx (QBB source output)",
        "state": "output ON",
        "meter": "VDC",
        "expected": "on-state voltage drop 1V max at max load (O-06 high-speed 1.5V); 1.0 A @ 30 °C, 0.3 A @ 65 °C per point",
        "pins": [
          [
            "+CM0",
            "O-00"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.12"
      },
      {
        "terminals": "CMx to O-xx (QWB relay outputs)",
        "state": "output ON",
        "meter": "continuity",
        "expected": "contact closed; 5V AC/DC min, 250V AC max",
        "pins": [
          [
            "CM0",
            "O-00"
          ],
          [
            "CM1",
            "O-01"
          ],
          [
            "CM2",
            "O-02"
          ],
          [
            "CM3",
            "O-04"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf p.12 Relay Output Specifications; https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf p.41-43 Tables 12/14"
      }
    ],
    "pairs": [
      {
        "a": "CM0",
        "b": "O-00",
        "when": "output O-00 ON",
        "note": "QWB/AWB relay (UM005 Table 12/14: CM0 → O-00)"
      },
      {
        "a": "CM1",
        "b": "O-01",
        "when": "output O-01 ON",
        "note": "CM1 → O-01"
      },
      {
        "a": "CM2",
        "b": "O-02",
        "when": "output O-02 ON",
        "note": "CM2 → O-02, O-03"
      },
      {
        "a": "CM2",
        "b": "O-03",
        "when": "output O-03 ON"
      },
      {
        "a": "CM3",
        "b": "O-04",
        "when": "output O-04 ON",
        "note": "CM3 → O-04, O-05, O-06"
      },
      {
        "a": "CM3",
        "b": "O-05",
        "when": "output O-05 ON"
      },
      {
        "a": "CM3",
        "b": "O-06",
        "when": "output O-06 ON"
      }
    ],
    "indicators": [
      {
        "name": "Input status",
        "state": "off / on",
        "meaning": "off: input is low; on: input energized (terminal status)"
      },
      {
        "name": "Fault status",
        "state": "off",
        "meaning": "No fault detected"
      },
      {
        "name": "Fault status",
        "state": "red",
        "meaning": "Non-recoverable fault that requires a power cycle"
      },
      {
        "name": "Fault status",
        "state": "flashing red",
        "meaning": "Recoverable fault"
      },
      {
        "name": "Run status",
        "state": "green",
        "meaning": "Executing the user program in run mode"
      },
      {
        "name": "Run status",
        "state": "flashing green (1 Hz)",
        "meaning": "Program mode or performing a restore operation"
      },
      {
        "name": "Serial comm status",
        "state": "green (blinks)",
        "meaning": "Traffic through RS-232/RS-485 (transmitting)"
      },
      {
        "name": "Force status",
        "state": "amber",
        "meaning": "Force conditions active"
      },
      {
        "name": "SD status",
        "state": "off",
        "meaning": "microSD not inserted, bad medium/file system, read/write failure, or ConfigMeFirst.txt errors"
      },
      {
        "name": "SD status",
        "state": "on / blinking",
        "meaning": "on: card initialized / read-write complete; blinking: card being read or written"
      },
      {
        "name": "ENET status",
        "state": "steady off",
        "meaning": "Not powered or no Ethernet link"
      },
      {
        "name": "ENET status",
        "state": "flashing green",
        "meaning": "Link but no IP address yet, or duplicate IP detected (ACD enabled)"
      },
      {
        "name": "ENET status",
        "state": "steady green",
        "meaning": "Ethernet link active with valid IP address"
      },
      {
        "name": "Output status",
        "state": "off / on",
        "meaning": "off: output not energized; on: output energized (logic status)"
      }
    ],
    "faults": [
      {
        "title": "Input LED never turns on (isolated DC input)",
        "symptom": "Sensor operates but the input LED stays off.",
        "causes": [
          "COM0 wired to the wrong supply side for the sinking/sourcing configuration",
          "Inputs I-00…I-03 wired as sourcing (they support sinking only)",
          "Open wire or low voltage"
        ],
        "confirm": [
          "Measure I-04…I-11 to COM0 with the sensor active: 10…30V DC = ON, 5V DC or less = OFF (TD001 p.12).",
          "For I-00…I-03 measure to -DC24: 9.8…26.4V DC = ON."
        ],
        "fix": [
          "Wire per the DC Sinking / Sourcing Input Configuration diagrams (UM005 p.42-44)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf (p.12); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (p.40-44)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um005_-en-e.pdf (Micro820 Programmable Controllers User Manual 2080-UM005H-EN-E: p.40-44 wiring, Appendix B p.149-155)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/2080-td001_-en-p.pdf (2080-TD001E-EN-P p.10-12)"
    ]
  },
  {
    "id": "micro800-2085-expansion-io",
    "title": "Allen-Bradley Micro800 2085 expansion I/O modules (2085-IQ16, -OB16, -OW16, -IF4, -OF4, -ECR)",
    "match": {
      "categories": [
        "plcModule"
      ],
      "family": "Micro800",
      "partNumber": "^2085-"
    },
    "normal": [
      {
        "terminals": "I-xx to COM0 / COM1 (2085-IQ16; COM0 for I-00…I-07, COM1 for I-08…I-15)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "10…30V DC (sink/source) or 21.6…26.4V AC; on-state current 1.8 mA min @ 10V DC, 6.0 mA nom @ 24V DC",
        "pins": [
          [
            "I-00",
            "COM0"
          ],
          [
            "I-08",
            "COM1"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in001_-en-p.pdf (2085-IN001F) p.10 wiring, p.13 Input Specifications"
      },
      {
        "terminals": "I-xx to COM0 / COM1 (2085-IQ16)",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "5V DC max; 1.5 mA max off-state current",
        "pins": [
          [
            "I-00",
            "COM0"
          ],
          [
            "I-08",
            "COM1"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in001_-en-p.pdf p.13"
      },
      {
        "terminals": "+CM0 to -CM0 / +CM1 to -CM1 (2085-OB16 24V DC source output supply)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10…30V DC (24V DC nom); 0.5 A @ 30V DC per output, 8 A per module",
        "pins": [
          [
            "+CM0",
            "-CM0"
          ],
          [
            "+CM1",
            "-CM1"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in003_-en-p.pdf (2085-IN003G) p.6 wiring, p.7 Output Specifications"
      },
      {
        "terminals": "CMx to O-xx (2085-OW16 relay; CM0: O-00/O-01, CM1: O-02/O-03 … CM7: O-14/O-15)",
        "state": "output ON",
        "meter": "continuity",
        "expected": "contact closed; 2 A max load, 10 mA min per point; off-state leakage 1.5 mA max",
        "pins": [
          [
            "CM0",
            "O-00"
          ],
          [
            "CM0",
            "O-01"
          ],
          [
            "CM1",
            "O-02"
          ]
        ],
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in004_-en-p.pdf (2085-IN004F) p.9-10"
      }
    ],
    "pairs": [
      {
        "a": "CM0",
        "b": "O-00",
        "when": "output O-00 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM0",
        "b": "O-01",
        "when": "output O-01 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM1",
        "b": "O-02",
        "when": "output O-02 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM1",
        "b": "O-03",
        "when": "output O-03 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM2",
        "b": "O-04",
        "when": "output O-04 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM2",
        "b": "O-05",
        "when": "output O-05 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM3",
        "b": "O-06",
        "when": "output O-06 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM3",
        "b": "O-07",
        "when": "output O-07 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM4",
        "b": "O-08",
        "when": "output O-08 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM4",
        "b": "O-09",
        "when": "output O-09 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM5",
        "b": "O-10",
        "when": "output O-10 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM5",
        "b": "O-11",
        "when": "output O-11 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM6",
        "b": "O-12",
        "when": "output O-12 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM6",
        "b": "O-13",
        "when": "output O-13 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM7",
        "b": "O-14",
        "when": "output O-14 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "CM7",
        "b": "O-15",
        "when": "output O-15 ON",
        "note": "2085-OW8/OW16 relay output (2085-IN004 p.9 Basic Wiring)"
      },
      {
        "a": "+CM0",
        "b": "O-00",
        "when": "output O-00 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM0",
        "b": "O-01",
        "when": "output O-01 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM0",
        "b": "O-02",
        "when": "output O-02 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM0",
        "b": "O-03",
        "when": "output O-03 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM0",
        "b": "O-04",
        "when": "output O-04 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM0",
        "b": "O-05",
        "when": "output O-05 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM0",
        "b": "O-06",
        "when": "output O-06 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM0",
        "b": "O-07",
        "when": "output O-07 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM1",
        "b": "O-08",
        "when": "output O-08 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM1",
        "b": "O-09",
        "when": "output O-09 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM1",
        "b": "O-10",
        "when": "output O-10 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM1",
        "b": "O-11",
        "when": "output O-11 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM1",
        "b": "O-12",
        "when": "output O-12 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM1",
        "b": "O-13",
        "when": "output O-13 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM1",
        "b": "O-14",
        "when": "output O-14 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      },
      {
        "a": "+CM1",
        "b": "O-15",
        "when": "output O-15 ON",
        "note": "2085-OB16 source output (2085-IN003 p.6)"
      }
    ],
    "indicators": [
      {
        "name": "I/O status (yellow, one per point; 2085-IQ16/OB16/OW16)",
        "state": "on / off",
        "meaning": "On/Off state of the input or output point"
      },
      {
        "name": "Channel status (red, 2085-IF4/IF8)",
        "state": "off",
        "meaning": "Channel disabled, or enabled with no data error / not under- or over-range"
      },
      {
        "name": "Channel status (red, 2085-IF4/IF8)",
        "state": "red",
        "meaning": "Channel enabled and a data error is present, the connection is open, or a configured Low / Low Low / High / High High alarm is triggered (read IO_Xx_ST_yy)"
      },
      {
        "name": "Health (green, 2085-IF4/OF4)",
        "state": "green",
        "meaning": "1 green health indicator per module (2085-IN006)"
      }
    ],
    "faults": [
      {
        "title": "Expansion bus terminator missing",
        "symptom": "Controller faults with 0xF210 after adding 2085 modules.",
        "causes": [
          "No 2085-ECR bus terminator on the last expansion I/O module"
        ],
        "confirm": [
          "Check that a 2085-ECR is fitted to the last expansion module (UM003 p.7: required whenever an expansion I/O module is connected)."
        ],
        "fix": [
          "Power off, attach the 2085-ECR to the last expansion I/O module, power on (UM002 Table 126, 0xF210)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um003_-en-p.pdf (2080-UM003D p.7); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um002_-en-e.pdf (p.317)"
      },
      {
        "title": "Analog input channel red LED",
        "symptom": "2085-IF4 channel LED red.",
        "causes": [
          "Open input connection",
          "Data error",
          "Configured under/over-range alarm triggered"
        ],
        "confirm": [
          "Read the analog input status in Global Variables IO_Xx_ST_yy (x = expansion slot 1…4, yy = status word 00…02) (UM003 p.15 Table 10)."
        ],
        "fix": [
          "Repair the open wire or correct the signal so it is within the configured range."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um003_-en-p.pdf (2080-UM003D p.15 Table 10)"
      },
      {
        "title": "DC input does not turn on (2085-IQ16)",
        "symptom": "Field device active, yellow LED off.",
        "causes": [
          "Common COM0/COM1 not wired",
          "Voltage below the on-state range"
        ],
        "confirm": [
          "Measure I-xx to its COM: ON needs 10…30V DC; 5V DC or less is OFF (2085-IN001 p.13)."
        ],
        "fix": [
          "Wire the group common per the Basic Wiring diagram (2085-IN001 p.10)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in001_-en-p.pdf (2085-IN001F p.10, p.13)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/2080-um003_-en-p.pdf (Micro800 Expansion I/O Modules User Manual 2080-UM003D-EN-P p.7, p.11-15)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in001_-en-p.pdf (2085-IN001F)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in003_-en-p.pdf (2085-IN003G)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in004_-en-p.pdf (2085-IN004F)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/2085-in006_-en-p.pdf (2085-IN006)"
    ]
  },
  {
    "id": "compactlogix-5380-controller",
    "title": "Allen-Bradley CompactLogix 5380 (5069-L3xxER) controller: power, status indicators, major fault and I/O fault codes",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "CompactLogix 5380"
    },
    "normal": [
      {
        "terminals": "MOD power RTB 24V(+) to 24V(-)",
        "state": "powered",
        "meter": "VDC",
        "expected": "18…32V DC (valid MOD power); MOD power bus 10 A max continuous",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf p.31, p.250; RTB labels https://literature.rockwellautomation.com/idc/groups/literature/documents/in/5069-in013_-en-p.pdf (5069-IN013K) p.6 MOD Power RTB Wiring Diagram"
      },
      {
        "terminals": "SA power RTB (+) to (–)",
        "state": "powered",
        "meter": "VDC",
        "expected": "18…32V DC for DC applications (18…240V AC where AC SA power is used); SA bus 10 A max continuous",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf p.32, p.250"
      },
      {
        "terminals": "Status display",
        "state": "normal run",
        "meter": "display",
        "expected": "RUN steady green, OK steady green; display scrolls project name, IP address, port rate",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf p.242-248"
      }
    ],
    "indicators": [
      {
        "name": "RUN",
        "state": "off",
        "meaning": "Program or Test mode"
      },
      {
        "name": "RUN",
        "state": "steady green",
        "meaning": "Run mode"
      },
      {
        "name": "FORCE",
        "state": "off",
        "meaning": "No I/O force values and forces not enabled"
      },
      {
        "name": "FORCE",
        "state": "steady yellow",
        "meaning": "I/O forces enabled; any force values are active"
      },
      {
        "name": "FORCE",
        "state": "flashing yellow",
        "meaning": "I/O forces exist but are not enabled"
      },
      {
        "name": "SD",
        "state": "off",
        "meaning": "No SD card activity"
      },
      {
        "name": "SD",
        "state": "flashing / steady green",
        "meaning": "Reading from or writing to the SD card: do not remove"
      },
      {
        "name": "SD",
        "state": "flashing red",
        "meaning": "SD card does not have a valid file system"
      },
      {
        "name": "SD",
        "state": "steady red",
        "meaning": "SD card not recognized"
      },
      {
        "name": "OK",
        "state": "off",
        "meaning": "No power applied"
      },
      {
        "name": "OK",
        "state": "flashing red",
        "meaning": "Firmware update required or in progress, or a major fault has occurred (all user tasks stopped)"
      },
      {
        "name": "OK",
        "state": "steady red",
        "meaning": "Power-up diagnostics, ESM discharging at powerdown, powered but inoperable, loading project to NVS, or Hardware Preservation Fault (overtemperature)"
      },
      {
        "name": "OK",
        "state": "steady green",
        "meaning": "Operating normally"
      },
      {
        "name": "NET",
        "state": "off",
        "meaning": "Not configured / no IP address, or port disabled"
      },
      {
        "name": "NET",
        "state": "flashing green",
        "meaning": "IP address but no active connections"
      },
      {
        "name": "NET",
        "state": "steady green",
        "meaning": "IP address and at least one active connection"
      },
      {
        "name": "NET",
        "state": "steady red",
        "meaning": "Duplicate IP address or invalid configuration"
      },
      {
        "name": "LINK",
        "state": "off",
        "meaning": "No link (check RJ45 cables), port disabled, or (LINK A2) rapid ring fault as DLR supervisor"
      },
      {
        "name": "LINK",
        "state": "flashing green",
        "meaning": "Port enabled, link, activity"
      },
      {
        "name": "LINK",
        "state": "steady green",
        "meaning": "Link, no traffic (single port) / normal ring (dual port)"
      },
      {
        "name": "MOD power",
        "state": "off / steady green",
        "meaning": "Module power not present / present (valid is 18…32V DC)"
      },
      {
        "name": "SA power",
        "state": "off / steady green",
        "meaning": "Sensor actuator power not present or unknown / present"
      },
      {
        "name": "4-character status display",
        "state": "shows TEST",
        "meaning": "Controller conducting power-up tests"
      },
      {
        "name": "4-character status display",
        "state": "shows CHRG",
        "meaning": "Embedded energy storage circuit is charging"
      },
      {
        "name": "4-character status display",
        "state": "shows PASS",
        "meaning": "Power-up tests completed"
      },
      {
        "name": "4-character status display",
        "state": "shows SAVE",
        "meaning": "Project being saved to the SD card: do not remove the card or power"
      },
      {
        "name": "4-character status display",
        "state": "shows LOAD",
        "meaning": "Project being loaded from the SD card: do not remove the card or power"
      },
      {
        "name": "4-character status display",
        "state": "shows UPDT",
        "meaning": "Firmware update from the SD card at power-up"
      },
      {
        "name": "4-character status display",
        "state": "shows No Project",
        "meaning": "No project loaded: download or load from SD card"
      },
      {
        "name": "4-character status display",
        "state": "shows Link Down",
        "meaning": "Ethernet port has no connection"
      },
      {
        "name": "4-character status display",
        "state": "shows Link Disabled",
        "meaning": "Ethernet port disabled"
      },
      {
        "name": "4-character status display",
        "state": "shows Duplicate IP - 00:00:XX:XX:XX:XX",
        "meaning": "Another device has the same IP address"
      },
      {
        "name": "4-character status display",
        "state": "shows BUSY",
        "meaning": "Associated I/O modules not yet fully powered"
      },
      {
        "name": "4-character status display",
        "state": "shows Backup Energy Low - Save Project",
        "meaning": "Embedded storage cannot save on powerdown: save to SD card, then replace the controller"
      },
      {
        "name": "4-character status display",
        "state": "shows Backup Energy HW Failure - Save Project",
        "meaning": "Embedded storage circuit failure: save to SD card, then replace the controller"
      },
      {
        "name": "4-character status display",
        "state": "shows Firmware Installation Required",
        "meaning": "Controller is on boot firmware and needs a firmware update"
      },
      {
        "name": "4-character status display",
        "state": "shows Major Fault TXX:CXX message",
        "meaning": "Major fault of type XX code XX"
      },
      {
        "name": "4-character status display",
        "state": "shows I/O Fault Local:X #XXXX message",
        "meaning": "I/O fault on a module in the local chassis (slot X, fault code XXXX)"
      },
      {
        "name": "4-character status display",
        "state": "shows X I/O Faults",
        "meaning": "X I/O faults present; the first reported is shown"
      }
    ],
    "faults": [
      {
        "code": "T01:C01",
        "title": "Power-up Fault: Power lost and restored in RUN mode.",
        "symptom": "Status display scrolls \"Major Fault T01:C01 …\"; OK LED flashing red; all user tasks stopped. The controller that is powered on is in Run mode.",
        "causes": [
          "The controller that is powered on is in Run mode."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Execute the power-up handler."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 1 Code 1); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T01:C40",
        "title": "Power-up Fault: Energy Storage Module/Battery failed during power down.",
        "symptom": "Status display scrolls \"Major Fault T01:C40 …\"; OK LED flashing red; all user tasks stopped. If the controller uses a battery, the battery does not contain enough charge to save the user program on power-down.\n\nIf the controller uses an ESM (Energy Storage Module), the ESM does not contain enough charge to save the user program on power-down.",
        "causes": [
          "If the controller uses a battery, the battery does not contain enough charge to save the user program on power-down.\n\nIf the controller uses an ESM (Energy Storage Module), the ESM does not contain enough charge to save the user program on power-down."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "For controllers that use a battery, replace the battery.",
          "For controllers that use an ESM (Energy Storage Module):",
          "Allow the ESM to charge fully before powering down the controller.",
          "Replace the ESM if the ESM is removable, or replace the controller if the ESM is not removable.",
          "If the problem persists, contact Rockwell Automation support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 1 Code 40); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T01:C60",
        "title": "Power-up Fault: Non-recoverable fault.",
        "symptom": "Status display scrolls \"Major Fault T01:C60 …\"; OK LED flashing red; all user tasks stopped. The controller detected a nonrecoverable major fault. Diagnostic information can be recovered.",
        "causes": [
          "The controller detected a nonrecoverable major fault. Diagnostic information can be recovered."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Insert a memory card in the controller and restart the controller to write diagnostic information to the memory card. Then clear the fault and download the application. Contact Rockwell Automation support and provide the 9-character code from the scrolling status display on the controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 1 Code 60); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T01:C61",
        "title": "Power-up Fault: Non-recoverable fault with saved diagnostic information.",
        "symptom": "Status display scrolls \"Major Fault T01:C61 …\"; OK LED flashing red; all user tasks stopped. The controller detected a nonrecoverable major fault. Diagnostic information can be recovered.",
        "causes": [
          "The controller detected a nonrecoverable major fault. Diagnostic information can be recovered."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Insert a memory card in the controller and restart the controller to write diagnostic information to the memory card. Then clear the fault and download the application. Contact Rockwell Automation support and provide the 9-character code from the scrolling status display on the controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 1 Code 61); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T01:C62",
        "title": "Power-up Fault: Non-recoverable fault with saved diagnostic information and stored user program.",
        "symptom": "Status display scrolls \"Major Fault T01:C62 …\"; OK LED flashing red; all user tasks stopped. The controller detected a nonrecoverable major fault. Diagnostic information can be recovered.",
        "causes": [
          "The controller detected a nonrecoverable major fault. Diagnostic information can be recovered."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Insert a memory card in the controller and restart the controller to write diagnostic information to the memory card. Then clear the fault and download the application. Contact Rockwell Automation support and provide the 9-character code from the scrolling status display on the controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 1 Code 62); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T03:C16",
        "title": "I/O Fault: I/O module connection failed on required module.",
        "symptom": "Status display scrolls \"Major Fault T03:C16 …\"; OK LED flashing red; all user tasks stopped. A required I/O module connection failed.",
        "causes": [
          "A required I/O module connection failed."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify the following:",
          "The I/O module is in the chassis.",
          "Electronic keying requirements.",
          "Controller Properties Major Fault tab and the Module Properties Connection tab for more information about the fault."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 3 Code 16); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T03:C23",
        "title": "I/O Fault: At least one required connection not established before going into RUN mode.",
        "symptom": "Status display scrolls \"Major Fault T03:C23 …\"; OK LED flashing red; all user tasks stopped. At least one I/O module configured for Major fault On Controller If Connection Fails While in Run Mode was not established before going to Run mode within the time defined below:\n\n5380/5580 controllers:\n • Non-redundant controller: 30 seconds\n • Redundant controllers: 90 seconds\n\n5590 controllers:\n • Non-redundant controller: 60 seconds\n • Redundant controllers: 120 seconds",
        "causes": [
          "At least one I/O module configured for Major fault On Controller If Connection Fails While in Run Mode was not established before going to Run mode within the time defined below:\n\n5380/5580 controllers:\n • Non-redundant controller: 30 seconds\n • Redundant controllers: 90 seconds\n\n5590 controllers:\n • Non-redundant controller: 60 seconds\n • Redundant controllers: 120 seconds"
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Wait for the controller I/O light to turn green before changing to Run mode."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 3 Code 23); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C16",
        "title": "Program Fault: Unknown instruction encountered.",
        "symptom": "Status display scrolls \"Major Fault T04:C16 …\"; OK LED flashing red; all user tasks stopped. Unknown instruction encountered.",
        "causes": [
          "Unknown instruction encountered."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Remove the unknown instruction. This probably happened due to a program conversion process."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 16); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C20",
        "title": "Program Fault: Array subscript too large, or CONTROL data type POS or LEN invalid.",
        "symptom": "Status display scrolls \"Major Fault T04:C20 …\"; OK LED flashing red; all user tasks stopped. The array subscript is too large or the control data type .POS or .LEN value is invalid.",
        "causes": [
          "The array subscript is too large or the control data type .POS or .LEN value is invalid."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Adjust the value to be within the valid range. Do not exceed the array size or go beyond the dimensions defined."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 20); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C21",
        "title": "Program Fault: CONTROL data type LEN or POS less than 0.",
        "symptom": "Status display scrolls \"Major Fault T04:C21 …\"; OK LED flashing red; all user tasks stopped. Control structure .LEN or .POS < 0.",
        "causes": [
          "Control structure .LEN or .POS < 0."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Adjust the value so it is > 0."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 21); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C31",
        "title": "Program Fault: JSR or RET did not pass as many parameters as expected.",
        "symptom": "Status display scrolls \"Major Fault T04:C31 …\"; OK LED flashing red; all user tasks stopped. The parameters of the JSR instruction do not match those of the associated SBR or RET instruction.",
        "causes": [
          "The parameters of the JSR instruction do not match those of the associated SBR or RET instruction."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Pass the appropriate number of parameters. If you pass too many parameters, the extra ones are ignored without any error."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 31); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C34",
        "title": "Program Fault: A timer instruction had a negative value for its PRE or ACC.",
        "symptom": "Status display scrolls \"Major Fault T04:C34 …\"; OK LED flashing red; all user tasks stopped. A timer instruction has a negative preset or accumulated value.",
        "causes": [
          "A timer instruction has a negative preset or accumulated value."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Fix the program so that it cannot load a negative value into the timer preset or accumulated value."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 34); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C42",
        "title": "Program Fault: JMP to a label that did not exist or was deleted.",
        "symptom": "Status display scrolls \"Major Fault T04:C42 …\"; OK LED flashing red; all user tasks stopped. JMP to a label that did not exist or was deleted.",
        "causes": [
          "JMP to a label that did not exist or was deleted."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Correct the JMP target or add the missing label."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 42); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C82",
        "title": "Program Fault: Could not re-enter an executing SFC routine.",
        "symptom": "Status display scrolls \"Major Fault T04:C82 …\"; OK LED flashing red; all user tasks stopped. A sequential function chart (SFC) called a subroutine and the subroutine tried to jump back to the calling SFC. This occurs when the SFC uses either a JSR or FOR instruction to call the subroutine.",
        "causes": [
          "A sequential function chart (SFC) called a subroutine and the subroutine tried to jump back to the calling SFC. This occurs when the SFC uses either a JSR or FOR instruction to call the subroutine."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Remove the jump back to the calling SFC."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 82); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C83",
        "title": "Program Fault: Value out of range.",
        "symptom": "Status display scrolls \"Major Fault T04:C83 …\"; OK LED flashing red; all user tasks stopped. The data tested was not inside the required limits. This occurs with array subscripts used with Boolean arrays and bit level addressing.",
        "causes": [
          "The data tested was not inside the required limits. This occurs with array subscripts used with Boolean arrays and bit level addressing."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Adjust the value to be within the valid range. Do not exceed the array size or go beyond the dimensions defined."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 83); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C84",
        "title": "Program Fault: Stack overflow. Stack too small to perform operation.",
        "symptom": "Status display scrolls \"Major Fault T04:C84 …\"; OK LED flashing red; all user tasks stopped. Stack overflow.",
        "causes": [
          "Stack overflow."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Reduce the subroutine-nesting levels or the number of parameters passed."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 84); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C85",
        "title": "Program Fault: Invalid routine type.",
        "symptom": "Status display scrolls \"Major Fault T04:C85 …\"; OK LED flashing red; all user tasks stopped. Invalid routine type.",
        "causes": [
          "Invalid routine type."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Use a valid routine type."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 85); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C89",
        "title": "Program Fault: Target step does not exist in specified routine.",
        "symptom": "Status display scrolls \"Major Fault T04:C89 …\"; OK LED flashing red; all user tasks stopped. In an SFR instruction, the target routine does not contain the target step.",
        "causes": [
          "In an SFR instruction, the target routine does not contain the target step."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Correct the SFR target or add the missing step."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 89); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C90",
        "title": "Program Fault: A safety instruction occurs outside a safety task.",
        "symptom": "Status display scrolls \"Major Fault T04:C90 …\"; OK LED flashing red; all user tasks stopped. A safety instruction occurred outside a safety task.",
        "causes": [
          "A safety instruction occurred outside a safety task."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Only use the instruction in a safety task."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 90); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C91",
        "title": "Program Fault: Equipment phase instruction cannot be called from a program.",
        "symptom": "Status display scrolls \"Major Fault T04:C91 …\"; OK LED flashing red; all user tasks stopped. Equipment Phase instruction is being called from outside an Equipment Phase program.",
        "causes": [
          "Equipment Phase instruction is being called from outside an Equipment Phase program."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Only use the instruction in an Equipment Phase program."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 91); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C94",
        "title": "Program Fault: Nesting limits exceeded.",
        "symptom": "Status display scrolls \"Major Fault T04:C94 …\"; OK LED flashing red; all user tasks stopped. Nesting limits exceeded.",
        "causes": [
          "Nesting limits exceeded."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Restructure the project to reduce the subroutine-nesting levels."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 94); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C990",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C990 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 990); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C991",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C991 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 991); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C992",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C992 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 992); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C993",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C993 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 993); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C994",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C994 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 994); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C995",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C995 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 995); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C996",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C996 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 996); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C997",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C997 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 997); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C998",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C998 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 998); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T04:C999",
        "title": "Program Fault: User-defined fault.",
        "symptom": "Status display scrolls \"Major Fault T04:C999 …\"; OK LED flashing red; all user tasks stopped. User-defined major fault.",
        "causes": [
          "User-defined major fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "User-defined action."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 4 Code 999); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T06:C01",
        "title": "Watchdog Fault: Task watchdog expired. May have been caused by an infinite loop, a complex program, or a higher priority task.",
        "symptom": "Status display scrolls \"Major Fault T06:C01 …\"; OK LED flashing red; all user tasks stopped. User task has not completed in the specified period. A program error caused an infinite loop, or the program is too complex to run as quickly as specified, or a higher priority task is keeping this task from finishing.",
        "causes": [
          "User task has not completed in the specified period. A program error caused an infinite loop, or the program is too complex to run as quickly as specified, or a higher priority task is keeping this task from finishing."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Take one or more of these steps:",
          "Increase the task watchdog.",
          "Shorten the execution time.",
          "Make the priority of this task higher.",
          "Simplify higher priority tasks.",
          "Move some code to another controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 6 Code 1); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T07:C40",
        "title": "Nonvolatile Fault: Store to nonvolatile memory failed.",
        "symptom": "Status display scrolls \"Major Fault T07:C40 …\"; OK LED flashing red; all user tasks stopped. Store to nonvolatile memory failed.",
        "causes": [
          "Store to nonvolatile memory failed."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "1. Try again to store the project to nonvolatile memory.",
          "2. If the project fails to store to nonvolatile memory, replace the memory card. If you are using a 1756-L7x controller, verify that the memory card is unlocked."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 7 Code 40); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T07:C41",
        "title": "Nonvolatile Fault: Load from nonvolatile memory failed due to controller type mismatch.",
        "symptom": "Status display scrolls \"Major Fault T07:C41 …\"; OK LED flashing red; all user tasks stopped. Load from nonvolatile memory failed due to controller type mismatch.",
        "causes": [
          "Load from nonvolatile memory failed due to controller type mismatch."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Change to a controller of the correct type or download the project and store it on the memory card."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 7 Code 41); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T07:C42",
        "title": "Nonvolatile Fault: Load from nonvolatile memory failed due to controller revision mismatch.",
        "symptom": "Status display scrolls \"Major Fault T07:C42 …\"; OK LED flashing red; all user tasks stopped. Load from nonvolatile memory failed because the firmware revision of the project in nonvolatile memory does not match the firmware revision of the controller.",
        "causes": [
          "Load from nonvolatile memory failed because the firmware revision of the project in nonvolatile memory does not match the firmware revision of the controller."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Update the controller firmware to the same revision level as the project that is in nonvolatile memory."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 7 Code 42); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T07:C43",
        "title": "Nonvolatile Fault: Load from nonvolatile memory failed due to bad checksum.",
        "symptom": "Status display scrolls \"Major Fault T07:C43 …\"; OK LED flashing red; all user tasks stopped. Load from nonvolatile memory failed due to bad checksum.",
        "causes": [
          "Load from nonvolatile memory failed due to bad checksum."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 7 Code 43); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T07:C44",
        "title": "Nonvolatile Fault: Failed to restore processor memory.",
        "symptom": "Status display scrolls \"Major Fault T07:C44 …\"; OK LED flashing red; all user tasks stopped. Failed to restore controller memory.",
        "causes": [
          "Failed to restore controller memory."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 7 Code 44); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T07:C50",
        "title": "Nonvolatile Fault: Security certificate invalid.",
        "symptom": "Status display scrolls \"Major Fault T07:C50 …\"; OK LED flashing red; all user tasks stopped. The log file certificate cannot be verified. When the controller starts up, it attempts to verify the log file key/certificate combination. Depending on the verification, the controller takes one of the following actions:\n• If the controller verifies the existing log file certificate, the controller continues with the existing log directory.\n• If the existing certificate cannot be verified, the controller logs a major fault and attempts to create a certificate.\n• If the controller successfully creates a certificate, it creates a backup log subdirectory, moves the existing files to that directory, and continues logging and signing with the new verification key and log file certificate.\n• If the controller cannot create a certificate, the controller writes log entries to the existing log directory, but does not update signature files in that directory.",
        "causes": [
          "The log file certificate cannot be verified. When the controller starts up, it attempts to verify the log file key/certificate combination. Depending on the verification, the controller takes one of the following actions:\n• If the controller verifies the existing log file certificate, the controller continues with the existing log directory.\n• If the existing certificate cannot be verified, the controller logs a major fault and attempts to create a certificate.\n• If the controller successfully creates a certificate, it creates a backup log subdirectory, moves the existing files to that directory, and continues logging and signing with the new verification key and log file certificate.\n• If the controller cannot create a certificate, the controller writes log entries to the existing log directory, but does not update signature files in that directory."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Clear the fault and power cycle the controller. If the problem persists, contact Rockwell Automation support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 7 Code 50); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T08:C01",
        "title": "Mode Change Fault: Mode Change inhibited due to download in progress.",
        "symptom": "Status display scrolls \"Major Fault T08:C01 …\"; OK LED flashing red; all user tasks stopped. Attempted to place controller in Run mode with keyswitch during download.",
        "causes": [
          "Attempted to place controller in Run mode with keyswitch during download."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Wait for the download to complete and clear the fault."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 8 Code 1); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T11:C32",
        "title": "Motion Fault: Motion Task overlap. Coarse update rate too high.",
        "symptom": "Status display scrolls \"Major Fault T11:C32 …\"; OK LED flashing red; all user tasks stopped. The motion task experienced an overlap. The coarse update rate is too high.",
        "causes": [
          "The motion task experienced an overlap. The coarse update rate is too high."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The group’s course update rate is too high to maintain correct operation. Clear the group fault tag, raise the group’s update rate, and then clear the major fault."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 11 Code 32); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T11:C33",
        "title": "Motion Fault: Coordinated System Time reference has been lost.",
        "symptom": "Status display scrolls \"Major Fault T11:C33 …\"; OK LED flashing red; all user tasks stopped. Coordinated System Time reference has been lost.",
        "causes": [
          "Coordinated System Time reference has been lost."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check the condition of the CST master in the backplane."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 11 Code 33); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T17:C34",
        "title": "Diagnostic Fault: Controller internal temperature has exceeded operating limit.",
        "symptom": "Status display scrolls \"Major Fault T17:C34 …\"; OK LED flashing red; all user tasks stopped. Controller internal temperature has exceeded the operating limit.",
        "causes": [
          "Controller internal temperature has exceeded the operating limit."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Take measures to reduce the ambient temperature of the module. Follow the recommended limits for the ambient (inlet) temperature and apply the required clearance around the chassis."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 17 Code 34); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T17:C37",
        "title": "Diagnostic Fault: Controller has recovered from an internal temperature fault.",
        "symptom": "Status display scrolls \"Major Fault T17:C37 …\"; OK LED flashing red; all user tasks stopped. The controller has recovered from an internal temperature fault.",
        "causes": [
          "The controller has recovered from an internal temperature fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Generated when the controller recovers from automatic shutdown. Shutdown occurs when the module temperature exceeds the temperature threshold of the preservation fault. When the temperature decreases to a suitable level, this re-enables the controller voltages and generates the Type 17, Code 37 fault."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 17 Code 37); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C01",
        "title": "CIP Motion Fault: A standard Initialization Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C01 …\"; OK LED flashing red; all user tasks stopped. The drive did not initialize correctly.",
        "causes": [
          "The drive did not initialize correctly."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To determine corrective action, see the Initialization Fault attributes. The corresponding bit indicates the cause of the fault.",
          "1: Boot Block Checksum Fault",
          "2: Main Block Checksum Fault",
          "3: Nonvolatile Memory Checksum Fault"
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 1); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C02",
        "title": "CIP Motion Fault: A manufacturer specific Initialization Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C02 …\"; OK LED flashing red; all user tasks stopped. The drive did not initialized correctly. This fault indicates a manufacturer-specific initialization fault.",
        "causes": [
          "The drive did not initialized correctly. This fault indicates a manufacturer-specific initialization fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To determine corrective action, see the Initialization Fault Mfg attributes. The corresponding bit indicates the cause of the fault.",
          "1: Feedback Data Corruption",
          "2: Feedback Data Range",
          "3: Feedback Communication Startup",
          "4: Feedback Absolute Overspeed",
          "5: Feedback Absolute Power Off Travel",
          "6: Feedback Absolute Startup Speed",
          "7: Commutation Offset Uninitialized",
          "12: Invalid FPGA Image",
          "14: Invalid Safety Firmware",
          "15: Power Board",
          "16: Illegal Option Card",
          "17: Option Storage Checksum",
          "19: Module Voltage Mismatch",
          "20: Unknown Module",
          "21: Factory Configuration Error",
          "22: Illegal Address",
          "23: Series Mismatch",
          "24: Open Slot"
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 2); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C03",
        "title": "CIP Motion Fault: A standard Axis Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C03 …\"; OK LED flashing red; all user tasks stopped. There is a fault on the physical axis.",
        "causes": [
          "There is a fault on the physical axis."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To determine corrective action, see the Axis Fault attributes. The corresponding bit indicates the cause of the fault."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 3); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C04",
        "title": "CIP Motion Fault: A manufacturer specific Axis Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C04 …\"; OK LED flashing red; all user tasks stopped. There is a fault on the physical axis. This fault indicates a manufacturer-specific axis fault",
        "causes": [
          "There is a fault on the physical axis. This fault indicates a manufacturer-specific axis fault"
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To determine corrective action, see the Axis Fault Mfg attributes. The corresponding bit indicates the cause of the fault."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 4); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C05",
        "title": "CIP Motion Fault: A Motion Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C05 …\"; OK LED flashing red; all user tasks stopped. A motion fault detected.",
        "causes": [
          "A motion fault detected."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To determine corrective action, see the Motion Fault attribute and Motion Fault bits for details about the fault that occurred."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 5); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C06",
        "title": "CIP Motion Fault: A Module Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C06 …\"; OK LED flashing red; all user tasks stopped. A motion drive fault detected.\nUsually the fault affects all axes that are associated with the module and all associated axes are shut down.",
        "causes": [
          "A motion drive fault detected.\nUsually the fault affects all axes that are associated with the module and all associated axes are shut down."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Reconfigure the faulted motion module to correct the fault."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 6); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C07",
        "title": "CIP Motion Fault: Group Fault",
        "symptom": "Status display scrolls \"Major Fault T18:C07 …\"; OK LED flashing red; all user tasks stopped. A motion group fault detected.\nUsually the fault affects all axes that are associated with a motion group.",
        "causes": [
          "A motion group fault detected.\nUsually the fault affects all axes that are associated with a motion group."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Reconfigure the entire motion subsystem to correct the fault.",
          "See the Group Fault attribute if details about the fault are needed."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 7); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C08",
        "title": "CIP Motion Fault: A Configuration Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C08 …\"; OK LED flashing red; all user tasks stopped. A fault occurred during the configuration of a motion drive.\nTypically, this fault occurs when an attempt to update an axis configuration attribute of a drive was unsuccessful.",
        "causes": [
          "A fault occurred during the configuration of a motion drive.\nTypically, this fault occurs when an attempt to update an axis configuration attribute of a drive was unsuccessful."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To determine the corrective action, see the Configuration Fault in the Attribute Error Code and Attribute Error ID attributes associated with the motion or 1756-ENxT module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 8); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C09",
        "title": "CIP Motion Fault: A standard APR Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C09 …\"; OK LED flashing red; all user tasks stopped. An Absolute Position Recovery (APR) fault occurred and the absolute position of the axis cannot be recovered.",
        "causes": [
          "An Absolute Position Recovery (APR) fault occurred and the absolute position of the axis cannot be recovered."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To determine the corrective action, see the APR Fault attributes. The corresponding bit indicates the cause of the fault.",
          "1: Memory Write Error",
          "2: Memory Read Error",
          "3: Feedback Serial Number Mismatch",
          "4: Buffer Allocation Fault",
          "5: Scaling Configuration Changed",
          "6: Feedback Mode Changed",
          "7: Feedback Integrity Loss"
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 9); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T18:C10",
        "title": "CIP Motion Fault: A manufacturer specific APR Fault has been detected by the drive.",
        "symptom": "Status display scrolls \"Major Fault T18:C10 …\"; OK LED flashing red; all user tasks stopped. An Absolute Position Recovery (APR) Fault occurred and the absolute position of the axis cannot be recovered. This fault indicates a manufacturer-specific APR fault.",
        "causes": [
          "An Absolute Position Recovery (APR) Fault occurred and the absolute position of the axis cannot be recovered. This fault indicates a manufacturer-specific APR fault."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To determine the corrective action, see the APR Fault Mfg attributes. The corresponding bit indicates the cause of the fault."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 18 Code 10); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "T20:C01",
        "title": "License Fault: License is missing or invalid.",
        "symptom": "Status display scrolls \"Major Fault T20:C01 …\"; OK LED flashing red; all user tasks stopped. A required license is missing or expired during the transition to Run or Test mode.",
        "causes": [
          "A required license is missing or expired during the transition to Run or Test mode."
        ],
        "confirm": [
          "Read the major fault on the 4-character scrolling status display (Major Fault TXX:CXX message) and on the Major Faults tab of Controller Properties in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Insert a CmCard which contains all licenses that are required by the project in the controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheet 'Logix 5000 Controllers', Type 20 Code 1); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246)"
      },
      {
        "code": "#0001",
        "title": "Connection failure",
        "symptom": "Status display scrolls \"I/O Fault <module> #0001 Connection failure\"; I/O fault on a local or remote module. A connection to a module failed.",
        "causes": [
          "A connection to a module failed."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Extended status codes in these ranges provide more detail as to the connection failure."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0001); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0002",
        "title": "Resource unavailable",
        "symptom": "Status display scrolls \"I/O Fault <module> #0002 Resource unavailable\"; I/O fault on a local or remote module. Possible causes include the following.\n• There are not enough connections available either for the controller or for the communication module being used to connect through.\n• The I/O memory limits of the controller are exceeded.\n• The I/O module that is targeted does not have enough connections available.",
        "causes": [
          "Possible causes include the following.\n• There are not enough connections available either for the controller or for the communication module being used to connect through.\n• The I/O memory limits of the controller are exceeded.\n• The I/O module that is targeted does not have enough connections available."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check the connection use of the controller or communication module. If all connections are used, try to free some of the used connections or add another module to route the errant connection through.",
          "Check the I/O memory available and make program or tag changes if needed.",
          "Check the number of controllers making a connection to this I/O module and verify that the number of connections is within the limits of the I/O module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0002); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0003",
        "title": "Invalid value in an object specific data parameter of a service request",
        "symptom": "Status display scrolls \"I/O Fault <module> #0003 Invalid value in an object specific data parameter of a service request\"; I/O fault on a local or remote module. A parameter that is associated with the request was invalid.",
        "causes": [
          "A parameter that is associated with the request was invalid."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Possible causes include the following:",
          "The physical module in use is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options were used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0003); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0004",
        "title": "Connection Request Error: Bad Segment",
        "symptom": "Status display scrolls \"I/O Fault <module> #0004 Connection Request Error: Bad Segment\"; I/O fault on a local or remote module. IOI segment error on connection request.",
        "causes": [
          "IOI segment error on connection request."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The target module does not like one of the parameters in the connection request. This may occur if improper module keying is being used or if the wrong map type attribute is set in the map entry."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0004); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0005",
        "title": "Connection Request Error: Bad Class",
        "symptom": "Status display scrolls \"I/O Fault <module> #0005 Connection Request Error: Bad Class\"; I/O fault on a local or remote module. The controller is attempting to make a connection to the module and has received an error.",
        "causes": [
          "The controller is attempting to make a connection to the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Possible causes include the following:",
          "The configured address for the connection to the module is incorrect.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options were used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of Logix Designer application. For more information about electronic keying, see the user manual for the module you are using.",
          "If you are using a 1756-DHRIO module, verify that the Channel type selected in the software (DH+ or remote I/O network) matches the module’s rotary switch settings."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0005); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0006",
        "title": "Partial data transferred",
        "symptom": "Status display scrolls \"I/O Fault <module> #0006 Partial data transferred\"; I/O fault on a local or remote module. Only part of the expected data was transferred.",
        "causes": [
          "Only part of the expected data was transferred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Possible causes include the following.",
          "The response buffer is too small to handle the response data.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passed the electronic keying test. This may result when Disable Keying or Compatible Keying options were used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0006); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0007",
        "title": "Messaging connection lost",
        "symptom": "Status display scrolls \"I/O Fault <module> #0007 Messaging connection lost\"; I/O fault on a local or remote module. The messaging connection was lost.",
        "causes": [
          "The messaging connection was lost."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "A service request is unconnected, but should be connected."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0007); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0008",
        "title": "Service Request Error: Unsupported Service",
        "symptom": "Status display scrolls \"I/O Fault <module> #0008 Service Request Error: Unsupported Service\"; I/O fault on a local or remote module. The controller is attempting to request a service from the module that is not supported by the module.",
        "causes": [
          "The controller is attempting to request a service from the module that is not supported by the module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Possible causes include the following:",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passed the electronic keying test. This may result when Disable Keying or Compatible Keying options were used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0008); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0009",
        "title": "Module Configuration Rejected: Parameter Error",
        "symptom": "Status display scrolls \"I/O Fault <module> #0009 Module Configuration Rejected: Parameter Error\"; I/O fault on a local or remote module. The configuration for the module is invalid. The module configuration may have been changed in the Data Monitor or programmatically.",
        "causes": [
          "The configuration for the module is invalid. The module configuration may have been changed in the Data Monitor or programmatically."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Additional Fault Information for this fault will be displayed as a hex code on the Connection Tab. If available for the module, open the Connections tab of the Module Properties dialog box for the additional fault code. The additional fault code indicates the configuration parameter that is causing the fault. You may have to correct multiple parameters before this fault is cleared and the module is connected.",
          "Verify that the configuration is valid by using the module configuration software to validate your configuration. Consult the module documentation for a list of fault codes to determine the configuration parameter that is in error."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0009); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#000A",
        "title": "An attribute in the Get_Attributes_List or Set_Attributes_List has a non-zero status",
        "symptom": "Status display scrolls \"I/O Fault <module> #000A An attribute in the Get_Attributes_List or Set_Attributes_List has a non-zero status\"; I/O fault on a local or remote module. Possible causes include the following.\n• A connection is being created where the connection type is invalid.\n• An object attribute or tag value is invalid.",
        "causes": [
          "Possible causes include the following.\n• A connection is being created where the connection type is invalid.\n• An object attribute or tag value is invalid."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "If an object attribute or tag is invalid, export the Logix Designer application file, then re-import it. Reschedule the ControlNet network after re-importing if applicable."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x000A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#000B",
        "title": "Object already in requested mode or state",
        "symptom": "Status display scrolls \"I/O Fault <module> #000B Object already in requested mode or state\"; I/O fault on a local or remote module. The object is already in the mode/state being requested by the service.",
        "causes": [
          "The object is already in the mode/state being requested by the service."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "You do not have to request a mode/state because the object is already in the requested mode/state."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x000B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#000C",
        "title": "Service Request Error: Invalid mode or state for service request",
        "symptom": "Status display scrolls \"I/O Fault <module> #000C Service Request Error: Invalid mode or state for service request\"; I/O fault on a local or remote module. The controller is attempting to request a service from the module and has received an error.",
        "causes": [
          "The controller is attempting to request a service from the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "First, verify that the module is not faulted.",
          "For an I/O module, this may indicate that the module has one of the following conditions:",
          "Limited communication is possible, but the module has a Major Fault.",
          "A firmware update needs to be completed or is currently being completed.",
          "Refer to the Module Info tab to determine the exact cause."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x000C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#000D",
        "title": "Object already exists",
        "symptom": "Status display scrolls \"I/O Fault <module> #000D Object already exists\"; I/O fault on a local or remote module. An object instance is created where the instance already exists.",
        "causes": [
          "An object instance is created where the instance already exists."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Use a different object instance number."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x000D); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#000E",
        "title": "Attribute value not settable",
        "symptom": "Status display scrolls \"I/O Fault <module> #000E Attribute value not settable\"; I/O fault on a local or remote module. A MSG instruction is configured to change an attribute that cannot be changed.",
        "causes": [
          "A MSG instruction is configured to change an attribute that cannot be changed."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "See the device user manual for available programming options."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x000E); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#000F",
        "title": "Access permission denied for requested service",
        "symptom": "Status display scrolls \"I/O Fault <module> #000F Access permission denied for requested service\"; I/O fault on a local or remote module. A MSG instruction has been configured to delete a map object that cannot be deleted.",
        "causes": [
          "A MSG instruction has been configured to delete a map object that cannot be deleted."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "See the device user manual for available programming options."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x000F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0010",
        "title": "Mode or state of module does not allow object to perform requested service",
        "symptom": "Status display scrolls \"I/O Fault <module> #0010 Mode or state of module does not allow object to perform requested service\"; I/O fault on a local or remote module. The state of the device prevents a service request from being handled.",
        "causes": [
          "The state of the device prevents a service request from being handled."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "See the device user manual for available programming options."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0010); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0011",
        "title": "Reply data too large",
        "symptom": "Status display scrolls \"I/O Fault <module> #0011 Reply data too large\"; I/O fault on a local or remote module. The reply to a message has a data size that is too large for the destination.",
        "causes": [
          "The reply to a message has a data size that is too large for the destination."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Change the destination to a tag that can handle the data size and type being returned."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0011); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0012",
        "title": "Requested service specifies an operation that is going to fragment a primitive data value",
        "symptom": "Status display scrolls \"I/O Fault <module> #0012 Requested service specifies an operation that is going to fragment a primitive data value\"; I/O fault on a local or remote module. The service specified an operation that is going to fragment a primitive data value, i.e. half a REAL data type.",
        "causes": [
          "The service specified an operation that is going to fragment a primitive data value, i.e. half a REAL data type."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The size of the data being read or written must be rounded to the next primitive data type size.",
          "The service is operating on data that is too large for the underlying communication size limits."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0012); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0013",
        "title": "Module Configuration Rejected: Data size too small",
        "symptom": "Status display scrolls \"I/O Fault <module> #0013 Module Configuration Rejected: Data size too small\"; I/O fault on a local or remote module. The configuration for the module is invalid. Not enough configuration data was sent.",
        "causes": [
          "The configuration for the module is invalid. Not enough configuration data was sent."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the correct module is being targeted."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0013); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0014",
        "title": "Undefined or unsupported attribute.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0014 Undefined or unsupported attribute.\"; I/O fault on a local or remote module. A MSG instruction is configured to change an attribute that does not exist.",
        "causes": [
          "A MSG instruction is configured to change an attribute that does not exist."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "See the device user manual for available programming options."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0014); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0015",
        "title": "Module configuration rejected: Data size too large.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0015 Module configuration rejected: Data size too large.\"; I/O fault on a local or remote module. The configuration for the module is invalid. Too much configuration data was sent.",
        "causes": [
          "The configuration for the module is invalid. Too much configuration data was sent."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the correct module is being targeted."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0015); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0100",
        "title": "Connection request error: Module in use",
        "symptom": "Status display scrolls \"I/O Fault <module> #0100 Connection request error: Module in use\"; I/O fault on a local or remote module. The connection being accessed is already in use.",
        "causes": [
          "The connection being accessed is already in use."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The target of a connection recognizes that the owner is attempting to remake a connection that is already running."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0100); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0103",
        "title": "Service request error: CIP transport class not supported",
        "symptom": "Status display scrolls \"I/O Fault <module> #0103 Service request error: CIP transport class not supported\"; I/O fault on a local or remote module. This indicates that the controller is requesting a transport class that is not supported by the module.",
        "causes": [
          "This indicates that the controller is requesting a transport class that is not supported by the module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for these conditions:",
          "The controller is requesting services not supported by the module.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passed the electronic keying test. This may result when Disable Keying or Compatible Keying options were used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of Logix Designer application.",
          "For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0103); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0106",
        "title": "Connection Request Error: Module owned and configured by another controller. Module may accept only one connection if Unicast is used",
        "symptom": "Status display scrolls \"I/O Fault <module> #0106 Connection Request Error: Module owned and configured by another controller. Module may accept only one connection if Unicast is used\"; I/O fault on a local or remote module. An ownership conflict occurred for the connection.",
        "causes": [
          "An ownership conflict occurred for the connection."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for these conditions:",
          "The Connection Request to this module has been rejected due to an Ownership conflict with another Owner (for example, another Controller). This may occur with modules, such as output modules, that allow only one Owner to configure and control its outputs.",
          "This fault may also occur if the module is configured as Listen Only and supports only one connection.",
          "If the Owner is connected to the module with a Unicast connection over EtherNet/IP network, other connections to the module may fail because the Owner controls the one connection.",
          "If the Owner is connected to the module with a Multicast connection over EtherNet/IP network, Unicast connections to the module may fail because the Owner controls the one connection.",
          "Configure both the Owner and the Listen Only connection as Multicast."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0106); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0107",
        "title": "Connection Request Error: Target Connection Not Found",
        "symptom": "Status display scrolls \"I/O Fault <module> #0107 Connection Request Error: Target Connection Not Found\"; I/O fault on a local or remote module. A connection being accessed was not found.",
        "causes": [
          "A connection being accessed was not found."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for these conditions:",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using.",
          "You have configured a consumed tag or module to use a Unicast connection over EtherNet/IP network, but the producer does not support Unicast connections."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0107); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0108",
        "title": "Connection Request Error: Connection type (Multicast/Unicast) not supported",
        "symptom": "Status display scrolls \"I/O Fault <module> #0108 Connection Request Error: Connection type (Multicast/Unicast) not supported\"; I/O fault on a local or remote module. The controller is requesting a connection type that is not supported by the module.",
        "causes": [
          "The controller is requesting a connection type that is not supported by the module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for these conditions:",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using.",
          "You have configured a consumed tag or module to use a Unicast connection over EtherNet/IP network, but the producer does not support Unicast connections."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0108); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0109",
        "title": "Connection Request Error: Invalid connection size",
        "symptom": "Status display scrolls \"I/O Fault <module> #0109 Connection Request Error: Invalid connection size\"; I/O fault on a local or remote module. The connection size is inconsistent with the expected size.",
        "causes": [
          "The connection size is inconsistent with the expected size."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Additional Error Information for this fault will be displayed as the tag name associated with the connection instance number that has the fault.",
          "Check for these conditions:",
          "The controller is attempting to set up a connection with the module and cannot because the size of the connection is invalid.",
          "The controller may be attempting to connect to a tag in a producing controller whose size does not match the tag in this controller.",
          "The physical module in use is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passed the electronic keying test. This may result when Disable Keying or Compatible Keying options were used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using.",
          "If the module is a 1756 ControlNet module, verify that the chassis size is correct. For remote I/O adapters, verify that the rack size and rack density is correct."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0109); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0110",
        "title": "Connection Request Error: Module not configured",
        "symptom": "Status display scrolls \"I/O Fault <module> #0110 Connection Request Error: Module not configured\"; I/O fault on a local or remote module. The controller is attempting to set up a Listen Only connection with the module and cannot because the module has not been configured and connected to by an Owner (for example, another controller).",
        "causes": [
          "The controller is attempting to set up a Listen Only connection with the module and cannot because the module has not been configured and connected to by an Owner (for example, another controller)."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "This controller is not an Owner of this module because it is attempting to establish a Listen Only connection, which requires no module configuration. The controller cannot connect until an Owner configures and connects to the module first."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0110); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0111",
        "title": "Requested Packet Interval (RPI) out of range",
        "symptom": "Status display scrolls \"I/O Fault <module> #0111 Requested Packet Interval (RPI) out of range\"; I/O fault on a local or remote module. RPI not supported.",
        "causes": [
          "RPI not supported."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for these conditions:",
          "The Requested Packet Interval (RPI) specified is invalid for this module or for a module in the path to this module.",
          "The physical module in use is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using.",
          "For Listen Only connections: the RPI set by the owner of this module is slower than the one requested. Either increase the requested RPI or decrease the RPI the owner controller is using. See the Connection tab for valid RPI values."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0111); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0113",
        "title": "Connection Request Error: Module connection limit exceeded",
        "symptom": "Status display scrolls \"I/O Fault <module> #0113 Connection Request Error: Module connection limit exceeded\"; I/O fault on a local or remote module. The number of connections is greater than what is available on the module. The number of connections must be reduced or the hardware must be upgraded.",
        "causes": [
          "The number of connections is greater than what is available on the module. The number of connections must be reduced or the hardware must be upgraded."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To reduce the number of connections:",
          "Change the FLEX I/O communication adapter Comm Format from Input or Output configuration to Rack Optimization. When the Comm Format changes, the adapter must be removed and recreated in the I/O configuration tree.",
          "If the configuration uses messaging over ControlNet, sequence the messages to reduce the number that are executing at the same time, or reduce the number of messages. MSG instructions also use connections."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0113); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0114",
        "title": "Electronic Keying Mismatch: Electronic keying product code and/or vendor ID mismatch",
        "symptom": "Status display scrolls \"I/O Fault <module> #0114 Electronic Keying Mismatch: Electronic keying product code and/or vendor ID mismatch\"; I/O fault on a local or remote module. The Product Code of the actual module hardware does not match the Product Code of the module created in the software.",
        "causes": [
          "The Product Code of the actual module hardware does not match the Product Code of the module created in the software."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Electronic Keying failed for this module. You may have a mismatch between the module that is created in the software and the actual module hardware."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0114); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0115",
        "title": "Electronic Keying Mismatch: Electronic Keying product type mismatch",
        "symptom": "Status display scrolls \"I/O Fault <module> #0115 Electronic Keying Mismatch: Electronic Keying product type mismatch\"; I/O fault on a local or remote module. The Product Type of the actual module hardware does not match the Product Type of the module created in the software.",
        "causes": [
          "The Product Type of the actual module hardware does not match the Product Type of the module created in the software."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Electronic Keying failed for this module. You may have a mismatch between the module created in the software and the actual module hardware."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0115); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0116",
        "title": "Electronic Keying Mismatch: Major and/or Minor revision invalid or incorrect",
        "symptom": "Status display scrolls \"I/O Fault <module> #0116 Electronic Keying Mismatch: Major and/or Minor revision invalid or incorrect\"; I/O fault on a local or remote module. The Major or Minor revisions of the module do not match the Major or Minor revisions of the module created in the software.",
        "causes": [
          "The Major or Minor revisions of the module do not match the Major or Minor revisions of the module created in the software."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Electronic Keying failed for this module.",
          "Verify that you have specified the correct Major and Minor Revision if you have chosen Compatible Module or Exact Match keying.",
          "You may have a mismatch between the module created in the software and the actual module hardware."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0116); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0117",
        "title": "Connection Request Error: Invalid Connection Point",
        "symptom": "Status display scrolls \"I/O Fault <module> #0117 Connection Request Error: Invalid Connection Point\"; I/O fault on a local or remote module. The connection is to an invalid port or port that is already in use.",
        "causes": [
          "The connection is to an invalid port or port that is already in use."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Additional Error Information for this fault appears as the tag name associated with the controller to controller (C2C) that has the fault.",
          "Check for these conditions:",
          "Another controller owns this module and has connected with a Communications Format different than the one chosen by this controller. Verify that the Communications Format chosen is identical to that chosen by the first owner controller of the module.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passed the electronic keying test. This may result when Disable Keying or Compatible Keying options were used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using.",
          "The controller may be attempting to connect to a nonexistent tag in a producing controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0117); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0118",
        "title": "Module Configuration Rejected: Format error",
        "symptom": "Status display scrolls \"I/O Fault <module> #0118 Module Configuration Rejected: Format error\"; I/O fault on a local or remote module. An invalid configuration format was used.",
        "causes": [
          "An invalid configuration format was used."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for these conditions:",
          "The configuration class specified does not match the class supported by the module.",
          "The connection instance is not recognized by the module.",
          "The path specified for the connection is inconsistent.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passed the electronic keying test. This may result when Disable Keying or Compatible Keying options were used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0118); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0119",
        "title": "Connection Request Error: Module not owned",
        "symptom": "Status display scrolls \"I/O Fault <module> #0119 Connection Request Error: Module not owned\"; I/O fault on a local or remote module. The controlling connection is not open.",
        "causes": [
          "The controlling connection is not open."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Where a Listen Only connection is requested, the controlling connection is not open."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0119); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#011A",
        "title": "Connection Request Error: Out of Connection Resources",
        "symptom": "Status display scrolls \"I/O Fault <module> #011A Connection Request Error: Out of Connection Resources\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and cannot because required resources are unavailable.",
        "causes": [
          "The controller is attempting to set up a connection with the module and cannot because required resources are unavailable."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "If the module is a 1756 ControlNet module, up to five controllers can make Rack Optimization connections to the module. Verify that this number has not been exceeded.",
          "If the module is a 1794-ACN15, 1794-ACNR15, or 1797-ACNR15 adapter, only one controller can make a Rack Optimization connection to the module. Verify that this number has not been exceeded."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x011A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0203",
        "title": "Connection timed out",
        "symptom": "Status display scrolls \"I/O Fault <module> #0203 Connection timed out\"; I/O fault on a local or remote module. The owner or originator recognizes that the target device is on the network or backplane. However, I/O data and messages are not being responded to.",
        "causes": [
          "The owner or originator recognizes that the target device is on the network or backplane. However, I/O data and messages are not being responded to."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The target can be reached, but its response is not as expected. For example, this fault may be indicated where multicast Ethernet packets are not returned.",
          "When this fault occurs, the controller usually attempts to continuously remove and remake the connection. If you use FLEX I/O modules, verify that you are using the correct terminal device."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0203); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0204",
        "title": "Connection Request Error: Connection request timed out",
        "symptom": "Status display scrolls \"I/O Fault <module> #0204 Connection Request Error: Connection request timed out\"; I/O fault on a local or remote module. The controller is attempting to make a connection; however, the target module is not responding. The device also appears to be missing from the backplane or network.",
        "causes": [
          "The controller is attempting to make a connection; however, the target module is not responding. The device also appears to be missing from the backplane or network."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To recover, take the following steps.",
          "Verify that the module has not been removed and is still functioning and receiving power.",
          "Verify that the correct slot number has been specified.",
          "Verify that the module is properly connected to the network.",
          "If you are using FLEX I/O modules, verify that the correct terminal block is in use."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0204); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0205",
        "title": "Connection Request Error: Invalid parameter",
        "symptom": "Status display scrolls \"I/O Fault <module> #0205 Connection Request Error: Invalid parameter\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error (a parameter is in error).",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error (a parameter is in error)."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The physical module in use is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0205); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0206",
        "title": "Connection Request Error: Requested size too large",
        "symptom": "Status display scrolls \"I/O Fault <module> #0206 Connection Request Error: Requested size too large\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error - the request size is too large.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error - the request size is too large."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Either:",
          "Verify that the path to this module is sufficiently close to the controller.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0206); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0301",
        "title": "Connection Request Error: Out of buffer memory",
        "symptom": "Status display scrolls \"I/O Fault <module> #0301 Connection Request Error: Out of buffer memory\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error: a module in the path is out of memory.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error: a module in the path is out of memory."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for these conditions:",
          "The controller may be attempting to connect to a tag in a producing controller that is not marked as being produced.",
          "The controller may be attempting to connect to a tag in a producing controller. That tag may not be configured to allow enough consumers.",
          "The size or number of connections through this module needs to be reduced.",
          "One of the network modules between the module and the controller may be out of memory. Check network configuration of the system.",
          "The module may be out of memory. Check the system configuration and capabilities of the module.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0301); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0302",
        "title": "Connection Request Error: Out of communication bandwidth",
        "symptom": "Status display scrolls \"I/O Fault <module> #0302 Connection Request Error: Out of communication bandwidth\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error: a module in the path has exceeded its communication bandwidth capacity.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error: a module in the path has exceeded its communication bandwidth capacity."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Increase the Requested Packet Interval (RPI) and reconfigure your network with RSNetWorx software. Distribute the load on another bridge module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0302); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0303",
        "title": "Connection Request Error: No bridge available",
        "symptom": "Status display scrolls \"I/O Fault <module> #0303 Connection Request Error: No bridge available\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error: a module in the path has exceeded its communication bandwidth capacity.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error: a module in the path has exceeded its communication bandwidth capacity."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Distribute the load on another bridge module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0303); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0304",
        "title": "Not configured to send scheduled data",
        "symptom": "Status display scrolls \"I/O Fault <module> #0304 Not configured to send scheduled data\"; I/O fault on a local or remote module. The ControlNet module is not scheduled to send data.",
        "causes": [
          "The ControlNet module is not scheduled to send data."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Use RSNetWorx for ControlNet software to schedule or reschedule the ControlNet network."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0304); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0305",
        "title": "Connection Request Error: ControlNet configuration in controller does not match configuration in bridge",
        "symptom": "Status display scrolls \"I/O Fault <module> #0305 Connection Request Error: ControlNet configuration in controller does not match configuration in bridge\"; I/O fault on a local or remote module. The ControlNet configuration in the controller does not match the configuration in the bridge module. This may occur because a ControlNet module was changed after the network was scheduled, or because a new control program has been loaded into the controller.",
        "causes": [
          "The ControlNet configuration in the controller does not match the configuration in the bridge module. This may occur because a ControlNet module was changed after the network was scheduled, or because a new control program has been loaded into the controller."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Use RSNetWorx for ControlNet software to reschedule the connections."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0305); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0306",
        "title": "ControlNet Keeper not available",
        "symptom": "Status display scrolls \"I/O Fault <module> #0306 ControlNet Keeper not available\"; I/O fault on a local or remote module. The ControlNet Configuration Master (CCM) cannot be found. The 1756-CNB module and PLC-5 ControlNet processor are the only devices capable of being a CCM and the CCM must be node 1.\n\nThis fault may temporarily occur when the system is powered up and is being cleared when the CCM is located.",
        "causes": [
          "The ControlNet Configuration Master (CCM) cannot be found. The 1756-CNB module and PLC-5 ControlNet processor are the only devices capable of being a CCM and the CCM must be node 1.\n\nThis fault may temporarily occur when the system is powered up and is being cleared when the CCM is located."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that a 1756-CNB modules or PLC-5 ControlNet processor is at node 1 and is functioning properly."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0306); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0311",
        "title": "Connection Request Error: Invalid port",
        "symptom": "Status display scrolls \"I/O Fault <module> #0311 Connection Request Error: Invalid port\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that all modules in the I/O Configuration tree are the correct modules."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0311); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0312",
        "title": "Connection Request Error: Invalid link address",
        "symptom": "Status display scrolls \"I/O Fault <module> #0312 Connection Request Error: Invalid link address\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error: an invalid link address has been specified. A link address can be a slot number, a network address, or the remote I/O chassis number and starting group.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error: an invalid link address has been specified. A link address can be a slot number, a network address, or the remote I/O chassis number and starting group."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the chosen slot number for this module is not greater than the size of the rack.",
          "Verify that the ControlNet node number is not greater than the maximum node number configured for the network in RSNetWorx for ControlNet software."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0312); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0315",
        "title": "Connection Request Error: Invalid segment type",
        "symptom": "Status display scrolls \"I/O Fault <module> #0315 Connection Request Error: Invalid segment type\"; I/O fault on a local or remote module. The segment type or route is invalid.",
        "causes": [
          "The segment type or route is invalid."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Either:",
          "The controller is attempting to set up a connection with the module and has received an error: the connection request is invalid.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0315); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0317",
        "title": "Connection Request Error: Connection not scheduled",
        "symptom": "Status display scrolls \"I/O Fault <module> #0317 Connection Request Error: Connection not scheduled\"; I/O fault on a local or remote module. The controller is attempting to set up a ControlNet connection with the module and has received an error.",
        "causes": [
          "The controller is attempting to set up a ControlNet connection with the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Use RSNetWorx for ControlNet software to schedule or reschedule the connection to this module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0317); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0318",
        "title": "Connection Request Error: Invalid link address - cannot route to self",
        "symptom": "Status display scrolls \"I/O Fault <module> #0318 Connection Request Error: Invalid link address - cannot route to self\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error: the link address is invalid.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error: the link address is invalid."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the associated ControlNet module has the correct slot or node number selected."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0318); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0319",
        "title": "Connection Request Error: No secondary resources available in redundant chassis",
        "symptom": "Status display scrolls \"I/O Fault <module> #0319 Connection Request Error: No secondary resources available in redundant chassis\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error: the redundant module does not have the necessary resources to support the connection.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error: the redundant module does not have the necessary resources to support the connection."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Reduce the size or number of connections through this module or add another controller or ControlNet module to the system."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0319); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#031A",
        "title": "Connection Request Error: Direct Connection Refused",
        "symptom": "Status display scrolls \"I/O Fault <module> #031A Connection Request Error: Direct Connection Refused\"; I/O fault on a local or remote module. Rack connection already established.\nA request for a module connection has been refused because part of the corresponding data is already included in the rack connection.",
        "causes": [
          "Rack connection already established.\nA request for a module connection has been refused because part of the corresponding data is already included in the rack connection."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify if two controllers are trying to make a connection to the module. If two controllers are trying to connect to the module, make sure that they have the same connection type."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x031A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#031B",
        "title": "Connection Request Error: Rack Connection Refused",
        "symptom": "Status display scrolls \"I/O Fault <module> #031B Connection Request Error: Rack Connection Refused\"; I/O fault on a local or remote module. The controller is attempting to set up a Direct connection with the module and has received an error.",
        "causes": [
          "The controller is attempting to set up a Direct connection with the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "A rack-optimized connection has already been established to this module through the 1756-CNB/R in the same chassis.",
          "Connect to this module via the 1756-CNB/R in the same chassis.",
          "Connect to this module via a different 1756-CNB/R to use a Direct connection.",
          "Change the first connection from rack-optimized to Direct, and then re-establish the second direct connection.",
          "Connect to this module from a controller in the same chassis as the module (do not connect via 1756-CNB/R."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x031B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#031E",
        "title": "Connection Request Error: Cannot consume tag",
        "symptom": "Status display scrolls \"I/O Fault <module> #031E Connection Request Error: Cannot consume tag\"; I/O fault on a local or remote module. The controller is attempting to connect to a tag in a producing controller and has received an error.",
        "causes": [
          "The controller is attempting to connect to a tag in a producing controller and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The controller is attempting to connect to a tag in a producing controller and that tag has already been used by too many consumers.",
          "Increase the maximum number of consumers on the tag."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x031E); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#031F",
        "title": "Connection Request Error: Tag not published.",
        "symptom": "Status display scrolls \"I/O Fault <module> #031F Connection Request Error: Tag not published.\"; I/O fault on a local or remote module. The consume tag was not configured to be produced in the target module.",
        "causes": [
          "The consume tag was not configured to be produced in the target module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Make sure the name of the tag being consumed is spelled correctly in both the consumer and producer."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x031F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0322",
        "title": "Connection Request Error: Data format for requested connection does not match data format of connection already established.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0322 Connection Request Error: Data format for requested connection does not match data format of connection already established.\"; I/O fault on a local or remote module. A new connection requested does not match the existing connection.",
        "causes": [
          "A new connection requested does not match the existing connection."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check the controllers that are using the connection and verify that all configurations are identical."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0322); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#032D",
        "title": "CIP Security session error: No matching ingress rule",
        "symptom": "Status display scrolls \"I/O Fault <module> #032D CIP Security session error: No matching ingress rule\"; I/O fault on a local or remote module. A request is rejected due to failure to match an ingress rule.",
        "causes": [
          "A request is rejected due to failure to match an ingress rule."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x032D); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#032E",
        "title": "CIP Security session error: Ingress rule deny",
        "symptom": "Status display scrolls \"I/O Fault <module> #032E CIP Security session error: Ingress rule deny\"; I/O fault on a local or remote module. A request is rejected due to matching an ingress rule with action DENY.",
        "causes": [
          "A request is rejected due to matching an ingress rule with action DENY."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x032E); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#032F",
        "title": "CIP Security session error: Ingress rule deny non-secure",
        "symptom": "Status display scrolls \"I/O Fault <module> #032F CIP Security session error: Ingress rule deny non-secure\"; I/O fault on a local or remote module. A request is rejected due to matching an ingress rule with action ALLOW_INGRESS_SECURE, but the request was through a non CIP Security port.",
        "causes": [
          "A request is rejected due to matching an ingress rule with action ALLOW_INGRESS_SECURE, but the request was through a non CIP Security port."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x032F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0330",
        "title": "CIP Security session error: No matching egress rule",
        "symptom": "Status display scrolls \"I/O Fault <module> #0330 CIP Security session error: No matching egress rule\"; I/O fault on a local or remote module. A request is rejected due to failure to match an egress rule.",
        "causes": [
          "A request is rejected due to failure to match an egress rule."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0330); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0331",
        "title": "CIP Security session error: Egress rule deny",
        "symptom": "Status display scrolls \"I/O Fault <module> #0331 CIP Security session error: Egress rule deny\"; I/O fault on a local or remote module. A request is rejected due to matching an egress rule with action DENY.",
        "causes": [
          "A request is rejected due to matching an egress rule with action DENY."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0331); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0332",
        "title": "CIP Security session error: Egress rule cipher not allowed",
        "symptom": "Status display scrolls \"I/O Fault <module> #0332 CIP Security session error: Egress rule cipher not allowed\"; I/O fault on a local or remote module. A request is rejected due to matching an egress rule with action ALLOW, but the CIPHER_LIST does not include an allowed cipher suite.",
        "causes": [
          "A request is rejected due to matching an egress rule with action ALLOW, but the CIPHER_LIST does not include an allowed cipher suite."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0332); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0333",
        "title": "I/O connection does not support CIP Security in a redundant chassis pair.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0333 I/O connection does not support CIP Security in a redundant chassis pair.\"; I/O fault on a local or remote module. The module in a redundant chassis pair cannot make a CIP Security connection because the module does not support CIP Security with I/O and redundancy.",
        "causes": [
          "The module in a redundant chassis pair cannot make a CIP Security connection because the module does not support CIP Security with I/O and redundancy."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "CIP Security for redundant chassis pair I/O is not supported. Modify the configuration of your system."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0333); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0334",
        "title": "Concurrent communication is not supported in current mode.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0334 Concurrent communication is not supported in current mode.\"; I/O fault on a local or remote module. The type of communication request is not supported by the communication mode of the module. A connection cannot be established.",
        "causes": [
          "The type of communication request is not supported by the communication mode of the module. A connection cannot be established."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Change the module configuration to disable concurrent communication."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0334); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0335",
        "title": "Connection failed because module is in Concurrent Communication mode.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0335 Connection failed because module is in Concurrent Communication mode.\"; I/O fault on a local or remote module. The type of communication request is not supported by the communication mode of the module. A connection cannot be established.",
        "causes": [
          "The type of communication request is not supported by the communication mode of the module. A connection cannot be established."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the module is configured for concurrent communication and that all devices in the path support concurrent communication."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0335); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0336",
        "title": "Module could not read Removable Terminal Block information.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0336 Module could not read Removable Terminal Block information.\"; I/O fault on a local or remote module. A module cannot read Removable Terminal Block (RTB) information, such as identity or configuration.",
        "causes": [
          "A module cannot read Removable Terminal Block (RTB) information, such as identity or configuration."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Replace the module's RTB."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0336); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0337",
        "title": "Cannot determine partner presence.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0337 Cannot determine partner presence.\"; I/O fault on a local or remote module. A Bulletin 5015 adapter cannot communicate with its partner adapter through the base. The adapter cannot determine whether the partner is present, so it cannot participate in control.",
        "causes": [
          "A Bulletin 5015 adapter cannot communicate with its partner adapter through the base. The adapter cannot determine whether the partner is present, so it cannot participate in control."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Repair or replace the partner or the backplane interface modules."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0337); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0338",
        "title": "Concurrent communication version not supported.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0338 Concurrent communication version not supported.\"; I/O fault on a local or remote module. The concurrent communication version in the connection request is not supported.",
        "causes": [
          "The concurrent communication version in the connection request is not supported."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the major revision and all of the devices in the path are compatible with concurrent communication."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0338); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0339",
        "title": "Electronic Keying Mismatch: IO-Link firmware revision mismatch.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0339 Electronic Keying Mismatch: IO-Link firmware revision mismatch.\"; I/O fault on a local or remote module. The I/O firmware revision in an Assembly object instance proxied by the IO-Link bridge device does not match the I/O firmware revision in the online IO-Link device.",
        "causes": [
          "The I/O firmware revision in an Assembly object instance proxied by the IO-Link bridge device does not match the I/O firmware revision in the online IO-Link device."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Change firmware revision configured in the IO-Link device definition to match the actual firmware revision in the device or change the physical IO-Link device so that it has the same firmware revision as configured."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0339); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#033A",
        "title": "Connection cannot be opened, unable to enable auxiliary power. IO-Link device is in output operation state.",
        "symptom": "Status display scrolls \"I/O Fault <module> #033A Connection cannot be opened, unable to enable auxiliary power. IO-Link device is in output operation state.\"; I/O fault on a local or remote module. The connection configuration for an IO-Link master module tries to enable the auxiliary power of a Class B IO-Link actuator but the actuator is in the regular output operation state.",
        "causes": [
          "The connection configuration for an IO-Link master module tries to enable the auxiliary power of a Class B IO-Link actuator but the actuator is in the regular output operation state."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "1. In the IO-Link master Module Properties > General > Module Definition, clear the IO-Link Class B Enabled checkbox that corresponds to the channel that the Class B IO-Link actuator is connected to and select OK.",
          "2. In the IO-Link master Module Properties > XX - IO-Link view, select the Disable Channel checkbox and select Apply to send the configuration to the IO-Link master module. You should see the module connection status as ‘Running’.",
          "3. In the IO-Link master Module Properties > General > Module Definition, select the IO-Link Class B Enabled checkbox that corresponds to the channel that the Class B IO-Link actuator is connected to and select OK.",
          "4. In the IO-Link master Module Properties > XX - IO-Link view, clear the Disable Channel checkbox and select Apply to send the configuration to the IO-Link master module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x033A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#033B",
        "title": "Connection cannot be opened, an IO-Link device data storage backup or restore operation is in progress.",
        "symptom": "Status display scrolls \"I/O Fault <module> #033B Connection cannot be opened, an IO-Link device data storage backup or restore operation is in progress.\"; I/O fault on a local or remote module. A data storage restore/backup operation is in progress. A connection cannot be established.",
        "causes": [
          "A data storage restore/backup operation is in progress. A connection cannot be established."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "No action required. The connection is established after the data storage operation is completed."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x033B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#033C",
        "title": "Connection cannot be opened, the IO-Link device is not in the operate state.",
        "symptom": "Status display scrolls \"I/O Fault <module> #033C Connection cannot be opened, the IO-Link device is not in the operate state.\"; I/O fault on a local or remote module. The IO-Link device is not in the Operate state. A connection cannot be established.",
        "causes": [
          "The IO-Link device is not in the Operate state. A connection cannot be established."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "No action required if this is a temporary error. If the error persists, check the IO-Link Status parameter in the XX Diagnostics - IO_x0002_Link dialog box. If the IO-Link Status parameter is not in the Operate state, check the port-level IO-Link event log in the XX - IO-Link view."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x033C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#033D",
        "title": "Connection cannot be opened, the IO-Link device data storage backup or restore operation failed.",
        "symptom": "Status display scrolls \"I/O Fault <module> #033D Connection cannot be opened, the IO-Link device data storage backup or restore operation failed.\"; I/O fault on a local or remote module. The IO-Link device can’t enter its operating state due to a failed data storage restore/backup during startup. A connection cannot be established.",
        "causes": [
          "The IO-Link device can’t enter its operating state due to a failed data storage restore/backup during startup. A connection cannot be established."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "This is usually caused by anomalous behavior of the IO-Link device. Perform general tTroubleshooting for configuration and connection issues described in the user manual. If the error persists, contact technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x033D); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#033F",
        "title": "Process data selection mismatch.",
        "symptom": "Status display scrolls \"I/O Fault <module> #033F Process data selection mismatch.\"; I/O fault on a local or remote module. Automatic device configuration is disabled for the device. However, the configured process data selection, which determines the I/O tag format for the device, does not match the actual process data selection in the device.",
        "causes": [
          "Automatic device configuration is disabled for the device. However, the configured process data selection, which determines the I/O tag format for the device, does not match the actual process data selection in the device."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "1. If you want to use the selected connection type, go to the Configuration view, perform Device Correlation Check, and select Use Project Values.",
          "2. If you want to use the process data set that is currently used in the device, go offline with your project, go to the device Module Definition, and change the connection type to match the device."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x033F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0340",
        "title": "Network mode mismatch.",
        "symptom": "Status display scrolls \"I/O Fault <module> #0340 Network mode mismatch.\"; I/O fault on a local or remote module. The controller cannot connect to the target module because there is a network mode mismatch, such as DLR versus PRP topology configuration.",
        "causes": [
          "The controller cannot connect to the target module because there is a network mode mismatch, such as DLR versus PRP topology configuration."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Change the network mode configuration, such as DLR or PRP, to match in both devices."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0340); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0800",
        "title": "Network link in path to module is offline",
        "symptom": "Status display scrolls \"I/O Fault <module> #0800 Network link in path to module is offline\"; I/O fault on a local or remote module. A bridge module in the path to the target module is offline.",
        "causes": [
          "A bridge module in the path to the target module is offline."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "It is either not physically connected to the network (media disconnected) or otherwise unable to forward the request onto the destination network."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0800); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0801",
        "title": "Incompatible multicast RPI",
        "symptom": "Status display scrolls \"I/O Fault <module> #0801 Incompatible multicast RPI\"; I/O fault on a local or remote module. A connection has already been established to the target module at a different RPI and it cannot be changed to accommodate the RPI specified.",
        "causes": [
          "A connection has already been established to the target module at a different RPI and it cannot be changed to accommodate the RPI specified."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Configure the tag as unicast.",
          "Adjust RPI so that all multicast consumers of the tag use the same RPI.",
          "Configure the RPI so that is in the range allowed by the producer."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0801); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0810",
        "title": "No target application data available",
        "symptom": "Status display scrolls \"I/O Fault <module> #0810 No target application data available\"; I/O fault on a local or remote module. The controlling application has not initialized the data to be produced by the target device. This may be caused when \"Send Data\" connections are configured in a target device and the controlling application for that target device has not initialized the data to be produced.",
        "causes": [
          "The controlling application has not initialized the data to be produced by the target device. This may be caused when \"Send Data\" connections are configured in a target device and the controlling application for that target device has not initialized the data to be produced."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "For the target device associated with the \"Send Data\" connection reporting this connection error, start the controlling application and perform at least one write of data. See the documentation for the target device and its controlling application for information on how to do this."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0810); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0814",
        "title": "Connection Request Error: Data Type Mismatch",
        "symptom": "Status display scrolls \"I/O Fault <module> #0814 Connection Request Error: Data Type Mismatch\"; I/O fault on a local or remote module. Given data type does not match Produce tag data type in target module.",
        "causes": [
          "Given data type does not match Produce tag data type in target module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Make sure both data types match."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0814); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0817",
        "title": "Connection Request Error: Module no longer configured within a synchronized controller redundancy system",
        "symptom": "Status display scrolls \"I/O Fault <module> #0817 Connection Request Error: Module no longer configured within a synchronized controller redundancy system\"; I/O fault on a local or remote module. The controller is configured with redundancy enabled but has lost redundancy status information. The redundancy module was either removed from the system or faulted.",
        "causes": [
          "The controller is configured with redundancy enabled but has lost redundancy status information. The redundancy module was either removed from the system or faulted."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Reinsert the redundancy module into the rack.",
          "Clear the fault on the redundancy module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0817); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0900",
        "title": "CIP Security session error: (D) TLS Alert 0: Close Notify 1",
        "symptom": "Status display scrolls \"I/O Fault <module> #0900 CIP Security session error: (D) TLS Alert 0: Close Notify 1\"; I/O fault on a local or remote module. One side of the (D)TLS connection has requested that the connection be closed.",
        "causes": [
          "One side of the (D)TLS connection has requested that the connection be closed."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check that your model matches the actual communications flow.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0900); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0901",
        "title": "CIP Security session error: (D) TLS Alert 10: Unexpected Message",
        "symptom": "Status display scrolls \"I/O Fault <module> #0901 CIP Security session error: (D) TLS Alert 10: Unexpected Message\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check that your model matches the actual communications flow.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0901); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0902",
        "title": "CIP Security session error: (D) TLS Alert 20: Bad Record MAC",
        "symptom": "Status display scrolls \"I/O Fault <module> #0902 CIP Security session error: (D) TLS Alert 20: Bad Record MAC\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0902); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0903",
        "title": "CIP Security session error: (D)TLS Alert 22: Record Overflow",
        "symptom": "Status display scrolls \"I/O Fault <module> #0903 CIP Security session error: (D)TLS Alert 22: Record Overflow\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Please contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0903); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0904",
        "title": "CIP Security session error: (D)TLS Alert 30: Decompression Failure",
        "symptom": "Status display scrolls \"I/O Fault <module> #0904 CIP Security session error: (D)TLS Alert 30: Decompression Failure\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0904); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0905",
        "title": "CIP Security session error: (D)TLS Alert 40: Handshake Failure",
        "symptom": "Status display scrolls \"I/O Fault <module> #0905 CIP Security session error: (D)TLS Alert 40: Handshake Failure\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check your configuration.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0905); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0906",
        "title": "CIP Security session error: (D)TLS Alert 42: Bad Certificate",
        "symptom": "Status display scrolls \"I/O Fault <module> #0906 CIP Security session error: (D)TLS Alert 42: Bad Certificate\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0906); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0907",
        "title": "CIP Security session error: (D)TLS Alert 43: Unsupported Certificate",
        "symptom": "Status display scrolls \"I/O Fault <module> #0907 CIP Security session error: (D)TLS Alert 43: Unsupported Certificate\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0907); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0908",
        "title": "CIP Security session error: (D)TLS Alert 44: Certificate Revoked",
        "symptom": "Status display scrolls \"I/O Fault <module> #0908 CIP Security session error: (D)TLS Alert 44: Certificate Revoked\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0908); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0909",
        "title": "CIP Security session error: (D)TLS Alert 45: Certificate Expired",
        "symptom": "Status display scrolls \"I/O Fault <module> #0909 CIP Security session error: (D)TLS Alert 45: Certificate Expired\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0909); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#090A",
        "title": "CIP Security session error: (D)TLS Alert 46: Certificate Unknown",
        "symptom": "Status display scrolls \"I/O Fault <module> #090A CIP Security session error: (D)TLS Alert 46: Certificate Unknown\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check that your model matches the actual communications flow.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x090A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#090B",
        "title": "CIP Security session error: (D)TLS Alert 47: Illegal Parameter",
        "symptom": "Status display scrolls \"I/O Fault <module> #090B CIP Security session error: (D)TLS Alert 47: Illegal Parameter\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Please contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x090B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#090C",
        "title": "CIP Security session error: (D)TLS Alert 48: Unknown CA",
        "symptom": "Status display scrolls \"I/O Fault <module> #090C CIP Security session error: (D)TLS Alert 48: Unknown CA\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check that your model matches the actual communications flow.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x090C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#090D",
        "title": "CIP Security session error: (D)TLS Alert 49: Access Denied",
        "symptom": "Status display scrolls \"I/O Fault <module> #090D CIP Security session error: (D)TLS Alert 49: Access Denied\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check that your model matches the actual communications flow.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x090D); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#090E",
        "title": "CIP Security session error: (D)TLS Alert 50: Decode Error",
        "symptom": "Status display scrolls \"I/O Fault <module> #090E CIP Security session error: (D)TLS Alert 50: Decode Error\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x090E); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#090F",
        "title": "CIP Security session error: (D)TLS Alert 51: Decrypt Error",
        "symptom": "Status display scrolls \"I/O Fault <module> #090F CIP Security session error: (D)TLS Alert 51: Decrypt Error\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x090F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0910",
        "title": "CIP Security session error: (D)TLS Alert 70: Protocol Version",
        "symptom": "Status display scrolls \"I/O Fault <module> #0910 CIP Security session error: (D)TLS Alert 70: Protocol Version\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0910); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0911",
        "title": "CIP Security session error: (D)TLS Alert 71: Insufficient Security",
        "symptom": "Status display scrolls \"I/O Fault <module> #0911 CIP Security session error: (D)TLS Alert 71: Insufficient Security\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check the cipher suites that you configured in your model that every target an originator has a matching cipher suite allowed.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0911); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0912",
        "title": "CIP Security session error: (D)TLS Alert 80: Internal Error",
        "symptom": "Status display scrolls \"I/O Fault <module> #0912 CIP Security session error: (D)TLS Alert 80: Internal Error\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0912); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0913",
        "title": "CIP Security session error: (D)TLS Alert 86: Inappropriate Fallback",
        "symptom": "Status display scrolls \"I/O Fault <module> #0913 CIP Security session error: (D)TLS Alert 86: Inappropriate Fallback\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0913); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0914",
        "title": "CIP Security session error: (D)TLS Alert 110: Unsupported Extension",
        "symptom": "Status display scrolls \"I/O Fault <module> #0914 CIP Security session error: (D)TLS Alert 110: Unsupported Extension\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact technical support.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0914); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#0915",
        "title": "CIP Security session error: (D)TLS Alert: Unknown PSK Identity",
        "symptom": "Status display scrolls \"I/O Fault <module> #0915 CIP Security session error: (D)TLS Alert: Unknown PSK Identity\"; I/O fault on a local or remote module. An unexpected CIP Security protocol fault occurred.",
        "causes": [
          "An unexpected CIP Security protocol fault occurred."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check that your model matches the actual communications flow.",
          "Verify that you are addressing the correct device and that the project configuration includes devices supported by your CIP Security Policy. If this error persists, contact your security administrator or technical support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0x0915); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD01",
        "title": "Connection Request Error: Bad Backplane EEPROM",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD01 Connection Request Error: Bad Backplane EEPROM\"; I/O fault on a local or remote module. This controller‘s last redundancy state at the time an operational RM was present implies that a partner controller may exist which is currently Primary and also attempting to open the same concurrent communication.",
        "causes": [
          "This controller‘s last redundancy state at the time an operational RM was present implies that a partner controller may exist which is currently Primary and also attempting to open the same concurrent communication."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Replace the backplane."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD01); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD02",
        "title": "Connection Request Error: No error code is supplied by an I/O module to describe an I/O fault",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD02 Connection Request Error: No error code is supplied by an I/O module to describe an I/O fault\"; I/O fault on a local or remote module. No error code is supplied by an I/O module to describe an I/O fault.",
        "causes": [
          "No error code is supplied by an I/O module to describe an I/O fault."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "See the user manual for your device."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD02); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD03",
        "title": "Connection Request Error: Required Connection missing",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD03 Connection Request Error: Required Connection missing\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "This module requires a particular set of connections and connection types, and one of those connection types is missing."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD03); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD04",
        "title": "Connection Request Error: No CST Master Detected",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD04 Connection Request Error: No CST Master Detected\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error - this module requires a CST master in the chassis.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error - this module requires a CST master in the chassis."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Configure a module (typically a controller) in this chassis to be the CST master."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD04); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD05",
        "title": "Connection Request Error: No Axis or Group Assigned",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD05 Connection Request Error: No Axis or Group Assigned\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error - this module requires an axis or group table assigned.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error - this module requires an axis or group table assigned."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Assign a Group or Axis."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD05); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD06",
        "title": "SERCOS Transition Fault",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD06 SERCOS Transition Fault\"; I/O fault on a local or remote module. The controller command to transition the SERCOS ring to a new phase returned an error from the module.",
        "causes": [
          "The controller command to transition the SERCOS ring to a new phase returned an error from the module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for duplicate Drive Nodes."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD06); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD07",
        "title": "Connection Request Error: SERCOS Init Ring Fault",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD07 Connection Request Error: SERCOS Init Ring Fault\"; I/O fault on a local or remote module. An attempt to configure the SERCOS ring failed.",
        "causes": [
          "An attempt to configure the SERCOS ring failed."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The baud rate for all devices must be the same and supported by the drives and the SERCOS module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD07); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD08",
        "title": "SERCOS Comm Fault",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD08 SERCOS Comm Fault\"; I/O fault on a local or remote module. Mainly two sets of faults may cause this fault, physical and interface faults. \n\nInterface errors are encountered when you are configuring third-party drives.",
        "causes": [
          "Mainly two sets of faults may cause this fault, physical and interface faults. \n\nInterface errors are encountered when you are configuring third-party drives."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check for these sources of physical faults:",
          "Broken ring",
          "Loose connector",
          "Fiber optics not clean",
          "Electrical noise due to improper drive grounding",
          "Too many nodes on the ring",
          "Check for these potential interface errors:",
          "No SERCOS MST (Protocol Error).",
          "Missed AT (drive did not send data when expected).",
          "SERCOS timing error in phase 3.",
          "Error in drive data that is returned to SERCOS module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD08); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD09",
        "title": "SERCOS Node Initialization Fault",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD09 SERCOS Node Initialization Fault\"; I/O fault on a local or remote module. The SERCOS module defected a problem during the Init Node Comm service.",
        "causes": [
          "The SERCOS module defected a problem during the Init Node Comm service."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "There is a problem with the IDNs being configured. Check the general and extended error codes and refer to their definition SERCOS documentation."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD09); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD0A",
        "title": "Axis Attribute Error - See Faulted Axis",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD0A Axis Attribute Error - See Faulted Axis\"; I/O fault on a local or remote module. The analog servo motion module rejected an attribute update.",
        "causes": [
          "The analog servo motion module rejected an attribute update."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Ensure all attributes are set to valid values.",
          "See Analog axis attribute documentation."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD0A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD0C",
        "title": "The end device has a different Grandmaster than the controller",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD0C The end device has a different Grandmaster than the controller\"; I/O fault on a local or remote module. The drive detected a different PTP Grandmaster than the controller.",
        "causes": [
          "The drive detected a different PTP Grandmaster than the controller."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Ensure that the drive and the controller can synchronize to the same CIP Sync grandmaster clock.",
          "See the Time Synchronization page for the drive and the controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD0C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD1F",
        "title": "Bad Safety Protocol Format",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD1F Bad Safety Protocol Format\"; I/O fault on a local or remote module. An error occurred adding the safety network segment to a route.",
        "causes": [
          "An error occurred adding the safety network segment to a route."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The module in use is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD1F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD20",
        "title": "No safety task running in local controller",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD20 No safety task running in local controller\"; I/O fault on a local or remote module. No safety task appears to be running.",
        "causes": [
          "No safety task appears to be running."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Safety modules require that a safety task be present and running in the controller originating the connection."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD20); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD22",
        "title": "POINTBus Fault: The configured number of expansion I/O modules does not match the number of physical modules detected",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD22 POINTBus Fault: The configured number of expansion I/O modules does not match the number of physical modules detected\"; I/O fault on a local or remote module. When the expected chassis size does not match the discovered chassis size, I/O connections are prevented.",
        "causes": [
          "When the expected chassis size does not match the discovered chassis size, I/O connections are prevented."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify the number of physical expansion I/O modules configured for the controller and then update the number of modules selected from the Expansion I/O list on the General page in the Controller Properties dialog."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD22); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FD23",
        "title": "POINTBus Fault: Expansion modules detected beyond the number allowed for this controller type",
        "symptom": "Status display scrolls \"I/O Fault <module> #FD23 POINTBus Fault: Expansion modules detected beyond the number allowed for this controller type\"; I/O fault on a local or remote module. This error can happen when you put more modules in a chassis than what the product catalog supports. You cannot detect the extra modules using a tool like RSLinx as that only lets you browse up to the chassis size. When you try to establish I/O connections, I/O connections are prevented.",
        "causes": [
          "This error can happen when you put more modules in a chassis than what the product catalog supports. You cannot detect the extra modules using a tool like RSLinx as that only lets you browse up to the chassis size. When you try to establish I/O connections, I/O connections are prevented."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "To verify the number of physical expansion I/O the controller supports, open the Controller Properties dialog and expand the Expansion I/O list on the General page.",
          "Configure the number of physical expansion I/O modules to match the selection in the Expansion I/O list."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFD23); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE01",
        "title": "Connection Request Error: An invalid configuration format was encountered",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE01 Connection Request Error: An invalid configuration format was encountered\"; I/O fault on a local or remote module. An invalid configuration format was encountered.",
        "causes": [
          "An invalid configuration format was encountered."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The connection type configured by the profile is not appropriate for this module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE01); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE02",
        "title": "Requested Packet Interval (RPI) out of range",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE02 Requested Packet Interval (RPI) out of range\"; I/O fault on a local or remote module. The Requested Packet Interval (RPI) specified is invalid for this module.",
        "causes": [
          "The Requested Packet Interval (RPI) specified is invalid for this module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "See the Connection tab for valid RPI values."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE02); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE03",
        "title": "Connection Request Error: The input connection point has not been set",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE03 Connection Request Error: The input connection point has not been set\"; I/O fault on a local or remote module. Invalid input connection point.",
        "causes": [
          "Invalid input connection point."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "The input connection point is 0 and is not allowed to be 0."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE03); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE04",
        "title": "Connection Request Error: Invalid input data pointer",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE04 Connection Request Error: Invalid input data pointer\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE04); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE05",
        "title": "Connection Request Error: Invalid input data size",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE05 Connection Request Error: Invalid input data size\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE05); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE06",
        "title": "Connection Request Error: The input force pointer has not been set",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE06 Connection Request Error: The input force pointer has not been set\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE06); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE07",
        "title": "Connection Request Error: The output connection point has not been set",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE07 Connection Request Error: The output connection point has not been set\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE07); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE08",
        "title": "Connection Request Error: Invalid output data pointer",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE08 Connection Request Error: Invalid output data pointer\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE08); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE09",
        "title": "Connection Request Error: Invalid output data size",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE09 Connection Request Error: Invalid output data size\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE09); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE0A",
        "title": "Connection Request Error: The output force pointer has not been set",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE0A Connection Request Error: The output force pointer has not been set\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE0A); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE0B",
        "title": "Invalid Symbol String",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE0B Invalid Symbol String\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE0B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE0C",
        "title": "Invalid PLC-5 instance number",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE0C Invalid PLC-5 instance number\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the PLC-5 controller and has received an error.",
        "causes": [
          "The controller is attempting to set up a connection with the PLC-5 controller and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the instance number specified has been properly specified in the PLC-5 controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE0C); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE0D",
        "title": "Tag does not exist in peer controller",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE0D Tag does not exist in peer controller\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE0D); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE0E",
        "title": "Automatic Firmware Update in progress",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE0E Automatic Firmware Update in progress\"; I/O fault on a local or remote module. The module is currently being updated.",
        "causes": [
          "The module is currently being updated."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "This is not an error, but an information code"
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE0E); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE0F",
        "title": "Automatic Firmware Update Failed: Firmware file incompatible with the module",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE0F Automatic Firmware Update Failed: Firmware file incompatible with the module\"; I/O fault on a local or remote module. The firmware supervisor has attempted to update an unsupported module. This occurs when there is no NVS file on the SD card for the module revision specified in the project.",
        "causes": [
          "The firmware supervisor has attempted to update an unsupported module. This occurs when there is no NVS file on the SD card for the module revision specified in the project."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Either:",
          "Update Module firmware file on SD card with proper module revision.",
          "Change module revision in the module properties in the project."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE0F); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE10",
        "title": "Automatic Firmware Update Failed: Firmware file not found",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE10 Automatic Firmware Update Failed: Firmware file not found\"; I/O fault on a local or remote module. The firmware file to update the module cannot be found. The project has a module that needs a specific firmware revision that is not on the SD card.",
        "causes": [
          "The firmware file to update the module cannot be found. The project has a module that needs a specific firmware revision that is not on the SD card."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Either:",
          "Manually update the module's firmware.",
          "Copy the correct revision of module firmware to the SD card.",
          "Change the module revision in the project to match the revision on the module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE10); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE11",
        "title": "Automatic Firmware Update Failed: Firmware file invalid",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE11 Automatic Firmware Update Failed: Firmware file invalid\"; I/O fault on a local or remote module. The firmware file is corrupted.",
        "causes": [
          "The firmware file is corrupted."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Either:",
          "Use a different SD card.",
          "Copy the correct revision of module firmware to the SD card."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE11); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE12",
        "title": "Automatic Firmware Update Failed",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE12 Automatic Firmware Update Failed\"; I/O fault on a local or remote module. An error has occurred while updating the module.",
        "causes": [
          "An error has occurred while updating the module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Check the module status indicators, and troubleshoot the module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE12); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE13",
        "title": "Automatic Firmware Update Failed: Detected Active Connections",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE13 Automatic Firmware Update Failed: Detected Active Connections\"; I/O fault on a local or remote module. An active connection could not be made to the target module.",
        "causes": [
          "An active connection could not be made to the target module."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "There is an active connection already made to the target module from some other originator, thereby disallowing a flash update from occurring."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE13); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE14",
        "title": "Automatic Firmware Update pending: Searching NVS file for appropriate module identity",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE14 Automatic Firmware Update pending: Searching NVS file for appropriate module identity\"; I/O fault on a local or remote module. The firmware file is currently being read.",
        "causes": [
          "The firmware file is currently being read."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Firmware Supervisor is searching NVS File for identity info. This is not an error, but an information code."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE14); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE22",
        "title": "Connection Request Error: Invalid input network connection type",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE22 Connection Request Error: Invalid input network connection type\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE22); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FE23",
        "title": "Connection Request Error: input connection does not specify whether unicast is allowed",
        "symptom": "Status display scrolls \"I/O Fault <module> #FE23 Connection Request Error: input connection does not specify whether unicast is allowed\"; I/O fault on a local or remote module. Module entry in the controller incorrect.",
        "causes": [
          "Module entry in the controller incorrect."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Contact Rockwell Automation Support."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFE23); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FF00",
        "title": "Connection Request Error: No connection instance",
        "symptom": "Status display scrolls \"I/O Fault <module> #FF00 Connection Request Error: No connection instance\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the physical module is the same module type (or is a compatible module) as created in the software.",
          "If the module is a 1756-DHRIO module in a remote chassis (connected via a ControlNet network), verify that the network has been scheduled with RSNetWorx software.",
          "Even after the network has been scheduled with RSNetWorx for ControlNet software, if you are online and if the 1756-DHRIO module is configured for DH+ network only, a 0xff00 Module Fault (no connection instance) may occur. The module is properly communicating even though Faulted is displayed as its Status on the Module Properties dialog box. Disregard the error message and fault status and continue."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFF00); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FF01",
        "title": "Connection Request Error: Path to module too long",
        "symptom": "Status display scrolls \"I/O Fault <module> #FF01 Connection Request Error: Path to module too long\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the path to this module is a valid length."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFF01); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FF04",
        "title": "Connection Request Error: The controller's map instance attempted to access a connection while being in an invalid state",
        "symptom": "Status display scrolls \"I/O Fault <module> #FF04 Connection Request Error: The controller's map instance attempted to access a connection while being in an invalid state\"; I/O fault on a local or remote module. The remote controller’s map instance attempted to access a connection while in an invalid state. An attempt was made to initiate the reconfiguration of a device that is not supported by the controller",
        "causes": [
          "The remote controller’s map instance attempted to access a connection while in an invalid state. An attempt was made to initiate the reconfiguration of a device that is not supported by the controller"
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Go offline with the controller and make the change and then download the modified project to the controller."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFF04); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FF08",
        "title": "Connection Request Error: Invalid path to module",
        "symptom": "Status display scrolls \"I/O Fault <module> #FF08 Connection Request Error: Invalid path to module\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with the module and has received an error.",
        "causes": [
          "The controller is attempting to set up a connection with the module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Verify that the path to this module is a valid length."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFF08); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FF0B",
        "title": "Module Configuration Rejected: Bad format",
        "symptom": "Status display scrolls \"I/O Fault <module> #FF0B Module Configuration Rejected: Bad format\"; I/O fault on a local or remote module. Invalid configuration format.",
        "causes": [
          "Invalid configuration format."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "Either:",
          "The configuration for the module is invalid.",
          "The module in use (that is, the physical module) is different than the module specified in the I/O configuration tree and is therefore causing the connection or service to fail.",
          "The fault may occur even when the module passes the electronic keying test. This may result when Disable Keying or Compatible Keying options are used in the module configuration instead of the Exact Match option.",
          "Despite passing the electronic keying test, the module being connected to does not have the same features or settings as the module specified in the I/O configuration tree and does not support the connection or service being attempted.",
          "Check the module in use and verify that it exactly matches the module specified in the I/O configuration tree of the Logix Designer application. For more information about electronic keying, see the user manual for the module you are using."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFF0B); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      },
      {
        "code": "#FF0E",
        "title": "Connection Request Error: No connections accepted to bridge",
        "symptom": "Status display scrolls \"I/O Fault <module> #FF0E Connection Request Error: No connections accepted to bridge\"; I/O fault on a local or remote module. The controller is attempting to set up a connection with a ControlNet bridge module and has received an error.",
        "causes": [
          "The controller is attempting to set up a connection with a ControlNet bridge module and has received an error."
        ],
        "confirm": [
          "Read the I/O fault message on the status display (I/O Fault Local:X #XXXX, I/O Fault ModuleName #XXXX or ModuleParent:X #XXXX) and the module Connection / Module Info tabs in Logix Designer (5069-UM001 p.245-246)."
        ],
        "fix": [
          "ControlNet bridge modules should not have connections to them."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (1756-RD001, sheet 'IO', 0xFF0E); https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (5069-UM001 p.245-246 I/O Fault Codes)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um001_-en-p.pdf (CompactLogix 5380 and Compact GuardLogix 5380 Controllers User Manual 5069-UM001N-EN-P, Jan 2026: p.30-32, Appendix A p.241-251)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/rd/1756-rd001_-en-p.xlsx (Logix 5000 Controller and I/O Fault Codes 1756-RD001, sheets Logix 5000 Controllers and IO)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/in/5069-in013_-en-p.pdf (5069-IN013K p.6)"
    ]
  },
  {
    "id": "compact-5000-io-modules",
    "title": "Allen-Bradley Compact 5000 I/O modules (5069-IB16, -OB16, analog): status indicators and field readings",
    "match": {
      "categories": [
        "plcModule"
      ],
      "family": "Compact 5000"
    },
    "normal": [
      {
        "terminals": "IN x to SA– (5069-IB16 sinking input; inputs return through the module to the SA (–) terminal of the SA power RTB)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "10…32V DC (24V DC nom); 4 mA @ 10V…7.4 mA @ 32V, 6 mA nom",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/5069-td001_-en-p.pdf (5069-TD001P) p.8-9"
      },
      {
        "terminals": "IN x to SA– (5069-IB16)",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "5V DC max",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/5069-td001_-en-p.pdf p.9"
      },
      {
        "terminals": "LA+ to LA– (5069-OB16 local actuator power)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10…32V DC (24V DC nom)",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/5069-td001_-en-p.pdf p.14"
      },
      {
        "terminals": "LA+ to OUT x (5069-OB16 sourcing output)",
        "state": "output ON",
        "meter": "VDC",
        "expected": "on-state voltage drop < 0.2V DC",
        "note": "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/5069-td001_-en-p.pdf p.14"
      }
    ],
    "indicators": [
      {
        "name": "Module status",
        "state": "off",
        "meaning": "Power not applied"
      },
      {
        "name": "Module status",
        "state": "steady green",
        "meaning": "Connection to the owner-controller, operating normally"
      },
      {
        "name": "Module status",
        "state": "flashing green",
        "meaning": "No connection to the controller (missing, incomplete or incorrect configuration)"
      },
      {
        "name": "Module status",
        "state": "steady red",
        "meaning": "Nonrecoverable fault: cycle power; if it stays red replace the module"
      },
      {
        "name": "Module status",
        "state": "flashing red",
        "meaning": "Firmware update in progress or failed, recoverable fault, or connection timed out"
      },
      {
        "name": "I/O status (digital input)",
        "state": "off / steady yellow",
        "meaning": "Input off or no module power / input on"
      },
      {
        "name": "I/O status (digital input, 5069-IB16F, IB6F-3W)",
        "state": "flashing red",
        "meaning": "Field Power Loss condition"
      },
      {
        "name": "I/O status (DC output)",
        "state": "off / steady yellow",
        "meaning": "Output off or no module power / output on"
      },
      {
        "name": "I/O status (DC output)",
        "state": "flashing red",
        "meaning": "No Load or Short Circuit; on 5069-OB16 etc. also Field Power Loss"
      },
      {
        "name": "Group A / Group B (32-point)",
        "state": "flashing red and yellow",
        "meaning": "Shown group has at least one channel fault"
      }
    ],
    "faults": [
      {
        "title": "Module not connected (MOD flashing green)",
        "symptom": "Module status indicator flashing green; I/O data not updating.",
        "causes": [
          "Missing, incomplete or incorrect module configuration"
        ],
        "confirm": [
          "Use the Logix Designer project (module Connection / Module Info pages) to see what prevents the connection (5069-UM004 p.114)."
        ],
        "fix": [
          "Correct the module configuration so the controller can make the connection."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um004_-en-p.pdf (5069-UM004H p.114)"
      },
      {
        "title": "Module nonrecoverable fault (MOD steady red)",
        "symptom": "Module status indicator steady red.",
        "causes": [
          "Module experienced a nonrecoverable fault"
        ],
        "confirm": [
          "Cycle power to the module and watch the module status indicator (5069-UM004 p.114)."
        ],
        "fix": [
          "If the indicator remains steady red after a power cycle, replace the module."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um004_-en-p.pdf (5069-UM004H p.114)"
      },
      {
        "title": "Module recoverable fault or connection timeout (MOD flashing red)",
        "symptom": "Module status indicator flashing red.",
        "causes": [
          "Firmware update in progress or failed",
          "Recoverable fault",
          "Connection timed out (for example a cable failure)"
        ],
        "confirm": [
          "View the cause on the Connection and Module Info pages in Logix Designer (5069-UM004 p.114)."
        ],
        "fix": [
          "Let the firmware update finish or retry it.",
          "Clear a recoverable fault by cycling module power or clicking Reset Module on the Module Info page.",
          "If a connection timed out, determine the cause and correct it."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um004_-en-p.pdf (5069-UM004H p.114)"
      },
      {
        "title": "DC output No Load / Short Circuit (I/O LED flashing red)",
        "symptom": "Output channel status indicator flashing red; I.Ptxx.Fault set.",
        "causes": [
          "No Load condition",
          "Short Circuit condition",
          "Field Power Loss (LA power missing) on 5069-OB16"
        ],
        "confirm": [
          "Measure LA+ to LA–: 10…32V DC expected (5069-TD001 p.14).",
          "Check the load wiring of the flagged channel."
        ],
        "fix": [
          "Locate and address the condition (5069-UM004 p.115)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um004_-en-p.pdf (5069-UM004H p.115); https://literature.rockwellautomation.com/idc/groups/literature/documents/td/5069-td001_-en-p.pdf (p.14)"
      },
      {
        "title": "Input Field Power Loss (I/O LED flashing red)",
        "symptom": "5069-IB16F / IB6F-3W input status indicator flashing red.",
        "causes": [
          "SA field power lost"
        ],
        "confirm": [
          "Check the SA power status indicator and measure the SA power supply (18…32V DC valid) (5069-UM001 p.250)."
        ],
        "fix": [
          "Locate and address the condition (5069-UM004 p.115)."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um004_-en-p.pdf (5069-UM004H p.115)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/5069-um004_-en-p.pdf (Compact 5000 Digital I/O Modules User Manual 5069-UM004H-EN-P, Mar 2026, Appendix A p.111-116)",
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/td/5069-td001_-en-p.pdf (Compact 5000 I/O Modules Specifications 5069-TD001P-EN-P p.8-9, p.14)"
    ]
  },
  {
    "id": "unistream-built-in-plc-hmi",
    "title": "Unitronics UniStream Built-in PLC+HMI (US5/US7/US10/US15-Bx-…)",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "UniStream built-in"
    },
    "normal": [
      {
        "terminals": "+V to 0V (power supply)",
        "state": "powered, TR22 / T24 models",
        "meter": "VDC",
        "expected": "24VDC nominal, 20.4VDC to 28.8VDC",
        "pins": [
          [
            "+V",
            "0V"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.15 Power Supply; terminals p.10"
      },
      {
        "terminals": "+V to 0V (power supply)",
        "state": "powered, B1 models (no built-in I/O)",
        "meter": "VDC",
        "expected": "12VDC or 24VDC, 10.2VDC to 28.8VDC",
        "pins": [
          [
            "+V",
            "0V"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.15 Power Supply; terminals p.10"
      },
      {
        "terminals": "I0…I9 to CM0 (TR22/T24 digital inputs, sink or source)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "15-30VDC (magnitude), 4mA min; 24VDC @ 6mA nominal",
        "pins": [
          [
            "I0",
            "CM0"
          ],
          [
            "I1",
            "CM0"
          ],
          [
            "I2",
            "CM0"
          ],
          [
            "I3",
            "CM0"
          ],
          [
            "I4",
            "CM0"
          ],
          [
            "I5",
            "CM0"
          ],
          [
            "I6",
            "CM0"
          ],
          [
            "I7",
            "CM0"
          ],
          [
            "I8",
            "CM0"
          ],
          [
            "I9",
            "CM0"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.16 Digital Inputs; common CM0: https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.10"
      },
      {
        "terminals": "I0…I9 to CM0",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "0-5VDC, 1mA max",
        "pins": [
          [
            "I0",
            "CM0"
          ],
          [
            "I1",
            "CM0"
          ],
          [
            "I2",
            "CM0"
          ],
          [
            "I3",
            "CM0"
          ],
          [
            "I4",
            "CM0"
          ],
          [
            "I5",
            "CM0"
          ],
          [
            "I6",
            "CM0"
          ],
          [
            "I7",
            "CM0"
          ],
          [
            "I8",
            "CM0"
          ],
          [
            "I9",
            "CM0"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.16 Digital Inputs"
      },
      {
        "terminals": "CM2 to O0…O3, CM3 to O4…O7 (TR22 relay outputs, SPST-NO)",
        "state": "output ON",
        "meter": "continuity",
        "expected": "contact closed; 2A max per output, 250VAC / 30VDC max, min load 1mA 5VDC",
        "pins": [
          [
            "CM2",
            "O0"
          ],
          [
            "CM2",
            "O1"
          ],
          [
            "CM2",
            "O2"
          ],
          [
            "CM2",
            "O3"
          ],
          [
            "CM3",
            "O4"
          ],
          [
            "CM3",
            "O5"
          ],
          [
            "CM3",
            "O6"
          ],
          [
            "CM3",
            "O7"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.17 Relay Outputs; commons p.12"
      },
      {
        "terminals": "O8, O9 to CM4 (TR22 sink transistor outputs)",
        "state": "output ON",
        "meter": "VDC",
        "expected": "on state voltage drop 1V max; 50mA max per output; 3.5V to 28.8VDC range",
        "pins": [
          [
            "O8",
            "CM4"
          ],
          [
            "O9",
            "CM4"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.12 (O8 and O9 share CM4, not short-circuit protected), p.18"
      },
      {
        "terminals": "+VO to 0VO (T24 source output supply)",
        "state": "powered",
        "meter": "VDC",
        "expected": "20.4 – 28.8VDC (24VDC nominal)",
        "pins": [
          [
            "+VO",
            "0VO"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.13, p.18"
      },
      {
        "terminals": "AI0/AI1 to CM1 (analog inputs)",
        "state": "measuring",
        "meter": "VDC",
        "expected": "0÷10VDC or 0÷20mA nominal; over-range up to 10.15V / 20.3mA, beyond that Overflow is declared",
        "pins": [
          [
            "AI0",
            "CM1"
          ],
          [
            "AI1",
            "CM1"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf p.11 (both inputs share CM1), p.17"
      }
    ],
    "pairs": [
      {
        "a": "CM2",
        "b": "O0",
        "when": "output O0 ON",
        "note": "TR22 relay, SPST-NO (Form A); O0-O3 share common return CM2"
      },
      {
        "a": "CM2",
        "b": "O1",
        "when": "output O1 ON",
        "note": "TR22 relay, SPST-NO (Form A); O0-O3 share common return CM2"
      },
      {
        "a": "CM2",
        "b": "O2",
        "when": "output O2 ON",
        "note": "TR22 relay, SPST-NO (Form A); O0-O3 share common return CM2"
      },
      {
        "a": "CM2",
        "b": "O3",
        "when": "output O3 ON",
        "note": "TR22 relay, SPST-NO (Form A); O0-O3 share common return CM2"
      },
      {
        "a": "CM3",
        "b": "O4",
        "when": "output O4 ON",
        "note": "TR22 relay; O4-O7 share common return CM3"
      },
      {
        "a": "CM3",
        "b": "O5",
        "when": "output O5 ON",
        "note": "TR22 relay; O4-O7 share common return CM3"
      },
      {
        "a": "CM3",
        "b": "O6",
        "when": "output O6 ON",
        "note": "TR22 relay; O4-O7 share common return CM3"
      },
      {
        "a": "CM3",
        "b": "O7",
        "when": "output O7 ON",
        "note": "TR22 relay; O4-O7 share common return CM3"
      }
    ],
    "indicators": [
      {
        "name": "HMI / System Tag",
        "state": "Battery Low",
        "meaning": "Battery low detected (CR2032, 4 years typical)"
      }
    ],
    "faults": [
      {
        "title": "Digital input not registering",
        "symptom": "Input tag does not change when the sensor switches.",
        "causes": [
          "CM0 wired for the wrong polarity (sink wiring is for pnp devices, source wiring for npn devices)",
          "Input voltage below 15V"
        ],
        "confirm": [
          "Measure Ix to CM0 with the sensor active: 15-30VDC = ON, 0-5VDC = OFF (UG p.16)."
        ],
        "fix": [
          "Rewire the input group: use sink input wiring for a sourcing (pnp) device and source input wiring for a sinking (npn) device (UG p.10)."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf (p.10, p.16)"
      },
      {
        "title": "Analog input Overflow",
        "symptom": "Analog value stuck at maximum; Overflow in the I/O Status tag.",
        "causes": [
          "Input above the over-range boundary (10.15V / 20.3mA)",
          "Input mode in software does not match wiring (voltage vs current)"
        ],
        "confirm": [
          "Measure AIx to CM1; check the hardware configuration mode matches the wiring (UG p.11, p.17)."
        ],
        "fix": [
          "Correct the signal or set the input mode in the software to match the wiring."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf (p.11, p.17, note 7)"
      },
      {
        "title": "Sink transistor output O8/O9 damaged",
        "symptom": "O8 or O9 no longer switches.",
        "causes": [
          "Outputs O8 and O9 are not short-circuit protected; no current limiting device was fitted"
        ],
        "confirm": [
          "Measure O8/O9 to CM4 with the output commanded ON: 1V max drop expected (UG p.18)."
        ],
        "fix": [
          "Connect a current limiting device in series with O8 and O9 (UG p.12)."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf (p.12, p.18)"
      }
    ],
    "sources": [
      "https://www.unitronicsplc.com/Documents/UniStream/Built-in/UG_USx-B1_TR22_T24.pdf (UniStream Built-in User Guide US5/US7/US10/US15: p.10-18)"
    ]
  },
  {
    "id": "unistream-plc-usc",
    "title": "Unitronics UniStream PLC (USC-xx-B1/TR22/T24, USC-P-B10): status LEDs, error indications, built-in I/O",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "UniStream",
      "partNumber": "^USC-[BC]"
    },
    "normal": [
      {
        "terminals": "+V to 0V (power supply)",
        "state": "powered, TR22 / T24 models",
        "meter": "VDC",
        "expected": "24VDC nominal, 20.4VDC to 28.8VDC",
        "pins": [
          [
            "+V",
            "0V"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf p.1 Power Supply; terminals https://www.unitronicsplc.com/Documents/UniStream/PLC/IG_USC-xx-B1_TR22_T24.pdf p.8"
      },
      {
        "terminals": "+V to 0V (power supply)",
        "state": "powered, B1 models (no built-in I/O)",
        "meter": "VDC",
        "expected": "12VDC or 24VDC, 10.2VDC to 28.8VDC",
        "pins": [
          [
            "+V",
            "0V"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf p.1 Power Supply; terminals https://www.unitronicsplc.com/Documents/UniStream/PLC/IG_USC-xx-B1_TR22_T24.pdf p.8"
      },
      {
        "terminals": "I0…I9 to CM0 (TR22/T24 digital inputs, sink or source)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "15-30VDC (magnitude), 4mA min; 24VDC @ 6mA nominal",
        "pins": [
          [
            "I0",
            "CM0"
          ],
          [
            "I1",
            "CM0"
          ],
          [
            "I2",
            "CM0"
          ],
          [
            "I3",
            "CM0"
          ],
          [
            "I4",
            "CM0"
          ],
          [
            "I5",
            "CM0"
          ],
          [
            "I6",
            "CM0"
          ],
          [
            "I7",
            "CM0"
          ],
          [
            "I8",
            "CM0"
          ],
          [
            "I9",
            "CM0"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf p.3 Digital Inputs; common CM0: https://www.unitronicsplc.com/Documents/UniStream/PLC/IG_USC-xx-B1_TR22_T24.pdf p.9"
      },
      {
        "terminals": "I0…I9 to CM0",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "0-5VDC, 1mA max",
        "pins": [
          [
            "I0",
            "CM0"
          ],
          [
            "I1",
            "CM0"
          ],
          [
            "I2",
            "CM0"
          ],
          [
            "I3",
            "CM0"
          ],
          [
            "I4",
            "CM0"
          ],
          [
            "I5",
            "CM0"
          ],
          [
            "I6",
            "CM0"
          ],
          [
            "I7",
            "CM0"
          ],
          [
            "I8",
            "CM0"
          ],
          [
            "I9",
            "CM0"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf p.3 Digital Inputs"
      },
      {
        "terminals": "CM2 to O0…O3, CM3 to O4…O7 (TR22 relay outputs, SPST-NO)",
        "state": "output ON",
        "meter": "continuity",
        "expected": "contact closed; 2A max per output, 250VAC / 30VDC max, min load 1mA 5VDC",
        "pins": [
          [
            "CM2",
            "O0"
          ],
          [
            "CM2",
            "O1"
          ],
          [
            "CM2",
            "O2"
          ],
          [
            "CM2",
            "O3"
          ],
          [
            "CM3",
            "O4"
          ],
          [
            "CM3",
            "O5"
          ],
          [
            "CM3",
            "O6"
          ],
          [
            "CM3",
            "O7"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf p.4 Relay Outputs; commons https://www.unitronicsplc.com/Documents/UniStream/PLC/IG_USC-xx-B1_TR22_T24.pdf p.10"
      },
      {
        "terminals": "O8, O9 to CM4 (TR22 sink transistor outputs)",
        "state": "output ON",
        "meter": "VDC",
        "expected": "on state voltage drop 1V max",
        "pins": [
          [
            "O8",
            "CM4"
          ],
          [
            "O9",
            "CM4"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf p.5; https://www.unitronicsplc.com/Documents/UniStream/PLC/IG_USC-xx-B1_TR22_T24.pdf p.11"
      }
    ],
    "pairs": [
      {
        "a": "CM2",
        "b": "O0",
        "when": "output O0 ON",
        "note": "TR22 relay, SPST-NO (Form A); O0-O3 share common return CM2"
      },
      {
        "a": "CM2",
        "b": "O1",
        "when": "output O1 ON",
        "note": "TR22 relay, SPST-NO (Form A); O0-O3 share common return CM2"
      },
      {
        "a": "CM2",
        "b": "O2",
        "when": "output O2 ON",
        "note": "TR22 relay, SPST-NO (Form A); O0-O3 share common return CM2"
      },
      {
        "a": "CM2",
        "b": "O3",
        "when": "output O3 ON",
        "note": "TR22 relay, SPST-NO (Form A); O0-O3 share common return CM2"
      },
      {
        "a": "CM3",
        "b": "O4",
        "when": "output O4 ON",
        "note": "TR22 relay; O4-O7 share common return CM3"
      },
      {
        "a": "CM3",
        "b": "O5",
        "when": "output O5 ON",
        "note": "TR22 relay; O4-O7 share common return CM3"
      },
      {
        "a": "CM3",
        "b": "O6",
        "when": "output O6 ON",
        "note": "TR22 relay; O4-O7 share common return CM3"
      },
      {
        "a": "CM3",
        "b": "O7",
        "when": "output O7 ON",
        "note": "TR22 relay; O4-O7 share common return CM3"
      },
      {
        "a": "CM4",
        "b": "0V",
        "when": "always",
        "note": "CM4 is internally connected to the 0V point; do not externally connect CM4 to the system 0V (IG p.11)"
      }
    ],
    "indicators": [
      {
        "name": "Digital input LED",
        "state": "green",
        "meaning": "Input state"
      },
      {
        "name": "Analog input LED",
        "state": "red on",
        "meaning": "Input value is in Overflow"
      },
      {
        "name": "Relay / transistor output LED",
        "state": "green",
        "meaning": "Output state"
      },
      {
        "name": "RUN",
        "state": "green on",
        "meaning": "Run mode"
      },
      {
        "name": "RUN",
        "state": "orange on",
        "meaning": "Start-up mode"
      },
      {
        "name": "RUN",
        "state": "orange blink",
        "meaning": "Stop mode"
      },
      {
        "name": "ERROR",
        "state": "red on/blink",
        "meaning": "Error, read together with RUN and USB (see faults)"
      },
      {
        "name": "USB",
        "state": "green on / blink",
        "meaning": "USB drive with valid action file detected / USB action in progress"
      },
      {
        "name": "BATT. LOW",
        "state": "red on",
        "meaning": "Battery is low or missing"
      },
      {
        "name": "FORCE",
        "state": "red on",
        "meaning": "I/O Force on"
      }
    ],
    "faults": [
      {
        "title": "HW Configuration Mismatch",
        "symptom": "ERROR LED red blink (RUN not blinking orange, USB off).",
        "causes": [
          "The HWC in the UniLogic application does not match the Uni-I/O modules physically connected to the PLC"
        ],
        "confirm": [
          "Compare the UniLogic hardware configuration with the installed Uni-I/O modules (Spec p.6 Error Indications)."
        ],
        "fix": [
          "Correct the hardware configuration or the installed modules so they match."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf (p.6 Error Indications)"
      },
      {
        "title": "Application Invalid or Version Mismatch",
        "symptom": "RUN orange blink + ERROR red blink.",
        "causes": [
          "Application invalid",
          "UniLogic version not supported by device firmware"
        ],
        "confirm": [
          "Read the LED combination: RUN orange blink and ERROR red blink (Spec p.6)."
        ],
        "fix": [
          "Download a valid application built with a UniLogic version supported by the firmware (or update the firmware)."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf (p.6)"
      },
      {
        "title": "Uni-I/O Error",
        "symptom": "ERROR LED red on.",
        "causes": [
          "Uni-I/O error"
        ],
        "confirm": [
          "Check the Uni-I/O module status LEDs and wiring connections (Spec p.6)."
        ],
        "fix": [
          "Check wiring connections of the I/O modules."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf (p.6)"
      },
      {
        "title": "OS/Application error",
        "symptom": "RUN orange blink + ERROR red on.",
        "causes": [
          "OS/Application error"
        ],
        "confirm": [
          "Read the LED combination (Spec p.6)."
        ],
        "fix": [
          "Reload the application / OS with UniLogic."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf (p.6)"
      },
      {
        "title": "USB Action failed",
        "symptom": "ERROR red blink with USB off, or ERROR red blink with USB green on.",
        "causes": [
          "USB action failed or ran with error",
          "USB drive contains corrupt action file(s) (ERROR red blink, USB green off)"
        ],
        "confirm": [
          "Read the LED combination in the USB Actions Indications table (Spec p.6-7)."
        ],
        "fix": [
          "Disconnect the USB drive to dismiss the error; recreate the action file."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf (p.6-7)"
      },
      {
        "title": "Battery low",
        "symptom": "BATT. LOW LED red on.",
        "causes": [
          "Battery low or missing"
        ],
        "confirm": [
          "Check the BATT. LOW LED and the battery System Tag."
        ],
        "fix": [
          "Replace the battery with power off, after backing up retained data."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf (p.6)"
      }
    ],
    "sources": [
      "https://www.unitronicsplc.com/Documents/UniStream/PLC/SPEC_USC-xx-B1_TR22_T24.pdf (UniStream PLC Technical Specifications USC-xx-B1/TR22/T24, DOC32008-A3: p.1-9)",
      "https://www.unitronicsplc.com/Documents/UniStream/PLC/IG_USC-xx-B1_TR22_T24.pdf (UniStream PLC Installation Guide: p.8-12)"
    ]
  },
  {
    "id": "unistream-uni-io-digital-modules",
    "title": "Unitronics UniStream Uni-I/O digital modules (UID-1600, UID-0016T/R, UID-0808T/R)",
    "match": {
      "categories": [
        "plcModule"
      ],
      "family": "UniStream",
      "partNumber": "^UID-"
    },
    "normal": [
      {
        "terminals": "Ix to its group common CM0…CM3 (I0-I3: CM0, I4-I7: CM1, I8-I11: CM2, I12-I15: CM3)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "15-30VDC, 4mA minimum (sink or source)",
        "pins": [
          [
            "I0",
            "CM0"
          ],
          [
            "I4",
            "CM1"
          ],
          [
            "I8",
            "CM2"
          ],
          [
            "I12",
            "CM3"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf p.7 wiring, p.11-12 specs"
      },
      {
        "terminals": "Ix to CMx",
        "state": "input OFF",
        "meter": "VDC",
        "expected": "0-5VDC, 1mA maximum",
        "pins": [
          [
            "I0",
            "CM0"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf p.11-12"
      },
      {
        "terminals": "24V to 0V (output power supply, UID-0808R/0016R/0808T/0016T)",
        "state": "powered",
        "meter": "VDC",
        "expected": "20.4 – 28.8VDC (24VDC nominal); the module 0V must be connected to the panel 0V",
        "pins": [
          [
            "24V",
            "0V"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf p.8-9, p.13"
      },
      {
        "terminals": "Ox to 0V (UID-0808T/0016T source transistor outputs)",
        "state": "output ON",
        "meter": "VDC",
        "expected": "supply minus 0.5V max drop; 0.5A max per output",
        "pins": [
          [
            "O0",
            "0V"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf p.9, p.13"
      }
    ],
    "pairs": [
      {
        "a": "CM2",
        "b": "O0",
        "when": "output O0 ON",
        "note": "UID-0808R relay: O0-O3 share CM2"
      },
      {
        "a": "CM2",
        "b": "O1",
        "when": "output O1 ON",
        "note": "UID-0808R relay: O0-O3 share CM2"
      },
      {
        "a": "CM2",
        "b": "O2",
        "when": "output O2 ON",
        "note": "UID-0808R relay: O0-O3 share CM2"
      },
      {
        "a": "CM2",
        "b": "O3",
        "when": "output O3 ON",
        "note": "UID-0808R relay: O0-O3 share CM2"
      },
      {
        "a": "CM3",
        "b": "O4",
        "when": "output O4 ON",
        "note": "UID-0808R relay: O4-O7 share CM3"
      },
      {
        "a": "CM3",
        "b": "O5",
        "when": "output O5 ON",
        "note": "UID-0808R relay: O4-O7 share CM3"
      },
      {
        "a": "CM3",
        "b": "O6",
        "when": "output O6 ON",
        "note": "UID-0808R relay: O4-O7 share CM3"
      },
      {
        "a": "CM3",
        "b": "O7",
        "when": "output O7 ON",
        "note": "UID-0808R relay: O4-O7 share CM3"
      }
    ],
    "indicators": [
      {
        "name": "Input / output LEDs (green)",
        "state": "on",
        "meaning": "Input / output state"
      },
      {
        "name": "Status LED",
        "state": "green on",
        "meaning": "Operating normally"
      },
      {
        "name": "Status LED",
        "state": "green slow blink",
        "meaning": "Boot"
      },
      {
        "name": "Status LED",
        "state": "green rapid blink",
        "meaning": "OS initialization"
      },
      {
        "name": "Status LED",
        "state": "green/red slow blink",
        "meaning": "Configuration mismatch"
      },
      {
        "name": "Status LED",
        "state": "red on",
        "meaning": "Output short-circuit (models with transistor outputs)"
      },
      {
        "name": "Status LED",
        "state": "red slow blink",
        "meaning": "No IO exchange"
      },
      {
        "name": "Status LED",
        "state": "red rapid blink",
        "meaning": "Communication error"
      },
      {
        "name": "Status LED",
        "state": "orange rapid blink",
        "meaning": "OS Upgrade"
      },
      {
        "name": "Status LED",
        "state": "orange slow blink",
        "meaning": "Firmware Error, contact support"
      }
    ],
    "faults": [
      {
        "title": "Configuration mismatch",
        "symptom": "Status LED green/red slow blink.",
        "causes": [
          "Module does not match the hardware configuration in UniLogic"
        ],
        "confirm": [
          "Read the status LED (UG p.15)."
        ],
        "fix": [
          "Correct the hardware configuration or the module type/position."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf (p.15 LED Indications)"
      },
      {
        "title": "Output short-circuit",
        "symptom": "Status LED red on (transistor output models).",
        "causes": [
          "Short-circuit on a transistor output"
        ],
        "confirm": [
          "Find the output whose load is shorted; measure the load resistance with power off."
        ],
        "fix": [
          "Remove the short; outputs are short-circuit protected (UG p.13)."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf (p.13, p.15)"
      },
      {
        "title": "No IO exchange / communication error",
        "symptom": "Status LED red slow blink (no IO exchange) or red rapid blink (communication error).",
        "causes": [
          "No I/O exchange with the CPU",
          "I/O bus communication error"
        ],
        "confirm": [
          "Check the I/O bus connectors between modules (bus connector cover only on the last module) (UG p.2-3, p.15)."
        ],
        "fix": [
          "Reseat the modules and bus connectors with power off."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf (p.2-3, p.15)"
      },
      {
        "title": "Firmware error",
        "symptom": "Status LED orange slow blink.",
        "causes": [
          "Firmware error"
        ],
        "confirm": [
          "Read the status LED (UG p.15)."
        ],
        "fix": [
          "Contact Unitronics support."
        ],
        "source": "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf (p.15)"
      }
    ],
    "sources": [
      "https://www.unitronicsplc.com/Documents/UniStream/Uni-I_O/UG_UID-xxx.pdf (Uni-I/O Modules User Guide and Technical Specifications UID-0808R/0808T/0808THS/1600/0016R/0016T: p.2-15)"
    ]
  },
  {
    "id": "vision-v130-v350-t38",
    "title": "Unitronics Vision V130/V350 -T38 PLC+HMI (22 inputs, 16 pnp outputs)",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "Vision",
      "partNumber": "T38$"
    },
    "normal": [
      {
        "terminals": "24VDC to 0V (power supply; 0V = pin 2, functional earth = pin 3)",
        "state": "powered",
        "meter": "VDC",
        "expected": "24VDC nominal, 20.4VDC to 28.8VDC with less than 10% ripple",
        "note": "https://www.unitronicsplc.com/Documents/Vision/PLC/UG_V130_350_430-T38.pdf p.10, p.14"
      },
      {
        "terminals": "Input to 0V, pnp (source) wiring (JP5 = B, default)",
        "state": "input ON (logic 1)",
        "meter": "VDC",
        "expected": "17-28.8VDC (logic 0: 0-5VDC); 3.7mA @ 24VDC",
        "note": "https://www.unitronicsplc.com/Documents/Vision/PLC/UG_V130_350_430-T38.pdf p.8, p.14"
      },
      {
        "terminals": "Input to 0V, npn (sink) wiring (JP5 = A)",
        "state": "input ON (logic 1)",
        "meter": "VDC",
        "expected": "0-5VDC (logic 0: 17-28.8VDC)",
        "note": "https://www.unitronicsplc.com/Documents/Vision/PLC/UG_V130_350_430-T38.pdf p.8, p.14"
      },
      {
        "terminals": "Output power supply (pnp outputs)",
        "state": "powered",
        "meter": "VDC",
        "expected": "20.4 to 28.8VDC (24VDC nominal); output on-voltage drop 0.5VDC max, 0.5A max per output",
        "note": "https://www.unitronicsplc.com/Documents/Vision/PLC/UG_V130_350_430-T38.pdf p.16"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Inputs read inverted or never turn on",
        "symptom": "All inputs behave wrongly after wiring.",
        "causes": [
          "Jumper JP5 (all inputs) set for npn but devices wired pnp, or the reverse",
          "Controller and I/O signals not on the same 0V"
        ],
        "confirm": [
          "Measure input to 0V: pnp logic 1 = 17-28.8VDC; npn logic 1 = 0-5VDC (UG p.14).",
          "Check JP5: A = npn (sink), B = pnp (source) (UG p.8)."
        ],
        "fix": [
          "Set JP5 to match the wiring with power off; connect controller and I/O to the same 0V (UG p.7-8). Incompatible jumper settings and wiring may damage the controller."
        ],
        "source": "https://www.unitronicsplc.com/Documents/Vision/PLC/UG_V130_350_430-T38.pdf (p.7-8, p.14)"
      },
      {
        "title": "Output short circuit",
        "symptom": "pnp output turns off; short circuit indicated via software.",
        "causes": [
          "Shorted load"
        ],
        "confirm": [
          "Check the short-circuit indication in the application (UG p.16)."
        ],
        "fix": [
          "Remove the short; outputs are short-circuit protected."
        ],
        "source": "https://www.unitronicsplc.com/Documents/Vision/PLC/UG_V130_350_430-T38.pdf (p.16)"
      },
      {
        "title": "Analog input out of range",
        "symptom": "Analog value flags an error.",
        "causes": [
          "Analog input deviates above the permissible range"
        ],
        "confirm": [
          "Check the status indication of the analog input (UG p.15)."
        ],
        "fix": [
          "Correct the signal; set JP1/JP2 (inputs 14/15 analog) and JP3/JP4 (voltage/current) to match the wiring (UG p.8)."
        ],
        "source": "https://www.unitronicsplc.com/Documents/Vision/PLC/UG_V130_350_430-T38.pdf (p.8, p.15)"
      }
    ],
    "sources": [
      "https://www.unitronicsplc.com/Documents/Vision/PLC/UG_V130_350_430-T38.pdf (Vision PLC+HMI User Guide V130-33-T38/V350-35-T38/V430-J-T38: p.7-16)"
    ]
  },
  {
    "id": "jazz-jz20-r31",
    "title": "Unitronics Jazz JZ20-R31 / JZ20-J-R31 (18 digital + analog inputs, 11 relay outputs)",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "Jazz",
      "partNumber": "JZ20-(J-)?R31"
    },
    "normal": [
      {
        "terminals": "24VDC to 0V (power supply)",
        "state": "powered",
        "meter": "VDC",
        "expected": "24VDC nominal, 20.4VDC to 28.8VDC with less than 10% ripple",
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-R31.pdf p.7"
      },
      {
        "terminals": "I0…I17 to 0V, pnp (source) wiring",
        "state": "input ON (logic 1)",
        "meter": "VDC",
        "expected": "17-28.8VDC (logic 0: 0-5VDC)",
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-R31.pdf p.5, p.7"
      },
      {
        "terminals": "I0…I17 to 0V, npn (sink) wiring",
        "state": "input ON (logic 1)",
        "meter": "VDC",
        "expected": "0-5VDC (logic 0: 17-28.8VDC)",
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-R31.pdf p.5, p.7"
      },
      {
        "terminals": "Relay outputs O0…O10 (O0-O5 share a common, O6-O10 share a common)",
        "state": "output ON",
        "meter": "continuity",
        "expected": "SPST-NO contact closed; 3A max per output, 8A max per common, 250VAC / 30VDC",
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-R31.pdf p.8"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Digital inputs do not respond",
        "symptom": "Input group never turns on.",
        "causes": [
          "npn/pnp pins of the input group not connected",
          "Group wired npn but devices are pnp (or the reverse)"
        ],
        "confirm": [
          "Measure input to 0V: pnp logic 1 = 17-28.8VDC, npn logic 1 = 0-5VDC (UG p.7)."
        ],
        "fix": [
          "Connect the npn/pnp selection pins for each input group as in the wiring diagrams; the two groups may be wired differently (UG p.5)."
        ],
        "source": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-R31.pdf (p.5, p.7)"
      }
    ],
    "sources": [
      "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-R31.pdf (Jazz User Guide: p.5-8)"
    ]
  },
  {
    "id": "jazz-jz20-t40",
    "title": "Unitronics Jazz JZ20-T40 / JZ20-J-T40 (18 digital + analog inputs, 20 pnp outputs)",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "Jazz",
      "partNumber": "JZ20-(J-)?T40"
    },
    "normal": [
      {
        "terminals": "24VDC to 0V (power supply)",
        "state": "powered",
        "meter": "VDC",
        "expected": "24VDC nominal, 20.4VDC to 28.8VDC with less than 10% ripple",
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-T40.pdf p.7"
      },
      {
        "terminals": "I0…I17 to 0V, pnp (source) wiring",
        "state": "input ON (logic 1)",
        "meter": "VDC",
        "expected": "17-28.8VDC (logic 0: 0-5VDC)",
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-T40.pdf p.5, p.7"
      },
      {
        "terminals": "I0…I17 to 0V, npn (sink) wiring",
        "state": "input ON (logic 1)",
        "meter": "VDC",
        "expected": "0-5VDC (logic 0: 17-28.8VDC)",
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-T40.pdf p.5, p.7"
      },
      {
        "terminals": "+V01 (O0-O11) / +V02 (O12-O19) to 0V (output power)",
        "state": "powered",
        "meter": "VDC",
        "expected": "20.4 to 28.8VDC (24VDC nominal)",
        "pins": [
          [
            "+V01",
            "0V"
          ],
          [
            "+V02",
            "0V"
          ]
        ],
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-T40.pdf p.6, p.8"
      },
      {
        "terminals": "Ox to 0V (pnp source output)",
        "state": "output ON",
        "meter": "VDC",
        "expected": "output supply minus 0.5VDC max; 0.5A max per output, 4A per group",
        "note": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-T40.pdf p.8"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Digital inputs do not respond",
        "symptom": "Input group never turns on.",
        "causes": [
          "npn/pnp pins of the input group not connected",
          "Group wired npn but devices are pnp (or the reverse)"
        ],
        "confirm": [
          "Measure input to 0V: pnp logic 1 = 17-28.8VDC, npn logic 1 = 0-5VDC (UG p.7)."
        ],
        "fix": [
          "Connect the npn/pnp selection pins for each input group as in the wiring diagrams; the two groups may be wired differently (UG p.5)."
        ],
        "source": "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-T40.pdf (p.5, p.7)"
      }
    ],
    "sources": [
      "https://www.unitronicsplc.com/Documents/Jazz/PLC/UG_JZ20-T40.pdf (Jazz User Guide: p.5-8)"
    ]
  }
];
