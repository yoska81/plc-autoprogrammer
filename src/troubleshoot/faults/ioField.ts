import type { DeviceFaultProfile } from "../deviceFaults";

/**
 * PLC I/O and field device fault profiles: CLICK / CLICK PLUS CPUs (all error codes), DC / AC inputs, sinking /
 * sourcing / relay outputs, analog and thermocouple modules; PNP / NPN sensors, ultrasonic sensors, Koyo TRD encoders,
 * 22 mm pushbuttons and E-stops, Mindman solenoid valves. From the maker manuals / datasheets (each fault cites its page).
 * Values derived from two cited specs (e.g. a line driver into a 24 V input) say so in their note.
 */
export const IO_FIELD_FAULTS: DeviceFaultProfile[] = [
  {
    "id": "click-c0-dc-input-sink-source",
    "title": "CLICK C0 DC sink/source inputs (CPU built-in X, C0-08ND3, C0-16ND3, C0-16CDD1)",
    "match": {
      "categories": [
        "plc",
        "plcModule"
      ],
      "family": "CLICK",
      "ratings": {
        "inputType": "sinking/sourcing"
      }
    },
    "normal": [
      {
        "terminals": "X1 to C1 (X1-X4 share C1, X5-X8 share C2 on 8-input CPUs; software address X001...)",
        "state": "input ON (24 VDC CPU inputs, C0-16ND3, C0-16CDD1)",
        "meter": "VDC",
        "expected": "> 19 VDC magnitude (input voltage range 21.6-26.4 VDC); typ. 4 mA (X3-X8) / 5 mA (X1-X2 of C0-0x CPUs) / 6.5 mA (high-speed X1-X4 of Ethernet C0-1x CPUs) at 24 VDC",
        "pins": [
          [
            "X001",
            "C1"
          ]
        ],
        "note": "Polarity depends on sink/source wiring; the dual input diodes accept either direction."
      },
      {
        "terminals": "X1 to C1",
        "state": "input OFF (24 VDC inputs)",
        "meter": "VDC",
        "expected": "< 7 VDC on standard points; < 4 VDC on X1-X2 of C0-0x CPUs; < 2 VDC on the high-speed inputs of Ethernet C0-1x CPUs",
        "pins": [
          [
            "X001",
            "C1"
          ]
        ],
        "note": "Between the OFF and ON levels the input state is not specified."
      },
      {
        "terminals": "1 to C1 (C0-08ND3 terminals 1-4 share C1, 5-8 share C2; address X101... in slot 1)",
        "state": "input ON (C0-08ND3, 12-24 VDC module)",
        "meter": "VDC",
        "expected": "> 8.0 VDC (input voltage range 10.8-26.4 VDC); typ. 5 mA at 24 VDC",
        "pins": [
          [
            "1",
            "C1"
          ]
        ]
      },
      {
        "terminals": "1 to C1",
        "state": "input OFF (C0-08ND3)",
        "meter": "VDC",
        "expected": "< 3.0 VDC",
        "pins": [
          [
            "1",
            "C1"
          ]
        ]
      },
      {
        "terminals": "C1 to supply 0 V",
        "state": "sinking input wiring for PNP (sourcing) sensors",
        "meter": "continuity",
        "expected": "C1 (and C2) connected to the supply negative (0 V)",
        "note": "CLICK 3-wire PNP sensor example: C1 to supply -; sensor output to X1."
      },
      {
        "terminals": "C1 to supply +24 V",
        "state": "sourcing input wiring for NPN (sinking) sensors / open-collector encoders",
        "meter": "continuity",
        "expected": "C1 (and C2) connected to the supply positive",
        "note": "CLICK 3-wire NPN sensor example: C1 to supply +; sensor output to X1."
      }
    ],
    "indicators": [
      {
        "name": "X input LED (green, logic side)",
        "state": "on",
        "meaning": "Input true (current flowing in the input circuit)"
      },
      {
        "name": "X input LED (green, logic side)",
        "state": "off",
        "meaning": "Input false"
      },
      {
        "name": "PWR LED on input module (green)",
        "state": "off",
        "meaning": "Module not powered from the PLC: check module connections"
      }
    ],
    "faults": [
      {
        "title": "Input signal on but input LED off",
        "symptom": "Field device is detecting / contact is closed, but the X LED on the PLC or input module stays off.",
        "causes": [
          "External input supply missing or out of range",
          "Terminal block not attached correctly",
          "Common (C1/C2...) not wired, or wired to the wrong supply pole for the sensor type",
          "Failed input circuit"
        ],
        "confirm": [
          "Measure the input terminal to its common (e.g. X1 to C1) with the device ON: a 24 VDC input needs > 19 VDC to turn on; ~0 V means the supply, the device output or the wiring is open.",
          "Check that the removable terminal block is fully seated."
        ],
        "fix": [
          "Check the external power input voltage on the terminal block.",
          "Check whether the terminal block is attached correctly.",
          "If the input voltage is correct but the LED indicator is still off, replace the input module (or PLC unit for built-in inputs)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Input Module Troubleshooting, p.6-6)"
      },
      {
        "title": "Input LED on but the program does not react",
        "symptom": "X LED is on but the ladder logic acts as if the input were off.",
        "causes": [
          "PLC not in RUN mode",
          "I/O configuration recognised by the PLC differs from the project (module in a different slot gives different X addresses)",
          "Failed input circuit between LED and logic"
        ],
        "confirm": [
          "Check the RUN LED is on.",
          "In CLICK software: Setup > System Configuration shows the modules the PLC recognises.",
          "In CLICK software Data View, monitor the X bit of the input that is on (inputs cannot be forced from Data View)."
        ],
        "fix": [
          "Put the PLC in RUN mode.",
          "Correct the I/O configuration / addressing.",
          "If the X bit is off while the LED is on, replace the input module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Input Module Troubleshooting and How to Check the I/O Configuration / I/O Status, p.6-6-6-8)"
      },
      {
        "title": "I/O module PWR LED off",
        "symptom": "PWR LED on the PLC unit is on, but the PWR LED on an expansion I/O module is off.",
        "causes": [
          "Bad connection between modules (expansion port)",
          "Failed module"
        ],
        "confirm": [
          "Look at the PWR LED of each module with the PLC PWR LED on."
        ],
        "fix": [
          "Power down (no hot swap) and check the connections between the modules.",
          "If the module PWR LED remains off, replace that module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, I/O Module Troubleshooting, p.6-6)"
      },
      {
        "title": "Sensor type does not match the common wiring (sink/source)",
        "symptom": "Sensor LED shows detection but the X LED stays off; or all inputs on one common never turn on.",
        "causes": [
          "PNP (sourcing) sensor on a group whose common (C1/C2) is wired to +24 V",
          "NPN (sinking) sensor on a group whose common is wired to 0 V",
          "PNP and NPN devices mixed on one common: inputs grouped by a common must be either all sinking or all sourcing"
        ],
        "confirm": [
          "Measure C1 to supply 0 V: about 0 V means C1 is on the negative (correct for PNP); about 24 V means C1 is on + (correct for NPN).",
          "Measure X1 to C1 with the sensor detecting: about 0 V while the sensor output is switching shows the current has no path (wrong polarity of the common)."
        ],
        "fix": [
          "PNP sensor: connect the common (C1/C2) to supply - so the input sinks the current.",
          "NPN sensor: connect the common to supply + so the input sources the current.",
          "Put PNP and NPN devices on different commons."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Sinking/Sourcing Concepts p.3-29, DC Input Wiring Methods p.3-31, 3-Wire Sensors wiring examples p.3-47)"
      },
      {
        "title": "Input voltage too low to turn the input on",
        "symptom": "Input flickers or stays off although the device is switching; X1-C1 reads between the OFF and ON levels.",
        "causes": [
          "Field supply below the 21.6 VDC input voltage range minimum (24 VDC inputs)",
          "Voltage drop in the sensor output and wiring",
          "24 VDC input used with a 12 VDC sensor supply (only the C0-08ND3 is rated 12-24 VDC)"
        ],
        "confirm": [
          "Measure X1 to C1 with the device ON: 24 VDC inputs need > 19 VDC; C0-08ND3 needs > 8.0 VDC.",
          "Measure the field supply at the sensor (+ to -)."
        ],
        "fix": [
          "Bring the input supply into 21.6-26.4 VDC (24 VDC inputs) or 10.8-26.4 VDC (C0-08ND3).",
          "Use a C0-08ND3 module for 12 VDC devices."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Basic PLC Unit Specifications, C0-00DD1-D input specs p.2-36; C0-08ND3 p.2-117; C0-16ND3 p.2-119)"
      },
      {
        "title": "Input on with the device off (leakage)",
        "symptom": "X LED glows or the input reads ON while the driving device is off.",
        "causes": [
          "OFF-state leakage current of the driving device (2-wire sensor or solid-state output) above the input's maximum OFF current (0.5 mA for 24 VDC points; 0.1 mA for X1-X2 of C0-0x CPUs)"
        ],
        "confirm": [
          "Measure X to its common with the device off: a reading above the OFF level (< 7 VDC standard points) means the leakage keeps the input on."
        ],
        "fix": [
          "Install a resistor in parallel with the input; usually 10 k to 20 k ohm; check the wattage."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Output Module Troubleshooting (leakage current), p.6-7; input Maximum OFF Current, ch.2 p.2-36)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, ch.2 Specifications: PLC LED Status Indicators p.2-29/2-30, C0-00DD1-D p.2-36/2-37, C0-08ND3 p.2-117, C0-16ND3 p.2-119, C0-16CDD1 p.2-132)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, ch.3 Installation and Wiring p.3-29 to 3-31, p.3-47)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, ch.6 Troubleshooting p.6-6 to 6-8)"
    ]
  },
  {
    "id": "click-c0-ac-input",
    "title": "CLICK C0 AC inputs (C0-0xAR-D / C0-1xARE-D built-in X)",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "CLICK",
      "ratings": {
        "inputType": "AC 100"
      }
    },
    "normal": [
      {
        "terminals": "X1 to C1 (X1-X4 share C1, X5-X8 share C2)",
        "state": "input ON",
        "meter": "VAC",
        "expected": "> 60 VAC (operating 100-120 VAC, input voltage range 80-144 VAC); typ. 10 mA at 100 VAC 60 Hz",
        "pins": [
          [
            "X001",
            "C1"
          ]
        ]
      },
      {
        "terminals": "X1 to C1",
        "state": "input OFF",
        "meter": "VAC",
        "expected": "< 20 VAC; maximum OFF current 2 mA",
        "pins": [
          [
            "X001",
            "C1"
          ]
        ]
      }
    ],
    "indicators": [
      {
        "name": "X input LED (green, logic side)",
        "state": "on",
        "meaning": "Input true"
      },
      {
        "name": "X input LED (green, logic side)",
        "state": "off",
        "meaning": "Input false"
      }
    ],
    "faults": [
      {
        "title": "Input signal on but input LED off",
        "symptom": "Field device is detecting / contact is closed, but the X LED on the PLC or input module stays off.",
        "causes": [
          "External input supply missing or out of range",
          "Terminal block not attached correctly",
          "Common (C1/C2...) not wired, or wired to the wrong supply pole for the sensor type",
          "Failed input circuit"
        ],
        "confirm": [
          "Measure the input terminal to its common (e.g. X1 to C1) with the device ON: a 24 VDC input needs > 19 VDC to turn on; ~0 V means the supply, the device output or the wiring is open.",
          "Check that the removable terminal block is fully seated."
        ],
        "fix": [
          "Check the external power input voltage on the terminal block.",
          "Check whether the terminal block is attached correctly.",
          "If the input voltage is correct but the LED indicator is still off, replace the input module (or PLC unit for built-in inputs)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Input Module Troubleshooting, p.6-6)"
      },
      {
        "title": "Input LED on but the program does not react",
        "symptom": "X LED is on but the ladder logic acts as if the input were off.",
        "causes": [
          "PLC not in RUN mode",
          "I/O configuration recognised by the PLC differs from the project (module in a different slot gives different X addresses)",
          "Failed input circuit between LED and logic"
        ],
        "confirm": [
          "Check the RUN LED is on.",
          "In CLICK software: Setup > System Configuration shows the modules the PLC recognises.",
          "In CLICK software Data View, monitor the X bit of the input that is on (inputs cannot be forced from Data View)."
        ],
        "fix": [
          "Put the PLC in RUN mode.",
          "Correct the I/O configuration / addressing.",
          "If the X bit is off while the LED is on, replace the input module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Input Module Troubleshooting and How to Check the I/O Configuration / I/O Status, p.6-6-6-8)"
      },
      {
        "title": "Input on with the device off (leakage)",
        "symptom": "Input reads ON while the AC device is off.",
        "causes": [
          "Leakage of the driving device above the 2 mA maximum OFF current"
        ],
        "confirm": [
          "Measure X to C1 with the device off: > 20 VAC means leakage holds the input on."
        ],
        "fix": [
          "Install a resistor in parallel with the input (usually 10 k to 20 k ohm; size the wattage for the applied voltage)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Output Module Troubleshooting (leakage), p.6-7; AC input specs C0-00AR-D ch.2 p.2-42)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-00AR-D AC input specifications p.2-42)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, p.6-6 to 6-7)"
    ]
  },
  {
    "id": "click-dc-output-sinking",
    "title": "CLICK sinking DC outputs (C0-xxDD1 CPUs, C0-08TD1, C0-16TD1, C0-16CDD1, C2-14D1, C2-08D1)",
    "match": {
      "categories": [
        "plc",
        "plcModule"
      ],
      "family": "CLICK",
      "ratings": {
        "outputType": "sinking"
      }
    },
    "normal": [
      {
        "terminals": "+V to output common (CPU: C3/C4; C0-08TD1: +V to C1/C2; C0-16TD1: V1/V2 to C1/C2)",
        "state": "powered",
        "meter": "VDC",
        "expected": "CPU and C2-14D1: 20-28 VDC external DC power (max 60 mA); C0-08TD1 / C0-16TD1: 21.6-26.4 VDC",
        "pins": [
          [
            "+V",
            "C3"
          ],
          [
            "+V",
            "C4"
          ]
        ],
        "note": "The sinking output circuit needs this supply in addition to the load supply."
      },
      {
        "terminals": "Y1 to C3 (output to its common)",
        "state": "output ON (Y LED on)",
        "meter": "VDC",
        "expected": "close to 0 V: ON voltage drop 0.5 VDC @ 0.1 A (CPU, C0-16TD1, C2-14D1), 1.5 VDC @ 0.3 A (C0-08TD1)",
        "pins": [
          [
            "Y001",
            "C3"
          ]
        ]
      },
      {
        "terminals": "Y1 to C3",
        "state": "output OFF, load wired from Y1 to load supply +",
        "meter": "VDC",
        "expected": "about the load supply voltage (operating range 5-27 VDC; 3.3-27 VDC on C0-08TD1); leakage max 0.1 mA @ 30 VDC",
        "pins": [
          [
            "Y001",
            "C3"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "Y001",
        "b": "C3",
        "when": "output ON",
        "note": "Equivalent output circuit: Y1-Y4 switch to C3 COM, Y5-Y6 to C4 COM, \"C3 & C4 are not internally connected\" (C0-00DD1-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-37; same layout C0-01DD1-D, C0-10DD1E-D, C0-11DD1E-D, C2-14D1 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf p.2-33). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sinking); 4-point CPUs (C0-02/C0-12) and C0-08TD1/C0-16TD1 modules use other commons and are not covered."
      },
      {
        "a": "Y002",
        "b": "C3",
        "when": "output ON",
        "note": "Equivalent output circuit: Y1-Y4 switch to C3 COM, Y5-Y6 to C4 COM, \"C3 & C4 are not internally connected\" (C0-00DD1-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-37; same layout C0-01DD1-D, C0-10DD1E-D, C0-11DD1E-D, C2-14D1 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf p.2-33). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sinking); 4-point CPUs (C0-02/C0-12) and C0-08TD1/C0-16TD1 modules use other commons and are not covered."
      },
      {
        "a": "Y003",
        "b": "C3",
        "when": "output ON",
        "note": "Equivalent output circuit: Y1-Y4 switch to C3 COM, Y5-Y6 to C4 COM, \"C3 & C4 are not internally connected\" (C0-00DD1-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-37; same layout C0-01DD1-D, C0-10DD1E-D, C0-11DD1E-D, C2-14D1 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf p.2-33). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sinking); 4-point CPUs (C0-02/C0-12) and C0-08TD1/C0-16TD1 modules use other commons and are not covered."
      },
      {
        "a": "Y004",
        "b": "C3",
        "when": "output ON",
        "note": "Equivalent output circuit: Y1-Y4 switch to C3 COM, Y5-Y6 to C4 COM, \"C3 & C4 are not internally connected\" (C0-00DD1-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-37; same layout C0-01DD1-D, C0-10DD1E-D, C0-11DD1E-D, C2-14D1 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf p.2-33). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sinking); 4-point CPUs (C0-02/C0-12) and C0-08TD1/C0-16TD1 modules use other commons and are not covered."
      },
      {
        "a": "Y005",
        "b": "C4",
        "when": "output ON",
        "note": "Equivalent output circuit: Y1-Y4 switch to C3 COM, Y5-Y6 to C4 COM, \"C3 & C4 are not internally connected\" (C0-00DD1-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-37; same layout C0-01DD1-D, C0-10DD1E-D, C0-11DD1E-D, C2-14D1 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf p.2-33). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sinking); 4-point CPUs (C0-02/C0-12) and C0-08TD1/C0-16TD1 modules use other commons and are not covered."
      },
      {
        "a": "Y006",
        "b": "C4",
        "when": "output ON",
        "note": "Equivalent output circuit: Y1-Y4 switch to C3 COM, Y5-Y6 to C4 COM, \"C3 & C4 are not internally connected\" (C0-00DD1-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-37; same layout C0-01DD1-D, C0-10DD1E-D, C0-11DD1E-D, C2-14D1 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf p.2-33). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sinking); 4-point CPUs (C0-02/C0-12) and C0-08TD1/C0-16TD1 modules use other commons and are not covered."
      }
    ],
    "indicators": [
      {
        "name": "Y output LED (red, logic side)",
        "state": "on",
        "meaning": "Output true"
      },
      {
        "name": "Y output LED (red, logic side)",
        "state": "off",
        "meaning": "Output false"
      },
      {
        "name": "PWR LED on output module (green)",
        "state": "off",
        "meaning": "Module not powered: check module connections"
      }
    ],
    "faults": [
      {
        "title": "Output LED on but load not energized",
        "symptom": "Y LED is on but the field device does not operate.",
        "causes": [
          "External output supply (+V / V1 / load supply) missing",
          "Terminal block not attached correctly",
          "Open load or wiring",
          "Failed output circuit"
        ],
        "confirm": [
          "Check the external power input voltage on the terminal block.",
          "Measure the output terminal to its common (e.g. Y1 to C3) with the Y LED on: a working output reads close to 0 V.",
          "If the output terminal reads ~0 V as above but the load is off, the fault is in the load or its wiring."
        ],
        "fix": [
          "Restore the external supply / terminal block.",
          "If the LED indicator is ON but the output voltage is not correct, replace the output module (or PLC unit for built-in outputs)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "Output LED off though the output should be on",
        "symptom": "Y LED stays off although the program should be turning the output on.",
        "causes": [
          "PLC not in RUN mode (in STOP all outputs are off)",
          "I/O configuration / addressing differs from the project",
          "Y bit not actually turned on by the logic",
          "Failed output circuit"
        ],
        "confirm": [
          "Check the RUN LED.",
          "Setup > System Configuration in CLICK software.",
          "Monitor the Y bit in Data View; use the override feature to turn the Y bit ON."
        ],
        "fix": [
          "Put the PLC in RUN mode.",
          "Correct the configuration / logic.",
          "If the Y bit is ON but the output is OFF, replace the output module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "Field device turns on while the output LED is off (leakage current)",
        "symptom": "Output LED is off but the connected device (often a PLC input or small relay) sees an ON signal.",
        "causes": [
          "Leakage current of the output point is large enough to turn on the connected input device"
        ],
        "confirm": [
          "With the Y LED off, the connected input still reads ON; compare the device's OFF current with the output's maximum leakage current in the specs."
        ],
        "fix": [
          "Install a resistor in parallel with the input or output of the circuit; usually a 10 k to 20 k ohm resistor works. Check the resistor wattage."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "Output overloaded",
        "symptom": "Load does not operate properly or the output fails when several outputs are on.",
        "causes": [
          "Load current above 0.1 A/point (CPU, C0-16TD1) or 0.3 A/point (C0-08TD1)",
          "Common current above the rating (CPU: C3 0.4 A, C4 0.2 A; C0-16TD1 0.8 A/common; C0-08TD1 1.2 A/common)"
        ],
        "confirm": [
          "Measure the load current with a clamp/series meter and compare with the ratings."
        ],
        "fix": [
          "Drive larger loads through an interposing relay or use a higher-current output module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-00DD1-D output specs p.2-37; C0-08TD1 p.2-123; C0-16TD1 p.2-125)"
      },
      {
        "title": "Sinking output cannot drive a sinking (NPN) input",
        "symptom": "A sinking PLC output wired to a device with a sinking input does not switch it.",
        "causes": [
          "Both sides are sinking; the circuit needs one sourcing and one sinking device"
        ],
        "confirm": [
          "Check the field device input type (sinking/NPN input)."
        ],
        "fix": [
          "Add a pull-up resistor from the output to the DC output supply (+). Do not drive loads > 25 mA this way; the logic is inverted (device ON when the PLC output is OFF)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, PLC DC Sinking Output to Sinking Load Device, p.3-32)"
      },
      {
        "title": "Output damaged by inductive load transients",
        "symptom": "Output fails after switching relay coils or solenoids.",
        "causes": [
          "Inductive kickback from the coil; the outputs' integrated suppressors are not capable of handling all transients"
        ],
        "confirm": [
          "Check whether the coil has a flyback diode or suppressor fitted."
        ],
        "fix": [
          "Fit a flyback diode across DC coils (e.g. AD-ASMD-250, DN-D10DR-A), or a TVS/MOV across the output (ZL-TSD8-24 for 24 VDC)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Transient suppression for inductive loads, p.3-35 to 3-37)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-00DD1-D p.2-36/2-37, C0-08TD1 p.2-123, C0-16TD1 p.2-125, C0-16CDD1 p.2-132, LED tables p.2-29/2-30)",
      "https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, C2-14D1 p.2-32/2-33)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, p.3-31 to 3-37)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, p.6-7)"
    ]
  },
  {
    "id": "click-dc-output-sourcing",
    "title": "CLICK sourcing DC outputs (C0-xxDD2 CPUs, C0-16TD2, C2-14D2, C2-08D2, C2-14TTL)",
    "match": {
      "categories": [
        "plc",
        "plcModule"
      ],
      "family": "CLICK",
      "ratings": {
        "outputType": "sourcing"
      }
    },
    "normal": [
      {
        "terminals": "V1 to CO (CPU: V1 feeds Y1-Y4, V2 feeds Y5-Y6, CO is the 0 V common; C0-16TD2: V1/C1, V2/C2)",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC nominal; output voltage range 19.2-30 VDC (CPU, C2-14D2); 9.6-30 VDC on C0-16TD2 (12-24 VDC); 4.5-5.5 VDC on C2-14TTL",
        "pins": [
          [
            "V1",
            "CO"
          ],
          [
            "V2",
            "CO"
          ]
        ]
      },
      {
        "terminals": "Y1 to V1",
        "state": "output ON (Y LED on)",
        "meter": "VDC",
        "expected": "close to 0 V (ON voltage drop: Y1 1.0 VDC, Y2-Y6 0.5 VDC @ 0.1 A on CPU; 0.6 VDC @ 0.1 A C0-16TD2)",
        "pins": [
          [
            "Y001",
            "V1"
          ]
        ]
      },
      {
        "terminals": "Y1 to 0 V (CO)",
        "state": "output ON (Y LED on)",
        "meter": "VDC",
        "expected": "about the V1 supply voltage minus the ON voltage drop",
        "pins": [
          [
            "Y001",
            "CO"
          ]
        ]
      },
      {
        "terminals": "Y1 to 0 V (CO)",
        "state": "output OFF",
        "meter": "VDC",
        "expected": "about 0 V (leakage max 0.1 mA @ 30 VDC)",
        "pins": [
          [
            "Y001",
            "CO"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "V1",
        "b": "Y001",
        "when": "output ON",
        "note": "Equivalent output circuit: V1 feeds Y1-Y4, V2 feeds Y5-Y6, CO is the common (C0-00DD2-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-39; same layout C0-01DD2-D, C0-10DD2E-D, C0-11DD2E-D, C2-14D2 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sourcing); C0-02/C0-12 CPUs and C0-08TD2/C0-16TD2 modules not covered."
      },
      {
        "a": "V1",
        "b": "Y002",
        "when": "output ON",
        "note": "Equivalent output circuit: V1 feeds Y1-Y4, V2 feeds Y5-Y6, CO is the common (C0-00DD2-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-39; same layout C0-01DD2-D, C0-10DD2E-D, C0-11DD2E-D, C2-14D2 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sourcing); C0-02/C0-12 CPUs and C0-08TD2/C0-16TD2 modules not covered."
      },
      {
        "a": "V1",
        "b": "Y003",
        "when": "output ON",
        "note": "Equivalent output circuit: V1 feeds Y1-Y4, V2 feeds Y5-Y6, CO is the common (C0-00DD2-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-39; same layout C0-01DD2-D, C0-10DD2E-D, C0-11DD2E-D, C2-14D2 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sourcing); C0-02/C0-12 CPUs and C0-08TD2/C0-16TD2 modules not covered."
      },
      {
        "a": "V1",
        "b": "Y004",
        "when": "output ON",
        "note": "Equivalent output circuit: V1 feeds Y1-Y4, V2 feeds Y5-Y6, CO is the common (C0-00DD2-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-39; same layout C0-01DD2-D, C0-10DD2E-D, C0-11DD2E-D, C2-14D2 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sourcing); C0-02/C0-12 CPUs and C0-08TD2/C0-16TD2 modules not covered."
      },
      {
        "a": "V2",
        "b": "Y005",
        "when": "output ON",
        "note": "Equivalent output circuit: V1 feeds Y1-Y4, V2 feeds Y5-Y6, CO is the common (C0-00DD2-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-39; same layout C0-01DD2-D, C0-10DD2E-D, C0-11DD2E-D, C2-14D2 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sourcing); C0-02/C0-12 CPUs and C0-08TD2/C0-16TD2 modules not covered."
      },
      {
        "a": "V2",
        "b": "Y006",
        "when": "output ON",
        "note": "Equivalent output circuit: V1 feeds Y1-Y4, V2 feeds Y5-Y6, CO is the common (C0-00DD2-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-39; same layout C0-01DD2-D, C0-10DD2E-D, C0-11DD2E-D, C2-14D2 https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). Applies to C0-00/01/10/11 6-point CPUs and the C2-14 option modules (sourcing); C0-02/C0-12 CPUs and C0-08TD2/C0-16TD2 modules not covered."
      }
    ],
    "indicators": [
      {
        "name": "Y output LED (red, logic side)",
        "state": "on",
        "meaning": "Output true"
      },
      {
        "name": "Y output LED (red, logic side)",
        "state": "off",
        "meaning": "Output false"
      }
    ],
    "faults": [
      {
        "title": "Output LED on but load not energized",
        "symptom": "Y LED is on but the field device does not operate.",
        "causes": [
          "External output supply (+V / V1 / load supply) missing",
          "Terminal block not attached correctly",
          "Open load or wiring",
          "Failed output circuit"
        ],
        "confirm": [
          "Check the external power input voltage on the terminal block.",
          "Measure the output terminal to the 24 VDC supply input of the outputs (e.g. Y1 to V1) with the Y LED on: a working output reads close to 0 V.",
          "If the output terminal reads ~0 V as above but the load is off, the fault is in the load or its wiring."
        ],
        "fix": [
          "Restore the external supply / terminal block.",
          "If the LED indicator is ON but the output voltage is not correct, replace the output module (or PLC unit for built-in outputs)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "Output LED off though the output should be on",
        "symptom": "Y LED stays off although the program should be turning the output on.",
        "causes": [
          "PLC not in RUN mode (in STOP all outputs are off)",
          "I/O configuration / addressing differs from the project",
          "Y bit not actually turned on by the logic",
          "Failed output circuit"
        ],
        "confirm": [
          "Check the RUN LED.",
          "Setup > System Configuration in CLICK software.",
          "Monitor the Y bit in Data View; use the override feature to turn the Y bit ON."
        ],
        "fix": [
          "Put the PLC in RUN mode.",
          "Correct the configuration / logic.",
          "If the Y bit is ON but the output is OFF, replace the output module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "Field device turns on while the output LED is off (leakage current)",
        "symptom": "Output LED is off but the connected device (often a PLC input or small relay) sees an ON signal.",
        "causes": [
          "Leakage current of the output point is large enough to turn on the connected input device"
        ],
        "confirm": [
          "With the Y LED off, the connected input still reads ON; compare the device's OFF current with the output's maximum leakage current in the specs."
        ],
        "fix": [
          "Install a resistor in parallel with the input or output of the circuit; usually a 10 k to 20 k ohm resistor works. Check the resistor wattage."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "Output overloaded",
        "symptom": "Load does not operate properly or the output fails.",
        "causes": [
          "Load current above 0.1 A/point or 0.6 A/common (CPU, C2-14D2); 0.8 A/common (C0-16TD2)"
        ],
        "confirm": [
          "Measure the load current and compare with the ratings."
        ],
        "fix": [
          "Use an interposing relay or higher-current output for larger loads."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-00DD2-D output specs p.2-39; C0-16TD2 p.2-126)"
      },
      {
        "title": "Output damaged by inductive load transients",
        "symptom": "Output fails after switching coils.",
        "causes": [
          "Inductive kickback beyond the output rating"
        ],
        "confirm": [
          "Check for a flyback diode / suppressor at the coil."
        ],
        "fix": [
          "Fit a flyback diode across DC coils or a TVS/MOV (ZL-TSD8-24) across the output."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, p.3-35 to 3-37)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-00DD2-D p.2-38/2-39, C0-16TD2 p.2-126)",
      "https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, C2-14D2 p.2-34/2-35, C2-14TTL p.2-36/2-37)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, p.6-7)"
    ]
  },
  {
    "id": "click-relay-output",
    "title": "CLICK relay outputs (C0-xxDR/AR CPUs, C0-08TR, C0-04TRS, C2-14DR, C2-08DR)",
    "match": {
      "categories": [
        "plc",
        "plcModule"
      ],
      "family": "CLICK",
      "ratings": {
        "outputType": "relay"
      }
    },
    "normal": [
      {
        "terminals": "Y1 to C3 (output to its common; C0-08TR: 1-4 to C1, 5-8 to C2; C0-04TRS: NO1/NC1 to C1...)",
        "state": "output ON (Y LED on), load supply present",
        "meter": "VAC",
        "expected": "close to 0 V (closed contact); same check in VDC for DC loads",
        "pins": [
          [
            "Y001",
            "C3"
          ]
        ]
      },
      {
        "terminals": "Y1 to C3",
        "state": "output OFF, load supply present",
        "meter": "VAC",
        "expected": "about the load supply voltage (operating range 6-240 VAC 47-63 Hz / 6-27 VDC)",
        "pins": [
          [
            "Y001",
            "C3"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "Y001",
        "b": "C3",
        "when": "output ON",
        "note": "Relay, form A (SPST); equivalent output circuit Y1-Y4 on C3 COM, Y5-Y6 on C4 COM (C0-00DR-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-41; same layout C0-00AR-D, C0-01DR/AR-D, C0-10DRE/ARE-D, C0-11DRE/ARE-D, C2-14DR https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). 4-relay CPUs (C0-02DR-D, C0-12xRE) use C2 as the relay common and C0-04TRS/C0-08TR modules number their terminals differently; those are not covered."
      },
      {
        "a": "Y002",
        "b": "C3",
        "when": "output ON",
        "note": "Relay, form A (SPST); equivalent output circuit Y1-Y4 on C3 COM, Y5-Y6 on C4 COM (C0-00DR-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-41; same layout C0-00AR-D, C0-01DR/AR-D, C0-10DRE/ARE-D, C0-11DRE/ARE-D, C2-14DR https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). 4-relay CPUs (C0-02DR-D, C0-12xRE) use C2 as the relay common and C0-04TRS/C0-08TR modules number their terminals differently; those are not covered."
      },
      {
        "a": "Y003",
        "b": "C3",
        "when": "output ON",
        "note": "Relay, form A (SPST); equivalent output circuit Y1-Y4 on C3 COM, Y5-Y6 on C4 COM (C0-00DR-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-41; same layout C0-00AR-D, C0-01DR/AR-D, C0-10DRE/ARE-D, C0-11DRE/ARE-D, C2-14DR https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). 4-relay CPUs (C0-02DR-D, C0-12xRE) use C2 as the relay common and C0-04TRS/C0-08TR modules number their terminals differently; those are not covered."
      },
      {
        "a": "Y004",
        "b": "C3",
        "when": "output ON",
        "note": "Relay, form A (SPST); equivalent output circuit Y1-Y4 on C3 COM, Y5-Y6 on C4 COM (C0-00DR-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-41; same layout C0-00AR-D, C0-01DR/AR-D, C0-10DRE/ARE-D, C0-11DRE/ARE-D, C2-14DR https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). 4-relay CPUs (C0-02DR-D, C0-12xRE) use C2 as the relay common and C0-04TRS/C0-08TR modules number their terminals differently; those are not covered."
      },
      {
        "a": "Y005",
        "b": "C4",
        "when": "output ON",
        "note": "Relay, form A (SPST); equivalent output circuit Y1-Y4 on C3 COM, Y5-Y6 on C4 COM (C0-00DR-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-41; same layout C0-00AR-D, C0-01DR/AR-D, C0-10DRE/ARE-D, C0-11DRE/ARE-D, C2-14DR https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). 4-relay CPUs (C0-02DR-D, C0-12xRE) use C2 as the relay common and C0-04TRS/C0-08TR modules number their terminals differently; those are not covered."
      },
      {
        "a": "Y006",
        "b": "C4",
        "when": "output ON",
        "note": "Relay, form A (SPST); equivalent output circuit Y1-Y4 on C3 COM, Y5-Y6 on C4 COM (C0-00DR-D https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf p.2-41; same layout C0-00AR-D, C0-01DR/AR-D, C0-10DRE/ARE-D, C0-11DRE/ARE-D, C2-14DR https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf). 4-relay CPUs (C0-02DR-D, C0-12xRE) use C2 as the relay common and C0-04TRS/C0-08TR modules number their terminals differently; those are not covered."
      }
    ],
    "indicators": [
      {
        "name": "Y output LED (red, logic side)",
        "state": "on",
        "meaning": "Output true (relay coil energized)"
      },
      {
        "name": "Y output LED (red, logic side)",
        "state": "off",
        "meaning": "Output false"
      }
    ],
    "faults": [
      {
        "title": "Output LED on but load not energized",
        "symptom": "Y LED is on but the field device does not operate.",
        "causes": [
          "External output supply (+V / V1 / load supply) missing",
          "Terminal block not attached correctly",
          "Open load or wiring",
          "Failed output circuit"
        ],
        "confirm": [
          "Check the external power input voltage on the terminal block.",
          "Measure the output terminal to its common (e.g. Y1 to C3) with the Y LED on and the load supply present: a closed contact reads close to 0 V.",
          "If the output terminal reads ~0 V as above but the load is off, the fault is in the load or its wiring."
        ],
        "fix": [
          "Restore the external supply / terminal block.",
          "If the LED indicator is ON but the output voltage is not correct, replace the output module (or PLC unit for built-in outputs)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "Output LED off though the output should be on",
        "symptom": "Y LED stays off although the program should be turning the output on.",
        "causes": [
          "PLC not in RUN mode (in STOP all outputs are off)",
          "I/O configuration / addressing differs from the project",
          "Y bit not actually turned on by the logic",
          "Failed output circuit"
        ],
        "confirm": [
          "Check the RUN LED.",
          "Setup > System Configuration in CLICK software.",
          "Monitor the Y bit in Data View; use the override feature to turn the Y bit ON."
        ],
        "fix": [
          "Put the PLC in RUN mode.",
          "Correct the configuration / logic.",
          "If the Y bit is ON but the output is OFF, replace the output module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "Field device turns on while the output LED is off (leakage current)",
        "symptom": "Output LED is off but the connected device (often a PLC input or small relay) sees an ON signal.",
        "causes": [
          "Leakage current of the output point is large enough to turn on the connected input device"
        ],
        "confirm": [
          "With the Y LED off, the connected input still reads ON; compare the device's OFF current with the output's maximum leakage current in the specs."
        ],
        "fix": [
          "Install a resistor in parallel with the input or output of the circuit; usually a 10 k to 20 k ohm resistor works. Check the resistor wattage."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Output Module Troubleshooting, p.6-7)"
      },
      {
        "title": "No protection on relay output / overcurrent",
        "symptom": "Relay output fails after a load short or overload.",
        "causes": [
          "Load above 1 A/point (CPU, C0-08TR) or 7 A/point (C0-04TRS); common above 4 A (C0-08TR) / CPU C3 4 A, C4 2 A",
          "Protection is not built into the relay modules"
        ],
        "confirm": [
          "Measure load current; with power off check the load for a short."
        ],
        "fix": [
          "Install protection circuit elements such as an external fuse in each common/load circuit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-00DR-D output specs p.2-41; C0-08TR p.2-130; C0-04TRS p.2-128)"
      },
      {
        "title": "Unreliable switching of very small loads",
        "symptom": "A light load (e.g. an electronic input) switches erratically.",
        "causes": [
          "Load current below the relay minimum load current (5 mA @ 5 VDC; 100 mA @ 5 VDC for C0-04TRS)"
        ],
        "confirm": [
          "Measure the load current with the output on."
        ],
        "fix": [
          "Keep the load at or above the minimum load current, or use a transistor output for low-level signals."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-00DR-D p.2-41; C0-04TRS p.2-128)"
      },
      {
        "title": "Relay contacts worn",
        "symptom": "Output works intermittently or contact stays closed after many operations.",
        "causes": [
          "Relay past its typical life, e.g. 50,000 operations at 30 VDC 1 A solenoid load, 200,000 at 250 VAC 1 A solenoid"
        ],
        "confirm": [
          "With the Y LED off and load supply present, Y to its common reads close to 0 V (contact still closed) or with the LED on reads the full supply (contact not closing)."
        ],
        "fix": [
          "Replace the output module (or PLC unit for built-in outputs); add suppression on inductive loads."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Typical Relay Life table, C0-00DR-D p.2-41)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-00DR-D p.2-41, C0-04TRS p.2-128, C0-08TR p.2-130)",
      "https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, C2-14DR p.2-38/2-39)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, p.6-7)"
    ]
  },
  {
    "id": "click-c0-analog-io-module",
    "title": "CLICK C0-04AD-1/-2 analog input and C0-04DA-1/-2 analog output modules",
    "match": {
      "categories": [
        "plcModule"
      ],
      "family": "CLICK",
      "partNumber": "^C0-04(AD|DA)-[12]$|^C0-4AD2DA-[12]$"
    },
    "normal": [
      {
        "terminals": "24V to 0V (module supply terminals)",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC external supply; draws 65 mA (C0-04AD-x), 145 mA (C0-04DA-1)",
        "pins": [
          [
            "24V",
            "0V"
          ]
        ]
      },
      {
        "terminals": "CH1 to 0V (C0-04AD-1)",
        "state": "transmitter connected",
        "meter": "mA",
        "expected": "0-20 mA (sink), 13-bit, 2.44 uA/count; input impedance 124 ohm",
        "pins": [
          [
            "CH1",
            "0V"
          ]
        ],
        "note": "By Ohm's law the CH-0V voltage is about 0.5 V at 4 mA and 2.5 V at 20 mA."
      },
      {
        "terminals": "CH1 to 0V (C0-04AD-2)",
        "state": "transmitter connected",
        "meter": "VDC",
        "expected": "0-10 V, 1.22 mV/count; input impedance > 150 k ohm",
        "pins": [
          [
            "CH1",
            "0V"
          ]
        ]
      },
      {
        "terminals": "CH1 to 0V (C0-04DA-1)",
        "state": "running",
        "meter": "mA",
        "expected": "4-20 mA (source) into 0-600 ohm at 24 VDC; < 4 mA in fault mode; 4 mA at power up / down",
        "pins": [
          [
            "CH1",
            "0V"
          ]
        ]
      },
      {
        "terminals": "CH1 to 0V (C0-04DA-2)",
        "state": "running",
        "meter": "VDC",
        "expected": "0-10 V into > 1000 ohm; 0 V in fault mode",
        "pins": [
          [
            "CH1",
            "0V"
          ]
        ]
      }
    ],
    "indicators": [
      {
        "name": "PWR LED (green)",
        "state": "off",
        "meaning": "Module not powered from the PLC: check module connections"
      }
    ],
    "faults": [
      {
        "title": "Analog module missing external 24 VDC",
        "symptom": "Analog values freeze or read zero; ERR LED blinks (warning).",
        "causes": [
          "24 VDC not applied to the module 24V/0V terminals"
        ],
        "confirm": [
          "Read SD1: code 310 (slot 1) ... 380 (slot 8); flag X102 ... X802 is ON.",
          "Measure 24V to 0V on the module: should be 24 VDC."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Error Codes 310-380, p.6-13 to 6-15)"
      },
      {
        "title": "Input channel open circuit",
        "symptom": "Channel reads zero.",
        "causes": [
          "Broken transmitter wire or failed transmitter"
        ],
        "confirm": [
          "Open circuit gives a zero reading within 100 ms (C0-04AD-1/-2).",
          "Measure the loop current in series with the channel (C0-04AD-1): 0 mA = open loop."
        ],
        "fix": [
          "Check the wiring for the channel.",
          "Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04AD-1 / C0-04AD-2 Open Circuit Detection Time, p.2-138/2-139; Error Codes 311-384, ch.6 p.6-13)"
      },
      {
        "title": "Analog module not functioning",
        "symptom": "ERR LED on, PLC in STOP.",
        "causes": [
          "Analog module failure"
        ],
        "confirm": [
          "Read SD1: code 301 (slot 1) ... 308 (slot 8); flag X101 ... X801."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Error Codes 301-308, p.6-13)"
      },
      {
        "title": "Unused voltage input floating",
        "symptom": "Unused C0-04AD-2 channel shows random values.",
        "causes": [
          "Unused channel left open"
        ],
        "confirm": [
          "Check the unused channel terminals."
        ],
        "fix": [
          "Connect the unused channel to the 0V terminal."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04AD-2 wiring diagram note, p.2-139)"
      },
      {
        "title": "Current output load too high",
        "symptom": "C0-04DA-1 output cannot reach 20 mA.",
        "causes": [
          "Loop impedance above 600 ohm at 24 VDC"
        ],
        "confirm": [
          "Measure the loop resistance with power off."
        ],
        "fix": [
          "Keep the load within 0-600 ohm."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04DA-1 Load Impedance, p.2-144)"
      },
      {
        "title": "Input overloaded",
        "symptom": "Channel reads wrong after wiring a voltage source to a current input.",
        "causes": [
          "C0-04AD-1 maximum continuous overload is +/-44 mA"
        ],
        "confirm": [
          "Check the source type against the module (current vs voltage)."
        ],
        "fix": [
          "Use the recommended external fuse (AutomationDirect S500-32-R, 0.032 A) on C0-04AD-1 inputs."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04AD-1 specs, p.2-138)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04AD-1 p.2-138, C0-04AD-2 p.2-139, C0-04DA-1 p.2-144, C0-04DA-2 p.2-145)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Error Codes p.6-11 to 6-15)"
    ]
  },
  {
    "id": "click-c0-thermocouple-module",
    "title": "CLICK C0-04THM thermocouple / C0-04RTD input modules",
    "match": {
      "categories": [
        "plcModule"
      ],
      "family": "CLICK",
      "partNumber": "^C0-04(THM|RTD)$"
    },
    "normal": [
      {
        "terminals": "TC1+ to TC1- (C0-04THM)",
        "state": "thermocouple connected",
        "meter": "VDC",
        "expected": "thermocouple millivolts (input ranges 0-39.0625 mV, +/-39.0625 mV, +/-78.125 mV, 0-156.25 mV, +/-156.25 mV, 0-1.25 V); common mode range -1.3 to +3.8 V to COM",
        "pins": [
          [
            "TC1+",
            "TC1-"
          ]
        ],
        "note": "No external DC supply is required (bus power 25 mA)."
      }
    ],
    "indicators": [
      {
        "name": "RUN LED on the PLC unit",
        "state": "blinking up to 11 s after power-up",
        "meaning": "PLC is initializing the C0-04RTD / C0-04THM (5 s for 1 channel ... 11 s for 4 channels)"
      },
      {
        "name": "RUN LED on the PLC unit",
        "state": "still blinking after 11 s",
        "meaning": "Initialization problem: power cycle; if it remains, replace PLC unit and/or module"
      }
    ],
    "faults": [
      {
        "title": "Thermocouple open (burnout)",
        "symptom": "Channel reads zero scale; ERR LED blinks (warning).",
        "causes": [
          "Broken thermocouple or open wiring"
        ],
        "confirm": [
          "Burnout flag set and zero scale reading within 3 seconds.",
          "Read SD1: 311-314 (slot 1 CH1-CH4) ... 381-384 (slot 8); flags X103/X106/X109/X112 (slot 1).",
          "Measure the thermocouple loop resistance with the wires removed: open circuit confirms."
        ],
        "fix": [
          "Check the wiring for the channel.",
          "Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04THM Open Circuit Detection Time, p.2-143; ch.6 Error Codes 311-384 p.6-13 to 6-15)"
      },
      {
        "title": "RUN LED keeps blinking after power-up",
        "symptom": "PLC does not go to RUN; RUN LED blinks longer than 11 s.",
        "causes": [
          "Module initialization not completing"
        ],
        "confirm": [
          "Time the blinking after power-up (should end within 11 s)."
        ],
        "fix": [
          "Power cycle the CLICK PLC system. If the symptom remains, replace the PLC unit and/or the analog input module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, LED Indicators, RUN, p.6-4)"
      },
      {
        "title": "Unused channels not set",
        "symptom": "Slow update or burnout warnings on unused channels.",
        "causes": [
          "Unused channels left open / channel count not set"
        ],
        "confirm": [
          "Check the C0-04THM Setting window channel count."
        ],
        "fix": [
          "Select the number of channels actually used in the C0-04THM Setting window; connect unused TCn+ / TCn- to COM."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04THM wiring diagram notes, p.2-142)"
      },
      {
        "title": "Grounded thermocouples skew readings",
        "symptom": "Readings offset or unstable with grounded thermocouples.",
        "causes": [
          "Voltage between thermocouple tips outside -1.3 V to +3.8 V"
        ],
        "confirm": [
          "Measure DC voltage between the TC- terminals of two channels."
        ],
        "fix": [
          "Prevent a voltage potential between thermocouple tips (keep within the common-mode range)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04THM note, p.2-143)"
      },
      {
        "title": "Readings drift after power-up",
        "symptom": "Temperature reading drifts for a while after power-on.",
        "causes": [
          "Module warm-up"
        ],
        "confirm": [
          "Compare readings over the first 30 minutes."
        ],
        "fix": [
          "Allow 30 minutes warm-up for +/-1 C repeatability."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04THM Warm Up Time, p.2-143)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-04THM p.2-142/2-143)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, p.6-4, p.6-13 to 6-15)"
    ]
  },
  {
    "id": "click-c0-cpu-builtin-analog",
    "title": "CLICK C0-02 / C0-12 Analog CPU built-in analog I/O",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "CLICK",
      "partNumber": "^C0-(02|12)"
    },
    "normal": [
      {
        "terminals": "AD1V to ACOM (C0-02xx, C0-12xxE-D)",
        "state": "voltage transmitter",
        "meter": "VDC",
        "expected": "0-5 VDC (6 VDC max.), 12-bit",
        "pins": [
          [
            "AD1V",
            "ACOM"
          ]
        ]
      },
      {
        "terminals": "AD1I to ACOM (C0-02xx, C0-12xxE-D)",
        "state": "current transmitter",
        "meter": "mA",
        "expected": "4-20 mA (sink), 12-bit; input impedance 100 ohm (C0-02) / 125 ohm (C0-12)",
        "pins": [
          [
            "AD1I",
            "ACOM"
          ]
        ]
      },
      {
        "terminals": "DA1I to ACOM (C0-02xx, C0-12xxE-D)",
        "state": "current output",
        "meter": "mA",
        "expected": "4-20 mA (sink); needs loop supply 18-30 VDC; load max 600 ohm @ 18 V, 900 ohm @ 24 V, 1200 ohm @ 30 V",
        "pins": [
          [
            "DA1I",
            "ACOM"
          ]
        ]
      },
      {
        "terminals": "DA1V to ACOM (C0-02xx, C0-12xxE-D)",
        "state": "voltage output",
        "meter": "VDC",
        "expected": "0-5 VDC into >= 2 k ohm",
        "pins": [
          [
            "DA1V",
            "ACOM"
          ]
        ]
      },
      {
        "terminals": "analog inputs to ACOM (C0-12xxE-1-D)",
        "state": "current transmitter",
        "meter": "mA",
        "expected": "4 inputs, 0-20 mA (sink), 125 ohm; 2 outputs 4-20 mA (source), load 200-800 ohm, loop 21.6-26.4 VDC",
        "pins": [
          [
            "AD1I",
            "ACOM"
          ],
          [
            "AD2I",
            "ACOM"
          ],
          [
            "AD3I",
            "ACOM"
          ],
          [
            "AD4I",
            "ACOM"
          ]
        ]
      },
      {
        "terminals": "analog inputs to ACOM (C0-12xxE-2-D)",
        "state": "voltage transmitter",
        "meter": "VDC",
        "expected": "4 inputs 0-10 VDC (40 k ohm); 2 outputs 0-10 VDC",
        "pins": [
          [
            "AD1V",
            "ACOM"
          ],
          [
            "AD2V",
            "ACOM"
          ],
          [
            "AD3V",
            "ACOM"
          ],
          [
            "AD4V",
            "ACOM"
          ]
        ]
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Current output (sink) gives no signal",
        "symptom": "DA1I reads 0 mA.",
        "causes": [
          "No 18-30 VDC loop supply in the output loop (C0-02 / C0-12xxE-D outputs sink current)",
          "Loop resistance above the maximum for the supply"
        ],
        "confirm": [
          "Measure loop supply voltage and loop resistance (power off)."
        ],
        "fix": [
          "Provide an 18-30 VDC loop supply; keep load within 600/900/1200 ohm at 18/24/30 V."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-02DD1-D Analog Specifications - Current Output, p.2-54)"
      },
      {
        "title": "Voltage input over range",
        "symptom": "Voltage channel saturates.",
        "causes": [
          "Signal above 0-5 VDC (6 VDC max) on C0-02 / C0-12xxE-D"
        ],
        "confirm": [
          "Measure AD1V to ACOM."
        ],
        "fix": [
          "Use a 0-5 V transmitter or a C0-12xxE-2-D (0-10 V) / C0-04AD-2."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-02DD1-D Analog Specifications - Voltage Input, p.2-54)"
      },
      {
        "title": "Current vs voltage terminal mixed up",
        "symptom": "Analog reading wrong or zero.",
        "causes": [
          "Transmitter wired to ADxV when it is a current signal or vice versa"
        ],
        "confirm": [
          "Check which terminal (ADxV or ADxI) carries the signal and the channel setting."
        ],
        "fix": [
          "Wire voltage signals to ADxV and current to ADxI with ACOM as common."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Analog I/O Configuration, Ethernet Analog Terminals, p.3-39)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, C0-02DD1-D analog p.2-54; C0-12DD1E-D p.2-79; C0-12DD1E-1-D p.2-91; C0-12DD1E-2-D p.2-103)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, p.3-38/3-39)"
    ]
  },
  {
    "id": "click-c0-cpu",
    "title": "CLICK C0 PLC unit (CPU): power, LEDs, RUN/STOP switch, error codes",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "CLICK",
      "partNumber": "^C0-"
    },
    "normal": [
      {
        "terminals": "24V to 0V (power connector at the bottom of the PLC)",
        "state": "powered",
        "meter": "VDC",
        "expected": "20-28 VDC",
        "pins": [
          [
            "24V",
            "0V"
          ]
        ]
      }
    ],
    "indicators": [
      {
        "name": "PWR (green)",
        "state": "on",
        "meaning": "Power good"
      },
      {
        "name": "PWR (green)",
        "state": "blinking",
        "meaning": "Input power not sufficient: check 20-28 VDC"
      },
      {
        "name": "PWR (green)",
        "state": "off",
        "meaning": "No power"
      },
      {
        "name": "RUN (green)",
        "state": "on",
        "meaning": "RUN mode"
      },
      {
        "name": "RUN (green)",
        "state": "blinking",
        "meaning": "Initializing (C0-04RTD / C0-04THM, up to 11 s)"
      },
      {
        "name": "RUN (green)",
        "state": "off",
        "meaning": "STOP (program) mode"
      },
      {
        "name": "ERR (red)",
        "state": "on",
        "meaning": "Self-diagnostic error: PLC switches to STOP, all outputs off; read SD1"
      },
      {
        "name": "ERR (red)",
        "state": "blinking",
        "meaning": "Warning: PLC keeps running; read SD1"
      },
      {
        "name": "ERR (red)",
        "state": "off",
        "meaning": "No error"
      },
      {
        "name": "TX/RX (green)",
        "state": "on",
        "meaning": "Comm port data active"
      },
      {
        "name": "TX/RX (green)",
        "state": "off",
        "meaning": "No communication"
      },
      {
        "name": "LNK/ACT (green, Ethernet units)",
        "state": "on",
        "meaning": "Connected to the network"
      },
      {
        "name": "LNK/ACT (green, Ethernet units)",
        "state": "blinking",
        "meaning": "Communicating"
      },
      {
        "name": "LNK/ACT (green, Ethernet units)",
        "state": "off",
        "meaning": "Disconnected from the network"
      },
      {
        "name": "100MBIT (orange, Ethernet units)",
        "state": "on",
        "meaning": "Communicating at 100 Mbps"
      },
      {
        "name": "100MBIT (orange, Ethernet units)",
        "state": "off",
        "meaning": "10 Mbps or disconnected"
      }
    ],
    "faults": [
      {
        "title": "PLC will not go to RUN with switch in RUN",
        "symptom": "Toggle switch in RUN but RUN LED off.",
        "causes": [
          "PLC placed in STOP by a peripheral through a communication port",
          "Error present (ERR LED on)",
          "Insufficient power (PWR LED off)"
        ],
        "confirm": [
          "Check PWR and ERR LEDs.",
          "Connect CLICK software and read the error information."
        ],
        "fix": [
          "Move the toggle switch to STOP and back to RUN.",
          "If the RUN LED stays off, read the error code and act on it; check the power cable and input voltage if PWR is off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Toggle Switch, p.6-3)"
      },
      {
        "title": "PLC starts in RUN with switch in STOP",
        "symptom": "After power cycle the PLC runs although the toggle switch is in STOP.",
        "causes": [
          "PLC unit does not recognise the toggle switch position"
        ],
        "confirm": [
          "Cycle power with the switch in STOP and watch the RUN LED."
        ],
        "fix": [
          "Replace the PLC unit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Toggle Switch, p.6-3)"
      },
      {
        "title": "PWR LED blinking or off",
        "symptom": "PWR LED blinks or is dark.",
        "causes": [
          "Supply below 20 VDC or missing",
          "Power supply too small for the power budget",
          "Loose power wiring at the bottom connector"
        ],
        "confirm": [
          "Measure the voltage on the power terminal at the bottom of the PLC: should be 20-28 VDC.",
          "Remove the bottom connector and measure again: > 20 VDC with the connector removed means the supply cannot deliver enough current.",
          "Check Setup > System Configuration for the Power Budget (mA)."
        ],
        "fix": [
          "Fix the power wiring; replace the supply with a higher-current one if it sags under load; if > 28 VDC, lower the output or replace the supply."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, LED Indicators p.6-4 and Power Supply Troubleshooting p.6-5)"
      },
      {
        "code": "101",
        "title": "I/O Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 101.",
        "causes": [
          "More than 8 I/O modules; an I/O module was added during operation; or an I/O module has failed."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 101); status flag SC20 is ON."
        ],
        "fix": [
          "Remove excessive modules (max 8). Power off and check the module connections, then power on. If the problem remains, check System Configuration in CLICK software and replace any module not shown."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-11)"
      },
      {
        "code": "102",
        "title": "System Config Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 102.",
        "causes": [
          "The current system configuration does not match the configuration saved in the project file."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 102); status flag SC21 is ON."
        ],
        "fix": [
          "In CLICK software open System Configuration; make the hardware match the project, or uncheck the 'Start-up I/O Config Check' option to use the current configuration."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-11)"
      },
      {
        "code": "103",
        "title": "I/O Config Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 103.",
        "causes": [
          "An I/O module was removed during operation, or the PLC unit cannot access one or more I/O modules."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 103); status flag SC22 is ON."
        ],
        "fix": [
          "Power off, check the module connections, power on. If the problem remains, check System Configuration and replace any module not shown."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "104",
        "title": "Memory Check Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 104.",
        "causes": [
          "There is a memory check error."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 104); status flag SC23 is ON."
        ],
        "fix": [
          "Power cycle. If it occurs again, download the project again and/or use 'Reset to Factory Default'. If it still occurs, replace the PLC unit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "105",
        "title": "Project File Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 105.",
        "causes": [
          "There is no project file in the PLC, or the stored project file is corrupted."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 105); status flag SC24 is ON."
        ],
        "fix": [
          "Download the project file into the PLC (again)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "106",
        "title": "Firmware Version Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 106.",
        "causes": [
          "The project was written with a newer version of CLICK software; the PLC firmware is too old to execute the project."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 106); status flag SC25 is ON."
        ],
        "fix": [
          "Connect CLICK software and update the firmware of the PLC unit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "107",
        "title": "Watchdog Timer Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 107.",
        "causes": [
          "The PLC scan time exceeded the watchdog timer setup."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 107); status flag SC26 is ON."
        ],
        "fix": [
          "Connect CLICK software and check the maximum PLC scan time and the watchdog timer setup."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "108",
        "title": "Interrupt Watchdog Timer Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 108.",
        "causes": [
          "The watchdog timer was exceeded while executing an Interrupt Program."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 108); status flag SC26 is ON."
        ],
        "fix": [
          "Reduce the occurrences of interrupts or the execution time of the interrupt programs."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "201",
        "title": "Lost SRAM Data",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 201.",
        "causes": [
          "SRAM data was lost while the PLC was powered off (capacitor discharged / no battery)."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 201); status flag SC27 is ON."
        ],
        "fix": [
          "The PLC initializes SRAM data automatically; install a battery on units that take one if retention is needed."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "202",
        "title": "Battery Low Voltage",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 202.",
        "causes": [
          "Battery voltage is too low to retain SRAM data."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 202); status flag SC28 is ON."
        ],
        "fix": [
          "Replace the battery (D2-BAT-1); set the new installation and replacement dates in Setup > Battery Backup Setup."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "203",
        "title": "Battery Replacement",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 203.",
        "causes": [
          "The anticipated battery replacement date has passed."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 203); status flag SC29 is ON."
        ],
        "fix": [
          "Replace the battery (D2-BAT-1); set the new dates in Setup > Battery Backup Setup."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-12)"
      },
      {
        "code": "301",
        "title": "IO1 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 301.",
        "causes": [
          "The analog I/O module in I/O1 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 301); status flag X101 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "302",
        "title": "IO2 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 302.",
        "causes": [
          "The analog I/O module in I/O2 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 302); status flag X201 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "303",
        "title": "IO3 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 303.",
        "causes": [
          "The analog I/O module in I/O3 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 303); status flag X301 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "304",
        "title": "IO4 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 304.",
        "causes": [
          "The analog I/O module in I/O4 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 304); status flag X401 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "305",
        "title": "IO5 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 305.",
        "causes": [
          "The analog I/O module in I/O5 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 305); status flag X501 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "306",
        "title": "IO6 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 306.",
        "causes": [
          "The analog I/O module in I/O6 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 306); status flag X601 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "307",
        "title": "IO7 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 307.",
        "causes": [
          "The analog I/O module in I/O7 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 307); status flag X701 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "308",
        "title": "IO8 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 308.",
        "causes": [
          "The analog I/O module in I/O8 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 308); status flag X801 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "310",
        "title": "IO1 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 310.",
        "causes": [
          "The analog I/O module in I/O1 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 310); status flag X102 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "311",
        "title": "IO1 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 311.",
        "causes": [
          "CH1 on the analog I/O module in I/O1 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 311); status flag X103 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "312",
        "title": "IO1 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 312.",
        "causes": [
          "CH2 on the analog I/O module in I/O1 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 312); status flag X106 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "313",
        "title": "IO1 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 313.",
        "causes": [
          "CH3 on the analog I/O module in I/O1 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 313); status flag X109 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "314",
        "title": "IO1 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 314.",
        "causes": [
          "CH4 on the analog I/O module in I/O1 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 314); status flag X112 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "320",
        "title": "IO2 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 320.",
        "causes": [
          "The analog I/O module in I/O2 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 320); status flag X202 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "321",
        "title": "IO2 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 321.",
        "causes": [
          "CH1 on the analog I/O module in I/O2 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 321); status flag X203 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "322",
        "title": "IO2 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 322.",
        "causes": [
          "CH2 on the analog I/O module in I/O2 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 322); status flag X206 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-13)"
      },
      {
        "code": "323",
        "title": "IO2 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 323.",
        "causes": [
          "CH3 on the analog I/O module in I/O2 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 323); status flag X209 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "324",
        "title": "IO2 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 324.",
        "causes": [
          "CH4 on the analog I/O module in I/O2 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 324); status flag X212 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "330",
        "title": "IO3 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 330.",
        "causes": [
          "The analog I/O module in I/O3 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 330); status flag X302 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "331",
        "title": "IO3 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 331.",
        "causes": [
          "CH1 on the analog I/O module in I/O3 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 331); status flag X303 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "332",
        "title": "IO3 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 332.",
        "causes": [
          "CH2 on the analog I/O module in I/O3 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 332); status flag X306 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "333",
        "title": "IO3 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 333.",
        "causes": [
          "CH3 on the analog I/O module in I/O3 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 333); status flag X309 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "334",
        "title": "IO3 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 334.",
        "causes": [
          "CH4 on the analog I/O module in I/O3 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 334); status flag X312 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "340",
        "title": "IO4 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 340.",
        "causes": [
          "The analog I/O module in I/O4 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 340); status flag X402 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "341",
        "title": "IO4 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 341.",
        "causes": [
          "CH1 on the analog I/O module in I/O4 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 341); status flag X403 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "342",
        "title": "IO4 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 342.",
        "causes": [
          "CH2 on the analog I/O module in I/O4 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 342); status flag X406 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "343",
        "title": "IO4 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 343.",
        "causes": [
          "CH3 on the analog I/O module in I/O4 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 343); status flag X409 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "344",
        "title": "IO4 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 344.",
        "causes": [
          "CH4 on the analog I/O module in I/O4 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 344); status flag X412 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "350",
        "title": "IO5 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 350.",
        "causes": [
          "The analog I/O module in I/O5 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 350); status flag X502 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "351",
        "title": "IO5 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 351.",
        "causes": [
          "CH1 on the analog I/O module in I/O5 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 351); status flag X503 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "352",
        "title": "IO5 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 352.",
        "causes": [
          "CH2 on the analog I/O module in I/O5 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 352); status flag X506 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "353",
        "title": "IO5 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 353.",
        "causes": [
          "CH3 on the analog I/O module in I/O5 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 353); status flag X509 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-14)"
      },
      {
        "code": "354",
        "title": "IO5 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 354.",
        "causes": [
          "CH4 on the analog I/O module in I/O5 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 354); status flag X512 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "360",
        "title": "IO6 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 360.",
        "causes": [
          "The analog I/O module in I/O6 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 360); status flag X602 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "361",
        "title": "IO6 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 361.",
        "causes": [
          "CH1 on the analog I/O module in I/O6 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 361); status flag X603 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "362",
        "title": "IO6 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 362.",
        "causes": [
          "CH2 on the analog I/O module in I/O6 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 362); status flag X606 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "363",
        "title": "IO6 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 363.",
        "causes": [
          "CH3 on the analog I/O module in I/O6 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 363); status flag X609 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "364",
        "title": "IO6 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 364.",
        "causes": [
          "CH4 on the analog I/O module in I/O6 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 364); status flag X612 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "370",
        "title": "IO7 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 370.",
        "causes": [
          "The analog I/O module in I/O7 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 370); status flag X702 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "371",
        "title": "IO7 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 371.",
        "causes": [
          "CH1 on the analog I/O module in I/O7 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 371); status flag X703 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "372",
        "title": "IO7 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 372.",
        "causes": [
          "CH2 on the analog I/O module in I/O7 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 372); status flag X706 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "373",
        "title": "IO7 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 373.",
        "causes": [
          "CH3 on the analog I/O module in I/O7 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 373); status flag X709 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "374",
        "title": "IO7 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 374.",
        "causes": [
          "CH4 on the analog I/O module in I/O7 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 374); status flag X712 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "380",
        "title": "IO8 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 380.",
        "causes": [
          "The analog I/O module in I/O8 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 380); status flag X802 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "381",
        "title": "IO8 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 381.",
        "causes": [
          "CH1 on the analog I/O module in I/O8 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 381); status flag X803 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "382",
        "title": "IO8 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 382.",
        "causes": [
          "CH2 on the analog I/O module in I/O8 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 382); status flag X806 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "383",
        "title": "IO8 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 383.",
        "causes": [
          "CH3 on the analog I/O module in I/O8 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 383); status flag X809 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      },
      {
        "code": "384",
        "title": "IO8 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 384.",
        "causes": [
          "CH4 on the analog I/O module in I/O8 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 384); status flag X812 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, Ch. Troubleshooting, Error Codes table, p.6-15)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, PLC LED Status Indicators p.2-29/2-30)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (CLICK PLC Hardware User Manual C0-USER-M 6th Ed. Rev. Q, ch.6 Troubleshooting p.6-2 to 6-15)"
    ]
  },
  {
    "id": "click-plus-c2-cpu",
    "title": "CLICK PLUS C2-0xCPU: power, LEDs, RUN/STOP switch, error codes",
    "match": {
      "categories": [
        "plc"
      ],
      "family": "CLICK PLUS",
      "partNumber": "^C2-0[1-3]CPU"
    },
    "normal": [
      {
        "terminals": "24V to 0V (power connector at the bottom of the PLC)",
        "state": "powered",
        "meter": "VDC",
        "expected": "20-28 VDC",
        "pins": [
          [
            "24V",
            "0V"
          ]
        ]
      }
    ],
    "indicators": [
      {
        "name": "POWER (green)",
        "state": "on",
        "meaning": "Power good"
      },
      {
        "name": "POWER (green)",
        "state": "blinking",
        "meaning": "USB Low Power Mode, or input power not sufficient"
      },
      {
        "name": "POWER (green)",
        "state": "off",
        "meaning": "Power failure"
      },
      {
        "name": "RUN (green)",
        "state": "on",
        "meaning": "CPU RUN mode"
      },
      {
        "name": "RUN (green)",
        "state": "blinking",
        "meaning": "Initializing modules"
      },
      {
        "name": "RUN (green)",
        "state": "off",
        "meaning": "CPU program (STOP) mode"
      },
      {
        "name": "ERROR (red)",
        "state": "on",
        "meaning": "Self-diagnostic error (PLC in STOP)"
      },
      {
        "name": "ERROR (red)",
        "state": "blinking",
        "meaning": "Self-diagnostic warning"
      },
      {
        "name": "ERROR (red)",
        "state": "off",
        "meaning": "No error"
      },
      {
        "name": "WLAN (green, C2-02/C2-03)",
        "state": "on",
        "meaning": "Link"
      },
      {
        "name": "WLAN (green, C2-02/C2-03)",
        "state": "blinking",
        "meaning": "Activity"
      },
      {
        "name": "WLAN (green, C2-02/C2-03)",
        "state": "off",
        "meaning": "No link"
      },
      {
        "name": "BLUETOOTH (blue, C2-02/C2-03)",
        "state": "blinking 500 ms",
        "meaning": "Pairing mode"
      },
      {
        "name": "BLUETOOTH (blue, C2-02/C2-03)",
        "state": "blinking 200 ms",
        "meaning": "Bluetooth disabled in PLC (SC60 on), pairing disabled"
      },
      {
        "name": "MICRO SD (green, C2-03)",
        "state": "on",
        "meaning": "Card mounted"
      },
      {
        "name": "MICRO SD (green, C2-03)",
        "state": "blinking",
        "meaning": "Card access"
      },
      {
        "name": "MICRO SD (green, C2-03)",
        "state": "off",
        "meaning": "No SD mounted"
      },
      {
        "name": "LNK/ACT (green)",
        "state": "on",
        "meaning": "Connected to the network"
      },
      {
        "name": "100MBIT (orange)",
        "state": "on",
        "meaning": "Communicating at 100 Mbps"
      },
      {
        "name": "TX & RX (green)",
        "state": "on",
        "meaning": "Com port data active"
      }
    ],
    "faults": [
      {
        "title": "PLC will not go to RUN with switch in RUN",
        "symptom": "Toggle switch in RUN but RUN LED off.",
        "causes": [
          "PLC placed in STOP by a peripheral through a communication port",
          "Error present (ERR LED on)",
          "Insufficient power (PWR LED off)"
        ],
        "confirm": [
          "Check PWR and ERR LEDs.",
          "Connect CLICK software and read the error information."
        ],
        "fix": [
          "Move the toggle switch to STOP and back to RUN.",
          "If the RUN LED stays off, read the error code and act on it; check the power cable and input voltage if PWR is off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Toggle Switch, p.7-3)"
      },
      {
        "title": "PLC starts in RUN with switch in STOP",
        "symptom": "After power cycle the PLC runs although the toggle switch is in STOP.",
        "causes": [
          "PLC unit does not recognise the toggle switch position"
        ],
        "confirm": [
          "Cycle power with the switch in STOP and watch the RUN LED."
        ],
        "fix": [
          "Replace the PLC unit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Toggle Switch, p.7-3)"
      },
      {
        "title": "PWR LED blinking or off",
        "symptom": "PWR LED blinks or is dark. (Blinking can also be USB Low Power Mode when powered only from the PC USB port.)",
        "causes": [
          "Supply below 20 VDC or missing",
          "Power supply too small for the power budget",
          "Loose power wiring at the bottom connector"
        ],
        "confirm": [
          "Measure the voltage on the power terminal at the bottom of the PLC: should be 20-28 VDC.",
          "Remove the bottom connector and measure again: > 20 VDC with the connector removed means the supply cannot deliver enough current.",
          "Check Setup > System Configuration for the Power Budget (mA)."
        ],
        "fix": [
          "Fix the power wiring; replace the supply with a higher-current one if it sags under load; if > 28 VDC, lower the output or replace the supply."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, LED Indicators p.7-4 and Power Supply Troubleshooting p.7-9)"
      },
      {
        "title": "Need to reset the CPU to factory defaults",
        "symptom": "Project / settings must be cleared (e.g. memory error persists).",
        "causes": [
          "Corrupt settings or unknown password"
        ],
        "confirm": [
          "Read SD1 in CLICK software; a 104 Memory Check Error that persists after power cycle and re-download calls for a factory reset."
        ],
        "fix": [
          "Power on with the RUN/STOP switch in STOP; within 30 s move it STOP>RUN>STOP>RUN>STOP>RUN>STOP (resets the processor only), or use the CLICK Factory Default Tool over USB, or hold the BT button 5-6 s on C2-02/C2-03 until the BT LED flashes very fast."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Resetting to Factory Defaults, p.7-14)"
      },
      {
        "code": "001",
        "title": "Power Fail",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 001.",
        "causes": [
          "Input voltage is less than 20 VDC."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 001); no status flag."
        ],
        "fix": [
          "Provide the correct nominal voltage of 24VDC. Recalculate the power budget and compare to your power supply available current."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-16)"
      },
      {
        "code": "101",
        "title": "I/O Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 101.",
        "causes": [
          "More than 8 I/O modules; an I/O module was added during operation; or an I/O module has failed."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 101); status flag SC20 is ON."
        ],
        "fix": [
          "Remove excessive modules (max 8). Power off and check the module connections, then power on. If the problem remains, check System Configuration in CLICK software and replace any module not shown."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-16)"
      },
      {
        "code": "102",
        "title": "System Config Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 102.",
        "causes": [
          "The current system configuration does not match the configuration saved in the project file."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 102); status flag SC21 is ON."
        ],
        "fix": [
          "In CLICK software open System Configuration; make the hardware match the project, or uncheck the 'Start-up I/O Config Check' option to use the current configuration."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-16)"
      },
      {
        "code": "103",
        "title": "I/O Config Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 103.",
        "causes": [
          "An I/O module was removed during operation, or the PLC unit cannot access one or more I/O modules."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 103); status flag SC22 is ON."
        ],
        "fix": [
          "Power off, check the module connections, power on. If the problem remains, check System Configuration and replace any module not shown."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "104",
        "title": "Memory Check Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 104.",
        "causes": [
          "There is a memory check error."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 104); status flag SC23 is ON."
        ],
        "fix": [
          "Power cycle. If it occurs again, download the project again and/or use 'Reset to Factory Default'. If it still occurs, replace the PLC unit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "105",
        "title": "Project File Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 105.",
        "causes": [
          "There is no project file in the PLC, or the stored project file is corrupted."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 105); status flag SC24 is ON."
        ],
        "fix": [
          "Download the project file into the PLC (again)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "106",
        "title": "Firmware Version Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 106.",
        "causes": [
          "The project was written with a newer version of CLICK software; the PLC firmware is too old to execute the project."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 106); status flag SC25 is ON."
        ],
        "fix": [
          "Connect CLICK software and update the firmware of the PLC unit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "107",
        "title": "Watchdog Timer Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 107.",
        "causes": [
          "The PLC scan time exceeded the watchdog timer setup."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 107); status flag SC26 is ON."
        ],
        "fix": [
          "Connect CLICK software and check the maximum PLC scan time and the watchdog timer setup."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "108",
        "title": "Interrupt Watchdog Timer Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 108.",
        "causes": [
          "The watchdog timer was exceeded while executing an Interrupt Program."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 108); status flag SC26 is ON."
        ],
        "fix": [
          "Reduce the occurrences of interrupts or the execution time of the interrupt programs."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "109",
        "title": "Sub-processor Firmware Version Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 109.",
        "causes": [
          "The sub-processor firmware version does not match the main processor."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 109); status flag SC31 is ON."
        ],
        "fix": [
          "Connect CLICK software and update the firmware of the CPU module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "201",
        "title": "Lost SRAM Data",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 201.",
        "causes": [
          "SRAM data was lost while the PLC was powered off (capacitor discharged / no battery)."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 201); status flag SC27 is ON."
        ],
        "fix": [
          "The PLC initializes SRAM data automatically; install a battery on units that take one if retention is needed."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "202",
        "title": "Battery Low Voltage",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 202.",
        "causes": [
          "Battery voltage is too low to retain SRAM data."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 202); status flag SC28 is ON."
        ],
        "fix": [
          "Replace the battery (D0-MC-BAT); set the new installation and replacement dates in Setup > Battery Backup Setup."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "203",
        "title": "Battery Replacement",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 203.",
        "causes": [
          "The anticipated battery replacement date has passed."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 203); status flag SC29 is ON."
        ],
        "fix": [
          "Replace the battery (D0-MC-BAT); set the new dates in Setup > Battery Backup Setup."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-17)"
      },
      {
        "code": "204",
        "title": "Run Edit Project Error",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 204.",
        "causes": [
          "The RUN time edit program download failed."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 204); status flag SC30 is ON."
        ],
        "fix": [
          "The program download was not completed; the PLC continues in RUN with the previous program. Repeat the download."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "205",
        "title": "C2-DCM FW Version Error",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 205.",
        "causes": [
          "The C2-DCM contains a firmware version incompatible with the main processor."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 205); status flag SC32 is ON."
        ],
        "fix": [
          "Connect CLICK software and update the firmware of the CPU module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "301",
        "title": "IO1 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 301.",
        "causes": [
          "The analog I/O module in I/O1 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 301); status flag X101 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "302",
        "title": "IO2 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 302.",
        "causes": [
          "The analog I/O module in I/O2 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 302); status flag X201 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "303",
        "title": "IO3 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 303.",
        "causes": [
          "The analog I/O module in I/O3 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 303); status flag X301 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "304",
        "title": "IO4 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 304.",
        "causes": [
          "The analog I/O module in I/O4 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 304); status flag X401 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "305",
        "title": "IO5 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 305.",
        "causes": [
          "The analog I/O module in I/O5 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 305); status flag X501 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "306",
        "title": "IO6 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 306.",
        "causes": [
          "The analog I/O module in I/O6 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 306); status flag X601 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "307",
        "title": "IO7 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 307.",
        "causes": [
          "The analog I/O module in I/O7 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 307); status flag X701 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "308",
        "title": "IO8 Module Error",
        "symptom": "ERR LED on, PLC goes to STOP (outputs off); SD1 = 308.",
        "causes": [
          "The analog I/O module in I/O8 position is not functioning."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 308); status flag X801 is ON."
        ],
        "fix": [
          "Power cycle the CLICK PLC. If the same error occurs again, replace the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "310",
        "title": "IO1 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 310.",
        "causes": [
          "The analog I/O module in I/O1 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 310); status flag X102 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "311",
        "title": "IO1 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 311.",
        "causes": [
          "CH1 on the analog I/O module in I/O1 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 311); status flag X103 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "312",
        "title": "IO1 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 312.",
        "causes": [
          "CH2 on the analog I/O module in I/O1 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 312); status flag X106 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "313",
        "title": "IO1 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 313.",
        "causes": [
          "CH3 on the analog I/O module in I/O1 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 313); status flag X109 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "314",
        "title": "IO1 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 314.",
        "causes": [
          "CH4 on the analog I/O module in I/O1 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 314); status flag X112 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "320",
        "title": "IO2 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 320.",
        "causes": [
          "The analog I/O module in I/O2 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 320); status flag X202 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-18)"
      },
      {
        "code": "321",
        "title": "IO2 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 321.",
        "causes": [
          "CH1 on the analog I/O module in I/O2 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 321); status flag X203 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "322",
        "title": "IO2 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 322.",
        "causes": [
          "CH2 on the analog I/O module in I/O2 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 322); status flag X206 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "323",
        "title": "IO2 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 323.",
        "causes": [
          "CH3 on the analog I/O module in I/O2 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 323); status flag X209 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "324",
        "title": "IO2 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 324.",
        "causes": [
          "CH4 on the analog I/O module in I/O2 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 324); status flag X212 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "330",
        "title": "IO3 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 330.",
        "causes": [
          "The analog I/O module in I/O3 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 330); status flag X302 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "331",
        "title": "IO3 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 331.",
        "causes": [
          "CH1 on the analog I/O module in I/O3 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 331); status flag X303 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "332",
        "title": "IO3 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 332.",
        "causes": [
          "CH2 on the analog I/O module in I/O3 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 332); status flag X306 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "333",
        "title": "IO3 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 333.",
        "causes": [
          "CH3 on the analog I/O module in I/O3 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 333); status flag X309 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "334",
        "title": "IO3 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 334.",
        "causes": [
          "CH4 on the analog I/O module in I/O3 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 334); status flag X312 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "340",
        "title": "IO4 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 340.",
        "causes": [
          "The analog I/O module in I/O4 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 340); status flag X402 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "341",
        "title": "IO4 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 341.",
        "causes": [
          "CH1 on the analog I/O module in I/O4 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 341); status flag X403 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "342",
        "title": "IO4 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 342.",
        "causes": [
          "CH2 on the analog I/O module in I/O4 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 342); status flag X406 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "343",
        "title": "IO4 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 343.",
        "causes": [
          "CH3 on the analog I/O module in I/O4 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 343); status flag X409 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "344",
        "title": "IO4 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 344.",
        "causes": [
          "CH4 on the analog I/O module in I/O4 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 344); status flag X412 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "350",
        "title": "IO5 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 350.",
        "causes": [
          "The analog I/O module in I/O5 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 350); status flag X502 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-19)"
      },
      {
        "code": "351",
        "title": "IO5 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 351.",
        "causes": [
          "CH1 on the analog I/O module in I/O5 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 351); status flag X503 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "352",
        "title": "IO5 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 352.",
        "causes": [
          "CH2 on the analog I/O module in I/O5 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 352); status flag X506 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "353",
        "title": "IO5 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 353.",
        "causes": [
          "CH3 on the analog I/O module in I/O5 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 353); status flag X509 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "354",
        "title": "IO5 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 354.",
        "causes": [
          "CH4 on the analog I/O module in I/O5 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 354); status flag X512 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "360",
        "title": "IO6 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 360.",
        "causes": [
          "The analog I/O module in I/O6 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 360); status flag X602 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "361",
        "title": "IO6 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 361.",
        "causes": [
          "CH1 on the analog I/O module in I/O6 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 361); status flag X603 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "362",
        "title": "IO6 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 362.",
        "causes": [
          "CH2 on the analog I/O module in I/O6 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 362); status flag X606 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "363",
        "title": "IO6 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 363.",
        "causes": [
          "CH3 on the analog I/O module in I/O6 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 363); status flag X609 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "364",
        "title": "IO6 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 364.",
        "causes": [
          "CH4 on the analog I/O module in I/O6 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 364); status flag X612 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "370",
        "title": "IO7 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 370.",
        "causes": [
          "The analog I/O module in I/O7 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 370); status flag X702 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "371",
        "title": "IO7 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 371.",
        "causes": [
          "CH1 on the analog I/O module in I/O7 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 371); status flag X703 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "372",
        "title": "IO7 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 372.",
        "causes": [
          "CH2 on the analog I/O module in I/O7 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 372); status flag X706 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "373",
        "title": "IO7 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 373.",
        "causes": [
          "CH3 on the analog I/O module in I/O7 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 373); status flag X709 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "374",
        "title": "IO7 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 374.",
        "causes": [
          "CH4 on the analog I/O module in I/O7 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 374); status flag X712 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "380",
        "title": "IO8 Missing 24V",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 380.",
        "causes": [
          "The analog I/O module in I/O8 position is missing external 24VDC input."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 380); status flag X802 is ON."
        ],
        "fix": [
          "Apply 24VDC to the analog I/O module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-20)"
      },
      {
        "code": "381",
        "title": "IO8 CH1 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 381.",
        "causes": [
          "CH1 on the analog I/O module in I/O8 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 381); status flag X803 is ON."
        ],
        "fix": [
          "Check the wiring for CH1. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-21)"
      },
      {
        "code": "382",
        "title": "IO8 CH2 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 382.",
        "causes": [
          "CH2 on the analog I/O module in I/O8 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 382); status flag X806 is ON."
        ],
        "fix": [
          "Check the wiring for CH2. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-21)"
      },
      {
        "code": "383",
        "title": "IO8 CH3 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 383.",
        "causes": [
          "CH3 on the analog I/O module in I/O8 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 383); status flag X809 is ON."
        ],
        "fix": [
          "Check the wiring for CH3. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-21)"
      },
      {
        "code": "384",
        "title": "IO8 CH4 Burnout",
        "symptom": "ERR LED blinking, PLC stays in RUN; SD1 = 384.",
        "causes": [
          "CH4 on the analog I/O module in I/O8 position senses burnout or open circuit."
        ],
        "confirm": [
          "Connect CLICK software and read the error in SD1 (= 384); status flag X812 is ON."
        ],
        "fix": [
          "Check the wiring for CH4. Replace the sensor if it is broken."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Error Codes table, p.7-21)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, PLC LED Status Indicators p.2-27/2-28)",
      "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, ch.7 Troubleshooting p.7-2 to 7-21)"
    ]
  },
  {
    "id": "click-plus-option-slot-io",
    "title": "CLICK PLUS option-slot I/O modules (C2-14D1/D2/TTL/DR, C2-08Dx-4VC/-6C/-6V)",
    "match": {
      "categories": [
        "plcModule"
      ],
      "family": "CLICK PLUS",
      "partNumber": "^C2-(14|08)"
    },
    "normal": [
      {
        "terminals": "X1 to C1 (X1-X4 on C1, X5-X8 on C2)",
        "state": "input ON (24 VDC modules)",
        "meter": "VDC",
        "expected": "> 19 VDC (input voltage range 21.6-26.4 VDC), typ. 6.5 mA",
        "pins": [
          [
            "X001",
            "C1"
          ]
        ]
      },
      {
        "terminals": "X1 to C1",
        "state": "input OFF (24 VDC modules)",
        "meter": "VDC",
        "expected": "< 2 VDC",
        "pins": [
          [
            "X001",
            "C1"
          ]
        ]
      },
      {
        "terminals": "X1 to C1 (C2-14TTL)",
        "state": "input ON / OFF",
        "meter": "VDC",
        "expected": "ON > 4.0 VDC, OFF < 2.0 VDC (input voltage range 4.5-5.5 VDC)",
        "pins": [
          [
            "X001",
            "C1"
          ]
        ]
      },
      {
        "terminals": "+V to C4 (C2-14D1 sinking outputs)",
        "state": "powered",
        "meter": "VDC",
        "expected": "20-28 VDC external DC power",
        "pins": [
          [
            "+V",
            "C4"
          ]
        ]
      }
    ],
    "indicators": [
      {
        "name": "X input LEDs (green)",
        "state": "on",
        "meaning": "Input true"
      },
      {
        "name": "Y output LEDs (red)",
        "state": "on",
        "meaning": "Output true"
      }
    ],
    "faults": [
      {
        "title": "Input signal on but input LED off",
        "symptom": "Field device is detecting / contact is closed, but the X LED on the PLC or input module stays off.",
        "causes": [
          "External input supply missing or out of range",
          "Terminal block not attached correctly",
          "Common (C1/C2...) not wired, or wired to the wrong supply pole for the sensor type",
          "Failed input circuit"
        ],
        "confirm": [
          "Measure the input terminal to its common (e.g. X1 to C1) with the device ON: a 24 VDC input needs > 19 VDC to turn on; ~0 V means the supply, the device output or the wiring is open.",
          "Check that the removable terminal block is fully seated."
        ],
        "fix": [
          "Check the external power input voltage on the terminal block.",
          "Check whether the terminal block is attached correctly.",
          "If the input voltage is correct but the LED indicator is still off, replace the input module (or PLC unit for built-in inputs)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Input Module Troubleshooting, p.7-10)"
      },
      {
        "title": "Input LED on but the program does not react",
        "symptom": "X LED is on but the ladder logic acts as if the input were off.",
        "causes": [
          "PLC not in RUN mode",
          "I/O configuration recognised by the PLC differs from the project (module in a different slot gives different X addresses)",
          "Failed input circuit between LED and logic"
        ],
        "confirm": [
          "Check the RUN LED is on.",
          "In CLICK software: Setup > System Configuration shows the modules the PLC recognises.",
          "In CLICK software Data View, monitor the X bit of the input that is on (inputs cannot be forced from Data View)."
        ],
        "fix": [
          "Put the PLC in RUN mode.",
          "Correct the I/O configuration / addressing.",
          "If the X bit is off while the LED is on, replace the input module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Input Module Troubleshooting and How to Check the I/O Configuration / I/O Status, p.7-10-7-12)"
      },
      {
        "title": "High-speed counter / pulse output does nothing",
        "symptom": "HSC input or PTO/PWM output on an option module does not work.",
        "causes": [
          "Option slot module not in Option Slot 0"
        ],
        "confirm": [
          "Check which slot the module occupies (System Configuration)."
        ],
        "fix": [
          "Install the module in Option Slot 0 to use high-speed input/output functions."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch3.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, High-Speed Input/Output Configuration, p.3-53; Slot 0 note p.3-5)"
      },
      {
        "title": "Output LED on but load not energized",
        "symptom": "Y LED is on but the field device does not operate.",
        "causes": [
          "External output supply (+V / V1 / load supply) missing",
          "Terminal block not attached correctly",
          "Open load or wiring",
          "Failed output circuit"
        ],
        "confirm": [
          "Check the external power input voltage on the terminal block.",
          "Measure the output terminal to its common (e.g. Y1 to C3) with the Y LED on: a working output reads close to 0 V.",
          "If the output terminal reads ~0 V as above but the load is off, the fault is in the load or its wiring."
        ],
        "fix": [
          "Restore the external supply / terminal block.",
          "If the LED indicator is ON but the output voltage is not correct, replace the output module (or PLC unit for built-in outputs)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Output Module Troubleshooting, p.7-11)"
      },
      {
        "title": "Output LED off though the output should be on",
        "symptom": "Y LED stays off although the program should be turning the output on.",
        "causes": [
          "PLC not in RUN mode (in STOP all outputs are off)",
          "I/O configuration / addressing differs from the project",
          "Y bit not actually turned on by the logic",
          "Failed output circuit"
        ],
        "confirm": [
          "Check the RUN LED.",
          "Setup > System Configuration in CLICK software.",
          "Monitor the Y bit in Data View; use the override feature to turn the Y bit ON."
        ],
        "fix": [
          "Put the PLC in RUN mode.",
          "Correct the configuration / logic.",
          "If the Y bit is ON but the output is OFF, replace the output module."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Ch. Troubleshooting, Output Module Troubleshooting, p.7-11)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, Option Slot I/O Module Specifications p.2-31 to 2-46)",
      "https://cdn.automationdirect.com/static/manuals/c2userm/ch3.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, p.3-53)",
      "https://cdn.automationdirect.com/static/manuals/c2userm/ch7.pdf (CLICK PLUS PLC Hardware User Manual C2-USER-M 1st Ed. Rev. V, p.7-10 to 7-12)"
    ]
  },
  {
    "id": "pnp-3wire-inductive",
    "title": "3-wire DC inductive proximity sensor, PNP output (AutomationDirect PNK, ifm IG/IF/II)",
    "match": {
      "categories": [
        "sensor"
      ],
      "ratings": {
        "type": "inductive",
        "output": "PNP"
      }
    },
    "normal": [
      {
        "terminals": "BN (+) to BU (-)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC; no-load current < 10 mA",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (out) to BU (-)",
        "state": "target present, N.O. model",
        "meter": "VDC",
        "expected": "about the supply voltage minus the output voltage drop (< 2.5 V); load max 100 mA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (out) to BU (-)",
        "state": "target absent, N.O. model",
        "meter": "VDC",
        "expected": "about 0 V (off-state leakage < 50 uA, PNK 3-wire)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "WH (out, pin 2) to BU (-)",
        "state": "N.C. model (PNK-CP...)",
        "meter": "VDC",
        "expected": "about supply minus drop with target absent; about 0 V with target present",
        "pins": [
          [
            "WH",
            "BU"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "BN",
        "b": "BK",
        "when": "target present (N.O. models)",
        "note": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf p.tSEN-338 wiring diagrams 1-4 (cable: BN L+, BU L-, BK output; N.C. M12 models output on pin 2 WH); PNP output switches L+ to the output"
      },
      {
        "a": "BN",
        "b": "WH",
        "when": "target absent (N.C. M12 models, pin 2)",
        "note": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf p.tSEN-338 wiring diagrams 1-4 (cable: BN L+, BU L-, BK output; N.C. M12 models output on pin 2 WH)"
      }
    ],
    "indicators": [
      {
        "name": "yellow LED (PNK: 1 LED on cable models, 4 LEDs on M12 models; ifm IGS204: 4 x LED yellow)",
        "state": "on",
        "meaning": "Output energized (switching status)"
      },
      {
        "name": "yellow LED",
        "state": "off",
        "meaning": "Output not energized"
      }
    ],
    "faults": [
      {
        "title": "No sensor supply",
        "symptom": "Sensor LED never lights and the PLC input never turns on.",
        "causes": [
          "Supply off or blown",
          "Cable / M12 connector open",
          "BN and BU reversed (reverse-polarity protected: the sensor stays off)"
        ],
        "confirm": [
          "Measure BN (+) to BU (-) at the sensor connector: must be 10-30 VDC."
        ],
        "fix": [
          "Restore the 10-30 VDC supply and the cable; wire brown to + and blue to -."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (PN Series Specifications and wiring diagrams, p. tSEN-338)"
      },
      {
        "title": "Output short-circuited or overloaded",
        "symptom": "Yellow LED follows the target but the PLC input does not turn on (or flickers).",
        "causes": [
          "Short from BK to BU / 0 V or load above 100 mA: the short-circuit protection switches the output off (PNK: pulsed protection)"
        ],
        "confirm": [
          "With the target present measure BK to BU: about 0 V while BN-BU is normal means the output is held off.",
          "Disconnect BK and measure again: the reading returns to about the supply voltage when the short is in the load wiring."
        ],
        "fix": [
          "Remove the short; keep the load at or below 100 mA."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (PN Series Specifications and wiring diagrams, p. tSEN-338); https://media.ifm.com/dam/3c49a7f8-ee0d-43f3-8fbf-2da6d6fd605c/Original/IGS204-02_EN-US.pdf (IGS204 data sheet: electrical data, outputs, correction factors, connection)"
      },
      {
        "title": "PNP sensor on a sourcing-wired PLC input",
        "symptom": "Sensor LED lights but the CLICK X LED stays off.",
        "causes": [
          "The input group common (C1/C2) is wired to +24 V (NPN wiring); a PNP sensor needs the common on 0 V"
        ],
        "confirm": [
          "Measure the CLICK common (C1) to supply 0 V: about 24 V shows it is wired for NPN sensors.",
          "X1 to C1 reads about 0 V with the sensor ON."
        ],
        "fix": [
          "Wire the common (C1/C2) to supply - for PNP sensors (or use an NPN sensor on that group)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M: DC Input Wiring Methods p.3-31; 3-Wire Sensors p.3-47)"
      },
      {
        "title": "Target not detected (distance / material)",
        "symptom": "Yellow LED does not light when the target passes.",
        "causes": [
          "Target beyond the assured operating distance (PNK/ifm IGS M18 flush: 0-6.48 mm; PNK non-flush: 0-9.72 mm)",
          "Non-ferrous target reduces the range: correction factor steel 1, stainless 0.7, brass 0.5, aluminium 0.4, copper 0.3"
        ],
        "confirm": [
          "Measure the gap between sensing face and target; multiply the rated range by the material factor."
        ],
        "fix": [
          "Move the sensor so the target is inside the operating distance for its material."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (PN Series Specifications and wiring diagrams, p. tSEN-338); https://media.ifm.com/dam/3c49a7f8-ee0d-43f3-8fbf-2da6d6fd605c/Original/IGS204-02_EN-US.pdf (IGS204 data sheet: electrical data, outputs, correction factors, connection)"
      },
      {
        "title": "N.C. sensor with a 3-wire cable",
        "symptom": "N.C. PNK model never switches on the PLC input.",
        "causes": [
          "N.C. output is on pin 2 (white); an M12 3-conductor cable does not carry it"
        ],
        "confirm": [
          "Check the cordset: pin 2 / white conductor missing."
        ],
        "fix": [
          "Use an M12 4-conductor cable for normally closed units."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (Wiring diagrams note, p. tSEN-338)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (PN Series Specifications and wiring diagrams, p. tSEN-338)",
      "https://media.ifm.com/dam/3c49a7f8-ee0d-43f3-8fbf-2da6d6fd605c/Original/IGS204-02_EN-US.pdf (IGS204 data sheet: electrical data, outputs, correction factors, connection)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK manual p.3-31, 3-47)"
    ]
  },
  {
    "id": "npn-3wire-inductive",
    "title": "3-wire DC inductive proximity sensor, NPN output (AutomationDirect PNK-AN/CN)",
    "match": {
      "categories": [
        "sensor"
      ],
      "ratings": {
        "type": "inductive",
        "output": "NPN"
      }
    },
    "normal": [
      {
        "terminals": "BN (+) to BU (-)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC; no-load current < 10 mA",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (out) to BU (-)",
        "state": "target present, N.O. model (output pulled to 0 V)",
        "meter": "VDC",
        "expected": "< 2.5 V (output voltage drop); load max 100 mA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (out) to BN (+)",
        "state": "target present, N.O. model",
        "meter": "VDC",
        "expected": "about the supply voltage (the load between BN/+ and BK is energized)",
        "pins": [
          [
            "BK",
            "BN"
          ]
        ]
      },
      {
        "terminals": "BK (out) to BU (-)",
        "state": "target absent, N.O. model",
        "meter": "VDC",
        "expected": "about the supply voltage through the load (off-state leakage < 50 uA)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "BK",
        "b": "BU",
        "when": "target present (N.O. models)",
        "note": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf p.tSEN-338 wiring diagrams 1-4 (cable: BN L+, BU L-, BK output; N.C. M12 models output on pin 2 WH); NPN output switches the output to L-"
      },
      {
        "a": "WH",
        "b": "BU",
        "when": "target absent (N.C. M12 models, pin 2)",
        "note": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf p.tSEN-338 wiring diagrams 1-4 (cable: BN L+, BU L-, BK output; N.C. M12 models output on pin 2 WH)"
      }
    ],
    "indicators": [
      {
        "name": "yellow LED (1 LED cable models, 4 LEDs M12 models)",
        "state": "on",
        "meaning": "Output energized"
      },
      {
        "name": "yellow LED",
        "state": "off",
        "meaning": "Output not energized"
      }
    ],
    "faults": [
      {
        "title": "No sensor supply",
        "symptom": "Sensor LED never lights and the PLC input never turns on.",
        "causes": [
          "Supply off or blown",
          "Cable / M12 connector open",
          "BN and BU reversed (reverse-polarity protected: the sensor stays off)"
        ],
        "confirm": [
          "Measure BN (+) to BU (-) at the sensor connector: must be 10-30 VDC."
        ],
        "fix": [
          "Restore the 10-30 VDC supply and the cable; wire brown to + and blue to -."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (PN Series Specifications and wiring diagrams, p. tSEN-338)"
      },
      {
        "title": "Output short-circuited or overloaded",
        "symptom": "Yellow LED follows the target but the load / input does not turn on.",
        "causes": [
          "Short from BK to + or load above 100 mA: pulsed short-circuit protection holds the output off"
        ],
        "confirm": [
          "With the target present measure BK to BU: well above 2.5 V while the LED is on means the output is not conducting."
        ],
        "fix": [
          "Remove the short; keep the load at or below 100 mA."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (PN Series Specifications and wiring diagrams, p. tSEN-338)"
      },
      {
        "title": "NPN sensor on a sinking-wired PLC input",
        "symptom": "Sensor LED lights but the CLICK X LED stays off.",
        "causes": [
          "Input group common (C1/C2) wired to 0 V (PNP wiring); an NPN sensor needs the common on +24 V"
        ],
        "confirm": [
          "Measure C1 to supply 0 V: about 0 V shows it is wired for PNP sensors; X1 to C1 reads about 0 V with the sensor ON."
        ],
        "fix": [
          "Wire the common to supply + for NPN sensors (or use a PNP sensor on that group)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M: DC Input Wiring Methods p.3-31; 3-Wire Sensors p.3-47)"
      },
      {
        "title": "Target not detected (distance)",
        "symptom": "Yellow LED does not light when the target passes.",
        "causes": [
          "Target beyond the operating distance (M18 flush 0-6.48 mm, non-flush 0-9.72 mm)"
        ],
        "confirm": [
          "Measure the gap to the target."
        ],
        "fix": [
          "Bring the target inside the operating distance."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (PN Series Specifications and wiring diagrams, p. tSEN-338)"
      },
      {
        "title": "N.C. sensor with a 3-wire cable",
        "symptom": "N.C. model never switches.",
        "causes": [
          "N.C. output on pin 2 (white) not carried by an M12 3-conductor cable"
        ],
        "confirm": [
          "Check the cordset for pin 2."
        ],
        "fix": [
          "Use an M12 4-conductor cable for normally closed units."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (Wiring diagrams note, p. tSEN-338)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/prox18mmpnk.pdf (PN Series Specifications and wiring diagrams, p. tSEN-338)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK manual p.3-31, 3-47)"
    ]
  },
  {
    "id": "ad-c18-photoelectric",
    "title": "AutomationDirect C18 photoelectric sensor, 4-wire PNP/NPN complementary outputs",
    "match": {
      "categories": [
        "sensor"
      ],
      "partNumber": "^C18[A-Z]-"
    },
    "normal": [
      {
        "terminals": "BN (+, pin 1) to BU (-, pin 3)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-36 VDC; ripple <= 20%; no-load current 20 mA (diffuse)",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (out, pin 4) to BU (-) - PNP model",
        "state": "diffuse: target reflecting (light-on output, N.O.)",
        "meter": "VDC",
        "expected": "about supply minus <= 2.0 V voltage drop; load <= 200 mA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "WH (out, pin 2) to BU (-) - PNP model",
        "state": "diffuse: target reflecting (dark-on output, N.C.)",
        "meter": "VDC",
        "expected": "about 0 V (leakage <= 10 uA)",
        "pins": [
          [
            "WH",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (out, pin 4) to BU (-) - NPN model",
        "state": "diffuse: target reflecting",
        "meter": "VDC",
        "expected": "<= 2.0 V (output pulled to 0 V)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "BN",
        "b": "BK",
        "when": "target reflecting (diffuse, PNP models)",
        "note": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf p.tSEN-59 wiring diagrams 1-4 (pin 4 BK N.O., pin 2 WH N.C. on 4-wire models) and Switching Element Function table (diffuse models: light-on = N.O., dark-on = N.C.)"
      },
      {
        "a": "BN",
        "b": "WH",
        "when": "no target (diffuse, PNP 4-wire models)",
        "note": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf p.tSEN-59 wiring diagrams 1-4 (pin 4 BK N.O., pin 2 WH N.C. on 4-wire models) and Switching Element Function table (diffuse models: light-on = N.O., dark-on = N.C.)"
      },
      {
        "a": "BK",
        "b": "BU",
        "when": "target reflecting (diffuse, NPN models)",
        "note": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf p.tSEN-59 wiring diagrams 1-4 (pin 4 BK N.O., pin 2 WH N.C. on 4-wire models) and Switching Element Function table (diffuse models: light-on = N.O., dark-on = N.C.)"
      },
      {
        "a": "WH",
        "b": "BU",
        "when": "no target (diffuse, NPN 4-wire models)",
        "note": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf p.tSEN-59 wiring diagrams 1-4 (pin 4 BK N.O., pin 2 WH N.C. on 4-wire models) and Switching Element Function table (diffuse models: light-on = N.O., dark-on = N.C.)"
      }
    ],
    "indicators": [
      {
        "name": "yellow LED",
        "state": "on",
        "meaning": "Output state: output energized"
      },
      {
        "name": "green LED",
        "state": "on",
        "meaning": "Excess light indication (enough received light)"
      },
      {
        "name": "green LED",
        "state": "off",
        "meaning": "Received light marginal or absent"
      }
    ],
    "faults": [
      {
        "title": "No sensor supply",
        "symptom": "No LEDs, outputs never switch.",
        "causes": [
          "Supply missing / cable open / reverse wiring"
        ],
        "confirm": [
          "Measure BN to BU: must be 10-36 VDC."
        ],
        "fix": [
          "Restore supply and cable."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf (C18 Series specifications, wiring diagrams 3/4 and switching element function, p. tSEN-59)"
      },
      {
        "title": "Output overloaded or shorted",
        "symptom": "Yellow LED follows the target but the load / input is not driven.",
        "causes": [
          "Load > 200 mA or short on the output; short-circuit protection switches the output off and auto-resets after the overload is removed"
        ],
        "confirm": [
          "Measure the output to BU with the yellow LED on (PNP: should be near supply; NPN: <= 2 V)."
        ],
        "fix": [
          "Remove the overload/short; the switch auto-resets."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf (C18 Series specifications, wiring diagrams 3/4 and switching element function, p. tSEN-59)"
      },
      {
        "title": "Wrong output wire used (light-on vs dark-on)",
        "symptom": "PLC input logic is inverted relative to the target.",
        "causes": [
          "For diffuse models black (pin 4) is N.O. = light-on, white (pin 2) is N.C. = dark-on; through-beam/reflective are the reverse"
        ],
        "confirm": [
          "Measure BK and WH to BU with and without the target."
        ],
        "fix": [
          "Move the PLC input to the other output wire or invert in logic."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf (C18 Series specifications, wiring diagrams 3/4 and switching element function, p. tSEN-59)"
      },
      {
        "title": "Unreliable detection",
        "symptom": "Output chatters; green LED off or flickering with the target present.",
        "causes": [
          "Target beyond 600 mm (diffuse, 200x200 mm white matte paper reference)",
          "Sensitivity set too low"
        ],
        "confirm": [
          "Watch the green excess-light LED with the target in place."
        ],
        "fix": [
          "Adjust the one-turn sensitivity potentiometer (diffuse models); bring the target within range."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf (C18 Series specifications, wiring diagrams 3/4 and switching element function, p. tSEN-59)"
      },
      {
        "title": "Output not valid right after power-up",
        "symptom": "Input pulses / wrong state at power-on.",
        "causes": [
          "Time delay before availability: 60 ms (diffuse)"
        ],
        "confirm": [
          "Observe the output in the first 60 ms after power-up."
        ],
        "fix": [
          "Ignore the input for the first 60 ms after power-up in logic."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf (C18 Series specifications, wiring diagrams 3/4 and switching element function, p. tSEN-59)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/pe18mmc18.pdf (C18 Series specifications, wiring diagrams 3/4 and switching element function, p. tSEN-59)"
    ]
  },
  {
    "id": "ad-uk1-ultrasonic",
    "title": "AutomationDirect UK1 M18 ultrasonic sensors (discrete / 0-10 V / 4-20 mA)",
    "match": {
      "categories": [
        "sensor"
      ],
      "family": "UK1",
      "ratings": {
        "type": "ultrasonic"
      }
    },
    "normal": [
      {
        "terminals": "BN/1 (+) to BU/3 (-)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC, ripple 5%; no-load current <= 50 mA",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "analog out (WH/2 on PNP + analog models) to BU/3 (-)",
        "state": "target between the taught points P1 and P2",
        "meter": "mA",
        "expected": "4-20 mA proportional to distance (max load 500 ohm at 24 VDC); 0-10 V models: 0-10 V (min load 3 k ohm)",
        "pins": [
          [
            "WH",
            "BU"
          ]
        ],
        "note": "Slope set by teach order: P1 > P2 positive slope, P1 < P2 negative slope."
      },
      {
        "terminals": "BK/4 (digital out) to BU/3 (-)",
        "state": "PNP output ON",
        "meter": "VDC",
        "expected": "supply minus <= 2.2 V at 100 mA; leakage 10 uA @ 30 VDC when OFF",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "target distance",
        "state": "normal operation",
        "meter": "visual",
        "expected": "within the sensing range: UK1A 50-400 mm, UK1C 80-900 mm, UK1D 150-1600 mm, UK1F 200-2200 mm (minimum sensing distance = blind zone)"
      }
    ],
    "pairs": [
      {
        "a": "BN",
        "b": "BK",
        "when": "digital output ON (PNP models)",
        "note": "https://cdn.automationdirect.com/static/manuals/sensors/uk1_single_digital_output.pdf / uk1_mixed_analog_output.pdf wiring: BN/1 +, BK/4 digital out, BU/3 -; output N.O./N.C. selectable"
      },
      {
        "a": "BK",
        "b": "BU",
        "when": "digital output ON (NPN models)",
        "note": "https://cdn.automationdirect.com/static/manuals/sensors/uk1_single_digital_output.pdf NPN wiring: BK/4 digital out to BU/3 -"
      },
      {
        "a": "BN",
        "b": "WH",
        "when": "second digital output ON (PNP double-output models)",
        "note": "https://cdn.automationdirect.com/static/manuals/sensors/uk1_double_digital_output.pdf wiring: WH/2 and BK/4 digital outputs (PNP)"
      }
    ],
    "indicators": [
      {
        "name": "LD3 (green)",
        "state": "on",
        "meaning": "Echo received"
      },
      {
        "name": "LD1 / LD2 (yellow)",
        "state": "on",
        "meaning": "Output state"
      },
      {
        "name": "LD1, LD2 (yellow)",
        "state": "blinking alternately 10 Hz",
        "meaning": "Teach button held > 12 s: enable/disable teach button (3 blinks at 3.5 Hz confirm)"
      },
      {
        "name": "LD1 and LD2 (yellow)",
        "state": "5 blinks at 3.5 Hz",
        "meaning": "Restore of SP1/SP2 to defaults succeeded"
      },
      {
        "name": "LD3 (green)",
        "state": "5 blinks at 3.5 Hz",
        "meaning": "Full restore of factory calibration succeeded"
      },
      {
        "name": "LD3 (green) in configuration identification",
        "state": "on / off",
        "meaning": "NC logic / NO logic"
      }
    ],
    "faults": [
      {
        "title": "Teach not accepted",
        "symptom": "No LED blinking after pressing the teach button with the target placed.",
        "causes": [
          "Teaching under or over the limit of the sensing range is not allowed"
        ],
        "confirm": [
          "Measure the target distance against the model range (e.g. UK1A 50-400 mm)."
        ],
        "fix": [
          "Place the target inside the sensing range and repeat the teach."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sensors/uk1_mixed_analog_output.pdf (UK1 installation manual CAT8EUK1995901 (PNP + analog)); https://cdn.automationdirect.com/static/manuals/sensors/uk1_single_digital_output.pdf (UK1 installation manual CAT8EUK1995801 (single digital))"
      },
      {
        "title": "Target inside the blind zone",
        "symptom": "Output / analog value wrong when the target is very close.",
        "causes": [
          "Target closer than the minimum sensing distance (UK1A 50, UK1C 80, UK1D 150, UK1F 200 mm)"
        ],
        "confirm": [
          "Measure the face-to-target distance."
        ],
        "fix": [
          "Mount the sensor so the nearest target position is beyond the minimum sensing distance."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sensors/uk1_mixed_analog_output.pdf (UK1 installation manual CAT8EUK1995901 (PNP + analog)); https://cdn.automationdirect.com/static/manuals/sensors/uk1_single_digital_output.pdf (UK1 installation manual CAT8EUK1995801 (single digital))"
      },
      {
        "title": "No echo",
        "symptom": "Green LD3 off with the target in front of the sensor.",
        "causes": [
          "Target outside range or outside the beam (beam angle UK1A/C 10 +/-2 deg, UK1D 7, UK1F 8 deg)"
        ],
        "confirm": [
          "Observe LD3 while moving the target into the beam axis."
        ],
        "fix": [
          "Bring the target within range and beam angle."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/ultra18mmuk1plastic.pdf (UK1 specifications and wiring, p. tSEN-413); https://cdn.automationdirect.com/static/specs/ultra18mmuk1metal.pdf (UK1 metal specifications)"
      },
      {
        "title": "Teach button does nothing",
        "symptom": "Pressing the teach button has no effect.",
        "causes": [
          "Teach button locked (teach block)"
        ],
        "confirm": [
          "Hold the button > 12 s: LD1/LD2 blink alternately at 10 Hz."
        ],
        "fix": [
          "Release to toggle the lock; LD1/LD2 blink 3 times at 3.5 Hz to confirm."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sensors/uk1_mixed_analog_output.pdf (UK1 installation manual CAT8EUK1995901 (PNP + analog)); https://cdn.automationdirect.com/static/manuals/sensors/uk1_single_digital_output.pdf (UK1 installation manual CAT8EUK1995801 (single digital))"
      },
      {
        "title": "Analog signal does not reach full scale",
        "symptom": "4-20 mA output stops short of 20 mA, or 0-10 V output is low.",
        "causes": [
          "Current loop load > 500 ohm at 24 VDC",
          "Voltage output load < 3 k ohm"
        ],
        "confirm": [
          "Measure the loop resistance / load resistance with power off."
        ],
        "fix": [
          "Keep current loads <= 500 ohm (24 VDC supply) and voltage loads >= 3 k ohm."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/ultra18mmuk1plastic.pdf (UK1 specifications and wiring, p. tSEN-413); https://cdn.automationdirect.com/static/specs/ultra18mmuk1metal.pdf (UK1 metal specifications)"
      },
      {
        "title": "Distance drifts after power-up",
        "symptom": "Analog value drifts during the first minutes.",
        "causes": [
          "Temperature warm-up drift after power-up"
        ],
        "confirm": [
          "Compare readings at power-up and after 20 minutes."
        ],
        "fix": [
          "Allow 20 minutes for the sensing distance to stabilise."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sensors/uk1_mixed_analog_output.pdf (UK1 installation manual CAT8EUK1995901 (PNP + analog)); https://cdn.automationdirect.com/static/manuals/sensors/uk1_single_digital_output.pdf (UK1 installation manual CAT8EUK1995801 (single digital))"
      },
      {
        "title": "Several sensors interfere",
        "symptom": "Erratic readings when several UK1 sensors face the same area.",
        "causes": [
          "Cross-talk between unsynchronised sensors"
        ],
        "confirm": [
          "Disconnect neighbouring sensors and see if readings stabilise."
        ],
        "fix": [
          "Connect the sync pins (GY/5 or WH/2 SYNC) of all sensors together and power on (synchronisation), or tie them to GND at power-up for multiplexing."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/sensors/uk1_mixed_analog_output.pdf (UK1 installation manual CAT8EUK1995901 (PNP + analog)); https://cdn.automationdirect.com/static/manuals/sensors/uk1_single_digital_output.pdf (UK1 installation manual CAT8EUK1995801 (single digital))"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/ultra18mmuk1plastic.pdf (UK1 specifications and wiring, p. tSEN-413); https://cdn.automationdirect.com/static/specs/ultra18mmuk1metal.pdf (UK1 metal specifications)",
      "https://cdn.automationdirect.com/static/manuals/sensors/uk1_mixed_analog_output.pdf (UK1 installation manual CAT8EUK1995901 (PNP + analog)); https://cdn.automationdirect.com/static/manuals/sensors/uk1_single_digital_output.pdf (UK1 installation manual CAT8EUK1995801 (single digital))"
    ]
  },
  {
    "id": "ad-uk6-ultrasonic",
    "title": "AutomationDirect UK6 short-body M18 ultrasonic sensors",
    "match": {
      "categories": [
        "sensor"
      ],
      "family": "UK6",
      "ratings": {
        "type": "ultrasonic"
      }
    },
    "normal": [
      {
        "terminals": "BN (+) to BU (-)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC, ripple 5%; no-load current <= 35 mA",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (out) to BU (-)",
        "state": "analog models, target in window",
        "meter": "mA",
        "expected": "4-20 mA (max load 500 ohm @ 24 VDC) or 0-10 V (min load 3 k ohm)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "BK (out) to BU (-)",
        "state": "PNP digital output ON",
        "meter": "VDC",
        "expected": "supply minus <= 2.2 V at 100 mA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "WH (teach wire)",
        "state": "normal operation",
        "meter": "visual",
        "expected": "open (not connected) = normal operation; tied to BN (PNP) / BU (NPN) only while teaching",
        "note": "Per the UK6 wiring diagram legend: + Teach & N.O. / - N.C. / Open = Normal Operation."
      },
      {
        "terminals": "target distance",
        "state": "normal operation",
        "meter": "visual",
        "expected": "UK6A 40-300 mm (blind zone 40 mm); UK6C 60-800 mm (blind zone 60 mm)"
      }
    ],
    "pairs": [
      {
        "a": "BN",
        "b": "BK",
        "when": "digital output ON (PNP models)",
        "note": "https://cdn.automationdirect.com/static/specs/prox18mmultrauk6.pdf PNP output wiring diagram (BN +, BK out, BU -); N.O./N.C. selectable"
      },
      {
        "a": "BK",
        "b": "BU",
        "when": "digital output ON (NPN models)",
        "note": "https://cdn.automationdirect.com/static/specs/prox18mmultrauk6.pdf NPN output wiring diagram"
      }
    ],
    "indicators": [
      {
        "name": "orange/yellow LED (A)",
        "state": "on",
        "meaning": "Output state: target is in the window"
      },
      {
        "name": "green LED (C)",
        "state": "on",
        "meaning": "Echo received"
      },
      {
        "name": "orange LED",
        "state": "2 blinks during teach",
        "meaning": "Teach error condition: sensor keeps the last values in memory; repeat the teach correctly"
      }
    ],
    "faults": [
      {
        "title": "Teach error",
        "symptom": "Orange LED blinks two times during teach.",
        "causes": [
          "Invalid P2 acquisition during teach (P1 = far point is taught first, then P2 = close point)"
        ],
        "confirm": [
          "Observe the orange LED during teach."
        ],
        "fix": [
          "Repeat the teach operation correctly; the sensor keeps the last values in memory."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmultrauk6.pdf (UK6 specifications p. tSEN-416/417); https://cdn.automationdirect.com/static/manuals/sensors/uk6_insert.pdf (UK6 installation manual CAT8BUK1465902)"
      },
      {
        "title": "Target inside the blind zone",
        "symptom": "Wrong output with the target close.",
        "causes": [
          "Target closer than 40 mm (UK6A) / 60 mm (UK6C)"
        ],
        "confirm": [
          "Measure the target distance."
        ],
        "fix": [
          "Mount the sensor so the target stays beyond the blind zone."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmultrauk6.pdf (UK6 specifications p. tSEN-416/417); https://cdn.automationdirect.com/static/manuals/sensors/uk6_insert.pdf (UK6 installation manual CAT8BUK1465902)"
      },
      {
        "title": "Teach wire left connected",
        "symptom": "Sensor keeps entering teach / output never normal.",
        "causes": [
          "White teach wire tied to the teach level permanently"
        ],
        "confirm": [
          "Check WH wiring: for teach it is connected to BN (PNP) or BU (NPN) per the manual; otherwise per normal-operation diagram."
        ],
        "fix": [
          "Wire WH as shown for normal operation after teaching."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmultrauk6.pdf (UK6 specifications p. tSEN-416/417); https://cdn.automationdirect.com/static/manuals/sensors/uk6_insert.pdf (UK6 installation manual CAT8BUK1465902)"
      },
      {
        "title": "No echo",
        "symptom": "Green LED off with target present.",
        "causes": [
          "Target out of range or beam"
        ],
        "confirm": [
          "Observe green LED while moving target."
        ],
        "fix": [
          "Bring target within the sensing range and beam angle (UK6A +/-10 deg, UK6C +/-8 deg)."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/prox18mmultrauk6.pdf (UK6 specifications p. tSEN-416/417); https://cdn.automationdirect.com/static/manuals/sensors/uk6_insert.pdf (UK6 installation manual CAT8BUK1465902)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/prox18mmultrauk6.pdf (UK6 specifications p. tSEN-416/417); https://cdn.automationdirect.com/static/manuals/sensors/uk6_insert.pdf (UK6 installation manual CAT8BUK1465902)"
    ]
  },
  {
    "id": "pf-ub-ultrasonic-analog",
    "title": "Pepperl+Fuchs UB...-18GM ultrasonic sensors, analog 4-20 mA / 0-10 V",
    "match": {
      "categories": [
        "sensor"
      ],
      "manufacturer": "pepperl",
      "partNumber": "^UB\\d+-18GM\\d+-[IU]-"
    },
    "normal": [
      {
        "terminals": "1 BN (+UB) to 3 BU (-UB)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC (I models) / 15-30 VDC (U models), ripple 10%",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "4 BK (analog out) to 3 BU",
        "state": "object between evaluation limits A1 and A2",
        "meter": "mA",
        "expected": "4-20 mA into 0-300 ohm (I models); 0-10 V into > 1 k ohm (U models); rising ramp if A1 < A2, falling if A2 < A1",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ],
        "note": "Defaults: UB300 A1 50 / A2 300 mm; UB800 A1 70 / A2 800 mm."
      },
      {
        "terminals": "target distance",
        "state": "normal operation",
        "meter": "visual",
        "expected": "sensing range UB300 35-300 mm (dead band 0-35); UB800 50-800 mm (dead band 0-50); UB500-18GM75 30-500 mm (dead band 0-30)"
      },
      {
        "terminals": "2 WH (teach input)",
        "state": "normal operation",
        "meter": "VDC",
        "expected": "not applied: -UB (A1) / +UB (A2) for >= 1 s only when teaching"
      }
    ],
    "indicators": [
      {
        "name": "LED green (UB300/UB800-18GM40)",
        "state": "on",
        "meaning": "Power on"
      },
      {
        "name": "LED yellow",
        "state": "on",
        "meaning": "Object in the evaluation range"
      },
      {
        "name": "LED yellow",
        "state": "flashing",
        "meaning": "Program function, object detected"
      },
      {
        "name": "LED red",
        "state": "on",
        "meaning": "Error"
      },
      {
        "name": "LED red",
        "state": "flashing",
        "meaning": "Program function, object not detected"
      }
    ],
    "faults": [
      {
        "title": "Object in the dead band",
        "symptom": "Analog value wrong / red LED when the object is very close.",
        "causes": [
          "Object closer than the dead band (UB300 35 mm, UB800 50 mm, UB500 30 mm)"
        ],
        "confirm": [
          "Measure the face-to-object distance."
        ],
        "fix": [
          "Mount so the object stays beyond the dead band."
        ],
        "source": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220360_eng.pdf (UB300-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220365_eng.pdf (UB300-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205340_eng.pdf (UB800-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205336_eng.pdf (UB800-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133054_eng.pdf (UB500-18GM75-I-V15); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133055_eng.pdf (UB500-18GM75-U-V15)"
      },
      {
        "title": "Teach ignored (time lock)",
        "symptom": "Applying -UB/+UB to the teach input does not change the limits.",
        "causes": [
          "A time lock blocks changes 5 minutes after power on"
        ],
        "confirm": [
          "Check how long the sensor has been powered."
        ],
        "fix": [
          "Power the sensor off and on, then teach within 5 minutes."
        ],
        "source": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220360_eng.pdf (UB300-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220365_eng.pdf (UB300-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205340_eng.pdf (UB800-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205336_eng.pdf (UB800-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133054_eng.pdf (UB500-18GM75-I-V15); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133055_eng.pdf (UB500-18GM75-U-V15)"
      },
      {
        "title": "Teach sees no object",
        "symptom": "Red LED flashes during teach.",
        "causes": [
          "Program function, object not detected (object outside range / beam)"
        ],
        "confirm": [
          "Observe red LED flashing while applying the teach level."
        ],
        "fix": [
          "Place the target inside the sensing range and repeat."
        ],
        "source": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220360_eng.pdf (UB300-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220365_eng.pdf (UB300-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205340_eng.pdf (UB800-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205336_eng.pdf (UB800-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133054_eng.pdf (UB500-18GM75-I-V15); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133055_eng.pdf (UB500-18GM75-U-V15)"
      },
      {
        "title": "Analog output cannot reach full scale",
        "symptom": "Current stays below 20 mA / voltage below 10 V.",
        "causes": [
          "Load > 300 ohm (I) or < 1 k ohm (U)",
          "U model supplied below 15 VDC"
        ],
        "confirm": [
          "Measure load resistance and supply."
        ],
        "fix": [
          "Correct the load; supply U models with 15-30 VDC."
        ],
        "source": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220360_eng.pdf (UB300-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220365_eng.pdf (UB300-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205340_eng.pdf (UB800-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205336_eng.pdf (UB800-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133054_eng.pdf (UB500-18GM75-I-V15); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133055_eng.pdf (UB500-18GM75-U-V15)"
      }
    ],
    "sources": [
      "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220360_eng.pdf (UB300-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220365_eng.pdf (UB300-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205340_eng.pdf (UB800-18GM40-I-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/205336_eng.pdf (UB800-18GM40-U-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133054_eng.pdf (UB500-18GM75-I-V15); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/133055_eng.pdf (UB500-18GM75-U-V15)"
    ]
  },
  {
    "id": "pf-ub300-ultrasonic-switching",
    "title": "Pepperl+Fuchs UB300-18GM40-E4/E5 ultrasonic sensor, switching output",
    "match": {
      "categories": [
        "sensor"
      ],
      "manufacturer": "pepperl",
      "partNumber": "^UB300-18GM40-E[45]-"
    },
    "normal": [
      {
        "terminals": "1 BN (+UB) to 3 BU (-UB)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC, ripple 10%",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "4 BK (switch out) to 3 BU",
        "state": "E5 (PNP), output ON",
        "meter": "VDC",
        "expected": "supply minus <= 3 V; rated 200 mA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "4 BK (switch out) to 3 BU",
        "state": "E4 (NPN), output ON",
        "meter": "VDC",
        "expected": "<= 3 V (output pulled to -UB)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "target distance",
        "state": "normal",
        "meter": "visual",
        "expected": "sensing range 35-300 mm, dead band 0-35 mm; default switch points A1 50 mm, A2 300 mm"
      }
    ],
    "pairs": [
      {
        "a": "BN",
        "b": "BK",
        "when": "switch output ON (E5, PNP)",
        "note": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220357_eng.pdf connection: 1 BN +UB, 4 BK switch output (E5 pnp)"
      },
      {
        "a": "BK",
        "b": "BU",
        "when": "switch output ON (E4, NPN)",
        "note": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220356_eng.pdf connection: 4 BK switch output, 3 BU -UB (E4 npn)"
      }
    ],
    "indicators": [
      {
        "name": "LED green",
        "state": "on",
        "meaning": "Power on"
      },
      {
        "name": "LED yellow",
        "state": "on/off",
        "meaning": "Switching state (normal operation)"
      },
      {
        "name": "LED red",
        "state": "on",
        "meaning": "Fault (yellow shows previous state) / object uncertain during teach"
      },
      {
        "name": "LED red",
        "state": "flashing",
        "meaning": "Teach: no object detected"
      },
      {
        "name": "LED yellow",
        "state": "flashing",
        "meaning": "Teach: object detected"
      }
    ],
    "faults": [
      {
        "title": "Teach-in invalid",
        "symptom": "Red LED on during teach.",
        "causes": [
          "Object uncertain (TEACH-IN invalid)"
        ],
        "confirm": [
          "Observe LEDs during teach (red on, yellow off)."
        ],
        "fix": [
          "Reposition the object inside 35-300 mm and teach again within 5 minutes of power on."
        ],
        "source": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220357_eng.pdf (UB300-18GM40-E5-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220356_eng.pdf (UB300-18GM40-E4-V1)"
      },
      {
        "title": "Sensor fault",
        "symptom": "Red LED on in normal operation; yellow holds the previous state.",
        "causes": [
          "Sensor fault"
        ],
        "confirm": [
          "Observe the red LED."
        ],
        "fix": [
          "Power cycle; replace the sensor if the fault persists."
        ],
        "source": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220357_eng.pdf (UB300-18GM40-E5-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220356_eng.pdf (UB300-18GM40-E4-V1)"
      },
      {
        "title": "Output overloaded / short-circuited",
        "symptom": "Yellow LED switches but the load is not driven.",
        "causes": [
          "Load above 200 mA or shorted (output protected)"
        ],
        "confirm": [
          "Measure BK to BU with the output on."
        ],
        "fix": [
          "Remove the short / reduce the load to <= 200 mA."
        ],
        "source": "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220357_eng.pdf (UB300-18GM40-E5-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220356_eng.pdf (UB300-18GM40-E4-V1)"
      }
    ],
    "sources": [
      "https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220357_eng.pdf (UB300-18GM40-E5-V1); https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/220356_eng.pdf (UB300-18GM40-E4-V1)"
    ]
  },
  {
    "id": "banner-t30ux-analog",
    "title": "Banner U-GAGE T30UX ultrasonic sensor, analog output",
    "match": {
      "categories": [
        "sensor"
      ],
      "manufacturer": "banner",
      "partNumber": "^T30UX[UI]"
    },
    "normal": [
      {
        "terminals": "bn (1, +) to bu (3, -)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC (10% max ripple) at 40 mA",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "bk (4, analog out) to bu (3)",
        "state": "target in taught window",
        "meter": "mA",
        "expected": "4-20 mA (tracks 3.8-20.5 mA slightly past the limits); 0-10 V on U models",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "bk (4) to bu (3)",
        "state": "signal lost > 2 s",
        "meter": "mA",
        "expected": "3.6 mA (I models) / 0 V (U models)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "target distance",
        "state": "normal",
        "meter": "visual",
        "expected": "A models 100 mm-1 m, B 200 mm-2 m, C 300 mm-3 m; dead zone 10% of max range"
      }
    ],
    "indicators": [
      {
        "name": "Power LED (green)",
        "state": "on",
        "meaning": "Run mode (normal operation)"
      },
      {
        "name": "Signal LED (red)",
        "state": "on",
        "meaning": "Target in view / signal strength"
      },
      {
        "name": "Signal LED (red)",
        "state": "off",
        "meaning": "No signal"
      },
      {
        "name": "Output LED (amber)",
        "state": "on",
        "meaning": "Output enabled and target within the window limits"
      },
      {
        "name": "Mode LED (amber)",
        "state": "on",
        "meaning": "Selected response mode (fast/slow)"
      }
    ],
    "faults": [
      {
        "title": "Loss of echo",
        "symptom": "Analog output drops to 3.6 mA / 0 V.",
        "causes": [
          "No received signal for more than 2 seconds (target out of range or beam, absorbing / angled target)"
        ],
        "confirm": [
          "Measure bk to bu: 3.6 mA (or 0 V) confirms the loss-of-signal state; Signal LED off."
        ],
        "fix": [
          "Bring the target into range; use the 3.6 mA level as an alarm in the PLC."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257921.pdf (T30UX Series with Analog Output Product Manual: Overview p.4, Wiring p.5, Analog Output / Teach p.6-9, Specifications p.11)"
      },
      {
        "title": "Teach not accepted",
        "symptom": "Output LED flashes / Power LED off after a teach step.",
        "causes": [
          "No signal present while teaching (Signal LED must be ON red or flashing)"
        ],
        "confirm": [
          "Check the Signal LED is lit with the target in place."
        ],
        "fix": [
          "Position the target in view and repeat; TEACH times out after 120 s."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257921.pdf (T30UX Series with Analog Output Product Manual: Overview p.4, Wiring p.5, Analog Output / Teach p.6-9, Specifications p.11)"
      },
      {
        "title": "Analog output cannot reach full scale",
        "symptom": "Current < 20 mA or voltage < 10 V at the far limit.",
        "causes": [
          "Current loop resistance above (Vcc-4)/0.02 ohm (1 k ohm at 24 V)",
          "Voltage model supplied below 12 VDC or load < 2.5 k ohm"
        ],
        "confirm": [
          "Measure supply and load resistance."
        ],
        "fix": [
          "Correct load / supply (>= 12 VDC for a full 10 V output)."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257921.pdf (T30UX Series with Analog Output Product Manual: Overview p.4, Wiring p.5, Analog Output / Teach p.6-9, Specifications p.11)"
      },
      {
        "title": "Distance shifts with temperature / sunlight",
        "symptom": "Window limits move.",
        "causes": [
          "Direct sunlight or a temperature gradient defeats the temperature compensation"
        ],
        "confirm": [
          "Compare readings shaded vs in sunlight."
        ],
        "fix": [
          "Shade the sensor; avoid measuring across temperature gradients."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257921.pdf (T30UX Series with Analog Output Product Manual: Overview p.4, Wiring p.5, Analog Output / Teach p.6-9, Specifications p.11)"
      }
    ],
    "sources": [
      "https://info.bannerengineering.com/cs/groups/public/documents/literature/257921.pdf (T30UX Series with Analog Output Product Manual: Overview p.4, Wiring p.5, Analog Output / Teach p.6-9, Specifications p.11)"
    ]
  },
  {
    "id": "banner-t30ux-discrete",
    "title": "Banner U-GAGE T30UX ultrasonic sensor, discrete NPN/PNP output",
    "match": {
      "categories": [
        "sensor"
      ],
      "manufacturer": "banner",
      "partNumber": "^T30UXD"
    },
    "normal": [
      {
        "terminals": "bn (1, +) to bu (3, -)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC (10% max ripple) per specifications (wiring diagram shows 12-30 VDC)",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "bk (4, out) to bu (3)",
        "state": "PNP selected, output ON",
        "meter": "VDC",
        "expected": "supply minus < 3 V at 100 mA; OFF leakage < 10 uA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "bk (4, out) to bu (3)",
        "state": "NPN selected, output ON",
        "meter": "VDC",
        "expected": "< 1.6 V at 100 mA; OFF leakage < 200 uA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "BN",
        "b": "BK",
        "when": "output ON (PNP selected)",
        "note": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257922.pdf wiring: PNP (sourcing) output selected, load bk (4) to -"
      },
      {
        "a": "BK",
        "b": "BU",
        "when": "output ON (NPN selected)",
        "note": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257922.pdf wiring: NPN (sinking) output selected, load + to bk (4)"
      }
    ],
    "indicators": [
      {
        "name": "Power LED (green)",
        "state": "on",
        "meaning": "Run mode"
      },
      {
        "name": "Signal LED (red)",
        "state": "on",
        "meaning": "Target signal strength / target in view"
      },
      {
        "name": "Output LED (amber)",
        "state": "on",
        "meaning": "Output enabled, target within window"
      },
      {
        "name": "Mode LED (amber)",
        "state": "on",
        "meaning": "Selected mode (output type NPN/PNP, NO/NC)"
      }
    ],
    "faults": [
      {
        "title": "Output type does not match the PLC input",
        "symptom": "Output LED on but PLC input off.",
        "causes": [
          "Output configured NPN on a sinking-wired input, or PNP on a sourcing-wired input (default PNP/NO)"
        ],
        "confirm": [
          "Measure bk to bu with the output LED on: near supply = PNP, < 1.6 V = NPN."
        ],
        "fix": [
          "Select the output type that matches the input wiring in the mode setup."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257922.pdf (T30UX Series with Discrete Output Product Manual: Overview, Wiring, Output configuration, Specifications)"
      },
      {
        "title": "Output overloaded",
        "symptom": "Load not driven.",
        "causes": [
          "Load above 100 mA"
        ],
        "confirm": [
          "Measure the load current."
        ],
        "fix": [
          "Keep the load <= 100 mA."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257922.pdf (T30UX Series with Discrete Output Product Manual: Overview, Wiring, Output configuration, Specifications)"
      },
      {
        "title": "No target signal",
        "symptom": "Signal LED off, output never switches.",
        "causes": [
          "Target outside 100 mm-1 m / 200 mm-2 m / 300 mm-3 m or in the dead zone"
        ],
        "confirm": [
          "Observe the Signal LED while moving the target."
        ],
        "fix": [
          "Bring the target into range."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/257922.pdf (T30UX Series with Discrete Output Product Manual: Overview, Wiring, Output configuration, Specifications)"
      }
    ],
    "sources": [
      "https://info.bannerengineering.com/cs/groups/public/documents/literature/257922.pdf (T30UX Series with Discrete Output Product Manual: Overview, Wiring, Output configuration, Specifications)"
    ]
  },
  {
    "id": "banner-s18u-analog",
    "title": "Banner U-GAGE S18U ultrasonic sensor, analog output",
    "match": {
      "categories": [
        "sensor"
      ],
      "manufacturer": "banner",
      "partNumber": "^S18U"
    },
    "normal": [
      {
        "terminals": "bn (+) to bu (-)",
        "state": "powered",
        "meter": "VDC",
        "expected": "10-30 VDC (10% max ripple)",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "wh (analog out) to bu",
        "state": "target in window",
        "meter": "mA",
        "expected": "4-20 mA (max load (Vcc-4)/0.02 ohm, 1 k ohm at 24 V) or 0-10 V (min 2.5 k ohm)",
        "pins": [
          [
            "WH",
            "BU"
          ]
        ]
      },
      {
        "terminals": "wh (analog out) to bu",
        "state": "signal lost",
        "meter": "mA",
        "expected": "3.6 mA (current models) / 0 V (voltage models)",
        "pins": [
          [
            "WH",
            "BU"
          ]
        ]
      },
      {
        "terminals": "bk (speed select) to bu",
        "state": "fast / slow response",
        "meter": "VDC",
        "expected": "5-30 VDC = fast; 0-2 VDC = slow",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "target distance",
        "state": "normal",
        "meter": "visual",
        "expected": "30-300 mm"
      }
    ],
    "indicators": [
      {
        "name": "Power LED",
        "state": "off",
        "meaning": "Power off"
      },
      {
        "name": "Power LED",
        "state": "on red",
        "meaning": "Target weak or outside the sensing range"
      },
      {
        "name": "Power LED",
        "state": "on green",
        "meaning": "Operating normally, target good"
      },
      {
        "name": "Output/Teach LED",
        "state": "off",
        "meaning": "Target outside the window limits"
      },
      {
        "name": "Output/Teach LED",
        "state": "on yellow",
        "meaning": "Target within the window limits"
      },
      {
        "name": "Output/Teach LED",
        "state": "on red",
        "meaning": "TEACH mode, waiting for the first limit"
      },
      {
        "name": "Output/Teach LED",
        "state": "flashing red",
        "meaning": "TEACH mode, waiting for the second limit"
      }
    ],
    "faults": [
      {
        "title": "Loss of signal",
        "symptom": "Output at 3.6 mA / 0 V; Power LED red.",
        "causes": [
          "Target weak or outside 30-300 mm"
        ],
        "confirm": [
          "Measure wh to bu; check Power LED colour."
        ],
        "fix": [
          "Bring the target into range; use the 3.6 mA level as an alarm."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/110738.pdf (S18U Analog Series instructions p/n 110738 Rev. F: Status Indicators, Wiring, Specifications)"
      },
      {
        "title": "Teach fails",
        "symptom": "Limits not learned.",
        "causes": [
          "Power LED not green when the limit was taught"
        ],
        "confirm": [
          "Power LED must be On green when presenting each limit."
        ],
        "fix": [
          "Present a good target (Power LED green) for each limit and repeat."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/110738.pdf (S18U Analog Series instructions p/n 110738 Rev. F: Status Indicators, Wiring, Specifications)"
      }
    ],
    "sources": [
      "https://info.bannerengineering.com/cs/groups/public/documents/literature/110738.pdf (S18U Analog Series instructions p/n 110738 Rev. F: Status Indicators, Wiring, Specifications)"
    ]
  },
  {
    "id": "banner-qs18u-discrete",
    "title": "Banner WORLD-BEAM QS18U ultrasonic sensor, discrete NPN/PNP",
    "match": {
      "categories": [
        "sensor"
      ],
      "manufacturer": "banner",
      "partNumber": "^QS18U"
    },
    "normal": [
      {
        "terminals": "bn (1, +) to bu (3, -)",
        "state": "powered",
        "meter": "VDC",
        "expected": "12-30 VDC (10% max ripple)",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "bk (4, out) to bu (3)",
        "state": "PNP model, target within window (NO)",
        "meter": "VDC",
        "expected": "supply minus < 3.0 V at 100 mA; OFF leakage < 10 uA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "bk (4, out) to bu (3)",
        "state": "NPN model, target within window (NO)",
        "meter": "VDC",
        "expected": "< 1.6 V at 100 mA; OFF leakage < 200 uA",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "target distance",
        "state": "normal",
        "meter": "visual",
        "expected": "50-500 mm"
      }
    ],
    "pairs": [
      {
        "a": "BN",
        "b": "BK",
        "when": "output ON (PNP models)",
        "note": "https://info.bannerengineering.com/cs/groups/public/documents/literature/119287.pdf wiring: PNP (sourcing) output models"
      },
      {
        "a": "BK",
        "b": "BU",
        "when": "output ON (NPN models)",
        "note": "https://info.bannerengineering.com/cs/groups/public/documents/literature/119287.pdf wiring: NPN (sinking) output models"
      }
    ],
    "indicators": [
      {
        "name": "Power LED",
        "state": "on green",
        "meaning": "Target within sensing range"
      },
      {
        "name": "Power LED",
        "state": "on red",
        "meaning": "Target weak or outside the sensing range"
      },
      {
        "name": "Output/Teach LED",
        "state": "on yellow",
        "meaning": "Target within window limits (NO operation)"
      }
    ],
    "faults": [
      {
        "title": "Target weak / out of range",
        "symptom": "Power LED red, output does not switch.",
        "causes": [
          "Target outside 50-500 mm or weak echo"
        ],
        "confirm": [
          "Check Power LED colour."
        ],
        "fix": [
          "Bring the target into range and re-teach with Power LED green."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/119287.pdf (QS18U instructions p/n 119287 Rev. M: Status Indicators, Wiring, Specifications)"
      },
      {
        "title": "Output overloaded",
        "symptom": "Load not driven.",
        "causes": [
          "Load above 100 mA"
        ],
        "confirm": [
          "Measure the load current."
        ],
        "fix": [
          "Keep the load <= 100 mA."
        ],
        "source": "https://info.bannerengineering.com/cs/groups/public/documents/literature/119287.pdf (QS18U instructions p/n 119287 Rev. M: Status Indicators, Wiring, Specifications)"
      }
    ],
    "sources": [
      "https://info.bannerengineering.com/cs/groups/public/documents/literature/119287.pdf (QS18U instructions p/n 119287 Rev. M: Status Indicators, Wiring, Specifications)"
    ]
  },
  {
    "id": "koyo-trd-encoder-open-collector",
    "title": "Koyo TRD incremental encoder, NPN open-collector output (TRD-SR...A)",
    "match": {
      "categories": [
        "encoder"
      ],
      "family": "TRD",
      "ratings": {
        "outputType": "open collector"
      }
    },
    "normal": [
      {
        "terminals": "Brown (power) to Blue (0 V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "5-26 VDC nominal (4.75-26.4 VDC); 90 mA max",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "Black (OUT A) to Blue (0 V)",
        "state": "output ON (L, active low)",
        "meter": "VDC",
        "expected": "<= 0.4 V; sinks max 30 mA; load voltage max 30 VDC",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "Black (OUT A) to Blue (0 V)",
        "state": "output OFF",
        "meter": "VDC",
        "expected": "pulled up to the input / pull-up supply (open collector)",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "White (OUT B), Orange (OUT Z)",
        "state": "turning slowly",
        "meter": "VDC",
        "expected": "B alternates like A, 90 deg shifted; Z once per revolution",
        "pins": [
          [
            "WH",
            "BU"
          ],
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
        "when": "OUT A low (ON)",
        "note": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf p.tECD-55 (TRD-SR/SHR \"A\" models: NPN open collector output, sinking; negative logic, active low; L <= 0.4 V) and p.tECD-56 wiring (Black OUT A, White OUT B, Orange OUT Z, Blue 0V)"
      },
      {
        "a": "WH",
        "b": "BU",
        "when": "OUT B low (ON)",
        "note": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf p.tECD-55 (TRD-SR/SHR \"A\" models: NPN open collector output, sinking; negative logic, active low; L <= 0.4 V) and p.tECD-56 wiring (Black OUT A, White OUT B, Orange OUT Z, Blue 0V)"
      },
      {
        "a": "OG",
        "b": "BU",
        "when": "OUT Z low (ON)",
        "note": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf p.tECD-55 (TRD-SR/SHR \"A\" models: NPN open collector output, sinking; negative logic, active low; L <= 0.4 V) and p.tECD-56 wiring (Black OUT A, White OUT B, Orange OUT Z, Blue 0V)"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "No pulses",
        "symptom": "Counter does not change when the shaft turns.",
        "causes": [
          "Encoder not powered",
          "Output wire open",
          "Input wired for the wrong output type"
        ],
        "confirm": [
          "Measure Brown (power) to Blue (0 V) at the encoder cable.",
          "Turn the shaft slowly by hand with a meter on OUT A to 0 V: the reading must alternate between the L and H levels."
        ],
        "fix": [
          "Restore supply within the encoder voltage range; repair the wiring; wire to the counter as in the CLICK high-speed input examples."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR/SHR electrical specifications p. tECD-55, wiring diagrams p. tECD-56); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
      },
      {
        "title": "Wrong count direction",
        "symptom": "Count decreases when the machine moves forward.",
        "causes": [
          "OUT A and OUT B connected to the wrong counter inputs"
        ],
        "confirm": [
          "For normal (clockwise viewed from the shaft end) rotation the timing chart has OUT A leading OUT B by 90 deg; check which wire is on X1 and X2."
        ],
        "fix": [
          "Wire OUT A to X1, OUT B to X2 and OUT Z to X3 as in the CLICK quadrature example."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR/SHR electrical specifications p. tECD-55, wiring diagrams p. tECD-56); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
      },
      {
        "title": "Lost counts at speed",
        "symptom": "Position drifts at high speed.",
        "causes": [
          "Pulse frequency above the encoder max response frequency or the counter input limit (CLICK high-speed inputs 100 kHz)",
          "Noise on the signal cable"
        ],
        "confirm": [
          "Calculate frequency = rpm x PPR / 60 and compare.",
          "Check the shield is connected to ground (the shield is not connected to the encoder body)."
        ],
        "fix": [
          "Reduce speed or PPR; ground the shield; separate signal wiring from high-voltage wiring."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR/SHR electrical specifications p. tECD-55, wiring diagrams p. tECD-56); https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (Troubleshooting Electrical Noise Problems, p.6-10)"
      },
      {
        "title": "Open-collector encoder on a sinking-wired input",
        "symptom": "No counts although supply is good.",
        "causes": [
          "Input common wired to 0 V; an NPN open-collector (sinking) encoder needs the common on +"
        ],
        "confirm": [
          "Measure C1 to 0 V: about 0 V shows sinking wiring."
        ],
        "fix": [
          "Wire C1 to the supply + as in the CLICK \"Sinking Encoder (Open Collector)\" example."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR/SHR electrical specifications p. tECD-55, wiring diagrams p. tECD-56)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
    ]
  },
  {
    "id": "koyo-trd-encoder-push-pull",
    "title": "Koyo TRD incremental encoder, push-pull (totem-pole) output (TRD-GK, TRD-N...RZWD, TRDA-20/25 RZ)",
    "match": {
      "categories": [
        "encoder"
      ],
      "family": "TRD",
      "ratings": {
        "outputType": "push-pull"
      }
    },
    "normal": [
      {
        "terminals": "Brown (power) to Blue (0 V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "TRD-GK 10-30 VDC (9.7-30.9); TRD-N/TRDA 5-30 VDC (4.75-30.0)",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "Black (OUT A) to Blue (0 V)",
        "state": "output H",
        "meter": "VDC",
        "expected": "TRD-GK >= supply - 4 V; TRD-N/TRDA >= supply - 2.5 V",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "Black (OUT A) to Blue (0 V)",
        "state": "output L",
        "meter": "VDC",
        "expected": "TRD-GK <= 2 V; TRD-N/TRDA <= 0.4 V",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "White (OUT B), Orange (OUT Z)",
        "state": "turning slowly",
        "meter": "VDC",
        "expected": "B alternates like A, 90 deg shifted; Z once per revolution",
        "pins": [
          [
            "WH",
            "BU"
          ],
          [
            "OG",
            "BU"
          ]
        ]
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "No pulses",
        "symptom": "Counter does not change when the shaft turns.",
        "causes": [
          "Encoder not powered",
          "Output wire open",
          "Input wired for the wrong output type"
        ],
        "confirm": [
          "Measure Brown (power) to Blue (0 V) at the encoder cable.",
          "Turn the shaft slowly by hand with a meter on OUT A to 0 V: the reading must alternate between the L and H levels."
        ],
        "fix": [
          "Restore supply within the encoder voltage range; repair the wiring; wire to the counter as in the CLICK high-speed input examples."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encoderhd.pdf (TRD-GK electrical specifications and wiring p. tECD-66); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H) specifications p. tECD-61/62; TRDA-20/25 p. tECD-42/45); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
      },
      {
        "title": "Wrong count direction",
        "symptom": "Count decreases when the machine moves forward.",
        "causes": [
          "OUT A and OUT B connected to the wrong counter inputs"
        ],
        "confirm": [
          "For normal (clockwise viewed from the shaft end) rotation the timing chart has OUT A leading OUT B by 90 deg; check which wire is on X1 and X2."
        ],
        "fix": [
          "Wire OUT A to X1, OUT B to X2 and OUT Z to X3 as in the CLICK quadrature example."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encoderhd.pdf (TRD-GK electrical specifications and wiring p. tECD-66); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H) specifications p. tECD-61/62; TRDA-20/25 p. tECD-42/45); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
      },
      {
        "title": "Lost counts at speed",
        "symptom": "Position drifts at high speed.",
        "causes": [
          "Pulse frequency above the encoder max response frequency or the counter input limit (CLICK high-speed inputs 100 kHz)",
          "Noise on the signal cable"
        ],
        "confirm": [
          "Calculate frequency = rpm x PPR / 60 and compare.",
          "Check the shield is connected to ground (the shield is not connected to the encoder body)."
        ],
        "fix": [
          "Reduce speed or PPR; ground the shield; separate signal wiring from high-voltage wiring."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encoderhd.pdf (TRD-GK electrical specifications and wiring p. tECD-66); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H) specifications p. tECD-61/62; TRDA-20/25 p. tECD-42/45); https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (Troubleshooting Electrical Noise Problems, p.6-10)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/encoderhd.pdf (TRD-GK electrical specifications and wiring p. tECD-66); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H) specifications p. tECD-61/62; TRDA-20/25 p. tECD-42/45)",
      "https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
    ]
  },
  {
    "id": "koyo-trd-encoder-line-driver",
    "title": "Koyo TRD incremental encoder, line-driver (26C31) output",
    "match": {
      "categories": [
        "encoder"
      ],
      "family": "TRD",
      "ratings": {
        "outputType": "line driver"
      }
    },
    "normal": [
      {
        "terminals": "Brown (power) to Blue (0 V)",
        "state": "powered",
        "meter": "VDC",
        "expected": "5 VDC nominal (4.75-5.25 VDC)",
        "pins": [
          [
            "BN",
            "BU"
          ]
        ]
      },
      {
        "terminals": "Black (OUT A) to Blue (0 V)",
        "state": "output H / L",
        "meter": "VDC",
        "expected": "H >= 2.5 V, L <= 0.5 V; Purple (OUT A-not) is the complement",
        "pins": [
          [
            "BK",
            "BU"
          ]
        ]
      },
      {
        "terminals": "White (OUT B) / Gray (OUT B-not), Orange (OUT Z) / Yellow (OUT Z-not)",
        "state": "turning slowly",
        "meter": "VDC",
        "expected": "each pair complementary; B 90 deg from A",
        "pins": [
          [
            "WH",
            "BU"
          ],
          [
            "GY",
            "BU"
          ],
          [
            "OG",
            "BU"
          ],
          [
            "YE",
            "BU"
          ]
        ]
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "No pulses",
        "symptom": "Counter does not change when the shaft turns.",
        "causes": [
          "Encoder not powered",
          "Output wire open",
          "Input wired for the wrong output type"
        ],
        "confirm": [
          "Measure Brown (power) to Blue (0 V) at the encoder cable.",
          "Turn the shaft slowly by hand with a meter on OUT A to 0 V: the reading must alternate between the L and H levels."
        ],
        "fix": [
          "Restore supply within the encoder voltage range; repair the wiring; wire to the counter as in the CLICK high-speed input examples."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR...V specifications p. tECD-55/56); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H)...RZVWD p. tECD-61/62; TRDA line driver p. tECD-42/43); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
      },
      {
        "title": "Wrong count direction",
        "symptom": "Count decreases when the machine moves forward.",
        "causes": [
          "OUT A and OUT B connected to the wrong counter inputs"
        ],
        "confirm": [
          "For normal (clockwise viewed from the shaft end) rotation the timing chart has OUT A leading OUT B by 90 deg; check which wire is on X1 and X2."
        ],
        "fix": [
          "Wire OUT A to X1, OUT B to X2 and OUT Z to X3 as in the CLICK quadrature example."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR...V specifications p. tECD-55/56); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H)...RZVWD p. tECD-61/62; TRDA line driver p. tECD-42/43); https://cdn.automationdirect.com/static/manuals/c0userm/ch3.pdf (CLICK C0-USER-M Wiring Examples High Speed Inputs, p.3-47)"
      },
      {
        "title": "Lost counts at speed",
        "symptom": "Position drifts at high speed.",
        "causes": [
          "Pulse frequency above the encoder max response frequency or the counter input limit (CLICK high-speed inputs 100 kHz)",
          "Noise on the signal cable"
        ],
        "confirm": [
          "Calculate frequency = rpm x PPR / 60 and compare.",
          "Check the shield is connected to ground (the shield is not connected to the encoder body)."
        ],
        "fix": [
          "Reduce speed or PPR; ground the shield; separate signal wiring from high-voltage wiring."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR...V specifications p. tECD-55/56); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H)...RZVWD p. tECD-61/62; TRDA line driver p. tECD-42/43); https://cdn.automationdirect.com/static/manuals/c0userm/ch6.pdf (Troubleshooting Electrical Noise Problems, p.6-10)"
      },
      {
        "title": "Line driver into a 24 VDC single-ended input",
        "symptom": "No counts on a CLICK 24 VDC input.",
        "causes": [
          "Line-driver H level (>= 2.5 V from a 5 V supply) does not reach the 24 VDC input ON level (> 19 VDC)"
        ],
        "confirm": [
          "Measure OUT A to 0 V while turning: H stays near 5 V or lower."
        ],
        "fix": [
          "Use a counter input rated for 5 V signals (e.g. C2-14TTL, ON > 4.0 VDC) or a push-pull/open-collector encoder for 24 VDC inputs."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR...V specifications p. tECD-55/56); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H)...RZVWD p. tECD-61/62; TRDA line driver p. tECD-42/43); https://cdn.automationdirect.com/static/manuals/c0userm/ch2.pdf (CLICK input ON Voltage Level > 19 VDC, p.2-36); https://cdn.automationdirect.com/static/manuals/c2userm/ch2.pdf (C2-14TTL p.2-36)"
      },
      {
        "title": "Line-driver encoder on wrong supply voltage",
        "symptom": "Encoder dead or erratic.",
        "causes": [
          "Supplied outside 4.75-5.25 VDC"
        ],
        "confirm": [
          "Measure Brown to Blue."
        ],
        "fix": [
          "Supply 5 VDC (Class II source)."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR...V specifications p. tECD-55/56); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H)...RZVWD p. tECD-61/62; TRDA line driver p. tECD-42/43)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/encodertrd.pdf (TRD-SR...V specifications p. tECD-55/56); https://cdn.automationdirect.com/static/specs/encodermd.pdf (TRD-N(H)...RZVWD p. tECD-61/62; TRDA line driver p. tECD-42/43)"
    ]
  },
  {
    "id": "ad-gcx-pushbutton",
    "title": "AutomationDirect GCX 22 mm metal momentary pushbutton",
    "match": {
      "categories": [
        "pushbutton"
      ],
      "partNumber": "^GCX"
    },
    "normal": [
      {
        "terminals": "N.O. contact block (green ECX1040) terminals",
        "state": "released",
        "meter": "continuity",
        "expected": "open",
        "pins": [
          [
            "3",
            "4"
          ]
        ]
      },
      {
        "terminals": "N.O. contact block terminals",
        "state": "pressed",
        "meter": "ohms",
        "expected": "closed; initial contact resistance <= 25 m ohm",
        "pins": [
          [
            "3",
            "4"
          ]
        ]
      },
      {
        "terminals": "N.C. contact block (red ECX1030) terminals",
        "state": "released",
        "meter": "ohms",
        "expected": "closed (<= 25 m ohm)",
        "pins": [
          [
            "1",
            "2"
          ]
        ]
      },
      {
        "terminals": "N.C. contact block terminals",
        "state": "pressed",
        "meter": "continuity",
        "expected": "open",
        "pins": [
          [
            "1",
            "2"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "3",
        "b": "4",
        "when": "pressed (N.O. block ECX1040)",
        "note": "https://cdn.automationdirect.com/static/specs/cents22mmpb.pdf p.tPIL-26 Typical Wiring: Normally Open 3-4, Normally Closed 1-2 (terminal markings per CENELEC EN 50013)"
      },
      {
        "a": "1",
        "b": "2",
        "when": "released (N.C. block ECX1030)",
        "note": "https://cdn.automationdirect.com/static/specs/cents22mmpb.pdf p.tPIL-26 Typical Wiring: Normally Open 3-4, Normally Closed 1-2 (terminal markings per CENELEC EN 50013)"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Contact does not make",
        "symptom": "Button pressed but the circuit stays open.",
        "causes": [
          "Contact block worn or failed",
          "Loose wire at the terminal clamp (14 AWG max)"
        ],
        "confirm": [
          "With power off, measure the N.O. block across its terminals while pressing: open = failed block."
        ],
        "fix": [
          "Replace the contact block (ECX1040 N.O. / ECX1030 N.C.); terminal screw torque 0.8 N.m max."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/cents22mmpb.pdf (GCX/ECX 22 mm metal pilot devices specifications and momentary flush pushbuttons, p. tPIL-26/27); https://cdn.automationdirect.com/static/specs/cents22mmmush.pdf (Mushroom / twist-to-release pushbuttons p. tPIL-34; specifications p. tPIL-26; replacement contact blocks)"
      },
      {
        "title": "Contact rating exceeded",
        "symptom": "Contacts burned / intermittent.",
        "causes": [
          "Load above AC15 24 VAC 10 A / 130 VAC 6.5 A or DC13 24 VDC 1.5 A / 110 VDC 0.5 A"
        ],
        "confirm": [
          "Measure the switched load current."
        ],
        "fix": [
          "Use an interposing relay; replace the contact block."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/cents22mmpb.pdf (GCX/ECX 22 mm metal pilot devices specifications and momentary flush pushbuttons, p. tPIL-26/27)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/cents22mmpb.pdf (GCX/ECX 22 mm metal pilot devices specifications and momentary flush pushbuttons, p. tPIL-26/27)",
      "https://cdn.automationdirect.com/static/specs/cents22mmmush.pdf (Mushroom / twist-to-release pushbuttons p. tPIL-34; specifications p. tPIL-26; replacement contact blocks)"
    ]
  },
  {
    "id": "ad-gcx-estop",
    "title": "AutomationDirect GCX113x 40/60 mm twist-to-release emergency stop (1 N.C.)",
    "match": {
      "categories": [
        "estop"
      ],
      "partNumber": "^GCX113"
    },
    "normal": [
      {
        "terminals": "N.C. contact block (red ECX1030) terminals",
        "state": "released (pulled out / twisted to release)",
        "meter": "ohms",
        "expected": "closed; initial contact resistance <= 25 m ohm",
        "pins": [
          [
            "1",
            "2"
          ]
        ]
      },
      {
        "terminals": "N.C. contact block terminals",
        "state": "pushed (latched)",
        "meter": "continuity",
        "expected": "open (slow-action, positive opening contact)",
        "pins": [
          [
            "1",
            "2"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "1",
        "b": "2",
        "when": "released (not pressed; N.C. block ECX1030)",
        "note": "https://cdn.automationdirect.com/static/specs/cents22mmpb.pdf p.tPIL-26 Typical Wiring: Normally Open 3-4, Normally Closed 1-2 (terminal markings per CENELEC EN 50013)"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "E-stop circuit stays open after reset",
        "symptom": "Machine cannot be reset although the E-stop looks released.",
        "causes": [
          "Actuator still latched (twist-to-release not fully released)",
          "N.C. contact block failed or not seated",
          "Loose terminal"
        ],
        "confirm": [
          "With power off, measure across the N.C. block with the actuator released: must be closed (<= 25 m ohm initial)."
        ],
        "fix": [
          "Twist to release the actuator; replace the ECX1030 N.C. contact block if it reads open when released."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/cents22mmmush.pdf (Mushroom / twist-to-release pushbuttons p. tPIL-34; specifications p. tPIL-26; replacement contact blocks)"
      },
      {
        "title": "Mushroom operator worn out",
        "symptom": "Actuator sticks or does not latch.",
        "causes": [
          "Mechanical life of mushroom pushbuttons: 300,000 operations"
        ],
        "confirm": [
          "Check the number of operations / mechanical latch action."
        ],
        "fix": [
          "Replace the operator."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/cents22mmmush.pdf (Mushroom / twist-to-release pushbuttons p. tPIL-34; specifications p. tPIL-26; replacement contact blocks)"
      },
      {
        "title": "Contact rating exceeded",
        "symptom": "Contact welds or burns.",
        "causes": [
          "Load above DC13 24 VDC 1.5 A or AC15 ratings"
        ],
        "confirm": [
          "Measure switched current."
        ],
        "fix": [
          "Switch through a safety relay or contactor coil within rating."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/cents22mmpb.pdf (GCX/ECX 22 mm metal pilot devices specifications and momentary flush pushbuttons, p. tPIL-26/27)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/cents22mmmush.pdf (Mushroom / twist-to-release pushbuttons p. tPIL-34; specifications p. tPIL-26; replacement contact blocks)",
      "https://cdn.automationdirect.com/static/specs/cents22mmpb.pdf (GCX/ECX 22 mm metal pilot devices specifications and momentary flush pushbuttons, p. tPIL-26/27)"
    ]
  },
  {
    "id": "mindman-mvsc220-solenoid-valve",
    "title": "Mindman MVSC-220 solenoid valve, 24 VDC, DIN connector",
    "match": {
      "categories": [
        "solenoidValve"
      ],
      "manufacturer": "Mindman"
    },
    "normal": [
      {
        "terminals": "coil connector terminals (11 mm DIN connector)",
        "state": "coil energized",
        "meter": "VDC",
        "expected": "24 VDC +/-10% (21.6-26.4 VDC); about 2 W"
      },
      {
        "terminals": "air supply at port P",
        "state": "running",
        "meter": "visual",
        "expected": "0.2-0.8 MPa operating pressure range (pilot-operated; 0.3-0.8 MPa for some models in the table); proof 1 MPa"
      }
    ],
    "indicators": [
      {
        "name": "LED in DIN connector",
        "state": "on",
        "meaning": "Coil voltage present at the connector (connector with surge suppression and LED)"
      }
    ],
    "faults": [
      {
        "title": "Valve does not shift (no air / low air)",
        "symptom": "Coil energized (LED on) but the actuator does not move.",
        "causes": [
          "Supply pressure below the operating range (internally piloted valve needs pressure to shift)"
        ],
        "confirm": [
          "Read the supply gauge: must be within 0.2-0.8 MPa."
        ],
        "fix": [
          "Restore air pressure within the operating range."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/vendspecs/mindman/emvsc220.pdf (MVSC-220 series specification and technical data); https://cdn.automationdirect.com/static/manuals/mindman/mvscassembly.pdf (MVSC assembly / electrical connection sheet)"
      },
      {
        "title": "Coil voltage out of range",
        "symptom": "Valve shifts slowly or not at all.",
        "causes": [
          "Coil voltage outside 24 VDC +/-10%"
        ],
        "confirm": [
          "Measure at the DIN connector with the output on: 21.6-26.4 VDC."
        ],
        "fix": [
          "Correct the supply / voltage drop."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/vendspecs/mindman/emvsc220.pdf (MVSC-220 series specification and technical data); https://cdn.automationdirect.com/static/manuals/mindman/mvscassembly.pdf (MVSC assembly / electrical connection sheet)"
      },
      {
        "title": "Coil open",
        "symptom": "LED on, no click, valve does not shift; manual override works.",
        "causes": [
          "Failed coil"
        ],
        "confirm": [
          "Unplug the DIN connector and measure across the coil pins: open circuit means the coil is failed."
        ],
        "fix": [
          "Replace the coil; a DC coil valve can only take another DC coil."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/vendspecs/mindman/emvsc220.pdf (MVSC-220 series specification and technical data); https://cdn.automationdirect.com/static/manuals/mindman/mvscassembly.pdf (MVSC assembly / electrical connection sheet)"
      },
      {
        "title": "Valve stays shifted",
        "symptom": "Actuator stays in the energized position with the coil off.",
        "causes": [
          "Manual override pushed and twisted to lock"
        ],
        "confirm": [
          "Inspect the push-button manual override."
        ],
        "fix": [
          "Release (untwist) the manual override."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/vendspecs/mindman/emvsc220.pdf (MVSC-220 series specification and technical data); https://cdn.automationdirect.com/static/manuals/mindman/mvscassembly.pdf (MVSC assembly / electrical connection sheet)"
      },
      {
        "title": "No voltage at the connector",
        "symptom": "Connector LED off when the PLC output is on.",
        "causes": [
          "Loose terminal in the DIN connector (max 16 AWG, terminal torque 2 lb.in)",
          "Connector not screwed onto the coil"
        ],
        "confirm": [
          "Measure at the PLC output and at the connector terminals."
        ],
        "fix": [
          "Re-terminate the connector (cable 5-7 mm, PG9 gland) and reinstall the screw."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/vendspecs/mindman/emvsc220.pdf (MVSC-220 series specification and technical data); https://cdn.automationdirect.com/static/manuals/mindman/mvscassembly.pdf (MVSC assembly / electrical connection sheet)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/vendspecs/mindman/emvsc220.pdf (MVSC-220 series specification and technical data); https://cdn.automationdirect.com/static/manuals/mindman/mvscassembly.pdf (MVSC assembly / electrical connection sheet)"
    ]
  }
];
