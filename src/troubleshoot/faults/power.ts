import type { DeviceFaultProfile } from "../deviceFaults";

/**
 * Power, protection and switching fault profiles: 24 V supplies (Rhino PSR / PSN / PSL, QUINT4, SITOP PSU6200, S8VK-C),
 * miniature breakers (Gladiator, S200U, 5SJ4, C60BP, 1489-M), Class T / J / CC fuses, Fuji SC-E contactors and TK-E
 * overloads, 78x / GQ / GRS-H relays, and safety relays (Dold, IDEM, Guardmaster 440R, SIRIUS 3SK1, XPSUAF).
 * From the maker documents (each fault cites its source).
 */
export const POWER_FAULTS: DeviceFaultProfile[] = [
  {
    "id": "rhino-psr-psu",
    "title": "AutomationDirect RHINO PSR 24 VDC power supply",
    "match": {
      "categories": [
        "powerSupply"
      ],
      "family": "\\bPSR\\b"
    },
    "normal": [
      {
        "terminals": "L to N",
        "state": "single-phase models (PSR-24-xxx), mains on",
        "meter": "VAC",
        "expected": "100-240 VAC nominal; operating range 90-264 VAC, 47-63 Hz",
        "pins": [
          [
            "L",
            "N"
          ]
        ],
        "note": "PSR-24-120 technical data; three-phase -3 models take 3 x 380-500 VAC (range 3 x 320-575 VAC) on L1, L2, L3.",
        "liveWork": true
      },
      {
        "terminals": "L1-L2, L2-L3, L1-L3",
        "state": "three-phase models (PSR-24-xxx-3), mains on",
        "meter": "VAC",
        "expected": "380-500 VAC nominal; operating range 320-575 VAC (or 2 x 340-575 VAC)",
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
        "liveWork": true
      },
      {
        "terminals": "+ to -",
        "state": "normal operation",
        "meter": "VDC",
        "expected": "24 VDC +/-1% (single-phase) / +/-2% (three-phase) at factory setting; adjustable 24-28 VDC with the potentiometer",
        "pins": [
          [
            "+",
            "-"
          ]
        ],
        "note": "Load regulation +/-0.5%; ripple < 100 mVpp (0-70 C)."
      },
      {
        "terminals": "DC OK relay contact (2 pins)",
        "state": "normal mode",
        "meter": "continuity",
        "expected": "closed",
        "note": "Contact rating 30 V / 1 A."
      },
      {
        "terminals": "DC OK relay contact (2 pins)",
        "state": "overload, short circuit, over-temperature or no input",
        "meter": "continuity",
        "expected": "open"
      }
    ],
    "indicators": [
      {
        "name": "DC OK LED (green)",
        "state": "on",
        "meaning": "Normal mode, output OK (DC OK contact closed)"
      },
      {
        "name": "DC OK LED (green)",
        "state": "intermittent",
        "meaning": "Overload (hiccup mode) or output short circuit (DC OK contact open)"
      },
      {
        "name": "DC OK LED (green)",
        "state": "off",
        "meaning": "Temperature shutdown or no input power (DC OK contact open)"
      }
    ],
    "faults": [
      {
        "title": "No output, no input power",
        "symptom": "DC OK LED off, + to - reads 0 VDC, DC OK contact open",
        "causes": [
          "No AC at L/N (upstream breaker or fuse open, wiring)",
          "Internal fuse (T3.15A on PSR-24-120) open - not user replaceable"
        ],
        "confirm": [
          "Meter L-N: 90-264 VAC (1-phase) or 320-575 VAC ph-ph (3-phase). 0 V: check upstream breaker (AD: 20 A B-curve 1-phase, 4 A B-curve -3 models).",
          "Input OK but LED off and 0 VDC out with load removed: unit failed; the internal fuse cannot be replaced by the user."
        ],
        "fix": [
          "Restore input power / reset the upstream breaker after finding the cause.",
          "Replace the power supply if input is present and output is dead; the internal fuse must not be replaced by the user."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/psr24120.pdf (section 4.1 Input connection, Fig. 4 indicator table, Technical data); https://cdn.automationdirect.com/static/specs/rhinopsr.pdf (tPWR-130 Recommended circuit breaker)"
      },
      {
        "title": "Overload / hiccup",
        "symptom": "DC OK LED blinks (intermittent), output voltage droops and bounces, DC OK contact open",
        "causes": [
          "Load current 105-150% of rating (110-150% on PSR-24-480-3/960-3)",
          "Capacitive or inductive inrush beyond the startup capability (10,000 uF on PSR-24-120)"
        ],
        "confirm": [
          "Measure + to - under load: voltage below 24 VDC and bouncing means the unit is in current limit / hiccup.",
          "Disconnect the load: if + to - returns to 24-28 VDC and the LED is steady, the load draws too much current."
        ],
        "fix": [
          "Reduce the load or fit a larger PSR model; output recovers automatically when the overload is removed (auto-recovery)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/psr24120.pdf (4.3 Output characteristic curve, Fig. 4); https://cdn.automationdirect.com/static/specs/rhinopsr.pdf (tPWR-132 Overload/Overcurrent)"
      },
      {
        "title": "Output short circuit",
        "symptom": "DC OK LED intermittent, output near 0 V and bouncing",
        "causes": [
          "Short circuit on the 24 VDC load wiring"
        ],
        "confirm": [
          "Remove the output wires: if the output recovers to 24 VDC, the short is in the load wiring."
        ],
        "fix": [
          "Find and remove the short; the supply recovers by itself (hiccup mode, non-latching)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/psr24120.pdf (4.3, Fig. 4); https://cdn.automationdirect.com/static/specs/rhinopsr.pdf (tPWR-132 Short circuit protection: hiccup mode, non-latching)"
      },
      {
        "title": "Thermal shutdown",
        "symptom": "Output switches off / bounces at high ambient or high load, DC OK LED off",
        "causes": [
          "Load beyond the derating curve (vertical mounting > 60 C: derate 2.5%/C on PSR-24-120)",
          "Insufficient clearance (40 mm above, 20 mm below, 5 mm side for PSR-24-120)"
        ],
        "confirm": [
          "Check enclosure temperature and load current against the derating curve."
        ],
        "fix": [
          "Reduce load or ambient temperature, restore clearances; the unit recovers when cooled."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/psr24120.pdf (1 Safety instructions clearances, 4.5 Thermal behavior, Technical data derating)"
      },
      {
        "title": "Output overvoltage latch-off",
        "symptom": "Output off after an overvoltage event (single-phase models)",
        "causes": [
          "Output overvoltage protection < 34 V operated (latch mode on 1-phase models; hiccup/auto-recovery on 3-phase models)"
        ],
        "confirm": [
          "Check the V.adj setting and for back-feed from the load."
        ],
        "fix": [
          "Remove the cause and cycle input power (1-phase latch mode)."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/rhinopsr.pdf (tPWR-132 Overvoltage protection)"
      },
      {
        "title": "Output too low",
        "symptom": "+ to - below 24 VDC with normal load and steady DC OK LED",
        "causes": [
          "Potentiometer set low (adjustable 24-28 VDC)",
          "Input below 100 VAC: derate power 1%/VAC"
        ],
        "confirm": [
          "Measure + to - at the terminals with the load connected.",
          "Measure L to N: below 100 VAC the unit derates."
        ],
        "fix": [
          "Set the output with the DC voltage adjustment potentiometer to the required value (24-28 VDC)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/psr24120.pdf (4.2 Output connection, Technical data derating)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/rhinopsr.pdf",
      "https://cdn.automationdirect.com/static/manuals/psxinstall/psr24120.pdf",
      "https://cdn.automationdirect.com/static/manuals/psxinstall/psr241203.pdf"
    ]
  },
  {
    "id": "rhino-psn-psu",
    "title": "AutomationDirect RHINO PRO PSN 24 VDC power supply",
    "match": {
      "categories": [
        "powerSupply"
      ],
      "family": "\\bPSN\\b"
    },
    "normal": [
      {
        "terminals": "L to N",
        "state": "AC input, mains on (PSN24-240)",
        "meter": "VAC",
        "expected": "100-240 VAC nominal; range 85-276 VAC (DC input 88-375 VDC: L = +, N = -)",
        "pins": [
          [
            "L",
            "N"
          ]
        ],
        "liveWork": true
      },
      {
        "terminals": "+ to -",
        "state": "normal operation",
        "meter": "VDC",
        "expected": "24 VDC at factory setting; adjustable 24-28 VDC",
        "pins": [
          [
            "+",
            "-"
          ]
        ],
        "note": "PSN24-240: 10 A at 24 V, 15 A for 5 s (power boost)."
      },
      {
        "terminals": "DC OK contact",
        "state": "normal mode or power boost",
        "meter": "continuity",
        "expected": "closed",
        "note": "Max. 30 V (SELV) / 1 A resistive."
      },
      {
        "terminals": "DC OK contact",
        "state": "overload (Vout < 90%), short circuit, temperature shutdown, no input",
        "meter": "continuity",
        "expected": "open"
      }
    ],
    "indicators": [
      {
        "name": "DC OK LED (green)",
        "state": "on",
        "meaning": "Normal mode or power boost"
      },
      {
        "name": "DC OK LED (green)",
        "state": "off",
        "meaning": "Overload (Vout < 90%), short circuit, temperature shutdown or no input"
      },
      {
        "name": "Overload LED (red)",
        "state": "flashing",
        "meaning": "Overload (Vout < 90%), output short circuit or temperature shutdown"
      },
      {
        "name": "Overload LED (red)",
        "state": "off",
        "meaning": "Normal mode, power boost or no input power"
      }
    ],
    "faults": [
      {
        "title": "No input power",
        "symptom": "Both LEDs off, output 0 VDC, DC OK open",
        "causes": [
          "Upstream protection open or wiring fault",
          "Internal fuse (T 6.3 A on PSN24-240) open - not replaceable"
        ],
        "confirm": [
          "Measure L to N: must be 85-276 VAC. 0 V = supply side open."
        ],
        "fix": [
          "Restore input; if an external device is used, minimum 6 A B or 4 A C breaker. Replace the unit if input is present and both LEDs stay off."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/PSN24-240_Rev00_20200701.pdf (4.1 Input connection, Fig. 4 indicator table, Technical data)"
      },
      {
        "title": "Overload",
        "symptom": "Red Overload LED flashing, green DC OK off, output voltage drooping",
        "causes": [
          "Output current above 150% of rating: output voltage droops until the overload is removed"
        ],
        "confirm": [
          "Measure + to - under load (below 90% of setting = overload state per indicator table).",
          "Remove the load: output returns to the set value."
        ],
        "fix": [
          "Reduce load or use a larger supply."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/PSN24-240_Rev00_20200701.pdf (4.3 Output characteristic curve, Fig. 4)"
      },
      {
        "title": "Output short circuit",
        "symptom": "Red Overload LED flashing, DC OK off, output near 0 V",
        "causes": [
          "Short circuit on the DC load wiring"
        ],
        "confirm": [
          "Disconnect the + and - load wires and re-measure + to -."
        ],
        "fix": [
          "Remove the short; the supply recovers automatically."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/PSN24-240_Rev00_20200701.pdf (Fig. 4 indicator table)"
      },
      {
        "title": "Temperature shutdown",
        "symptom": "Red LED flashing, DC OK off, output bouncing at high ambient",
        "causes": [
          "Load beyond derating (> 60 C vertical, > 50 C horizontal: 2.5%/C)"
        ],
        "confirm": [
          "Check ambient temperature and load against the derating curve (Fig. 7)."
        ],
        "fix": [
          "Reduce load or ambient; the unit recovers when cooled."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/PSN24-240_Rev00_20200701.pdf (4.5 Thermal behavior, Technical data derating)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/rhinopsn.pdf",
      "https://cdn.automationdirect.com/static/manuals/psxinstall/PSN24-240_Rev00_20200701.pdf",
      "https://cdn.automationdirect.com/static/manuals/psxinstall/PSN24-480_Rev00_20200701.pdf",
      "https://cdn.automationdirect.com/static/manuals/psxinstall/PSN24-480-3_Rev00_20200921.pdf"
    ]
  },
  {
    "id": "rhino-psl-psu",
    "title": "AutomationDirect RHINO PSL 24 VDC power supply",
    "match": {
      "categories": [
        "powerSupply"
      ],
      "family": "\\bPSL\\b"
    },
    "normal": [
      {
        "terminals": "L to N",
        "state": "mains on",
        "meter": "VAC",
        "expected": "100-240 VAC nominal; range 90-264 VAC, 47-63 Hz",
        "pins": [
          [
            "L",
            "N"
          ]
        ],
        "liveWork": true
      },
      {
        "terminals": "+ to -",
        "state": "normal operation",
        "meter": "VDC",
        "expected": "24 VDC +/-2% factory; adjustable 24-28 VDC",
        "pins": [
          [
            "+",
            "-"
          ]
        ],
        "note": "PSL-24-030: 1.25 A; PSL-24-060: 2.5 A."
      }
    ],
    "indicators": [
      {
        "name": "DC OK LED (green)",
        "state": "on",
        "meaning": "Correct function of the output"
      },
      {
        "name": "DC OK LED (green)",
        "state": "off",
        "meaning": "No output (no input, protection operated or latched off)"
      }
    ],
    "faults": [
      {
        "title": "No input power",
        "symptom": "DC OK LED off, 0 VDC output",
        "causes": [
          "Upstream breaker/fuse open or wiring",
          "Internal fuse T 3.15 A / 250 VAC open (non-replaceable)"
        ],
        "confirm": [
          "Measure L to N: must be 90-264 VAC."
        ],
        "fix": [
          "Restore input (backup: PSL-24-030 13 A B / 8 A C, PSL-24-060 16 A B / 8 A C). Input present, 0 V out with no load: replace unit."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/PSL-24-030.pdf (5.1 Input connection, Technical data); https://cdn.automationdirect.com/static/manuals/psxinstall/PSL-24-060.pdf (5.1)"
      },
      {
        "title": "Overload or short circuit (cycling)",
        "symptom": "Output voltage and current collapse, output cycles on and off",
        "causes": [
          "Load current above Isurge (150%) or short circuit on the output"
        ],
        "confirm": [
          "Measure + to -: low and cycling. Disconnect the load: output recovers to the set value."
        ],
        "fix": [
          "Remove the overload/short; the output recovers when the fault is removed."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/PSL-24-030.pdf (5.3 Output characteristic curve)"
      },
      {
        "title": "Thermal latch-off",
        "symptom": "Output off and stays off after running hot",
        "causes": [
          "Ambient above 55 C without derating 2.5%/C: thermal protection latches the output off"
        ],
        "confirm": [
          "Check enclosure ambient and load against Fig. 6 derating."
        ],
        "fix": [
          "Let the unit cool and recycle AC power (latch-off mode); reduce load or ambient."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/psxinstall/PSL-24-030.pdf (5.4 Thermal behavior)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/pslpowersupplies.pdf",
      "https://cdn.automationdirect.com/static/manuals/psxinstall/PSL-24-030.pdf",
      "https://cdn.automationdirect.com/static/manuals/psxinstall/PSL-24-060.pdf"
    ]
  },
  {
    "id": "phoenix-quint4-psu",
    "title": "Phoenix Contact QUINT4-PS 24 VDC power supply",
    "match": {
      "categories": [
        "powerSupply"
      ],
      "family": "QUINT4"
    },
    "normal": [
      {
        "terminals": "L/+ to N/-",
        "state": "1-phase AC input, mains on",
        "meter": "VAC",
        "expected": "100-240 VAC -15%...+10% (85-264 VAC), 50-60 Hz",
        "pins": [
          [
            "L/+",
            "N/-"
          ]
        ],
        "note": "Values from QUINT4-PS/1AC/24DC/10; DC input 110-250 VDC -18%...+40% is also allowed.",
        "liveWork": true
      },
      {
        "terminals": "+ to - (Output DC 24V)",
        "state": "normal operation",
        "meter": "VDC",
        "expected": "24 VDC nominal; setting range UOut 24-29.5 VDC (constant capacity)",
        "pins": [
          [
            "+",
            "-"
          ]
        ]
      },
      {
        "terminals": "13 / 14 (relay)",
        "state": "normal operation, UOut > 0.9 x USet",
        "meter": "continuity",
        "expected": "closed (default DC OK function)",
        "pins": [
          [
            "13",
            "14"
          ]
        ]
      },
      {
        "terminals": "Out 1 to SGnd",
        "state": "normal operation (default DC OK)",
        "meter": "VDC",
        "expected": "24 VDC (active high) while UOut > 0.9 x USet; 0 V when below",
        "pins": [
          [
            "Out1",
            "SGnd"
          ]
        ]
      },
      {
        "terminals": "Out 2 to SGnd",
        "state": "default POut < PN",
        "meter": "VDC",
        "expected": "24 VDC while output power below nominal; 0 V in boost or overload",
        "pins": [
          [
            "Out2",
            "SGnd"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "DC OK (default relay function, UOut > 0.9 x USet)",
        "note": "Data sheet QUINT4-PS/1AC/24DC/10 (107100_en_00): Relay contact (configurable) 13/14, default DC OK, closed in normal operation"
      }
    ],
    "indicators": [
      {
        "name": "DC OK LED (green)",
        "state": "on",
        "meaning": "UOut >= 0.9 x USet"
      },
      {
        "name": "DC OK LED (green)",
        "state": "flashing",
        "meaning": "UOut < 0.9 x USet (overload / FUSE MODE tripped)"
      },
      {
        "name": "POut > 50% LED (green)",
        "state": "on",
        "meaning": "Output power > 50% of nominal (> 120 W on the 10 A unit)"
      },
      {
        "name": "POut > 75% LED (green)",
        "state": "on",
        "meaning": "Output power > 75% of nominal (> 180 W)"
      },
      {
        "name": "POut > 100% LED (yellow)",
        "state": "on",
        "meaning": "Boost mode, output power > nominal (> 240 W)"
      },
      {
        "name": "All LEDs",
        "state": "off",
        "meaning": "No input power, or SLEEP MODE via Rem input (relay 13/14 open, all signals low)"
      }
    ],
    "faults": [
      {
        "title": "Overload (U/I Advanced default curve)",
        "symptom": "DC OK LED flashing, relay 13/14 open, Out 1 low",
        "causes": [
          "Load demand above static boost (125% IN) / dynamic boost (200% IN for 5 s)",
          "Short circuit on output"
        ],
        "confirm": [
          "Measure + to -: below 0.9 x USet confirms overload operation.",
          "Disconnect the load: output returns to USet."
        ],
        "fix": [
          "Reduce the load or remove the short; on U/I Advanced the output recovers when load returns to range."
        ],
        "source": "https://www.phoenixcontact.com/en-us/products/power-supply-quint4-ps1ac24dc10-2904601 (Data sheet QUINT4-PS/1AC/24DC/10, 107100_en_00) (10.1 U/I Advanced, 13.3 LED status indicators, 13.4 signaling table, p. 23, 33-34)"
      },
      {
        "title": "Smart HICCUP cycling",
        "symptom": "Output on 2 s / off 8 s repeatedly",
        "causes": [
          "Smart HICCUP characteristic selected and a sustained overload or short circuit is present"
        ],
        "confirm": [
          "Watch the DC OK LED and output: 2 s on, 8 s off pattern."
        ],
        "fix": [
          "Remove the overload; the output returns automatically."
        ],
        "source": "https://www.phoenixcontact.com/en-us/products/power-supply-quint4-ps1ac24dc10-2904601 (Data sheet QUINT4-PS/1AC/24DC/10, 107100_en_00) (10.2 Smart HICCUP, p. 24)"
      },
      {
        "title": "FUSE MODE switched off",
        "symptom": "Output permanently off after an overload, DC OK LED flashing",
        "causes": [
          "FUSE MODE selected: output switches off permanently when I > IFuse for t > tFuse (defaults IN, 100 ms)"
        ],
        "confirm": [
          "Measure + to -: 0 V with input present; check the configured output curve."
        ],
        "fix": [
          "Remove the fault, then restart via the Rem remote contact or switch the primary supply off and on."
        ],
        "source": "https://www.phoenixcontact.com/en-us/products/power-supply-quint4-ps1ac24dc10-2904601 (Data sheet QUINT4-PS/1AC/24DC/10, 107100_en_00) (10.3 FUSE MODE, 13.6, p. 24, 35)"
      },
      {
        "title": "SLEEP MODE via Rem",
        "symptom": "All LEDs off, output 0 V, input present",
        "causes": [
          "External circuit between Rem and SGnd set to switch the output off (< 1.5 kOhm bridge or < 5 VDC per configuration)"
        ],
        "confirm": [
          "Measure L/+ to N/-: input present; check wiring between Rem and SGnd."
        ],
        "fix": [
          "Change the Rem-SGnd circuit (default: open / > 1.5 kOhm = output ON)."
        ],
        "source": "https://www.phoenixcontact.com/en-us/products/power-supply-quint4-ps1ac24dc10-2904601 (Data sheet QUINT4-PS/1AC/24DC/10, 107100_en_00) (13.2.8 Remote input, 13.7 SLEEP MODE signaling, p. 33, 35)"
      },
      {
        "title": "No input",
        "symptom": "All LEDs off, Out 1/Out 2 low, relay open",
        "causes": [
          "Upstream protection open or wiring"
        ],
        "confirm": [
          "Measure L/+ to N/-: must be 85-264 VAC."
        ],
        "fix": [
          "Restore input; use the external input protection listed in the data sheet input protection table."
        ],
        "source": "https://www.phoenixcontact.com/en-us/products/power-supply-quint4-ps1ac24dc10-2904601 (Data sheet QUINT4-PS/1AC/24DC/10, 107100_en_00) (4 Technical data, Input protection table, p. 5)"
      }
    ],
    "sources": [
      "https://www.phoenixcontact.com/en-us/products/power-supply-quint4-ps1ac24dc10-2904601 (Data sheet QUINT4-PS/1AC/24DC/10, 107100_en_00)"
    ]
  },
  {
    "id": "siemens-sitop-psu6200",
    "title": "Siemens SITOP PSU6200 24 VDC power supply",
    "match": {
      "categories": [
        "powerSupply"
      ],
      "family": "PSU6200"
    },
    "normal": [
      {
        "terminals": "L1/+ to L2/N/-",
        "state": "mains on",
        "meter": "VAC",
        "expected": "120-240 VAC rated; range 85-264 VAC (DC 110-275 V)",
        "pins": [
          [
            "L1/+",
            "L2/N/-"
          ]
        ],
        "liveWork": true
      },
      {
        "terminals": "+1/+2 to -1/-2/-3",
        "state": "normal operation",
        "meter": "VDC",
        "expected": "24 VDC; adjustable 24-28 V on 6EP3333 (5 A) and 6EP3334 (10 A), 22.2-26.4 V on 6EP3332 (2.5 A)",
        "pins": [
          [
            "+1",
            "-1"
          ]
        ]
      },
      {
        "terminals": "13 / 14",
        "state": "DC O.K. (6EP3333 / 6EP3334)",
        "meter": "continuity",
        "expected": "closed when DC O.K. (electronic NO contact, 30 VDC / 0.1 A)",
        "pins": [
          [
            "13",
            "14"
          ]
        ],
        "note": "6EP3332 (2.5 A) has no 13/14 alarm contact."
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "DC O.K.",
        "note": "SITOP PSU6200 data sheets 6EP3333/6EP3334: 13, 14 auxiliary contact (alarm signal), electronic NO contact closed when DC O.K."
      }
    ],
    "indicators": [
      {
        "name": "LED (green)",
        "state": "on",
        "meaning": "24 V OK"
      }
    ],
    "faults": [
      {
        "title": "Short circuit / overload restarts",
        "symptom": "Output switches off and periodically tries to restart",
        "causes": [
          "Short circuit or overload on the output (short-circuit protection = shutdown and periodic restart attempts)",
          "Overload beyond 150% Iout rated for more than 5 s/min"
        ],
        "confirm": [
          "Measure + to -: low/cycling; disconnect the load to confirm the output recovers.",
          "Green LED not steady; 13-14 open (models with alarm contact)."
        ],
        "fix": [
          "Remove the short/overload; the supply restarts by itself."
        ],
        "source": "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=6EP3334-7SB00-3AX0&language=en (protection and monitoring; output); https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=6EP3333-7SB00-0AX0&language=en"
      },
      {
        "title": "No input",
        "symptom": "LED off, 0 VDC",
        "causes": [
          "Upstream breaker open (feeder protection: 4 A C / 6 A B up to 10 A C or 3RV2011-1EA10 set 4 A on 6EP3334)",
          "Internal fuse (5 A on 6EP3334, 3.15 A on 6EP3333/6EP3332)"
        ],
        "confirm": [
          "Measure L1/+ to L2/N/-: must be 85-264 VAC."
        ],
        "fix": [
          "Restore the feeder; replace the unit if input is present and output is dead."
        ],
        "source": "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=6EP3334-7SB00-3AX0&language=en (input: fuse protection type, fuse protection type in the feeder)"
      },
      {
        "title": "Output overvoltage",
        "symptom": "Output shut down at overvoltage",
        "causes": [
          "Overvoltage protection < 32 V (6EP3332) operated"
        ],
        "confirm": [
          "Check potentiometer setting and for back-feed."
        ],
        "fix": [
          "Remove cause and recycle input power."
        ],
        "source": "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=6EP3332-7SB00-0AX0&language=en (protection and monitoring: design of the overvoltage protection)"
      }
    ],
    "sources": [
      "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=6EP3334-7SB00-3AX0&language=en",
      "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=6EP3333-7SB00-0AX0&language=en",
      "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=6EP3332-7SB00-0AX0&language=en"
    ]
  },
  {
    "id": "omron-s8vk-c-psu",
    "title": "Omron S8VK-C 24 VDC power supply",
    "match": {
      "categories": [
        "powerSupply"
      ],
      "family": "S8VK-C"
    },
    "normal": [
      {
        "terminals": "L to N",
        "state": "mains on",
        "meter": "VAC",
        "expected": "100-240 VAC (allowable 85-264 VAC); DC input 90-350 VDC with + on L",
        "pins": [
          [
            "L",
            "N"
          ]
        ],
        "liveWork": true
      },
      {
        "terminals": "+V to -V",
        "state": "normal operation",
        "meter": "VDC",
        "expected": "24 VDC; V.ADJ range -10% to +15% (21.6-27.6 VDC)",
        "pins": [
          [
            "+V",
            "-V"
          ]
        ]
      }
    ],
    "indicators": [
      {
        "name": "DC ON (green)",
        "state": "on",
        "meaning": "DC output ON (lights from 80-90% or more of rated voltage)"
      },
      {
        "name": "DC ON (green)",
        "state": "flashing",
        "meaning": "Overload protection operating"
      },
      {
        "name": "DC ON (green)",
        "state": "off",
        "meaning": "No output: no input, or overcurrent/overvoltage protection operated"
      }
    ],
    "faults": [
      {
        "title": "Overload protection (intermittent)",
        "symptom": "DC ON flashes, output voltage drops/intermittent",
        "causes": [
          "Output current above 105% of rated current (overload protection 105-160%)",
          "Short-circuited load"
        ],
        "confirm": [
          "Remove the load wires and check whether the load is in overload or short-circuited."
        ],
        "fix": [
          "Remove the overload; protection clears automatically when current returns within rating."
        ],
        "source": "https://www.ia.omron.com/products/family/3201/download/catalog.html (S8VK-C Data Sheet, Cat. No. T058-E1 / T58I-E-02) (Overload Protection; In Case There Is No Output Voltage)"
      },
      {
        "title": "Overvoltage protection latched",
        "symptom": "No output, DC ON off",
        "causes": [
          "Output exceeded approx. 130% of rated voltage (feedback failure) or a large surge at power-on"
        ],
        "confirm": [
          "Turn input OFF for at least 3 minutes, then ON: output returns if it was the overvoltage/internal protection."
        ],
        "fix": [
          "Remove the cause before re-powering; reset by switching input off >= 3 min."
        ],
        "source": "https://www.ia.omron.com/products/family/3201/download/catalog.html (S8VK-C Data Sheet, Cat. No. T058-E1 / T58I-E-02) (Overvoltage Protection; note *5; In Case There Is No Output Voltage)"
      },
      {
        "title": "No input",
        "symptom": "DC ON off, 0 VDC at +V/-V",
        "causes": [
          "Upstream fuse/breaker open; internal fuse on L side (not user-replaceable)"
        ],
        "confirm": [
          "Measure L to N: 85-264 VAC expected."
        ],
        "fix": [
          "Restore input; replace unit if input is present and protection reset does not restore output."
        ],
        "source": "https://www.ia.omron.com/products/family/3201/download/catalog.html (S8VK-C Data Sheet, Cat. No. T058-E1 / T58I-E-02) (Connections table note *1)"
      }
    ],
    "sources": [
      "https://www.ia.omron.com/products/family/3201/download/catalog.html (S8VK-C Data Sheet, Cat. No. T058-E1 / T58I-E-02)"
    ]
  },
  {
    "id": "gladiator-mcb",
    "title": "Gladiator miniature circuit breaker / supplementary protector (AutomationDirect)",
    "match": {
      "categories": [
        "breaker"
      ],
      "manufacturer": "Gladiator"
    },
    "normal": [
      {
        "terminals": "line terminal to neutral / other phase",
        "state": "energized",
        "meter": "VAC",
        "expected": "supply voltage, within the rating: 1P 120/240 V (1-63 A) or 277 V (1-25 A); DC 1P 60 V, 2P/3P 125 V",
        "note": "Line voltage connection suitable for reverse feed (either end may be line).",
        "liveWork": true
      },
      {
        "terminals": "handle / status window",
        "state": "closed",
        "meter": "visual",
        "expected": "handle ON; status indicator red (Red = ON, Green = OFF)"
      }
    ],
    "indicators": [
      {
        "name": "Contact position indicator",
        "state": "red",
        "meaning": "Contacts closed (ON)"
      },
      {
        "name": "Contact position indicator",
        "state": "green",
        "meaning": "Contacts open (OFF or tripped)"
      }
    ],
    "faults": [
      {
        "title": "Tripped by short circuit",
        "symptom": "Breaker trips instantly when switched on or when the load starts",
        "causes": [
          "Fault current above the magnetic trip point: B 3-5 x In, C 5-10 x In, D 10-20 x In"
        ],
        "confirm": [
          "With power off, measure load-side conductor to neutral/ground: near 0 ohm indicates a short."
        ],
        "fix": [
          "Find and repair the short before resetting. Trip-free design: the breaker cannot be held ON against a fault."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/gladiatormcbul489.pdf (tCPR-268 Features, tCPR-273 Technical specifications)"
      },
      {
        "title": "Nuisance trip on inrush",
        "symptom": "Trips when a transformer, motor or power supply is switched on, no short found",
        "causes": [
          "Inrush exceeds magnetic trip point of the curve fitted (B or C on inductive loads)"
        ],
        "confirm": [
          "Compare the load type with the curve letter on the label: D curve is intended for motors, transformers and power supplies."
        ],
        "fix": [
          "Use the curve the maker specifies for the load (D curve for high-inrush loads)."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/gladiatormcbul489.pdf (tCPR-269 Tripping characteristics)"
      },
      {
        "title": "Thermal trip at high ambient",
        "symptom": "Trips after running a while in a hot enclosure at near-rated load",
        "causes": [
          "Load capacity derates above the 40 C calibration temperature (e.g. a 10 A device carries 8.4 A at 60 C)"
        ],
        "confirm": [
          "Measure load current with a clamp meter and the enclosure temperature; compare with the derating table."
        ],
        "fix": [
          "Reduce load, cool the enclosure, or select per the derating table."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/gladiatormcbul489.pdf (tCPR-274 Temperature derating UL 489)"
      },
      {
        "title": "Will not stay ON",
        "symptom": "Handle returns to OFF when closed",
        "causes": [
          "Fault still present on load side (trip-free mechanism)"
        ],
        "confirm": [
          "Disconnect the load wire and try again; if it holds ON, the fault is downstream."
        ],
        "fix": [
          "Clear the fault; replace the breaker if it trips with load disconnected."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/gladiatormcbul489.pdf (tCPR-268 Trip-free design); https://cdn.automationdirect.com/static/specs/gladiatormcbul1077.pdf (tCPR-270)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/gladiatormcbul489.pdf",
      "https://cdn.automationdirect.com/static/specs/gladiatormcbul1077.pdf"
    ]
  },
  {
    "id": "abb-s200u-mcb",
    "title": "ABB S200U / S200UP miniature circuit breaker",
    "match": {
      "categories": [
        "breaker"
      ],
      "family": "S200U"
    },
    "normal": [
      {
        "terminals": "line to load terminal of one closed pole",
        "state": "ON, carrying current",
        "meter": "VAC",
        "expected": "I x Ri; e.g. C10: Ri 13.3 mOhm -> about 0.13 V at 10 A; C16: Ri 7.0 mOhm -> about 0.11 V at 16 A",
        "note": "Internal resistance table; supply may be connected top or bottom (Supply: optional)."
      },
      {
        "terminals": "toggle / CPI",
        "state": "closed",
        "meter": "visual",
        "expected": "toggle at I (ON), Real CPI red"
      }
    ],
    "indicators": [
      {
        "name": "Real CPI",
        "state": "red",
        "meaning": "Contacts ON"
      },
      {
        "name": "Real CPI",
        "state": "green",
        "meaning": "Contacts OFF"
      },
      {
        "name": "Toggle marking",
        "state": "I / 0",
        "meaning": "ON / OFF"
      }
    ],
    "faults": [
      {
        "title": "Thermal trip from ambient derating",
        "symptom": "Trips at load below rating in a hot enclosure",
        "causes": [
          "Rating is referenced to 20 C (C, K, Z); at 50 C a 10 A device carries 7.9 A",
          "Several MCBs side by side with high load: factor 0.9 for 2-3 adjacent devices"
        ],
        "confirm": [
          "Clamp-measure load current; compare with the derating table at the enclosure temperature."
        ],
        "fix": [
          "Reduce load or improve cooling/spacing."
        ],
        "source": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC002168D0202&LanguageCode=en&DocumentPartId=&Action=Launch (p. 5 Deviating ambient temperature, Influence of adjacent devices)"
      },
      {
        "title": "Short-circuit trip",
        "symptom": "Trips immediately on closing",
        "causes": [
          "Short circuit beyond the C/K/Z magnetic band"
        ],
        "confirm": [
          "With power off, check load conductors for a short."
        ],
        "fix": [
          "Repair before reclosing."
        ],
        "source": "https://search.abb.com/library/Download.aspx?DocumentID=2CDC002168D0202&LanguageCode=en&DocumentPartId=&Action=Launch (p. 4 Tripping characteristics)"
      }
    ],
    "sources": [
      "https://search.abb.com/library/Download.aspx?DocumentID=2CDC002168D0202&LanguageCode=en&DocumentPartId=&Action=Launch"
    ]
  },
  {
    "id": "siemens-5sj4-mcb",
    "title": "Siemens SENTRON 5SJ4 miniature circuit breaker (UL 489)",
    "match": {
      "categories": [
        "breaker"
      ],
      "family": "5SJ4"
    },
    "normal": [
      {
        "terminals": "line to load terminal of one closed pole",
        "state": "ON at rated current",
        "meter": "VAC",
        "expected": "about P/I; 5SJ4106-7HG41 (C6): 2.7 W at 6 A -> about 0.45 V",
        "note": "Power loss per pole from the data sheet; position of supply cord: any.",
        "liveWork": true
      },
      {
        "terminals": "pole",
        "state": "supply",
        "meter": "VAC",
        "expected": "max 240 VAC per UL 489 (1-pole); 60 VDC 1-channel, 125 VDC 2-channel",
        "liveWork": true
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Thermal trip at high ambient",
        "symptom": "Trips below nameplate current when hot",
        "causes": [
          "Operational current reduces with temperature: C6 carries 5.7 A at 50 C, 5.4 A at 60 C; max operating ambient 55 C"
        ],
        "confirm": [
          "Measure load current and enclosure temperature."
        ],
        "fix": [
          "Reduce load or ambient."
        ],
        "source": "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SJ4106-7HG41&language=en (Voltage / operational current at 30-60 C; ambient temperature during operation)"
      },
      {
        "title": "Short-circuit trip",
        "symptom": "Trips instantly",
        "causes": [
          "Current above the instantaneous setting (7.5 x In on 5SJ4106-7HG41, C curve)"
        ],
        "confirm": [
          "With power off check the load wiring for a short."
        ],
        "fix": [
          "Repair before reclosing."
        ],
        "source": "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SJ4106-7HG41&language=en (Product function: set value Ii for I-tripping)"
      }
    ],
    "sources": [
      "https://support.industry.siemens.com/teddatasheet/?format=pdf&mlfbs=5SJ4106-7HG41&language=en"
    ]
  },
  {
    "id": "schneider-c60bp-mcb",
    "title": "Schneider Multi9 C60BP miniature circuit breaker",
    "match": {
      "categories": [
        "breaker"
      ],
      "family": "C60BP"
    },
    "normal": [
      {
        "terminals": "line to neutral (1P)",
        "state": "energized",
        "meter": "VAC",
        "expected": "up to 240 VAC (Ue 240/415 VAC, 60 VDC)",
        "liveWork": true
      },
      {
        "terminals": "toggle / contact position indicator",
        "state": "closed",
        "meter": "visual",
        "expected": "ON indication"
      }
    ],
    "indicators": [
      {
        "name": "Contact position indicator",
        "state": "ON / OFF",
        "meaning": "Local ON/OFF indication of the contacts"
      }
    ],
    "faults": [
      {
        "title": "Magnetic trip",
        "symptom": "Trips at switch-on or on a fault",
        "causes": [
          "Current above the magnetic tripping limit: 8.5 x In +/-20% AC, 12 x In +/-20% DC (C curve)"
        ],
        "confirm": [
          "With power off check the load side for a short; measure inrush if a transformer/motor is fed."
        ],
        "fix": [
          "Remove the fault; check curve suitability for the inrush."
        ],
        "source": "https://www.se.com/us/en/product/M9F42101/ (product data sheet M9F42101, Multi9 C60BP) (Complementary: magnetic tripping limit)"
      }
    ],
    "sources": [
      "https://www.se.com/us/en/product/M9F42101/ (product data sheet M9F42101, Multi9 C60BP)"
    ]
  },
  {
    "id": "ab-1489m-mcb",
    "title": "Allen-Bradley Bulletin 1489-M miniature circuit breaker",
    "match": {
      "categories": [
        "breaker"
      ],
      "family": "1489-M"
    },
    "normal": [
      {
        "terminals": "line to neutral (1P)",
        "state": "energized",
        "meter": "VAC",
        "expected": "up to 277 VAC (C 0.5-40 A) / 240 VAC (50-63 A); 48 VDC 1-pole",
        "note": "Line and load may be reversed (may be bottom fed).",
        "liveWork": true
      },
      {
        "terminals": "indicator window",
        "state": "closed",
        "meter": "visual",
        "expected": "red (ON)"
      }
    ],
    "indicators": [
      {
        "name": "Indicator window",
        "state": "red",
        "meaning": "ON"
      },
      {
        "name": "Indicator window",
        "state": "green",
        "meaning": "OFF"
      }
    ],
    "faults": [
      {
        "title": "Trips on continuous load",
        "symptom": "Trips after long running at near-rated current",
        "causes": [
          "1489-M is non-100% rated: load no more than 80% of rating on continuous loads"
        ],
        "confirm": [
          "Clamp-measure load current vs. 80% of the rating."
        ],
        "fix": [
          "Reduce continuous load or resize per the guide."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/sg/1492-sg122_-en-p.pdf (p. 10 Application information)"
      },
      {
        "title": "Nuisance magnetic trip on transients",
        "symptom": "Trips on switch-on transients",
        "causes": [
          "Type C trips magnetically at 5-10 x In"
        ],
        "confirm": [
          "Check whether the load has high switch-on transients."
        ],
        "fix": [
          "Type D allows transients about twice as high as Type C."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/sg/1492-sg122_-en-p.pdf (p. 10 Tripping characteristics)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/sg/1492-sg122_-en-p.pdf"
    ]
  },
  {
    "id": "fuse-class-t",
    "title": "Class T fuses and holders (Edison TJN/TJS via AutomationDirect)",
    "match": {
      "categories": [
        "fuse"
      ],
      "ratings": {
        "fuseClass": "T"
      }
    },
    "normal": [
      {
        "terminals": "across fuse (removed)",
        "state": "out of circuit",
        "meter": "continuity",
        "expected": "low resistance (continuous)"
      },
      {
        "terminals": "fuse rating",
        "state": "selection",
        "meter": "visual",
        "expected": "TJN 300 VAC, TJS 600 VAC; 200 kA interrupting"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Fuse open (blown)",
        "symptom": "Load dead downstream of the fuse, supply present upstream",
        "causes": [
          "Overload or short circuit downstream"
        ],
        "confirm": [
          "Power off and remove the fuse: a continuity test shows low resistance for a good fuse and extremely high resistance for an open fuse.",
          "On an indicating holder (e.g. CH30J1I neon), the lamp lights across an open fuse when at least 90 VAC is present (minimum indicating voltage)."
        ],
        "fix": [
          "Find the cause of the overcurrent, then replace with the same class, voltage and amp rating (voltage rating must be >= circuit voltage)."
        ],
        "source": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/technical-literature/bus-ele-an-3002-spd.pdf (Bussmann SPD handbook 3002, fuse testing per NFPA 70B 21.18); https://cdn.automationdirect.com/static/specs/efuseholders.pdf (tCPR-238 minimum indicating voltage 90 V)"
      },
      {
        "title": "Wrong test point",
        "symptom": "Meter says fuse is good/bad inconsistently",
        "causes": [
          "Measuring on knife-blade fuse caps, which are not guaranteed to be in the circuit"
        ],
        "confirm": [
          "On knife-blade fuses measure only along the blades, never the caps."
        ],
        "fix": [
          "Re-test at the blades."
        ],
        "source": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/protective-device-ratings/bus-ele-voltage-rating.pdf"
      },
      {
        "title": "Opens on inrush / short overloads",
        "symptom": "Fuse blows on equipment start without a hard fault",
        "causes": [
          "TJN/TJS are extremely fast-acting: no intentional time delay, opens quickly on overload"
        ],
        "confirm": [
          "Compare the application (motor/transformer inrush) with the fast-acting characteristic."
        ],
        "fix": [
          "Use the fuse type the equipment manual specifies (e.g. GS20/GS30 drive input tables)."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/efuset.pdf (tCPR-199 TJN/S features)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/efuset.pdf",
      "https://cdn.automationdirect.com/static/specs/efuseblockst.pdf",
      "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/technical-literature/bus-ele-an-3002-spd.pdf (Bussmann SPD handbook 3002, fuse testing per NFPA 70B 21.18)",
      "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/protective-device-ratings/bus-ele-voltage-rating.pdf"
    ]
  },
  {
    "id": "fuse-class-j",
    "title": "Class J fuses and CH holders (Edison JHL / Bussmann CH via AutomationDirect)",
    "match": {
      "categories": [
        "fuse"
      ],
      "ratings": {
        "fuseClass": "J"
      }
    },
    "normal": [
      {
        "terminals": "across fuse (removed)",
        "state": "out of circuit",
        "meter": "continuity",
        "expected": "low resistance (continuous)"
      },
      {
        "terminals": "indicating holder neon (CH30J_I / CH60J_I)",
        "state": "fuse healthy",
        "meter": "LED",
        "expected": "off"
      }
    ],
    "indicators": [
      {
        "name": "Neon indicator (CH..J..I holders)",
        "state": "lit",
        "meaning": "Fuse open with >= 90 VAC across it"
      }
    ],
    "faults": [
      {
        "title": "Fuse open (blown)",
        "symptom": "Load dead downstream of the fuse, supply present upstream",
        "causes": [
          "Overload or short circuit downstream"
        ],
        "confirm": [
          "Power off and remove the fuse: a continuity test shows low resistance for a good fuse and extremely high resistance for an open fuse.",
          "On an indicating holder (e.g. CH30J1I neon), the lamp lights across an open fuse when at least 90 VAC is present (minimum indicating voltage)."
        ],
        "fix": [
          "Find the cause of the overcurrent, then replace with the same class, voltage and amp rating (voltage rating must be >= circuit voltage)."
        ],
        "source": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/technical-literature/bus-ele-an-3002-spd.pdf (Bussmann SPD handbook 3002, fuse testing per NFPA 70B 21.18); https://cdn.automationdirect.com/static/specs/efuseholders.pdf (tCPR-238 minimum indicating voltage 90 V)"
      },
      {
        "title": "Wrong test point",
        "symptom": "Meter says fuse is good/bad inconsistently",
        "causes": [
          "Measuring on knife-blade fuse caps, which are not guaranteed to be in the circuit"
        ],
        "confirm": [
          "On knife-blade fuses measure only along the blades, never the caps."
        ],
        "fix": [
          "Re-test at the blades."
        ],
        "source": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/protective-device-ratings/bus-ele-voltage-rating.pdf"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/efusejhl.pdf",
      "https://cdn.automationdirect.com/static/specs/efuseholders.pdf",
      "https://www.eaton.com/us/en-us/skuPage.CH30J1I.html (Bussmann CH series Class J holders, data sheet 2144)",
      "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/technical-literature/bus-ele-an-3002-spd.pdf (Bussmann SPD handbook 3002, fuse testing per NFPA 70B 21.18)",
      "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/protective-device-ratings/bus-ele-voltage-rating.pdf"
    ]
  },
  {
    "id": "fuse-class-cc",
    "title": "Class CC fuses and holders (Edison HCLR / EHCC via AutomationDirect)",
    "match": {
      "categories": [
        "fuse"
      ],
      "ratings": {
        "fuseClass": "CC"
      }
    },
    "normal": [
      {
        "terminals": "across fuse (removed)",
        "state": "out of circuit",
        "meter": "continuity",
        "expected": "low resistance (continuous)"
      },
      {
        "terminals": "fuse rating",
        "state": "selection",
        "meter": "visual",
        "expected": "HCLR: 600 VAC, fast-acting, 200 kA"
      }
    ],
    "indicators": [],
    "faults": [
      {
        "title": "Fuse open (blown)",
        "symptom": "Load dead downstream of the fuse, supply present upstream",
        "causes": [
          "Overload or short circuit downstream"
        ],
        "confirm": [
          "Power off and remove the fuse: a continuity test shows low resistance for a good fuse and extremely high resistance for an open fuse.",
          "On an indicating holder (e.g. CH30J1I neon), the lamp lights across an open fuse when at least 90 VAC is present (minimum indicating voltage)."
        ],
        "fix": [
          "Find the cause of the overcurrent, then replace with the same class, voltage and amp rating (voltage rating must be >= circuit voltage)."
        ],
        "source": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/technical-literature/bus-ele-an-3002-spd.pdf (Bussmann SPD handbook 3002, fuse testing per NFPA 70B 21.18); https://cdn.automationdirect.com/static/specs/efuseholders.pdf (tCPR-238 minimum indicating voltage 90 V)"
      },
      {
        "title": "Wrong test point",
        "symptom": "Meter says fuse is good/bad inconsistently",
        "causes": [
          "Measuring on knife-blade fuse caps, which are not guaranteed to be in the circuit"
        ],
        "confirm": [
          "On knife-blade fuses measure only along the blades, never the caps."
        ],
        "fix": [
          "Re-test at the blades."
        ],
        "source": "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/protective-device-ratings/bus-ele-voltage-rating.pdf"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/efusehclr.pdf",
      "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/technical-literature/bus-ele-an-3002-spd.pdf (Bussmann SPD handbook 3002, fuse testing per NFPA 70B 21.18)",
      "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/protective-device-ratings/bus-ele-voltage-rating.pdf"
    ]
  },
  {
    "id": "fuji-sc-e-contactor",
    "title": "Fuji Electric SC-E contactor (AutomationDirect)",
    "match": {
      "categories": [
        "contactor"
      ],
      "family": "SC-E"
    },
    "normal": [
      {
        "terminals": "A1 to A2",
        "state": "coil energized, 24 VDC coil (SC-E..PG-24VDC, SC-E1G)",
        "meter": "VDC",
        "expected": "24 VDC; pick-up 0.85-1.1 x rated (20.4-26.4 V); drop-out 0.1-0.75 x rated",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "A1 to A2",
        "state": "coil energized, AC coil 110VAC (100-110 V 50 Hz / 110-120 V 60 Hz)",
        "meter": "VAC",
        "expected": "pick-up 0.85-1.1 x rated; drop-out 0.2-0.75 x rated",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "A1 to A2",
        "state": "operating",
        "meter": "VAC",
        "expected": "within 85-110% of coil voltage (allowable fluctuation)",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ],
        "liveWork": true
      },
      {
        "terminals": "1/L1-2/T1, 3/L2-4/T2, 5/L3-6/T3",
        "state": "coil energized",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "1/L1",
            "2/T1"
          ],
          [
            "3/L2",
            "4/T2"
          ],
          [
            "5/L3",
            "6/T3"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "1/L1",
        "b": "2/T1",
        "when": "energized",
        "note": "INA-F0154-E: main poles L1-T1, L2-T2, L3-T3 (marked 1/L1 3/L2 5/L3, 2/T1 4/T2 6/T3). SC-E02..E4 have no built-in aux, so no 13-14/21-22 pair. https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf https://cdn.automationdirect.com/static/specs/fujimc9150.pdf"
      },
      {
        "a": "3/L2",
        "b": "4/T2",
        "when": "energized",
        "note": "INA-F0154-E: main poles L1-T1, L2-T2, L3-T3 (marked 1/L1 3/L2 5/L3, 2/T1 4/T2 6/T3). SC-E02..E4 have no built-in aux, so no 13-14/21-22 pair. https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf https://cdn.automationdirect.com/static/specs/fujimc9150.pdf"
      },
      {
        "a": "5/L3",
        "b": "6/T3",
        "when": "energized",
        "note": "INA-F0154-E: main poles L1-T1, L2-T2, L3-T3 (marked 1/L1 3/L2 5/L3, 2/T1 4/T2 6/T3). SC-E02..E4 have no built-in aux, so no 13-14/21-22 pair. https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf https://cdn.automationdirect.com/static/specs/fujimc9150.pdf"
      }
    ],
    "indicators": [
      {
        "name": "Operation indicator",
        "state": "in / out",
        "meaning": "Shows whether the contactor is operated (do not push it for a continuity test)"
      }
    ],
    "faults": [
      {
        "title": "Does not pull in",
        "symptom": "Coil voltage applied, contactor does not close",
        "causes": [
          "Coil voltage below pick-up (0.85 x rated)",
          "Wrong coil voltage code for the control supply"
        ],
        "confirm": [
          "Measure A1 to A2 while commanded: must be 85-110% of the coil rating.",
          "Check the coil voltage code on the label against the control voltage."
        ],
        "fix": [
          "Restore control voltage within 85-110%, or fit the correct coil voltage."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf (Fuji INA-F0154-E) (7 Maintenance and inspection (1)); https://cdn.automationdirect.com/static/specs/fujimc9150.pdf (tMRC-50 coil characteristics)"
      },
      {
        "title": "Chatter / drops out",
        "symptom": "Contactor chatters or releases while commanded",
        "causes": [
          "Control voltage sagging toward drop-out (0.2-0.75 x rated AC, 0.1-0.75 x rated DC) or below the 85% allowable minimum"
        ],
        "confirm": [
          "Measure A1-A2 during operation and at motor start."
        ],
        "fix": [
          "Correct control supply sizing/wiring."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/fujimc9150.pdf (tMRC-50); https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf (Fuji INA-F0154-E) (7)"
      },
      {
        "title": "Welded contacts",
        "symptom": "Motor keeps running after coil de-energized",
        "causes": [
          "Contacts welded after short-circuit duty or overload"
        ],
        "confirm": [
          "Measure A1-A2 = 0 V while 2/T1, 4/T2, 6/T3 still carry line voltage."
        ],
        "fix": [
          "Take off the arc chamber; pry lightly welded contacts apart with a screwdriver if needed. Replace if facings are worn down to the carrier."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf (Fuji INA-F0154-E) (7 Maintenance (3), (5))"
      },
      {
        "title": "Worn contacts",
        "symptom": "Heat or voltage loss across poles",
        "causes": [
          "Contact erosion"
        ],
        "confirm": [
          "Inspect: dark and rough contacts still function; replace only when carrier material is visible."
        ],
        "fix": [
          "Do not refinish or grease contacts; replace the product if worn through."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf (Fuji INA-F0154-E) (7 Maintenance (4), (5))"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/fujimc9150.pdf",
      "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf (Fuji INA-F0154-E)"
    ]
  },
  {
    "id": "fuji-tk-e-overload",
    "title": "Fuji Electric TK-E thermal overload relay (AutomationDirect)",
    "match": {
      "categories": [
        "overload"
      ],
      "partNumber": "^TK-E"
    },
    "normal": [
      {
        "terminals": "95-96 (NC)",
        "state": "not tripped",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "95",
            "96"
          ]
        ]
      },
      {
        "terminals": "97-98 (NO)",
        "state": "not tripped",
        "meter": "continuity",
        "expected": "open",
        "pins": [
          [
            "97",
            "98"
          ]
        ]
      },
      {
        "terminals": "adjustment dial",
        "state": "set",
        "meter": "visual",
        "expected": "motor full-load current at the mark, within the dial range"
      },
      {
        "terminals": "2/T1, 4/T2, 6/T3",
        "state": "running",
        "meter": "VAC",
        "expected": "balanced phase voltages (open-phase protection trips on a lost phase)",
        "pins": [
          [
            "2/T1",
            "4/T2"
          ],
          [
            "4/T2",
            "6/T3"
          ],
          [
            "2/T1",
            "6/T3"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "95",
        "b": "96",
        "when": "not tripped",
        "note": "https://cdn.automationdirect.com/static/specs/fujimcor.pdf and https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf wiring diagram: 95-96 N.C. and 97-98 N.O. overload contacts"
      },
      {
        "a": "97",
        "b": "98",
        "when": "tripped",
        "note": "https://cdn.automationdirect.com/static/specs/fujimcor.pdf and https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/contactor_sce02e05.pdf wiring diagram: 95-96 N.C. and 97-98 N.O. overload contacts"
      }
    ],
    "indicators": [
      {
        "name": "Trip bar",
        "state": "projected length (Fig. 4)",
        "meaning": "Shows non-operation vs operation (tripped) status"
      }
    ],
    "faults": [
      {
        "title": "Trips at start / during run",
        "symptom": "Motor stops; 95-96 open, trip indicator changed",
        "causes": [
          "Dial set below motor FLA (trip class 10A)",
          "Motor overload"
        ],
        "confirm": [
          "Read the dial setting vs nameplate FLA; clamp-measure each phase current.",
          "Measure 95-96: open = tripped."
        ],
        "fix": [
          "Set the dial so FLA is at the mark; remove the overload cause, then press the reset button fully."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/tk-e0.pdf (Fuji INA-F2011a-JE, TK-E02) (6 Usage (1), (3)); https://cdn.automationdirect.com/static/specs/fujimcor.pdf (tMRC-65 Trip class 10A)"
      },
      {
        "title": "Phase loss trip",
        "symptom": "Trips quickly with one phase low/missing",
        "causes": [
          "Open phase upstream (fuse, breaker pole, contactor pole, loose terminal)"
        ],
        "confirm": [
          "Measure line voltage phase-to-phase at 1/L1-3/L2-5/L3 and current on each phase: one phase near 0 A confirms."
        ],
        "fix": [
          "Repair the open phase; reset the relay after it cools."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/fujimcor.pdf (tMRC-62 features: open-phase protection; tMRC-66 operating characteristics open-phase)"
      },
      {
        "title": "Will not reset",
        "symptom": "Reset pressed, 95-96 stays open",
        "causes": [
          "Thermal overload relay not cooled sufficiently"
        ],
        "confirm": [
          "Wait for the relay to cool, press the reset button, then measure 95-96 (closed = reset)."
        ],
        "fix": [
          "Remove the cause of the overload, allow cooling, then reset."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/tk-e0.pdf (Fuji INA-F2011a-JE, TK-E02) (6 Usage (3))"
      },
      {
        "title": "Unexpected auto restart",
        "symptom": "Motor restarts by itself after trip",
        "causes": [
          "Relay set to automatic reset in a two-wire control circuit"
        ],
        "confirm": [
          "Inspect the reset button: in auto mode it does not jump out."
        ],
        "fix": [
          "Use manual reset where unexpected restart is a hazard."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/tk-e0.pdf (Fuji INA-F2011a-JE, TK-E02) (6 Usage (5), (6), Fig. 5)"
      },
      {
        "title": "Sequence check (test)",
        "symptom": "Need to prove the control circuit",
        "causes": [
          "Commissioning / troubleshooting"
        ],
        "confirm": [
          "Push the trip bar in the arrow direction: the sequence check starts; verify the control circuit drops out."
        ],
        "fix": [
          "Reset afterwards."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/tk-e0.pdf (Fuji INA-F2011a-JE, TK-E02) (6 Usage (2), Fig. 3)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/fujimcor.pdf",
      "https://cdn.automationdirect.com/static/manuals/fujimotorcontrolm/tk-e0.pdf (Fuji INA-F2011a-JE, TK-E02)"
    ]
  },
  {
    "id": "ad-78x-ice-cube-relay",
    "title": "AutomationDirect 782 / 784 ice-cube control relay",
    "match": {
      "categories": [
        "relay"
      ],
      "manufacturer": "AutomationDirect",
      "partNumber": "^78[1-4]-[1-4]C-[0-9]"
    },
    "normal": [
      {
        "terminals": "13 (A1) to 14 (A2)",
        "state": "coil energized, 24 VDC coil",
        "meter": "VDC",
        "expected": "24 VDC; must pull in at <= 80% (19.2 V); drops out at >= 10% (2.4 V); max 110% continuous",
        "pins": [
          [
            "13",
            "14"
          ]
        ]
      },
      {
        "terminals": "13 (A1) to 14 (A2)",
        "state": "coil energized, 120 VAC coil",
        "meter": "VAC",
        "expected": "120 VAC; pull-in <= 85%, drop-out >= 15%, max 110%",
        "pins": [
          [
            "13",
            "14"
          ]
        ],
        "liveWork": true
      },
      {
        "terminals": "13 (A1) to 14 (A2)",
        "state": "power off, relay pulled or wires lifted",
        "meter": "ohms",
        "expected": "782: 24VDC 640 ohm, 12VDC 177, 24VAC 177, 120VAC 4.43 k, 240VAC 17.72 k; 784: 24VDC 303 ohm, 120VAC 2.1 k",
        "pins": [
          [
            "13",
            "14"
          ]
        ]
      },
      {
        "terminals": "9 (11) - 5 (14) and 12 (41) - 8 (44)",
        "state": "coil energized (782)",
        "meter": "continuity",
        "expected": "closed (NO)",
        "pins": [
          [
            "9",
            "5"
          ],
          [
            "12",
            "8"
          ]
        ]
      },
      {
        "terminals": "9 (11) - 1 (12) and 12 (41) - 4 (42)",
        "state": "coil de-energized (782)",
        "meter": "continuity",
        "expected": "closed (NC)",
        "pins": [
          [
            "9",
            "1"
          ],
          [
            "12",
            "4"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "9",
        "b": "5",
        "when": "energized",
        "note": "78relays.pdf, pin end: common 9/10/11/12, N.O. 5/6/7/8, N.C. 1/2/3/4, coil 13-14. Poles: 781 = 1; 782 = 1, 4 (9, 12); 783 = 1, 2, 4; 784 all. https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
      },
      {
        "a": "10",
        "b": "6",
        "when": "energized",
        "note": "78relays.pdf, pin end: common 9/10/11/12, N.O. 5/6/7/8, N.C. 1/2/3/4, coil 13-14. Poles: 781 = 1; 782 = 1, 4 (9, 12); 783 = 1, 2, 4; 784 all. https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
      },
      {
        "a": "11",
        "b": "7",
        "when": "energized",
        "note": "78relays.pdf, pin end: common 9/10/11/12, N.O. 5/6/7/8, N.C. 1/2/3/4, coil 13-14. Poles: 781 = 1; 782 = 1, 4 (9, 12); 783 = 1, 2, 4; 784 all. https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
      },
      {
        "a": "12",
        "b": "8",
        "when": "energized",
        "note": "78relays.pdf, pin end: common 9/10/11/12, N.O. 5/6/7/8, N.C. 1/2/3/4, coil 13-14. Poles: 781 = 1; 782 = 1, 4 (9, 12); 783 = 1, 2, 4; 784 all. https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
      },
      {
        "a": "9",
        "b": "1",
        "when": "de-energized",
        "note": "78relays.pdf, pin end: common 9/10/11/12, N.O. 5/6/7/8, N.C. 1/2/3/4, coil 13-14. Poles: 781 = 1; 782 = 1, 4 (9, 12); 783 = 1, 2, 4; 784 all. https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
      },
      {
        "a": "10",
        "b": "2",
        "when": "de-energized",
        "note": "78relays.pdf, pin end: common 9/10/11/12, N.O. 5/6/7/8, N.C. 1/2/3/4, coil 13-14. Poles: 781 = 1; 782 = 1, 4 (9, 12); 783 = 1, 2, 4; 784 all. https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
      },
      {
        "a": "11",
        "b": "3",
        "when": "de-energized",
        "note": "78relays.pdf, pin end: common 9/10/11/12, N.O. 5/6/7/8, N.C. 1/2/3/4, coil 13-14. Poles: 781 = 1; 782 = 1, 4 (9, 12); 783 = 1, 2, 4; 784 all. https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
      },
      {
        "a": "12",
        "b": "4",
        "when": "de-energized",
        "note": "78relays.pdf, pin end: common 9/10/11/12, N.O. 5/6/7/8, N.C. 1/2/3/4, coil 13-14. Poles: 781 = 1; 782 = 1, 4 (9, 12); 783 = 1, 2, 4; 784 all. https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
      }
    ],
    "indicators": [
      {
        "name": "LED",
        "state": "on",
        "meaning": "Coil energized"
      },
      {
        "name": "Mechanical flag",
        "state": "operated",
        "meaning": "Relay operated (powered or manually via push-to-test)"
      },
      {
        "name": "Lockable push-to-test button",
        "state": "locked down",
        "meaning": "Contacts held in operate position for circuit analysis"
      }
    ],
    "faults": [
      {
        "title": "Does not pick up",
        "symptom": "Coil voltage present, LED/flag do not change",
        "causes": [
          "Coil voltage below pull-in",
          "Open coil"
        ],
        "confirm": [
          "Measure 13-14 while commanded (>= 80% DC / 85% AC of nominal).",
          "Power off and measure coil resistance; open = coil failed."
        ],
        "fix": [
          "Correct supply or replace the relay."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/78relays.pdf (tREL-18 coil specifications); https://cdn.automationdirect.com/static/specs/78relaysockets.pdf (tREL-21 wiring diagrams)"
      },
      {
        "title": "Does not drop out",
        "symptom": "Relay stays on with command removed",
        "causes": [
          "Leakage voltage on the coil above drop-out (10% DC / 15% AC)",
          "Push-to-test lock-down engaged"
        ],
        "confirm": [
          "Measure residual voltage at 13-14 with command off.",
          "Check the lock-down door."
        ],
        "fix": [
          "Remove leakage path; release the lock-down."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/78relays.pdf (tREL-16 features, tREL-18 dropout voltage)"
      },
      {
        "title": "Contact not switching low-level signal",
        "symptom": "PLC input through contact unreliable",
        "causes": [
          "Load below minimum switching requirement"
        ],
        "confirm": [
          "Minimum switching requirement 10 mA @ 17 VDC."
        ],
        "fix": [
          "Ensure the circuit meets the minimum; otherwise use a suitable relay."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/78relays.pdf (tREL-18 contact specifications)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/78relays.pdf",
      "https://cdn.automationdirect.com/static/specs/78relaysockets.pdf"
    ]
  },
  {
    "id": "gefran-gq-ssr",
    "title": "Gefran GQ solid state relay (AutomationDirect)",
    "match": {
      "categories": [
        "relay"
      ],
      "family": "\\bGQ\\b"
    },
    "normal": [
      {
        "terminals": "A1 to A2",
        "state": "ON command, DC control (GQ...-D-)",
        "meter": "VDC",
        "expected": "3-32 VDC; turn ON >= 2.7 VDC, turn OFF <= 1 VDC; <= 13 mA at 32 V",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "L1 to T1",
        "state": "ON, at nominal current",
        "meter": "VAC",
        "expected": "<= 1.45 Vrms (GQ15/25), <= 1.35 Vrms (GQ50)",
        "pins": [
          [
            "L1",
            "T1"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "L1",
        "b": "T1",
        "when": "ON (control voltage applied to A1-A2)",
        "note": "https://cdn.automationdirect.com/static/manuals/gefranrelays/gq_05_2024_manual.pdf: output L1 - T1 switched by the A1/A2 control input (AC load)"
      }
    ],
    "indicators": [
      {
        "name": "Green LED",
        "state": "on",
        "meaning": "Drive active (control input ON)"
      }
    ],
    "faults": [
      {
        "title": "Does not turn on",
        "symptom": "Green LED off with command",
        "causes": [
          "Control voltage below 2.7 VDC or reversed"
        ],
        "confirm": [
          "Measure A1(+) to A2: must be >= 2.7 VDC (DC models)."
        ],
        "fix": [
          "Correct control wiring/polarity (reverse voltage < 36 VDC)."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gefranrelays/gq_05_2024_manual.pdf (Technical data: control input A1-A2)"
      },
      {
        "title": "Load stays on / leakage",
        "symptom": "Small load partially energized when OFF",
        "causes": [
          "Off-state leakage current (<= 8 mArms)",
          "Load below minimum load current (0.1 Arms GQ15, 0.3 Arms GQ50)"
        ],
        "confirm": [
          "Measure A1-A2 <= 1 VDC (OFF) and the residual load current."
        ],
        "fix": [
          "Use a load above the minimum current; replace SSR if it conducts with control OFF."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gefranrelays/gq_05_2024_manual.pdf (Technical data: output L1-T1)"
      },
      {
        "title": "Overheating",
        "symptom": "SSR hot, intermittent operation",
        "causes": [
          "Heatsink undersized: Pd = 1.45 x Irms W (GQ15/25)"
        ],
        "confirm": [
          "Measure load current; compute dissipation; check heatsink thermal resistance."
        ],
        "fix": [
          "Use a heatsink with Rth below (90 C - Tamb max)/Pd; apply thermal paste/pad."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gefranrelays/gq_05_2024_manual.pdf (Solid state relay dissipated power calculation)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/gefranrelays/gq_05_2024_manual.pdf"
    ]
  },
  {
    "id": "gefran-grsh-ssr",
    "title": "Gefran GRS-H solid state relay (AutomationDirect)",
    "match": {
      "categories": [
        "relay"
      ],
      "family": "\\bGRSH\\b"
    },
    "normal": [
      {
        "terminals": "4/A1+ to 3/A2-",
        "state": "ON command (D-0 control input)",
        "meter": "VDC",
        "expected": "5.1-32 VDC; activation > 5.1 VDC, deactivation < 5 VDC; < 9 mA at 32 V",
        "pins": [
          [
            "4/A1+",
            "3/A2-"
          ]
        ]
      },
      {
        "terminals": "1/L1 to 2/T1",
        "state": "ON at rated current",
        "meter": "VAC",
        "expected": "< 1.2 Vrms potential drop",
        "pins": [
          [
            "1/L1",
            "2/T1"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "1/L1",
        "b": "2/T1",
        "when": "ON (control voltage applied to 4/A1+ - 3/A2-)",
        "note": "https://cdn.automationdirect.com/static/manuals/gefranrelays/grsh_06_2024_manual.pdf: 1/L1 Line Connection, 2/T1 Load Connection, control input 4/A1+ 3/A2- (AC load)"
      }
    ],
    "indicators": [
      {
        "name": "LED Control (green)",
        "state": "on",
        "meaning": "SCR ON"
      },
      {
        "name": "LED Control (green)",
        "state": "off",
        "meaning": "SCR OFF"
      },
      {
        "name": "LED Temp Alarm (yellow, optional)",
        "state": "on",
        "meaning": "Thermal protection active: conduction interrupted"
      },
      {
        "name": "LED Fault Alarm (red, optional)",
        "state": "on",
        "meaning": "Alarm output active (interrupted load / line)"
      }
    ],
    "faults": [
      {
        "title": "Does not turn on",
        "symptom": "Green LED off with command",
        "causes": [
          "Control voltage below 5.1 VDC"
        ],
        "confirm": [
          "Measure 4/A1+ to 3/A2-."
        ],
        "fix": [
          "Correct control signal."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gefranrelays/grsh_06_2024_manual.pdf (Control input; signal connector terminals)"
      },
      {
        "title": "Thermal protection",
        "symptom": "Load turns off, yellow LED on",
        "causes": [
          "SCR temperature over threshold (optional; always present >= 50 A)"
        ],
        "confirm": [
          "Check heatsink/airflow, load current and ambient."
        ],
        "fix": [
          "Improve cooling or reduce load; alarm resets when normal conditions return."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/gefranrelays/grsh_06_2024_manual.pdf (Thermal protection; LED status description)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/gefranrelays/grsh_06_2024_manual.pdf"
    ]
  },
  {
    "id": "dold-lg5925-estop",
    "title": "Dold SAFEMASTER LG 5925 E-stop / gate safety relay",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "partNumber": "^LG5925-48-61"
    },
    "normal": [
      {
        "terminals": "A1(+) to A2",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 V AC/DC; range 0.9-1.1 UN",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "S11 to S21",
        "state": "powered (AC/DC units)",
        "meter": "VDC",
        "expected": "DC 22 V control voltage",
        "pins": [
          [
            "S11",
            "S21"
          ]
        ]
      },
      {
        "terminals": "S12, S22 to S21",
        "state": "E-stop released, relays activated",
        "meter": "VDC",
        "expected": ">= DC 20 V (AC/DC units)",
        "pins": [
          [
            "S12",
            "S21"
          ],
          [
            "S22",
            "S21"
          ]
        ]
      },
      {
        "terminals": "13-14, 23-24, 33-34",
        "state": "K1/K2 energized",
        "meter": "continuity",
        "expected": "closed (forcibly guided NO safety contacts)",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ],
          [
            "33",
            "34"
          ]
        ]
      },
      {
        "terminals": "41-42",
        "state": "K1/K2 energized",
        "meter": "continuity",
        "expected": "open (NC monitoring only)",
        "pins": [
          [
            "41",
            "42"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK (K1/K2 energized)",
        "note": "https://www.dold.com/downloads/LG5925_DB.pdf: 13-14, 23-24, 33-34 forcibly guided NO safety contacts; 41-42 NC \"can only be used for monitoring\" (LG 5925.48: 3 NO, 1 NC)"
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK (K1/K2 energized)",
        "note": "https://www.dold.com/downloads/LG5925_DB.pdf: 13-14, 23-24, 33-34 forcibly guided NO safety contacts; 41-42 NC \"can only be used for monitoring\" (LG 5925.48: 3 NO, 1 NC)"
      },
      {
        "a": "33",
        "b": "34",
        "when": "safety OK (K1/K2 energized)",
        "note": "https://www.dold.com/downloads/LG5925_DB.pdf: 13-14, 23-24, 33-34 forcibly guided NO safety contacts; 41-42 NC \"can only be used for monitoring\" (LG 5925.48: 3 NO, 1 NC)"
      },
      {
        "a": "41",
        "b": "42",
        "when": "safety not OK (K1/K2 de-energized)",
        "note": "https://www.dold.com/downloads/LG5925_DB.pdf: 13-14, 23-24, 33-34 forcibly guided NO safety contacts; 41-42 NC \"can only be used for monitoring\" (LG 5925.48: 3 NO, 1 NC)"
      }
    ],
    "indicators": [
      {
        "name": "Power",
        "state": "on",
        "meaning": "Supply connected"
      },
      {
        "name": "K1 / K2",
        "state": "on",
        "meaning": "Relay K1 and K2 energized"
      }
    ],
    "faults": [
      {
        "title": "No power LED",
        "symptom": "LED Power off",
        "causes": [
          "Power supply not connected",
          "Cross fault between S11 and S21"
        ],
        "confirm": [
          "Measure A1-A2 (24 V AC/DC).",
          "Disconnect E-stop wiring and check S11-S21 for a short."
        ],
        "fix": [
          "Restore supply / remove the cross fault."
        ],
        "source": "https://www.dold.com/downloads/LG5925_DB.pdf (LG 5925 / 01.04.22 en / 542A) (Troubleshooting, p. 18)"
      },
      {
        "title": "One channel only (K1 on, K2 off or vice versa)",
        "symptom": "Only one K LED lit",
        "causes": [
          "Safety relay K1 (or K2) welded - replace device",
          "One-channel switch-off occurred on S12 (or S22)"
        ],
        "confirm": [
          "Measure S12 and S22 to S21: one channel at 0 V means that channel was opened alone."
        ],
        "fix": [
          "Open the other channel too (operate the E-stop fully), then restart; replace the device if a relay is welded."
        ],
        "source": "https://www.dold.com/downloads/LG5925_DB.pdf (LG 5925 / 01.04.22 en / 542A) (Troubleshooting)"
      },
      {
        "title": "Will not reset (manual start)",
        "symptom": "Inputs closed, outputs do not close on start",
        "causes": [
          "Line fault on the start (On) button - start closed before S12/S22 energized"
        ],
        "confirm": [
          "Check the start circuit at S33-S34 is open when not pressed."
        ],
        "fix": [
          "Disconnect power and remove the fault."
        ],
        "source": "https://www.dold.com/downloads/LG5925_DB.pdf (LG 5925 / 01.04.22 en / 542A) (Notes: line fault detection; Troubleshooting); https://www.dold.com/downloads/Katalog_Sicherheitstechnik_KE01.pdf (LG 5925: start button connected to S33-S34 for manual start)"
      },
      {
        "title": "Will not start (automatic mode)",
        "symptom": "Automatic start selected but outputs stay off",
        "causes": [
          "S33-S34 not bridged",
          "A safety relay welded",
          "Incorrect setting of switch S1 (cross-fault monitoring)"
        ],
        "confirm": [
          "Check the S33-S34 link and the S1/S2 switch positions (only change S1 with power off)."
        ],
        "fix": [
          "Auto start only where risk assessment and drawings call for it. Never bridge S33-S34 on an E-stop or guard relay. Fix S1; replace if contacts welded."
        ],
        "source": "https://www.dold.com/downloads/LG5925_DB.pdf (LG 5925 / 01.04.22 en / 542A) (Notes; Troubleshooting)"
      }
    ],
    "sources": [
      "https://www.dold.com/downloads/LG5925_DB.pdf (LG 5925 / 01.04.22 en / 542A)"
    ]
  },
  {
    "id": "dold-lg5925-900-light-curtain",
    "title": "Dold SAFEMASTER LG 5925/900 light curtain controller",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "family": "LG 5925/900"
    },
    "normal": [
      {
        "terminals": "A1+ to A2",
        "state": "powered",
        "meter": "VDC",
        "expected": "DC 24 V; range 0.9-1.1 UN",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "S11 to S21",
        "state": "powered",
        "meter": "VDC",
        "expected": "DC 22.5 V",
        "pins": [
          [
            "S11",
            "S21"
          ]
        ]
      },
      {
        "terminals": "S12, S22 to S21",
        "state": "light curtain clear, relays activated",
        "meter": "VDC",
        "expected": ">= DC 21 V",
        "pins": [
          [
            "S12",
            "S21"
          ],
          [
            "S22",
            "S21"
          ]
        ],
        "note": "Asymmetric curtains: minus-switching OSSD to S22, plus-switching to S12."
      },
      {
        "terminals": "13-14, 23-24, 33-34",
        "state": "K1/K2 energized",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ],
          [
            "33",
            "34"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK (light curtain clear, K1/K2 energized)",
        "note": "https://cdn.automationdirect.com/static/manuals/safetyrelays/lg5925_900.pdf: LG 5925.48 3 NO, 1 NC contact; NO contacts are safety contacts; NC contacts 41-42 only for monitoring"
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK (light curtain clear, K1/K2 energized)",
        "note": "https://cdn.automationdirect.com/static/manuals/safetyrelays/lg5925_900.pdf: LG 5925.48 3 NO, 1 NC contact; NO contacts are safety contacts; NC contacts 41-42 only for monitoring"
      },
      {
        "a": "33",
        "b": "34",
        "when": "safety OK (light curtain clear, K1/K2 energized)",
        "note": "https://cdn.automationdirect.com/static/manuals/safetyrelays/lg5925_900.pdf: LG 5925.48 3 NO, 1 NC contact; NO contacts are safety contacts; NC contacts 41-42 only for monitoring"
      },
      {
        "a": "41",
        "b": "42",
        "when": "safety not OK (K1/K2 de-energized)",
        "note": "https://cdn.automationdirect.com/static/manuals/safetyrelays/lg5925_900.pdf: LG 5925.48 3 NO, 1 NC contact; NO contacts are safety contacts; NC contacts 41-42 only for monitoring"
      }
    ],
    "indicators": [
      {
        "name": "Power",
        "state": "on",
        "meaning": "Supply connected"
      },
      {
        "name": "K1 / K2",
        "state": "on",
        "meaning": "Relay K1 and K2 energized"
      }
    ],
    "faults": [
      {
        "title": "No power LED",
        "symptom": "LED Power off",
        "causes": [
          "Power supply not connected"
        ],
        "confirm": [
          "Measure A1+ to A2: DC 24 V."
        ],
        "fix": [
          "Restore supply."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/safetyrelays/lg5925_900.pdf (LG 5925/900 / 01.04.22 en / 544A) (Troubleshooting, p. 15)"
      },
      {
        "title": "One channel only",
        "symptom": "K1 lit, K2 off (or vice versa)",
        "causes": [
          "Relay welded (replace device)",
          "One-channel switch-off on S12 or S22"
        ],
        "confirm": [
          "Measure S12 and S22 to S21."
        ],
        "fix": [
          "Switch the other channel off as well, then restart; replace if welded."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/safetyrelays/lg5925_900.pdf (LG 5925/900 / 01.04.22 en / 544A) (Troubleshooting)"
      },
      {
        "title": "Cannot be activated",
        "symptom": "Outputs stay open with curtain clear",
        "causes": [
          "Manual start: line fault on start button",
          "Automatic: S33-S34 not bridged",
          "Relay welded",
          "Switch S1 wrong for symmetric/asymmetric outputs"
        ],
        "confirm": [
          "Check S33-S34 wiring and S1/S2 settings (set S1 only with power off)."
        ],
        "fix": [
          "Disconnect power and remove the line fault / correct settings."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/safetyrelays/lg5925_900.pdf (LG 5925/900 / 01.04.22 en / 544A) (Notes; Troubleshooting)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/safetyrelays/lg5925_900.pdf (LG 5925/900 / 01.04.22 en / 544A)"
    ]
  },
  {
    "id": "dold-bg5933-two-hand",
    "title": "Dold SAFEMASTER BG 5933 two-hand safety relay",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "family": "BG 5933"
    },
    "normal": [
      {
        "terminals": "A1(+) to A2(-)",
        "state": "powered",
        "meter": "VDC",
        "expected": "AC/DC 24 V; DC 0.9-1.1 UN, AC 0.85-1.1 UN",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "Y1-Y2",
        "state": "ready",
        "meter": "continuity",
        "expected": "closed (feedback circuit through external contactor NC contacts)",
        "pins": [
          [
            "Y1",
            "Y2"
          ]
        ]
      },
      {
        "terminals": "13-14, 23-24",
        "state": "both buttons pressed within 0.5 s",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "both buttons pressed within 0.5 s (outputs enabled)",
        "note": "BG 5933: NO 13, 23, NC 31. 13-14/23-24 close if S1 and S2 operate within 0.5 s; NC 31-32 is for signalling only. https://cdn.automationdirect.com/static/manuals/safetyrelays/bg5933_bh5933.pdf"
      },
      {
        "a": "23",
        "b": "24",
        "when": "both buttons pressed within 0.5 s (outputs enabled)",
        "note": "BG 5933: NO 13, 23, NC 31. 13-14/23-24 close if S1 and S2 operate within 0.5 s; NC 31-32 is for signalling only. https://cdn.automationdirect.com/static/manuals/safetyrelays/bg5933_bh5933.pdf"
      },
      {
        "a": "31",
        "b": "32",
        "when": "outputs not enabled (K1/K2 de-energized)",
        "note": "BG 5933: NO 13, 23, NC 31. 13-14/23-24 close if S1 and S2 operate within 0.5 s; NC 31-32 is for signalling only. https://cdn.automationdirect.com/static/manuals/safetyrelays/bg5933_bh5933.pdf"
      }
    ],
    "indicators": [
      {
        "name": "Power",
        "state": "on",
        "meaning": "Operating voltage applied"
      },
      {
        "name": "K1",
        "state": "on",
        "meaning": "Relay K1 active"
      },
      {
        "name": "K2",
        "state": "on",
        "meaning": "Relay K2 active"
      }
    ],
    "faults": [
      {
        "title": "No power LED",
        "symptom": "Power LED off",
        "causes": [
          "Power supply not connected"
        ],
        "confirm": [
          "Measure A1-A2."
        ],
        "fix": [
          "Restore supply."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/safetyrelays/bg5933_bh5933.pdf (BG 5933, BH 5933 / 12.12.22 en / 662A) (Troubleshooting, p. 17)"
      },
      {
        "title": "Simultaneity not met",
        "symptom": "Only one K LED lights, or outputs do not close",
        "causes": [
          "Buttons not operated within <= 0.5 s",
          "K1 or K2 welded (replace device)"
        ],
        "confirm": [
          "Release both buttons and press together within 0.5 s."
        ],
        "fix": [
          "Train operator / check button wiring; replace device if a relay is welded."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/safetyrelays/bg5933_bh5933.pdf (BG 5933, BH 5933 / 12.12.22 en / 662A) (Troubleshooting; Technical data: delay time for simultaneity max. 0.5 s)"
      },
      {
        "title": "Feedback circuit open",
        "symptom": "Device cannot be activated",
        "causes": [
          "Y1-Y2 not closed (external contactor NC open or wiring)"
        ],
        "confirm": [
          "Measure continuity Y1-Y2 with contactors de-energized."
        ],
        "fix": [
          "Repair feedback loop / replace stuck contactor."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/safetyrelays/bg5933_bh5933.pdf (BG 5933, BH 5933 / 12.12.22 en / 662A) (Troubleshooting)"
      },
      {
        "title": "Buttons held at power-up",
        "symptom": "Outputs do not energize after voltage return",
        "causes": [
          "Both buttons pressed while switching on the operating voltage"
        ],
        "confirm": [
          "Release both buttons."
        ],
        "fix": [
          "Release and press again."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/safetyrelays/bg5933_bh5933.pdf (BG 5933, BH 5933 / 12.12.22 en / 662A) (Notes)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/safetyrelays/bg5933_bh5933.pdf (BG 5933, BH 5933 / 12.12.22 en / 662A)"
    ]
  },
  {
    "id": "idem-scr31-viper",
    "title": "IDEM SCR31 Viper E-stop / gate safety relay",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "partNumber": "^SCR31"
    },
    "normal": [
      {
        "terminals": "A1 to A2",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VAC/DC; range 85-110%",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "S11",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC control voltage (100 mA)"
      },
      {
        "terminals": "13-14, 23-24, 33-34",
        "state": "K1/K2 closed",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ],
          [
            "33",
            "34"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK (K1/K2 closed)",
        "note": "https://cdn.automationdirect.com/static/specs/viperscr31.pdf p.tESC-472: 13-14, 23-24, 33-34 safety outputs; LED K1/K2 \"Internal relay safety output contacts closed\""
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK (K1/K2 closed)",
        "note": "https://cdn.automationdirect.com/static/specs/viperscr31.pdf p.tESC-472: 13-14, 23-24, 33-34 safety outputs; LED K1/K2 \"Internal relay safety output contacts closed\""
      },
      {
        "a": "33",
        "b": "34",
        "when": "safety OK (K1/K2 closed)",
        "note": "https://cdn.automationdirect.com/static/specs/viperscr31.pdf p.tESC-472: 13-14, 23-24, 33-34 safety outputs; LED K1/K2 \"Internal relay safety output contacts closed\""
      }
    ],
    "indicators": [
      {
        "name": "Power",
        "state": "on",
        "meaning": "Power applied to device"
      },
      {
        "name": "Reset",
        "state": "on",
        "meaning": "Reset circuit is closed"
      },
      {
        "name": "CH1",
        "state": "on",
        "meaning": "External switch input 1 closed"
      },
      {
        "name": "CH2",
        "state": "on",
        "meaning": "External switch input 2 closed"
      },
      {
        "name": "K1",
        "state": "on",
        "meaning": "Internal relay safety output contacts closed"
      },
      {
        "name": "K2",
        "state": "on",
        "meaning": "Internal relay safety output contacts closed"
      }
    ],
    "faults": [
      {
        "title": "Channel open",
        "symptom": "CH1 or CH2 LED off",
        "causes": [
          "E-stop/gate contact or wiring open on that channel"
        ],
        "confirm": [
          "Read which CH LED is off and trace that channel back from S11."
        ],
        "fix": [
          "Close/repair the channel."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/viperscr31.pdf (tESC-472 LED diagnostics)"
      },
      {
        "title": "Reset circuit open",
        "symptom": "CH1/CH2 on, Reset LED never lights",
        "causes": [
          "Reset button or contactor feedback contacts in the reset loop open"
        ],
        "confirm": [
          "Press reset and watch the Reset LED."
        ],
        "fix": [
          "Repair reset/feedback wiring."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/viperscr31.pdf (tESC-472 LED diagnostics, reset wiring options)"
      },
      {
        "title": "Line resistance too high",
        "symptom": "Unreliable operation on long runs",
        "causes": [
          "Cabling and connecting resistance of control lines above 300 ohm"
        ],
        "confirm": [
          "Measure loop resistance with power off."
        ],
        "fix": [
          "Shorten / upsize control wiring."
        ],
        "source": "https://cdn.automationdirect.com/static/specs/viperscr31.pdf (tESC-472 note)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/specs/viperscr31.pdf"
    ]
  },
  {
    "id": "idem-scr2h-two-hand",
    "title": "IDEM SCR-2H two-hand safety relay",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "family": "SCR-2H"
    },
    "normal": [
      {
        "terminals": "X1-X2",
        "state": "ready",
        "meter": "continuity",
        "expected": "closed (feedback loop)",
        "pins": [
          [
            "X1",
            "X2"
          ]
        ]
      },
      {
        "terminals": "13-14, 23-24",
        "state": "T1 and T2 pressed within 0.5 s",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "T1 and T2 pressed within 0.5 s (outputs enabled)",
        "note": "https://cdn.automationdirect.com/static/manuals/idem2hand/e61-328-00.pdf: 13-14 Safety contact 1, 23-24 Safety contact 2 (2 NO contacts)"
      },
      {
        "a": "23",
        "b": "24",
        "when": "T1 and T2 pressed within 0.5 s (outputs enabled)",
        "note": "https://cdn.automationdirect.com/static/manuals/idem2hand/e61-328-00.pdf: 13-14 Safety contact 1, 23-24 Safety contact 2 (2 NO contacts)"
      }
    ],
    "indicators": [
      {
        "name": "Power",
        "state": "on",
        "meaning": "Power applied"
      },
      {
        "name": "K1 / K2",
        "state": "on",
        "meaning": "Internal relay safety output contacts closed"
      }
    ],
    "faults": [
      {
        "title": "Does not switch on",
        "symptom": "Outputs stay open when both buttons pressed",
        "causes": [
          "Buttons not actuated within 0.5 s, or only one actuated",
          "Feedback loop X1-X2 open (external contactor fault)",
          "Short circuit, cable break or switching device error"
        ],
        "confirm": [
          "Measure A1-A2 supply.",
          "Check continuity X1-X2.",
          "Check each button on S11/S12/S13 (T1) and S21/S22/S23 (T2)."
        ],
        "fix": [
          "Release both buttons, close the feedback loop, press together; return device to maker if fault remains."
        ],
        "source": "https://cdn.automationdirect.com/static/manuals/idem2hand/e61-328-00.pdf (Function; What to do in case of a fault)"
      }
    ],
    "sources": [
      "https://cdn.automationdirect.com/static/manuals/idem2hand/e61-328-00.pdf",
      "https://cdn.automationdirect.com/static/specs/idemtwohandcontroller.pdf"
    ]
  },
  {
    "id": "ab-guardmaster-440r-gsr",
    "title": "Allen-Bradley Guardmaster 440R GSR safety relays (SI, CI, DI)",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "family": "Guardmaster 440R"
    },
    "normal": [
      {
        "terminals": "A1 to A2",
        "state": "powered",
        "meter": "VDC",
        "expected": "20.4-26.4 VDC",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "S11, S21 (pulse test outputs) to A2",
        "state": "device contacts open (CI)",
        "meter": "VDC",
        "expected": "18-19 V on DMM",
        "pins": [
          [
            "S11",
            "A2"
          ],
          [
            "S21",
            "A2"
          ]
        ]
      },
      {
        "terminals": "S12, S22 to A2",
        "state": "contacts closed (CI)",
        "meter": "VDC",
        "expected": "about 19 V (DMM); DI/DIS/SI: ch1 about 14 V, ch2 about 18 V",
        "pins": [
          [
            "S12",
            "A2"
          ],
          [
            "S22",
            "A2"
          ]
        ]
      },
      {
        "terminals": "S34 to A2",
        "state": "reset pressed",
        "meter": "VDC",
        "expected": "24 V; monitored manual reset needs 0 -> 24 -> 0 V within 250-3000 ms",
        "pins": [
          [
            "S34",
            "A2"
          ]
        ]
      },
      {
        "terminals": "13 / 14 (23 / 24)",
        "state": "OUT steady green",
        "meter": "VDC",
        "expected": "14 equals supply voltage when output closed",
        "pins": [
          [
            "14",
            "A2"
          ],
          [
            "24",
            "A2"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK (OUT on)",
        "note": "OUT On closes: CI 13/14, 23/24, 33/34 (41/42 open); DI/SI 13/14, 23/24; EM 13/14, 23/24, 33/34, 43/44. DIS: OSSD 14, 24, 34, 44 (CI, DI, EM, SI) https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf"
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK (OUT on)",
        "note": "OUT On closes: CI 13/14, 23/24, 33/34 (41/42 open); DI/SI 13/14, 23/24; EM 13/14, 23/24, 33/34, 43/44. DIS: OSSD 14, 24, 34, 44 (CI, DI, EM, SI) https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf"
      },
      {
        "a": "33",
        "b": "34",
        "when": "safety OK (OUT on)",
        "note": "OUT On closes: CI 13/14, 23/24, 33/34 (41/42 open); DI/SI 13/14, 23/24; EM 13/14, 23/24, 33/34, 43/44. DIS: OSSD 14, 24, 34, 44 (CI and EM only) https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf"
      },
      {
        "a": "43",
        "b": "44",
        "when": "safety OK (OUT on)",
        "note": "OUT On closes: CI 13/14, 23/24, 33/34 (41/42 open); DI/SI 13/14, 23/24; EM 13/14, 23/24, 33/34, 43/44. DIS: OSSD 14, 24, 34, 44 (EM only) https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf"
      },
      {
        "a": "41",
        "b": "42",
        "when": "safety not OK (OUT off)",
        "note": "OUT On closes: CI 13/14, 23/24, 33/34 (41/42 open); DI/SI 13/14, 23/24; EM 13/14, 23/24, 33/34, 43/44. DIS: OSSD 14, 24, 34, 44 (CI only) https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf"
      }
    ],
    "indicators": [
      {
        "name": "PWR/Fault",
        "state": "off",
        "meaning": "No power"
      },
      {
        "name": "PWR/Fault",
        "state": "steady green",
        "meaning": "Run state"
      },
      {
        "name": "PWR/Fault",
        "state": "steady red",
        "meaning": "Nonrecoverable fault (e.g. short A1/A2 to S11 or S21) - cycle power"
      },
      {
        "name": "PWR/Fault",
        "state": "flashing red 1 Hz",
        "meaning": "Configuration mode"
      },
      {
        "name": "PWR/Fault",
        "state": "flashing red 2 times",
        "meaning": "Invalid configuration"
      },
      {
        "name": "PWR/Fault",
        "state": "flashing red 3 times",
        "meaning": "Invalid configuration (DI/DIS mats/logic)"
      },
      {
        "name": "PWR/Fault",
        "state": "flashing red 4 times",
        "meaning": "Cross fault (S11 to S21 short, capacitance)"
      },
      {
        "name": "PWR/Fault",
        "state": "flashing red 5 times",
        "meaning": "Output test failed on L11 (SWS)"
      },
      {
        "name": "PWR/Fault",
        "state": "green with flashing red 2 times",
        "meaning": "Configuration does not agree with EEPROM (switch moved)"
      },
      {
        "name": "IN / IN1 / IN2",
        "state": "green",
        "meaning": "Both channels closed"
      },
      {
        "name": "IN / IN1 / IN2",
        "state": "off",
        "meaning": "One or both channels open"
      },
      {
        "name": "OUT",
        "state": "flashing green 1 Hz",
        "meaning": "Inputs satisfied, waiting for reset at S34"
      },
      {
        "name": "OUT",
        "state": "steady green",
        "meaning": "Safety outputs on"
      }
    ],
    "faults": [
      {
        "code": "flash red 4",
        "title": "Cross fault",
        "symptom": "PWR/Fault flashes red 4 times",
        "causes": [
          "Short S11 to S21",
          "Excessive capacitance on input wiring"
        ],
        "confirm": [
          "With power off, check S11-S21 and input cables for shorts."
        ],
        "fix": [
          "Remove short, cycle the input device or power."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf (440R-UM013I-EN-P) (Table 12, p. 51)"
      },
      {
        "code": "steady red",
        "title": "Nonrecoverable fault",
        "symptom": "PWR/Fault steady red",
        "causes": [
          "Short +24V (A1) or A2 to S11/S21",
          "Noise / power interruption"
        ],
        "confirm": [
          "Check wiring at S11/S21; check grounding of 24 V common at the PSU."
        ],
        "fix": [
          "Cycle power; reconfigure if needed."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf (440R-UM013I-EN-P) (Table 11, p. 50)"
      },
      {
        "title": "Input channel open",
        "symptom": "IN LED off",
        "causes": [
          "Safety device open, wiring open, one channel only"
        ],
        "confirm": [
          "Measure S12/S22 to A2 with a DMM: turn-on level 6-8 V, turn-off level 3-4 V; a channel at or below the turn-off level is open."
        ],
        "fix": [
          "Repair device/wiring."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf (440R-UM013I-EN-P) (Step 3, Table 14-15, p. 53-54)"
      },
      {
        "title": "Will not reset",
        "symptom": "OUT flashes green, outputs stay off on reset",
        "causes": [
          "Reset/feedback loop open to S34",
          "Monitored reset pulse too short/long (must be 250-3000 ms)"
        ],
        "confirm": [
          "Measure S34 while pressing reset: no 24 V = check reset button and contactor feedback contacts in series."
        ],
        "fix": [
          "Repair the loop; if 24 V present and auto/manual reset, replace the relay."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf (440R-UM013I-EN-P) (Step 5, p. 61; Monitored reset p. 23)"
      },
      {
        "title": "Output closed but load dead",
        "symptom": "OUT steady green, contactor not energized",
        "causes": [
          "Open wire, blown fuse or tripped breaker in output circuit",
          "Internal relay not closing"
        ],
        "confirm": [
          "Measure 13 and 14 to 0 V: 13 must equal supply; if 14 is 0 V the relay contact is not closing."
        ],
        "fix": [
          "Repair wiring or replace the relay."
        ],
        "source": "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf (440R-UM013I-EN-P) (Step 6, Figure 79, p. 62-63)"
      }
    ],
    "sources": [
      "https://literature.rockwellautomation.com/idc/groups/literature/documents/um/440r-um013_-en-p.pdf (440R-UM013I-EN-P)"
    ]
  },
  {
    "id": "siemens-3sk1-standard",
    "title": "Siemens SIRIUS 3SK1 Standard safety relay (3SK1111)",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "partNumber": "^3SK1111"
    },
    "normal": [
      {
        "terminals": "A1 to A2",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 V AC/DC (3SK1111-.AB30)",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "13-14, 23-24, 33-34",
        "state": "DEVICE and OUT green",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ],
          [
            "33",
            "34"
          ]
        ]
      },
      {
        "terminals": "41-42",
        "state": "outputs on",
        "meter": "continuity",
        "expected": "open (NC signaling)",
        "pins": [
          [
            "41",
            "42"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK (enabling circuits on)",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.1.3: NO contacts 13/14, 23/24, 33/34 (safety-related)"
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK (enabling circuits on)",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.1.3"
      },
      {
        "a": "33",
        "b": "34",
        "when": "safety OK (enabling circuits on)",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.1.3"
      },
      {
        "a": "41",
        "b": "42",
        "when": "enabling circuits off",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.1.3: NC contacts 41/42 (non-safety signalling)"
      }
    ],
    "indicators": [
      {
        "name": "DEVICE",
        "state": "green",
        "meaning": "Supply ON"
      },
      {
        "name": "OUT",
        "state": "green",
        "meaning": "Enabling circuits closed"
      },
      {
        "name": "DEVICE + OUT",
        "state": "off",
        "meaning": "Cross-circuit or no power supply"
      }
    ],
    "faults": [
      {
        "title": "No supply / cross-circuit",
        "symptom": "DEVICE and OUT off",
        "causes": [
          "No supply",
          "Cross-circuit between channels"
        ],
        "confirm": [
          "Measure A1-A2; check T1/IN1 and T2/IN2 wiring for shorts."
        ],
        "fix": [
          "Restore supply / remove cross-circuit."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A) (5.1.3.7 Display of the operating state, p. 52)"
      },
      {
        "title": "Outputs not enabled",
        "symptom": "DEVICE green, OUT off",
        "causes": [
          "Sensor open (E-stop pressed)",
          "START not pressed (monitored start)"
        ],
        "confirm": [
          "Check sensor at T1-IN1/T2-IN2 and START on INF/S."
        ],
        "fix": [
          "Close sensor, press START."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A) (5.1.3.4, 5.1.3.7)"
      }
    ],
    "sources": [
      "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A)"
    ]
  },
  {
    "id": "siemens-3sk1-advanced",
    "title": "Siemens SIRIUS 3SK1 Advanced safety relay (3SK1121)",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "partNumber": "^3SK1121"
    },
    "normal": [
      {
        "terminals": "A1 to A2",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VDC",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "T1-IN1, T2-IN2",
        "state": "sensors closed",
        "meter": "continuity",
        "expected": "closed (channels must close within 0.5 s)",
        "pins": [
          [
            "T1",
            "IN1"
          ],
          [
            "T2",
            "IN2"
          ]
        ]
      },
      {
        "terminals": "13-14, 23-24, 33-34",
        "state": "DEVICE/OUT/IN green",
        "meter": "continuity",
        "expected": "closed",
        "pins": [
          [
            "13",
            "14"
          ],
          [
            "23",
            "24"
          ],
          [
            "33",
            "34"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK (enabling circuits on)",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.2.6.4 / 5.2.7: 13-14 enabling circuit (NO, relay contact)"
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK (enabling circuits on)",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.2.6.4 / 5.2.7"
      },
      {
        "a": "33",
        "b": "34",
        "when": "safety OK (enabling circuits on)",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.2.6.4: instantaneous 3SK1121-xAB40 only"
      },
      {
        "a": "41",
        "b": "42",
        "when": "enabling circuits off",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.2.6.4: signalling circuit (NC, relay contact), instantaneous 3SK1121-xAB40 only"
      },
      {
        "a": "37",
        "b": "38",
        "when": "safety OK (opens after the set OFF-delay)",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.2.7: time-delayed enabling circuit 1 (NO), 3SK1121-xCB4y only"
      },
      {
        "a": "47",
        "b": "48",
        "when": "safety OK (opens after the set OFF-delay)",
        "note": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf 5.2.7: time-delayed enabling circuit 2 (NO), 3SK1121-xCB4y only"
      }
    ],
    "indicators": [
      {
        "name": "DEVICE",
        "state": "green",
        "meaning": "Ready"
      },
      {
        "name": "DEVICE",
        "state": "green flashing",
        "meaning": "Missing startup testing"
      },
      {
        "name": "DEVICE",
        "state": "red",
        "meaning": "Device error"
      },
      {
        "name": "OUT",
        "state": "green",
        "meaning": "Output active"
      },
      {
        "name": "OUT",
        "state": "green flashing",
        "meaning": "Feedback circuit error"
      },
      {
        "name": "OUT",
        "state": "yellow flashing",
        "meaning": "START button pressed too long"
      },
      {
        "name": "IN",
        "state": "green",
        "meaning": "Start conditions fulfilled"
      },
      {
        "name": "IN",
        "state": "green flashing",
        "meaning": "Simultaneity not fulfilled / START not yet pressed"
      },
      {
        "name": "IN",
        "state": "yellow flashing",
        "meaning": "Short-circuit of T1/T2 to ground or 24 V / cross-circuit"
      },
      {
        "name": "SF",
        "state": "red",
        "meaning": "Group error (cross-circuit, short to P, configuration changed)"
      },
      {
        "name": "SF",
        "state": "red flashing",
        "meaning": "Error message (short T1/T2, simultaneity, feedback, START too long)"
      }
    ],
    "faults": [
      {
        "title": "Simultaneity violated",
        "symptom": "IN green flashing, SF red flashing",
        "causes": [
          "Channels did not close within 0.5 s"
        ],
        "confirm": [
          "Open both channels and close together."
        ],
        "fix": [
          "Repair sensor/actuator alignment."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A) (12.4 Diagnostics, p. 207)"
      },
      {
        "title": "Short-circuit test output",
        "symptom": "IN yellow flashing, SF red flashing",
        "causes": [
          "T1 or T2 shorted"
        ],
        "confirm": [
          "Check T1/T2 wiring for short to 0 V/24 V."
        ],
        "fix": [
          "Repair wiring."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A) (12.4)"
      },
      {
        "title": "Feedback circuit error",
        "symptom": "OUT green flashing, SF red flashing",
        "causes": [
          "INF loop open (contactor NC stuck)"
        ],
        "confirm": [
          "Check continuity of feedback loop at T2-INF."
        ],
        "fix": [
          "Repair loop / replace contactor."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A) (12.4)"
      },
      {
        "title": "START pressed too long",
        "symptom": "OUT yellow flashing, SF red flashing",
        "causes": [
          "START held > 2 s or shorted (INS)"
        ],
        "confirm": [
          "Measure INS input with button released."
        ],
        "fix": [
          "Repair button/wiring."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A) (12.4)"
      },
      {
        "title": "Group error",
        "symptom": "SF red",
        "causes": [
          "Cross-circuit at input, short to P, configuration changed"
        ],
        "confirm": [
          "Inspect wiring and DIP settings."
        ],
        "fix": [
          "Correct and press SET/RESET."
        ],
        "source": "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A) (12.4 Error mode)"
      }
    ],
    "sources": [
      "https://cache.industry.siemens.com/dl/files/885/67585885/att_37825/v1/manual_safety_relay_3SK1_en-US.pdf (Manual 02/2014, A5E02526190021A)"
    ]
  },
  {
    "id": "schneider-xpsuaf",
    "title": "Schneider Harmony XPSUAF safety module",
    "match": {
      "categories": [
        "safetyRelay"
      ],
      "family": "XPSU"
    },
    "normal": [
      {
        "terminals": "A1 to A2",
        "state": "powered",
        "meter": "VDC",
        "expected": "24 VAC/VDC",
        "pins": [
          [
            "A1",
            "A2"
          ]
        ]
      },
      {
        "terminals": "S12, S22 (CH+) to B2",
        "state": "channels closed",
        "meter": "VDC",
        "expected": "> 15 VDC (activate); < 5 VDC = deactivated",
        "pins": [
          [
            "S12",
            "B2"
          ],
          [
            "S22",
            "B2"
          ]
        ]
      },
      {
        "terminals": "Y1-Y2",
        "state": "start",
        "meter": "continuity",
        "expected": "closed on start",
        "pins": [
          [
            "Y1",
            "Y2"
          ]
        ]
      }
    ],
    "pairs": [
      {
        "a": "13",
        "b": "14",
        "when": "safety OK (outputs on)",
        "note": "https://www.se.com/us/en/download/document/PHA71842/ (PHA71842): terminals 13/23/33 - 14/24/34 normally open relay contacts (safety outputs)"
      },
      {
        "a": "23",
        "b": "24",
        "when": "safety OK (outputs on)",
        "note": "https://www.se.com/us/en/download/document/PHA71842/ (PHA71842): terminals 13/23/33 - 14/24/34 normally open relay contacts (safety outputs)"
      },
      {
        "a": "33",
        "b": "34",
        "when": "safety OK (outputs on)",
        "note": "https://www.se.com/us/en/download/document/PHA71842/ (PHA71842): terminals 13/23/33 - 14/24/34 normally open relay contacts (safety outputs)"
      }
    ],
    "indicators": [
      {
        "name": "LED green",
        "state": "on",
        "meaning": "Power ON"
      },
      {
        "name": "LED red",
        "state": "on",
        "meaning": "Error"
      },
      {
        "name": "LED yellow",
        "state": "on",
        "meaning": "Start / safety status / safety inputs S12, S22"
      }
    ],
    "faults": [
      {
        "title": "Synchronization exceeded",
        "symptom": "Outputs not activated",
        "causes": [
          "Channels not activated within the synchronization time (0.5 s for functions 3, 5, 6; 2 s / 4 s for function 2)"
        ],
        "confirm": [
          "Open both channels and close together."
        ],
        "fix": [
          "Repair sensor/wiring."
        ],
        "source": "https://www.se.com/us/en/download/document/PHA71842/ (Instruction sheet PHA71842_08) (Function selector table note F; Technical data)"
      }
    ],
    "sources": [
      "https://www.se.com/us/en/product/XPSUAF13AP/ (product data sheet XPSUAF13AP)",
      "https://www.se.com/us/en/download/document/PHA71842/ (Instruction sheet PHA71842_08)"
    ]
  }
];
