import type { DeviceFaultProfile } from "../deviceFaults";

/**
 * Roll former / flying shear devices: Omron E6B2-C encoders (NPN open collector, line driver), Omron H7CX counters
 * (screw / socket, output contact pairs), Bosch Rexroth 4WE6 DC solenoid valves and HED 8 pressure switches.
 * From the makers' datasheets / operating instructions (each fault cites its page).
 */
export const ROLLFORMER_FAULTS: DeviceFaultProfile[] = [
  {
    "id": "omron-e6b2-c-npn-open-collector",
    "title": "Omron E6B2-C incremental encoder, NPN open-collector output (E6B2-CWZ6C)",
    "match": {
      "categories": [
        "encoder"
      ],
      "partNumber": "^E6B2-CWZ6C"
    },
    "normal": [
      {
        "terminals": "BN (+Vcc) to BU (0 V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "5 VDC -5% to 24 VDC +15% (4.75-27.6 VDC); ripple 5% p-p max.; current 70 mA max.",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ],
        "note": "Inrush approx. 9 A for approx. 0.3 ms at power ON."
      },
      {
        "terminals": "BK (phase A) to BU (0 V)",
        "state": "phase A output ON (transistor ON)",
        "meter": "VDC",
        "expected": "0.4 V max. at 35 mA sink current",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ],
        "note": "Turn the shaft slowly: the output toggles between this level and the pull-up / counter input voltage (30 VDC max. applied)."
      },
      {
        "terminals": "WH (phase B) to BU (0 V)",
        "state": "phase B output ON",
        "meter": "VDC",
        "expected": "0.4 V max. at 35 mA sink current",
        "pins": [
          [
            "WH",
            "BU"
          ]
        ]
      },
      {
        "terminals": "OG (phase Z) to BU (0 V)",
        "state": "phase Z output ON (once per revolution)",
        "meter": "VDC",
        "expected": "0.4 V max. at 35 mA sink current",
        "pins": [
          [
            "OG",
            "BU"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "BK",
        "b": "BU",
        "when": "phase A output ON",
        "note": "NPN open-collector transistor, 35 mA max., 30 VDC max."
      },
      {
        "a": "WH",
        "b": "BU",
        "when": "phase B output ON",
        "note": "NPN open-collector transistor, 35 mA max., 30 VDC max."
      },
      {
        "a": "OG",
        "b": "BU",
        "when": "phase Z output ON",
        "note": "NPN open-collector transistor, 35 mA max., 30 VDC max."
      }
    ],
    "indicators": [],
    "faults": [
      {
        "symptomKind": "no-input",
        "title": "No count: supply or wiring",
        "symptom": "Counter does not count while the measuring wheel turns.",
        "causes": [
          "Encoder supply missing, reversed or outside 5-24 VDC",
          "Open-collector output not pulled up (no independent power supply or pull-up resistor at the counter input)",
          "Wire colour mix-up"
        ],
        "confirm": [
          "Measure BN to BU: must be 4.75-27.6 VDC.",
          "Turn the shaft slowly and measure BK to BU: it must switch to 0.4 V max. when the output is ON; if it never changes, check the pull-up at the counter input."
        ],
        "fix": [
          "Wire per the colour code: BN +Vcc, BK phase A, WH phase B, OG phase Z, BU 0 V (common); connect the external terminals correctly or the encoder may be damaged.",
          "With counters that need it, provide an independent power supply or pull-up resistor."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.2 (Ratings), p.3 (Output Circuits, Connection) and p.5 (Connections with Peripheral Devices)"
      },
      {
        "symptomKind": "no-input",
        "title": "Counts lost at speed (response speed exceeded)",
        "symptom": "Count is short at high line speed but correct when jogging slowly.",
        "causes": [
          "Shaft speed above the maximum electrical response speed for the resolution (rpm = max. response speed / resolution x 60)",
          "Receiving counter set to a slower counting speed than the encoder pulse rate"
        ],
        "confirm": [
          "Compute the pulse rate: P/R x rpm / 60; it must stay below 100 kHz (E6B2-CWZ6C / -CWZ3E) or 50 kHz (E6B2-CWZ5B).",
          "Check the counter input speed setting against the pulse rate."
        ],
        "fix": [
          "Use a lower resolution encoder or reduce speed so the pulse rate stays within the maximum response speed."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.2 (Ratings/Characteristics, note 3)"
      },
      {
        "title": "Wrong count direction",
        "symptom": "Count decreases when the material feeds forward (or increases in reverse).",
        "causes": [
          "Encoder mounted so that the shaft turns CCW for forward feed (phase A lags phase B)",
          "Phase A / phase B wiring to the counter swapped"
        ],
        "confirm": [
          "Check the timing: CW rotation (viewed from the shaft end) gives phase A 1/4T +/- 1/8T ahead of phase B; CCW gives phase A behind phase B."
        ],
        "fix": [
          "When the encoder is used in reversing operation, check the mounting direction and the increment/decrement directions of the counter input."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.4 (Timing Charts) and p.7 (Installation)"
      },
      {
        "title": "Miscounting when the line stops",
        "symptom": "Count drifts by a pulse or more each time the line stops and restarts.",
        "causes": [
          "The encoder stopped near a signal rising or falling edge and vibration produced extra pulses"
        ],
        "confirm": [
          "Watch the count at standstill: a count that changes by +/-1 while the shaft is stopped confirms edge chatter."
        ],
        "fix": [
          "Use an increment-decrement (quadrature) counter input to prevent miscounting."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.8 (Preventing Miscounting)"
      },
      {
        "title": "Noise pulses / erratic count",
        "symptom": "Count jumps when a motor, valve or VFD switches; extra counts with the line stopped.",
        "causes": [
          "Encoder cable run alongside power or inductive load wiring",
          "Long cable (residual voltage and rise time grow with length)",
          "Surges on the encoder supply"
        ],
        "confirm": [
          "Check the cable route and length; check whether the shield is connected (connect GND to 0 V or to an external ground)."
        ],
        "fix": [
          "Lay the cable the shortest distance and away from noise sources; insert a surge absorber between the power supply terminals if there is any surge; for long runs use the line-driver model with twisted-pair cable."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.3 (Connection notes) and p.8 (Connections, Cable Extension)"
      },
      {
        "title": "False pulses at power ON / OFF",
        "symptom": "Counter shows a few counts right after the machine is switched on or off.",
        "causes": [
          "Incorrect pulses can be generated when the encoder is turned ON or OFF"
        ],
        "confirm": [
          "Check whether the counts appear only within about 0.1 s of encoder power-up or power-down."
        ],
        "fix": [
          "Do not use the connected device for 0.1 s after the encoder is turned ON and for 0.1 s before it is turned OFF."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.8 (Connections)"
      },
      {
        "title": "Shaft / coupling problem (coupling slip or bearing overload)",
        "symptom": "Count is short or irregular although the electrical signals are clean; encoder noisy or shaft stiff.",
        "causes": [
          "Coupling set screws not tightened to the specified torque",
          "Shaft misalignment beyond tolerance",
          "Excessive radial or thrust load (e.g. gear or belt directly on the shaft)"
        ],
        "confirm": [
          "Check coupling tightening torque (E69-C06B 0.25 N.m, E69-C68B/-C610B 0.44 N.m, E69-C06M 0.7 N.m).",
          "Check alignment: eccentricity 0.15 mm max., declination 2 deg max., axial displacement 0.05 mm max.",
          "Shaft load limits: radial 30 N, thrust 20 N."
        ],
        "fix": [
          "Re-mount the coupling to the specified torque and alignment; connect chains, belts or gears to the shaft through a bearing and coupling, not directly."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.2 (Shaft loading), p.7 (Mounting, Eccentricity tolerance) and p.8 (Mounting)"
      }
    ],
    "sources": [
      "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf"
    ]
  },
  {
    "id": "omron-e6b2-c-line-driver",
    "title": "Omron E6B2-C incremental encoder, line-driver output (E6B2-CWZ1X)",
    "match": {
      "categories": [
        "encoder"
      ],
      "partNumber": "^E6B2-CWZ1X"
    },
    "normal": [
      {
        "terminals": "BN (+Vcc) to BU (0 V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "5 VDC +/-5% (4.75-5.25 VDC); ripple 5% p-p max.; current 130 mA max.",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ],
        "note": "Approx. 1 V drop on 100 m of cable: check 5 VDC at the encoder end."
      },
      {
        "terminals": "BK (phase A) to BU (0 V)",
        "state": "phase A high",
        "meter": "VDC",
        "expected": "2.5 V min. (AM26LS31 equivalent, Io = -20 mA)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (phase A) to BU (0 V)",
        "state": "phase A low",
        "meter": "VDC",
        "expected": "0.5 V max. (Is = 20 mA)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "WH (phase B) to BU (0 V)",
        "state": "phase B high / low",
        "meter": "VDC",
        "expected": "high 2.5 V min., low 0.5 V max.",
        "pins": [
          [
            "WH",
            "BU"
          ]
        ]
      },
      {
        "terminals": "OG (phase Z) to BU (0 V)",
        "state": "phase Z high / low",
        "meter": "VDC",
        "expected": "high 2.5 V min., low 0.5 V max.",
        "pins": [
          [
            "OG",
            "BU"
          ]
        ]
      },
      {
        "terminals": "Reversed outputs (black/red, white/red, orange/red stripes)",
        "state": "any",
        "meter": "VDC",
        "expected": "complement of phase A / B / Z (RS-422A); receiver AM26LS32 equivalent"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "symptomKind": "no-input",
        "title": "No count: supply or wiring",
        "symptom": "Counter or drive does not count while the wheel turns.",
        "causes": [
          "Supply not 5 VDC (the line-driver model is 5 VDC +/-5% only)",
          "Voltage drop on a long cable",
          "Receiver not RS-422A (AM26LS32 equivalent)",
          "Wire colour mix-up between normal and reversed outputs"
        ],
        "confirm": [
          "Measure BN to BU at the encoder: 4.75-5.25 VDC.",
          "Measure BK to BU while turning slowly: 0.5 V max. low, 2.5 V min. high."
        ],
        "fix": [
          "Check that the E6B2-C is supplied with 5 VDC when a line-driver output is used; use twisted-pair cable and an RS-422A receiver."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.2 (Ratings), p.3 (Connection) and p.8 (Extension of Line Driver Output)"
      },
      {
        "title": "Wrong count direction",
        "symptom": "Count decreases when the material feeds forward (or increases in reverse).",
        "causes": [
          "Encoder mounted so that the shaft turns CCW for forward feed (phase A lags phase B)",
          "Phase A / phase B wiring to the counter swapped"
        ],
        "confirm": [
          "Check the timing: CW rotation (viewed from the shaft end) gives phase A 1/4T +/- 1/8T ahead of phase B; CCW gives phase A behind phase B."
        ],
        "fix": [
          "When the encoder is used in reversing operation, check the mounting direction and the increment/decrement directions of the counter input."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.4 (Timing Charts) and p.7 (Installation)"
      },
      {
        "title": "Miscounting when the line stops",
        "symptom": "Count drifts by a pulse or more each time the line stops and restarts.",
        "causes": [
          "The encoder stopped near a signal rising or falling edge and vibration produced extra pulses"
        ],
        "confirm": [
          "Watch the count at standstill: a count that changes by +/-1 while the shaft is stopped confirms edge chatter."
        ],
        "fix": [
          "Use an increment-decrement (quadrature) counter input to prevent miscounting."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.8 (Preventing Miscounting)"
      },
      {
        "title": "Noise pulses / erratic count",
        "symptom": "Count jumps when a motor, valve or VFD switches; extra counts with the line stopped.",
        "causes": [
          "Encoder cable run alongside power or inductive load wiring",
          "Long cable (residual voltage and rise time grow with length)",
          "Surges on the encoder supply"
        ],
        "confirm": [
          "Check the cable route and length; check whether the shield is connected (connect GND to 0 V or to an external ground)."
        ],
        "fix": [
          "Lay the cable the shortest distance and away from noise sources; insert a surge absorber between the power supply terminals if there is any surge; for long runs use the line-driver model with twisted-pair cable."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.3 (Connection notes) and p.8 (Connections, Cable Extension)"
      },
      {
        "title": "False pulses at power ON / OFF",
        "symptom": "Counter shows a few counts right after the machine is switched on or off.",
        "causes": [
          "Incorrect pulses can be generated when the encoder is turned ON or OFF"
        ],
        "confirm": [
          "Check whether the counts appear only within about 0.1 s of encoder power-up or power-down."
        ],
        "fix": [
          "Do not use the connected device for 0.1 s after the encoder is turned ON and for 0.1 s before it is turned OFF."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.8 (Connections)"
      },
      {
        "title": "Shaft / coupling problem (coupling slip or bearing overload)",
        "symptom": "Count is short or irregular although the electrical signals are clean; encoder noisy or shaft stiff.",
        "causes": [
          "Coupling set screws not tightened to the specified torque",
          "Shaft misalignment beyond tolerance",
          "Excessive radial or thrust load (e.g. gear or belt directly on the shaft)"
        ],
        "confirm": [
          "Check coupling tightening torque (E69-C06B 0.25 N.m, E69-C68B/-C610B 0.44 N.m, E69-C06M 0.7 N.m).",
          "Check alignment: eccentricity 0.15 mm max., declination 2 deg max., axial displacement 0.05 mm max.",
          "Shaft load limits: radial 30 N, thrust 20 N."
        ],
        "fix": [
          "Re-mount the coupling to the specified torque and alignment; connect chains, belts or gears to the shaft through a bearing and coupling, not directly."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.2 (Shaft loading), p.7 (Mounting, Eccentricity tolerance) and p.8 (Mounting)"
      },
      {
        "symptomKind": "no-input",
        "title": "Counts lost at speed (response speed exceeded)",
        "symptom": "Count is short at high line speed but correct when jogging slowly.",
        "causes": [
          "Shaft speed above 6,000 r/min or pulse rate above the receiver capability"
        ],
        "confirm": [
          "Compute the pulse rate: P/R x rpm / 60 and compare with the receiving input."
        ],
        "fix": [
          "Reduce speed or resolution; maximum permissible speed 6,000 r/min."
        ],
        "source": "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf p.2 (Ratings/Characteristics)"
      }
    ],
    "sources": [
      "https://assets.omron.com/m/4e9b785b62076bef/original/E6B2_C_Q085-E1-03A-pdf.pdf"
    ]
  },
  {
    "id": "omron-h7cx-a-screw",
    "title": "Omron H7CX-A@-N preset counter, screw-terminal models (inputs, display, errors)",
    "match": {
      "categories": [
        "other"
      ],
      "family": "H7CX",
      "partNumber": "^H7CX-A(?!11)"
    },
    "normal": [
      {
        "terminals": "11 (+12 VDC) to 6 (0 V)",
        "state": "powered (100-240 VAC and D1 models)",
        "meter": "VDC",
        "expected": "12 VDC +/-10% (10.8-13.2 VDC), 100 mA max.",
        "pins": [
          [
            "11",
            "6"
          ]
        ],
        "note": "Not present on 12-24 VDC-only models (H7CX-A@D-N)."
      },
      {
        "terminals": "1 to 2 (power)",
        "state": "powered, 100-240 VAC models",
        "meter": "VAC",
        "expected": "100-240 VAC 50/60 Hz, 85-110% of rated",
        "pins": [
          [
            "1",
            "2"
          ]
        ]
      },
      {
        "terminals": "1 (-) to 2 (+) (power)",
        "state": "powered, 12-24 VDC models",
        "meter": "VDC",
        "expected": "12-24 VDC, 90-110% of rated (10.8-26.4 VDC); ripple 20% max.",
        "pins": [
          [
            "1",
            "2"
          ]
        ]
      },
      {
        "terminals": "9 (CP1) to 6 (0 V)",
        "state": "NPN input mode, sensor OFF / open",
        "meter": "VDC",
        "expected": "approx. 14 V (output from the input terminals in NPN mode)",
        "pins": [
          [
            "9",
            "6"
          ]
        ]
      },
      {
        "terminals": "9 (CP1) to 6 (0 V)",
        "state": "NPN input mode, sensor ON (short-circuit level)",
        "meter": "VDC",
        "expected": "3 V max. residual (ON impedance 1 kOhm max.; approx. 12 mA at 0 Ohm)",
        "pins": [
          [
            "9",
            "6"
          ]
        ]
      },
      {
        "terminals": "9 (CP1) to 6 (0 V)",
        "state": "PNP input mode, input ON (high)",
        "meter": "VDC",
        "expected": "4.5-30 VDC (input resistance approx. 4.7 kOhm)",
        "pins": [
          [
            "9",
            "6"
          ]
        ]
      },
      {
        "terminals": "9 (CP1) to 6 (0 V)",
        "state": "PNP input mode, input OFF (low)",
        "meter": "VDC",
        "expected": "0-2 VDC",
        "pins": [
          [
            "9",
            "6"
          ]
        ]
      },
      {
        "terminals": "8 (CP2) to 6 (0 V)",
        "state": "same levels as CP1 per input mode",
        "meter": "VDC",
        "expected": "NPN: ON 3 V max.; PNP: high 4.5-30 VDC, low 0-2 VDC",
        "pins": [
          [
            "8",
            "6"
          ]
        ]
      },
      {
        "terminals": "7 (reset / reset 1) to 6 (0 V)",
        "state": "reset input ON",
        "meter": "VDC",
        "expected": "NPN: 3 V max.; PNP: 4.5-30 VDC; min. reset signal width 1 ms or 20 ms (selectable)",
        "pins": [
          [
            "7",
            "6"
          ]
        ]
      },
      {
        "terminals": "10 (total reset / reset 2) to 6 (0 V)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "NPN: 3 V max.; PNP: 4.5-30 VDC",
        "pins": [
          [
            "10",
            "6"
          ]
        ]
      }
    ],
    "indicators": [
      {
        "name": "Main display (present value)",
        "state": "red / green / orange characters",
        "meaning": "Present count value; on screw-terminal models the colour can be set to change with the output state (H7CX-A11@ red only)."
      },
      {
        "name": "Sub-display (set value)",
        "state": "green characters",
        "meaning": "Set value (SV1/SV2 on 2-stage models)."
      },
      {
        "name": "Control output indicator (orange)",
        "state": "OUT (1-stage) / OUT 1, 2 (2-stage) lit",
        "meaning": "Control output ON."
      },
      {
        "name": "Reset indicator (orange)",
        "state": "lit",
        "meaning": "Reset input (reset 1) or Reset Key is ON; counting is not performed during reset."
      },
      {
        "name": "Key protect indicator (orange)",
        "state": "lit",
        "meaning": "Key-protect switch is ON (keys limited per KP-1 to KP-7)."
      },
      {
        "name": "Total count / batch indicator",
        "state": "lit",
        "meaning": "The total count value / batch count value is displayed."
      },
      {
        "name": "Display",
        "state": "blank",
        "meaning": "The display is lit only when the power is ON."
      }
    ],
    "faults": [
      {
        "code": "-----",
        "title": "Present value underflow",
        "symptom": "Main display flashes ----- (4-digit: ----).",
        "causes": [
          "Present value or total count value fell below -99999 (-999 on 4-digit models)"
        ],
        "confirm": [
          "Read the main display: flashing dashes (1-second cycle); output status unchanged."
        ],
        "fix": [
          "Either press the Reset Key or turn ON the reset input."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function)"
      },
      {
        "code": "FFFFF",
        "title": "Present value overflow",
        "symptom": "Main display flashes FFFFF (4-digit: FFFF); counting stops.",
        "causes": [
          "Present value exceeded 999999 (9999 on 4-digit models) in output modes K-2, D, L, H or in dual counter / tachometer operation"
        ],
        "confirm": [
          "Read the main display: flashing F characters."
        ],
        "fix": [
          "Either press the Reset Key or turn ON the reset input."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function) and p.25 (dual counter note)"
      },
      {
        "symptomKind": "display-code",
        "code": "E1",
        "title": "CPU error",
        "symptom": "Main display shows E1, sub-display not lit, output OFF.",
        "causes": [
          "Internal CPU error (e.g. noise)"
        ],
        "confirm": [
          "Read the display: E1 with the sub-display dark."
        ],
        "fix": [
          "Either press the Reset Key or reset the power supply; separate the counter from noise sources."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function) and p.52 (Precautions)"
      },
      {
        "symptomKind": "display-code",
        "code": "E2",
        "title": "Memory error",
        "symptom": "Main display shows E2, output OFF.",
        "causes": [
          "Sub-display not lit: memory error (RAM)",
          "Sub-display shows SUM: EEPROM memory error, including expired EEPROM life (100,000 writes)",
          "Supply voltage decreased gradually at power OFF"
        ],
        "confirm": [
          "Read the sub-display: not lit = RAM error; SUM = EEPROM error."
        ],
        "fix": [
          "RAM error: turn ON the power again. EEPROM error: press the Reset Key (settings return to factory setting) and re-enter the settings.",
          "Switch the supply with a switch, relay or contact so it turns OFF instantaneously."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function) and p.52-53 (Precautions)"
      },
      {
        "symptomKind": "display-code",
        "code": "E3",
        "title": "Output counter overflow",
        "symptom": "E3 alternates with the normal display.",
        "causes": [
          "The output ON count exceeded the alarm value set for an output (life management of counter / load)"
        ],
        "confirm": [
          "Read the display: E3 alternating with the present value."
        ],
        "fix": [
          "Press the Reset Key (the total ON count is not cleared by the Reset Key)."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function, notes 7, 8)"
      },
      {
        "symptomKind": "no-input",
        "title": "Does not count (NPN input mode)",
        "symptom": "Encoder or sensor pulses arrive but the present value does not change.",
        "causes": [
          "Input mode set to PNP while an NPN / open-collector sensor is wired",
          "Sensor not pulling the input to 0 V",
          "Reset input held ON",
          "Sensor waiting time after power ON (up to 290 ms)"
        ],
        "confirm": [
          "Measure 9 (CP1) to 6 (0 V) with the sensor OFF: approx. 14 V is output from the input terminals in NPN mode.",
          "With the sensor ON, 9 (CP1) to 6 (0 V) must be 3 V max. (ON impedance 1 kOhm max.).",
          "Check the reset indicator: lit means the reset input (7) is ON and counting is blocked."
        ],
        "fix": [
          "Set NPN/PNP input mode (imod, or DIP pin 8 OFF = NPN) to match the sensor; for 2-wire sensors select NPN.",
          "Use a sensor that contains a diode (approx. 14 V is output from the input terminals in NPN mode)."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Input method), p.7 (I/O functions), p.15 (DIP switch), p.18 (NPN/PNP Input Mode) and p.52 (Precautions)"
      },
      {
        "symptomKind": "no-input",
        "title": "Does not count (PNP input mode)",
        "symptom": "PNP sensor switches but the count does not change.",
        "causes": [
          "Input mode set to NPN while a PNP (voltage output) sensor is wired",
          "Input voltage below the high level"
        ],
        "confirm": [
          "Measure 9 (CP1) to 6 (0 V) with the sensor ON: high level 4.5-30 VDC; OFF: 0-2 VDC."
        ],
        "fix": [
          "Set the NPN/PNP input mode to PNP (DIP pin 8 ON or imod = pnp); keep the input voltage 30 VDC max."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Input method), p.9 (Voltage Inputs) and p.15 (DIP switch)"
      },
      {
        "symptomKind": "no-input",
        "title": "Counts lost at line speed",
        "symptom": "Count is short compared with the actual length; correct when jogging slowly.",
        "causes": [
          "Counting speed left at 30 Hz (factory setting, min. pulse width 16.7 ms) with encoder input",
          "Pulse width below the minimum signal width"
        ],
        "confirm": [
          "Read the counting speed setting (cnts): 30 Hz or 5 kHz / 10 kHz; compare with the encoder pulse rate (P/R x rpm / 60)."
        ],
        "fix": [
          "Set the counting speed to the high setting (DIP pin 2 ON or cnts); use 30 Hz only when contacts are used for input signals."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Maximum counting speed), p.15 (DIP switch) and p.18 (Counting Speed)"
      },
      {
        "title": "Wrong length / wrong direction",
        "symptom": "Displayed length is scaled wrong or counts down while feeding forward.",
        "causes": [
          "Prescale value set incorrectly",
          "Input mode not UP/DOWN C (quadrature) for an A/B encoder, or phases swapped on CP1/CP2"
        ],
        "confirm": [
          "Read the prescale value (pscl) and input mode (cntm).",
          "Example from the datasheet: 25 pulses for 0.5 m displayed as @@.@@ m needs decimal point 2 places and prescale 0.02."
        ],
        "fix": [
          "Correct the prescale value (0.001-99.999 on 6-digit, 0.001-9.999 on 4-digit models) and the input mode."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.18 (Input Mode, Prescale Value) and p.21 (Input Modes and Present Value)"
      },
      {
        "symptomKind": "output-no-motion",
        "title": "Output does not turn ON at the set value",
        "symptom": "Count reaches the set value but the cutter output does not switch.",
        "causes": [
          "Set value larger than (maximum countable value - prescale value)",
          "Key protection / wrong output mode",
          "Contact output beyond its electrical life (contacts fused or not closing)"
        ],
        "confirm": [
          "Compare the set value with the maximum countable value minus the prescale value.",
          "Check the OUT indicator: lit with no voltage at the load means the contact or load wiring is open."
        ],
        "fix": [
          "Set the set value below {maximum countable value - prescale value}; use the output relay within its rated load (3 A at 250 VAC / 30 VDC resistive) and life (100,000 operations at 3 A, 250 VAC)."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Control output), p.6 (Life expectancy), p.18 (Prescale Value) and p.52 (Precautions)"
      },
      {
        "title": "Does not start / unstable at power ON",
        "symptom": "Display stays blank or outputs are unstable after switching on.",
        "causes": [
          "Supply outside the rated range (inverter output used as supply, DC ripple above 20%)",
          "Supply not reaching rated voltage within 0.1 s",
          "Supply too small for the approx. 10 A inrush"
        ],
        "confirm": [
          "Measure the supply at the power terminals: within 85-110% of rated (12-24 VDC: 90-110%)."
        ],
        "fix": [
          "Do not use the output from an inverter as the power supply; switch the supply with a switch, relay or contact so the rated voltage is reached within 0.1 s; use a supply with sufficient capacity."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Ratings, note 2) and p.52-53 (Precautions)"
      },
      {
        "title": "Sensor supply overloaded",
        "symptom": "Sensors powered from the counter (11 (+12 VDC)) drop out or the counter restarts.",
        "causes": [
          "Total sensor current above 100 mA (less on 12-24 VDC supply, see derating curve)"
        ],
        "confirm": [
          "Measure 11 (+12 VDC) to 6 (0 V): 12 VDC +/-10% (10.8-13.2 VDC)."
        ],
        "fix": [
          "Keep the load within 100 mA at 12 V; on 24 VAC/12-24 VDC models reduce the load with the supply voltage per the derating curve, or power the sensors separately."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (External power supply) and p.53 (Precautions for Correct Use)"
      }
    ],
    "sources": [
      "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf",
      "https://assets.omron.eu/downloads/latest/discontinuation_notice/en/2021061_h7cx_discontinuation_notice_en.pdf"
    ]
  },
  {
    "id": "omron-h7cx-a11-socket",
    "title": "Omron H7CX-A11@-N preset counter, 11-pin socket models (inputs, display, errors)",
    "match": {
      "categories": [
        "other"
      ],
      "family": "H7CX",
      "partNumber": "^H7CX-A11"
    },
    "normal": [
      {
        "terminals": "1 (+12 VDC) to 3 (0 V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "12 VDC +/-10% (10.8-13.2 VDC), 100 mA max.",
        "pins": [
          [
            "1",
            "3"
          ]
        ]
      },
      {
        "terminals": "2 to 10 (power)",
        "state": "powered, 100-240 VAC models",
        "meter": "VAC",
        "expected": "100-240 VAC 50/60 Hz, 85-110% of rated",
        "pins": [
          [
            "2",
            "10"
          ]
        ]
      },
      {
        "terminals": "2 (-) to 10 (+) (power)",
        "state": "powered, 24 VAC / 12-24 VDC models",
        "meter": "VDC",
        "expected": "12-24 VDC 90-110% of rated, or 24 VAC 85-110%",
        "pins": [
          [
            "2",
            "10"
          ]
        ]
      },
      {
        "terminals": "6 (CP1) to 3 (0 V)",
        "state": "NPN input mode, sensor OFF / open",
        "meter": "VDC",
        "expected": "approx. 14 V (output from the input terminals in NPN mode)",
        "pins": [
          [
            "6",
            "3"
          ]
        ]
      },
      {
        "terminals": "6 (CP1) to 3 (0 V)",
        "state": "NPN input mode, sensor ON",
        "meter": "VDC",
        "expected": "3 V max. residual",
        "pins": [
          [
            "6",
            "3"
          ]
        ]
      },
      {
        "terminals": "6 (CP1) to 3 (0 V)",
        "state": "PNP input mode, input ON / OFF",
        "meter": "VDC",
        "expected": "high 4.5-30 VDC / low 0-2 VDC",
        "pins": [
          [
            "6",
            "3"
          ]
        ]
      },
      {
        "terminals": "5 (CP2) to 3 (0 V)",
        "state": "same levels as CP1",
        "meter": "VDC",
        "expected": "NPN: ON 3 V max.; PNP: high 4.5-30 VDC, low 0-2 VDC",
        "pins": [
          [
            "5",
            "3"
          ]
        ]
      },
      {
        "terminals": "7 (reset) to 3 (0 V)",
        "state": "reset input ON",
        "meter": "VDC",
        "expected": "NPN: 3 V max.; PNP: 4.5-30 VDC",
        "pins": [
          [
            "7",
            "3"
          ]
        ]
      },
      {
        "terminals": "4 (total reset) to 3 (0 V)",
        "state": "input ON",
        "meter": "VDC",
        "expected": "NPN: 3 V max.; PNP: 4.5-30 VDC",
        "pins": [
          [
            "4",
            "3"
          ]
        ]
      }
    ],
    "indicators": [
      {
        "name": "Main display (present value)",
        "state": "red / green / orange characters",
        "meaning": "Present count value; on screw-terminal models the colour can be set to change with the output state (H7CX-A11@ red only)."
      },
      {
        "name": "Sub-display (set value)",
        "state": "green characters",
        "meaning": "Set value (SV1/SV2 on 2-stage models)."
      },
      {
        "name": "Control output indicator (orange)",
        "state": "OUT (1-stage) / OUT 1, 2 (2-stage) lit",
        "meaning": "Control output ON."
      },
      {
        "name": "Reset indicator (orange)",
        "state": "lit",
        "meaning": "Reset input (reset 1) or Reset Key is ON; counting is not performed during reset."
      },
      {
        "name": "Key protect indicator (orange)",
        "state": "lit",
        "meaning": "Key-protect switch is ON (keys limited per KP-1 to KP-7)."
      },
      {
        "name": "Total count / batch indicator",
        "state": "lit",
        "meaning": "The total count value / batch count value is displayed."
      },
      {
        "name": "Display",
        "state": "blank",
        "meaning": "The display is lit only when the power is ON."
      }
    ],
    "faults": [
      {
        "code": "-----",
        "title": "Present value underflow",
        "symptom": "Main display flashes ----- (4-digit: ----).",
        "causes": [
          "Present value or total count value fell below -99999 (-999 on 4-digit models)"
        ],
        "confirm": [
          "Read the main display: flashing dashes (1-second cycle); output status unchanged."
        ],
        "fix": [
          "Either press the Reset Key or turn ON the reset input."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function)"
      },
      {
        "code": "FFFFF",
        "title": "Present value overflow",
        "symptom": "Main display flashes FFFFF (4-digit: FFFF); counting stops.",
        "causes": [
          "Present value exceeded 999999 (9999 on 4-digit models) in output modes K-2, D, L, H or in dual counter / tachometer operation"
        ],
        "confirm": [
          "Read the main display: flashing F characters."
        ],
        "fix": [
          "Either press the Reset Key or turn ON the reset input."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function) and p.25 (dual counter note)"
      },
      {
        "symptomKind": "display-code",
        "code": "E1",
        "title": "CPU error",
        "symptom": "Main display shows E1, sub-display not lit, output OFF.",
        "causes": [
          "Internal CPU error (e.g. noise)"
        ],
        "confirm": [
          "Read the display: E1 with the sub-display dark."
        ],
        "fix": [
          "Either press the Reset Key or reset the power supply; separate the counter from noise sources."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function) and p.52 (Precautions)"
      },
      {
        "symptomKind": "display-code",
        "code": "E2",
        "title": "Memory error",
        "symptom": "Main display shows E2, output OFF.",
        "causes": [
          "Sub-display not lit: memory error (RAM)",
          "Sub-display shows SUM: EEPROM memory error, including expired EEPROM life (100,000 writes)",
          "Supply voltage decreased gradually at power OFF"
        ],
        "confirm": [
          "Read the sub-display: not lit = RAM error; SUM = EEPROM error."
        ],
        "fix": [
          "RAM error: turn ON the power again. EEPROM error: press the Reset Key (settings return to factory setting) and re-enter the settings.",
          "Switch the supply with a switch, relay or contact so it turns OFF instantaneously."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function) and p.52-53 (Precautions)"
      },
      {
        "symptomKind": "display-code",
        "code": "E3",
        "title": "Output counter overflow",
        "symptom": "E3 alternates with the normal display.",
        "causes": [
          "The output ON count exceeded the alarm value set for an output (life management of counter / load)"
        ],
        "confirm": [
          "Read the display: E3 alternating with the present value."
        ],
        "fix": [
          "Press the Reset Key (the total ON count is not cleared by the Reset Key)."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.36 (Self-diagnostic Function, notes 7, 8)"
      },
      {
        "symptomKind": "no-input",
        "title": "Does not count (NPN input mode)",
        "symptom": "Encoder or sensor pulses arrive but the present value does not change.",
        "causes": [
          "Input mode set to PNP while an NPN / open-collector sensor is wired",
          "Sensor not pulling the input to 0 V",
          "Reset input held ON",
          "Sensor waiting time after power ON (up to 290 ms)"
        ],
        "confirm": [
          "Measure 6 (CP1) to 3 (0 V) with the sensor OFF: approx. 14 V is output from the input terminals in NPN mode.",
          "With the sensor ON, 6 (CP1) to 3 (0 V) must be 3 V max. (ON impedance 1 kOhm max.).",
          "Check the reset indicator: lit means the reset input (7) is ON and counting is blocked."
        ],
        "fix": [
          "Set NPN/PNP input mode (imod, or DIP pin 8 OFF = NPN) to match the sensor; for 2-wire sensors select NPN.",
          "Use a sensor that contains a diode (approx. 14 V is output from the input terminals in NPN mode)."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Input method), p.7 (I/O functions), p.15 (DIP switch), p.18 (NPN/PNP Input Mode) and p.52 (Precautions)"
      },
      {
        "symptomKind": "no-input",
        "title": "Does not count (PNP input mode)",
        "symptom": "PNP sensor switches but the count does not change.",
        "causes": [
          "Input mode set to NPN while a PNP (voltage output) sensor is wired",
          "Input voltage below the high level"
        ],
        "confirm": [
          "Measure 6 (CP1) to 3 (0 V) with the sensor ON: high level 4.5-30 VDC; OFF: 0-2 VDC."
        ],
        "fix": [
          "Set the NPN/PNP input mode to PNP (DIP pin 8 ON or imod = pnp); keep the input voltage 30 VDC max."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Input method), p.9 (Voltage Inputs) and p.15 (DIP switch)"
      },
      {
        "symptomKind": "no-input",
        "title": "Counts lost at line speed",
        "symptom": "Count is short compared with the actual length; correct when jogging slowly.",
        "causes": [
          "Counting speed left at 30 Hz (factory setting, min. pulse width 16.7 ms) with encoder input",
          "Pulse width below the minimum signal width"
        ],
        "confirm": [
          "Read the counting speed setting (cnts): 30 Hz or 5 kHz / 10 kHz; compare with the encoder pulse rate (P/R x rpm / 60)."
        ],
        "fix": [
          "Set the counting speed to the high setting (DIP pin 2 ON or cnts); use 30 Hz only when contacts are used for input signals."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Maximum counting speed), p.15 (DIP switch) and p.18 (Counting Speed)"
      },
      {
        "title": "Wrong length / wrong direction",
        "symptom": "Displayed length is scaled wrong or counts down while feeding forward.",
        "causes": [
          "Prescale value set incorrectly",
          "Input mode not UP/DOWN C (quadrature) for an A/B encoder, or phases swapped on CP1/CP2"
        ],
        "confirm": [
          "Read the prescale value (pscl) and input mode (cntm).",
          "Example from the datasheet: 25 pulses for 0.5 m displayed as @@.@@ m needs decimal point 2 places and prescale 0.02."
        ],
        "fix": [
          "Correct the prescale value (0.001-99.999 on 6-digit, 0.001-9.999 on 4-digit models) and the input mode."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.18 (Input Mode, Prescale Value) and p.21 (Input Modes and Present Value)"
      },
      {
        "symptomKind": "output-no-motion",
        "title": "Output does not turn ON at the set value",
        "symptom": "Count reaches the set value but the cutter output does not switch.",
        "causes": [
          "Set value larger than (maximum countable value - prescale value)",
          "Key protection / wrong output mode",
          "Contact output beyond its electrical life (contacts fused or not closing)"
        ],
        "confirm": [
          "Compare the set value with the maximum countable value minus the prescale value.",
          "Check the OUT indicator: lit with no voltage at the load means the contact or load wiring is open."
        ],
        "fix": [
          "Set the set value below {maximum countable value - prescale value}; use the output relay within its rated load (3 A at 250 VAC / 30 VDC resistive) and life (100,000 operations at 3 A, 250 VAC)."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Control output), p.6 (Life expectancy), p.18 (Prescale Value) and p.52 (Precautions)"
      },
      {
        "title": "Does not start / unstable at power ON",
        "symptom": "Display stays blank or outputs are unstable after switching on.",
        "causes": [
          "Supply outside the rated range (inverter output used as supply, DC ripple above 20%)",
          "Supply not reaching rated voltage within 0.1 s",
          "Supply too small for the approx. 10 A inrush"
        ],
        "confirm": [
          "Measure the supply at the power terminals: within 85-110% of rated (12-24 VDC: 90-110%)."
        ],
        "fix": [
          "Do not use the output from an inverter as the power supply; switch the supply with a switch, relay or contact so the rated voltage is reached within 0.1 s; use a supply with sufficient capacity."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (Ratings, note 2) and p.52-53 (Precautions)"
      },
      {
        "title": "Sensor supply overloaded",
        "symptom": "Sensors powered from the counter (1 (+12 VDC)) drop out or the counter restarts.",
        "causes": [
          "Total sensor current above 100 mA (less on 12-24 VDC supply, see derating curve)"
        ],
        "confirm": [
          "Measure 1 (+12 VDC) to 3 (0 V): 12 VDC +/-10% (10.8-13.2 VDC)."
        ],
        "fix": [
          "Keep the load within 100 mA at 12 V; on 24 VAC/12-24 VDC models reduce the load with the supply voltage per the derating curve, or power the sensors separately."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5 (External power supply) and p.53 (Precautions for Correct Use)"
      }
    ],
    "sources": [
      "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf",
      "https://assets.omron.eu/downloads/latest/discontinuation_notice/en/2021061_h7cx_discontinuation_notice_en.pdf"
    ]
  },
  {
    "id": "omron-h7cx-a-screw-contact-out",
    "title": "Omron H7CX-A@-N screw-terminal models: contact output OUT (OUT2) terminals 3-4-5",
    "match": {
      "categories": [
        "other"
      ],
      "family": "H7CX",
      "partNumber": "^H7CX-A(?!11)",
      "ratings": {
        "outputType": "relay"
      }
    },
    "normal": [
      {
        "terminals": "3 to 5",
        "state": "output OFF (count below set value)",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "3",
            "5"
          ]
        ],
        "note": "As drawn in the datasheet terminal arrangement (contact shown with the output OFF): moving contact on 3, resting on 5."
      },
      {
        "terminals": "3 to 4",
        "state": "output ON (set value reached; OUT indicator lit)",
        "meter": "continuity",
        "expected": "closed; rated 3 A at 250 VAC / 30 VDC resistive",
        "pins": [
          [
            "3",
            "4"
          ]
        ],
        "note": "As drawn in the datasheet terminal arrangement (contact shown with the output OFF): moving contact on 3, resting on 5."
      }
    ],
    "pairs": [
      {
        "a": "3",
        "b": "5",
        "when": "output OFF",
        "note": "As drawn in the datasheet terminal arrangement (contact shown with the output OFF): moving contact on 3, resting on 5. On 2-stage models this is OUT2."
      },
      {
        "a": "3",
        "b": "4",
        "when": "output ON",
        "note": "As drawn in the datasheet terminal arrangement (contact shown with the output OFF): moving contact on 3, resting on 5. On 2-stage models this is OUT2."
      }
    ],
    "indicators": [
      {
        "name": "Control output indicator (orange)",
        "state": "OUT / OUT 2 lit",
        "meaning": "Contact 3-4 closed."
      }
    ],
    "faults": [
      {
        "symptomKind": "output-no-motion",
        "title": "Contact does not close although OUT is lit",
        "symptom": "OUT indicator lit, cutter / load not energized.",
        "causes": [
          "Contact worn or fused beyond its electrical life",
          "Load above rating",
          "Load wiring open"
        ],
        "confirm": [
          "With OUT lit, measure 3 to 4 for continuity (power off the load circuit first) or measure load voltage at 4."
        ],
        "fix": [
          "Use the output relay within its rated load and electrical life (100,000 operations at 3 A 250 VAC resistive); replace the counter if the contact is worn."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.5-6 (Control output, Life expectancy) and p.52 (Precautions)"
      }
    ],
    "sources": [
      "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf"
    ]
  },
  {
    "id": "omron-h7cx-a-2stage-contact-out1",
    "title": "Omron H7CX-AW-N / -A4W-N / -AWD1-N: contact output OUT1 terminals 12-13",
    "match": {
      "categories": [
        "other"
      ],
      "partNumber": "^H7CX-A4?W(D1)?-N$"
    },
    "normal": [
      {
        "terminals": "12 to 13",
        "state": "OUT1 ON",
        "meter": "continuity",
        "expected": "closed (SPST contact, 3 A at 250 VAC / 30 VDC resistive)",
        "pins": [
          [
            "12",
            "13"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "12",
        "b": "13",
        "when": "OUT1 ON",
        "note": "SPST (NO) contact as drawn in the datasheet terminal arrangement."
      }
    ],
    "indicators": [
      {
        "name": "Control output indicator (orange)",
        "state": "OUT 1 lit",
        "meaning": "Contact 12-13 closed."
      }
    ],
    "faults": [],
    "sources": [
      "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf"
    ]
  },
  {
    "id": "omron-h7cx-a11-socket-contact-out",
    "title": "Omron H7CX-A11@-N socket models: contact output pins 11-8-9",
    "match": {
      "categories": [
        "other"
      ],
      "partNumber": "^H7CX-A11",
      "ratings": {
        "outputType": "relay"
      }
    },
    "normal": [
      {
        "terminals": "11 to 8",
        "state": "output OFF",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "11",
            "8"
          ]
        ],
        "note": "As drawn in the datasheet socket diagram (moving contact on 11, resting on 8)."
      },
      {
        "terminals": "11 to 9",
        "state": "output ON",
        "meter": "continuity",
        "expected": "closed; rated 3 A at 250 VAC / 30 VDC resistive",
        "pins": [
          [
            "11",
            "9"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "11",
        "b": "8",
        "when": "output OFF",
        "note": "As drawn in the datasheet socket diagram (contact shown with the output OFF)."
      },
      {
        "a": "11",
        "b": "9",
        "when": "output ON"
      }
    ],
    "indicators": [
      {
        "name": "Control output indicator (orange)",
        "state": "OUT lit",
        "meaning": "Contact 11-9 closed."
      }
    ],
    "faults": [],
    "sources": [
      "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf"
    ]
  },
  {
    "id": "omron-h7cx-a-12-24vdc-common",
    "title": "Omron H7CX-A@D-N (12-24 VDC-only) models: terminals 1 and 6 connected internally",
    "match": {
      "categories": [
        "other"
      ],
      "partNumber": "^H7CX-A[0-9A-Z]*D-N$"
    },
    "normal": [
      {
        "terminals": "1 (-) to 6 (0 V)",
        "state": "always",
        "meter": "continuity",
        "expected": "connected internally",
        "pins": [
          [
            "1",
            "6"
          ]
        ],
        "note": "No isolation between power supply and input terminals on these models: a non-isolating DC supply can create unwanted current paths."
      }
    ],
    "pairs": [
      {
        "a": "1",
        "b": "6",
        "when": "always",
        "note": "Terminals 1 and 6 are connected internally (datasheet p.8)."
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Internal parts burnt by wiring through the common",
        "symptom": "Counter dead after wiring a sensor supply or a second DC supply.",
        "causes": [
          "Power supply terminals are not isolated from the signal input terminals; a non-isolating DC supply created an unwanted current path"
        ],
        "confirm": [
          "Check whether the sensor / input common and the counter supply (-) come from different, non-isolated supplies."
        ],
        "fix": [
          "Always check the wiring sufficiently before use; reference the inputs to the same supply (-) as terminal 1/6."
        ],
        "source": "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf p.53 (Precautions for Correct Use) and p.8 (Terminal Arrangement)"
      }
    ],
    "sources": [
      "https://assets.omron.eu/downloads/latest/datasheet/en/m079_h7cx-_-n_multifunction_counter_tachometer_datasheet_en.pdf"
    ]
  },
  {
    "id": "rexroth-4we6-6x-dc-solenoid",
    "title": "Bosch Rexroth 4WE 6 / 3WE 6 ...6X/EG24 directional spool valve, 24 VDC wet-pin solenoid (K4 connector)",
    "match": {
      "categories": [
        "solenoidValve"
      ],
      "partNumber": "^[34]WE ?6",
      "ratings": {
        "coilVoltage": "24VDC"
      }
    },
    "normal": [
      {
        "terminals": "Connector pin 1 to pin 2 (solenoid coil)",
        "state": "solenoid energized",
        "meter": "VDC",
        "expected": "24 VDC +/-10% (21.6-26.4 VDC); rated current 1.25 A; nominal power 30 W",
        "pins": [
          [
            "1",
            "2"
          ]
        ],
        "note": "Coil is polarity-independent; third pin is PE (protective ground)."
      },
      {
        "terminals": "Connector pin 1 to pin 2 (solenoid coil)",
        "state": "solenoid de-energized",
        "meter": "VDC",
        "expected": "0 V (spool held in the centre / initial position by the return springs)",
        "pins": [
          [
            "1",
            "2"
          ]
        ]
      },
      {
        "terminals": "Coil pins 1-2, connector removed, power off",
        "state": "healthy coil",
        "meter": "continuity",
        "expected": "continuous (coil resistance not published by Rexroth; an open circuit = defective coil)",
        "pins": [
          [
            "1",
            "2"
          ]
        ]
      },
      {
        "terminals": "Solenoid coil surface",
        "state": "energized, 100% duty cycle",
        "meter": "visual",
        "expected": "hot: max. surface temperature 120 deg C (standard version) is normal"
      }
    ],
    "indicators": [
      {
        "name": "Indicator light in the mating connector (connector types with indicator light, e.g. Z5L1)",
        "state": "on",
        "meaning": "Voltage is applied to the connector."
      }
    ],
    "faults": [
      {
        "symptomKind": "output-no-motion",
        "title": "Valve does not switch: electrical",
        "symptom": "Output to the cutter valve is ON but the spool does not move (cutter does not stroke).",
        "causes": [
          "Electrical connection interrupted / connector not completely mounted",
          "Cable break",
          "Electrical defect in the solenoid coil",
          "Connector defective or damaged"
        ],
        "confirm": [
          "Measure pins 1 to 2 at the connector with the output ON: 21.6-26.4 VDC expected; 0 V = wiring or output problem.",
          "With 24 V present: remove the connector (power off) and check coil continuity pins 1-2; open circuit = coil defect."
        ],
        "fix": [
          "Check whether the plug-in connectors are correctly and completely mounted; replace the connection cable; replace the solenoid coil or connector."
        ],
        "source": "https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d p.44 (Table 5: Electrical faults); https://www.boschrexroth.com/media/2ef9f5e4-8434-4aac-9ffc-ca7c8617844a p.24 (pin assignment) and p.12 (electric data)"
      },
      {
        "symptomKind": "output-no-motion",
        "title": "Valve does not switch: spool jammed",
        "symptom": "Coil energized (24 V present, coil hot) but the valve does not shift, or does not return.",
        "causes": [
          "Spool jammed due to contamination",
          "Hydraulic fluid cleanliness worse than ISO 4406 class 20/18/15"
        ],
        "confirm": [
          "Operate the manual override (N9: with the special tool): if the spool does not move or the override is stiff, the spool is jammed."
        ],
        "fix": [
          "Try to release the spool with the manual override; if the manual override is stiff, replace the valve; check and improve the hydraulic fluid quality (flushing, additional filters)."
        ],
        "source": "https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d p.43 (Fault table) and p.30 (Operating the manual override); https://www.boschrexroth.com/media/2ef9f5e4-8434-4aac-9ffc-ca7c8617844a p.11 (cleanliness class)"
      },
      {
        "title": "Manual override cannot shift the valve",
        "symptom": "Pushing the manual override does not move the spool.",
        "causes": [
          "Tank pressure above 50 bar (actuating force too high)",
          "Opposite solenoid energized"
        ],
        "confirm": [
          "Check the tank-line pressure at port T."
        ],
        "fix": [
          "Operate the manual override only with tank pressure up to 50 bar; if the manual override is blocked, exclude operation of the opposite solenoid."
        ],
        "source": "https://www.boschrexroth.com/media/2ef9f5e4-8434-4aac-9ffc-ca7c8617844a p.2 (ordering code note 1); https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d p.30 (8.2)"
      },
      {
        "symptomKind": "output-no-motion",
        "title": "Both solenoids energized",
        "symptom": "Valve chatters, does not shift, coil overheats (3-position valves).",
        "causes": [
          "PLC logic or wiring energizes solenoid a and b at the same time"
        ],
        "confirm": [
          "Measure both coils (a and b connectors pins 1-2): only one may show 24 VDC at a time."
        ],
        "fix": [
          "Any simultaneous actuation of 2 solenoids of one valve must be ruled out: correct the interlock."
        ],
        "source": "https://www.boschrexroth.com/media/2ef9f5e4-8434-4aac-9ffc-ca7c8617844a p.13 (Notes)"
      },
      {
        "symptomKind": "trips",
        "title": "Suppressor diode / control damaged by switching",
        "symptom": "Valve output card or suppressor in the connector fails; erratic switching.",
        "causes": [
          "Switching frequency above 4.2 /s (1 /s for connectors with interference protection circuit)",
          "Switch-off voltage peaks without an interference protection circuit"
        ],
        "confirm": [
          "Check the cycle rate of the cutter valve against 4.2 switchings per second (1 per second with suppressor connectors)."
        ],
        "fix": [
          "Limit the switching frequency; provide an interference protection circuit on the system side or a connector with integrated interference protection circuit."
        ],
        "source": "https://www.boschrexroth.com/media/2ef9f5e4-8434-4aac-9ffc-ca7c8617844a p.5 (Notice) and p.12 (Maximum switching frequency, note 4)"
      },
      {
        "symptomKind": "trips",
        "title": "Solenoid fuse / supply protection",
        "symptom": "Valve circuit fuse blows or the output trips.",
        "causes": [
          "Short circuit in a defective valve coil",
          "Fuse not sized for an inductive load"
        ],
        "confirm": [
          "Disconnect the valve connector: if the fault clears, the coil or connector is shorted."
        ],
        "fix": [
          "Secure every solenoid individually with a fuse of tripping characteristic K (inductive loads) sized for the maximum current; exchange valves with short circuit."
        ],
        "source": "https://www.boschrexroth.com/media/2ef9f5e4-8434-4aac-9ffc-ca7c8617844a p.13 (Electrical protection); https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d p.43 (Notice)"
      },
      {
        "title": "External leakage",
        "symptom": "Oil leaking at the valve mounting surface.",
        "causes": [
          "Seals at the connection surface damaged",
          "Other leakage"
        ],
        "confirm": [
          "Inspect the seal rings at ports A, B, P, T on the mounting surface."
        ],
        "fix": [
          "Remove the valve and replace the seals; for other leakage replace the valve."
        ],
        "source": "https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d p.43 (Fault table)"
      }
    ],
    "sources": [
      "https://www.boschrexroth.com/media/2ef9f5e4-8434-4aac-9ffc-ca7c8617844a",
      "https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d"
    ]
  },
  {
    "id": "rexroth-hed8-piston-pressure-switch",
    "title": "Bosch Rexroth HED 8 hydro-electric piston pressure switch (micro switch NC/NO, K14 connector)",
    "match": {
      "categories": [
        "sensor"
      ],
      "family": "HED 8",
      "ratings": {
        "type": "pressure switch"
      }
    },
    "normal": [
      {
        "terminals": "Micro switch contact in use (COM to NO or COM to NC), circuit de-energized",
        "state": "contact closed",
        "meter": "continuity",
        "expected": "closed (potential-free micro switch with NC/NO function, rated 1 mA-2.0 A at 12-250 V AC/DC)",
        "note": "Contact-to-pin assignment of the K14 connector (4-pole, 3 + PE, EN 175301-803) is in data sheet RE 50061, which was not obtained: identify COM / NC / NO on the device before measuring."
      },
      {
        "terminals": "Micro switch contact in use, circuit de-energized",
        "state": "contact open",
        "meter": "continuity",
        "expected": "open"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "symptomKind": "no-input",
        "title": "No signal from the pressure switch",
        "symptom": "Pressure reaches the set value (gauge) but the PLC input never changes.",
        "causes": [
          "Electrical connection interrupted",
          "Cable break",
          "Connector defective or damaged",
          "Pressure switch defective"
        ],
        "confirm": [
          "Read the system pressure on a gauge; with pressure above the set point measure the contact (continuity with the circuit de-energized)."
        ],
        "fix": [
          "Check whether the plug-in connectors are correctly and completely mounted; replace the connection cable or connector; replace the pressure switch."
        ],
        "source": "https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d p.44 (Table 6)"
      },
      {
        "title": "Switches at the wrong pressure",
        "symptom": "Cutter pressure-OK signal comes too early or too late.",
        "causes": [
          "Switching pressure set by the scale only",
          "Setting changed"
        ],
        "confirm": [
          "Compare the switching point with a pressure gauge."
        ],
        "fix": [
          "Set the switching pressure using a pressure gauge (the scale is used as orientation only)."
        ],
        "source": "https://www.boschrexroth.com/ics/Projects/GenericSelector/?ProductArea=HED8&c=us&language=en (Adjustment type notes)"
      },
      {
        "title": "External leakage",
        "symptom": "Oil leaking at the pressure switch mounting.",
        "causes": [
          "Seals at the connection surface damaged",
          "Other leakage"
        ],
        "confirm": [
          "Inspect the connection surface / port seal."
        ],
        "fix": [
          "Remove the component and replace the seals; for other leakage replace the pressure switch."
        ],
        "source": "https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d p.43 (Fault table for hydraulic valves and pressure switches)"
      }
    ],
    "sources": [
      "https://www.boschrexroth.com/media/472f764a-5bf5-4b93-87a6-9360c0070d4d",
      "https://www.boschrexroth.com/ics/Projects/GenericSelector/?ProductArea=HED8&c=us&language=en",
      "https://www.boschrexroth.com/en/at/p/pressure-switch-r901102747/"
    ]
  }
];
